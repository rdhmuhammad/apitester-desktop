package collection

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/watcher"
	"github.com/rdhmuhammad/apitester/shared/base"
	"go.etcd.io/bbolt"
)

var baseURLRegex = regexp.MustCompile(`(?i)(base.*url|url.*base)`)

type Usecase struct {
	*base.Port
	watcher        *watcher.FileWatcher
	testSuiteRepo  db.RepositoryInterface[domain.TestSuite]
	automationRepo db.RepositoryInterface[domain.Automation]
}

func NewUsecase(
	lg logger.Logger,
	database *bbolt.DB,
) *Usecase {
	port := base.NewPort(lg, database)

	testSuiteRepo, err := db.NewRepository[domain.TestSuite](database, db.WithBucketName("TestSuite"))
	if err != nil {
		panic(err)
	}
	automationRepo, err := db.NewRepository[domain.Automation](database, db.WithBucketName("Automation"))
	if err != nil {
		panic(err)
	}

	fw := watcher.New(lg)
	if selected := findSelectedCollection(port.CollectionRepo); selected != nil {
		fw.Watch(selected.Path)
	}

	return &Usecase{
		Port:           port,
		watcher:        fw,
		testSuiteRepo:  testSuiteRepo,
		automationRepo: automationRepo,
	}
}

func findSelectedCollection(repo db.RepositoryInterface[domain.Collection]) *domain.Collection {
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
	return u.CollectionRepo.List(context.Background())
}

func (u *Usecase) Read(id string) (ReadResponse, error) {
	collection, err := u.CollectionRepo.View(context.Background(), id)
	if err != nil {
		return ReadResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if collection == nil {
		return ReadResponse{}, localerror.InvalidData("Collection not found")
	}

	fileBytes, err := os.ReadFile(collection.Path)
	if err != nil {
		return ReadResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return ReadResponse{}, u.ErrHandler.ErrorReturn(err)
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
		Version:   u.Version([]byte(content)),
	}, nil
}

func (u *Usecase) CreateCollection(req CreateCollectionRequest) (domain.Collection, error) {
	if strings.TrimSpace(req.Path) != "" {
		return domain.Collection{}, localerror.InvalidData("Local path is empty")
	}

	fileBytes, err := os.ReadFile(req.Path)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	var docsContent DocsContent
	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	docsContent.Item = setId(docsContent.Item)
	for i := range docsContent.Variable {
		docsContent.Variable[i].ID = uuid.NewString()
	}

	updatedContent, err := json.MarshalIndent(docsContent, "", "  ")
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := os.WriteFile(req.Path, updatedContent, 0644); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	now := time.Now()
	collection := domain.Collection{
		ID:         uuid.NewString(),
		Name:       req.Name,
		Path:       req.Path,
		IsSelected: false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	collection.TestSuiteID = uuid.NewString()
	collection.AutomationID = uuid.NewString()
	if err := u.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	return collection, nil
}

func (u *Usecase) UpdateCollectionByID(id string, req UpdateCollectionRequest) (domain.Collection, error) {
	collection, err := u.CollectionRepo.View(context.Background(), id)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
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
	if err := u.updateModulePaths(collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.CollectionRepo.Update(context.Background(), id, collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}
	return *collection, nil
}

func (u *Usecase) DeleteCollection(id string) error {
	collection, err := u.CollectionRepo.View(context.Background(), id)
	if err != nil {
		return u.ErrHandler.ErrorReturn(err)
	}

	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	if collection.TestSuiteID != "" {
		if err := u.testSuiteRepo.Delete(context.Background(), collection.TestSuiteID); err != nil {
			return u.ErrHandler.ErrorReturn(err)
		}
	}
	if collection.AutomationID != "" {
		if err := u.automationRepo.Delete(context.Background(), collection.AutomationID); err != nil {
			return u.ErrHandler.ErrorReturn(err)
		}
	}

	return u.CollectionRepo.Delete(context.Background(), id)
}

func (u *Usecase) SelectCollection(id string) (domain.Collection, error) {
	all, err := u.CollectionRepo.List(context.Background())
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	var selected *domain.Collection
	for _, c := range all {
		c.IsSelected = false
		if c.ID == id {
			c.IsSelected = true
			selected = &c
		}
		if err := u.CollectionRepo.Update(context.Background(), c.ID, &c); err != nil {
			return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
		}
	}

	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("Collection not found")
	}

	u.watcher.Watch(selected.Path)

	return *selected, nil
}

func (u *Usecase) GetActiveCollection() (domain.Collection, error) {
	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return domain.Collection{}, localerror.InvalidData("No active collection")
	}
	return *selected, nil
}

func (u *Usecase) GetVariables() ([]CollectionVar, error) {
	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return nil, localerror.InvalidData("No active collection")
	}

	fileBytes, err := os.ReadFile(selected.Path)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	for i := range docsContent.Variable {
		if isBaseURLVar(docsContent.Variable[i].Key) && docsContent.Variable[i].ID == "" {
			docsContent.Variable[i].Category = "BASE_URL"
		}
	}

	if docsContent.Variable == nil {
		return []CollectionVar{}, nil
	}

	return docsContent.Variable, nil
}

func (u *Usecase) GetPreScript() (string, error) {
	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return "", localerror.InvalidData("No active collection")
	}

	fileBytes, err := os.ReadFile(selected.Path)
	if err != nil {
		return "", u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return "", u.ErrHandler.ErrorReturn(err)
	}

	for _, event := range docsContent.Event {
		if strings.EqualFold(event.Listen, "prerequest") {
			return strings.Join(event.Script.Exec, "\n"), nil
		}
	}

	return "", nil
}

func (u *Usecase) GetAuth() (*CollectionAuth, error) {
	var targetPath string
	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return nil, localerror.InvalidData("No active collection")
	}

	targetPath = selected.Path
	fileBytes, err := os.ReadFile(targetPath)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	return docsContent.Auth, nil
}

func (u *Usecase) UpdateAuth(req UpdateCollectionAuthRequest) (*CollectionAuth, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return nil, localerror.InvalidData("No active collection")
	}

	collection, oldContent, err := u.LoadCollection(selected.ID)
	if err != nil {
		return nil, err
	}

	var docs DocsContent
	if err := json.Unmarshal(oldContent, &docs); err != nil {
		return nil, localerror.InvalidData("Invalid collection.json file")
	}

	oldAuth := docs.Auth
	if strings.EqualFold(strings.TrimSpace(req.Type), "none") || strings.TrimSpace(req.Type) == "" {
		docs.Auth = nil
	} else {
		bearer := make([]Property, len(req.Bearer))
		copy(bearer, req.Bearer)
		for i := range bearer {
			if bearer[i].Id == "" {
				bearer[i].Id = uuid.NewString()
			}
			if bearer[i].Key == "" {
				bearer[i].Key = "token"
			}
			if bearer[i].Type == "" {
				bearer[i].Type = "string"
			}
		}
		docs.Auth = &CollectionAuth{
			Type:   strings.ToLower(strings.TrimSpace(req.Type)),
			Bearer: bearer,
		}
	}

	newContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}
	saved, err := u.SaveCollection(collection, newContent)
	if err != nil {
		return nil, err
	}
	if err := u.RecordHistory(collection, "", "update_collection_auth", "auth", oldAuth, docs.Auth, oldContent, saved); err != nil {
		return nil, err
	}

	return docs.Auth, nil
}

func (u *Usecase) UpdatePreScript(req UpdatePreScriptRequest) (UpdatePreScriptResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return UpdatePreScriptResponse{}, localerror.InvalidData("No active collection")
	}

	collection, oldContent, err := u.LoadCollection(selected.ID)
	if err != nil {
		return UpdatePreScriptResponse{}, err
	}

	var docs DocsContent
	if err := json.Unmarshal(oldContent, &docs); err != nil {
		return UpdatePreScriptResponse{}, localerror.InvalidData("Invalid collection.json file")
	}

	script := EventScript{Exec: req.Exec, Type: req.Type}
	if script.Type == "" {
		script.Type = "text/javascript"
	}

	var oldScript EventScript
	found := false
	for i := range docs.Event {
		if strings.EqualFold(docs.Event[i].Listen, "prerequest") {
			oldScript = docs.Event[i].Script
			docs.Event[i].Script = script
			found = true
			break
		}
	}
	if !found {
		docs.Event = append(docs.Event, CollectionEvent{Listen: "prerequest", Script: script})
	}

	newContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return UpdatePreScriptResponse{}, u.ErrHandler.ErrorReturn(err)
	}
	saved, err := u.SaveCollection(collection, newContent)
	if err != nil {
		return UpdatePreScriptResponse{}, err
	}
	if err := u.RecordHistory(collection, "", "update_pre_request_script", "event.script", oldScript, script, oldContent, saved); err != nil {
		return UpdatePreScriptResponse{}, err
	}

	return UpdatePreScriptResponse{
		Script:  strings.Join(script.Exec, "\n"),
		Version: u.Version(saved),
	}, nil
}

// CreateVariable creates a new collection variable and records its history.
func (u *Usecase) CreateVariable(req CreateVariableRequest) (CreateVariableResponse, error) {
	if strings.TrimSpace(req.Key) == "" {
		return CreateVariableResponse{}, localerror.InvalidData("Variable key is required")
	}

	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, localerror.InvalidData("No active collection")
	}

	collection, oldContent, err := u.LoadCollection(selected.ID)
	if err != nil {
		return CreateVariableResponse{}, err
	}

	var docs DocsContent
	if err := json.Unmarshal(oldContent, &docs); err != nil {
		return CreateVariableResponse{}, localerror.InvalidData("Invalid collection.json file")
	}

	// Duplicate key check
	for _, v := range docs.Variable {
		if v.Key == req.Key {
			return CreateVariableResponse{}, localerror.InvalidData("Variable key already exists")
		}
	}

	newVar := CollectionVar{
		ID:    uuid.NewString(),
		Key:   strings.TrimSpace(req.Key),
		Value: req.Value,
		Type:  req.Type,
	}
	if isBaseURLVar(newVar.Key) {
		newVar.Category = "BASE_URL"
	}
	if newVar.Type == "" {
		newVar.Type = "string"
	}

	docs.Variable = append(docs.Variable, newVar)

	newContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	saved, err := u.SaveCollection(collection, newContent)
	if err != nil {
		return CreateVariableResponse{}, err
	}
	if u.watcher != nil && u.watcher.State != nil {
		if info, statErr := os.Stat(collection.Path); statErr == nil {
			u.watcher.State.Update(string(saved), info.ModTime())
		} else {
			u.watcher.State.Update(string(saved), time.Now())
		}
		if info, statErr := os.Stat(collection.Path); statErr == nil && info.ModTime().IsZero() {
			u.watcher.State.Update(string(saved), time.Now())
		}
	}

	if err := u.RecordHistory(collection, newVar.ID, "create_variable", "variable", nil, newVar, oldContent, saved); err != nil {
		return CreateVariableResponse{}, err
	}

	return CreateVariableResponse{
		Variable: newVar,
		Version:  u.Version(saved),
	}, nil
}

func (u *Usecase) UpdateVariable(variableID string, req UpdateVariableRequest) (CreateVariableResponse, error) {
	if strings.TrimSpace(variableID) == "" || strings.TrimSpace(req.Key) == "" {
		return CreateVariableResponse{}, localerror.InvalidData("Variable ID and key are required")
	}

	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, localerror.InvalidData("No active collection")
	}
	collection, oldContent, err := u.LoadCollection(selected.ID)
	if err != nil {
		return CreateVariableResponse{}, err
	}

	var docs DocsContent
	if err := json.Unmarshal(oldContent, &docs); err != nil {
		return CreateVariableResponse{}, localerror.InvalidData("Invalid collection.json file")
	}

	var updatedVar *CollectionVar
	for i := range docs.Variable {
		if docs.Variable[i].ID == variableID {
			updatedVar = &docs.Variable[i]
			break
		}
	}
	if updatedVar == nil {
		return CreateVariableResponse{}, localerror.InvalidData("Variable not found")
	}

	for _, variable := range docs.Variable {
		if variable.ID != variableID && variable.Key == strings.TrimSpace(req.Key) {
			return CreateVariableResponse{}, localerror.InvalidData("Variable key already exists")
		}
	}

	oldVar := *updatedVar
	updatedVar.Key = strings.TrimSpace(req.Key)
	updatedVar.Value = req.Value
	updatedVar.Type = req.Type
	if updatedVar.Type == "" {
		updatedVar.Type = "string"
	}
	updatedVar.Category = ""
	if isBaseURLVar(updatedVar.Key) {
		updatedVar.Category = "BASE_URL"
	}

	newContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}
	saved, err := u.SaveCollection(collection, newContent)
	if err != nil {
		return CreateVariableResponse{}, err
	}
	if err := u.RecordHistory(collection, variableID, "update_variable", "variable", oldVar, *updatedVar, oldContent, saved); err != nil {
		return CreateVariableResponse{}, err
	}

	return CreateVariableResponse{Variable: *updatedVar, Version: u.Version(saved)}, nil
}

func (u *Usecase) DeleteVariable(variableID string) (CreateVariableResponse, error) {
	if strings.TrimSpace(variableID) == "" {
		return CreateVariableResponse{}, localerror.InvalidData("Variable ID is required")
	}

	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	selected := findSelectedCollection(u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, localerror.InvalidData("No active collection")
	}
	collection, oldContent, err := u.LoadCollection(selected.ID)
	if err != nil {
		return CreateVariableResponse{}, err
	}

	var docs DocsContent
	if err := json.Unmarshal(oldContent, &docs); err != nil {
		return CreateVariableResponse{}, localerror.InvalidData("Invalid collection.json file")
	}

	var deleted CollectionVar
	found := false
	filtered := make([]CollectionVar, 0, len(docs.Variable))
	for _, variable := range docs.Variable {
		if variable.ID == variableID {
			deleted = variable
			found = true
			continue
		}
		filtered = append(filtered, variable)
	}
	if !found {
		return CreateVariableResponse{}, localerror.InvalidData("Variable not found")
	}

	docs.Variable = filtered
	newContent, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}
	saved, err := u.SaveCollection(collection, newContent)
	if err != nil {
		return CreateVariableResponse{}, err
	}
	if err := u.RecordHistory(collection, variableID, "delete_variable", "variable", deleted, nil, oldContent, saved); err != nil {
		return CreateVariableResponse{}, err
	}

	return CreateVariableResponse{Variable: deleted, Version: u.Version(saved)}, nil
}

// ================================ Helper Function ================================

func setId(item []CollectionItem) []CollectionItem {
	for i := range item {
		item[i].ID = uuid.NewString()

		setRequestIDs(item[i].Request)
		for j := range item[i].Response {
			for k := range item[i].Response[j].Header {
				item[i].Response[j].Header[k].Id = uuid.NewString()
			}
			setRequestIDs(item[i].Response[j].OriginalRequest)
		}

		if item[i].Item != nil {
			item[i].Item = setId(item[i].Item)
		}
	}

	return item
}

func setRequestIDs(request *Request) {
	if request == nil {
		return
	}

	for i := range request.Header {
		request.Header[i].Id = uuid.NewString()
	}
	for i := range request.URL.Query {
		request.URL.Query[i].Id = uuid.NewString()
	}
	if request.Body != nil {
		for i := range request.Body.FormData {
			request.Body.FormData[i].Id = uuid.NewString()
		}
	}
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

func (u *Usecase) updateModulePaths(collection *domain.Collection) error {
	if collection.TestSuiteID != "" {
		module, err := u.testSuiteRepo.View(context.Background(), collection.TestSuiteID)
		if err != nil {
			return err
		}
		if module != nil {
			module.Path = filepath.Join(filepath.Dir(collection.Path), "tests")
			module.UpdatedAt = time.Now()
			if err := u.testSuiteRepo.Update(context.Background(), module.ID, module); err != nil {
				return err
			}
		}
	}
	if collection.AutomationID != "" {
		module, err := u.automationRepo.View(context.Background(), collection.AutomationID)
		if err != nil {
			return err
		}
		if module != nil {
			module.Path = filepath.Join(filepath.Dir(collection.Path), "automation")
			module.UpdatedAt = time.Now()
			if err := u.automationRepo.Update(context.Background(), module.ID, module); err != nil {
				return err
			}
		}
	}
	return nil
}
