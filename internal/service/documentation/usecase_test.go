package doc

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func setupTestDocUsecase(t *testing.T) (*Usecase, string) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	boltDB, err := db.NewBoltDB(dbPath)
	if err != nil {
		t.Fatalf("failed to create bolt db: %v", err)
	}
	t.Cleanup(func() {
		_ = boltDB.DB().Close()
	})

	lg := logger.DefaultLogger().Build()
	uc := NewUsecase(&lg, boltDB.DB())

	projRoot := t.TempDir()
	proj := domain.Project{
		ID:         "proj-1",
		Name:       "Test Project",
		Path:       projRoot,
		IsSelected: true,
	}
	if err := uc.projectRepo.Create(context.Background(), proj.ID, &proj); err != nil {
		t.Fatalf("failed to seed project: %v", err)
	}

	return uc, projRoot
}

func TestDocumentationUsecaseFlow(t *testing.T) {
	uc, projRoot := setupTestDocUsecase(t)
	ctx := context.Background()

	// 1. Create document at root
	created, err := uc.CreateDocument(ctx, CreateDocumentRequest{})
	if err != nil {
		t.Fatalf("CreateDocument failed: %v", err)
	}
	if created.ID != "Untitled.md" || created.Name != "Untitled" {
		t.Fatalf("unexpected created document: %+v", created)
	}

	// 2. Create folder and HTML file
	folder, err := uc.CreateFolder(ctx, CreateFolderRequest{Name: "docs"})
	if err != nil {
		t.Fatalf("CreateFolder failed: %v", err)
	}
	if folder.ID != "docs" || folder.Category != "FOLD" {
		t.Fatalf("unexpected created folder: %+v", folder)
	}
	if err := os.WriteFile(filepath.Join(projRoot, "index.html"), []byte("<h1>Hello</h1>"), 0644); err != nil {
		t.Fatalf("failed to write html: %v", err)
	}

	// 3. Get tree (shows folder, .md, .html)
	tree, err := uc.GetTree(ctx)
	if err != nil {
		t.Fatalf("GetTree failed: %v", err)
	}
	if len(tree) != 3 {
		t.Fatalf("expected 3 items in tree, got %d: %+v", len(tree), tree)
	}

	// 4. Edit content via startPos + lenght
	edited, err := uc.EditContent(ctx, EditDocumentContentRequest{
		ID:       created.ID,
		Content:  "**Bold Idea**",
		StartPos: 2,
		Lenght:   8,
	})
	if err != nil {
		t.Fatalf("EditContent failed: %v", err)
	}
	if edited.Content != "# **Bold Idea**\n" {
		t.Fatalf("expected '# **Bold Idea**\\n', got %q", edited.Content)
	}

	// 5. Rename document
	renamed, err := uc.RenameDocument(ctx, RenameDocumentRequest{
		ID:   created.ID,
		Name: "Architecture",
	})
	if err != nil {
		t.Fatalf("RenameDocument failed: %v", err)
	}
	if renamed.ID != "Architecture.md" || renamed.Name != "Architecture" {
		t.Fatalf("unexpected renamed doc: %+v", renamed)
	}

	// 6. Move .md file into docs folder
	moved, err := uc.MoveDocument(ctx, MoveDocumentRequest{
		ID:             renamed.ID,
		TargetFolderID: "docs",
	})
	if err != nil {
		t.Fatalf("MoveDocument failed: %v", err)
	}
	if moved.ID != "docs/Architecture.md" {
		t.Fatalf("expected 'docs/Architecture.md', got %q", moved.ID)
	}

	// 7. Reject moving a folder
	if _, err := uc.MoveDocument(ctx, MoveDocumentRequest{
		ID:             "docs",
		TargetFolderID: "",
	}); err == nil {
		t.Fatalf("expected moving a folder to be rejected")
	}

	// 8. Delete item
	if err := uc.DeleteItem(ctx, moved.ID); err != nil {
		t.Fatalf("DeleteItem failed: %v", err)
	}
	if _, err := os.Stat(moved.Path); !os.IsNotExist(err) {
		t.Fatalf("expected file to be deleted from disk")
	}
}
