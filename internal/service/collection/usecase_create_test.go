package collection

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func TestCreateCollection_OnlySetIDIfEmpty(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "test_collection.json")

	initialDocs := DocsContent{
		Info: CollectionInfo{
			Name: "Test Collection",
		},
		Item: []CollectionItem{
			{
				ID:   "existing-item-id-1",
				Name: "Request with existing IDs",
				Request: &Request{
					Method: "GET",
					Header: []Header{
						{Id: "existing-hdr-1", Key: "Authorization", Value: "Bearer token"},
						{Id: "", Key: "Custom-Header", Value: "val"},
					},
					URL: RequestURL{
						Query: []Property{
							{Id: "existing-query-1", Key: "page", Value: "1"},
							{Id: "", Key: "limit", Value: "10"},
						},
					},
					Body: &RequestBody{
						FormData: []Property{
							{Id: "existing-form-1", Key: "field1", Value: "v1"},
							{Id: "", Key: "field2", Value: "v2"},
						},
					},
				},
				Response: []CollectionResponse{
					{
						Name: "200 OK",
						Header: []Header{
							{Id: "existing-resp-hdr-1", Key: "Content-Type", Value: "application/json"},
							{Id: "", Key: "X-Trace", Value: "123"},
						},
					},
				},
			},
			{
				ID:   "",
				Name: "Request with empty item ID",
				Request: &Request{
					Method: "POST",
				},
			},
		},
		Variable: []CollectionVar{
			{
				ID:    "existing-var-1",
				Key:   "baseUrl",
				Value: "https://example.com",
			},
			{
				ID:    "",
				Key:   "apiKey",
				Value: "secret",
			},
		},
	}

	content, err := json.MarshalIndent(initialDocs, "", "  ")
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

	col, err := usecase.CreateCollection(context.Background(), CreateCollectionRequest{
		Name: "Test Collection",
		Path: collectionPath,
	})
	if err != nil {
		t.Fatalf("CreateCollection failed: %v", err)
	}
	if col.ID == "" {
		t.Fatal("expected collection ID not empty")
	}

	// Read back the saved file on disk
	fileBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatalf("reading collection file failed: %v", err)
	}

	var savedDocs DocsContent
	if err := json.Unmarshal(fileBytes, &savedDocs); err != nil {
		t.Fatalf("unmarshal saved docs failed: %v", err)
	}

	// 1. Verify item with existing ID is preserved
	if savedDocs.Item[0].ID != "existing-item-id-1" {
		t.Errorf("expected item[0].ID to be 'existing-item-id-1', got '%s'", savedDocs.Item[0].ID)
	}
	// 2. Verify item with empty ID gets a new UUID
	if savedDocs.Item[1].ID == "" {
		t.Errorf("expected item[1].ID to be generated, got empty")
	}

	// 3. Verify request headers
	req := savedDocs.Item[0].Request
	if req.Header[0].Id != "existing-hdr-1" {
		t.Errorf("expected header[0].Id to be 'existing-hdr-1', got '%s'", req.Header[0].Id)
	}
	if req.Header[1].Id == "" {
		t.Errorf("expected header[1].Id to be generated, got empty")
	}

	// 4. Verify query params
	if req.URL.Query[0].Id != "existing-query-1" {
		t.Errorf("expected query[0].Id to be 'existing-query-1', got '%s'", req.URL.Query[0].Id)
	}
	if req.URL.Query[1].Id == "" {
		t.Errorf("expected query[1].Id to be generated, got empty")
	}

	// 5. Verify form-data
	if req.Body.FormData[0].Id != "existing-form-1" {
		t.Errorf("expected formData[0].Id to be 'existing-form-1', got '%s'", req.Body.FormData[0].Id)
	}
	if req.Body.FormData[1].Id == "" {
		t.Errorf("expected formData[1].Id to be generated, got empty")
	}

	// 6. Verify response headers
	resp := savedDocs.Item[0].Response[0]
	if resp.Header[0].Id != "existing-resp-hdr-1" {
		t.Errorf("expected response header[0].Id to be 'existing-resp-hdr-1', got '%s'", resp.Header[0].Id)
	}
	if resp.Header[1].Id == "" {
		t.Errorf("expected response header[1].Id to be generated, got empty")
	}

	// 7. Verify variables
	if savedDocs.Variable[0].ID != "existing-var-1" {
		t.Errorf("expected variable[0].ID to be 'existing-var-1', got '%s'", savedDocs.Variable[0].ID)
	}
	if savedDocs.Variable[0].Category != "BASE_URL" {
		t.Errorf("expected variable[0].Category to be 'BASE_URL', got '%s'", savedDocs.Variable[0].Category)
	}
	if savedDocs.Variable[1].ID == "" {
		t.Errorf("expected variable[1].ID to be generated, got empty")
	}
	if savedDocs.Variable[1].Category != "" {
		t.Errorf("expected variable[1].Category to be empty, got '%s'", savedDocs.Variable[1].Category)
	}

	// 8. Test Read does not mutate or regenerate IDs
	readResp, err := usecase.Read(context.Background(), col.ID)
	if err != nil {
		t.Fatalf("Read failed: %v", err)
	}
	if readResp.Content.Item[0].ID != "existing-item-id-1" {
		t.Errorf("Read altered item[0].ID: got %s", readResp.Content.Item[0].ID)
	}
	if readResp.Content.Item[1].ID != savedDocs.Item[1].ID {
		t.Errorf("Read altered item[1].ID: expected %s, got %s", savedDocs.Item[1].ID, readResp.Content.Item[1].ID)
	}
}
