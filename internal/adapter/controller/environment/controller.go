package environment

import (
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/environment"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	ReadEnvironments(id string) (service.ReadEnvironmentsResponse, error)
	WriteEnvironments(id string, req service.WriteEnvironmentsRequest) error
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{
		usecase: service.NewUsecase(lg, database),
		mapper:  mapper.NewMapper(),
	}
}

func (ctrl Controller) ReadEnvironments(c *gin.Context) {
	res, err := ctrl.usecase.ReadEnvironments(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Environments retrieved"), err)
}

func (ctrl Controller) WriteEnvironments(c *gin.Context) {
	var req service.WriteEnvironmentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	err := ctrl.usecase.WriteEnvironments(c.Param("id"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Environments written successfully"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/:id/environments", ctrl.ReadEnvironments)
	collection.PUT("/:id/environments", ctrl.WriteEnvironments)
}
