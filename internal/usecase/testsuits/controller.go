package testsuits

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/bbolt"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
)

type Controller struct {
	Uc     UsecaseInterface
	mapper mapper.Mapper
}

type UsecaseInterface interface {
	ListTests(id string) ([]TestFileInfo, error)
	ReadTest(id, name string) (TestFileContent, error)
	WriteTest(id, name string, payload TestFileContent) error
	DeleteTest(id, name string) error
}

func NewController(lg logger.Logger, collectionRepo bbolt.RepositoryInterface[domain.Collection]) Controller {
	return Controller{
		Uc: NewUsecase(lg, collectionRepo),
	}
}

func (ctrl Controller) ListTests(c *gin.Context) {
	id := c.Param("id")
	res, err := ctrl.Uc.ListTests(id)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) ReadTest(c *gin.Context) {
	id := c.Param("id")
	name := c.Param("name")
	res, err := ctrl.Uc.ReadTest(id, name)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) WriteTest(c *gin.Context) {
	id := c.Param("id")
	name := c.Param("name")

	var req TestFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	err := ctrl.Uc.WriteTest(id, name, req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}

	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Test written successfully"), err)
}

func (ctrl Controller) DeleteTest(c *gin.Context) {
	id := c.Param("id")
	name := c.Param("name")
	err := ctrl.Uc.DeleteTest(id, name)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Test deleted successfully"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/:id/tests", ctrl.ListTests)
	collection.GET("/:id/tests/:name", ctrl.ReadTest)
	collection.PUT("/:id/tests/:name", ctrl.WriteTest)
	collection.DELETE("/:id/tests/:name", ctrl.DeleteTest)
}
