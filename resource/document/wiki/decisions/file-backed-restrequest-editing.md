# File-Backed Rest Request Editing

**Summary**: Request definitions remain canonical in the collection file on the filesystem. Backend mutations are currently serialized and written directly without optimistic version checks, while SHA-256 hashes remain available for responses and history.
**Sources**: `resource/document/raw/concepts/backend/IDE Like File Editor Design.md`, `shared/base/port.go`, `internal/service/restrequest/usecase.go`, `internal/service/collection/usecase.go`
**Last updated**: 2026-09-21

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
- `PUT /restrequest/tree/:collectionId`

The initial implementation required `baseVersion` and rejected stale updates. This check was temporarily removed on 2026-09-12: backend mutation DTOs no longer accept a version token, and stale clients are not rejected. SHA-256 versions remain in read and mutation responses and in [[decisions/collection-history-for-restrequest-mutations]].

## Storage And Writes

- The filesystem remains the source of truth for collection and request content.
- bbolt continues to store collection metadata, including `UpdatedAt`, but not request bodies.
- Collection mutations write serialized JSON directly with `os.WriteFile`.
- Service writes are serialized with a usecase mutex during this initial implementation.
- New headers receive stable IDs when the client does not provide one.

## Scope Boundaries

The first implementation deliberately does not add per-file actors, persistent revision history, patch operations, three-way merge, or watcher event journaling. Those remain the next synchronization stages described in [[concepts/backend/file-backed-editor-sync]].

## Consequences

Clients do not need to send a version when updating. The mutex still orders mutations handled by one usecase instance, but without a compare step the latest backend write can overwrite an external edit or a write based on older state. Direct writes also expose the destination file to partial-write risk if persistence is interrupted. Returned versions and history hashes are informational content identities, not concurrency guards.

## Related Pages

- [[concepts/backend/file-backed-editor-sync]]
- [[patterns/usecase/new-usecase-workflow]]
