package base

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rdhmuhammad/apitester/internal/domain"
	"github.com/rdhmuhammad/apitester/pkg/db"
	"github.com/rdhmuhammad/apitester/pkg/localerror"
	"github.com/rdhmuhammad/apitester/pkg/logger"
	"go.etcd.io/bbolt"
)

// Port is a reusable base that provides collection file handling,
// versioning (sha256), atomic persistence and history recording.
// Embed this struct in usecases to reuse the same behaviour across
// restrequest, collection variable and other collection-mutating flows.
//
// It intentionally mirrors the logic previously duplicated in
// internal/service/restrequest/usecase.go lines 203, 229, 259, 281.
type Port struct {
	WriteMu        sync.Mutex
	CollectionRepo db.RepositoryInterface[domain.Collection]
	HistoryRepo    db.RepositoryInterface[domain.CollectionHistory]
	ErrHandler     localerror.HandleError
}

// NewPort constructs a Port with collection and history repositories.
func NewPort(lg logger.Logger, database *bbolt.DB) *Port {
	collectionRepo, err := db.NewRepository[domain.Collection](database)
	if err != nil {
		panic(err)
	}
	historyRepo, err := db.NewRepository[domain.CollectionHistory](database, db.WithBucketName("collection_history"))
	if err != nil {
		panic(err)
	}
	return &Port{
		CollectionRepo: collectionRepo,
		HistoryRepo:    historyRepo,
		ErrHandler:     localerror.NewHandlerError(lg),
	}
}

// LoadCollection loads a collection record and its raw file content.
// It strips BOM and returns the raw bytes (trimmed) together with the
// domain collection. The caller is responsible for unmarshalling the
// content into its own DocsContent type. This avoids a circular import
// on collection service DTOs.
func (p *Port) LoadCollection(id string) (*domain.Collection, []byte, error) {
	collection, err := p.CollectionRepo.View(context.Background(), id)
	if err != nil {
		return nil, nil, p.ErrHandler.ErrorReturn(err)
	}
	if collection == nil {
		return nil, nil, localerror.InvalidData("Collection not found")
	}
	content, err := os.ReadFile(collection.Path)
	if err != nil {
		return nil, nil, p.ErrHandler.ErrorReturn(err)
	}
	content = []byte(strings.TrimPrefix(string(content), "\uFEFF"))
	return collection, content, nil
}

// SaveCollection atomically writes content to the collection file and
// updates the collection's UpdatedAt timestamp in the repository.
// Content must already be marshalled (e.g. via json.MarshalIndent).
func (p *Port) SaveCollection(collection *domain.Collection, content []byte) ([]byte, error) {
	if err := atomicWrite(collection.Path, content); err != nil {
		return nil, p.ErrHandler.ErrorReturn(err)
	}
	collection.UpdatedAt = time.Now()
	if err := p.CollectionRepo.Update(context.Background(), collection.ID, collection); err != nil {
		return nil, p.ErrHandler.ErrorReturn(err)
	}
	return content, nil
}

// Version returns the hex-encoded sha256 hash of the file content.
// It is used for optimistic concurrency control (baseVersion checks).
func (p *Port) Version(content []byte) string {
	hash := sha256.Sum256(content)
	return hex.EncodeToString(hash[:])
}

// RecordHistory persists a CollectionHistory entry describing a mutation.
// oldValue / newValue are marshalled to JSON. The method mirrors
// restrequest/usecase.go::recordHistory (line 229).
func (p *Port) RecordHistory(collection *domain.Collection, requestID, operation, field string, oldValue, newValue any, oldContent, newContent []byte) error {
	oldJSON, err := json.Marshal(oldValue)
	if err != nil {
		return p.ErrHandler.ErrorReturn(err)
	}
	newJSON, err := json.Marshal(newValue)
	if err != nil {
		return p.ErrHandler.ErrorReturn(err)
	}
	line := p.MutationLine(newContent, requestID, field)
	history := domain.CollectionHistory{
		ID:           uuid.NewString(),
		CollectionID: collection.ID,
		RequestID:    requestID,
		Operation:    operation,
		Field:        field,
		OldValue:     oldJSON,
		NewValue:     newJSON,
		OldHash:      p.Version(oldContent),
		NewHash:      p.Version(newContent),
		FilePath:     collection.Path,
		Line:         line,
		CreatedAt:    time.Now(),
	}
	if err := p.HistoryRepo.Create(context.Background(), history.ID, &history); err != nil {
		return p.ErrHandler.ErrorReturn(err)
	}
	return nil
}

// MutationLine attempts to locate the line number in content that
// corresponds to the mutated field for the given searchID. It is a
// best-effort helper for the history entry and mirrors the logic in
// restrequest/usecase.go.
func (p *Port) MutationLine(content []byte, searchID, field string) int {
	lines := strings.Split(string(content), "\n")
	quotedID, _ := json.Marshal(searchID)
	requestLine := 1
	for i, line := range lines {
		if searchID != "" && strings.Contains(line, `"id": `+string(quotedID)) {
			requestLine = i + 1
			for j := i; j < len(lines); j++ {
				if strings.Contains(lines[j], `"`+field[strings.LastIndex(field, ".")+1:]+`":`) {
					return j + 1
				}
			}
			return requestLine
		}
		if searchID == "" && strings.Contains(line, `"`+field[strings.LastIndex(field, ".")+1:]+`":`) {
			return i + 1
		}
	}
	// Fallback: search for field name directly without scoping to ID.
	if field != "" {
		short := field[strings.LastIndex(field, ".")+1:]
		for j, l := range lines {
			if strings.Contains(l, `"`+short+`":`) {
				return j + 1
			}
		}
	}
	return requestLine
}

// Update executes the classic optimistic-locking mutation pattern
// (previously at restrequest/usecase.go:203). It locks WriteMu, loads
// the collection, checks BaseVersion, runs the caller-provided apply
// callback that should mutate the unmarshalled docs and return oldValue,
// then persists and records history.
//
// apply receives the raw oldContent and is expected to return:
// - oldValue: value before mutation (for history)
// - newValue: value after mutation (for history)
// - newContent: marshalled updated file content
// - err: if non-nil the update is aborted.
//
// This keeps the critical section generic while reusing versioning,
// history and atomic write logic via Port.
func (p *Port) Update(collectionID, requestID, baseVersion, operation, field string, apply func(oldContent []byte) (oldValue any, newValue any, newContent []byte, err error)) ([]byte, error) {
	p.WriteMu.Lock()
	defer p.WriteMu.Unlock()

	collection, oldContent, err := p.LoadCollection(collectionID)
	if err != nil {
		return nil, err
	}
	if p.Version(oldContent) != baseVersion {
		return nil, localerror.InvalidData("Request has changed; reload before updating")
	}
	oldValue, newValue, newContent, err := apply(oldContent)
	if err != nil {
		return nil, err
	}
	saved, err := p.SaveCollection(collection, newContent)
	if err != nil {
		return nil, err
	}
	if err := p.RecordHistory(collection, requestID, operation, field, oldValue, newValue, oldContent, saved); err != nil {
		return nil, err
	}
	return saved, nil
}

// atomicWrite writes content to path atomically via a temp file and
// rename. It is extracted from restrequest/atomic_write.go.
func atomicWrite(path string, content []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".apitester-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if err := tmp.Chmod(0644); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
