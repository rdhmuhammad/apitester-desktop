package tree

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/rdhmuhammad/apitester/internal/domain"
	collectionService "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/shared/base"
	"go.etcd.io/bbolt"
)

type Usecase struct {
	*base.Port
	testRepo db.RepositoryInterface[domain.TestSuite]
}

func NewUsecase(lg logger.Logger, database *bbolt.DB) *Usecase {
	testRepo, err := db.NewRepository[domain.TestSuite](database)
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "failed to initialize test suite repo for tree usecase: %v", err)
	}

	return &Usecase{
		Port:     base.NewPort(lg, database),
		testRepo: testRepo,
	}
}

func (u *Usecase) GetRequestTree(ctx context.Context) ([]RequestTree, error) {
	collection := u.FindSelectedCollection(ctx)
	content, err := os.ReadFile(collection.Path)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}

	var docs collectionService.DocsContent
	if err := json.Unmarshal([]byte(strings.TrimPrefix(string(content), "\uFEFF")), &docs); err != nil {
		return nil, localerror.InvalidData("Invalid collection.json file")
	}

	return buildRequestTree(docs.Item), nil
}

func (u *Usecase) GetTestSuiteTree(collectionID string) ([]RequestTree, error) {
	collection, err := u.collection(collectionID)
	if err != nil {
		return nil, err
	}
	module, err := u.testRepo.View(context.Background(), collection.TestSuiteID)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
	}
	if module == nil {
		return nil, localerror.InvalidData("Test suite not found")
	}

	return buildFileTree(module.Path, "TESTSUITE", func(name string) bool {
		return strings.HasSuffix(name, ".http")
	}, u.ErrHandler)
}

func (u *Usecase) collection(id string) (*domain.Collection, error) {
	if strings.TrimSpace(id) == "" {
		selected := base.FindSelectedCollection(context.Background(), u.CollectionRepo)
		if selected == nil {
			return nil, localerror.InvalidData("No active collection")
		}
		return selected, nil
	}
	collection, err := u.CollectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, u.ErrHandler.ErrorReturn(err)
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
		node := RequestTree{
			ID:       item.ID,
			Name:     item.Name,
			IsActive: false,
			Category: "REQ",
		}
		if item.Request != nil {
			node.Method = strings.ToUpper(item.Request.Method)
		}
		if item.Request == nil || len(item.Item) > 0 {
			node.Category = "FOLD"
			node.Item = buildRequestTree(item.Item)
		}
		tree = append(tree, node)
	}
	return tree
}
