package domain

import (
	"encoding/json"
	"time"
)

type Collection struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	IsSelected   bool      `json:"is_selected"`
	Path         string    `json:"path"`
	TestSuiteID  string    `json:"testsuite_id"`
	AutomationID string    `json:"automation_id"`
	UpdatedAt    time.Time `json:"updated_at"`
	CreatedAt    time.Time `json:"created_at"`
}

type CollectionHistory struct {
	ID           string          `json:"id"`
	CollectionID string          `json:"collection_id"`
	RequestID    string          `json:"request_id"`
	Operation    string          `json:"operation"`
	Field        string          `json:"field"`
	OldValue     json.RawMessage `json:"old_value"`
	NewValue     json.RawMessage `json:"new_value"`
	OldHash      string          `json:"old_hash"`
	NewHash      string          `json:"new_hash"`
	FilePath     string          `json:"file_path"`
	Line         int             `json:"line"`
	CreatedAt    time.Time       `json:"created_at"`
}
