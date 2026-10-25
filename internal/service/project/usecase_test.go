package project

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
	ctx := context.Background()

	created, err := uc.OpenProject(ctx, OpenProjectRequest{Path: projectDir})
	if err != nil {
		t.Fatalf("OpenProject failed: %v", err)
	}
	if created.Name != "my-project" || !created.IsSelected {
		t.Fatalf("expected selected project named after folder, got %+v", created)
	}
	if cols := projectCollections(t, uc, created.ID); len(cols) != 2 {
		t.Fatalf("expected 2 discovered collections, got %d", len(cols))
	}

	// Opening the same folder again must reuse the existing project
	reopened, err := uc.OpenProject(ctx, OpenProjectRequest{Path: projectDir + string(filepath.Separator)})
	if err != nil {
		t.Fatalf("re-OpenProject failed: %v", err)
	}
	if reopened.ID != created.ID {
		t.Fatalf("expected reopen to reuse project %s, got %s", created.ID, reopened.ID)
	}

	listed, err := uc.ListProjects(ctx)
	if err != nil {
		t.Fatalf("ListProjects failed: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("unexpected listed projects: %+v", listed)
	}

	if err := uc.DeleteProject(ctx, created.ID); err != nil {
		t.Fatalf("DeleteProject failed: %v", err)
	}

	afterDelete, err := uc.ListProjects(ctx)
	if err != nil {
		t.Fatalf("ListProjects after delete failed: %v", err)
	}
	if len(afterDelete) != 0 {
		t.Fatalf("expected 0 projects after delete, got %d", len(afterDelete))
	}
}

func TestSelectProjectClearsForeignCollection(t *testing.T) {
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
	uc := NewUsecase(&lg, boltDB.DB())
	ctx := context.Background()

	projA := domain.Project{ID: "proj-a", Name: "A", Path: tempDir, IsSelected: true}
	projB := domain.Project{ID: "proj-b", Name: "B", Path: tempDir}
	colA := domain.Collection{ID: "col-a", ProjectID: projA.ID, IsSelected: true}
	for _, p := range []domain.Project{projA, projB} {
		if err := uc.projectRepo.Create(ctx, p.ID, &p); err != nil {
			t.Fatal(err)
		}
	}
	if err := uc.collectionRepo.Create(ctx, colA.ID, &colA); err != nil {
		t.Fatal(err)
	}

	// Re-selecting the active project keeps its collection
	if _, err := uc.SelectProject(ctx, projA.ID); err != nil {
		t.Fatalf("SelectProject A failed: %v", err)
	}
	if got, _ := uc.collectionRepo.View(ctx, colA.ID); got == nil || !got.IsSelected {
		t.Fatalf("expected collection to stay selected when re-selecting same project")
	}

	// Switching project clears the collection and flips project selection
	if _, err := uc.SelectProject(ctx, projB.ID); err != nil {
		t.Fatalf("SelectProject B failed: %v", err)
	}
	if got, _ := uc.collectionRepo.View(ctx, colA.ID); got == nil || got.IsSelected {
		t.Fatalf("expected collection to be cleared after switching project")
	}
	if got, _ := uc.projectRepo.View(ctx, projA.ID); got == nil || got.IsSelected {
		t.Fatalf("expected project A to be deselected")
	}
	if got, _ := uc.projectRepo.View(ctx, projB.ID); got == nil || !got.IsSelected {
		t.Fatalf("expected project B to be selected")
	}
}

func projectCollections(t *testing.T, uc *Usecase, projectID string) []domain.Collection {
	t.Helper()
	all, err := uc.collectionRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	result := make([]domain.Collection, 0)
	for _, c := range all {
		if c.ProjectID == projectID {
			result = append(result, c)
		}
	}
	return result
}
