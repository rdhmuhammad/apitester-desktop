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

func TestUpdateHeadersAndGetPreservesDisabledField(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")

	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-id",
				Name: "Test Request",
				Request: &collectionService.Request{
					Method: "POST",
					Header: []collectionService.Header{
						{
							Id:       "h-1",
							Key:      "Content-Type",
							Value:    "application/json",
							Disabled: false,
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

	// 1. Verify Get returns Disabled = false
	got, err := usecase.Get(context.Background(), collection.ID, "request-id")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if len(got.Headers) != 1 {
		t.Fatalf("Get() headers count = %d, want 1", len(got.Headers))
	}
	if got.Headers[0].Disabled != false {
		t.Fatalf("Get() headers[0].Disabled = %v, want false", got.Headers[0].Disabled)
	}

	// 2. UpdateHeaders with Disabled = true
	updated, err := usecase.UpdateHeaders(context.Background(), collection.ID, "request-id", UpdateHeadersRequest{
		Headers: []collectionService.Header{
			{
				Id:       "h-1",
				Key:      "Content-Type",
				Value:    "application/json",
				Disabled: true,
			},
			{
				Id:       "h-2",
				Key:      "Authorization",
				Value:    "Bearer token123",
				Disabled: false,
			},
		},
	})
	if err != nil {
		t.Fatalf("UpdateHeaders() error = %v", err)
	}
	if len(updated.Headers) != 2 {
		t.Fatalf("UpdateHeaders() headers count = %d, want 2", len(updated.Headers))
	}
	if updated.Headers[0].Disabled != true {
		t.Fatalf("UpdateHeaders() headers[0].Disabled = %v, want true", updated.Headers[0].Disabled)
	}
	if updated.Headers[1].Disabled != false {
		t.Fatalf("UpdateHeaders() headers[1].Disabled = %v, want false", updated.Headers[1].Disabled)
	}

	// 3. Verify Get after update returns Disabled = true
	gotAfterUpdate, err := usecase.Get(context.Background(), collection.ID, "request-id")
	if err != nil {
		t.Fatalf("Get() after update error = %v", err)
	}
	if len(gotAfterUpdate.Headers) != 2 {
		t.Fatalf("Get() headers count = %d, want 2", len(gotAfterUpdate.Headers))
	}
	if gotAfterUpdate.Headers[0].Disabled != true {
		t.Fatalf("Get() headers[0].Disabled = %v, want true", gotAfterUpdate.Headers[0].Disabled)
	}
	if gotAfterUpdate.Headers[1].Disabled != false {
		t.Fatalf("Get() headers[1].Disabled = %v, want false", gotAfterUpdate.Headers[1].Disabled)
	}

	// 4. Verify JSON marshaling includes disabled
	jsonBytes, err := json.Marshal(gotAfterUpdate)
	if err != nil {
		t.Fatal(err)
	}
	var rawMap map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &rawMap); err != nil {
		t.Fatal(err)
	}
	headersRaw, ok := rawMap["headers"].([]interface{})
	if !ok || len(headersRaw) != 2 {
		t.Fatalf("raw JSON headers = %#v, want 2 items", rawMap["headers"])
	}
	h0 := headersRaw[0].(map[string]interface{})
	if h0["disabled"] != true {
		t.Fatalf("raw JSON headers[0].disabled = %#v, want true", h0["disabled"])
	}
	h1 := headersRaw[1].(map[string]interface{})
	if h1["disabled"] != false {
		t.Fatalf("raw JSON headers[1].disabled = %#v, want false", h1["disabled"])
	}
}
