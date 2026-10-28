package tree

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/service/tree"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	GetRequestTree(ctx context.Context) ([]tree.RequestTree, error)
	GetTestSuiteTree(collectionID string) ([]tree.RequestTree, error)
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{
		usecase: tree.NewUsecase(lg, database),
		mapper:  mapper.NewMapper(),
	}
}

func (ctrl Controller) GetRequestTree(c *gin.Context) {
	res, err := ctrl.usecase.GetRequestTree(c.Request.Context())
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request tree retrieved"), err)
}

func (ctrl Controller) GetTestSuiteTree(c *gin.Context) {
	res, err := ctrl.usecase.GetTestSuiteTree(c.Param("collectionId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Test suite tree retrieved"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	restRequest := rg.Group("/restrequest")
	restRequest.GET("/tree", ctrl.GetRequestTree)
	restRequest.GET("/tree/testsuite/:collectionId", ctrl.GetTestSuiteTree)
	restRequest.GET("/tree/testsuite", ctrl.GetTestSuiteTree)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	ctrl.mapper.NewResponse(c, res, err)
}
