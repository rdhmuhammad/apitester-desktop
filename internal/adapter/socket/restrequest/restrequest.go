package restrequest

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/rdhmuhammad/apitester/internal/domain"
	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/shared/base"
	"github.com/zishang520/socket.io/servers/socket/v3"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	UpdateURL(ctx context.Context, collectionID, requestID string, req service.UpdateURLRequest) (service.RequestResponse, error)
	EditPathVariable(ctx context.Context, collectionID, requestID string, req service.EditPathVariableRequest) (service.RequestResponse, error)
	UpdateHeaders(ctx context.Context, collectionID, requestID string, req service.UpdateHeadersRequest) (service.RequestResponse, error)
	UpdateAuth(ctx context.Context, collectionID, requestID string, req service.UpdateAuthRequest) (service.RequestResponse, error)
	UpdateMethod(ctx context.Context, collectionID, requestID string, req service.UpdateMethodRequest) (service.RequestResponse, error)
	UpdateName(ctx context.Context, collectionID, requestID string, req service.UpdateNameRequest) (service.RequestResponse, error)
	UpdateQuery(ctx context.Context, collectionID, requestID string, req service.UpdateQueryRequest) (service.RequestResponse, error)
	UpdateJSONBody(ctx context.Context, collectionID, requestID string, req service.UpdateJSONBodyRequest) (service.RequestResponse, error)
	UpdateFormDataBody(ctx context.Context, collectionID, requestID string, req service.UpdateFormDataBodyRequest) (service.RequestResponse, error)
	UpdatePostRequestScript(ctx context.Context, collectionID, requestID string, req service.UpdatePostRequestScriptRequest) (service.RequestResponse, error)
	Delete(ctx context.Context, collectionID, requestID string) (service.RequestResponse, error)
	SaveResponse(ctx context.Context, collectionID, requestID string, req service.SaveResponseRequest) (service.RequestResponse, error)
	SavePostRequestScript(ctx context.Context, collectionID, requestID string, req service.SavePostRequestScriptRequest) (service.RequestResponse, error)
}

type RequestSocket struct {
	usecase        Usecase
	collectionRepo db.RepositoryInterface[domain.Collection]
}

func NewRestRequestSocket(lg *logger.ReZero, dbBolt *bbolt.DB) *RequestSocket {
	collectionRepo, err := db.NewRepository[domain.Collection](dbBolt)
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize collection repo for restrequest socket: %v", err)
	}
	return &RequestSocket{
		usecase:        service.NewUsecase(lg, dbBolt),
		collectionRepo: collectionRepo,
	}
}

func handleRequestAction[P cio.MessagePayload](
	s *RequestSocket,
	client *socket.Socket,
	message cio.MessagePayload,
	event string,
	getIdentity func(P) RequestIdentity,
	action func(ctx context.Context, collectionID, requestID string, p P) (service.RequestResponse, error),
) {
	payload, ok := message.(P)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	collectionID, requestID := s.requestIDs(ctx, client, getIdentity(payload))
	if collectionID == "" || requestID == "" {
		s.emitError(client, event, "Collection id and request id are required")
		return
	}
	res, err := action(ctx, collectionID, requestID, payload)
	s.emitResult(client, event, res, err)
}

func (s *RequestSocket) UpdateAuth(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateAuth,
		func(p *RequestUpdateAuthPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateAuthPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateAuth(ctx, cid, rid, p.UpdateAuthRequest)
		})
}

func (s *RequestSocket) UpdateURL(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateUrl.Name(),
		func(p *RequestUpdateURLPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateURLPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateURL(ctx, cid, rid, p.UpdateURLRequest)
		})
}

func (s *RequestSocket) EditPathVariable(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestEditPathVariable.Name(),
		func(p *RequestEditPathVariablePayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestEditPathVariablePayload) (service.RequestResponse, error) {
			return s.usecase.EditPathVariable(ctx, cid, rid, p.EditPathVariableRequest)
		})
}

func (s *RequestSocket) UpdateHeaders(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateHeaders.Name(),
		func(p *RequestUpdateHeadersPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateHeadersPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateHeaders(ctx, cid, rid, p.UpdateHeadersRequest)
		})
}

func (s *RequestSocket) UpdateMethod(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateMethod.Name(),
		func(p *RequestUpdateMethodPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateMethodPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateMethod(ctx, cid, rid, p.UpdateMethodRequest)
		})
}

func (s *RequestSocket) UpdateName(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateName.Name(),
		func(p *RequestUpdateNamePayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateNamePayload) (service.RequestResponse, error) {
			return s.usecase.UpdateName(ctx, cid, rid, p.UpdateNameRequest)
		})
}

func (s *RequestSocket) UpdateQuery(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateQuery.Name(),
		func(p *RequestUpdateQueryPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateQueryPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateQuery(ctx, cid, rid, p.UpdateQueryRequest)
		})
}

func (s *RequestSocket) UpdateJSONBody(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateBodyJson.Name(),
		func(p *RequestUpdateJSONBodyPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateJSONBodyPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateJSONBody(ctx, cid, rid, p.UpdateJSONBodyRequest)
		})
}

func (s *RequestSocket) UpdateFormDataBody(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateBodyFormdata.Name(),
		func(p *RequestUpdateFormDataBodyPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateFormDataBodyPayload) (service.RequestResponse, error) {
			return s.usecase.UpdateFormDataBody(ctx, cid, rid, p.UpdateFormDataBodyRequest)
		})
}

func (s *RequestSocket) UpdateScript(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestUpdateScript.Name(),
		func(p *RequestUpdateScriptPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestUpdateScriptPayload) (service.RequestResponse, error) {
			return s.usecase.UpdatePostRequestScript(ctx, cid, rid, p.UpdatePostRequestScriptRequest)
		})
}

func (s *RequestSocket) Delete(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestDelete.Name(),
		func(p *RequestDeletePayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, _ *RequestDeletePayload) (service.RequestResponse, error) {
			return s.usecase.Delete(ctx, cid, rid)
		})
}

func (s *RequestSocket) SaveResponse(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestSaveResponse.Name(),
		func(p *RequestSaveResponsePayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestSaveResponsePayload) (service.RequestResponse, error) {
			return s.usecase.SaveResponse(ctx, cid, rid, p.SaveResponseRequest)
		})
}

func (s *RequestSocket) SavePostRequestScript(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	handleRequestAction(s, client, message, RequestSaveScript.Name(),
		func(p *RequestSaveScriptPayload) RequestIdentity { return p.RequestIdentity },
		func(ctx context.Context, cid, rid string, p *RequestSaveScriptPayload) (service.RequestResponse, error) {
			return s.usecase.SavePostRequestScript(ctx, cid, rid, p.SavePostRequestScriptRequest)
		})
}

func (s *RequestSocket) SaveScript(ns *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	s.SavePostRequestScript(ns, client, message)
}

func (s *RequestSocket) OnSpace(ns cio.NSInitiate) {
	ns("restrequest", nil).
		Event(RequestUpdateUrl.Name(), &RequestUpdateURLPayload{}, s.UpdateURL).
		Event(RequestEditPathVariable.Name(), &RequestEditPathVariablePayload{}, s.EditPathVariable).
		Event(RequestUpdateHeaders.Name(), &RequestUpdateHeadersPayload{}, s.UpdateHeaders).
		Event(RequestUpdateAuth, &RequestUpdateAuthPayload{}, s.UpdateAuth).
		Event(RequestUpdateMethod.Name(), &RequestUpdateMethodPayload{}, s.UpdateMethod).
		Event(RequestUpdateName.Name(), &RequestUpdateNamePayload{}, s.UpdateName).
		Event(RequestUpdateQuery.Name(), &RequestUpdateQueryPayload{}, s.UpdateQuery).
		Event(RequestUpdateBodyJson.Name(), &RequestUpdateJSONBodyPayload{}, s.UpdateJSONBody).
		Event(RequestUpdateBodyFormdata.Name(), &RequestUpdateFormDataBodyPayload{}, s.UpdateFormDataBody).
		Event(RequestUpdateScript.Name(), &RequestUpdateScriptPayload{}, s.UpdateScript).
		Event(RequestDelete.Name(), &RequestDeletePayload{}, s.Delete).
		Event(RequestSaveResponse.Name(), &RequestSaveResponsePayload{}, s.SaveResponse).
		Event(RequestSaveScript.Name(), &RequestSaveScriptPayload{}, s.SavePostRequestScript).
		Event("request:save:post:request:script", &RequestSaveScriptPayload{}, s.SavePostRequestScript).
		Build()
}

func (s *RequestSocket) requestIDs(ctx context.Context, client *socket.Socket, identity RequestIdentity) (string, string) {
	query := client.Handshake().Query.Query()
	collectionID := strings.TrimSpace(identity.CollectionID)
	if collectionID == "" {
		collectionID = strings.TrimSpace(query.Get("collectionId"))
	}
	if collectionID == "" && s.collectionRepo != nil {
		if selected := base.FindSelectedCollection(ctx, s.collectionRepo); selected != nil {
			collectionID = selected.ID
		}
	}
	requestID := strings.TrimSpace(identity.RequestID)
	if requestID == "" {
		requestID = strings.TrimSpace(query.Get("requestId"))
	}
	return collectionID, requestID
}

func (s *RequestSocket) emitResult(client *socket.Socket, operation string, result service.RequestResponse, err error) {
	if err != nil {
		fmt.Println(err.Error())
		s.emitError(client, operation, err.Error())
		return
	}
	log.Println(result)
	_ = client.Emit(RequestSuccess.Name(), map[string]any{
		"operation": operation,
		"request":   result,
	})
}

func (s *RequestSocket) emitError(client *socket.Socket, operation, message string) {
	_ = client.Emit(RequestError.Name(), map[string]string{
		"operation": operation,
		"message":   message,
	})
}
