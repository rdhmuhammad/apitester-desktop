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

func TestUpdateURLResolvesQueryParamsAndRemovesOld(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")

	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-id",
				Name: "Test Request",
				Request: &collectionService.Request{
					Method: "GET",
					URL: collectionService.RequestURL{
						Raw:  "https://example.com/api/users?old_param=old_val",
						Host: []string{"https://example.com"},
						Path: []string{"api", "users"},
						Query: []collectionService.Property{
							{
								Id:    "old-id",
								Key:   "old_param",
								Value: "old_val",
							},
						},
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

	// 1. Update URL with new query parameters (including URL-encoded value and template variable)
	updated, err := usecase.UpdateURL(context.Background(), collection.ID, "request-id", UpdateURLRequest{
		URL: collectionService.RequestURL{
			Raw:  "https://example.com/api/users?page=1&search=hello%20world&filter={{status}}#section",
			Host: []string{"https://example.com"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateURL() error = %v", err)
	}

	if len(updated.URL.Query) != 3 {
		t.Fatalf("expected 3 query parameters in updated.URL.Query, got %d", len(updated.URL.Query))
	}
	if len(updated.Query) != 3 {
		t.Fatalf("expected 3 query parameters in updated.Query, got %d", len(updated.Query))
	}

	expected := []struct {
		key   string
		value string
	}{
		{"page", "1"},
		{"search", "hello world"},
		{"filter", "{{status}}"},
	}

	for i, exp := range expected {
		p := updated.URL.Query[i]
		if p.Key != exp.key || p.Value != exp.value {
			t.Errorf("query[%d]: got key=%q value=%q, want key=%q value=%q", i, p.Key, p.Value, exp.key, exp.value)
		}
		if p.Id == "" {
			t.Errorf("query[%d]: expected non-empty Id", i)
		}
		if p.Disabled {
			t.Errorf("query[%d]: expected Disabled=false", i)
		}
	}

	// Verify persistence via Get
	got, err := usecase.Get(context.Background(), collection.ID, "request-id")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if len(got.URL.Query) != 3 {
		t.Fatalf("expected 3 query parameters in got.URL.Query, got %d", len(got.URL.Query))
	}

	// 2. Update URL with no query parameters - verifies old query is removed
	updatedNoQuery, err := usecase.UpdateURL(context.Background(), collection.ID, "request-id", UpdateURLRequest{
		URL: collectionService.RequestURL{
			Raw:  "https://example.com/api/users",
			Host: []string{"https://example.com"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateURL() error = %v", err)
	}
	if len(updatedNoQuery.URL.Query) != 0 {
		t.Fatalf("expected 0 query parameters in updatedNoQuery.URL.Query, got %d", len(updatedNoQuery.URL.Query))
	}
	if len(updatedNoQuery.Query) != 0 {
		t.Fatalf("expected 0 query parameters in updatedNoQuery.Query, got %d", len(updatedNoQuery.Query))
	}
}

func TestUpdateQueryUpdatesRequestURLRaw(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")

	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-id",
				Name: "Test Request",
				Request: &collectionService.Request{
					Method: "GET",
					URL: collectionService.RequestURL{
						Raw:  "https://example.com/api/users?old=1#section",
						Host: []string{"https://example.com"},
						Path: []string{"api", "users"},
						Query: []collectionService.Property{
							{Id: "q-1", Key: "old", Value: "1"},
						},
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

	// 1. Update query params with new values
	res, err := usecase.UpdateQuery(context.Background(), collection.ID, "request-id", UpdateQueryRequest{
		Query: []collectionService.Property{
			{Key: "page", Value: "2"},
			{Key: "limit", Value: "50"},
			{Key: "disabled_param", Value: "skip_me", Disabled: true},
		},
	})
	if err != nil {
		t.Fatalf("UpdateQuery() error = %v", err)
	}

	expectedRaw := "/api/users?page=2&limit=50#section"
	if res.URL.Raw != expectedRaw {
		t.Fatalf("UpdateQuery() res.URL.Raw = %q, want %q", res.URL.Raw, expectedRaw)
	}

	// Verify persistence via Get
	got, err := usecase.Get(context.Background(), collection.ID, "request-id")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.URL.Raw != expectedRaw {
		t.Fatalf("Get() got.URL.Raw = %q, want %q", got.URL.Raw, expectedRaw)
	}

	// 2. Clear query params completely
	resEmpty, err := usecase.UpdateQuery(context.Background(), collection.ID, "request-id", UpdateQueryRequest{
		Query: []collectionService.Property{},
	})
	if err != nil {
		t.Fatalf("UpdateQuery() error = %v", err)
	}

	expectedRawEmpty := "/api/users#section"
	if resEmpty.URL.Raw != expectedRawEmpty {
		t.Fatalf("UpdateQuery() resEmpty.URL.Raw = %q, want %q", resEmpty.URL.Raw, expectedRawEmpty)
	}
}
