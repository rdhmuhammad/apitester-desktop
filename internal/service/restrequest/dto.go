package restrequest

import collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"

type RequestResponse struct {
	ID      string                         `json:"id"`
	Name    string                         `json:"name"`
	Method  string                         `json:"method"`
	URL     collectionService.RequestURL   `json:"url"`
	Headers []collectionService.Header     `json:"headers"`
	Query   []collectionService.Property   `json:"query"`
	Body    *collectionService.RequestBody `json:"body,omitempty"`
	Script  string                         `json:"script"`
	Version string                         `json:"version"`
}

type UpdateURLRequest struct {
	URL collectionService.RequestURL `json:"url"`
}

type UpdateHeadersRequest struct {
	Headers []collectionService.Header `json:"headers"`
}

type UpdateAuthorizationRequest struct {
	Type  string `json:"type"`
	Token string `json:"token,omitempty"`
}

type UpdateMethodRequest struct {
	Method string `json:"method"`
}

type UpdateNameRequest struct {
	Name string `json:"name"`
}

type UpdateQueryRequest struct {
	Query []collectionService.Property `json:"query"`
}

type UpdateJSONBodyRequest struct {
	Raw string `json:"raw"`
}

type UpdateFormDataBodyRequest struct {
	FormData []collectionService.Property `json:"formdata"`
}

type UpdatePostRequestScriptRequest struct {
	Exec []string `json:"exec"`
	Type string   `json:"type"`
}
