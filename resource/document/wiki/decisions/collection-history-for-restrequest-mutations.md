# Collection History For Restrequest Mutations

**Summary**: The `collection_history` entity records successful REST request mutations, including the old and new change values, collection file hashes, and the source line affected in the collection JSON file.
**Sources**: `internal/service/restrequest/usecase.go`, `internal/service/restrequest/dto.go`, `internal/service/restrequest/atomic_write.go`, `internal/domain/collection.go`, `pkg/db/repository.go`, `resource/document/wiki/decisions/file-backed-restrequest-editing.md`
**Last updated**: 2026-09-08

---

## Decision

The backend now uses a domain entity named `CollectionHistory`, persisted in the `collection_history` bbolt bucket, to provide an append-only audit trail for mutations handled by the backend `restrequest` service.

The history record is created only after the collection file has been atomically replaced and the collection metadata update has succeeded. Failed reads, missing requests, stale `baseVersion` checks, serialization failures, file-write failures, and metadata-write failures must not create history records.

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
- `old_hash`, the SHA-256 hash supplied and verified as `baseVersion` before the mutation.
- `new_hash`, the SHA-256 hash of the bytes successfully written to the collection file.
- `file_path` identifying the collection file at mutation time.
- `line`, the one-based line in the written collection JSON where the affected request or field is located.

The record should also retain enough path context to disambiguate repeated request names, for example a request ID and a JSON path. The request ID is authoritative; names are descriptive only.

## Hash And Line Semantics

The existing REST request service already treats the SHA-256 hash of the collection file as the optimistic concurrency version. The history record should use that same byte-level definition so `old_hash` matches the accepted `baseVersion` and `new_hash` matches the committed file content returned by the write operation.

Line numbers should be calculated against the exact serialized content written to disk, not the pre-mutation input. Because JSON formatting and array positions can change, the line is an observation of the committed file, not a permanent identity for the request. The request ID and JSON path remain the stable references.

If a precise field line cannot be identified reliably, record the containing request's line and make the scope explicit rather than inventing a line number. This should be treated as a design/test concern before implementation.

## Consistency And Ordering

History creation belongs inside the existing serialized mutation flow. The intended order is:

1. Load the collection and verify `baseVersion`.
2. Capture the old field value and old file hash.
3. Apply the requested change and atomically write the new collection content.
4. Update collection metadata.
5. Append the `collection_history` record with the committed new hash and line.

The file remains the source of truth for collection content. bbolt stores the audit metadata and does not replace the collection file. Since filesystem replacement and bbolt writes cannot share one transaction, implementation must define and test recovery behavior if the final history write fails after the file commit. The preferred initial behavior is to return the history persistence error and expose a reconciliation path rather than silently claim that the audit record exists.

History records must not be updated or deleted through the initial REST request API. Retention, filtering, pagination, and rollback are separate decisions.

## Scope Boundaries

This decision does not add history listing routes, migrations, rollback behavior, or history endpoints. It also does not require recording external filesystem edits detected by watchers; the implementation covers mutations initiated by the backend `restrequest` service only.

## Consequences

Successful request edits become traceable without moving request content out of the collection file. The database gains an append-only audit bucket and each mutation incurs an additional persistence operation. Hashes provide content identity, while request IDs and JSON paths provide stable references when line numbers shift after later writes.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[concepts/backend/file-backed-editor-sync]]
- [[patterns/usecase/new-usecase-workflow]]
