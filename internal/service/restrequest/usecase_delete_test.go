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

func TestDeleteRequestTopLevel(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{ID: "req-1", Name: "Request 1", Request: &collectionService.Request{Method: "GET"}},
			{ID: "req-2", Name: "Request 2", Request: &collectionService.Request{Method: "POST"}},
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

	res, err := usecase.Delete(context.Background(), collection.ID, "req-1")
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if res.ID != "req-1" {
		t.Fatalf("Delete() res.ID = %q, want %q", res.ID, "req-1")
	}
	if res.Version == usecase.Version(content) {
		t.Fatal("Delete() returned the unchanged version")
	}

	savedContent, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var saved collectionService.DocsContent
	if err := json.Unmarshal(savedContent, &saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.Item) != 1 || saved.Item[0].ID != "req-2" {
		t.Fatalf("saved.Item = %+v, want only req-2", saved.Item)
	}

	history, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 1 {
		t.Fatalf("history count = %d, want 1", len(history))
	}
	entry := history[0]
	if entry.Operation != "delete_request" || entry.Field != "request" || entry.RequestID != "req-1" {
		t.Fatalf("history = %#v, want delete_request for req-1 request", entry)
	}
}

func TestDeleteRequestNested(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "folder-1",
				Name: "Folder",
				Item: []collectionService.CollectionItem{
					{ID: "req-nested", Name: "Nested Request", Request: &collectionService.Request{Method: "DELETE"}},
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

	res, err := usecase.Delete(context.Background(), collection.ID, "req-nested")
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if res.ID != "req-nested" {
		t.Fatalf("Delete() res.ID = %q, want %q", res.ID, "req-nested")
	}

	savedContent, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var saved collectionService.DocsContent
	if err := json.Unmarshal(savedContent, &saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.Item[0].Item) != 0 {
		t.Fatalf("expected nested folder to be empty, got: %+v", saved.Item[0].Item)
	}
}

func TestDeleteRequestNotFound(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{ID: "req-1", Name: "Request 1", Request: &collectionService.Request{Method: "GET"}},
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

	_, err = usecase.Delete(context.Background(), collection.ID, "non-existent")
	if err == nil {
		t.Fatal("expected error for non-existent request, got nil")
	}
}
