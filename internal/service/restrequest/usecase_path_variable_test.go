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

func newPathVariableUsecase(t *testing.T) (*Usecase, string) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	collectionPath := filepath.Join(tempDir, "collection.json")

	docs := collectionService.DocsContent{
		Item: []collectionService.CollectionItem{{
			ID:      "request-id",
			Name:    "Test Request",
			Request: &collectionService.Request{Method: "GET"},
		}},
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
	t.Cleanup(func() { boltDB.Close() })

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())
	collection := domain.Collection{ID: "collection-id", Path: collectionPath}
	if err := usecase.CollectionRepo.Create(context.Background(), collection.ID, &collection); err != nil {
		t.Fatal(err)
	}
	return usecase, collection.ID
}

func TestUpdateURLSyncsPathVariables(t *testing.T) {
	usecase, collectionID := newPathVariableUsecase(t)
	ctx := context.Background()

	updateURL := func(raw string) RequestResponse {
		res, err := usecase.UpdateURL(ctx, collectionID, "request-id", UpdateURLRequest{
			URL: collectionService.RequestURL{Raw: raw},
		})
		if err != nil {
			t.Fatalf("UpdateURL(%q) error = %v", raw, err)
		}
		return res
	}
	keys := func(res RequestResponse) []string {
		out := []string{}
		for _, v := range res.URL.Variable {
			out = append(out, v.Key)
		}
		return out
	}

	res := updateURL("/api/v1/user/:userId/post/:postId/:userId?x=:notVar")
	if got := keys(res); len(got) != 2 || got[0] != "userId" || got[1] != "postId" {
		t.Fatalf("expected [userId postId] (deduped), got %v", got)
	}

	if _, err := usecase.EditPathVariable(ctx, collectionID, "request-id", EditPathVariableRequest{Key: "userId", Value: "42"}); err != nil {
		t.Fatalf("EditPathVariable() error = %v", err)
	}
	if _, err := usecase.EditPathVariable(ctx, collectionID, "request-id", EditPathVariableRequest{Key: "missing", Value: "1"}); err == nil {
		t.Fatal("expected error for unknown path variable key")
	}

	res = updateURL("/api/v1/user/:userId/:orderId")
	if got := keys(res); len(got) != 2 || got[0] != "userId" || got[1] != "orderId" {
		t.Fatalf("expected [userId orderId] (postId removed, orderId added), got %v", got)
	}
	if res.URL.Variable[0].Value != "42" {
		t.Fatalf("expected userId value to be kept, got %q", res.URL.Variable[0].Value)
	}

	res = updateURL("/api/v1/user")
	if len(res.URL.Variable) != 0 {
		t.Fatalf("expected no variables, got %v", res.URL.Variable)
	}
}
