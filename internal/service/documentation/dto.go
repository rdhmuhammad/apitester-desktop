package doc

import (
	"path/filepath"
	"strings"
	"unicode/utf16"
)

type RefreshListener func(refresh bool)

type DocumentTree struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Path     string         `json:"path"`
	Category string         `json:"category"`
	IsActive bool           `json:"isActive"`
	Show     bool           `json:"show"`
	Item     []DocumentTree `json:"item,omitempty"`
}

type DocumentResponse struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	Content string `json:"content"`
	Version string `json:"version"`
}

type CreateDocumentRequest struct {
	Name     string `json:"name"`
	ParentID string `json:"parentId"`
}

type CreateFolderRequest struct {
	ParentID string `json:"parentId"`
	Name     string `json:"name"`
}

type RenameDocumentRequest struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type MoveDocumentRequest struct {
	ID             string `json:"id"`
	TargetFolderID string `json:"targetFolderId"`
}

type EditDocumentContentRequest struct {
	ID       string `json:"id"`
	Content  string `json:"content"`
	StartPos int    `json:"startPos"`
	Lenght   int    `json:"lenght"`
	Length   int    `json:"length"`
}

func (r EditDocumentContentRequest) DeleteLength() int {
	if r.Lenght > 0 {
		return r.Lenght
	}
	return r.Length
}

func (r EditDocumentContentRequest) ApplyTo(existing string) string {
	encoded := utf16.Encode([]rune(existing))
	start := r.StartPos
	if start < 0 {
		start = 0
	}
	if start > len(encoded) {
		start = len(encoded)
	}

	end := start + r.DeleteLength()
	if end < start {
		end = start
	}
	if end > len(encoded) {
		end = len(encoded)
	}

	inserted := utf16.Encode([]rune(r.Content))
	merged := make([]uint16, 0, start+len(inserted)+(len(encoded)-end))
	merged = append(merged, encoded[:start]...)
	merged = append(merged, inserted...)
	merged = append(merged, encoded[end:]...)
	return string(utf16.Decode(merged))
}

func NewDocumentResponse(relID, absPath, content, version string) DocumentResponse {
	base := filepath.Base(absPath)
	ext := filepath.Ext(base)
	name := base
	if strings.EqualFold(ext, ".md") || strings.EqualFold(ext, ".html") || strings.EqualFold(ext, ".htm") {
		name = strings.TrimSuffix(base, ext)
	}
	return DocumentResponse{
		ID:      filepath.ToSlash(relID),
		Name:    name,
		Path:    absPath,
		Content: content,
		Version: version,
	}
}

func NewFolderTreeNode(relID, name, absPath string, children []DocumentTree, show bool) DocumentTree {
	return DocumentTree{
		ID:       filepath.ToSlash(relID),
		Name:     name,
		Path:     absPath,
		Category: "FOLD",
		IsActive: false,
		Show:     show,
		Item:     children,
	}
}

func NewFileTreeNode(relID, name, absPath, category string, show bool) DocumentTree {
	return DocumentTree{
		ID:       filepath.ToSlash(relID),
		Name:     name,
		Path:     absPath,
		Category: category,
		IsActive: false,
		Show:     show,
	}
}
