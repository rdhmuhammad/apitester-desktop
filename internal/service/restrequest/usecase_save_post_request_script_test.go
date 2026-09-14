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

func TestSavePostRequestScript(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")
	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{
			{
				ID:   "request-id",
				Name: "Get Users",
				Request: &collectionService.Request{
					Method: "GET",
					URL: collectionService.RequestURL{
						Raw: "https://api.example.com/users",
					},
				},
				Event: []collectionService.CollectionEvent{},
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

	// 1. Save new post request script when item has no events
	req1 := SavePostRequestScriptRequest{
		Exec: []string{"console.log('response received');", "pm.test('Status is 200', function() { pm.response.to.have.status(200); });"},
		Type: "text/javascript",
	}

	res, err := usecase.SavePostRequestScript(collection.ID, "request-id", req1)
	if err != nil {
		t.Fatalf("SavePostRequestScript() error = %v", err)
	}
	expectedScript := "console.log('response received');\npm.test('Status is 200', function() { pm.response.to.have.status(200); });"
	if res.Script != expectedScript {
		t.Fatalf("res.Script = %q, want %q", res.Script, expectedScript)
	}

	// Verify file on disk
	fileBytes, err := os.ReadFile(collectionPath)
	if err != nil {
		t.Fatal(err)
	}
	var savedDocs collectionService.DocsContent
	if err := json.Unmarshal(fileBytes, &savedDocs); err != nil {
		t.Fatal(err)
	}
	if len(savedDocs.Item) != 1 || len(savedDocs.Item[0].Event) != 1 {
		t.Fatalf("savedDocs.Item[0].Event count = %d, want 1", len(savedDocs.Item[0].Event))
	}
	savedEvent := savedDocs.Item[0].Event[0]
	if savedEvent.Listen != "test" {
		t.Fatalf("savedEvent.Listen = %q, want 'test'", savedEvent.Listen)
	}
	if savedEvent.Script.Type != "text/javascript" {
		t.Fatalf("savedEvent.Script.Type = %q, want 'text/javascript'", savedEvent.Script.Type)
	}
	if len(savedEvent.Script.Exec) != 2 {
		t.Fatalf("savedEvent.Script.Exec len = %d, want 2", len(savedEvent.Script.Exec))
	}

	// Verify collection history
	histories, err := usecase.HistoryRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(histories) != 1 {
		t.Fatalf("histories count = %d, want 1", len(histories))
	}
	if histories[0].Operation != "save_post_request_script" || histories[0].Field != "event.script" {
		t.Fatalf("history = %#v, want op=save_post_request_script, field=event.script", histories[0])
	}

	// 2. Update existing post request script using Script string field and SaveScript alias
	req2 := SavePostRequestScriptRequest{
		Script: "pm.test('Status is 200', () => {});\npm.expect(pm.response.code).to.eql(200);",
	}

	res2, err := usecase.SaveScript(collection.ID, "request-id", req2)
	if err != nil {
		t.Fatalf("SaveScript() error = %v", err)
	}
	if res2.Script != req2.Script {
		t.Fatalf("res2.Script = %q, want %q", res2.Script, req2.Script)
	}

	fileBytes2, _ := os.ReadFile(collectionPath)
	var savedDocs2 collectionService.DocsContent
	_ = json.Unmarshal(fileBytes2, &savedDocs2)
	if len(savedDocs2.Item[0].Event) != 1 {
		t.Fatalf("savedDocs2.Item[0].Event count = %d, want 1 (should update, not duplicate)", len(savedDocs2.Item[0].Event))
	}
	if savedDocs2.Item[0].Event[0].Listen != "test" {
		t.Fatalf("savedDocs2 event listen = %q, want 'test'", savedDocs2.Item[0].Event[0].Listen)
	}
	if savedDocs2.Item[0].Event[0].Script.Type != "text/javascript" {
		t.Fatalf("savedDocs2 script type = %q, want 'text/javascript'", savedDocs2.Item[0].Event[0].Script.Type)
	}
	if len(savedDocs2.Item[0].Event[0].Script.Exec) != 2 {
		t.Fatalf("savedDocs2 script exec len = %d, want 2 lines", len(savedDocs2.Item[0].Event[0].Script.Exec))
	}
}
