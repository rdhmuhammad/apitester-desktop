# Collection History For Restrequest Mutations

**Summary**: The `collection_history` entity records successful REST request mutations, including the old and new change values, collection file hashes, and the source line affected in the collection JSON file.
**Sources**: `shared/base/port.go`, `internal/service/restrequest/usecase.go`, `internal/service/collection/usecase.go`, `internal/domain/collection.go`, `pkg/db/repository.go`, `resource/document/wiki/decisions/file-backed-restrequest-editing.md`
**Last updated**: 2026-09-12

---

## Decision

The backend now uses a domain entity named `CollectionHistory`, persisted in the `collection_history` bbolt bucket, to provide an append-only audit trail for mutations handled by the backend `restrequest` service.

The history record is created only after the collection file has been written and the collection metadata update has succeeded. Failed reads, missing requests, serialization failures, file-write failures, and metadata-write failures must not create history records. Backend `baseVersion` checks and atomic replacement are currently disabled as described in [[decisions/file-backed-restrequest-editing]].

The first mutation sources are:

- `UpdateURL`
- `UpdateHeaders`

The design should be reusable for future REST request mutation endpoints without coupling history storage to a particular field.

## Proposed Record

Each `collection_history` record should contain:

- A unique history ID and creation timestamp.
- `collection_id` and `request_id` identifying the affected data.
- The mutation operation, such as `update_url` or `update_headers`.
- The changed field or path, such as `request.url` or `request.headers`.
- The old value and new value, stored as JSON-compatible snapshots rather than display-only strings. This preserves structured URL and header changes and supports later inspection.
- `old_hash`, the SHA-256 hash of the collection bytes loaded before the mutation.
- `new_hash`, the SHA-256 hash of the serialized bytes passed to the successful collection write.
- `file_path` identifying the collection file at mutation time.
- `line`, the one-based line in the written collection JSON where the affected request or field is located.

The record should also retain enough path context to disambiguate repeated request names, for example a request ID and a JSON path. The request ID is authoritative; names are descriptive only.

## Hash And Line Semantics

`RecordHistory` retains the SHA-256 byte-level definition independently of optimistic concurrency. `old_hash` identifies the exact content loaded before the mutation, and `new_hash` identifies the serialized content returned by the successful write operation. These hashes remain populated even though the backend no longer compares an incoming `baseVersion`.

Line numbers should be calculated against the exact serialized content written to disk, not the pre-mutation input. Because JSON formatting and array positions can change, the line is an observation of the committed file, not a permanent identity for the request. The request ID and JSON path remain the stable references.

If a precise field line cannot be identified reliably, record the containing request's line and make the scope explicit rather than inventing a line number. This should be treated as a design/test concern before implementation.

## Consistency And Ordering

History creation belongs inside the existing serialized mutation flow. The intended order is:

1. Load the collection and retain its bytes for the old hash.
2. Capture the old field value and old file hash.
3. Apply the requested change and directly write the new collection content.
4. Update collection metadata.
5. Append the `collection_history` record with the committed new hash and line.

The file remains the source of truth for collection content. bbolt stores the audit metadata and does not replace the collection file. Since filesystem writes and bbolt writes cannot share one transaction, implementation must define and test recovery behavior if the final history write fails after the file commit. The preferred initial behavior is to return the history persistence error and expose a reconciliation path rather than silently claim that the audit record exists.

History records must not be updated or deleted through the initial REST request API. Retention, filtering, pagination, and rollback are separate decisions.

## Scope Boundaries

This decision does not add history listing routes, migrations, rollback behavior, or history endpoints. It also does not require recording external filesystem edits detected by watchers; the implementation covers mutations initiated by the backend `restrequest` service only.

## Consequences

Successful request edits become traceable without moving request content out of the collection file. The database gains an append-only audit bucket and each mutation incurs an additional persistence operation. Hashes provide content identity, while request IDs and JSON paths provide stable references when line numbers shift after later writes.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[concepts/backend/file-backed-editor-sync]]
- [[patterns/usecase/new-usecase-workflow]]
