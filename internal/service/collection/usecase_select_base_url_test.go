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

func TestDocsContent_PrepareVariables(t *testing.T) {
	t.Run("selects first BASE_URL if none selected", func(t *testing.T) {
		docs := DocsContent{
			Variable: []CollectionVar{
				{ID: "1", Key: "custom_var", Value: "123", Category: ""},
				{ID: "2", Key: "base_url_1", Value: "https://api1.com", Category: "BASE_URL"},
				{ID: "3", Key: "base_url_2", Value: "https://api2.com", Category: "BASE_URL"},
			},
		}

		docs.PrepareVariables()

		if !docs.Variable[1].IsSelected {
			t.Errorf("expected base_url_1 to be selected, got false")
		}
		if docs.Variable[2].IsSelected {
			t.Errorf("expected base_url_2 to not be selected, got true")
		}
	})

	t.Run("preserves existing selection", func(t *testing.T) {
		docs := DocsContent{
			Variable: []CollectionVar{
				{ID: "1", Key: "base_url_1", Value: "https://api1.com", Category: "BASE_URL", IsSelected: false},
				{ID: "2", Key: "base_url_2", Value: "https://api2.com", Category: "BASE_URL", IsSelected: true},
			},
		}

		docs.PrepareVariables()

		if docs.Variable[0].IsSelected {
			t.Errorf("expected base_url_1 to not be selected, got true")
		}
		if !docs.Variable[1].IsSelected {
			t.Errorf("expected base_url_2 to remain selected, got false")
		}
	})

	t.Run("assigns category and selects first if regex matches", func(t *testing.T) {
		docs := DocsContent{
			Variable: []CollectionVar{
				{ID: "1", Key: "baseURL", Value: "https://api.com", Category: ""},
			},
		}

		docs.PrepareVariables()

		if docs.Variable[0].Category != "BASE_URL" {
			t.Errorf("expected Category to be BASE_URL, got %s", docs.Variable[0].Category)
		}
		if !docs.Variable[0].IsSelected {
			t.Errorf("expected baseURL to be selected, got false")
		}
	})

	t.Run("updates request host and replaces old host in raw url", func(t *testing.T) {
		docs := DocsContent{
			Variable: []CollectionVar{
				{ID: "1", Key: "dev", Value: "https://dev.api.com", Category: "BASE_URL", IsSelected: true},
			},
			Item: []CollectionItem{
				{
					ID:   "req-1",
					Name: "Login",
					Request: &Request{
						Method: "POST",
						URL: RequestURL{
							Host: []string{"{{oldDev}}"},
							Raw:  "{{oldDev}}/auth/login",
						},
					},
				},
				{
					ID:   "folder-1",
					Name: "User Management",
					Item: []CollectionItem{
						{
							ID:   "req-2",
							Name: "Get User",
							Request: &Request{
								Method: "GET",
								URL: RequestURL{
									Host: []string{"{{oldDev}}"},
									Raw:  "{{oldDev}}/users/{{userId}}",
								},
							},
							Response: []CollectionResponse{
								{
									Name: "200 OK",
									OriginalRequest: &Request{
										Method: "GET",
										URL: RequestURL{
											Host: []string{"{{oldDev}}"},
											Raw:  "{{oldDev}}/users/123",
										},
									},
								},
							},
						},
					},
				},
			},
		}

		docs.PrepareVariables()

		// Verify req-1
		if len(docs.Item[0].Request.URL.Host) != 1 || docs.Item[0].Request.URL.Host[0] != "{{dev}}" {
			t.Errorf("expected host [{{dev}}], got %v", docs.Item[0].Request.URL.Host)
		}
		if docs.Item[0].Request.URL.Raw != "{{dev}}/auth/login" {
			t.Errorf("expected raw '{{dev}}/auth/login', got '%s'", docs.Item[0].Request.URL.Raw)
		}

		// Verify nested req-2 and path parameter preservation
		nestedReq := docs.Item[1].Item[0].Request
		if len(nestedReq.URL.Host) != 1 || nestedReq.URL.Host[0] != "{{dev}}" {
			t.Errorf("expected host [{{dev}}], got %v", nestedReq.URL.Host)
		}
		if nestedReq.URL.Raw != "{{dev}}/users/{{userId}}" {
			t.Errorf("expected raw '{{dev}}/users/{{userId}}', got '%s'", nestedReq.URL.Raw)
		}

		// Verify response original request
		origReq := docs.Item[1].Item[0].Response[0].OriginalRequest
		if len(origReq.URL.Host) != 1 || origReq.URL.Host[0] != "{{dev}}" {
			t.Errorf("expected origReq host [{{dev}}], got %v", origReq.URL.Host)
		}
		if origReq.URL.Raw != "{{dev}}/users/123" {
			t.Errorf("expected origReq raw '{{dev}}/users/123', got '%s'", origReq.URL.Raw)
		}
	})
}

func TestDocsContent_SelectBaseURL(t *testing.T) {
	docs := DocsContent{
		Variable: []CollectionVar{
			{ID: "1", Key: "base_url_prod", Value: "https://prod.api.com", Category: "BASE_URL", IsSelected: true},
			{ID: "2", Key: "base_url_staging", Value: "https://staging.api.com", Category: "BASE_URL", IsSelected: false},
			{ID: "3", Key: "api_key", Value: "secret", Category: ""},
		},
	}

	t.Run("select by value", func(t *testing.T) {
		d := docs
		selected, err := d.SelectBaseURL(SelectBaseURLRequest{Value: "https://staging.api.com"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if selected.ID != "2" || !selected.IsSelected {
			t.Errorf("expected staging to be selected, got %+v", selected)
		}
		if d.Variable[0].IsSelected {
			t.Errorf("expected prod to be unselected, got true")
		}
		if !d.Variable[1].IsSelected {
			t.Errorf("expected staging to be selected in list, got false")
		}
	})

	t.Run("select by key", func(t *testing.T) {
		d := docs
		selected, err := d.SelectBaseURL(SelectBaseURLRequest{Key: "base_url_staging"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if selected.ID != "2" || !selected.IsSelected {
			t.Errorf("expected staging to be selected, got %+v", selected)
		}
	})

	t.Run("select by ID", func(t *testing.T) {
		d := docs
		selected, err := d.SelectBaseURL(SelectBaseURLRequest{ID: "2"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if selected.ID != "2" || !selected.IsSelected {
			t.Errorf("expected staging to be selected, got %+v", selected)
		}
	})

	t.Run("not found returns error", func(t *testing.T) {
		d := docs
		_, err := d.SelectBaseURL(SelectBaseURLRequest{Value: "https://nonexistent.com"})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
	})

	t.Run("non-base-url returns error", func(t *testing.T) {
		d := docs
		_, err := d.SelectBaseURL(SelectBaseURLRequest{ID: "3"})
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
	})
}

func TestUsecase_SelectBaseURL(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "test_collection.json")

	initialDocs := DocsContent{
		Info: CollectionInfo{Name: "Test Collection"},
		Item: []CollectionItem{
			{
				ID:   "req-1",
				Name: "Login Request",
				Request: &Request{
					Method: "POST",
					URL: RequestURL{
						Host: []string{"{{base_url_1}}"},
						Raw:  "{{base_url_1}}/auth/login",
					},
				},
			},
		},
		Variable: []CollectionVar{
			{ID: "1", Key: "base_url_1", Value: "https://api1.com", Category: "BASE_URL", IsSelected: true},
			{ID: "2", Key: "base_url_2", Value: "https://api2.com", Category: "BASE_URL", IsSelected: false},
		},
	}
	bytes, err := json.MarshalIndent(initialDocs, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(collectionPath, bytes, 0644); err != nil {
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

	_, err = usecase.SelectCollection(context.Background(), col.ID)
	if err != nil {
		t.Fatalf("SelectCollection failed: %v", err)
	}

	res, err := usecase.SelectBaseURL(context.Background(), SelectBaseURLRequest{Value: "https://api2.com"})
	if err != nil {
		t.Fatalf("SelectBaseURL returned error: %v", err)
	}

	if res.Variable.ID != "2" || !res.Variable.IsSelected {
		t.Errorf("expected variable 2 to be selected, got %+v", res.Variable)
	}

	// Verify persistence in file
	fileBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatalf("failed to read back file: %v", err)
	}
	var reloaded DocsContent
	if err := json.Unmarshal(fileBytes, &reloaded); err != nil {
		t.Fatalf("failed to parse reloaded file: %v", err)
	}
	if reloaded.Variable[0].IsSelected {
		t.Errorf("expected base_url_1 to be unselected in persisted file")
	}
	if !reloaded.Variable[1].IsSelected {
		t.Errorf("expected base_url_2 to be selected in persisted file")
	}
	if len(reloaded.Item) == 0 || reloaded.Item[0].Request == nil {
		t.Fatalf("expected reloaded item[0].Request to exist")
	}
	if len(reloaded.Item[0].Request.URL.Host) != 1 || reloaded.Item[0].Request.URL.Host[0] != "{{base_url_2}}" {
		t.Errorf("expected persisted host [{{base_url_2}}], got %v", reloaded.Item[0].Request.URL.Host)
	}
	if reloaded.Item[0].Request.URL.Raw != "{{base_url_2}}/auth/login" {
		t.Errorf("expected persisted raw '{{base_url_2}}/auth/login', got '%s'", reloaded.Item[0].Request.URL.Raw)
	}
}
