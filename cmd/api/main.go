package main

import (
	"flag"
	"log"

	"github.com/joho/godotenv"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/automation"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/collection"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/environment"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/restrequest"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/testsuits"
	"github.com/rdhmuhammad/apitester/internal/adapter/controller/tree"
	requestSocket "github.com/rdhmuhammad/apitester/internal/adapter/socket/restrequest"
	"github.com/rdhmuhammad/apitester/shared/api"
)

func main() {
	var envFile string
	flag.StringVar(&envFile, "env", ".env.stag", "Provide env file path")
	flag.Parse()
	err := godotenv.Load(envFile)
	if err != nil {
		log.Println(err)
		panic(err)

	}

	start := api.Default()
	start.Register(func(conn api.Conns) []api.Router {
		return []api.Router{
			collection.NewController(conn.Logger, conn.DB),
			tree.NewController(conn.Logger, conn.DB),
			restrequest.NewController(conn.Logger, conn.DB),
			environment.NewController(conn.Logger, conn.DB),
			testsuits.NewController(conn.Logger, conn.DB),
			automation.NewController(conn.Logger, conn.DB),
		}
	})
	start.RegisterSocket(func(conn api.Conns) []api.Namespace {
		return []api.Namespace{
			requestSocket.NewRestRequestSocket(conn.Logger, conn.DB),
		}
	})

	err = start.Start()
	if err != nil {
		panic(err)
	}
}
