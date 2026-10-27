package doc

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/watcher"
	"github.com/rdhmuhammad/apitester/shared/base"
	"go.etcd.io/bbolt"
)

var (
	sharedDocWatcher     *watcher.FileWatcher
	sharedDocWatcherOnce sync.Once
	sharedDocMu          sync.Mutex
)

func getSharedDocWatcher(lg logger.Logger) *watcher.FileWatcher {
	sharedDocWatcherOnce.Do(func() {
		sharedDocWatcher = watcher.New(lg)
	})
	return sharedDocWatcher
}

type Usecase struct {
	*base.Port
	projectRepo db.RepositoryInterface[domain.Project]
	docWatcher  *watcher.FileWatcher
	onRefresh   RefreshListener
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	projectRepo, err := db.NewRepository[domain.Project](database, db.WithBucketName("Project"))
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize project repo for documentation usecase: %v", err)
	}

	fw := getSharedDocWatcher(lg)
	u := &Usecase{
		Port:        base.NewPort(lg, database),
		projectRepo: projectRepo,
		docWatcher:  fw,
	}

	if u.docWatcher != nil {
		u.docWatcher.OnChanges(u.NotifyChanges)
	}
	return u
}

func (u *Usecase) SetOnRefresh(listener RefreshListener) {
	u.onRefresh = listener
}

func (u *Usecase) NotifyChanges(_ []byte) {
	if u.onRefresh != nil {
		u.onRefresh(true)
	}
}

func (u *Usecase) GetTree(ctx context.Context) ([]DocumentTree, error) {
	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return nil, err
	}

	gi := NewGitIgnoreMatcher()
	rootGitIgnore := filepath.Join(rootPath, ".gitignore")
	if _, err := os.Stat(rootGitIgnore); err == nil {
		_ = gi.LoadGitIgnore(rootGitIgnore, "")
	}

	tree, err := u.scanDirectory(rootPath, rootPath, gi)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	return tree, nil
}

func (u *Usecase) CreateDocument(ctx context.Context, req CreateDocumentRequest) (DocumentResponse, error) {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return DocumentResponse{}, err
	}

	targetDir, err := u.resolveTargetDir(rootPath, req.ParentID)
	if err != nil {
		return DocumentResponse{}, err
	}

	relID, absPath, content, err := u.writeNewDocumentFile(rootPath, targetDir, req.Name)
	if err != nil {
		return DocumentResponse{}, err
	}

	return NewDocumentResponse(relID, absPath, content, u.Version([]byte(content))), nil
}

func (u *Usecase) CreateFolder(ctx context.Context, req CreateFolderRequest) (DocumentTree, error) {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	if err := validateBaseName(req.Name, "Folder name is required"); err != nil {
		return DocumentTree{}, err
	}

	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return DocumentTree{}, err
	}

	node, err := u.createDirectoryOnDisk(rootPath, req)
	if err != nil {
		return DocumentTree{}, err
	}

	return node, nil
}

func (u *Usecase) GetContent(ctx context.Context, id string) (DocumentResponse, error) {
	rootPath, absPath, relID, err := u.resolveExistingFile(ctx, id)
	if err != nil {
		return DocumentResponse{}, err
	}
	_ = rootPath

	content, err := u.readAndWatchFile(absPath)
	if err != nil {
		return DocumentResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return NewDocumentResponse(relID, absPath, string(content), u.Version(content)), nil
}

func (u *Usecase) RenameDocument(ctx context.Context, req RenameDocumentRequest) (DocumentResponse, error) {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	if err := validateBaseName(req.Name, "Document name is required"); err != nil {
		return DocumentResponse{}, err
	}

	rootPath, absPath, err := u.resolveExistingPath(ctx, req.ID)
	if err != nil {
		return DocumentResponse{}, err
	}

	newRelID, newAbsPath, content, err := u.renamePathOnDisk(rootPath, absPath, req.Name)
	if err != nil {
		return DocumentResponse{}, err
	}

	return NewDocumentResponse(newRelID, newAbsPath, string(content), u.Version(content)), nil
}

func (u *Usecase) MoveDocument(ctx context.Context, req MoveDocumentRequest) (DocumentResponse, error) {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	rootPath, srcAbs, _, err := u.resolveExistingMovableFile(ctx, req.ID)
	if err != nil {
		return DocumentResponse{}, err
	}

	targetDir, err := u.resolveTargetDir(rootPath, req.TargetFolderID)
	if err != nil {
		return DocumentResponse{}, err
	}

	newRelID, dstAbs, content, err := u.moveFileToDir(rootPath, srcAbs, targetDir)
	if err != nil {
		return DocumentResponse{}, err
	}

	return NewDocumentResponse(newRelID, dstAbs, string(content), u.Version(content)), nil
}

func (u *Usecase) DeleteItem(ctx context.Context, id string) error {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return err
	}

	absPath, _, err := resolveSafePath(rootPath, id)
	if err != nil {
		return err
	}

	if err := removePathFromDisk(rootPath, absPath); err != nil {
		return u.ErrHandler.ErrorReturn(err)
	}

	return nil
}

func (u *Usecase) EditContent(ctx context.Context, req EditDocumentContentRequest) (DocumentResponse, error) {
	sharedDocMu.Lock()
	defer sharedDocMu.Unlock()

	_, absPath, relID, err := u.resolveExistingFile(ctx, req.ID)
	if err != nil {
		return DocumentResponse{}, err
	}

	existingBytes, err := os.ReadFile(absPath)
	if err != nil {
		return DocumentResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	updatedContent := req.ApplyTo(string(existingBytes))
	if err := u.writeFileAndUpdateWatcher(absPath, []byte(updatedContent)); err != nil {
		return DocumentResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return NewDocumentResponse(relID, absPath, updatedContent, u.Version([]byte(updatedContent))), nil
}

func (u *Usecase) resolveProjectRoot(ctx context.Context) (string, error) {
	projects, err := u.projectRepo.List(ctx)
	if err != nil {
		return "", u.ErrHandler.ErrorReturn(err)
	}

	rootPath := u.selectProjectPath(ctx, projects)
	if strings.TrimSpace(rootPath) == "" {
		return "", localerror.InvalidData("No active project")
	}

	return validateRootDirectory(rootPath)
}

func (u *Usecase) selectProjectPath(ctx context.Context, projects []domain.Project) string {
	for _, p := range projects {
		if p.IsSelected && strings.TrimSpace(p.Path) != "" {
			return strings.TrimSpace(p.Path)
		}
	}

	if selectedCol := u.FindSelectedCollection(ctx); selectedCol != nil {
		for _, p := range projects {
			if p.ID == selectedCol.ProjectID && strings.TrimSpace(p.Path) != "" {
				return strings.TrimSpace(p.Path)
			}
		}
		if strings.TrimSpace(selectedCol.Path) != "" {
			return filepath.Dir(selectedCol.Path)
		}
	}

	for _, p := range projects {
		if strings.TrimSpace(p.Path) != "" {
			return strings.TrimSpace(p.Path)
		}
	}
	return ""
}

func validateRootDirectory(rootPath string) (string, error) {
	cleaned := filepath.Clean(rootPath)
	info, err := os.Stat(cleaned)
	if err != nil || !info.IsDir() {
		return "", localerror.InvalidData("Active project path is not a valid directory")
	}
	return cleaned, nil
}

var docFileExtensions = map[string]string{
	".md":   "DOC_MD",
	".html": "DOC_HTML",
	".htm":  "DOC_HTML",
}

func (u *Usecase) scanDirectory(rootPath, dirPath string, gi *GitIgnoreMatcher) ([]DocumentTree, error) {
	if gi != nil && dirPath != rootPath {
		subGitIgnore := filepath.Join(dirPath, ".gitignore")
		if _, err := os.Stat(subGitIgnore); err == nil {
			relDir, err := filepath.Rel(rootPath, dirPath)
			if err == nil {
				_ = gi.LoadGitIgnore(subGitIgnore, relDir)
			}
		}
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	nodes := make([]DocumentTree, 0, len(entries))
	for _, entry := range entries {
		node, ok, err := u.buildEntryTreeNode(rootPath, dirPath, entry, gi)
		if err != nil {
			return nil, err
		}
		if ok {
			nodes = append(nodes, node)
		}
	}
	return nodes, nil
}

func (u *Usecase) buildEntryTreeNode(rootPath, dirPath string, entry os.DirEntry, gi *GitIgnoreMatcher) (DocumentTree, bool, error) {
	name := entry.Name()
	absPath := filepath.Join(dirPath, name)
	relID, err := filepath.Rel(rootPath, absPath)
	if err != nil {
		return DocumentTree{}, false, err
	}
	relID = filepath.ToSlash(relID)

	if gi != nil && gi.IsIgnored(relID, entry.IsDir()) {
		return DocumentTree{}, false, nil
	}

	if entry.IsDir() {
		children, err := u.scanDirectory(rootPath, absPath, gi)
		if err != nil {
			return DocumentTree{}, false, err
		}
		return NewFolderTreeNode(relID, name, absPath, children, true), true, nil
	}

	ext := strings.ToLower(filepath.Ext(name))
	if cat, isDoc := docFileExtensions[ext]; isDoc {
		displayName := strings.TrimSuffix(name, filepath.Ext(name))
		return NewFileTreeNode(relID, displayName, absPath, cat, true), true, nil
	}

	return NewFileTreeNode(relID, name, absPath, "FILE", false), true, nil
}

func classifyDocFile(filename string) (string, string, bool) {
	ext := strings.ToLower(filepath.Ext(filename))
	cat, ok := docFileExtensions[ext]
	if !ok {
		return "", "", false
	}
	if cat == "DOC_MD" {
		return cat, strings.TrimSuffix(filename, filepath.Ext(filename)), true
	}
	return cat, filename, true
}

func (u *Usecase) resolveTargetDir(rootPath, folderID string) (string, error) {
	trimmed := strings.TrimSpace(folderID)
	if trimmed == "" || trimmed == "." || trimmed == "/" {
		return rootPath, nil
	}

	absDir, _, err := resolveSafePath(rootPath, trimmed)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(absDir)
	if err != nil || !info.IsDir() {
		return "", localerror.InvalidData("Target folder not found")
	}
	return absDir, nil
}

func (u *Usecase) writeNewDocumentFile(rootPath, targetDir, requestedName string) (string, string, string, error) {
	filename, title, err := resolveNewMarkdownFilename(targetDir, requestedName)
	if err != nil {
		return "", "", "", err
	}

	absPath := filepath.Join(targetDir, filename)
	relID, err := filepath.Rel(rootPath, absPath)
	if err != nil {
		return "", "", "", u.ErrHandler.ErrorReturn(err)
	}

	initialContent := "# " + title + "\n"
	if err := u.writeFileAndUpdateWatcher(absPath, []byte(initialContent)); err != nil {
		return "", "", "", u.ErrHandler.ErrorReturn(err)
	}
	return relID, absPath, initialContent, nil
}

func resolveNewMarkdownFilename(targetDir, requestedName string) (string, string, error) {
	trimmed := strings.TrimSpace(requestedName)
	if trimmed != "" {
		base := strings.TrimSuffix(trimmed, filepath.Ext(trimmed))
		if err := validateBaseName(base, "Invalid document name"); err != nil {
			return "", "", err
		}
		filename := base + ".md"
		if _, err := os.Stat(filepath.Join(targetDir, filename)); err == nil {
			return "", "", localerror.InvalidData("Document already exists")
		}
		return filename, base, nil
	}

	for index := 0; ; index++ {
		title := "Untitled"
		if index > 0 {
			title = "Untitled-" + strconv.Itoa(index)
		}
		filename := title + ".md"
		if _, err := os.Stat(filepath.Join(targetDir, filename)); os.IsNotExist(err) {
			return filename, title, nil
		}
	}
}

func (u *Usecase) createDirectoryOnDisk(rootPath string, req CreateFolderRequest) (DocumentTree, error) {
	parentDir, err := u.resolveTargetDir(rootPath, req.ParentID)
	if err != nil {
		return DocumentTree{}, err
	}

	name := strings.TrimSpace(req.Name)
	absPath := filepath.Join(parentDir, name)
	if _, err := os.Stat(absPath); err == nil {
		return DocumentTree{}, localerror.InvalidData("Folder already exists")
	}

	if err := os.MkdirAll(absPath, 0755); err != nil {
		return DocumentTree{}, u.ErrHandler.ErrorReturn(err)
	}

	relID, _ := filepath.Rel(rootPath, absPath)
	return NewFolderTreeNode(relID, name, absPath, []DocumentTree{}, true), nil
}

func (u *Usecase) resolveExistingFile(ctx context.Context, id string) (string, string, string, error) {
	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return "", "", "", err
	}

	absPath, relID, err := resolveSafePath(rootPath, id)
	if err != nil {
		return "", "", "", err
	}

	info, err := os.Stat(absPath)
	if err != nil || info.IsDir() {
		return "", "", "", localerror.InvalidData("Document file not found")
	}
	return rootPath, absPath, relID, nil
}

func (u *Usecase) resolveExistingMovableFile(ctx context.Context, id string) (string, string, string, error) {
	rootPath, absPath, relID, err := u.resolveExistingFile(ctx, id)
	if err != nil {
		return "", "", "", err
	}

	_, _, supported := classifyDocFile(filepath.Base(absPath))
	if !supported {
		return "", "", "", localerror.InvalidData("Only .md and .html files can be moved")
	}
	return rootPath, absPath, relID, nil
}

func (u *Usecase) readAndWatchFile(absPath string) ([]byte, error) {
	content, err := os.ReadFile(absPath)
	if err != nil {
		return nil, err
	}

	if u.docWatcher != nil {
		u.notifyDocWatcher(absPath, content)
		u.docWatcher.Watch(absPath)
	}
	return content, nil
}

func (u *Usecase) resolveExistingPath(ctx context.Context, id string) (string, string, error) {
	rootPath, err := u.resolveProjectRoot(ctx)
	if err != nil {
		return "", "", err
	}

	absPath, _, err := resolveSafePath(rootPath, id)
	if err != nil {
		return "", "", err
	}

	if _, err := os.Stat(absPath); err != nil {
		return "", "", localerror.InvalidData("Document path not found")
	}
	return rootPath, absPath, nil
}

func (u *Usecase) renamePathOnDisk(rootPath, absPath, rawName string) (string, string, []byte, error) {
	info, err := os.Stat(absPath)
	if err != nil {
		return "", "", nil, localerror.InvalidData("Document path not found")
	}
	if info.IsDir() {
		return u.renameDirectoryOnDisk(rootPath, absPath, rawName)
	}
	return u.renameFileOnDisk(rootPath, absPath, rawName)
}

func (u *Usecase) renameDirectoryOnDisk(rootPath, absPath, rawName string) (string, string, []byte, error) {
	cleanName := strings.TrimSpace(rawName)
	if err := validateBaseName(cleanName, "Folder name is required"); err != nil {
		return "", "", nil, err
	}

	newAbsPath := filepath.Join(filepath.Dir(absPath), cleanName)
	if !strings.EqualFold(absPath, newAbsPath) {
		if _, err := os.Stat(newAbsPath); err == nil {
			return "", "", nil, localerror.InvalidData("A folder with that name already exists")
		}
	}

	if absPath != newAbsPath {
		if err := os.Rename(absPath, newAbsPath); err != nil {
			return "", "", nil, u.ErrHandler.ErrorReturn(err)
		}
	}

	newRelID, _ := filepath.Rel(rootPath, newAbsPath)
	return newRelID, newAbsPath, nil, nil
}

func (u *Usecase) renameFileOnDisk(rootPath, absPath, rawName string) (string, string, []byte, error) {
	ext := filepath.Ext(absPath)
	if ext == "" {
		ext = ".md"
	}
	cleanBase := strings.TrimSuffix(strings.TrimSpace(rawName), ext)
	if err := validateBaseName(cleanBase, "Document name is required"); err != nil {
		return "", "", nil, err
	}

	newAbsPath := filepath.Join(filepath.Dir(absPath), cleanBase+ext)
	if !strings.EqualFold(absPath, newAbsPath) {
		if _, err := os.Stat(newAbsPath); err == nil {
			return "", "", nil, localerror.InvalidData("A document with that name already exists")
		}
	}

	if absPath != newAbsPath {
		if err := os.Rename(absPath, newAbsPath); err != nil {
			return "", "", nil, u.ErrHandler.ErrorReturn(err)
		}
	}

	content, err := u.readAndWatchFile(newAbsPath)
	if err != nil {
		return "", "", nil, u.ErrHandler.ErrorReturn(err)
	}
	newRelID, _ := filepath.Rel(rootPath, newAbsPath)
	return newRelID, newAbsPath, content, nil
}

func (u *Usecase) moveFileToDir(rootPath, srcAbs, targetDir string) (string, string, []byte, error) {
	dstAbs := filepath.Join(targetDir, filepath.Base(srcAbs))
	if filepath.Clean(srcAbs) != filepath.Clean(dstAbs) {
		if _, err := os.Stat(dstAbs); err == nil {
			return "", "", nil, localerror.InvalidData("A file with that name already exists in target folder")
		}
		if err := os.Rename(srcAbs, dstAbs); err != nil {
			return "", "", nil, u.ErrHandler.ErrorReturn(err)
		}
	}

	content, _ := os.ReadFile(dstAbs)
	newRelID, _ := filepath.Rel(rootPath, dstAbs)
	return newRelID, dstAbs, content, nil
}

func removePathFromDisk(rootPath, absPath string) error {
	if filepath.Clean(rootPath) == filepath.Clean(absPath) {
		return localerror.InvalidData("Cannot delete project root directory")
	}
	info, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(absPath)
	}
	return os.Remove(absPath)
}

func (u *Usecase) writeFileAndUpdateWatcher(absPath string, content []byte) error {
	dir := filepath.Dir(absPath)
	tmp, err := os.CreateTemp(dir, ".doc-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, absPath); err != nil {
		return err
	}

	u.notifyDocWatcher(absPath, content)
	return nil
}

func (u *Usecase) notifyDocWatcher(absPath string, content []byte) {
	if u.docWatcher != nil && u.docWatcher.State != nil {
		if info, err := os.Stat(absPath); err == nil {
			u.docWatcher.State.Update(string(content), info.ModTime())
		} else {
			u.docWatcher.State.Update(string(content), time.Now())
		}
	}
}

func resolveSafePath(rootPath, relID string) (string, string, error) {
	trimmed := strings.TrimSpace(relID)
	if trimmed == "" {
		return "", "", localerror.InvalidData("Document id is required")
	}

	absPath := filepath.Clean(filepath.Join(rootPath, filepath.FromSlash(trimmed)))
	rel, err := filepath.Rel(rootPath, absPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", "", localerror.InvalidData("Invalid document path")
	}
	return absPath, filepath.ToSlash(rel), nil
}

func validateBaseName(name, emptyMsg string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return localerror.InvalidData(emptyMsg)
	}
	if strings.ContainsAny(trimmed, `/\:*?"<>|`) || trimmed == "." || trimmed == ".." {
		return localerror.InvalidData("Invalid name")
	}
	return nil
}
