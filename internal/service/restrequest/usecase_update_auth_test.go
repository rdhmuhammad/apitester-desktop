package restrequest

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func setupTestUsecase(t *testing.T, docs collectionService.DocsContent) (*Usecase, domain.Collection, string) {
	t.Helper()
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")

	content, err := json.MarshalIndent(docs, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(collectionPath, content, 0644); err != nil {
		t.Fatal(err)
	}

	boltDB, err := db.NewBoltDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = boltDB.Close()
	})

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())
	collection := domain.Collection{ID: "collection-id", Path: collectionPath}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}

	return usecase, collection, collectionPath
}

func TestUpdateAuthOnRequest(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, collectionPath := setupTestUsecase(t, docs)

	req := UpdateAuthRequest{
		Type: "bearer",
		Bearer: []collectionService.Property{
			{
				Id:    "uuid-1",
				Key:   "token",
				Value: "{{token}}",
				Type:  "string",
			},
		},
		AuthSource: "onrequest",
	}

	res, err := usecase.UpdateAuth(collection.ID, "request-1", req)
	if err != nil {
		t.Fatalf("UpdateAuth() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "onrequest" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "onrequest")
	}
	if res.Auth.Type != "bearer" {
		t.Errorf("Type = %q, want %q", res.Auth.Type, "bearer")
	}
	if len(res.Auth.Bearer) != 1 {
		t.Fatalf("Bearer count = %d, want 1", len(res.Auth.Bearer))
	}
	if res.Auth.Bearer[0].Id != "uuid-1" || res.Auth.Bearer[0].Key != "token" || res.Auth.Bearer[0].Value != "{{token}}" || res.Auth.Bearer[0].Type != "string" {
		t.Errorf("Bearer property mismatch: %#v", res.Auth.Bearer[0])
	}

	// Verify persistence in collection file
	savedBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var savedDocs collectionService.DocsContent
	if err := json.Unmarshal(savedBytes, &savedDocs); err != nil {
		t.Fatal(err)
	}
	item := findRequest(savedDocs.Item, "request-1")
	if item == nil || item.Request == nil || item.Request.Auth == nil {
		t.Fatalf("persisted request auth is nil: %#v", item)
	}
	if item.Request.Auth.AuthSource != "onrequest" {
		t.Errorf("persisted AuthSource = %q, want %q", item.Request.Auth.AuthSource, "onrequest")
	}
	if item.Request.Auth.Type != "bearer" {
		t.Errorf("persisted Type = %q, want %q", item.Request.Auth.Type, "bearer")
	}
	if len(item.Request.Auth.Bearer) != 1 || item.Request.Auth.Bearer[0].Key != "token" {
		t.Errorf("persisted Bearer mismatch: %#v", item.Request.Auth.Bearer)
	}

	// Verify history entry
	history, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 1 {
		t.Fatalf("history count = %d, want 1", len(history))
	}
	entry := history[0]
	if entry.Operation != "update_auth" || entry.Field != "request.auth" || entry.RequestID != "request-1" {
		t.Fatalf("history entry mismatch: %#v", entry)
	}
}

func TestUpdateAuthOnRequestGeneratesIDWhenEmpty(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	req := UpdateAuthRequest{
		Type: "bearer",
		Bearer: []collectionService.Property{
			{
				Key:   "token",
				Value: "{{token}}",
				Type:  "string",
			},
		},
		AuthSource: "onrequest",
	}

	res, err := usecase.UpdateAuth(collection.ID, "request-1", req)
	if err != nil {
		t.Fatalf("UpdateAuth() error = %v", err)
	}

	if len(res.Auth.Bearer) != 1 {
		t.Fatalf("Bearer count = %d, want 1", len(res.Auth.Bearer))
	}
	if res.Auth.Bearer[0].Id == "" {
		t.Error("expected generated Id for Bearer property, got empty")
	}
}

func TestUpdateAuthInheret(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
					Auth: &collectionService.ReqAuth{
						Type:       "bearer",
						Bearer:     []collectionService.Property{{Key: "token", Value: "prev"}},
						AuthSource: "onrequest",
					},
				},
			},
		},
	}

	usecase, collection, collectionPath := setupTestUsecase(t, docs)

	req := UpdateAuthRequest{
		Type:       "bearer", // even if sent, should be cleared for inheret
		AuthSource: "inherit",
	}

	res, err := usecase.UpdateAuth(collection.ID, "request-1", req)
	if err != nil {
		t.Fatalf("UpdateAuth() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "inherit" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "inherit")
	}
	if res.Auth.Type != "" {
		t.Errorf("Type = %q, want empty", res.Auth.Type)
	}
	if len(res.Auth.Bearer) != 0 {
		t.Errorf("Bearer = %#v, want empty", res.Auth.Bearer)
	}

	savedBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(savedBytes), `"type": ""`) {
		t.Errorf("saved JSON does not contain empty type: %s", string(savedBytes))
	}
	if strings.Contains(string(savedBytes), `"bearer"`) {
		t.Errorf("saved JSON should omit bearer for inheret: %s", string(savedBytes))
	}
}

func TestUpdateAuthInheritNormalizedToInheret(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	req := UpdateAuthRequest{
		AuthSource: "inherit",
	}

	res, err := usecase.UpdateAuth(collection.ID, "request-1", req)
	if err != nil {
		t.Fatalf("UpdateAuth() error = %v", err)
	}

	if res.Auth.AuthSource != "inherit" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "inherit")
	}
	if res.Auth.Type != "" {
		t.Errorf("Type = %q, want empty", res.Auth.Type)
	}
	if len(res.Auth.Bearer) != 0 {
		t.Errorf("Bearer = %#v, want empty", res.Auth.Bearer)
	}
}

func TestUpdateAuthNone(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, collectionPath := setupTestUsecase(t, docs)

	req := UpdateAuthRequest{
		Type:       "bearer",
		AuthSource: "none",
	}

	res, err := usecase.UpdateAuth(collection.ID, "request-1", req)
	if err != nil {
		t.Fatalf("UpdateAuth() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "none" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "none")
	}
	if res.Auth.Type != "" {
		t.Errorf("Type = %q, want empty", res.Auth.Type)
	}
	if len(res.Auth.Bearer) != 0 {
		t.Errorf("Bearer = %#v, want empty", res.Auth.Bearer)
	}

	savedBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(savedBytes), `"bearer"`) {
		t.Errorf("saved JSON should omit bearer for none: %s", string(savedBytes))
	}
}

func TestUpdateAuthRequestNotFound(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	_, err := usecase.UpdateAuth(collection.ID, "non-existent", UpdateAuthRequest{
		AuthSource: "none",
	})
	if err == nil {
		t.Fatal("expected error when request not found, got nil")
	}
}

func TestGetResolvesAuthFromDocsContent(t *testing.T) {
	docs := collectionService.DocsContent{
		Auth: &collectionService.CollectionAuth{
			Type: "bearer",
			Bearer: []collectionService.Property{
				{Id: "prop-1", Key: "token", Value: "collection-token", Type: "string"},
			},
		},
		Item: []collectionService.CollectionItem{
			{
				ID:   "req-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	res, err := usecase.Get(collection.ID, "req-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "inherit" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "inherit")
	}
	if res.Auth.Type != "bearer" {
		t.Errorf("Type = %q, want %q", res.Auth.Type, "bearer")
	}
	if len(res.Auth.Bearer) != 1 || res.Auth.Bearer[0].Value != "collection-token" {
		t.Fatalf("Bearer = %#v, want collection-token", res.Auth.Bearer)
	}
}

func TestGetResolvesAuthFromHeader(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "req-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
					Header: []collectionService.Header{
						{
							Id:    "h-1",
							Key:   "Authorization",
							Value: "Bearer request-token-123",
						},
					},
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	res, err := usecase.Get(collection.ID, "req-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "onrequest" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "onrequest")
	}
	if res.Auth.Type != "bearer" {
		t.Errorf("Type = %q, want %q", res.Auth.Type, "bearer")
	}
	if len(res.Auth.Bearer) != 1 || res.Auth.Bearer[0].Value != "request-token-123" {
		t.Fatalf("Bearer = %#v, want request-token-123", res.Auth.Bearer)
	}
}

func TestGetResolvesAuthHeaderPrecedenceOverDocsContent(t *testing.T) {
	docs := collectionService.DocsContent{
		Auth: &collectionService.CollectionAuth{
			Type: "bearer",
			Bearer: []collectionService.Property{
				{Id: "prop-1", Key: "token", Value: "collection-token", Type: "string"},
			},
		},
		Item: []collectionService.CollectionItem{
			{
				ID:   "req-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
					Header: []collectionService.Header{
						{
							Id:    "h-1",
							Key:   "Authorization",
							Value: "Bearer override-token",
						},
					},
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	res, err := usecase.Get(collection.ID, "req-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "onrequest" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "onrequest")
	}
	if len(res.Auth.Bearer) != 1 || res.Auth.Bearer[0].Value != "override-token" {
		t.Fatalf("Bearer = %#v, want override-token", res.Auth.Bearer)
	}
}

func TestGetResolvesAuthNoneWhenNeitherSatisfied(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "req-1",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	res, err := usecase.Get(collection.ID, "req-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "none" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "none")
	}
	if res.Auth.Type != "" {
		t.Errorf("Type = %q, want empty", res.Auth.Type)
	}
	if len(res.Auth.Bearer) != 0 {
		t.Errorf("Bearer = %#v, want empty", res.Auth.Bearer)
	}
}

func TestGetResolvesAuthNestedRequest(t *testing.T) {
	docs := collectionService.DocsContent{
		Auth: &collectionService.CollectionAuth{
			Type: "bearer",
			Bearer: []collectionService.Property{
				{Id: "prop-1", Key: "token", Value: "folder-inherited-token", Type: "string"},
			},
		},
		Item: []collectionService.CollectionItem{
			{
				ID:   "folder-1",
				Name: "Auth Folder",
				Item: []collectionService.CollectionItem{
					{
						ID:   "nested-req-1",
						Name: "Nested Request",
						Request: &collectionService.Request{
							Method: "POST",
						},
					},
				},
			},
		},
	}

	usecase, collection, _ := setupTestUsecase(t, docs)

	res, err := usecase.Get(collection.ID, "nested-req-1")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}

	if res.Auth == nil {
		t.Fatal("expected res.Auth to not be nil")
	}
	if res.Auth.AuthSource != "inherit" {
		t.Errorf("AuthSource = %q, want %q", res.Auth.AuthSource, "inherit")
	}
	if len(res.Auth.Bearer) != 1 || res.Auth.Bearer[0].Value != "folder-inherited-token" {
		t.Fatalf("Bearer = %#v, want folder-inherited-token", res.Auth.Bearer)
	}
}
