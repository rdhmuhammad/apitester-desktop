package restrequest

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func TestSaveResponseAppendsResponseAndRecordsHistory(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "folder-id",
				Name: "Folder",
				Item: []collectionService.CollectionItem{
					{
						ID:   "request-id",
						Name: "Get Users",
						Request: &collectionService.Request{
							Method: "GET",
							URL: collectionService.RequestURL{
								Raw: "https://api.example.com/users",
							},
						},
						Response: []collectionService.CollectionResponse{},
					},
				},
			},
		},
	}
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
	defer boltDB.Close()

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())
	collection := domain.Collection{ID: "collection-id", Path: collectionPath}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}

	// 1. Save first response
	req1 := SaveResponseRequest{
		Name:   "200 OK",
		Status: "OK",
		Code:   200,
		Body:   `{"users": []}`,
		Header: []collectionService.Header{
			{Key: "Content-Type", Value: "application/json"},
		},
	}

	res, err := usecase.SaveResponse(collection.ID, "request-id", req1)
	if err != nil {
		t.Fatalf("SaveResponse() error = %v", err)
	}
	if len(res.Responses) != 1 {
		t.Fatalf("res.Responses count = %d, want 1", len(res.Responses))
	}
	if res.Responses[0].Name != "200 OK" || res.Responses[0].Code != 200 {
		t.Fatalf("res.Responses[0] = %#v, want 200 OK", res.Responses[0])
	}
	if res.Responses[0].OriginalRequest == nil || res.Responses[0].OriginalRequest.Method != "GET" {
		t.Fatalf("res.Responses[0].OriginalRequest = %#v, want copied from item.Request", res.Responses[0].OriginalRequest)
	}

	// 2. Save second response using nested struct
	req2 := SaveResponseRequest{
		Response: &collectionService.CollectionResponse{
			Name:   "404 Not Found",
			Status: "Not Found",
			Code:   404,
			Body:   `{"error": "not found"}`,
		},
	}

	res2, err := usecase.SaveResponse(collection.ID, "request-id", req2)
	if err != nil {
		t.Fatalf("SaveResponse() error = %v", err)
	}
	if len(res2.Responses) != 2 {
		t.Fatalf("res2.Responses count = %d, want 2", len(res2.Responses))
	}
	if res2.Responses[1].Code != 404 {
		t.Fatalf("res2.Responses[1].Code = %d, want 404", res2.Responses[1].Code)
	}

	// Verify persistence in collection file
	savedContent, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var saved collectionService.DocsContent
	if err := json.Unmarshal(savedContent, &saved); err != nil {
		t.Fatal(err)
	}
	item := findRequest(saved.Item, "request-id")
	if item == nil {
		t.Fatal("request-id not found in saved content")
	}
	if len(item.Response) != 2 {
		t.Fatalf("persisted item.Response count = %d, want 2", len(item.Response))
	}
	if item.Response[0].Name != "200 OK" || item.Response[1].Name != "404 Not Found" {
		t.Fatalf("persisted item.Response = %#v", item.Response)
	}

	// Verify history
	history, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 {
		t.Fatalf("history count = %d, want 2", len(history))
	}
	if history[0].Operation != "save_response" || history[0].Field != "response" {
		t.Fatalf("history[0] = %#v, want save_response for response", history[0])
	}
	if history[1].Operation != "save_response" || history[1].Field != "response" {
		t.Fatalf("history[1] = %#v, want save_response for response", history[1])
	}
}

func TestSaveResponseReturnsErrorWhenRequestNotFound(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{},
	}
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
	defer boltDB.Close()

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())
	collection := domain.Collection{ID: "collection-id", Path: collectionPath}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}

	_, err = usecase.SaveResponse(collection.ID, "non-existent-id", SaveResponseRequest{Code: 200})
	if err == nil {
		t.Fatal("expected error when request not found, got nil")
	}
}
