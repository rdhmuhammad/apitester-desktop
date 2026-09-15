package collection

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func setupTestCollectionUsecase(t *testing.T, docs DocsContent, isSelected bool) (*Usecase, domain.Collection) {
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
	collection := domain.Collection{
		ID:         "col-test-1",
		Name:       "Test Collection",
		Path:       collectionPath,
		IsSelected: isSelected,
	}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}

	return usecase, collection
}

func TestGetAuth_ActiveCollection_WithAuth(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{
			Name: "Test API",
		},
		Auth: &CollectionAuth{
			Type: "bearer",
			Bearer: []Property{
				{
					Id:    "prop-1",
					Key:   "token",
					Value: "bearer-token-123",
					Type:  "string",
				},
			},
		},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)

	auth, err := usecase.GetAuth()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if auth == nil {
		t.Fatal("expected auth not nil")
	}
	if auth.Type != "bearer" {
		t.Errorf("expected type bearer, got %s", auth.Type)
	}
	if len(auth.Bearer) != 1 || auth.Bearer[0].Value != "bearer-token-123" {
		t.Errorf("unexpected bearer slice: %+v", auth.Bearer)
	}
}

func TestGetAuth_ActiveCollection_WithoutAuth(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{
			Name: "Test API Without Auth",
		},
		Auth: nil,
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)

	auth, err := usecase.GetAuth()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if auth != nil {
		t.Fatalf("expected nil auth, got %+v", auth)
	}
}

func TestGetAuth_ByCollectionID(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{
			Name: "Test API",
		},
		Auth: &CollectionAuth{
			Type: "bearer",
			Bearer: []Property{
				{
					Key:   "token",
					Value: "id-targeted-token",
				},
			},
		},
	}

	usecase, collection := setupTestCollectionUsecase(t, docs, false)

	// Fetch by explicit collection ID even when isSelected is false
	auth, err := usecase.GetAuth(collection.ID)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if auth == nil {
		t.Fatal("expected auth not nil")
	}
	if len(auth.Bearer) != 1 || auth.Bearer[0].Value != "id-targeted-token" {
		t.Errorf("unexpected bearer slice: %+v", auth.Bearer)
	}
}

func TestGetAuth_NoActiveCollection(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{Name: "Inactive Collection"},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, false)

	_, err := usecase.GetAuth()
	if err == nil {
		t.Fatal("expected error when no active collection, got nil")
	}
}

func TestGetAuth_CollectionNotFound(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{Name: "Some Collection"},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)

	_, err := usecase.GetAuth("non-existent-id")
	if err == nil {
		t.Fatal("expected error for non-existent collection, got nil")
	}
}

func TestUpdateAuth_Bearer(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{Name: "Test API"},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)

	auth, err := usecase.UpdateAuth(UpdateCollectionAuthRequest{
		Type: "bearer",
		Bearer: []Property{
			{Key: "token", Value: "new-saved-token"},
		},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if auth == nil || auth.Type != "bearer" {
		t.Fatalf("unexpected auth: %+v", auth)
	}
	if len(auth.Bearer) != 1 || auth.Bearer[0].Value != "new-saved-token" {
		t.Fatalf("unexpected bearer: %+v", auth.Bearer)
	}

	// Verify GetAuth sees the updated auth
	getAuth, err := usecase.GetAuth()
	if err != nil {
		t.Fatalf("expected no error from GetAuth, got %v", err)
	}
	if getAuth == nil || getAuth.Type != "bearer" || getAuth.Bearer[0].Value != "new-saved-token" {
		t.Fatalf("unexpected auth from GetAuth: %+v", getAuth)
	}
}

func TestUpdateAuth_None(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{Name: "Test API"},
		Auth: &CollectionAuth{
			Type:   "bearer",
			Bearer: []Property{{Key: "token", Value: "old-token"}},
		},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)

	auth, err := usecase.UpdateAuth(UpdateCollectionAuthRequest{
		Type: "none",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if auth != nil {
		t.Fatalf("expected auth nil, got %+v", auth)
	}

	// Verify GetAuth also returns nil
	getAuth, err := usecase.GetAuth()
	if err != nil {
		t.Fatalf("expected no error from GetAuth, got %v", err)
	}
	if getAuth != nil {
		t.Fatalf("expected nil from GetAuth, got %+v", getAuth)
	}
}
