package main

import (
	"flag"

	"github.com/joho/godotenv"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/collection"
	docctrl "github.com/rdhmuhammad/apitester/internal/adapter/controller/documentation"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/environment"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/project"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/restrequest"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/testsuits"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/tree"
	collectionSocket "github.com/rdhmuhammad/apitester/internal/adapter/socket/collection"
	documentationSocket "github.com/rdhmuhammad/apitester/internal/adapter/socket/documentation"
	requestSocket "github.com/rdhmuhammad/apitester/internal/adapter/socket/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/elog"
	"github.com/rdhmuhammad/apitester/shared/api"
)

func main() {
	var envFile string
	flag.StringVar(&envFile, "env", ".env.stag", "Provide env file path")
	flag.Parse()

	_ = elog.Init("Apitester-backend")
	defer elog.Close()

	err := godotenv.Load(envFile)
	if err != nil {
		elog.Panicf(elog.EIDFileNotFound, "failed to load env file '%s': %v", envFile, err)
	}

	start := api.Default()
	start.Register(func(conn api.Conns) []api.Router {
		return []api.Router{
			project.NewController(conn.Logger, conn.DB),
			collection.NewController(conn.Logger, conn.DB),
			tree.NewController(conn.Logger, conn.DB),
			restrequest.NewController(conn.Logger, conn.DB),
			environment.NewController(conn.Logger, conn.DB),
			testsuits.NewController(conn.Logger, conn.DB),
			docctrl.NewController(conn.Logger, conn.DB),
		}
	})
	start.RegisterSocket(func(conn api.Conns) []api.Namespace {
		return []api.Namespace{
			collectionSocket.NewCollectionSocket(conn.Logger, conn.DB),
			requestSocket.NewRestRequestSocket(conn.Logger, conn.DB),
			documentationSocket.NewDocumentationSocket(conn.Logger, conn.DB),
		}
	})

	err = start.Start()
	if err != nil {
		elog.Panicf(elog.EIDGenericError, "API start failed: %v", err)
	}
}
