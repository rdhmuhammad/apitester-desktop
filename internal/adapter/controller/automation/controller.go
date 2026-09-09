package automation

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/automation"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	ListAutomation(id string) ([]service.AutomationFileInfo, error)
	ReadAutomation(id, name string) (service.AutomationFileContent, error)
	WriteAutomation(id, name string, payload service.AutomationFileContent) error
	DeleteAutomation(id, name string) error
	ListAutomationInventories(id string) ([]service.AutomationInventoryFileInfo, error)
	CreateAutomationInventory(id string, req service.AutomationInventoryCreateRequest) (service.AutomationInventoryFileContent, error)
	ReadAutomationInventory(id, name string) (service.AutomationInventoryFileContent, error)
	WriteAutomationInventory(id, name string, payload service.AutomationInventoryFileContent) error
	DeleteAutomationInventory(id, name string) error
	ListAutomationConfigs(id string) (map[string]service.AutomationConfig, error)
	WriteAutomationConfig(id, name string, config service.AutomationConfig) error
}

type Controller struct {
	usecase Usecase
	mapper  mapper.Mapper
}

func NewController(lg logger.Logger, database *bbolt.DB) Controller {
	return Controller{usecase: service.NewUsecase(lg, database), mapper: mapper.NewMapper()}
}

func (ctrl Controller) ListAutomation(c *gin.Context) {
	res, err := ctrl.usecase.ListAutomation(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation files retrieved"), err)
}
func (ctrl Controller) ReadAutomation(c *gin.Context) {
	res, err := ctrl.usecase.ReadAutomation(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation file retrieved"), err)
}
func (ctrl Controller) WriteAutomation(c *gin.Context) {
	var req service.AutomationFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.usecase.WriteAutomation(c.Param("id"), c.Param("name"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation file written successfully"), err)
}
func (ctrl Controller) DeleteAutomation(c *gin.Context) {
	err := ctrl.usecase.DeleteAutomation(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation file deleted successfully"), err)
}
func (ctrl Controller) ListAutomationInventories(c *gin.Context) {
	res, err := ctrl.usecase.ListAutomationInventories(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation inventories retrieved"), err)
}
func (ctrl Controller) CreateAutomationInventory(c *gin.Context) {
	var req service.AutomationInventoryCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	res, err := ctrl.usecase.CreateAutomationInventory(c.Param("id"), req)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation inventory created successfully"), err)
}
func (ctrl Controller) ReadAutomationInventory(c *gin.Context) {
	res, err := ctrl.usecase.ReadAutomationInventory(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation inventory retrieved"), err)
}
func (ctrl Controller) WriteAutomationInventory(c *gin.Context) {
	var req service.AutomationInventoryFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.usecase.WriteAutomationInventory(c.Param("id"), c.Param("name"), req)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation inventory written successfully"), err)
}
func (ctrl Controller) DeleteAutomationInventory(c *gin.Context) {
	err := ctrl.usecase.DeleteAutomationInventory(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation inventory deleted successfully"), err)
}
func (ctrl Controller) ListAutomationConfigs(c *gin.Context) {
	res, err := ctrl.usecase.ListAutomationConfigs(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation configs retrieved"), err)
}
func (ctrl Controller) WriteAutomationConfig(c *gin.Context) {
	var req service.AutomationConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.usecase.WriteAutomationConfig(c.Param("id"), c.Param("name"), req)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation configuration saved successfully"), err)
}
func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/:id/automation", ctrl.ListAutomation)
	collection.GET("/:id/automation/inventory", ctrl.ListAutomationInventories)
	collection.POST("/:id/automation/inventory", ctrl.CreateAutomationInventory)
	collection.GET("/:id/automation/inventory/:name", ctrl.ReadAutomationInventory)
	collection.PUT("/:id/automation/inventory/:name", ctrl.WriteAutomationInventory)
	collection.DELETE("/:id/automation/inventory/:name", ctrl.DeleteAutomationInventory)
	collection.GET("/:id/automation/config", ctrl.ListAutomationConfigs)
	collection.PUT("/:id/automation/:name/config", ctrl.WriteAutomationConfig)
	collection.GET("/:id/automation/:name", ctrl.ReadAutomation)
	collection.PUT("/:id/automation/:name", ctrl.WriteAutomation)
	collection.DELETE("/:id/automation/:name", ctrl.DeleteAutomation)
}
