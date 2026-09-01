package api

import (
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/internal/usecase/automation"
	"github.com/rdhmuhammad/apitester/internal/usecase/environment"
	"github.com/rdhmuhammad/apitester/internal/usecase/testsuits"
	"github.com/rdhmuhammad/apitester/internal/usecase/watch"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/middleware"
)

func Default() *Api {
	server := gin.Default()
	server.Use(middleware.AllowCORS())

	api := Api{
		server: server,
	}

	builder := logger.DefaultLogger()
	if p := os.Getenv("LOG_PATH"); p != "" {
		builder = builder.LogFile(p)
	}
	lg := builder.Build()
	collectionRepo, testSuiteRepo, automationRepo := initRepositories()

	routers := []Router{
		watch.NewController(&lg, collectionRepo, testSuiteRepo, automationRepo),
		environment.NewController(&lg, collectionRepo),
		testsuits.NewController(&lg, testSuiteRepo),
		automation.NewController(&lg, automationRepo),
	}

	api.routers = routers

	return &api
}

func initRepositories() (bbolt.RepositoryInterface[domain.Collection], bbolt.RepositoryInterface[domain.TestSuite], bbolt.RepositoryInterface[domain.Automation]) {
	dbPath := collectionDBPath()
	boltDB, err := bbolt.NewBoltDB(dbPath)
	if err != nil {
		panic(err)
	}

	collectionRepo, err := bbolt.NewRepository[domain.Collection](boltDB.DB())
	if err != nil {
		panic(err)
	}

	testSuiteRepo, err := bbolt.NewRepository[domain.TestSuite](boltDB.DB(), bbolt.WithBucketName("TestSuite"))
	if err != nil {
		panic(err)
	}
	automationRepo, err := bbolt.NewRepository[domain.Automation](boltDB.DB(), bbolt.WithBucketName("Automation"))
	if err != nil {
		panic(err)
	}
	return collectionRepo, testSuiteRepo, automationRepo
}

func collectionDBPath() string {
	if p := os.Getenv("BOLT_DB_PATH"); p != "" {
		return p
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "resource/db/collection.db"
	}
	return filepath.Join(configDir, "apitester", "collection.db")
}
