package testsuits

import (
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/testsuits"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	ListTests(id string) ([]service.TestFileInfo, error)
	ReadTest(id, name string) (service.TestFileContent, error)
	WriteTest(id, name string, payload service.TestFileContent) error
	DeleteTest(id, name string) error
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{usecase: service.NewUsecase(lg, database), mapper: mapper.NewMapper()}
}

func (ctrl Controller) ListTests(c *gin.Context) {
	res, err := ctrl.usecase.ListTests(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Tests retrieved"), err)
}

func (ctrl Controller) ReadTest(c *gin.Context) {
	res, err := ctrl.usecase.ReadTest(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Test retrieved"), err)
}

func (ctrl Controller) WriteTest(c *gin.Context) {
	var req service.TestFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.usecase.WriteTest(c.Param("id"), c.Param("name"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Test written successfully"), err)
}

func (ctrl Controller) DeleteTest(c *gin.Context) {
	err := ctrl.usecase.DeleteTest(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Test deleted successfully"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/:id/tests", ctrl.ListTests)
	collection.GET("/:id/tests/:name", ctrl.ReadTest)
	collection.PUT("/:id/tests/:name", ctrl.WriteTest)
	collection.DELETE("/:id/tests/:name", ctrl.DeleteTest)
}
