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
	BaseVersion string                       `json:"baseVersion" binding:"required"`
	URL         collectionService.RequestURL `json:"url"`
}

type UpdateHeadersRequest struct {
	BaseVersion string                     `json:"baseVersion" binding:"required"`
	Headers     []collectionService.Header `json:"headers"`
}

type UpdateAuthorizationRequest struct {
	BaseVersion string `json:"baseVersion" binding:"required"`
	Type        string `json:"type"`
	Token       string `json:"token,omitempty"`
}

type UpdateMethodRequest struct {
	BaseVersion string `json:"baseVersion" binding:"required"`
	Method      string `json:"method"`
}

type UpdateQueryRequest struct {
	BaseVersion string                       `json:"baseVersion" binding:"required"`
	Query       []collectionService.Property `json:"query"`
}

type UpdateJSONBodyRequest struct {
	BaseVersion string `json:"baseVersion" binding:"required"`
	Raw         string `json:"raw"`
}

type UpdateFormDataBodyRequest struct {
	BaseVersion string                       `json:"baseVersion" binding:"required"`
	FormData    []collectionService.Property `json:"formdata"`
}

type UpdatePostRequestScriptRequest struct {
	BaseVersion string   `json:"baseVersion" binding:"required"`
	Exec        []string `json:"exec"`
	Type        string   `json:"type"`
}

type DeleteRequest struct {
	BaseVersion string `json:"baseVersion" binding:"required"`
}
