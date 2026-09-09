# Wiki Index

This index lists the maintained knowledge pages for the API Tester codebase. Repository-backed usecases receive `*bbolt.DB` and create typed repositories locally with `db.NewRepository`; `shared/api/default.go` does not centralize repository construction.

## Patterns

### Controller

- [[patterns/controller/index]] - Controller pattern pages.
- [[patterns/controller/example-of-module-controller]] - Source summary and workflow for creating an HTTP controller module.
- [[patterns/controller/controller-base-structure]] - Shared controller embedding and narrow usecase interfaces.
- [[patterns/controller/controller-request-handling]] - Request binding, validation, context propagation, and responses.
- [[patterns/controller/controller-routing-and-middleware]] - Route grouping, authentication, authorization, and idempotency.

### Socket

- [[patterns/socket/index]] - Socket pattern pages.
- [[patterns/socket/example-of-module-socket]] - Source summary and workflow for creating a socket module.
- [[patterns/socket/socket-base-composition]] - Embedding shared socket dependencies in a feature module.
- [[patterns/socket/socket-room-lifecycle]] - Joining, leaving, caching, and notifying room members.
- [[patterns/socket/socket-event-broadcasting]] - Broadcasting messages and tracking acknowledgements.
- [[patterns/socket/socket-error-handling]] - Validating socket input and mapping errors to clients.

### Usecase

- [[patterns/usecase/index]] - Usecase pattern pages.
- [[patterns/usecase/new-usecase-workflow]] - Workflow and checklist for creating a new Go usecase, based on the collection service.

### Frontend

- [[patterns/frontend/index]] - Frontend pattern pages.
- [[patterns/frontend/api-service-and-query-hook-wiring]] - Typed Axios services and TanStack Query hooks for feature API wiring.
- [[patterns/frontend/create-new-tabs-kind]] - Workflow for adding a new editor tab kind and its Redux slice.

## Decisions

- [[decisions/index]] - Technical decisions recorded for the codebase.
- [[decisions/file-backed-restrequest-editing]] - Filesystem-backed request editing with atomic writes, optimistic version checks, and the REST-backed frontend editor.
- [[decisions/collection-history-for-restrequest-mutations]] - Proposed `collection_history` audit records for successful REST request mutations.

## Concepts

- [[concepts/index]] - Reusable domain and codebase concepts.
- [[concepts/backend/file-backed-editor-sync]] - Filesystem-backed editor coordination, versioning, hashing, and conflict handling.
- [[concepts/frontend/redux-toolkit]] - Modern Redux Toolkit structure, state boundaries, and data flow.
