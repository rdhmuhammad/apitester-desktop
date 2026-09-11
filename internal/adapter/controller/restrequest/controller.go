package restrequest

import (
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	Get(collectionID, requestID string) (service.RequestResponse, error)
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{usecase: service.NewUsecase(lg, database), mapper: mapper.NewMapper()}
}

func (ctrl Controller) Get(c *gin.Context) {
	res, err := ctrl.usecase.Get(c.Param("collectionId"), c.Param("requestId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request retrieved"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	restRequest := rg.Group("/restrequest")
	restRequest.GET("/:collectionId/:requestId", ctrl.Get)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
