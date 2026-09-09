package tree

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/service/tree"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	GetRequestTree(collectionID string) ([]tree.RequestTree, error)
	GetAutomationTree(collectionID string) ([]tree.RequestTree, error)
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
	res, err := ctrl.usecase.GetRequestTree(c.Param("collectionId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request tree retrieved"), err)
}

func (ctrl Controller) GetAutomationTree(c *gin.Context) {
	res, err := ctrl.usecase.GetAutomationTree(c.Param("collectionId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Automation tree retrieved"), err)
}

func (ctrl Controller) GetTestSuiteTree(c *gin.Context) {
	res, err := ctrl.usecase.GetTestSuiteTree(c.Param("collectionId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Test suite tree retrieved"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	restRequest := rg.Group("/restrequest")
	restRequest.GET("/tree/:collectionId", ctrl.GetRequestTree)
	restRequest.GET("/tree/automation/:collectionId", ctrl.GetAutomationTree)
	restRequest.GET("/tree/testsuite/:collectionId", ctrl.GetTestSuiteTree)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
