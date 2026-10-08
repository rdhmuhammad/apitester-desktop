package collection

import (
	"context"
	"testing"
)

func TestSearchVariables(t *testing.T) {
	docs := DocsContent{
		Info: CollectionInfo{
			Name: "Test API",
		},
		Variable: []CollectionVar{
			{ID: "1", Key: "userId", Value: "101"},
			{ID: "2", Key: "username", Value: "johndoe"},
			{ID: "3", Key: "useLanguage", Value: "en"},
			{ID: "4", Key: "token", Value: "secret_token"},
		},
	}

	usecase, _ := setupTestCollectionUsecase(t, docs, true)
	ctx := context.Background()

	t.Run("search all when key is empty", func(t *testing.T) {
		keys, err := usecase.SearchVariables(ctx, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(keys) != 4 {
			t.Fatalf("expected 4 keys, got %d", len(keys))
		}
	})

	t.Run("search matching key prefix or substring", func(t *testing.T) {
		keys, err := usecase.SearchVariables(ctx, "use")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(keys) != 3 { // userId, username, useLanguage
			t.Fatalf("expected 3 keys for 'use', got %d: %v", len(keys), keys)
		}
	})

	t.Run("search case insensitive", func(t *testing.T) {
		keys, err := usecase.SearchVariables(ctx, "TOKEN")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(keys) != 1 || keys[0] != "token" {
			t.Fatalf("expected ['token'], got %v", keys)
		}
	})

	t.Run("search no match", func(t *testing.T) {
		keys, err := usecase.SearchVariables(ctx, "nonexistent")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(keys) != 0 {
			t.Fatalf("expected 0 keys, got %d", len(keys))
		}
	})
}
