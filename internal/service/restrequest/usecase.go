package restrequest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
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

	u.NotifyWatcher(collection.Path, updated)

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
	req.URL.ResolvePath()
	req.URL.FormatEndpoint()
	req.URL.Query = resolveQueryParams(req.URL.Raw)

	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_url",
		Field:        "request.url",
		NewValue:     req.URL,
		Apply: func(item *collectionService.CollectionItem) any {
			old := item.Request.URL
			item.Request.URL = req.URL
			item.Request.URL.SyncVariables(old.Variable)
			item.Request.URL.OnlyEndpoint()
			return old
		},
	})
}

func (u *Usecase) EditPathVariable(ctx context.Context, collectionID, requestID string, req EditPathVariableRequest) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "edit_path_variable",
		Field:        "request.url.variable",
		NewValue:     req,
		Validate: func(item *collectionService.CollectionItem) error {
			if !item.Request.URL.HasVariable(req.Key) {
				return localerror.InvalidData("Path variable not found")
			}
			return nil
		},
		Apply: func(item *collectionService.CollectionItem) any {
			old := append([]collectionService.PathVariable(nil), item.Request.URL.Variable...)
			item.Request.URL.SetVariableValue(req.Key, req.Value)
			return old
		},
	})
}

func (u *Usecase) UpdateHeaders(ctx context.Context, collectionID, requestID string, req UpdateHeadersRequest) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "update_headers",
		Field:        "request.headers",
		NewValue:     req.Headers,
		Apply: func(item *collectionService.CollectionItem) any {
			old := append([]collectionService.Header(nil), item.Request.Header...)
			item.Request.Header = req.Headers
			return old
		},
	})
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
			for i := range req.Query {
				if req.Query[i].Id == "" {
					req.Query[i].Id = uuid.NewString()
				}
			}
			item.Request.URL.Query = req.Query
			item.Request.URL.Raw = updateRawURLQuery(item.Request.URL.Raw, req.Query)
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
	var newResponse collectionService.CollectionResponse
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "save_response",
		Field:        "response",
		NewValue:     func() any { return newResponse },
		Apply: func(item *collectionService.CollectionItem) any {
			old := append([]collectionService.CollectionResponse(nil), item.Response...)

			for i := range item.Response {
				if item.Response[i].ID == "" {
					item.Response[i].ID = uuid.NewString()
				}
			}

			if req.Responses != nil {
				item.Response = req.Responses
				for i := range item.Response {
					if item.Response[i].ID == "" {
						item.Response[i].ID = uuid.NewString()
					}
				}
				newResponse = collectionService.CollectionResponse{Name: "bulk_update"}
				return old
			}

			targetID := req.ID
			if targetID == "" && req.Response != nil {
				targetID = req.Response.ID
			}

			if strings.EqualFold(req.Action, "delete") || strings.EqualFold(req.Action, "remove") {
				if targetID != "" {
					filtered := make([]collectionService.CollectionResponse, 0, len(item.Response))
					for _, resp := range item.Response {
						if resp.ID != targetID {
							filtered = append(filtered, resp)
						}
					}
					item.Response = filtered
				}
				newResponse = collectionService.CollectionResponse{ID: targetID, Name: "deleted"}
				return old
			}

			if targetID != "" {
				for i, existing := range item.Response {
					if existing.ID == targetID {
						updated := req.ToCollectionResponse(item.Request)
						updated.ID = targetID
						if req.OriginalRequest == nil && (req.Response == nil || req.Response.OriginalRequest == nil) {
							updated.OriginalRequest = existing.OriginalRequest
						}
						item.Response[i] = updated
						newResponse = updated
						return old
					}
				}
			}

			newResponse = req.ToCollectionResponse(item.Request)
			if newResponse.ID == "" {
				newResponse.ID = uuid.NewString()
			}
			item.Response = append(item.Response, newResponse)
			return old
		},
	})
}

func (u *Usecase) Delete(ctx context.Context, collectionID, requestID string) (RequestResponse, error) {
	return u.update(ctx, updateReq{
		CollectionID: collectionID,
		RequestID:    requestID,
		Operation:    "delete_request",
		Field:        "request",
		Remove:       true,
	})
}

func (u *Usecase) UpdateTree(ctx context.Context, collectionID string, req []UpdateTreeItem) (UpdateTreeResponse, error) {
	return u.updateTree(ctx, updateTreeReq{
		CollectionID: collectionID,
		Tree:         req,
	})
}

func (u *Usecase) RecordHistory(ctx context.Context, collection *domain.Collection, requestID, operation, field string, oldValue, newValue any, oldContent, newContent []byte) error {
	return u.Port.RecordHistory(ctx, collection, requestID, operation, field, oldValue, newValue, oldContent, newContent)
}

type updateReq struct {
	CollectionID string
	RequestID    string
	Operation    string
	Field        string
	NewValue     any
	Remove       bool
	Validate     func(*collectionService.CollectionItem) error
	Apply        func(*collectionService.CollectionItem) any
}

func (u *Usecase) update(ctx context.Context, req updateReq) (RequestResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, req.CollectionID)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	var item *collectionService.CollectionItem
	var oldValue any
	if req.Remove {
		docs.Item, item = removeRequest(docs.Item, req.RequestID)
		if item == nil || item.Request == nil {
			return RequestResponse{}, localerror.InvalidData("Request not found")
		}
		oldValue = *item
	} else {
		item = findRequest(docs.Item, req.RequestID)
		if item == nil || item.Request == nil {
			return RequestResponse{}, localerror.InvalidData("Request not found")
		}
		if req.Validate != nil {
			if err := req.Validate(item); err != nil {
				return RequestResponse{}, err
			}
		}
		if req.Apply != nil {
			oldValue = req.Apply(item)
		}
	}

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	u.NotifyWatcher(collection.Path, updated)

	newValue := req.NewValue
	if fn, ok := newValue.(func() any); ok {
		newValue = fn()
	}

	if err := u.RecordHistory(ctx, collection, req.RequestID, req.Operation, req.Field, oldValue, newValue, content, updated); err != nil {
		return RequestResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	item.Request.URL.OnlyEndpoint()
	res := requestResponse(collection, updated, item)

	return res, nil
}

type updateTreeReq struct {
	CollectionID string
	Tree         []UpdateTreeItem
}

func (u *Usecase) updateTree(ctx context.Context, req updateTreeReq) (UpdateTreeResponse, error) {
	u.WriteMu.Lock()
	defer u.WriteMu.Unlock()

	collection, docs, content, err := u.loadCollection(ctx, req.CollectionID)
	if err != nil {
		return UpdateTreeResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	newItems, err := buildCollectionTree(docs.Item, req.Tree)
	if err != nil {
		return UpdateTreeResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	oldItems := docs.Item
	docs.Item = newItems

	updated, err := u.saveCollection(ctx, collection, docs)
	if err != nil {
		return UpdateTreeResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	u.NotifyWatcher(collection.Path, updated)

	if err := u.RecordHistory(ctx, collection, "", "update_tree", "item", oldItems, newItems, content, updated); err != nil {
		return UpdateTreeResponse{}, u.ErrHandler.ErrorReturn(err)
	}

	return UpdateTreeResponse{
		Item:    docs.Item,
		Version: u.Version(updated),
	}, nil
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

func findRequest(items []collectionService.CollectionItem, id string, auth ...*collectionService.CollectionAuth) *collectionService.CollectionItem {
	var skipAuth = false
	if auth == nil {
		skipAuth = true
	}

	for i := range items {
		if items[i].ID == id {
			if items[i].Request != nil {
				if !skipAuth {
					resolveAuth(items[i].Request, auth[0])
				}
				items[i].Request.URL.OnlyEndpoint()
				if items[i].Response != nil {
					for j, _ := range items[i].Response {
						if !skipAuth {
							resolveAuth(items[i].Response[j].OriginalRequest, auth[0])
						}
						items[i].Response[j].OriginalRequest.URL.OnlyEndpoint()
					}
				}
			}

			return &items[i]
		}
		if item := findRequest(items[i].Item, id, auth...); item != nil {
			return item
		}
	}
	return nil
}

func resolveAuth(request *collectionService.Request, collectionAuth *collectionService.CollectionAuth) {
	if request == nil {
		return
	}

	// 1. Get value from DocsContent.Auth if not null then set value to request.Auth, also set request.Auth.AuthSource = inheret
	if collectionAuth != nil {
		var bearer []collectionService.Property
		if collectionAuth.Bearer != nil {
			bearer = make([]collectionService.Property, len(collectionAuth.Bearer))
			copy(bearer, collectionAuth.Bearer)
		}
		request.Auth = &collectionService.ReqAuth{
			Type:       collectionAuth.Type,
			Bearer:     bearer,
			AuthSource: "inherit",
		}
	}

	// 2. Find at header if any header authorization, if exist then set value to request.Auth also set authSource = onrequest
	var authHeader *collectionService.Header
	for i := range request.Header {
		if strings.EqualFold(strings.TrimSpace(request.Header[i].Key), "Authorization") &&
			!request.Header[i].Disabled &&
			strings.TrimSpace(request.Header[i].Value) != "" {
			authHeader = &request.Header[i]
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
		request.Auth = &collectionService.ReqAuth{
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
	case request.Auth != nil && request.Auth.AuthSource == "onrequest" && len(request.Auth.Bearer) > 0:
		// Preserve explicit onrequest auth if already configured
	case request.Auth != nil && request.Auth.AuthSource == "none" && authHeader == nil:
		// Preserve explicit none auth if already configured
	}

	// 3. If none of them above satisfied set authSource to none
	if request.Auth == nil || request.Auth.AuthSource == "" {
		request.Auth = &collectionService.ReqAuth{
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

func resolveQueryParams(rawURL string) []collectionService.Property {
	cleanURL := rawURL
	if hashIdx := strings.Index(cleanURL, "#"); hashIdx != -1 {
		cleanURL = cleanURL[:hashIdx]
	}

	queryIdx := strings.Index(cleanURL, "?")
	if queryIdx == -1 {
		return []collectionService.Property{}
	}

	queryString := cleanURL[queryIdx+1:]
	if queryString == "" {
		return []collectionService.Property{}
	}

	pairs := strings.Split(queryString, "&")
	properties := make([]collectionService.Property, 0, len(pairs))
	for _, pair := range pairs {
		if pair == "" {
			continue
		}
		key, value, _ := strings.Cut(pair, "=")
		if key == "" && value == "" {
			continue
		}
		if unescapedKey, err := url.QueryUnescape(key); err == nil {
			key = unescapedKey
		}
		if unescapedValue, err := url.QueryUnescape(value); err == nil {
			value = unescapedValue
		}
		properties = append(properties, collectionService.Property{
			Id:    uuid.NewString(),
			Key:   key,
			Value: value,
		})
	}

	return properties
}

func buildQueryString(properties []collectionService.Property) string {
	var parts []string
	for _, p := range properties {
		if p.Disabled {
			continue
		}
		if p.Key == "" && p.Value == "" {
			continue
		}
		if p.Key == "" {
			parts = append(parts, "="+p.Value)
		} else if p.Value == "" {
			parts = append(parts, p.Key)
		} else {
			parts = append(parts, p.Key+"="+p.Value)
		}
	}
	return strings.Join(parts, "&")
}

func updateRawURLQuery(rawURL string, properties []collectionService.Property) string {
	base := rawURL
	fragment := ""
	if hashIdx := strings.Index(rawURL, "#"); hashIdx != -1 {
		base = rawURL[:hashIdx]
		fragment = rawURL[hashIdx:]
	}

	if qIdx := strings.Index(base, "?"); qIdx != -1 {
		base = base[:qIdx]
	}

	queryString := buildQueryString(properties)
	if queryString != "" {
		return base + "?" + queryString + fragment
	}
	return base + fragment
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

func buildCollectionTree(existingItems []collectionService.CollectionItem, treeItems []UpdateTreeItem) ([]collectionService.CollectionItem, error) {
	existingMap := make(map[string]collectionService.CollectionItem)
	indexItems(existingItems, existingMap)
	return buildTreeRecursive(treeItems, existingMap)
}

func indexItems(items []collectionService.CollectionItem, existingMap map[string]collectionService.CollectionItem) {
	for _, item := range items {
		if item.ID != "" {
			existingMap[item.ID] = item
		}
		if len(item.Item) > 0 {
			indexItems(item.Item, existingMap)
		}
	}
}

func buildTreeRecursive(treeItems []UpdateTreeItem, existingMap map[string]collectionService.CollectionItem) ([]collectionService.CollectionItem, error) {
	result := make([]collectionService.CollectionItem, 0, len(treeItems))
	for _, reqItem := range treeItems {
		existingItem, exists := existingMap[reqItem.ID]
		if !exists {
			return nil, localerror.InvalidData("Item not found: " + reqItem.ID)
		}

		itemCopy := existingItem
		if len(reqItem.Item) > 0 {
			children, err := buildTreeRecursive(reqItem.Item, existingMap)
			if err != nil {
				return nil, err
			}
			itemCopy.Item = children
		} else {
			if existingItem.Request == nil {
				itemCopy.Item = []collectionService.CollectionItem{}
			} else {
				itemCopy.Item = nil
			}
		}
		result = append(result, itemCopy)
	}
	return result, nil
}
