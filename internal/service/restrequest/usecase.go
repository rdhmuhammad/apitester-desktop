package restrequest

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/shared/base"
	"go.etcd.io/bbolt"
)

type Usecase struct {
	*base.Port
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	return &Usecase{
		Port: base.NewPort(lg, database),
	}
}

func (u *Usecase) CreateRequest(collectionID string) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := collectionService.CollectionItem{
		ID: uuid.NewString(),
		Request: &collectionService.Request{
			Header: []collectionService.Header{},
			Body: &collectionService.RequestBody{
				FormData: []collectionService.Property{},
			},
			URL: collectionService.RequestURL{
				Host:  []string{},
				Path:  []string{},
				Query: []collectionService.Property{},
			},
		},
	}
	docs.Item = append(docs.Item, item)

	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}
	if err := u.RecordHistory(collection, item.ID, "create_request", "request", nil, item, content, updated); err != nil {
		return RequestResponse{}, err
	}

	return requestResponse(collection, updated, &item), nil
}

func (u *Usecase) Get(collectionID, requestID string) (RequestResponse, error) {
	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := findRequest(docs.Item, requestID, docs.Auth)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}
	return requestResponse(collection, content, item), nil
}

func (u *Usecase) UpdateURL(collectionID, requestID string, req UpdateURLRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}
	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}
	oldValue := item.Request.URL
	item.Request.URL = req.URL

	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}

	if err := u.RecordHistory(collection, requestID, "update_url", "request.url", oldValue, req.URL, content, updated); err != nil {
		return RequestResponse{}, err
	}
	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) UpdateHeaders(collectionID, requestID string, req UpdateHeadersRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	oldValue := append([]collectionService.Header(nil), item.Request.Header...)
	item.Request.Header = req.Headers
	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}
	if err := u.RecordHistory(collection, requestID, "update_headers", "request.headers", oldValue, req.Headers, content, updated); err != nil {
		return RequestResponse{}, err
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) UpdateAuthorization(collectionID, requestID string, req UpdateAuthorizationRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	oldValue := append([]collectionService.Header(nil), item.Request.Header...)
	token := strings.TrimSpace(req.Token)
	if strings.EqualFold(strings.TrimSpace(req.Type), "inherit") {
		token = bearerToken(docs.Auth)
	}

	item.Request.Header = setAuthorizationHeader(item.Request.Header, token, strings.EqualFold(strings.TrimSpace(req.Type), "none"))
	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}
	if err := u.RecordHistory(collection, requestID, "update_authorization", "request.headers", oldValue, item.Request.Header, content, updated); err != nil {
		return RequestResponse{}, err
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) UpdateAuth(collectionID, requestID string, req UpdateAuthRequest) (RequestResponse, error) {
	authSource := strings.TrimSpace(req.AuthSource)
	if strings.EqualFold(authSource, "inherit") {
		authSource = "inherit"
	} else {
		authSource = strings.ToLower(authSource)
	}

	auth := &collectionService.ReqAuth{
		AuthSource: authSource,
	}

	if authSource == "onrequest" || authSource == "inherit" {
		auth.SetType(req.Type)
		if req.Bearer != nil {
			bearer := make([]collectionService.Property, len(req.Bearer))
			copy(bearer, req.Bearer)
			for i := range bearer {
				if bearer[i].Id == "" {
					bearer[i].Id = uuid.NewString()
				}
			}
			auth.Bearer = bearer
		} else {
			auth.Bearer = []collectionService.Property{}
		}
	} else {
		auth.Type = ""
		auth.Bearer = nil
	}

	return u.update(collectionID, requestID, "update_auth", "request.auth", auth,
		func(item *collectionService.CollectionItem) any {
			old := item.Request.Auth
			item.Request.Auth = auth
			return old
		})
}

func (u *Usecase) UpdateMethod(collectionID, requestID string, req UpdateMethodRequest) (RequestResponse, error) {
	return u.update(collectionID, requestID, "update_method", "request.method", req.Method,
		func(item *collectionService.CollectionItem) any {
			old := item.Request.Method
			item.Request.Method = req.Method
			return old
		})
}

func (u *Usecase) UpdateName(collectionID, requestID string, req UpdateNameRequest) (RequestResponse, error) {
	return u.update(collectionID, requestID, "update_name", "name", req.Name,
		func(item *collectionService.CollectionItem) any {
			old := item.Name
			item.Name = req.Name
			return old
		})
}

func bearerToken(auth *collectionService.CollectionAuth) string {
	if auth == nil || !strings.EqualFold(strings.TrimSpace(auth.Type), "bearer") {
		return ""
	}
	for _, property := range auth.Bearer {
		if strings.EqualFold(strings.TrimSpace(property.Key), "token") {
			return strings.TrimSpace(property.Value)
		}
	}
	return ""
}

func setAuthorizationHeader(headers []collectionService.Header, token string, remove bool) []collectionService.Header {
	updated := make([]collectionService.Header, 0, len(headers)+1)
	for _, header := range headers {
		if strings.EqualFold(strings.TrimSpace(header.Key), "Authorization") {
			if !remove && token != "" {
				header.Value = "Bearer " + token
				updated = append(updated, header)
			}
			continue
		}
		updated = append(updated, header)
	}
	if !remove && token != "" {
		for _, header := range headers {
			if strings.EqualFold(strings.TrimSpace(header.Key), "Authorization") {
				return updated
			}
		}
		updated = append(updated, collectionService.Header{Key: "Authorization", Value: "Bearer " + token})
	}
	return updated
}

func (u *Usecase) UpdateQuery(collectionID, requestID string, req UpdateQueryRequest) (RequestResponse, error) {
	return u.update(collectionID, requestID, "update_query", "request.url.query", req.Query,
		func(item *collectionService.CollectionItem) any {
			old := item.Request.URL.Query
			item.Request.URL.Query = req.Query
			return old
		})
}

func (u *Usecase) UpdateJSONBody(collectionID, requestID string, req UpdateJSONBodyRequest) (RequestResponse, error) {
	body := &collectionService.RequestBody{Mode: "raw", Raw: req.Raw}
	return u.update(collectionID, requestID, "update_body_json", "request.body", body,
		func(item *collectionService.CollectionItem) any {
			old := item.Request.Body
			item.Request.Body = body
			return old
		})
}

func (u *Usecase) UpdateFormDataBody(collectionID, requestID string, req UpdateFormDataBodyRequest) (RequestResponse, error) {
	body := &collectionService.RequestBody{Mode: "formdata", FormData: req.FormData}
	return u.update(collectionID, requestID, "update_body_formdata", "request.body", body,
		func(item *collectionService.CollectionItem) any {
			old := item.Request.Body
			item.Request.Body = body
			return old
		})
}

func (u *Usecase) UpdatePostRequestScript(collectionID, requestID string, req UpdatePostRequestScriptRequest) (RequestResponse, error) {
	script := collectionService.EventScript{Exec: req.Exec, Type: req.Type}
	if script.Type == "" {
		script.Type = "text/javascript"
	}
	return u.update(collectionID, requestID, "update_post_request_script", "event.script", script,
		func(item *collectionService.CollectionItem) any {
			for i := range item.Event {
				if strings.EqualFold(item.Event[i].Listen, "test") || strings.EqualFold(item.Event[i].Listen, "post-request") {
					old := item.Event[i].Script
					item.Event[i].Script = script
					return old
				}
			}
			item.Event = append(item.Event, collectionService.CollectionEvent{Listen: "test", Script: script})
			return nil
		})
}

func (u *Usecase) SavePostRequestScript(collectionID, requestID string, req SavePostRequestScriptRequest) (RequestResponse, error) {
	exec := req.Exec
	if len(exec) == 0 && req.Script != "" {
		exec = strings.Split(req.Script, "\n")
	}
	if exec == nil {
		exec = []string{}
	}
	scriptType := req.Type
	if scriptType == "" {
		scriptType = "text/javascript"
	}
	script := collectionService.EventScript{Exec: exec, Type: scriptType}
	return u.update(collectionID, requestID, "save_post_request_script", "event.script", script,
		func(item *collectionService.CollectionItem) any {
			for i := range item.Event {
				if strings.EqualFold(item.Event[i].Listen, "test") || strings.EqualFold(item.Event[i].Listen, "post-request") {
					old := item.Event[i].Script
					item.Event[i].Listen = "test"
					item.Event[i].Script = script
					return old
				}
			}
			item.Event = append(item.Event, collectionService.CollectionEvent{Listen: "test", Script: script})
			return nil
		})
}

func (u *Usecase) SaveScript(collectionID, requestID string, req SavePostRequestScriptRequest) (RequestResponse, error) {
	return u.SavePostRequestScript(collectionID, requestID, req)
}

func (u *Usecase) SaveResponse(collectionID, requestID string, req SaveResponseRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	newResponse := req.ToCollectionResponse(item.Request)
	oldValue := append([]collectionService.CollectionResponse(nil), item.Response...)
	item.Response = append(item.Response, newResponse)

	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}

	if err := u.RecordHistory(collection, requestID, "save_response", "response", oldValue, newResponse, content, updated); err != nil {
		return RequestResponse{}, err
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) Delete(collectionID, requestID string) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	var deleted *collectionService.CollectionItem
	docs.Item, deleted = removeRequest(docs.Item, requestID)
	if deleted == nil || deleted.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}
	deletedResponse := requestResponse(collection, content, deleted)

	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}
	if err := u.RecordHistory(collection, requestID, "delete_request", "request", *deleted, nil, content, updated); err != nil {
		return RequestResponse{}, err
	}
	deletedResponse.Version = u.Version(updated)
	return deletedResponse, nil
}

func (u *Usecase) update(collectionID, requestID, operation, field string, newValue any, apply func(*collectionService.CollectionItem) any) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(collectionID)
	if err != nil {
		return RequestResponse{}, err
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}
	oldValue := apply(item)
	updated, err := u.saveCollection(collection, docs)
	if err != nil {
		return RequestResponse{}, err
	}
	if err := u.RecordHistory(collection, requestID, operation, field, oldValue, newValue, content, updated); err != nil {
		return RequestResponse{}, err
	}
	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) recordHistory(collection *domain.Collection, requestID, operation, field string, oldValue, newValue any, oldContent, newContent []byte) error {
	return u.Port.RecordHistory(collection, requestID, operation, field, oldValue, newValue, oldContent, newContent)
}

func (u *Usecase) loadCollection(id string) (*domain.Collection, *collectionService.DocsContent, []byte, error) {
	collection, content, err := u.Port.LoadCollection(id)
	if err != nil {
		return nil, nil, nil, err
	}

	var docs collectionService.DocsContent
	if err := json.Unmarshal(content, &docs); err != nil {
		return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
	}

	return collection, &docs, content, nil
}

func (u *Usecase) saveCollection(collection *domain.Collection, docs *collectionService.DocsContent) ([]byte, error) {
	content, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}
	return u.Port.SaveCollection(collection, content)
}

func findRequest(items []collectionService.CollectionItem, id string, auth ...*collectionService.CollectionAuth) *collectionService.CollectionItem {
	for i := range items {
		if items[i].ID == id {
			if len(auth) > 0 && items[i].Request != nil {
				resolveAuth(&items[i], auth[0])
			}
			return &items[i]
		}
		if item := findRequest(items[i].Item, id, auth...); item != nil {
			return item
		}
	}
	return nil
}

func resolveAuth(item *collectionService.CollectionItem, collectionAuth *collectionService.CollectionAuth) {
	if item == nil || item.Request == nil {
		return
	}

	// 1. Get value from DocsContent.Auth if not null then set value to item.Request.Auth, also set item.Request.Auth.AuthSource = inheret
	if collectionAuth != nil {
		var bearer []collectionService.Property
		if collectionAuth.Bearer != nil {
			bearer = make([]collectionService.Property, len(collectionAuth.Bearer))
			copy(bearer, collectionAuth.Bearer)
		}
		item.Request.Auth = &collectionService.ReqAuth{
			Type:       collectionAuth.Type,
			Bearer:     bearer,
			AuthSource: "inherit",
		}
	}

	// 2. Find at header if any header authorization, if exist then set value to item.Request.Auth also set authSource = onrequest
	var authHeader *collectionService.Header
	for i := range item.Request.Header {
		if strings.EqualFold(strings.TrimSpace(item.Request.Header[i].Key), "Authorization") && !item.Request.Header[i].Disabled && strings.TrimSpace(item.Request.Header[i].Value) != "" {
			authHeader = &item.Request.Header[i]
			break
		}
	}
	if authHeader != nil {
		token := strings.TrimSpace(authHeader.Value)
		if strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = strings.TrimSpace(token[7:])
		}
		id := authHeader.Id
		if id == "" {
			id = uuid.NewString()
		}
		item.Request.Auth = &collectionService.ReqAuth{
			Type: "bearer",
			Bearer: []collectionService.Property{
				{
					Id:    id,
					Key:   "token",
					Value: token,
					Type:  "string",
				},
			},
			AuthSource: "onrequest",
		}
	} else if item.Request.Auth != nil && item.Request.Auth.AuthSource == "onrequest" && len(item.Request.Auth.Bearer) > 0 {
		// Preserve explicit onrequest auth if already configured
	} else if item.Request.Auth != nil && item.Request.Auth.AuthSource == "none" && authHeader == nil {
		// Preserve explicit none auth if already configured
	}

	// 3. If none of them above satisfied set authSource to none
	if item.Request.Auth == nil || item.Request.Auth.AuthSource == "" {
		item.Request.Auth = &collectionService.ReqAuth{
			Type:       "",
			Bearer:     nil,
			AuthSource: "none",
		}
	}
}

func removeRequest(items []collectionService.CollectionItem, id string) ([]collectionService.CollectionItem, *collectionService.CollectionItem) {
	for i := range items {
		if items[i].ID == id && items[i].Request != nil {
			deleted := items[i]
			return append(items[:i], items[i+1:]...), &deleted
		}
		if deletedItems, deleted := removeRequest(items[i].Item, id); deleted != nil {
			items[i].Item = deletedItems
			return items, deleted
		}
	}
	return items, nil
}

func requestResponse(_ *domain.Collection, content []byte, item *collectionService.CollectionItem) RequestResponse {
	script := ""
	for _, event := range item.Event {
		if strings.EqualFold(event.Listen, "test") || strings.EqualFold(event.Listen, "post-request") {
			script = strings.Join(event.Script.Exec, "\n")
			break
		}
	}
	// version is computed via base's Version; to keep function pure we compute via same logic
	// but we can't access Port here, so compute inline hash directly
	// callers that need version after save will override Version field
	// For consistency, compute hash here without Port dependency
	// We'll use a local helper that mirrors base.Port.Version
	return RequestResponse{
		ID:        item.ID,
		Name:      item.Name,
		Method:    item.Request.Method,
		URL:       item.Request.URL,
		Headers:   item.Request.Header,
		Query:     item.Request.URL.Query,
		Body:      item.Request.Body,
		Auth:      item.Request.Auth,
		Script:    script,
		Responses: item.Response,
		Version:   version(content),
	}
}

func version(content []byte) string {
	hash := sha256.Sum256(content)
	return hex.EncodeToString(hash[:])
}

func mutationLine(content []byte, requestID, field string) int {
	lines := strings.Split(string(content), "\n")
	quotedID, _ := json.Marshal(requestID)
	requestLine := 1
	for i, line := range lines {
		if strings.Contains(line, `"id": `+string(quotedID)) {
			requestLine = i + 1
			for j := i; j < len(lines); j++ {
				if strings.Contains(lines[j], `"`+field[strings.LastIndex(field, ".")+1:]+`":`) {
					return j + 1
				}
			}
			return requestLine
		}
	}
	return requestLine
}
