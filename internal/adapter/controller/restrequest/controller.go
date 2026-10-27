package restrequest

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/mockdata"
	service "github.com/rdhmuhammad/apitester/internal/service/restrequest"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	CreateRequest(ctx context.Context, collectionID string, opts ...service.CreateRequestPayload) (service.RequestResponse, error)
	CreateFolder(ctx context.Context, collectionID string, req service.CreateFolderPayload) (service.FolderResponse, error)
	RenameItem(ctx context.Context, collectionID, itemID string, req service.UpdateNameRequest) (service.FolderResponse, error)
	Get(ctx context.Context, collectionID, requestID string) (service.RequestResponse, error)
	Delete(ctx context.Context, collectionID, requestID string) (service.RequestResponse, error)
	UpdateTree(ctx context.Context, collectionID string, req []service.UpdateTreeItem) (service.UpdateTreeResponse, error)
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{usecase: service.NewUsecase(lg, database), mapper: mapper.NewMapper()}
}

func (ctrl Controller) CreateRequest(c *gin.Context) {
	var req service.CreateRequestPayload
	_ = c.ShouldBindJSON(&req)
	res, err := ctrl.usecase.CreateRequest(c.Request.Context(), c.Param("collectionId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request created"), err)
}

func (ctrl Controller) CreateFolder(c *gin.Context) {
	var req service.CreateFolderPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage("Invalid request body"))
		return
	}
	res, err := ctrl.usecase.CreateFolder(c.Request.Context(), c.Param("collectionId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Folder created"), err)
}

func (ctrl Controller) RenameItem(c *gin.Context) {
	var req service.UpdateNameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage("Invalid request body"))
		return
	}
	res, err := ctrl.usecase.RenameItem(c.Request.Context(), c.Param("collectionId"), c.Param("itemId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Item renamed"), err)
}

func (ctrl Controller) Get(c *gin.Context) {
	res, err := ctrl.usecase.Get(c.Request.Context(), c.Param("collectionId"), c.Param("requestId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request retrieved"), err)
}

func (ctrl Controller) Delete(c *gin.Context) {
	res, err := ctrl.usecase.Delete(c.Request.Context(), c.Param("collectionId"), c.Param("requestId"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Request deleted"), err)
}

func (ctrl Controller) UpdateTree(c *gin.Context) {
	var req []service.UpdateTreeItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage("Invalid request body"))
		return
	}
	res, err := ctrl.usecase.UpdateTree(c.Request.Context(), c.Param("collectionId"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection tree updated"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	restRequest := rg.Group("/restrequest")
	restRequest.GET("/mock-data", ctrl.GetMockData)
	restRequest.POST("/create-request/:collectionId", ctrl.CreateRequest)
	restRequest.POST("/create-request", ctrl.CreateRequest)
	restRequest.POST("/create-folder/:collectionId", ctrl.CreateFolder)
	restRequest.POST("/create-folder", ctrl.CreateFolder)
	restRequest.PUT("/rename/:collectionId/:itemId", ctrl.RenameItem)
	restRequest.GET("/:collectionId/:requestId", ctrl.Get)
	restRequest.GET("/request/:requestId", ctrl.Get)
	restRequest.DELETE("/:collectionId/:requestId", ctrl.Delete)
	restRequest.DELETE("/request/:requestId", ctrl.Delete)
	restRequest.PUT("/tree/:collectionId", ctrl.UpdateTree)
	restRequest.PUT("/tree", ctrl.UpdateTree)
}

func (ctrl Controller) GetMockData(c *gin.Context) {
	key := c.Query("key")
	val := mockdata.GenerateMockData(key)
	ctrl.respond(c, payload.NewSuccessResponse(val, "Mock data generated"), nil)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	ctrl.mapper.NewResponse(c, res, err)
}
