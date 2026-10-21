package project

import (
	"strings"
	"time"

	"github.com/rdhmuhammad/apitester/internal/domain"
)

type CreateProjectRequest struct {
	Name string `json:"name" binding:"required"`
	Path string `json:"path" binding:"required"`
}

type UpdateProjectRequest struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type ProjectResponse struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	IsSelected  bool                `json:"is_selected"`
	Path        string              `json:"path"`
	Collections []domain.Collection `json:"collections"`
	UpdatedAt   time.Time           `json:"updated_at"`
	CreatedAt   time.Time           `json:"created_at"`
}

func NewProjectResponse(project domain.Project, collections []domain.Collection) ProjectResponse {
	if collections == nil {
		collections = []domain.Collection{}
	}
	return ProjectResponse{
		ID:          project.ID,
		Name:        project.Name,
		IsSelected:  project.IsSelected,
		Path:        project.Path,
		Collections: collections,
		UpdatedAt:   project.UpdatedAt,
		CreatedAt:   project.CreatedAt,
	}
}

func ApplyProjectUpdate(project *domain.Project, req UpdateProjectRequest) {
	if strings.TrimSpace(req.Name) != "" {
		project.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Path) != "" {
		project.Path = strings.TrimSpace(req.Path)
	}
	project.UpdatedAt = time.Now()
}
