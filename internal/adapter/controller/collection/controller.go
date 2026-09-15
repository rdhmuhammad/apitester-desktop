package collection

import (
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
	GetVariables() ([]service.CollectionVar, error)
	GetPreScript() (string, error)
	UpdatePreScript(req service.UpdatePreScriptRequest) (service.UpdatePreScriptResponse, error)
	CreateVariable(req service.CreateVariableRequest) (service.CreateVariableResponse, error)
	UpdateVariable(id string, req service.UpdateVariableRequest) (service.CreateVariableResponse, error)
	DeleteVariable(id string) (service.CreateVariableResponse, error)
	GetAuth() (*service.CollectionAuth, error)
	UpdateAuth(req service.UpdateCollectionAuthRequest) (*service.CollectionAuth, error)
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

func (ctrl Controller) GetVariables(c *gin.Context) {
	res, err := ctrl.usecase.GetVariables()
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection variables retrieved"), err)
}

func (ctrl Controller) GetPreScript(c *gin.Context) {
	res, err := ctrl.usecase.GetPreScript()
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection pre-request script retrieved"), err)
}

func (ctrl Controller) GetAuth(c *gin.Context) {
	var (
		res *service.CollectionAuth
		err error
	)

	res, err = ctrl.usecase.GetAuth()
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection auth retrieved"), err)
}

func (ctrl Controller) UpdateAuth(c *gin.Context) {
	var req service.UpdateCollectionAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateAuth(req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection auth updated"), err)
}

func (ctrl Controller) UpdatePreScript(c *gin.Context) {
	var req service.UpdatePreScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdatePreScript(req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Collection pre-request script updated"), err)
}

func (ctrl Controller) CreateVariable(c *gin.Context) {
	var req service.CreateVariableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.CreateVariable(req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Variable created"), err)
}

func (ctrl Controller) UpdateVariable(c *gin.Context) {
	var req service.UpdateVariableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.UpdateVariable(c.Param("id"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Variable updated"), err)
}

func (ctrl Controller) DeleteVariable(c *gin.Context) {
	res, err := ctrl.usecase.DeleteVariable(c.Param("id"))
	ctrl.respond(c, payload.NewSuccessResponse(res, "Variable deleted"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/read/:id", ctrl.Read)
	collection.GET("/list", ctrl.ListCollections)
	collection.GET("/variables", ctrl.GetVariables)
	collection.GET("/pre-script", ctrl.GetPreScript)
	collection.GET("/auth", ctrl.GetAuth)
	collection.PUT("/auth", ctrl.UpdateAuth)
	collection.PUT("/pre-script", ctrl.UpdatePreScript)
	collection.POST("/create", ctrl.CreateCollection)
	collection.PUT("/:id", ctrl.UpdateCollectionByID)
	collection.DELETE("/:id", ctrl.DeleteCollection)
	collection.PUT("/select/:id", ctrl.SelectCollection)
	collection.GET("/get-active", ctrl.GetActiveCollection)
	collection.POST("/variable", ctrl.CreateVariable)
	collection.PUT("/variable/:id", ctrl.UpdateVariable)
	collection.DELETE("/variable/:id", ctrl.DeleteVariable)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
