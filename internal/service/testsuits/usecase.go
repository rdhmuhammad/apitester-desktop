package testsuits

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
)

type Usecase struct {
	errHandler    localerror.HandleError
	testSuiteRepo db.RepositoryInterface[domain.TestSuite]
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	testSuiteRepo, err := db.NewRepository[domain.TestSuite](database, db.WithBucketName("TestSuite"))
	if err != nil {
		panic(err)
	}

	return &Usecase{
		errHandler:    localerror.NewHandlerError(lg),
		testSuiteRepo: testSuiteRepo,
	}
}

func (u *Usecase) module(id string) (*domain.TestSuite, error) {
	module, err := u.testSuiteRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if module == nil {
		return nil, localerror.InvalidData("Test suite not found")
	}
	return module, nil
}

func validateTestName(name string) error {
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return localerror.InvalidData("Invalid test name")
	}
	return nil
}

func (u *Usecase) ListTests(id string) ([]TestFileInfo, error) {
	module, err := u.module(id)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(module.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return []TestFileInfo{}, nil
		}
		return nil, u.errHandler.ErrorReturn(err)
	}

	var result []TestFileInfo
	parser := newHttpParser()
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".http") {
			continue
		}
		base := strings.TrimSuffix(name, ".http")

		totalSteps := 0
		filePath := filepath.Join(module.Path, name)
		if content, err := os.ReadFile(filePath); err == nil {
			steps := parser.parse(string(content))
			totalSteps = len(steps)
		}

		result = append(result, TestFileInfo{
			Name:       base,
			Filename:   name,
			TotalSteps: totalSteps,
		})
	}
	if result == nil {
		result = []TestFileInfo{}
	}
	return result, nil
}

func (u *Usecase) ReadTest(id, name string) (TestFileContent, error) {
	if err := validateTestName(name); err != nil {
		return TestFileContent{}, err
	}

	module, err := u.module(id)
	if err != nil {
		return TestFileContent{}, err
	}
	path := filepath.Join(module.Path, name+".http")
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return TestFileContent{}, localerror.InvalidData("Test file not found")
		}
		return TestFileContent{}, u.errHandler.ErrorReturn(err)
	}

	parser := newHttpParser()
	steps := parser.parse(string(content))

	return TestFileContent{
		Name:  name,
		Steps: steps,
	}, nil
}

func (u *Usecase) WriteTest(id, name string, payload TestFileContent) error {
	if err := validateTestName(name); err != nil {
		return err
	}
	if len(payload.Steps) == 0 {
		return localerror.InvalidData("Test steps are required")
	}

	module, err := u.module(id)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(module.Path, 0755); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	content := newHttpParser().serialize(payload.Steps)

	path := filepath.Join(module.Path, name+".http")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}

func (u *Usecase) DeleteTest(id, name string) error {
	if err := validateTestName(name); err != nil {
		return err
	}

	module, err := u.module(id)
	if err != nil {
		return err
	}
	path := filepath.Join(module.Path, name+".http")
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}
