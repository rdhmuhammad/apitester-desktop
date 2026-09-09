package automation

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
)

func TestModulePathIsUsedForAutomationFiles(t *testing.T) {
	boltDB, err := db.NewBoltDB(filepath.Join(t.TempDir(), "automation.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer boltDB.Close()
	repo, err := db.NewRepository[domain.Automation](boltDB.DB())
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "automation")
	module := domain.Automation{ID: "automation-id", Path: path}
	if err := repo.Create(context.Background(), module.ID, &module); err != nil {
		t.Fatal(err)
	}

	u := &Usecase{automationRepo: repo}
	if err := u.WriteAutomation(module.ID, "deploy.yml", AutomationFileContent{Content: "- hosts: all\n"}); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(path, "deploy.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "- hosts: all\n" {
		t.Fatalf("content = %q", content)
	}
}
