# Wiki Log

- 2026-09-04: Added [[new-usecase-workflow]] based on `internal/service/collection/usecase.go` and `shared/api/default.go`.
- 2026-09-04: Ingested `resource/document/raw/patterns/backend/Example of Module Socket.md`; added [[example-of-module-socket]], [[socket-base-composition]], [[socket-room-lifecycle]], [[socket-event-broadcasting]], and [[socket-error-handling]], and updated the wiki index.
- 2026-09-04: Ingested `resource/document/raw/patterns/backend/Example of Module Controller.md`; added [[example-of-module-controller]], [[controller-base-structure]], [[controller-request-handling]], and [[controller-routing-and-middleware]], and updated the wiki index.
- 2026-09-04: Reorganized wiki pages into `patterns/controller`, `patterns/socket`, and `patterns/usecase`; added category indexes for `patterns`, `decisions`, and `concepts`, qualified wiki-links with paths, and updated `AGENTS.md` and the root index.
- 2026-09-04: Updated [[patterns/usecase/new-usecase-workflow]] to document repository injection after the collection usecase constructor was refactored.
- 2026-09-04: Added the controller placement rule: new controller files belong under `internal/adapter/controller/<module>`.
- 2026-09-07: Added [[patterns/frontend/create-new-tabs-kind]] and [[patterns/frontend/index]] documenting the editor tab-kind workflow and a simple Redux slice example.
- 2026-09-08: Ingested `resource/document/raw/concepts/frontend/Redux Tool Kit.md`; added [[concepts/frontend/redux-toolkit]], updated frontend and concept indexes, and recorded the frontend Redux state reset as historical context.
- 2026-09-08: Updated controller, usecase, and socket patterns to require repository-backed usecase constructors to accept `*bbolt.DB` and create typed repositories with `db.NewRepository` instead of using `shared/api/default.go` `initRepositories`.
- 2026-09-08: Ingested `resource/document/raw/concepts/backend/IDE Like File Editor Design.md`; added the file-backed editor synchronization concept and the `restrequest` request-editing decision, and updated wiki indexes.
- 2026-09-08: Added [[decisions/collection-history-for-restrequest-mutations]] proposing the `collection_history` entity for old/new values, hashes, and affected JSON lines on successful backend `restrequest` mutations; no application code changed.
- 2026-09-08: Implemented `collection_history` recording in the backend `restrequest` URL and header mutation endpoints, including structured old/new values, hashes, and committed JSON line numbers.
- 2026-09-08: Extended the backend `restrequest` API with optimistic, history-backed mutations for method, query parameters, JSON and multipart form-data bodies, and post-request scripts; updated the file-backed editing decision.
- 2026-09-08: Added version-checked request deletion with nested collection removal and history recording.
- 2026-09-08: Extended the REST request response with query, body, and post-request script data for the local frontend editor.
