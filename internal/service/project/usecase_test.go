package project

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func TestCreateListUpdateDeleteProject(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	projectDir := filepath.Join(tempDir, "my-project")
	subDir := filepath.Join(projectDir, "nested")
	ignoredDir := filepath.Join(projectDir, "node_modules")

	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(ignoredDir, 0755); err != nil {
		t.Fatal(err)
	}

	validCol1 := collectionService.NewDefaultDocsContent("Auth API")
	validCol1Bytes, _ := json.MarshalIndent(validCol1, "", "  ")
	if err := os.WriteFile(filepath.Join(projectDir, "auth.json"), validCol1Bytes, 0644); err != nil {
		t.Fatal(err)
	}

	validCol2 := collectionService.NewDefaultDocsContent("Billing API")
	validCol2Bytes, _ := json.MarshalIndent(validCol2, "", "  ")
	if err := os.WriteFile(filepath.Join(subDir, "billing.json"), validCol2Bytes, 0644); err != nil {
		t.Fatal(err)
	}

	// Non-collection JSON (should be ignored)
	if err := os.WriteFile(filepath.Join(projectDir, "package.json"), []byte(`{"name":"pkg","version":"1.0.0"}`), 0644); err != nil {
		t.Fatal(err)
	}
	// Valid collection inside node_modules (should be ignored)
	if err := os.WriteFile(filepath.Join(ignoredDir, "ignored.json"), validCol1Bytes, 0644); err != nil {
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
	uc := NewUsecase(&lg, boltDB.DB())

	created, err := uc.CreateProject(context.Background(), CreateProjectRequest{
		Name: "My Workspace",
		Path: projectDir,
	})
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}
	if len(created.Collections) != 2 {
		t.Fatalf("expected 2 discovered collections, got %d", len(created.Collections))
	}

	listed, err := uc.ListProjects(context.Background())
	if err != nil {
		t.Fatalf("ListProjects failed: %v", err)
	}
	if len(listed) != 1 || len(listed[0].Collections) != 2 {
		t.Fatalf("unexpected listed projects: %+v", listed)
	}

	if err := uc.DeleteProject(context.Background(), created.ID); err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}

	afterDelete, err := uc.ListProjects(context.Background())
	if err != nil {
		t.Fatalf("ListProjects after delete failed: %v", err)
	}
	if len(afterDelete) != 0 {
		t.Fatalf("expected 0 projects after delete, got %d", len(afterDelete))
	}
}
