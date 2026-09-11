package api

import (
	"context"
	"errors"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
)

type Api struct {
	server     *gin.Engine
	socket     *cio.IO
	routers    []Router
	namespaces []Namespace
	srv        *http.Server
	db         *bbolt.DB
	logger     *logger.ReZero
}

type Conns struct {
	DB     *bbolt.DB
	Logger *logger.ReZero
}

type Router interface {
	Route(handler *gin.RouterGroup)
}

type Namespace interface {
	OnSpace(ns cio.NSInitiate)
}

func (a *Api) Register(r func(Conns) []Router) {
	a.routers = append(a.routers, r(Conns{
		DB:     a.db,
		Logger: a.logger,
	})...)
}

func (a *Api) RegisterSocket(r func(Conns) []Namespace) {
	a.namespaces = append(a.namespaces, r(Conns{
		DB:     a.db,
		Logger: a.logger,
	})...)
}

func (a *Api) Start() error {
	root := a.server.Group("/api/v1")

	for _, router := range a.routers {
		router.Route(root)
	}
	for _, namespace := range a.namespaces {
		namespace.OnSpace(a.socket.NewSpace)
	}

	port := os.Getenv("APP_PORT")
	a.srv = &http.Server{
		Addr:    "0.0.0.0:" + port,
		Handler: a.server,
	}

	err := a.srv.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (a *Api) Shutdown(ctx context.Context) error {
	if a.srv != nil {
		return a.srv.Shutdown(ctx)
	}
	return nil
}
