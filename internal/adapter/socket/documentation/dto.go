package docsocket

import (
	"encoding/json"

	service "github.com/rdhmuhammad/apitester/internal/service/documentation"
)

const (
	EventDocumentContentEdit = "document:content:edit"
	EventDocumentRefresh     = "document:refresh"
	EventDocumentSuccess     = "document:success"
	EventDocumentError       = "document:error"
)

type DocumentContentEditPayload struct {
	service.EditDocumentContentRequest
}

func (p *DocumentContentEditPayload) From(msg ...any) {
	if len(msg) == 0 {
		return
	}
	encoded, err := json.Marshal(msg[0])
	if err != nil {
		return
	}
	_ = json.Unmarshal(encoded, p)
}

type DocumentRefreshPayload struct {
	Refresh bool `json:"refresh"`
}

func (p *DocumentRefreshPayload) From(msg ...any) {
	if len(msg) == 0 {
		return
	}
	if b, ok := msg[0].(bool); ok {
		p.Refresh = b
		return
	}
	if m, ok := msg[0].(map[string]any); ok {
		if r, ok := m["refresh"].(bool); ok {
			p.Refresh = r
		}
	}
}
