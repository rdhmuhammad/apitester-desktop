package base

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func TestFindSelectedCollection(t *testing.T) {
	tempDir := t.TempDir()
	boltDB, err := db.NewBoltDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer boltDB.Close()

	lg := logger.DefaultLogger().Build()
	port := NewPort(&lg, boltDB.DB())
	ctx := context.Background()

	// Initially no selected collection
	if selected := port.FindSelectedCollection(ctx); selected != nil {
		t.Fatalf("expected nil selected collection, got %+v", selected)
	}

	col1 := domain.Collection{ID: "c1", Name: "Col 1", IsSelected: false}
	col2 := domain.Collection{ID: "c2", Name: "Col 2", IsSelected: true}
	if err := port.CollectionRepo.Create(ctx, col1.ID, &col1); err != nil {
		t.Fatal(err)
	}
	if err := port.CollectionRepo.Create(ctx, col2.ID, &col2); err != nil {
		t.Fatal(err)
	}

	selected := port.FindSelectedCollection(ctx)
	if selected == nil {
		t.Fatal("expected selected collection, got nil")
	}
	if selected.ID != "c2" {
		t.Fatalf("expected c2, got %s", selected.ID)
	}
}

func TestLoadCollectionWithEmptyID(t *testing.T) {
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	if err := os.WriteFile(collectionPath, []byte(`{"info":{"name":"Test"}}`), 0644); err != nil {
		t.Fatal(err)
	}

	boltDB, err := db.NewBoltDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer boltDB.Close()

	lg := logger.DefaultLogger().Build()
	port := NewPort(&lg, boltDB.DB())
	ctx := context.Background()

	// Test with no active collection
	_, _, err = port.LoadCollection(ctx, "")
	if err == nil {
		t.Fatal("expected error when no active collection, got nil")
	}

	// Add active collection
	col := domain.Collection{ID: "active-col", Name: "Active", IsSelected: true, Path: collectionPath}
	if err := port.CollectionRepo.Create(ctx, col.ID, &col); err != nil {
		t.Fatal(err)
	}

	loadedCol, content, err := port.LoadCollection(ctx, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loadedCol.ID != "active-col" {
		t.Fatalf("expected active-col, got %s", loadedCol.ID)
	}
	if string(content) != `{"info":{"name":"Test"}}` {
		t.Fatalf("unexpected content: %s", string(content))
	}
}
