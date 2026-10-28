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

func TestListCollections_RescanDiscoversNewCollectionsAndCleansUp(t *testing.T) {
	t.Setenv("LOG_LEVEL", "disabled")
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	boltDB, err := db.NewBoltDB(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = boltDB.Close()
	})

	lg := logger.DefaultLogger().Build()
	usecase := NewUsecase(&lg, boltDB.DB())

	project := domain.Project{
		ID:         "proj-rescan",
		Name:       "Rescan Project",
		Path:       tempDir,
		IsSelected: true,
	}
	if err := usecase.projectRepo.Create(context.Background(), project.ID, &project); err != nil {
		t.Fatal(err)
	}

	// 1. Initially no collections on disk
	cols, err := usecase.ListCollections(context.Background())
	if err != nil {
		t.Fatalf("ListCollections failed: %v", err)
	}
	if len(cols) != 0 {
		t.Fatalf("expected 0 collections, got %d", len(cols))
	}

	// 2. Add two valid collection JSON files along the way (one at root, one in subfolder)
	col1Path := filepath.Join(tempDir, "Users.json")
	docs1 := NewDefaultDocsContent("Users API")
	b1, _ := json.Marshal(docs1)
	if err := os.WriteFile(col1Path, b1, 0644); err != nil {
		t.Fatal(err)
	}

	subDir := filepath.Join(tempDir, "services")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	col2Path := filepath.Join(subDir, "Orders.json")
	docs2 := NewDefaultDocsContent("Orders API")
	b2, _ := json.Marshal(docs2)
	if err := os.WriteFile(col2Path, b2, 0644); err != nil {
		t.Fatal(err)
	}

	// Add files that should be ignored: invalid json, git, node_modules
	gitDir := filepath.Join(tempDir, ".git")
	_ = os.MkdirAll(gitDir, 0755)
	_ = os.WriteFile(filepath.Join(gitDir, "ignored.json"), b1, 0644)

	nodeDir := filepath.Join(tempDir, "node_modules")
	_ = os.MkdirAll(nodeDir, 0755)
	_ = os.WriteFile(filepath.Join(nodeDir, "package.json"), b1, 0644)

	invalidPath := filepath.Join(tempDir, "random.json")
	_ = os.WriteFile(invalidPath, []byte(`{"not_a_collection": true}`), 0644)

	// Call ListCollections - should re-scan and discover Users and Orders only
	cols, err = usecase.ListCollections(context.Background())
	if err != nil {
		t.Fatalf("ListCollections after adding files failed: %v", err)
	}
	if len(cols) != 2 {
		t.Fatalf("expected 2 collections, got %d", len(cols))
	}

	// Verify persistence in DB
	allDb, err := usecase.CollectionRepo.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(allDb) != 2 {
		t.Fatalf("expected 2 collections in DB, got %d", len(allDb))
	}

	// 3. Select one collection and verify its selection is preserved across re-scans
	selectedID := cols[0].ID
	_, err = usecase.SelectCollection(context.Background(), selectedID)
	if err != nil {
		t.Fatalf("SelectCollection failed: %v", err)
	}

	colsAfterSelect, err := usecase.ListCollections(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var foundSelected bool
	for _, c := range colsAfterSelect {
		if c.ID == selectedID && c.IsSelected {
			foundSelected = true
		}
	}
	if !foundSelected {
		t.Fatalf("expected collection %s to remain selected after rescan", selectedID)
	}

	// 4. Delete one file from disk and verify it is cleaned up on next ListCollections
	if err := os.Remove(col2Path); err != nil {
		t.Fatal(err)
	}

	colsAfterDelete, err := usecase.ListCollections(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(colsAfterDelete) != 1 {
		t.Fatalf("expected 1 collection after deleting one file, got %d", len(colsAfterDelete))
	}
	if colsAfterDelete[0].Path != col1Path {
		t.Fatalf("expected remaining collection path to be %q, got %q", col1Path, colsAfterDelete[0].Path)
	}

	// Verify DB also cleaned it up
	dbCols, _ := usecase.CollectionRepo.List(context.Background())
	if len(dbCols) != 1 {
		t.Fatalf("expected 1 collection in DB after deletion, got %d", len(dbCols))
	}
}
