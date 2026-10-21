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

func TestPrepareCreate_OnlySetIDIfEmpty(t *testing.T) {
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

	initialDocs.PrepareCreate()

	if initialDocs.Item[0].ID != "existing-item-id-1" {
		t.Errorf("expected item[0].ID to be 'existing-item-id-1', got '%s'", initialDocs.Item[0].ID)
	}
	if initialDocs.Item[1].ID == "" {
		t.Errorf("expected item[1].ID to be generated, got empty")
	}
	req := initialDocs.Item[0].Request
	if req.Header[0].Id != "existing-hdr-1" || req.Header[1].Id == "" {
		t.Errorf("unexpected header IDs: %+v", req.Header)
	}
	if req.URL.Query[0].Id != "existing-query-1" || req.URL.Query[1].Id == "" {
		t.Errorf("unexpected query IDs: %+v", req.URL.Query)
	}
	if req.Body.FormData[0].Id != "existing-form-1" || req.Body.FormData[1].Id == "" {
		t.Errorf("unexpected formData IDs: %+v", req.Body.FormData)
	}
	resp := initialDocs.Item[0].Response[0]
	if resp.Header[0].Id != "existing-resp-hdr-1" || resp.Header[1].Id == "" {
		t.Errorf("unexpected response header IDs: %+v", resp.Header)
	}
	if initialDocs.Variable[0].ID != "existing-var-1" || initialDocs.Variable[0].Category != "BASE_URL" {
		t.Errorf("unexpected variable[0]: %+v", initialDocs.Variable[0])
	}
	if initialDocs.Variable[1].ID == "" || initialDocs.Variable[1].Category != "" {
		t.Errorf("unexpected variable[1]: %+v", initialDocs.Variable[1])
	}
}

func TestCreateDeleteAndSelectCollection(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()

	boltDB, err := db.NewBoltDB(filepath.Join(tempDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = boltDB.Close()
	})

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())

	proj1 := domain.Project{ID: "proj-1", Name: "Project 1", Path: tempDir, IsSelected: false}
	proj2 := domain.Project{ID: "proj-2", Name: "Project 2", Path: tempDir, IsSelected: true}
	if err := usecase.projectRepo.Create(context.Background(), proj1.ID, &proj1); err != nil {
		t.Fatal(err)
	}
	if err := usecase.projectRepo.Create(context.Background(), proj2.ID, &proj2); err != nil {
		t.Fatal(err)
	}

	col, err := usecase.CreateCollection(context.Background(), CreateCollectionRequest{
		ProjectID: proj1.ID,
		Name:      "Orders Service",
		Path:      tempDir,
	})
	if err != nil {
		t.Fatalf("CreateCollection failed: %v", err)
	}
	if col.ID == "" || col.ProjectID != proj1.ID {
		t.Fatalf("unexpected created collection: %+v", col)
	}

	expectedFile := filepath.Join(tempDir, "Orders Service.json")
	if col.Path != expectedFile {
		t.Fatalf("expected path %q, got %q", expectedFile, col.Path)
	}

	fileBytes, err := os.ReadFile(col.Path)
	if err != nil {
		t.Fatalf("expected created collection file on disk: %v", err)
	}
	var savedDocs DocsContent
	if err := json.Unmarshal(fileBytes, &savedDocs); err != nil {
		t.Fatalf("unmarshal saved docs failed: %v", err)
	}
	if savedDocs.Info.Name != "Orders Service" || !savedDocs.IsValidCollection() {
		t.Fatalf("unexpected saved docs content: %+v", savedDocs)
	}

	// SelectCollection should select both the collection and its parent project
	selected, err := usecase.SelectCollection(context.Background(), col.ID)
	if err != nil {
		t.Fatalf("SelectCollection failed: %v", err)
	}
	if !selected.IsSelected {
		t.Fatalf("expected collection to be selected")
	}

	updatedProj1, _ := usecase.projectRepo.View(context.Background(), proj1.ID)
	updatedProj2, _ := usecase.projectRepo.View(context.Background(), proj2.ID)
	if updatedProj1 == nil || !updatedProj1.IsSelected {
		t.Fatalf("expected parent project proj-1 to be selected")
	}
	if updatedProj2 == nil || updatedProj2.IsSelected {
		t.Fatalf("expected other project proj-2 to be deselected")
	}

	// DeleteCollection should remove both DB record and file on disk
	if err := usecase.DeleteCollection(context.Background(), col.ID); err != nil {
		t.Fatalf("DeleteCollection failed: %v", err)
	}
	if _, err := os.Stat(col.Path); !os.IsNotExist(err) {
		t.Fatalf("expected collection file %q to be deleted from disk, stat err: %v", col.Path, err)
	}
	deletedView, _ := usecase.CollectionRepo.View(context.Background(), col.ID)
	if deletedView != nil {
		t.Fatalf("expected collection DB record to be deleted")
	}
}
