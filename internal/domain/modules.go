package domain

import "time"

type TestSuite struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CollectionID string    `json:"collection_id"`
	Path         string    `json:"path"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
