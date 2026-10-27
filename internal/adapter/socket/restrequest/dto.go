package restrequest

import (
	"encoding/json"

	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
)

type RequestEvent string

func (receiver RequestEvent) Name() string {
	return string(receiver)
}

const (
	RequestUpdateUrl         RequestEvent = "request:update:url"
	RequestUpdateHeaders     RequestEvent = "request:update:headers"
	RequestUpdateAuthorization RequestEvent = "request:update:authorization"
	RequestUpdateMethod      RequestEvent = "request:update:method"
	RequestUpdateName        RequestEvent = "request:update:name"
	RequestUpdateQuery       RequestEvent = "request:update:query"
	RequestUpdateBodyJson    RequestEvent = "request:update:body:json"
	RequestUpdateBodyFormdata RequestEvent = "request:update:body:formdata"
	RequestUpdateScript      RequestEvent = "request:update:script"
	RequestDelete            RequestEvent = "request:delete"
	RequestSaveResponse      RequestEvent = "request:save:response"
	RequestSaveScript        RequestEvent = "request:save:script"
	RequestError             RequestEvent = "request:error"
	RequestSuccess           RequestEvent = "request:success"
	RequestEditPathVariable  RequestEvent = "request:edit:path:variable"
)

const RequestSavePostRequestScript = RequestSaveScript
const RequestUpdateAuth = "request:update:auth"
const RequestUpdateAuthEvent = RequestUpdateAuth

type RequestIdentity struct {
	CollectionID string `json:"collectionId"`
	RequestID    string `json:"requestId"`
}

type RequestGetPayload struct {
	RequestIdentity
}

type RequestUpdateURLPayload struct {
	RequestIdentity
	service.UpdateURLRequest
}

type RequestEditPathVariablePayload struct {
	RequestIdentity
	service.EditPathVariableRequest
}

type RequestUpdateHeadersPayload struct {
	RequestIdentity
	service.UpdateHeadersRequest
}

type RequestUpdateAuthorizationPayload struct {
	RequestIdentity
	service.UpdateAuthorizationRequest
}

type RequestUpdateAuthPayload struct {
	RequestIdentity
	service.UpdateAuthRequest
}

type RequestUpdateMethodPayload struct {
	RequestIdentity
	service.UpdateMethodRequest
}

type RequestUpdateNamePayload struct {
	RequestIdentity
	service.UpdateNameRequest
}

type RequestUpdateQueryPayload struct {
	RequestIdentity
	service.UpdateQueryRequest
}

type RequestUpdateJSONBodyPayload struct {
	RequestIdentity
	service.UpdateJSONBodyRequest
}

type RequestUpdateFormDataBodyPayload struct {
	RequestIdentity
	service.UpdateFormDataBodyRequest
}

type RequestUpdateScriptPayload struct {
	RequestIdentity
	service.UpdatePostRequestScriptRequest
}

type RequestDeletePayload struct {
	RequestIdentity
}

type RequestSaveResponsePayload struct {
	RequestIdentity
	service.SaveResponseRequest
}

type RequestSaveScriptPayload struct {
	RequestIdentity
	service.SavePostRequestScriptRequest
}

type RequestSavePostRequestScriptPayload = RequestSaveScriptPayload

func decodeRequestPayload(msg []any, target any) {
	if len(msg) == 0 {
		return
	}
	encoded, err := json.Marshal(msg[0])
	if err != nil {
		return
	}
	_ = json.Unmarshal(encoded, target)
}

func (p *RequestGetPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateURLPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestEditPathVariablePayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateHeadersPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateAuthorizationPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateAuthPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateMethodPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateNamePayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateQueryPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateJSONBodyPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateFormDataBodyPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateScriptPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestDeletePayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestSaveResponsePayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestSaveScriptPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}
