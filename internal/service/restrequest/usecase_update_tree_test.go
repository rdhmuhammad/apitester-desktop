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

func setupUpdateTreeTestUsecase(t *testing.T, docs collectionService.DocsContent) (*Usecase, string, string) {
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
		boltDB.Close()
	})

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())
	collection := domain.Collection{ID: "col-1", Path: collectionPath}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}

	return usecase, collection.ID, collectionPath
}

func TestUpdateTree_ReorderAndPreserveFields(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "req-1",
				Name: "Request 1",
				Request: &collectionService.Request{
					Method: "GET",
					URL: collectionService.RequestURL{
						Raw: "https://api.example.com/1",
					},
				},
			},
			{
				ID:   "folder-1",
				Name: "Folder 1",
				Item: []collectionService.CollectionItem{
					{
						ID:   "req-2",
						Name: "Request 2",
						Request: &collectionService.Request{
							Method: "POST",
							URL: collectionService.RequestURL{
								Raw: "https://api.example.com/2",
							},
						},
					},
				},
			},
			{
				ID:   "req-3",
				Name: "Request 3",
				Request: &collectionService.Request{
					Method: "DELETE",
				},
			},
		},
	}

	usecase, colID, colPath := setupUpdateTreeTestUsecase(t, docs)

	// Move req-2 out of folder-1 to root, move req-1 into folder-1, and omit req-3 (pruning/delete)
	newTree := []UpdateTreeItem{
		{
			ID: "req-2",
		},
		{
			ID: "folder-1",
			Item: []UpdateTreeItem{
				{ID: "req-1"},
			},
		},
	}

	ctx := context.Background()
	res, err := usecase.UpdateTree(ctx, colID, newTree)
	if err != nil {
		t.Fatalf("UpdateTree failed: %v", err)
	}

	if len(res.Item) != 2 {
		t.Fatalf("expected 2 root items, got %d", len(res.Item))
	}
	if res.Version == "" {
		t.Errorf("expected version to be non-empty")
	}

	// First item: req-2
	if res.Item[0].ID != "req-2" || res.Item[0].Name != "Request 2" || res.Item[0].Request == nil || res.Item[0].Request.Method != "POST" {
		t.Errorf("req-2 not preserved correctly: %+v", res.Item[0])
	}

	// Second item: folder-1 containing req-1
	if res.Item[1].ID != "folder-1" || res.Item[1].Name != "Folder 1" {
		t.Errorf("folder-1 not preserved correctly: %+v", res.Item[1])
	}
	if len(res.Item[1].Item) != 1 || res.Item[1].Item[0].ID != "req-1" || res.Item[1].Item[0].Name != "Request 1" {
		t.Errorf("nested req-1 not preserved correctly: %+v", res.Item[1].Item)
	}

	// Verify file was written to disk
	savedBytes, err := os.ReadFile(colPath)
	if err != nil {
		t.Fatal(err)
	}
	var savedDocs collectionService.DocsContent
	if err := json.Unmarshal(savedBytes, &savedDocs); err != nil {
		t.Fatal(err)
	}
	if len(savedDocs.Item) != 2 {
		t.Fatalf("expected 2 saved items, got %d", len(savedDocs.Item))
	}
	if savedDocs.Item[0].ID != "req-2" {
		t.Errorf("expected first saved item to be req-2, got %s", savedDocs.Item[0].ID)
	}
	if savedDocs.Item[1].Item[0].ID != "req-1" {
		t.Errorf("expected folder child to be req-1, got %s", savedDocs.Item[1].Item[0].ID)
	}

	// Verify collection history recorded
	histories, err := usecase.HistoryRepo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(histories) != 1 {
		t.Fatalf("expected 1 history record, got %d", len(histories))
	}
	if histories[0].Operation != "update_tree" || histories[0].Field != "item" {
		t.Errorf("unexpected history record: %+v", histories[0])
	}
}

func TestUpdateTree_ItemNotFound(t *testing.T) {
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{ID: "req-1", Name: "Request 1"},
		},
	}

	usecase, colID, _ := setupUpdateTreeTestUsecase(t, docs)

	newTree := []UpdateTreeItem{
		{ID: "unknown-id"},
	}

	_, err := usecase.UpdateTree(context.Background(), colID, newTree)
	if err == nil {
		t.Fatalf("expected error for unknown item id, got nil")
	}
}
