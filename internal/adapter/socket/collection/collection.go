package collection

import (
	"encoding/json"
	"strings"

	service "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/zishang520/socket.io/servers/socket/v3"
)

type CollectionUsecase interface {
	WriteCollection(id string, req service.WriteCollectionRequest) error
}

type CollectionSocket struct {
	usecase CollectionUsecase
}

func NewCollectionSocket(usecase CollectionUsecase) *CollectionSocket {
	return &CollectionSocket{usecase: usecase}
}

type CollectionWritePayload struct {
	StartPos int    `json:"startPos"`
	EndPost  int    `json:"endPost"`
	Content  string `json:"content"`
}

func (p *CollectionWritePayload) From(msg ...any) {
	if len(msg) == 0 {
		return
	}

	encoded, err := json.Marshal(msg[0])
	if err != nil {
		return
	}
	_ = json.Unmarshal(encoded, p)
}

func (s *CollectionSocket) WriteCollection(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*CollectionWritePayload)
	if !ok {
		return
	}

	query := client.Handshake().Query.Query()
	collectionID := strings.TrimSpace(query.Get("collectionId"))
	if collectionID == "" {
		collectionID = strings.TrimSpace(query.Get("id"))
	}
	if collectionID == "" {
		collectionID = strings.TrimSpace(query.Get("roomId"))
	}
	if collectionID == "" {
		_ = client.Emit("collection:write:error", "Collection id is required")
		return
	}

	if err := s.usecase.WriteCollection(collectionID, service.WriteCollectionRequest{
		StartPos: payload.StartPos,
		EndPost:  payload.EndPost,
		Content:  payload.Content,
	}); err != nil {
		_ = client.Emit("collection:write:error", err.Error())
	}
}

func (s *CollectionSocket) OnSpace(ns cio.NSInitiate) {
	ns("collection", nil).
		Event("collection:write", &CollectionWritePayload{}, s.WriteCollection).
		Build()
}
