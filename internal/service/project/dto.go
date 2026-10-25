package project

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/rdhmuhammad/apitester/internal/domain"
)

type OpenProjectRequest struct {
	Name string `json:"name"`
	Path string `json:"path" binding:"required"`
}

// ProjectName returns the trimmed name, falling back to the folder base name.
func (r OpenProjectRequest) ProjectName() string {
	if name := strings.TrimSpace(r.Name); name != "" {
		return name
	}
	return filepath.Base(filepath.Clean(strings.TrimSpace(r.Path)))
}

type UpdateProjectRequest struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type ProjectResponse struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	IsSelected bool      `json:"is_selected"`
	Path       string    `json:"path"`
	UpdatedAt  time.Time `json:"updated_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func NewProjectResponse(project domain.Project) ProjectResponse {
	return ProjectResponse{
		ID:         project.ID,
		Name:       project.Name,
		IsSelected: project.IsSelected,
		Path:       project.Path,
		UpdatedAt:  project.UpdatedAt,
		CreatedAt:  project.CreatedAt,
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
