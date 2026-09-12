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

func TestUpdateNamePersistsNestedRequestAndRecordsHistory(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "folder-id",
				Name: "Folder",
				Item: []collectionService.CollectionItem{
					{ID: "request-id", Name: "Old name", Request: &collectionService.Request{}},
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

	updated, err := usecase.UpdateName(collection.ID, "request-id", UpdateNameRequest{
		BaseVersion: usecase.Version(content),
		Name:        "New name",
	})
	if err != nil {
		t.Fatalf("UpdateName() error = %v", err)
	}
	if updated.Name != "New name" {
		t.Fatalf("UpdateName() name = %q, want %q", updated.Name, "New name")
	}
	if updated.Version == usecase.Version(content) {
		t.Fatal("UpdateName() returned the unchanged version")
	}

	savedContent, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var saved collectionService.DocsContent
	if err := json.Unmarshal(savedContent, &saved); err != nil {
		t.Fatal(err)
	}
	item := findRequest(saved.Item, "request-id")
	if item == nil || item.Name != "New name" {
		t.Fatalf("persisted request = %#v, want name %q", item, "New name")
	}

	history, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 1 {
		t.Fatalf("history count = %d, want 1", len(history))
	}
	entry := history[0]
	if entry.Operation != "update_name" || entry.Field != "name" || entry.RequestID != "request-id" {
		t.Fatalf("history = %#v, want update_name for request-id name", entry)
	}
	if string(entry.OldValue) != `"Old name"` || string(entry.NewValue) != `"New name"` {
		t.Fatalf("history values = %s -> %s", entry.OldValue, entry.NewValue)
	}
}
