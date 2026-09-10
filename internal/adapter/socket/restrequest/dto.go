//go:generate stringer -type=RequestEvent
package restrequest

import (
	"encoding/json"
	"strings"
	"unicode"

	service "github.com/rdhmuhammad/apitester/internal/service/RestRequest"
)

type RequestEvent int

func (receiver RequestEvent) Name() string {
	name := []rune(receiver.String())
	parts := make([]string, 0, len(name))
	start := 0
	for i, char := range name {
		if i > 0 && unicode.IsUpper(char) {
			parts = append(parts, string(name[start:i]))
			start = i
		}
	}
	parts = append(parts, string(name[start:]))
	parts[0] = "restrequest"
	return strings.ToLower(strings.Join(parts, ":"))
}

const (
	RequestUpdateUrl RequestEvent = iota
	RequestUpdateHeaders
	RequestUpdateMethod
	RequestUpdateQuery
	RequestUpdateBodyJson
	RequestUpdateBodyFormdata
	RequestUpdateScript
	RequestDelete
	RequestError
)

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

type RequestUpdateHeadersPayload struct {
	RequestIdentity
	service.UpdateHeadersRequest
}

type RequestUpdateMethodPayload struct {
	RequestIdentity
	service.UpdateMethodRequest
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
	service.DeleteRequest
}

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

func (p *RequestUpdateHeadersPayload) From(msg ...any) {
	decodeRequestPayload(msg, p)
}

func (p *RequestUpdateMethodPayload) From(msg ...any) {
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
