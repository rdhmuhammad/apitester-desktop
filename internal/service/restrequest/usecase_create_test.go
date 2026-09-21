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

func TestCreateRequestAppendsEmptyRequestAtTopLevel(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "folder-id",
				Name: "Folder",
				Item: []collectionService.CollectionItem{
					{ID: "nested-request-id", Request: &collectionService.Request{}},
				},
			},
		},
		Variable: []collectionService.CollectionVar{},
		Event:    []collectionService.CollectionEvent{},
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

	created, err := usecase.CreateRequest(context.Background(), collection.ID)
	if err != nil {
		t.Fatalf("CreateRequest() error = %v", err)
	}
	if created.ID == "" {
		t.Fatal("CreateRequest() returned an empty ID")
	}
	if created.Name != "" || created.Method != "" || created.Script != "" {
		t.Fatalf("CreateRequest() returned non-empty defaults: %+v", created)
	}
	if created.Headers == nil || len(created.Headers) != 0 {
		t.Fatalf("CreateRequest() headers = %#v, want empty slice", created.Headers)
	}
	if created.Query == nil || len(created.Query) != 0 {
		t.Fatalf("CreateRequest() query = %#v, want empty slice", created.Query)
	}
	if created.URL.Raw != "" || created.URL.Host == nil || created.URL.Path == nil || created.URL.Query == nil {
		t.Fatalf("CreateRequest() URL = %#v, want empty values and slices", created.URL)
	}
	if created.Body == nil || created.Body.Mode != "" || created.Body.Raw != "" {
		t.Fatalf("CreateRequest() body = %#v, want empty values", created.Body)
	}
	if created.Version == "" {
		t.Fatal("CreateRequest() returned an empty version")
	}

	savedContent, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var saved collectionService.DocsContent
	if err := json.Unmarshal(savedContent, &saved); err != nil {
		t.Fatal(err)
	}
	if len(saved.Item) != 2 {
		t.Fatalf("top-level item count = %d, want 2", len(saved.Item))
	}
	if len(saved.Item[0].Item) != 1 {
		t.Fatalf("nested item count = %d, want 1", len(saved.Item[0].Item))
	}
	createdItem := saved.Item[1]
	if createdItem.ID != created.ID || createdItem.Request == nil {
		t.Fatalf("persisted request = %#v, want created request", createdItem)
	}
	if createdItem.Request.Header == nil || createdItem.Request.URL.Host == nil || createdItem.Request.URL.Path == nil || createdItem.Request.URL.Query == nil {
		t.Fatalf("persisted request contains null collections: %#v", createdItem.Request)
	}

	history, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 1 || history[0].Operation != "create_request" || history[0].RequestID != created.ID {
		t.Fatalf("history = %#v, want one create_request entry", history)
	}
}
