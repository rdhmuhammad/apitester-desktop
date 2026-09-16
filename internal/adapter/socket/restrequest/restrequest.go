package restrequest

import (
	"context"
	"time"

	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
	"strings"

	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/zishang520/socket.io/servers/socket/v3"
)

type Usecase interface {
	UpdateURL(ctx context.Context, collectionID, requestID string, req service.UpdateURLRequest) (service.RequestResponse, error)
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
	usecase Usecase
}

func NewRestRequestSocket(lg *logger.ReZero, dbBolt *bbolt.DB) *RequestSocket {
	return &RequestSocket{usecase: service.NewUsecase(lg, dbBolt)}
}

func (s *RequestSocket) UpdateAuth(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateAuthPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateAuth, "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateAuth(ctx, collectionID, requestID, payload.UpdateAuthRequest)
	s.emitResult(client, RequestUpdateAuth, res, err)
}

func (s *RequestSocket) UpdateURL(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateURLPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateUrl.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateURL(ctx, collectionID, requestID, payload.UpdateURLRequest)
	s.emitResult(client, RequestUpdateUrl.Name(), res, err)
}

func (s *RequestSocket) UpdateHeaders(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateHeadersPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateHeaders.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateHeaders(ctx, collectionID, requestID, payload.UpdateHeadersRequest)
	s.emitResult(client, RequestUpdateHeaders.Name(), res, err)
}

func (s *RequestSocket) UpdateMethod(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateMethodPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateMethod.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateMethod(ctx, collectionID, requestID, payload.UpdateMethodRequest)
	s.emitResult(client, RequestUpdateMethod.Name(), res, err)
}

func (s *RequestSocket) UpdateName(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateNamePayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateName.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateName(ctx, collectionID, requestID, payload.UpdateNameRequest)
	s.emitResult(client, RequestUpdateName.Name(), res, err)
}

func (s *RequestSocket) UpdateQuery(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateQueryPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateQuery.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateQuery(ctx, collectionID, requestID, payload.UpdateQueryRequest)
	s.emitResult(client, RequestUpdateQuery.Name(), res, err)
}

func (s *RequestSocket) UpdateJSONBody(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateJSONBodyPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateBodyJson.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateJSONBody(ctx, collectionID, requestID, payload.UpdateJSONBodyRequest)
	s.emitResult(client, RequestUpdateBodyJson.Name(), res, err)
}

func (s *RequestSocket) UpdateFormDataBody(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateFormDataBodyPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateBodyFormdata.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdateFormDataBody(ctx, collectionID, requestID, payload.UpdateFormDataBodyRequest)
	s.emitResult(client, RequestUpdateBodyFormdata.Name(), res, err)
}

func (s *RequestSocket) UpdateScript(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestUpdateScriptPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestUpdateScript.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.UpdatePostRequestScript(ctx, collectionID, requestID, payload.UpdatePostRequestScriptRequest)
	s.emitResult(client, RequestUpdateScript.Name(), res, err)
}

func (s *RequestSocket) Delete(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestDeletePayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestDelete.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.Delete(ctx, collectionID, requestID)
	s.emitResult(client, RequestDelete.Name(), res, err)
}

func (s *RequestSocket) SaveResponse(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestSaveResponsePayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestSaveResponse.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.SaveResponse(ctx, collectionID, requestID, payload.SaveResponseRequest)
	s.emitResult(client, RequestSaveResponse.Name(), res, err)
}

func (s *RequestSocket) SavePostRequestScript(_ *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	payload, ok := message.(*RequestSaveScriptPayload)
	if !ok {
		return
	}
	collectionID, requestID := requestIDs(client, payload.RequestIdentity)
	if collectionID == "" || requestID == "" {
		s.emitError(client, RequestSaveScript.Name(), "Collection id and request id are required")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := s.usecase.SavePostRequestScript(ctx, collectionID, requestID, payload.SavePostRequestScriptRequest)
	s.emitResult(client, RequestSaveScript.Name(), res, err)
}

func (s *RequestSocket) SaveScript(ns *cio.NS, client *socket.Socket, message cio.MessagePayload) {
	s.SavePostRequestScript(ns, client, message)
}

func (s *RequestSocket) OnSpace(ns cio.NSInitiate) {
	ns("restrequest", nil).
		Event(RequestUpdateUrl.Name(), &RequestUpdateURLPayload{}, s.UpdateURL).
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

func requestIDs(client *socket.Socket, identity RequestIdentity) (string, string) {
	query := client.Handshake().Query.Query()
	collectionID := strings.TrimSpace(identity.CollectionID)
	if collectionID == "" {
		collectionID = strings.TrimSpace(query.Get("collectionId"))
	}
	requestID := strings.TrimSpace(identity.RequestID)
	if requestID == "" {
		requestID = strings.TrimSpace(query.Get("requestId"))
	}
	return collectionID, requestID
}

func (s *RequestSocket) emitResult(client *socket.Socket, operation string, result service.RequestResponse, err error) {
	if err != nil {
		s.emitError(client, operation, err.Error())
		return
	}
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
