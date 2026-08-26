package automation

import (
	"io"
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
	ListAutomation(id string) ([]AutomationFileInfo, error)
	ReadAutomation(id, name string) (AutomationFileContent, error)
	WriteAutomation(id, name string, payload AutomationFileContent) error
	DeleteAutomation(id, name string) error
	ListAutomationInventories(id string) ([]AutomationInventoryFileInfo, error)
	CreateAutomationInventory(id string, req AutomationInventoryCreateRequest) (AutomationInventoryFileContent, error)
	ReadAutomationInventory(id, name string) (AutomationInventoryFileContent, error)
	WriteAutomationInventory(id, name string, payload AutomationInventoryFileContent) error
	DeleteAutomationInventory(id, name string) error
	ListAutomationConfigs(id string) (map[string]AutomationConfig, error)
	WriteAutomationConfig(id, name string, config AutomationConfig) error
	RunAutomation(id, name string, req AutomationRunRequest) (AutomationRunResult, error)
	CancelAutomation(id, name string) error
	AutomationRuntime() AutomationRuntimeInfo
}

func NewController(lg logger.Logger, collectionRepo bbolt.RepositoryInterface[domain.Collection]) Controller {
	return Controller{
		Uc: NewUsecase(lg, collectionRepo),
	}
}

func (ctrl Controller) ListAutomation(c *gin.Context) {
	res, err := ctrl.Uc.ListAutomation(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) ReadAutomation(c *gin.Context) {
	res, err := ctrl.Uc.ReadAutomation(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) WriteAutomation(c *gin.Context) {
	var req AutomationFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	err := ctrl.Uc.WriteAutomation(c.Param("id"), c.Param("name"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation file written successfully"), err)
}

func (ctrl Controller) DeleteAutomation(c *gin.Context) {
	err := ctrl.Uc.DeleteAutomation(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation file deleted successfully"), err)
}

func (ctrl Controller) ListAutomationInventories(c *gin.Context) {
	res, err := ctrl.Uc.ListAutomationInventories(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) CreateAutomationInventory(c *gin.Context) {
	var req AutomationInventoryCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if err != io.EOF {
			c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
			return
		}
	}
	res, err := ctrl.Uc.CreateAutomationInventory(c.Param("id"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation inventory created successfully"), err)
}

func (ctrl Controller) ReadAutomationInventory(c *gin.Context) {
	res, err := ctrl.Uc.ReadAutomationInventory(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) WriteAutomationInventory(c *gin.Context) {
	var req AutomationInventoryFileContent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.Uc.WriteAutomationInventory(c.Param("id"), c.Param("name"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation inventory written successfully"), err)
}

func (ctrl Controller) DeleteAutomationInventory(c *gin.Context) {
	err := ctrl.Uc.DeleteAutomationInventory(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation inventory deleted successfully"), err)
}

func (ctrl Controller) ListAutomationConfigs(c *gin.Context) {
	res, err := ctrl.Uc.ListAutomationConfigs(c.Param("id"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Success"), err)
}

func (ctrl Controller) WriteAutomationConfig(c *gin.Context) {
	var req AutomationConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}
	err := ctrl.Uc.WriteAutomationConfig(c.Param("id"), c.Param("name"), req)
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation configuration saved successfully"), err)
}

func (ctrl Controller) RunAutomation(c *gin.Context) {
	var req AutomationRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.Uc.RunAutomation(c.Param("id"), c.Param("name"), req)
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(res, "Automation run completed"), err)
}

func (ctrl Controller) CancelAutomation(c *gin.Context) {
	err := ctrl.Uc.CancelAutomation(c.Param("id"), c.Param("name"))
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponseNoData("Automation cancellation requested"), err)
}

func (ctrl Controller) AutomationRuntime(c *gin.Context) {
	ctrl.mapper.NewResponse(c, payload.NewSuccessResponse(ctrl.Uc.AutomationRuntime(), "Success"), nil)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	collection := rg.Group("/collection")
	collection.GET("/:id/automation", ctrl.ListAutomation)
	collection.GET("/:id/automation/runtime", ctrl.AutomationRuntime)
	collection.GET("/:id/automation/inventory", ctrl.ListAutomationInventories)
	collection.POST("/:id/automation/inventory", ctrl.CreateAutomationInventory)
	collection.GET("/:id/automation/inventory/:name", ctrl.ReadAutomationInventory)
	collection.PUT("/:id/automation/inventory/:name", ctrl.WriteAutomationInventory)
	collection.DELETE("/:id/automation/inventory/:name", ctrl.DeleteAutomationInventory)
	collection.GET("/:id/automation/config", ctrl.ListAutomationConfigs)
	collection.PUT("/:id/automation/:name/config", ctrl.WriteAutomationConfig)
	collection.GET("/:id/automation/:name", ctrl.ReadAutomation)
	collection.POST("/:id/automation/:name/run", ctrl.RunAutomation)
	collection.POST("/:id/automation/:name/cancel", ctrl.CancelAutomation)
	collection.PUT("/:id/automation/:name", ctrl.WriteAutomation)
	collection.DELETE("/:id/automation/:name", ctrl.DeleteAutomation)
}
