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
	"github.com/rdhmuhammad/apitester/pkg/elog"
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
		elog.Panicf(elog.EIDGenericError, "failed to initialize test suite repo for collection usecase: %v", err)
	}
	automationRepo, err := db.NewRepository[domain.Automation](database, db.WithBucketName("Automation"))
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize automation repo for collection usecase: %v", err)
	}

	fw := watcher.New(lg)
	if selected := findSelectedCollection(context.Background(), port.CollectionRepo); selected != nil {
		fw.Watch(selected.Path)
	}

	return &Usecase{
		Port:           port,
		watcher:        fw,
		testSuiteRepo:  testSuiteRepo,
		automationRepo: automationRepo,
	}
}

func findSelectedCollection(ctx context.Context, repo db.RepositoryInterface[domain.Collection]) *domain.Collection {
	all, err := repo.List(ctx)
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

func (u *Usecase) ListCollections(ctx context.Context) ([]domain.Collection, error) {
	return u.CollectionRepo.List(ctx)
}

func (u *Usecase) Read(ctx context.Context, id string) (ReadResponse, error) {
	collection, err := u.CollectionRepo.View(ctx, id)
	if err != nil {
		return ReadResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if collection == nil {
		return ReadResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Collection not found"))
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

	docsContent.PrepareRead()

	return ReadResponse{
		Content:   docsContent,
		Changed:   false,
		UpdatedAt: collection.UpdatedAt,
		Version:   u.Version([]byte(content)),
	}, nil
}

func (u *Usecase) CreateCollection(ctx context.Context, req CreateCollectionRequest) (domain.Collection, error) {
	if strings.TrimSpace(req.Path) == "" {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Local path is empty"))
	}

	fileBytes, err := os.ReadFile(req.Path)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	docsContent.PrepareCreate()

	updatedContent, err := json.MarshalIndent(docsContent, "", "  ")
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := os.WriteFile(req.Path, updatedContent, 0644); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	collection := u.newCollectionEntity(req)
	if err := u.CollectionRepo.Create(ctx, collection.ID, &collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	return collection, nil
}

func (u *Usecase) UpdateCollectionByID(ctx context.Context, id string, req UpdateCollectionRequest) (domain.Collection, error) {
	collection, err := u.CollectionRepo.View(ctx, id)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	if collection == nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Collection not found"))
	}

	updateCollectionFields(collection, req)

	if err := u.updateModulePaths(ctx, collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.CollectionRepo.Update(ctx, id, collection); err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	return *collection, nil
}

func (u *Usecase) DeleteCollection(ctx context.Context, id string) error {
	collection, err := u.CollectionRepo.View(ctx, id)
	if err != nil {
		return u.ErrHandler.ErrorReturn(err)
	}

	if collection == nil {
		return u.ErrHandler.ErrorReturn(localerror.InvalidData("Collection not found"))
	}

	if err := u.deleteModules(ctx, collection); err != nil {
		return u.ErrHandler.ErrorReturn(err)
	}

	return u.CollectionRepo.Delete(ctx, id)
}

func (u *Usecase) SelectCollection(ctx context.Context, id string) (domain.Collection, error) {
	all, err := u.CollectionRepo.List(ctx)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	selected, err := u.markCollectionSelected(ctx, all, id)
	if err != nil {
		return domain.Collection{}, u.ErrHandler.ErrorReturn(err)
	}

	u.watcher.Watch(selected.Path)

	return *selected, nil
}

func (u *Usecase) GetActiveCollection(ctx context.Context) (ActiveCollectionResponse, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return ActiveCollectionResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	fileBytes, err := os.ReadFile(selected.Path)
	if err != nil {
		return ActiveCollectionResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	content := strings.TrimPrefix(string(fileBytes), "\uFEFF")
	var docsContent DocsContent
	if err := json.Unmarshal([]byte(content), &docsContent); err != nil {
		return ActiveCollectionResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return ActiveCollectionResponse{
		ID:           selected.ID,
		Name:         selected.Name,
		Description:  docsContent.Info.Description,
		Version:      u.Version([]byte(content)),
		Path:         selected.Path,
		IsSelected:   selected.IsSelected,
		TestSuiteID:  selected.TestSuiteID,
		AutomationID: selected.AutomationID,
		UpdatedAt:    selected.UpdatedAt,
		CreatedAt:    selected.CreatedAt,
	}, nil
}

func (u *Usecase) GetVariables(ctx context.Context) ([]CollectionVar, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return nil, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
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

	docsContent.PrepareVariables()

	if docsContent.Variable == nil {
		return []CollectionVar{}, nil
	}

	return docsContent.Variable, nil
}

func (u *Usecase) GetPreScript(ctx context.Context) (string, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return "", u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
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

	return docsContent.ExtractPreScript(), nil
}

func (u *Usecase) GetAuth(ctx context.Context) (*CollectionAuth, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return nil, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
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

	return docsContent.Auth, nil
}

func (u *Usecase) UpdateAuth(ctx context.Context, req UpdateCollectionAuthRequest) (*CollectionAuth, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return nil, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	var newAuth *CollectionAuth
	_, err := u.Update(ctx, selected.ID, "", "update_collection_auth", "auth", func(oldContent []byte) (any, any, []byte, error) {
		var docs DocsContent
		if err := json.Unmarshal(oldContent, &docs); err != nil {
			return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
		}

		oldAuth := docs.Auth
		docs.SetAuth(req)
		newAuth = docs.Auth

		newContent, err := json.MarshalIndent(docs, "", "  ")
		if err != nil {
			return nil, nil, nil, err
		}
		return oldAuth, newAuth, newContent, nil
	})
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	return newAuth, nil
}

func (u *Usecase) UpdatePreScript(ctx context.Context, req UpdatePreScriptRequest) (UpdatePreScriptResponse, error) {
	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return UpdatePreScriptResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	var newScript EventScript
	saved, err := u.Update(ctx, selected.ID, "", "update_pre_request_script", "event.script", func(oldContent []byte) (any, any, []byte, error) {
		var docs DocsContent
		if err := json.Unmarshal(oldContent, &docs); err != nil {
			return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
		}

		oldScript := docs.SetPreScript(req)
		newScript = docs.ExtractPreScriptEvent()

		newContent, err := json.MarshalIndent(docs, "", "  ")
		if err != nil {
			return nil, nil, nil, err
		}
		return oldScript, newScript, newContent, nil
	})
	if err != nil {
		return UpdatePreScriptResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return UpdatePreScriptResponse{
		Script:  strings.Join(newScript.Exec, "\n"),
		Version: u.Version(saved),
	}, nil
}

func (u *Usecase) CreateVariable(ctx context.Context, req CreateVariableRequest) (CreateVariableResponse, error) {
	if strings.TrimSpace(req.Key) == "" {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Variable key is required"))
	}

	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	var newVar CollectionVar
	saved, err := u.Update(ctx, selected.ID, "", "create_variable", "variable", func(oldContent []byte) (any, any, []byte, error) {
		var docs DocsContent
		if err := json.Unmarshal(oldContent, &docs); err != nil {
			return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
		}

		var errCreate error
		newVar, errCreate = docs.AddVariable(req)
		if errCreate != nil {
			return nil, nil, nil, errCreate
		}

		newContent, err := json.MarshalIndent(docs, "", "  ")
		if err != nil {
			return nil, nil, nil, err
		}
		return nil, newVar, newContent, nil
	})
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	u.notifyWatcher(selected.Path, saved)

	return CreateVariableResponse{
		Variable: newVar,
		Version:  u.Version(saved),
	}, nil
}

func (u *Usecase) UpdateVariable(ctx context.Context, variableID string, req UpdateVariableRequest) (CreateVariableResponse, error) {
	if strings.TrimSpace(variableID) == "" || strings.TrimSpace(req.Key) == "" {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Variable ID and key are required"))
	}

	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	var updatedVar CollectionVar
	saved, err := u.Update(ctx, selected.ID, variableID, "update_variable", "variable", func(oldContent []byte) (any, any, []byte, error) {
		var docs DocsContent
		if err := json.Unmarshal(oldContent, &docs); err != nil {
			return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
		}

		oldVar, updVar, errUpd := docs.UpdateVariable(variableID, req)
		if errUpd != nil {
			return nil, nil, nil, errUpd
		}
		updatedVar = updVar

		newContent, err := json.MarshalIndent(docs, "", "  ")
		if err != nil {
			return nil, nil, nil, err
		}
		return oldVar, updatedVar, newContent, nil
	})
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return CreateVariableResponse{Variable: updatedVar, Version: u.Version(saved)}, nil
}

func (u *Usecase) DeleteVariable(ctx context.Context, variableID string) (CreateVariableResponse, error) {
	if strings.TrimSpace(variableID) == "" {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("Variable ID is required"))
	}

	selected := findSelectedCollection(ctx, u.CollectionRepo)
	if selected == nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(localerror.InvalidData("No active collection"))
	}

	var deleted CollectionVar
	saved, err := u.Update(ctx, selected.ID, variableID, "delete_variable", "variable", func(oldContent []byte) (any, any, []byte, error) {
		var docs DocsContent
		if err := json.Unmarshal(oldContent, &docs); err != nil {
			return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
		}

		delVar, errDel := docs.RemoveVariable(variableID)
		if errDel != nil {
			return nil, nil, nil, errDel
		}
		deleted = delVar

		newContent, err := json.MarshalIndent(docs, "", "  ")
		if err != nil {
			return nil, nil, nil, err
		}
		return deleted, nil, newContent, nil
	})
	if err != nil {
		return CreateVariableResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return CreateVariableResponse{Variable: deleted, Version: u.Version(saved)}, nil
}

// ================================ Helper Function ================================

func setId(item []CollectionItem) []CollectionItem {
	for i := range item {
		if item[i].ID == "" {
			item[i].ID = uuid.NewString()
		}

		setRequestIDs(item[i].Request)
		for j := range item[i].Response {
			for k := range item[i].Response[j].Header {
				if item[i].Response[j].Header[k].Id == "" {
					item[i].Response[j].Header[k].Id = uuid.NewString()
				}
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
		if request.Header[i].Id == "" {
			request.Header[i].Id = uuid.NewString()
		}
	}
	for i := range request.URL.Query {
		if request.URL.Query[i].Id == "" {
			request.URL.Query[i].Id = uuid.NewString()
		}
	}
	if request.Body != nil {
		for i := range request.Body.FormData {
			if request.Body.FormData[i].Id == "" {
				request.Body.FormData[i].Id = uuid.NewString()
			}
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

func (u *Usecase) newCollectionEntity(req CreateCollectionRequest) domain.Collection {
	now := time.Now()
	return domain.Collection{
		ID:           uuid.NewString(),
		Name:         req.Name,
		Path:         req.Path,
		IsSelected:   false,
		CreatedAt:    now,
		UpdatedAt:    now,
		TestSuiteID:  uuid.NewString(),
		AutomationID: uuid.NewString(),
	}
}

func updateCollectionFields(c *domain.Collection, req UpdateCollectionRequest) {
	if req.Name != "" {
		c.Name = req.Name
	}
	if req.Path != "" {
		c.Path = req.Path
	}
	c.UpdatedAt = time.Now()
}

func (u *Usecase) updateModulePaths(ctx context.Context, collection *domain.Collection) error {
	if collection.TestSuiteID != "" {
		module, err := u.testSuiteRepo.View(ctx, collection.TestSuiteID)
		if err != nil {
			return err
		}
		if module != nil {
			module.Path = filepath.Join(filepath.Dir(collection.Path), "tests")
			module.UpdatedAt = time.Now()
			if err := u.testSuiteRepo.Update(ctx, module.ID, module); err != nil {
				return err
			}
		}
	}
	if collection.AutomationID != "" {
		module, err := u.automationRepo.View(ctx, collection.AutomationID)
		if err != nil {
			return err
		}
		if module != nil {
			module.Path = filepath.Join(filepath.Dir(collection.Path), "automation")
			module.UpdatedAt = time.Now()
			if err := u.automationRepo.Update(ctx, module.ID, module); err != nil {
				return err
			}
		}
	}
	return nil
}

func (u *Usecase) deleteModules(ctx context.Context, collection *domain.Collection) error {
	if collection.TestSuiteID != "" {
		if err := u.testSuiteRepo.Delete(ctx, collection.TestSuiteID); err != nil {
			return err
		}
	}
	if collection.AutomationID != "" {
		if err := u.automationRepo.Delete(ctx, collection.AutomationID); err != nil {
			return err
		}
	}
	return nil
}

func (u *Usecase) markCollectionSelected(ctx context.Context, all []domain.Collection, id string) (*domain.Collection, error) {
	var selected *domain.Collection
	for _, c := range all {
		c.IsSelected = false
		if c.ID == id {
			c.IsSelected = true
			selected = &c
		}
		if err := u.CollectionRepo.Update(ctx, c.ID, &c); err != nil {
			return nil, err
		}
	}
	if selected == nil {
		return nil, localerror.InvalidData("Collection not found")
	}
	return selected, nil
}

func (u *Usecase) notifyWatcher(path string, saved []byte) {
	if u.watcher != nil && u.watcher.State != nil {
		if info, statErr := os.Stat(path); statErr == nil {
			u.watcher.State.Update(string(saved), info.ModTime())
		} else {
			u.watcher.State.Update(string(saved), time.Now())
		}
		if info, statErr := os.Stat(path); statErr == nil && info.ModTime().IsZero() {
			u.watcher.State.Update(string(saved), time.Now())
		}
	}
}

// Struct methods for DocsContent

func (d *DocsContent) PrepareRead() {
	d.PrepareVariables()
	d.Item = setContentType(d.Item)
	d.Item = setBearerAuthorization(d.Item, d.Auth)
}

func (d *DocsContent) PrepareCreate() {
	d.Item = setId(d.Item)
	for i := range d.Variable {
		if d.Variable[i].ID == "" {
			d.Variable[i].ID = uuid.NewString()
		}
	}
}

func (d *DocsContent) PrepareVariables() {
	for i := range d.Variable {
		if isBaseURLVar(d.Variable[i].Key) && d.Variable[i].ID == "" {
			d.Variable[i].Category = "BASE_URL"
		}
	}
}

func (d *DocsContent) ExtractPreScript() string {
	for _, event := range d.Event {
		if strings.EqualFold(event.Listen, "prerequest") {
			return strings.Join(event.Script.Exec, "\n")
		}
	}
	return ""
}

func (d *DocsContent) ExtractPreScriptEvent() EventScript {
	for _, event := range d.Event {
		if strings.EqualFold(event.Listen, "prerequest") {
			return event.Script
		}
	}
	return EventScript{}
}

func (d *DocsContent) SetAuth(req UpdateCollectionAuthRequest) {
	if strings.EqualFold(strings.TrimSpace(req.Type), "none") || strings.TrimSpace(req.Type) == "" {
		d.Auth = nil
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
		d.Auth = &CollectionAuth{
			Type:   strings.ToLower(strings.TrimSpace(req.Type)),
			Bearer: bearer,
		}
	}
}

func (d *DocsContent) SetPreScript(req UpdatePreScriptRequest) EventScript {
	script := EventScript{Exec: req.Exec, Type: req.Type}
	if script.Type == "" {
		script.Type = "text/javascript"
	}

	var oldScript EventScript
	found := false
	for i := range d.Event {
		if strings.EqualFold(d.Event[i].Listen, "prerequest") {
			oldScript = d.Event[i].Script
			d.Event[i].Script = script
			found = true
			break
		}
	}
	if !found {
		d.Event = append(d.Event, CollectionEvent{Listen: "prerequest", Script: script})
	}
	return oldScript
}

func (d *DocsContent) AddVariable(req CreateVariableRequest) (CollectionVar, error) {
	for _, v := range d.Variable {
		if v.Key == req.Key {
			return CollectionVar{}, localerror.InvalidData("Variable key already exists")
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

	d.Variable = append(d.Variable, newVar)
	return newVar, nil
}

func (d *DocsContent) UpdateVariable(variableID string, req UpdateVariableRequest) (CollectionVar, CollectionVar, error) {
	var updatedVar *CollectionVar
	for i := range d.Variable {
		if d.Variable[i].ID == variableID {
			updatedVar = &d.Variable[i]
			break
		}
	}
	if updatedVar == nil {
		return CollectionVar{}, CollectionVar{}, localerror.InvalidData("Variable not found")
	}

	for _, variable := range d.Variable {
		if variable.ID != variableID && variable.Key == strings.TrimSpace(req.Key) {
			return CollectionVar{}, CollectionVar{}, localerror.InvalidData("Variable key already exists")
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

	return oldVar, *updatedVar, nil
}

func (d *DocsContent) RemoveVariable(variableID string) (CollectionVar, error) {
	var deleted CollectionVar
	found := false
	filtered := make([]CollectionVar, 0, len(d.Variable))
	for _, variable := range d.Variable {
		if variable.ID == variableID {
			deleted = variable
			found = true
			continue
		}
		filtered = append(filtered, variable)
	}
	if !found {
		return CollectionVar{}, localerror.InvalidData("Variable not found")
	}
	d.Variable = filtered
	return deleted, nil
}
