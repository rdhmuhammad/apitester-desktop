# New Usecase Workflow

**Summary**: New Go usecases in this project are built around a dependency-owning `Usecase` struct, a constructor that initializes shared services and repositories, and methods that validate and persist domain entities. When a usecase needs a repository, its constructor receives the shared `*bbolt.DB` and creates the typed repository dependencies itself.
**Sources**: `internal/service/collection/usecase.go`, `pkg/db/repository.go`, `shared/api/default.go`
**Last updated**: 2026-09-15

---

## Reference implementation

The reference implementation is `internal/service/collection/usecase.go`. Its workflow is:

1. Define a `Usecase` struct containing the dependencies required by the feature. The collection usecase owns a file watcher, an error handler, and repositories for collections, test suites, and automations.
2. Add a `NewUsecase` constructor with the logger and shared `*bbolt.DB` connection.
3. Initialize shared services with `watcher.New(lg)` and `localerror.NewHandlerError(lg)`.
4. Create each required typed repository with `db.NewRepository` inside the constructor, including explicit bucket options when needed.
5. Assign each repository to the usecase.
6. Return the fully configured `*Usecase`, handling repository initialization failures immediately.
7. Register the service's controller in `shared/api/default.go` so its routes are included in the API.

## Struct and constructor example

The collection usecase keeps its feature dependencies as fields on `Usecase`:

```go
type Usecase struct {
	watcher        *watcher.FileWatcher
	errHandler     localerror.HandleError
	collectionRepo db.RepositoryInterface[domain.Collection]
	testSuiteRepo  db.RepositoryInterface[domain.TestSuite]
	automationRepo db.RepositoryInterface[domain.Automation]
}
```

Its constructor creates shared services and typed repositories from the database connection. A new usecase should keep only the dependencies it actually needs:

```go
func NewUsecase(
	lg logger.Logger,
	database *bbolt.DB,
) *Usecase {
	collectionRepo, err := db.NewRepository[domain.Collection](database)
	if err != nil {
		panic(err)
	}
	testSuiteRepo, err := db.NewRepository[domain.TestSuite](database, db.WithBucketName("TestSuite"))
	if err != nil {
		panic(err)
	}
	automationRepo, err := db.NewRepository[domain.Automation](database, db.WithBucketName("Automation"))
	if err != nil {
		panic(err)
	}

	fw := watcher.New(lg)
	if selected := findSelectedCollection(collectionRepo); selected != nil {
		fw.Watch(selected.Path)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		watcher:        fw,
		collectionRepo: collectionRepo,
		testSuiteRepo:  testSuiteRepo,
		automationRepo: automationRepo,
	}
}
```

For a smaller usecase, the same pattern can be reduced to the required repository and shared services:

```go
type Usecase struct {
	errHandler     localerror.HandleError
	collectionRepo db.RepositoryInterface[domain.Collection]
}

func NewUsecase(
	lg logger.Logger,
	database *bbolt.DB,
) *Usecase {
	collectionRepo, err := db.NewRepository[domain.Collection](database)
	if err != nil {
		panic(err)
	}

	return &Usecase{
		errHandler:     localerror.NewHandlerError(lg),
		collectionRepo: collectionRepo,
	}
}
```

The application composition layer opens the database and passes the shared `*bbolt.DB` into the usecase constructor. The usecase creates each typed repository from that connection. This keeps entity-specific repository wiring close to the dependency-owning usecase while still allowing tests to replace repository dependencies when constructing the usecase directly.

## Implementing operations

Usecase methods should own the feature workflow rather than expose storage details. For example, `CreateCollection`:

- Generates the entity ID and timestamps.
- Assigns related module IDs for the test suite and automation records.
- Persists the entity through `collectionRepo.Create`.
- Converts persistence failures through the configured error handler.
- Returns the created domain entity.

Keep related reconciliation in focused helpers. The collection usecase uses `ensureModuleEntities` to create or repair related records and `updateModulePaths` to keep module paths synchronized when a collection changes.

## Checklist

- Define the `Usecase` struct and only the dependencies it needs.
- Add a constructor that accepts `*bbolt.DB`, initializes shared services, and creates each required repository with `db.NewRepository`.
- Fail fast when repository initialization fails; do not hide `db.NewRepository` errors.
- Implement methods following the mandatory [[patterns/usecase/usecase-rules-of-engagement]] (error return wrapping, context paragraphing, 4-line helper extraction, max 3 params, max 2 returns, struct setters/getters, and context propagation).
- Validate missing entities and map errors consistently with `localerror`.
- Keep cross-entity synchronization in helpers where it is non-trivial.
- Wire the controller into `shared/api/default.go`.
- Add or update tests for constructor failures and each public operation.

The exact dependencies and methods vary by feature. The collection usecase is a pattern to follow, not a requirement that every usecase needs a watcher or the same three repositories.

## Related pages

- [[patterns/usecase/usecase-rules-of-engagement]]
- [[decisions/usecase-rules-of-engagement]]
- [[concepts/backend/usecase-design-rules]]
