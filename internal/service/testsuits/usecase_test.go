package testsuits

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
)

func TestModulePathIsUsedForTestFiles(t *testing.T) {
	boltDB, err := db.NewBoltDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer boltDB.Close()
	repo, err := db.NewRepository[domain.TestSuite](boltDB.DB())
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "tests")
	module := domain.TestSuite{ID: "suite-id", Path: path}
	if err := repo.Create(context.Background(), module.ID, &module); err != nil {
		t.Fatal(err)
	}

	u := &Usecase{testSuiteRepo: repo}
	if err := u.WriteTest(module.ID, "scenario", TestFileContent{
		Name:  "scenario",
		Steps: []TestStep{{Name: "request", Method: "GET", URL: "http://localhost"}},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := u.ReadTest(module.ID, "scenario"); err != nil {
		t.Fatal(err)
	}
}
