package watch

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/watcher"
)

var baseURLRegex = regexp.MustCompile(`(?i)(base.*url|url.*base)`)

type Usecase struct {
	watcher        *watcher.FileWatcher
	errHandler     localerror.HandleError
	collectionRepo bbolt.RepositoryInterface[domain.Collection]
}

func NewUsecase(lg logger.Logger, collectionRepo bbolt.RepositoryInterface[domain.Collection]) *Usecase {
	fw := watcher.New(lg)

	if selected := findSelectedCollection(collectionRepo); selected != nil {
		fw.Watch(selected.Path)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		watcher:        fw,
		collectionRepo: collectionRepo,
	}
}

func findSelectedCollection(repo bbolt.RepositoryInterface[domain.Collection]) *domain.Collection {
	all, err := repo.List(context.Background())
	if err != nil {
		return nil
	}
	for i := range all {
		if all[i].IsSelected {
			return &all[i]
		}
	}
	return nil
}

func (u *Usecase) ListCollections() ([]domain.Collection, error) {
	return u.collectionRepo.List(context.Background())
}

func (u *Usecase) Read(id string) (ReadResponse, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return ReadResponse{}, localerror.InvalidData("Collection not found")
	}

	fileBytes, err := os.ReadFile(collection.Path)
	if err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return ReadResponse{}, u.errHandler.ErrorReturn(err)
	}

	for i := range docsContent.Variable {
		if isBaseURLVar(docsContent.Variable[i].Key) && docsContent.Variable[i].ID == "" {
			docsContent.Variable[i].Category = "BASE_URL"
		}
	}

	docsContent.Item = setContentType(docsContent.Item)
	docsContent.Item = setBearerAuthorization(docsContent.Item, docsContent.Auth)
	docsContent.Item = setId(docsContent.Item)
	return ReadResponse{
		Content:   docsContent,
		Changed:   false,
		UpdatedAt: collection.UpdatedAt,
	}, nil
}

func (u *Usecase) CreateCollection(req CreateCollectionRequest) (domain.Collection, error) {
	now := time.Now()
	collection := domain.Collection{
		ID:         uuid.NewString(),
		Name:       req.Name,
		Path:       req.Path,
		IsSelected: false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := u.collectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	return collection, nil
}

func (u *Usecase) UpdateCollectionByID(id string, req UpdateCollectionRequest) (domain.Collection, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return domain.Collection{}, localerror.InvalidData("Collection not found")
	}
	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Path != "" {
		collection.Path = req.Path
	}
	collection.UpdatedAt = time.Now()
	if err := u.collectionRepo.Update(context.Background(), id, collection); err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}
	return *collection, nil
}

func (u *Usecase) DeleteCollection(id string) error {
	return u.collectionRepo.Delete(context.Background(), id)
}

func (u *Usecase) SelectCollection(id string) (domain.Collection, error) {
	all, err := u.collectionRepo.List(context.Background())
	if err != nil {
		return domain.Collection{}, u.errHandler.ErrorReturn(err)
	}

	var selected *domain.Collection
	for _, c := range all {
		c.IsSelected = false
		if c.ID == id {
			c.IsSelected = true
			selected = &c
		}
		if err := u.collectionRepo.Update(context.Background(), c.ID, &c); err != nil {
			return domain.Collection{}, u.errHandler.ErrorReturn(err)
		}
	}

	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("Collection not found")
	}

	u.watcher.Watch(selected.Path)

	return *selected, nil
}

func (u *Usecase) GetActiveCollection() (domain.Collection, error) {
	selected := findSelectedCollection(u.collectionRepo)
	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("No active collection")
	}
	return *selected, nil
}

func (u *Usecase) WriteCollection(id string, content string) error {
	if content == "" {
		return localerror.InvalidData("Collection content is required")
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	if err := os.WriteFile(collection.Path, []byte(content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	info, err := os.Stat(collection.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	if u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(content, info.ModTime())
	}

	if info.ModTime().IsZero() && u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(content, time.Now())
	}

	return nil
}

func (u *Usecase) UploadCollection(fileBytes []byte) error {
	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")

	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return localerror.InvalidData("Invalid collection.json file")
	}

	if docsContent.Info.Name == "" {
		return localerror.InvalidData("Collection info name is required")
	}

	if len(docsContent.Item) == 0 {
		return localerror.InvalidData("Collection item is required")
	}

	return u.saveToFile([]byte(content))
}

func (u *Usecase) saveToFile(content []byte) error {
	selected := findSelectedCollection(u.collectionRepo)
	if selected == nil {
		return localerror.InvalidData("No active collection selected")
	}

	if err := os.WriteFile(selected.Path, content, 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	info, err := os.Stat(selected.Path)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	if u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(string(content), info.ModTime())
	}

	if info.ModTime().IsZero() && u.watcher != nil && u.watcher.State != nil {
		u.watcher.State.Update(string(content), time.Now())
	}

	return nil
}

func setId(item []CollectionItem) []CollectionItem {
	for i, _ := range item {
		item[i].ID = uuid.NewString()

		if item[i].Request != nil {
			for j := range item[i].Request.Header {
				item[i].Request.Header[j].Id = uuid.NewString()
			}
			for j := range item[i].Request.URL.Query {
				item[i].Request.URL.Query[j].Id = uuid.NewString()
			}
			if item[i].Request.Body != nil {
				for j := range item[i].Request.Body.FormData {
					item[i].Request.Body.FormData[j].Id = uuid.NewString()
				}
			}
		}

		if item[i].Item != nil {
			item[i].Item = setId(item[i].Item)
		}
	}

	return item
}

func setContentType(items []CollectionItem) []CollectionItem {
	for i := range items {
		if request := items[i].Request; request != nil && request.Body != nil {
			if contentType := contentTypeForBodyMode(request.Body.Mode); contentType != "" {
				found := false
				for j := range request.Header {
					if strings.EqualFold(strings.TrimSpace(request.Header[j].Key), "Content-Type") {
						request.Header[j].Value = contentType
						found = true
					}
				}
				if !found {
					request.Header = append(request.Header, Header{Key: "Content-Type", Value: contentType})
				}
			}
		}

		if items[i].Item != nil {
			items[i].Item = setContentType(items[i].Item)
		}
	}

	return items
}

func contentTypeForBodyMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "raw", "graphql":
		return "application/json"
	case "formdata", "form-data":
		return "multipart/form-data"
	case "urlencoded":
		return "application/x-www-form-urlencoded"
	case "file":
		return "application/octet-stream"
	default:
		return ""
	}
}

func setBearerAuthorization(items []CollectionItem, auth *CollectionAuth) []CollectionItem {
	if auth == nil || !strings.EqualFold(strings.TrimSpace(auth.Type), "bearer") {
		return items
	}

	token := ""
	for _, property := range auth.Bearer {
		if strings.EqualFold(strings.TrimSpace(property.Key), "token") {
			token = property.Value
			break
		}
		if token == "" && property.Value != "" {
			token = property.Value
		}
	}
	if token == "" {
		return items
	}

	for i := range items {
		if request := items[i].Request; request != nil {
			hasAuthorization := false
			for _, header := range request.Header {
				if strings.EqualFold(strings.TrimSpace(header.Key), "Authorization") {
					hasAuthorization = true
					break
				}
			}
			if !hasAuthorization {
				request.Header = append(request.Header, Header{
					Key:   "Authorization",
					Value: "Bearer " + token,
				})
			}
		}

		if items[i].Item != nil {
			items[i].Item = setBearerAuthorization(items[i].Item, auth)
		}
	}

	return items
}

func isBaseURLVar(s string) bool {
	return baseURLRegex.MatchString(s)
}
