# File-Backed Editor Synchronization

**Summary**: The editor treats files on disk as canonical and uses the Go service to coordinate IDE edits with external filesystem changes. Version checks, hashes, atomic writes, and serialized file coordination prevent silent overwrites.
**Sources**: `resource/document/raw/concepts/backend/IDE Like File Editor Design.md`
**Last updated**: 2026-09-08

---

## Core Model

Separate persisted file state from the user's unsaved document state. File metadata includes a path, version, hash, and modification time; a document includes its base version, dirty state, and editing buffer.

Every change should be associated with the version from which it was created. IDE patches use `baseVersion`, while external edits are detected by a filesystem watcher, hashed, assigned a new version, and broadcast to clients.

## Safe Coordination

The file coordinator is the serialization point for IDE edits, filesystem events, saves, renames, and deletes. Actors should be created lazily for active files rather than for every file in a workspace.

Writes should use a temporary file, flush it, and atomically rename it into place. Expected hashes distinguish the service's own writes from external changes. Watcher notifications should be debounced and coalesced by path because editors may emit multiple low-level events for one save.

When an edit's base version is stale, the service must not overwrite the current file. A later implementation can use a three-way merge between the base, IDE changes, and current filesystem content; conflicts should remain visible to the user.

## API Tester Application

The first application of this model is [[decisions/file-backed-restrequest-editing]]. The `restrequest` service updates request URLs and headers in collection files using a SHA-256 content version and atomic writes. Per-file actors, watcher integration, and persistent journals are intentionally deferred.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[patterns/usecase/new-usecase-workflow]]
