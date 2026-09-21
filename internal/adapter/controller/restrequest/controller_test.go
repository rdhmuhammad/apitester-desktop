package restrequest

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
)

type createRequestUsecaseStub struct {
	collectionID        string
	requestID           string
	deleteRequestCalled bool
	updateTreeCalled    bool
	updateTreeReq       []service.UpdateTreeItem
}

func (stub *createRequestUsecaseStub) CreateRequest(_ context.Context, collectionID string) (service.RequestResponse, error) {
	stub.collectionID = collectionID
	return service.RequestResponse{ID: "request-id"}, nil
}

func (stub *createRequestUsecaseStub) Get(_ context.Context, _, _ string) (service.RequestResponse, error) {
	return service.RequestResponse{}, nil
}

func (stub *createRequestUsecaseStub) Delete(_ context.Context, collectionID, requestID string) (service.RequestResponse, error) {
	stub.collectionID = collectionID
	stub.requestID = requestID
	stub.deleteRequestCalled = true
	return service.RequestResponse{ID: requestID, Version: "next-version"}, nil
}

func (stub *createRequestUsecaseStub) UpdateTree(_ context.Context, collectionID string, req []service.UpdateTreeItem) (service.UpdateTreeResponse, error) {
	stub.collectionID = collectionID
	stub.updateTreeCalled = true
	stub.updateTreeReq = req
	return service.UpdateTreeResponse{
		Item:    []collectionService.CollectionItem{{ID: "req-1"}},
		Version: "tree-version",
	}, nil
}

func TestCreateRequestRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &createRequestUsecaseStub{}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/restrequest/create-request/collection-id", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if stub.collectionID != "collection-id" {
		t.Fatalf("collection ID = %q, want %q", stub.collectionID, "collection-id")
	}
	var response struct {
		Data service.RequestResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Data.ID != "request-id" {
		t.Fatalf("response request ID = %q, want %q", response.Data.ID, "request-id")
	}
}

func TestDeleteRequestRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &createRequestUsecaseStub{}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/restrequest/collection-id/request-id", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !stub.deleteRequestCalled {
		t.Fatal("delete request usecase was not called")
	}
	if stub.collectionID != "collection-id" {
		t.Fatalf("collection ID = %q, want %q", stub.collectionID, "collection-id")
	}
	if stub.requestID != "request-id" {
		t.Fatalf("request ID = %q, want %q", stub.requestID, "request-id")
	}
	var response struct {
		Data service.RequestResponse `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Data.ID != "request-id" {
		t.Fatalf("response request ID = %q, want %q", response.Data.ID, "request-id")
	}
	if response.Data.Version != "next-version" {
		t.Fatalf("response version = %q, want %q", response.Data.Version, "next-version")
	}
}

func TestUpdateTreeRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	stub := &createRequestUsecaseStub{}
	controller := Controller{usecase: stub, mapper: mapper.NewMapper()}
	router := gin.New()
	controller.Route(router.Group(""))

	body := []service.UpdateTreeItem{
		{ID: "req-1"},
	}
	bodyBytes, _ := json.Marshal(body)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/restrequest/tree/collection-id", bytes.NewReader(bodyBytes))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !stub.updateTreeCalled {
		t.Fatal("update tree usecase was not called")
	}
	if stub.collectionID != "collection-id" {
		t.Fatalf("collection ID = %q, want %q", stub.collectionID, "collection-id")
	}
	if len(stub.updateTreeReq) != 1 || stub.updateTreeReq[0].ID != "req-1" {
		t.Fatalf("unexpected tree req: %+v", stub.updateTreeReq)
	}
}
