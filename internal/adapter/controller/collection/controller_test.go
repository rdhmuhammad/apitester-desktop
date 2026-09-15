package collection

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/domain"
	service "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
)

type collectionUsecaseStub struct {
	authToReturn    *service.CollectionAuth
	authErrToReturn error
	getAuthPassedID []string
}

func (s *collectionUsecaseStub) Read(id string) (service.ReadResponse, error) {
	return service.ReadResponse{}, nil
}
func (s *collectionUsecaseStub) ListCollections() ([]domain.Collection, error) {
	return nil, nil
}
func (s *collectionUsecaseStub) CreateCollection(req service.CreateCollectionRequest) (domain.Collection, error) {
	return domain.Collection{}, nil
}
func (s *collectionUsecaseStub) UpdateCollectionByID(id string, req service.UpdateCollectionRequest) (domain.Collection, error) {
	return domain.Collection{}, nil
}
func (s *collectionUsecaseStub) DeleteCollection(id string) error {
	return nil
}
func (s *collectionUsecaseStub) SelectCollection(id string) (domain.Collection, error) {
	return domain.Collection{}, nil
}
func (s *collectionUsecaseStub) GetActiveCollection() (domain.Collection, error) {
	return domain.Collection{}, nil
}
func (s *collectionUsecaseStub) GetVariables() ([]service.CollectionVar, error) {
	return nil, nil
}
func (s *collectionUsecaseStub) GetPreScript() (string, error) {
	return "", nil
}
func (s *collectionUsecaseStub) UpdatePreScript(req service.UpdatePreScriptRequest) (service.UpdatePreScriptResponse, error) {
	return service.UpdatePreScriptResponse{}, nil
}
func (s *collectionUsecaseStub) CreateVariable(req service.CreateVariableRequest) (service.CreateVariableResponse, error) {
	return service.CreateVariableResponse{}, nil
}
func (s *collectionUsecaseStub) UpdateVariable(id string, req service.UpdateVariableRequest) (service.CreateVariableResponse, error) {
	return service.CreateVariableResponse{}, nil
}
func (s *collectionUsecaseStub) DeleteVariable(id string) (service.CreateVariableResponse, error) {
	return service.CreateVariableResponse{}, nil
}
func (s *collectionUsecaseStub) UploadCollection(id string, fileBytes []byte) error {
	return nil
}

func (s *collectionUsecaseStub) GetAuth() (*service.CollectionAuth, error) {
	s.getAuthPassedID = collectionID
	return s.authToReturn, s.authErrToReturn
}

func (s *collectionUsecaseStub) UpdateAuth(req service.UpdateCollectionAuthRequest) (*service.CollectionAuth, error) {
	return s.authToReturn, s.authErrToReturn
}

func TestGetAuthActiveCollection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authToReturn: &service.CollectionAuth{
			Type: "bearer",
			Bearer: []service.Property{
				{
					Key:   "token",
					Value: "my-secret-token",
					Type:  "string",
				},
			},
		},
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	if len(stub.getAuthPassedID) != 0 {
		t.Fatalf("expected no collectionID passed, got %v", stub.getAuthPassedID)
	}

	var response struct {
		Success bool                    `json:"success"`
		Message string                  `json:"message"`
		Data    *service.CollectionAuth `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !response.Success {
		t.Fatalf("expected success true, got false")
	}
	if response.Data == nil {
		t.Fatal("expected data not nil")
	}
	if response.Data.Type != "bearer" {
		t.Errorf("expected type bearer, got %s", response.Data.Type)
	}
	if len(response.Data.Bearer) != 1 || response.Data.Bearer[0].Value != "my-secret-token" {
		t.Errorf("unexpected bearer data: %+v", response.Data.Bearer)
	}
}

func TestGetAuthWithPathParam(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authToReturn: &service.CollectionAuth{
			Type: "bearer",
		},
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth/col-123", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	if len(stub.getAuthPassedID) != 1 || stub.getAuthPassedID[0] != "col-123" {
		t.Fatalf("expected collectionID 'col-123', got %v", stub.getAuthPassedID)
	}
}

func TestGetAuthWithQueryParam(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authToReturn: &service.CollectionAuth{
			Type: "bearer",
		},
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth?id=col-456", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	if len(stub.getAuthPassedID) != 1 || stub.getAuthPassedID[0] != "col-456" {
		t.Fatalf("expected collectionID 'col-456', got %v", stub.getAuthPassedID)
	}
}

func TestGetAuthNullWhenNoAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authToReturn: nil,
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var response struct {
		Success bool                    `json:"success"`
		Message string                  `json:"message"`
		Data    *service.CollectionAuth `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !response.Success {
		t.Fatalf("expected success true, got false")
	}
	if response.Data != nil {
		t.Fatalf("expected data to be null, got %+v", response.Data)
	}
}

func TestGetAuthInvalidDataError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authErrToReturn: localerror.InvalidData("No active collection"),
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestGetAuthInternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authErrToReturn: errors.New("database failure"),
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/collection/auth", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
}

func TestUpdateAuthRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &collectionUsecaseStub{
		authToReturn: &service.CollectionAuth{
			Type: "bearer",
			Bearer: []service.Property{
				{Key: "token", Value: "saved-token"},
			},
		},
	}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	body, _ := json.Marshal(service.UpdateCollectionAuthRequest{
		Type: "bearer",
		Bearer: []service.Property{
			{Key: "token", Value: "saved-token"},
		},
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/collection/auth", strings.NewReader(string(body)))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var response struct {
		Success bool                    `json:"success"`
		Message string                  `json:"message"`
		Data    *service.CollectionAuth `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Success {
		t.Fatal("expected success true")
	}
	if response.Data == nil || response.Data.Type != "bearer" {
		t.Fatalf("unexpected data: %+v", response.Data)
	}
}
