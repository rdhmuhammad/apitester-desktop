# File-Backed Rest Request Editing

**Summary**: Request definitions remain canonical in the collection file on the filesystem. The `restrequest` service coordinates safe request edits with optimistic version checks, while bbolt stores only collection metadata.
**Sources**: `resource/document/raw/concepts/backend/IDE Like File Editor Design.md`
**Last updated**: 2026-09-08

---

## Decision

Implement request editing as a dedicated `internal/service/restrequest` usecase over the existing collection JSON format. The service exposes request retrieval and updates for method, URL, headers, query parameters, JSON and multipart form-data bodies, and post-request scripts.

The initial endpoints are:

- `GET /restrequest/:collectionId/:requestId`
- `PUT /restrequest/:collectionId/:requestId/url`
- `PUT /restrequest/:collectionId/:requestId/headers`
- `PUT /restrequest/:collectionId/:requestId/method`
- `PUT /restrequest/:collectionId/:requestId/query`
- `PUT /restrequest/:collectionId/:requestId/body/json`
- `PUT /restrequest/:collectionId/:requestId/body/formdata`
- `PUT /restrequest/:collectionId/:requestId/script/post-request`
- `DELETE /restrequest/:collectionId/:requestId`

Update requests include `baseVersion`. The service derives the version from the SHA-256 hash of the current collection file and rejects stale updates instead of silently overwriting changes.

## Storage And Writes

- The filesystem remains the source of truth for collection and request content.
- bbolt continues to store collection metadata, including `UpdatedAt`, but not request bodies.
- Writes use a temporary file, `Sync`, close, and atomic rename.
- Service writes are serialized with a usecase mutex during this initial implementation.
- New headers receive stable IDs when the client does not provide one.

## Scope Boundaries

The first implementation deliberately does not add per-file actors, persistent revision history, patch operations, three-way merge, or watcher event journaling. Those remain the next synchronization stages described in [[concepts/backend/file-backed-editor-sync]].

## Consequences

Clients must read the current request and send its returned `version` when updating. A stale client receives a validation error and must reload before retrying. This prevents the initial API from losing external filesystem edits, while leaving room to replace the mutex and hash token with a per-file actor and monotonic metadata version later.

## Related Pages

- [[concepts/backend/file-backed-editor-sync]]
- [[patterns/usecase/new-usecase-workflow]]
