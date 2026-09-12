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
	CreateRequest(collectionID string) (service.RequestResponse, error)
	Get(collectionID, requestID string) (service.RequestResponse, error)
	Delete(collectionID, requestID string, req service.DeleteRequest) (service.RequestResponse, error)
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{usecase: service.NewUsecase(lg, database), mapper: mapper.NewMapper()}
}

func (ctrl Controller) CreateRequest(c *gin.Context) {
	res, err := ctrl.usecase.CreateRequest(c.Param("collectionId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request created"), err)
}

func (ctrl Controller) Get(c *gin.Context) {
	res, err := ctrl.usecase.Get(c.Param("collectionId"), c.Param("requestId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request retrieved"), err)
}

func (ctrl Controller) Delete(c *gin.Context) {
	var req service.DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.Delete(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request deleted"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	restRequest := rg.Group("/restrequest")
	restRequest.POST("/create-request/:collectionId", ctrl.CreateRequest)
	restRequest.GET("/:collectionId/:requestId", ctrl.Get)
	restRequest.DELETE("/:collectionId/:requestId", ctrl.Delete)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
