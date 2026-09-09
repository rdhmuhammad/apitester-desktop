package collection

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/internal/domain"
	service "github.com/rdhmuhammad/apitester/internal/service/collection"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	Read(id string) (service.ReadResponse, error)
	ListCollections() ([]domain.Collection, error)
	CreateCollection(req service.CreateCollectionRequest) (domain.Collection, error)
	UpdateCollectionByID(id string, req service.UpdateCollectionRequest) (domain.Collection, error)
	DeleteCollection(id string) error
	SelectCollection(id string) (domain.Collection, error)
	GetActiveCollection() (domain.Collection, error)
	UploadCollection(fileBytes []byte) error
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(
	lg logger.Logger,
	database *bbolt.DB,
) Controller {
	return Controller{
		usecase: service.NewUsecase(lg, database),
		mapper:  mapper.NewMapper(),
	}
}

func (ctrl Controller) ListCollections(c *gin.Context) {
	res, err := ctrl.usecase.ListCollections()
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collections retrieved"), err)
}

func (ctrl Controller) Read(c *gin.Context) {
	res, err := ctrl.usecase.Read(c.Param("id"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection retrieved"), err)
}

func (ctrl Controller) CreateCollection(c *gin.Context) {
	var req service.CreateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.CreateCollection(req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection created"), err)
}

func (ctrl Controller) UpdateCollectionByID(c *gin.Context) {
	var req service.UpdateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.UpdateCollectionByID(c.Param("id"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection updated"), err)
}

func (ctrl Controller) DeleteCollection(c *gin.Context) {
	err := ctrl.usecase.DeleteCollection(c.Param("id"))
	ctrl.respond(c, payload.NewSuccessResponseNoData("Collection deleted"), err)
}

func (ctrl Controller) SelectCollection(c *gin.Context) {
	res, err := ctrl.usecase.SelectCollection(c.Param("id"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection selected"), err)
}

func (ctrl Controller) GetActiveCollection(c *gin.Context) {
	res, err := ctrl.usecase.GetActiveCollection()
	ctrl.respond(c, payload.NewSuccessResponse(res, "Active collection retrieved"), err)
}

func (ctrl Controller) UploadCollection(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage("Collection file is required"))
		return
	}

	opened, err := file.Open()
	if err != nil {
		ctrl.respond(c, payload.NewSuccessResponseNoData("Collection uploaded"), err)
		return
	}
	defer opened.Close()

	fileBytes, err := io.ReadAll(opened)
	if err != nil {
		ctrl.respond(c, payload.NewSuccessResponseNoData("Collection uploaded"), err)
		return
	}

	err = ctrl.usecase.UploadCollection(fileBytes)
	ctrl.respond(c, payload.NewSuccessResponseNoData("Collection uploaded"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/read/:id", ctrl.Read)
	collection.GET("/list", ctrl.ListCollections)
	collection.POST("/create", ctrl.CreateCollection)
	collection.PUT("/:id", ctrl.UpdateCollectionByID)
	collection.DELETE("/:id", ctrl.DeleteCollection)
	collection.PUT("/select/:id", ctrl.SelectCollection)
	collection.GET("/get-active", ctrl.GetActiveCollection)
	collection.POST("/upload", ctrl.UploadCollection)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
