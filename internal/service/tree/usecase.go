package tree

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
)

type Usecase struct {
	errHandler     localerror.HandleError
	collectionRepo db.RepositoryInterface[domain.Collection]
	automationRepo db.RepositoryInterface[domain.Automation]
	testRepo       db.RepositoryInterface[domain.TestSuite]
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	collectionRepo, err := db.NewRepository[domain.Collection](database)
	if err != nil {
		panic(err)
	}
	automationRepo, err := db.NewRepository[domain.Automation](database)
	if err != nil {
		panic(err)
	}

	testRepo, err := db.NewRepository[domain.TestSuite](database)
	if err != nil {
		panic(err)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		collectionRepo: collectionRepo,
		automationRepo: automationRepo,
		testRepo:       testRepo,
	}
}

func (u *Usecase) GetRequestTree(collectionID string) ([]RequestTree, error) {
	collection, err := u.collection(collectionID)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(collection.Path)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}

	var docs collectionService.DocsContent
	if err := json.Unmarshal([]byte(strings.TrimPrefix(string(content), "\uFEFF")), &docs); err != nil {
		return nil, localerror.InvalidData("Invalid collection.json file")
	}

	return buildRequestTree(docs.Item), nil
}

func (u *Usecase) GetAutomationTree(collectionID string) ([]RequestTree, error) {
	collection, err := u.collection(collectionID)
	if err != nil {
		return nil, err
	}
	module, err := u.automationRepo.View(context.Background(), collection.AutomationID)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if module == nil {
		return nil, localerror.InvalidData("Automation module not found")
	}

	return buildFileTree(module.Path, "AUTOMATION", func(name string) bool {
		return strings.HasSuffix(name, ".yml") || strings.HasSuffix(name, ".yaml")
	}, u.errHandler)
}

func (u *Usecase) GetTestSuiteTree(collectionID string) ([]RequestTree, error) {
	collection, err := u.collection(collectionID)
	if err != nil {
		return nil, err
	}
	module, err := u.testRepo.View(context.Background(), collection.TestSuiteID)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if module == nil {
		return nil, localerror.InvalidData("Test suite not found")
	}

	return buildFileTree(module.Path, "TESTSUITE", func(name string) bool {
		return strings.HasSuffix(name, ".http")
	}, u.errHandler)
}

func (u *Usecase) collection(id string) (*domain.Collection, error) {
	collection, err := u.collectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.errHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, localerror.InvalidData("Collection not found")
	}
	return collection, nil
}

func buildFileTree(path, category string, supported func(string) bool, errHandler localerror.HandleError) ([]RequestTree, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []RequestTree{}, nil
		}
		return nil, errHandler.ErrorReturn(err)
	}
	if len(entries) == 0 {
		return []RequestTree{}, nil
	}

	tree := make([]RequestTree, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !supported(entry.Name()) {
			continue
		}
		name := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		tree = append(tree, RequestTree{
			ID:       entry.Name(),
			Name:     name,
			IsActive: false,
			Category: category,
		})
	}
	return tree, nil
}

func buildRequestTree(items []collectionService.CollectionItem) []RequestTree {
	tree := make([]RequestTree, 0, len(items))
	for _, item := range items {
		id := item.ID
		if id == "" {
			id = uuid.NewString()
		}

		node := RequestTree{
			ID:       id,
			Name:     item.Name,
			IsActive: false,
			Category: "REQ",
		}
		if item.Request != nil {
			node.Method = strings.ToUpper(item.Request.Method)
		}
		if len(item.Item) > 0 {
			node.Category = "FOLD"
			node.Item = buildRequestTree(item.Item)
		}
		tree = append(tree, node)
	}
	return tree
}
