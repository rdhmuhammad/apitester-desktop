package restrequest

import (
	"context"
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

func (u *Usecase) CreateRequest(ctx context.Context, collectionID string) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
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

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, item.ID, "create_request", "request", nil, item, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return requestResponse(collection, updated, &item), nil
}

func (u *Usecase) Get(ctx context.Context, collectionID, requestID string) (RequestResponse, error) {
	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item := findRequest(docs.Item, requestID, docs.Auth)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	return requestResponse(collection, content, item), nil
}

func (u *Usecase) UpdateURL(ctx context.Context, collectionID, requestID string, req UpdateURLRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	oldValue := item.Request.URL
	item.Request.URL = req.URL

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, requestID, "update_url", "request.url", oldValue, req.URL, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) UpdateHeaders(ctx context.Context, collectionID, requestID string, req UpdateHeadersRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	oldValue := append([]collectionService.Header(nil), item.Request.Header...)
	item.Request.Header = req.Headers

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, requestID, "update_headers", "request.headers", oldValue, req.Headers, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return requestResponse(collection, updated, item), nil
}

func buildReqAuth(req UpdateAuthRequest) *collectionService.ReqAuth {
	authSource := strings.TrimSpace(req.AuthSource)
	if strings.EqualFold(authSource, "inherit") {
		authSource = "inherit"
	} else {
		authSource = strings.ToLower(authSource)
	}

	auth := &collectionService.ReqAuth{
		AuthSource: authSource,
	}

	if authSource == "onrequest" {
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

	return auth
}

func (u *Usecase) UpdateAuth(ctx context.Context, collectionID, requestID string, req UpdateAuthRequest) (RequestResponse, error) {
	auth := buildReqAuth(req)

	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_auth",
		Field:        "request.auth",
		NewValue:     auth,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.Auth
			item.Request.Auth = auth
			return old
		},
	})
}

func (u *Usecase) UpdateMethod(ctx context.Context, collectionID, requestID string, req UpdateMethodRequest) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_method",
		Field:        "request.method",
		NewValue:     req.Method,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.Method
			item.Request.Method = req.Method
			return old
		},
	})
}

func (u *Usecase) UpdateName(ctx context.Context, collectionID, requestID string, req UpdateNameRequest) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_name",
		Field:        "name",
		NewValue:     req.Name,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Name
			item.Name = req.Name
			return old
		},
	})
}

func (u *Usecase) UpdateQuery(ctx context.Context, collectionID, requestID string, req UpdateQueryRequest) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_query",
		Field:        "request.url.query",
		NewValue:     req.Query,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.URL.Query
			item.Request.URL.Query = req.Query
			return old
		},
	})
}

func (u *Usecase) UpdateJSONBody(ctx context.Context, collectionID, requestID string, req UpdateJSONBodyRequest) (RequestResponse, error) {
	body := &collectionService.RequestBody{Mode: "raw", Raw: req.Raw}
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_body_json",
		Field:        "request.body",
		NewValue:     body,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.Body
			item.Request.Body = body
			return old
		},
	})
}

func (u *Usecase) UpdateFormDataBody(ctx context.Context, collectionID, requestID string, req UpdateFormDataBodyRequest) (RequestResponse, error) {
	body := &collectionService.RequestBody{Mode: "formdata", FormData: req.FormData}
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_body_formdata",
		Field:        "request.body",
		NewValue:     body,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.Body
			item.Request.Body = body
			return old
		},
	})
}

func (u *Usecase) UpdatePostRequestScript(ctx context.Context, collectionID, requestID string, req UpdatePostRequestScriptRequest) (RequestResponse, error) {
	script := collectionService.EventScript{Exec: req.Exec, Type: req.Type}
	if script.Type == "" {
		script.Type = "text/javascript"
	}
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_post_request_script",
		Field:        "event.script",
		NewValue:     script,
		Apply: func(item *collectionService.CollectionItem) any {
			for i := range item.Event {
				if strings.EqualFold(item.Event[i].Listen, "test") || strings.EqualFold(item.Event[i].Listen, "post-request") {
					old := item.Event[i].Script
					item.Event[i].Script = script
					return old
				}
			}
			item.Event = append(item.Event, collectionService.CollectionEvent{Listen: "test", Script: script})
			return nil
		},
	})
}

func buildEventScript(req SavePostRequestScriptRequest) collectionService.EventScript {
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
	return collectionService.EventScript{Exec: exec, Type: scriptType}
}

func (u *Usecase) SavePostRequestScript(ctx context.Context, collectionID, requestID string, req SavePostRequestScriptRequest) (RequestResponse, error) {
	script := buildEventScript(req)
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "save_post_request_script",
		Field:        "event.script",
		NewValue:     script,
		Apply: func(item *collectionService.CollectionItem) any {
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
		},
	})
}

func (u *Usecase) SaveScript(ctx context.Context, collectionID, requestID string, req SavePostRequestScriptRequest) (RequestResponse, error) {
	return u.SavePostRequestScript(ctx, collectionID, requestID, req)
}

func (u *Usecase) SaveResponse(ctx context.Context, collectionID, requestID string, req SaveResponseRequest) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item := findRequest(docs.Item, requestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	newResponse := req.ToCollectionResponse(item.Request)
	oldValue := append([]collectionService.CollectionResponse(nil), item.Response...)
	item.Response = append(item.Response, newResponse)

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, requestID, "save_response", "response", oldValue, newResponse, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) Delete(ctx context.Context, collectionID, requestID string) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, collectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	var deleted *collectionService.CollectionItem
	docs.Item, deleted = removeRequest(docs.Item, requestID)
	if deleted == nil || deleted.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}
	deletedResponse := requestResponse(collection, content, deleted)

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, requestID, "delete_request", "request", *deleted, nil, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	deletedResponse.Version = u.Version(updated)

	return deletedResponse, nil
}

type updateReq struct {
	CollectionID string
	RequestID    string
	Operation    string
	Field        string
	NewValue     any
	Apply        func(*collectionService.CollectionItem) any
}

func (u *Usecase) update(ctx context.Context, req updateReq) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, req.CollectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item := findRequest(docs.Item, req.RequestID)
	if item == nil || item.Request == nil {
		return RequestResponse{}, localerror.InvalidData("Request not found")
	}

	oldValue := req.Apply(item)

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	if err := u.RecordHistory(ctx, collection, req.RequestID, req.Operation, req.Field, oldValue, req.NewValue, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return requestResponse(collection, updated, item), nil
}

func (u *Usecase) loadCollection(ctx context.Context, id string) (*domain.Collection, *collectionService.DocsContent, []byte, error) {
	collection, content, err := u.Port.LoadCollection(ctx, id)
	if err != nil {
		return nil, nil, nil, err
	}

	var docs collectionService.DocsContent
	if err := json.Unmarshal(content, &docs); err != nil {
		return nil, nil, nil, localerror.InvalidData("Invalid collection.json file")
	}

	return collection, &docs, content, nil
}

func (u *Usecase) saveCollection(ctx context.Context, collection *domain.Collection, docs *collectionService.DocsContent) ([]byte, error) {
	content, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		return nil, err
	}
	return u.Port.SaveCollection(ctx, collection, content)
}

func (u *Usecase) RecordHistory(ctx context.Context, collection *domain.Collection, requestID, operation, field string, oldValue, newValue any, oldContent, newContent []byte) error {
	return u.Port.RecordHistory(ctx, collection, requestID, operation, field, oldValue, newValue, oldContent, newContent)
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

	switch {
	case authHeader != nil:
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
	case item.Request.Auth != nil && item.Request.Auth.AuthSource == "onrequest" && len(item.Request.Auth.Bearer) > 0:
		// Preserve explicit onrequest auth if already configured
	case item.Request.Auth != nil && item.Request.Auth.AuthSource == "none" && authHeader == nil:
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
