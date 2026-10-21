package project

import (
	"context"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
)

type Usecase struct {
	errHandler     localerror.HandleError
	projectRepo    db.RepositoryInterface[domain.Project]
	collectionRepo db.RepositoryInterface[domain.Collection]
	testSuiteRepo  db.RepositoryInterface[domain.TestSuite]
	automationRepo db.RepositoryInterface[domain.Automation]
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	projectRepo, err := db.NewRepository[domain.Project](database, db.WithBucketName("Project"))
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize project repo for project usecase: %v", err)
	}
	collectionRepo, err := db.NewRepository[domain.Collection](database)
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize collection repo for project usecase: %v", err)
	}
	testSuiteRepo, err := db.NewRepository[domain.TestSuite](database, db.WithBucketName("TestSuite"))
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize test suite repo for project usecase: %v", err)
	}
	automationRepo, err := db.NewRepository[domain.Automation](database, db.WithBucketName("Automation"))
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize automation repo for project usecase: %v", err)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		projectRepo:    projectRepo,
		collectionRepo: collectionRepo,
		testSuiteRepo:  testSuiteRepo,
		automationRepo: automationRepo,
	}
}

func (u *Usecase) ListProjects(ctx context.Context) ([]ProjectResponse, error) {
	projects, err := u.projectRepo.List(ctx)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}

	collections, err := u.collectionRepo.List(ctx)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}

	return groupProjectsWithCollections(projects, collections), nil
}

func (u *Usecase) CreateProject(ctx context.Context, req CreateProjectRequest) (ProjectResponse, error) {
	if err := validateProjectRequest(req); err != nil {
		return ProjectResponse{}, err
	}

	project := newProjectEntity(req)
	if err := u.projectRepo.Create(ctx, project.ID, &project); err != nil {
		return ProjectResponse{}, u.errHandler.ErrorReturn(err)
	}

	collections, err := u.discoverAndSaveCollections(ctx, project.ID, project.Path)
	if err != nil {
		return ProjectResponse{}, u.errHandler.ErrorReturn(err)
	}

	return NewProjectResponse(project, collections), nil
}

func (u *Usecase) UpdateProjectByID(ctx context.Context, id string, req UpdateProjectRequest) (ProjectResponse, error) {
	project, err := u.getProject(ctx, id)
	if err != nil {
		return ProjectResponse{}, err
	}

	collections, err := u.syncProjectCollections(ctx, project, req)
	if err != nil {
		return ProjectResponse{}, err
	}

	ApplyProjectUpdate(project, req)
	if err := u.projectRepo.Update(ctx, id, project); err != nil {
		return ProjectResponse{}, u.errHandler.ErrorReturn(err)
	}

	return NewProjectResponse(*project, collections), nil
}

func (u *Usecase) DeleteProject(ctx context.Context, id string) error {
	project, err := u.getProject(ctx, id)
	if err != nil {
		return err
	}

	if err := u.deleteProjectCollections(ctx, project.ID); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	if err := u.projectRepo.Delete(ctx, project.ID); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}

func (u *Usecase) getProject(ctx context.Context, id string) (*domain.Project, error) {
	project, err := u.projectRepo.View(ctx, id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if project == nil {
		return nil, localerror.InvalidData("Project not found")
	}
	return project, nil
}

func (u *Usecase) syncProjectCollections(ctx context.Context, project *domain.Project, req UpdateProjectRequest) ([]domain.Collection, error) {
	newPath := strings.TrimSpace(req.Path)
	if newPath == "" || newPath == project.Path {
		return u.listProjectCollections(ctx, project.ID)
	}

	if err := validateDirectoryPath(newPath); err != nil {
		return nil, err
	}

	if err := u.deleteProjectCollections(ctx, project.ID); err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}

	collections, err := u.discoverAndSaveCollections(ctx, project.ID, newPath)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	return collections, nil
}

func (u *Usecase) listProjectCollections(ctx context.Context, projectID string) ([]domain.Collection, error) {
	all, err := u.collectionRepo.List(ctx)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	result := make([]domain.Collection, 0)
	for _, c := range all {
		if c.ProjectID == projectID {
			result = append(result, c)
		}
	}
	return result, nil
}

func (u *Usecase) discoverAndSaveCollections(ctx context.Context, projectID, rootPath string) ([]domain.Collection, error) {
	discovered := make([]domain.Collection, 0)
	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			if path != rootPath && shouldSkipDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.EqualFold(filepath.Ext(d.Name()), ".json") {
			return nil
		}

		col, ok, err := u.prepareDiscoveredCollection(ctx, projectID, path)
		if err != nil {
			return err
		}
		if ok {
			discovered = append(discovered, col)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return discovered, nil
}

func (u *Usecase) prepareDiscoveredCollection(ctx context.Context, projectID, filePath string) (domain.Collection, bool, error) {
	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return domain.Collection{}, false, nil
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docs collectionService.DocsContent
	if err := json.Unmarshal([]byte(content), &docs); err != nil || !docs.IsValidCollection() {
		return domain.Collection{}, false, nil
	}

	docs.PrepareCreate()
	updatedContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return domain.Collection{}, false, err
	}
	if err := os.WriteFile(filePath, updatedContent, 0644); err != nil {
		return domain.Collection{}, false, err
	}

	now := time.Now()
	collection := domain.Collection{
		ID:           uuid.NewString(),
		ProjectID:    projectID,
		Name:         docs.CollectionName(filePath),
		Path:         filePath,
		IsSelected:   false,
		CreatedAt:    now,
		UpdatedAt:    now,
		TestSuiteID:  uuid.NewString(),
		AutomationID: uuid.NewString(),
	}
	if err := u.collectionRepo.Create(ctx, collection.ID, &collection); err != nil {
		return domain.Collection{}, false, err
	}
	return collection, true, nil
}

func (u *Usecase) deleteProjectCollections(ctx context.Context, projectID string) error {
	all, err := u.collectionRepo.List(ctx)
	if err != nil {
		return err
	}
	for _, c := range all {
		if c.ProjectID != projectID {
			continue
		}
		if c.TestSuiteID != "" {
			_ = u.testSuiteRepo.Delete(ctx, c.TestSuiteID)
		}
		if c.AutomationID != "" {
			_ = u.automationRepo.Delete(ctx, c.AutomationID)
		}
		if err := u.collectionRepo.Delete(ctx, c.ID); err != nil {
			return err
		}
	}
	return nil
}

func validateProjectRequest(req CreateProjectRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return localerror.InvalidData("Project name is required")
	}
	return validateDirectoryPath(req.Path)
}

func validateDirectoryPath(path string) error {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return localerror.InvalidData("Project folder path is empty")
	}
	info, err := os.Stat(trimmed)
	if err != nil {
		return localerror.InvalidData("Project folder path is not valid: " + err.Error())
	}
	if !info.IsDir() {
		return localerror.InvalidData("Project path must be a directory")
	}
	return nil
}

func shouldSkipDir(name string) bool {
	switch strings.ToLower(name) {
	case ".git", "node_modules":
		return true
	default:
		return strings.HasPrefix(name, ".")
	}
}

func newProjectEntity(req CreateProjectRequest) domain.Project {
	now := time.Now()
	return domain.Project{
		ID:         uuid.NewString(),
		Name:       strings.TrimSpace(req.Name),
		Path:       strings.TrimSpace(req.Path),
		IsSelected: false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

func groupProjectsWithCollections(projects []domain.Project, collections []domain.Collection) []ProjectResponse {
	byProject := make(map[string][]domain.Collection, len(projects))
	for _, c := range collections {
		byProject[c.ProjectID] = append(byProject[c.ProjectID], c)
	}

	result := make([]ProjectResponse, 0, len(projects))
	for _, p := range projects {
		result = append(result, NewProjectResponse(p, byProject[p.ID]))
	}
	return result
}
