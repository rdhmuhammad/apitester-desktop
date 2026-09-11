package api

import (
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/middleware"
)

func Default() *Api {
	server := gin.Default()
	server.Use(middleware.AllowCORS())

	builder := logger.DefaultLogger()
	if p := os.Getenv("LOG_PATH"); p != "" {
		builder = builder.LogFile(p)
	}
	lg := builder.Build()
	boltDB, err := db.NewBoltDB(collectionDBPath())
	if err != nil {
		panic(err)
	}

	api := Api{
		server: server,
		socket: cio.New(server),
		db:     boltDB.DB(),
		logger: &lg,
	}

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
