package collection

import (
	"github.com/rdhmuhammad/apitester/internal/domain"
	service "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/zishang520/socket.io/servers/socket/v3"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	SetOnRefresh(listener service.RefreshListener)
}

type CollectionSocket struct {
	usecase        Usecase
	collectionRepo db.RepositoryInterface[domain.Collection]
	space          *cio.NS
}

func NewCollectionSocket(lg logger.Logger, dbBolt *bbolt.DB) *CollectionSocket {
	collectionRepo, err := db.NewRepository[domain.Collection](dbBolt)
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize collection repo for collection socket: %v", err)
	}
	uc := service.NewUsecase(lg, dbBolt)
	s := &CollectionSocket{
		usecase:        uc,
		collectionRepo: collectionRepo,
	}
	uc.SetOnRefresh(s.NotifyRefresh)
	return s
}

const EventCollectionRefresh = "collection:refresh"

func (s *CollectionSocket) NotifyRefresh(refresh bool) {
	if s.space != nil {
		payload := map[string]any{"refresh": refresh}
		_ = s.space.Emit(EventCollectionRefresh, payload)
	}
}

func (s *CollectionSocket) HandleRefresh(_ *cio.NS, _ *socket.Socket, _ cio.MessagePayload) {
	s.NotifyRefresh(true)
}

func (s *CollectionSocket) OnSpace(ns cio.NSInitiate) {
	s.space = ns("collection", nil).
		Event(EventCollectionRefresh, &CollectionRefreshPayload{}, s.HandleRefresh)
	s.space.Build()
}

type CollectionRefreshPayload struct {
	Refresh bool `json:"refresh"`
}

func (p *CollectionRefreshPayload) From(msg ...any) {
	if len(msg) > 0 {
		if m, ok := msg[0].(map[string]any); ok {
			if r, ok := m["refresh"].(bool); ok {
				p.Refresh = r
			}
		}
	}
}
