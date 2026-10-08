package collection

import (
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rdhmuhammad/apitester/pkg/cio"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/logger"
)

func TestCollectionRefreshPayload(t *testing.T) {
	payload := CollectionRefreshPayload{}
	payload.From(map[string]any{"refresh": true})
	if !payload.Refresh {
		t.Fatalf("expected payload.Refresh to be true, got %v", payload.Refresh)
	}

	payload2 := CollectionRefreshPayload{}
	payload2.From(map[string]any{"refresh": false})
	if payload2.Refresh {
		t.Fatalf("expected payload2.Refresh to be false, got %v", payload2.Refresh)
	}
}

func TestCollectionSocketCreationAndOnSpace(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")
	boltDB, err := db.NewBoltDB(dbPath)
	if err != nil {
		t.Fatalf("failed to create bolt db: %v", err)
	}
	defer boltDB.Close()

	lg := logger.DefaultLogger().Build()
	sock := NewCollectionSocket(&lg, boltDB.DB())
	if sock == nil {
		t.Fatal("expected non-nil CollectionSocket")
	}

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	io := cio.New(engine)
	sock.OnSpace(io.NewSpace)
	if sock.space == nil {
		t.Fatal("expected sock.space to be initialized after OnSpace")
	}

	// Should not panic when NotifyRefresh is called
	sock.NotifyRefresh(true)
}
