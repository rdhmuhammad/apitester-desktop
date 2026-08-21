package testsuits

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

type Usecase struct {
	errHandler     localerror.HandleError
	collectionRepo bbolt.RepositoryInterface[domain.Collection]
}

func NewUsecase(lg logger.Logger, collectionRepo bbolt.RepositoryInterface[domain.Collection]) *Usecase {
	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		collectionRepo: collectionRepo,
	}
}

func testsDir(collectionPath string) string {
	return filepath.Join(filepath.Dir(collectionPath), "tests")
}

func validateTestName(name string) error {
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return localerror.InvalidData("Invalid test name")
	}
	return nil
}

func (u *Usecase) ListTests(id string) ([]TestFileInfo, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}

	testsDir := testsDir(collection.Path)
	entries, err := os.ReadDir(testsDir)
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
		filePath := filepath.Join(testsDir, name)
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

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return TestFileContent{}, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return TestFileContent{}, localerror.InvalidData("Collection not found")
	}

	path := filepath.Join(testsDir(collection.Path), name+".http")
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

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	testsDir := testsDir(collection.Path)
	if err := os.MkdirAll(testsDir, 0755); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	content := newHttpParser().serialize(payload.Steps)

	path := filepath.Join(testsDir, name+".http")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}

func (u *Usecase) DeleteTest(id, name string) error {
	if err := validateTestName(name); err != nil {
		return err
	}

	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return localerror.InvalidData("Collection not found")
	}

	path := filepath.Join(testsDir(collection.Path), name+".http")
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return u.errHandler.ErrorReturn(err)
	}

	return nil
}
