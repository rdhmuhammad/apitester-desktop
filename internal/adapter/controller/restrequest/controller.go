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
	UpdateURL(collectionID, requestID string, req service.UpdateURLRequest) (service.RequestResponse, error)
	UpdateHeaders(collectionID, requestID string, req service.UpdateHeadersRequest) (service.RequestResponse, error)
	UpdateMethod(collectionID, requestID string, req service.UpdateMethodRequest) (service.RequestResponse, error)
	UpdateQuery(collectionID, requestID string, req service.UpdateQueryRequest) (service.RequestResponse, error)
	UpdateJSONBody(collectionID, requestID string, req service.UpdateJSONBodyRequest) (service.RequestResponse, error)
	UpdateFormDataBody(collectionID, requestID string, req service.UpdateFormDataBodyRequest) (service.RequestResponse, error)
	UpdatePostRequestScript(collectionID, requestID string, req service.UpdatePostRequestScriptRequest) (service.RequestResponse, error)
	Delete(collectionID, requestID string, req service.DeleteRequest) (service.RequestResponse, error)
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

func (ctrl Controller) UpdateURL(c *gin.Context) {
	var req service.UpdateURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateURL(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request URL updated"), err)
}

func (ctrl Controller) UpdateHeaders(c *gin.Context) {
	var req service.UpdateHeadersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateHeaders(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request headers updated"), err)
}

func (ctrl Controller) UpdateMethod(c *gin.Context) {
	var req service.UpdateMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateMethod(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request method updated"), err)
}

func (ctrl Controller) UpdateQuery(c *gin.Context) {
	var req service.UpdateQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateQuery(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request query updated"), err)
}

func (ctrl Controller) UpdateJSONBody(c *gin.Context) {
	var req service.UpdateJSONBodyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateJSONBody(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request JSON body updated"), err)
}

func (ctrl Controller) UpdateFormDataBody(c *gin.Context) {
	var req service.UpdateFormDataBodyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateFormDataBody(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request form-data body updated"), err)
}

func (ctrl Controller) UpdatePostRequestScript(c *gin.Context) {
	var req service.UpdatePostRequestScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdatePostRequestScript(c.Param("collectionId"), c.Param("requestId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Post-request script updated"), err)
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
	restRequest.GET("/:collectionId/:requestId", ctrl.Get)
	restRequest.PUT("/:collectionId/:requestId/url", ctrl.UpdateURL)
	restRequest.PUT("/:collectionId/:requestId/headers", ctrl.UpdateHeaders)
	restRequest.PUT("/:collectionId/:requestId/method", ctrl.UpdateMethod)
	restRequest.PUT("/:collectionId/:requestId/query", ctrl.UpdateQuery)
	restRequest.PUT("/:collectionId/:requestId/body/json", ctrl.UpdateJSONBody)
	restRequest.PUT("/:collectionId/:requestId/body/formdata", ctrl.UpdateFormDataBody)
	restRequest.PUT("/:collectionId/:requestId/script/post-request", ctrl.UpdatePostRequestScript)
	restRequest.DELETE("/:collectionId/:requestId", ctrl.Delete)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
