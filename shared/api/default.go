package api

import (
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	automationController "github.com/rdhmuhammad/apitester/internal/adapter/controller/automation"
	collectionController "github.com/rdhmuhammad/apitester/internal/adapter/controller/collection"
	environmentController "github.com/rdhmuhammad/apitester/internal/adapter/controller/environment"
	restrequestController "github.com/rdhmuhammad/apitester/internal/adapter/controller/restrequest"
	testsuitsController "github.com/rdhmuhammad/apitester/internal/adapter/controller/testsuits"
	treeController "github.com/rdhmuhammad/apitester/internal/adapter/controller/tree"
	"github.com/rdhmuhammad/apitester/pkg/db"
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
	boltDB, err := db.NewBoltDB(collectionDBPath())
	if err != nil {
		panic(err)
	}

	routers := []Router{
		collectionController.NewController(&lg, boltDB.DB()),
		treeController.NewController(&lg, boltDB.DB()),
		restrequestController.NewController(&lg, boltDB.DB()),
		environmentController.NewController(&lg, boltDB.DB()),
		testsuitsController.NewController(&lg, boltDB.DB()),
		automationController.NewController(&lg, boltDB.DB()),
	}

	api.routers = routers

	return &api
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
