package docctrl

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/documentation"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	GetTree(ctx context.Context) ([]service.DocumentTree, error)
	CreateDocument(ctx context.Context, req service.CreateDocumentRequest) (service.DocumentResponse, error)
	CreateFolder(ctx context.Context, req service.CreateFolderRequest) (service.DocumentTree, error)
	GetContent(ctx context.Context, id string) (service.DocumentResponse, error)
	RenameDocument(ctx context.Context, req service.RenameDocumentRequest) (service.DocumentResponse, error)
	MoveDocument(ctx context.Context, req service.MoveDocumentRequest) (service.DocumentResponse, error)
	DeleteItem(ctx context.Context, id string) error
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

func (ctrl Controller) GetTree(c *gin.Context) {
	res, err := ctrl.usecase.GetTree(c.Request.Context())
	ctrl.respond(c, payload.NewSuccessResponse(res, "Documentation tree retrieved"), err)
}

func (ctrl Controller) CreateDocument(c *gin.Context) {
	var req service.CreateDocumentRequest
	_ = c.ShouldBindJSON(&req)

	res, err := ctrl.usecase.CreateDocument(c.Request.Context(), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Document created"), err)
}

func (ctrl Controller) CreateFolder(c *gin.Context) {
	var req service.CreateFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.CreateFolder(c.Request.Context(), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Folder created"), err)
}

func (ctrl Controller) GetContent(c *gin.Context) {
	res, err := ctrl.usecase.GetContent(c.Request.Context(), c.Query("id"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Document content retrieved"), err)
}

func (ctrl Controller) RenameDocument(c *gin.Context) {
	var req service.RenameDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.RenameDocument(c.Request.Context(), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Document renamed"), err)
}

func (ctrl Controller) MoveDocument(c *gin.Context) {
	var req service.MoveDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.MoveDocument(c.Request.Context(), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Document moved"), err)
}

func (ctrl Controller) DeleteItem(c *gin.Context) {
	id := c.Query("id")
	if id == "" {
		var body struct {
			ID string `json:"id"`
		}
		_ = c.ShouldBindJSON(&body)
		id = body.ID
	}

	err := ctrl.usecase.DeleteItem(c.Request.Context(), id)
	ctrl.respond(c, payload.NewSuccessResponseNoData("Item deleted"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	doc := rg.Group("/documentation")
	doc.GET("/tree", ctrl.GetTree)
	doc.GET("/content", ctrl.GetContent)
	doc.POST("/create", ctrl.CreateDocument)
	doc.POST("/folder", ctrl.CreateFolder)
	doc.PUT("/rename", ctrl.RenameDocument)
	doc.PUT("/move", ctrl.MoveDocument)
	doc.DELETE("", ctrl.DeleteItem)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
