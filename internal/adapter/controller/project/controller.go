package project

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	service "github.com/rdhmuhammad/apitester/internal/service/project"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"github.com/rdhmuhammad/apitester/pkg/mapper"
	"github.com/rdhmuhammad/apitester/shared/payload"
	"go.etcd.io/bbolt"
)

type Usecase interface {
	ListProjects(ctx context.Context) ([]service.ProjectResponse, error)
	CreateProject(ctx context.Context, req service.CreateProjectRequest) (service.ProjectResponse, error)
	UpdateProjectByID(ctx context.Context, id string, req service.UpdateProjectRequest) (service.ProjectResponse, error)
	DeleteProject(ctx context.Context, id string) error
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

func (ctrl Controller) ListProjects(c *gin.Context) {
	res, err := ctrl.usecase.ListProjects(c.Request.Context())
	ctrl.respond(c, payload.NewSuccessResponse(res, "Projects retrieved"), err)
}

func (ctrl Controller) CreateProject(c *gin.Context) {
	var req service.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.CreateProject(c.Request.Context(), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Project created"), err)
}

func (ctrl Controller) UpdateProjectByID(c *gin.Context) {
	var req service.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(err.Error()))
		return
	}

	res, err := ctrl.usecase.UpdateProjectByID(c.Request.Context(), c.Param("id"), req)
	ctrl.respond(c, payload.NewSuccessResponse(res, "Project updated"), err)
}

func (ctrl Controller) DeleteProject(c *gin.Context) {
	err := ctrl.usecase.DeleteProject(c.Request.Context(), c.Param("id"))
	ctrl.respond(c, payload.NewSuccessResponseNoData("Project deleted"), err)
}

func (ctrl Controller) Route(rg *gin.RouterGroup) {
	project := rg.Group("/project")
	project.GET("/list", ctrl.ListProjects)
	project.POST("/create", ctrl.CreateProject)
	project.PUT("/:id", ctrl.UpdateProjectByID)
	project.DELETE("/:id", ctrl.DeleteProject)
}

func (ctrl Controller) respond(c *gin.Context, res *payload.Response, err error) {
	if invalid, invalidErr := ctrl.mapper.IsInvalidDataError(err); invalid {
		c.JSON(http.StatusBadRequest, payload.DefaultErrorInvalidDataWithMessage(invalidErr.Error()))
		return
	}
	ctrl.mapper.NewResponse(c, res, err)
}
