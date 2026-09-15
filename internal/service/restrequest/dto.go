package restrequest

import collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"

type RequestResponse struct {
	ID        string                                 `json:"id"`
	Name      string                                 `json:"name"`
	Method    string                                 `json:"method"`
	URL       collectionService.RequestURL           `json:"url"`
	Headers   []collectionService.Header             `json:"headers"`
	Query     []collectionService.Property           `json:"query"`
	Body      *collectionService.RequestBody         `json:"body,omitempty"`
	Auth      *collectionService.ReqAuth             `json:"auth,omitempty"`
	Script    string                                 `json:"script"`
	Responses []collectionService.CollectionResponse `json:"responses,omitempty"`
	Version   string                                 `json:"version"`
}

type UpdateAuthRequest struct {
	Type       string                       `json:"type"`
	Bearer     []collectionService.Property `json:"bearer,omitempty"`
	AuthSource string                       `json:"authSource"`
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

type SavePostRequestScriptRequest struct {
	Exec   []string `json:"exec,omitempty"`
	Script string   `json:"script,omitempty"`
	Type   string   `json:"type,omitempty"`
}

type SaveScriptRequest = SavePostRequestScriptRequest

type SaveResponseRequest struct {
	Response        *collectionService.CollectionResponse `json:"response,omitempty"`
	Name            string                                `json:"name,omitempty"`
	OriginalRequest *collectionService.Request            `json:"originalRequest,omitempty"`
	Status          string                                `json:"status,omitempty"`
	Code            int                                   `json:"code,omitempty"`
	PreviewLanguage *string                               `json:"_postman_previewlanguage,omitempty"`
	Header          []collectionService.Header            `json:"header,omitempty"`
	Cookie          []collectionService.ResponseCookie    `json:"cookie,omitempty"`
	Body            string                                `json:"body,omitempty"`
}

func (r SaveResponseRequest) ToCollectionResponse(req *collectionService.Request) collectionService.CollectionResponse {
	var resp collectionService.CollectionResponse
	if r.Response != nil {
		resp = *r.Response
	} else {
		resp = collectionService.CollectionResponse{
			Name:            r.Name,
			OriginalRequest: r.OriginalRequest,
			Status:          r.Status,
			Code:            r.Code,
			PreviewLanguage: r.PreviewLanguage,
			Header:          r.Header,
			Cookie:          r.Cookie,
			Body:            r.Body,
		}
	}
	if resp.OriginalRequest == nil && req != nil {
		origReq := *req
		resp.OriginalRequest = &origReq
	}
	if resp.Name == "" {
		if resp.Status != "" {
			resp.Name = resp.Status
		} else {
			resp.Name = "Response"
		}
	}
	if resp.Header == nil {
		resp.Header = []collectionService.Header{}
	}
	if resp.Cookie == nil {
		resp.Cookie = []collectionService.ResponseCookie{}
	}
	return resp
}
