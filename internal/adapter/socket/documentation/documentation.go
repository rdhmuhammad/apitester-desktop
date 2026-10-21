package docsocket

import (
	"context"
	"strings"
	"time"

	service "github.com/rdhmuhammad/apitester/internal/service/documentation"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/zishang520/socket.io/servers/socket/v3"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	SetOnRefresh(listener service.RefreshListener)
	EditContent(ctx context.Context, req service.EditDocumentContentRequest) (service.DocumentResponse, error)
}

type DocumentationSocket struct {
	usecase Usecase
	space   *cio.NS
}

func NewDocumentationSocket(lg logger.Logger, dbBolt *bbolt.DB) *DocumentationSocket {
	uc := service.NewUsecase(lg, dbBolt)
	s := &DocumentationSocket{
		usecase: uc,
	}
	uc.SetOnRefresh(s.NotifyRefresh)
	return s
}

func (s *DocumentationSocket) NotifyRefresh(refresh bool) {
	if s.space != nil {
		_ = s.space.Emit(EventDocumentRefresh, refresh)
	}
}

func (s *DocumentationSocket) HandleRefresh(_ *cio.NS, _ *socket.Socket, _ cio.MessagePayload) {
	s.NotifyRefresh(true)
}

func (s *DocumentationSocket) EditContent(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*DocumentContentEditPayload)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	docID := strings.TrimSpace(payload.ID)
	if docID == "" {
		docID = strings.TrimSpace(client.Handshake().Query.Query().Get("id"))
	}
	if docID == "" {
		_ = client.Emit(EventDocumentError, map[string]string{
			"operation": EventDocumentContentEdit,
			"message":   "Document id is required",
		})
		return
	}

	req := payload.EditDocumentContentRequest
	req.ID = docID
	res, err := s.usecase.EditContent(ctx, req)
	if err != nil {
		_ = client.Emit(EventDocumentError, map[string]string{
			"operation": EventDocumentContentEdit,
			"message":   err.Error(),
		})
		return
	}

	_ = client.Emit(EventDocumentSuccess, map[string]any{
		"operation": EventDocumentContentEdit,
		"document":  res,
	})
}

func (s *DocumentationSocket) OnSpace(ns cio.NSInitiate) {
	s.space = ns("documentation", nil).
		Event(EventDocumentContentEdit, &DocumentContentEditPayload{}, s.EditContent).
		Event(EventDocumentRefresh, &DocumentRefreshPayload{}, s.HandleRefresh)
	s.space.Build()
}
