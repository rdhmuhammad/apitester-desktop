# AGENTS.md

API Tester — a Go (Gin) backend + React (Vite/Redux) frontend for hosting and running API collections (Postman-compatible).

## Backend

### Stack
- **Language:** Go 1.25.0, module `github.com/rdhmuhammad/apitester`
- **HTTP framework:** `gin-gonic/gin` v1.12.0
- **Active persistence:** `go.etcd.io/bbolt` v1.5.0 (embedded key-value store)
- **Built/unused GORM:** `gorm.io/gorm` + MySQL driver — fully implemented `GenericRepository[T]`, `CustomORM`, `DBTransaction` in `pkg/db/` but not wired into the current watch feature
- **Logging:** `rs/zerolog` + `getsentry/sentry-go`
- **File watching:** `fsnotify/fsnotify`
- **Config:** `joho/godotenv` (`.env.stag` default)
- **Windows service:** `golang.org/x/sys/windows/svc`

### Project Layout
```
cmd/
  api/main.go          # Primary HTTP server entry point
  windows/main.go      # Windows Service entry point (wraps api.Default())
internal/
  domain/              # Domain entities (Collection)
  usecase/<feature>/   # Feature-grouped: controller.go + usecase.go + dto.go together
pkg/
  bbolt/               # BoltDB connection + generic RepositoryInterface[T any]
  db/                  # GORM/MySQL: GenericRepository[T], CustomORM, DBTransaction
  environment/         # Typed env-var reader (not currently used)
  localerror/          # Custom error types: InvalidDataError, AccessControlError, InternalError
  logger/              # zerolog structured logger (ReZero) + Sentry catcher
  mapper/              # Response mapper — domain responses → Gin JSON (NewResponse)
  middleware/           # CORS middleware (wildcard *)
  watcher/             # fsnotify-based FileWatcher for collection files
shared/
  api/                 # Api struct (Gin Engine + lifecycle), Router interface, Default() wiring
  payload/             # HTTP response DTOs (Response, ErrorResponse, factory functions)
```

### Entry Points
- **`cmd/api/main.go`** — loads `.env` (default `.env.stag`, override with `--env`), calls `api.Default()` → `api.Start()`
- **`cmd/windows/main.go`** — Windows Service wrapper; same `api.Default()` core; supports `--debug` console mode; graceful shutdown with 5s timeout via `x/sync/errgroup`

### Wiring / Dependency Injection
No DI framework. Manual constructor-based wiring in `shared/api/default.go:10-27`:
```
Default()
  → gin.Default() + middleware.AllowCORS()
  → logger.DefaultLogger() (ReZero)
  → watch.NewController(&logger)
      → watch.NewUsecase(lg)
          → bbolt.NewBoltDB(path) → bbolt.NewRepository[domain.Collection](db)
          → watcher.New() (fsnotify)
          → localerror.NewHandlerError(lg)
```

### Router Interface
Defined in `shared/api/api.go:17-19`:
```go
type Router interface {
    Route(handler *gin.RouterGroup)
}
```
Each feature module implements `Router`. `api.Start()` iterates all routers and calls `Route(root)` where `root = "/api/v1"`. To add a new feature, implement `Router` and add it to the slice in `Default()`.

### Error Handling Pattern
1. **`pkg/localerror`** — three custom error types:
   - `InvalidDataError` → HTTP 400
   - `AccessControlError` → HTTP 401
   - `InternalError` → HTTP 500
2. **`HandleError.ErrorReturn(err)`** — classifies errors; if already a known type, returns as-is; otherwise logs and wraps in `InternalError`
3. **`mapper.Mapper.NewResponse(data, err)`** — converts to Gin JSON response (shared/payload types)

Controller pattern — every handler ends with:
```go
ctrl.mapper.NewResponse(result, ctrl.usecase.SomeMethod(ctx, input))
```

### Persistence: BoltDB
- Connection: `bbolt.NewBoltDB(path)` opens file, creates parent dir if needed
- Repository: `bbolt.NewRepository[T any](db, opts...)` — generic, type-safe CRUD
  - Bucket name auto-derived from `T`'s type name (override with `WithBucketName`)
  - Entities stored as JSON-marshaled bytes keyed by string ID
  - Interface: `Create`, `Update`, `Delete`, `View`, `List`, `Exists(ctx, id)`
- DB path: `BOLT_DB_PATH` env var or `UserConfigDir()/apitester/collection.db`

### Persistence: GORM/MySQL (built, not active)
- `pkg/db/default.go` — `Default()` connects via `MYSQL_*` env vars
- `pkg/db/generic_repository.go` — `GenericRepository[T schema.Tabler]` (~800 lines): full CRUD, pagination, expression queries, preloading, bulk ops
- `pkg/db/dbTransaction.go` — `DBTransaction` wraps GORM transactions with auto-commit/rollback
- `pkg/db/db-custome.go` — `CustomORM` for raw SQL building from struct tags

### Logging
- `pkg/logger/zerolog.go` — `ReZero`: wraps zerolog; level from `LOG_LEVEL` env; multi-output (console + optional file)
- `pkg/logger/logger.go` — Sentry integration via `SENTRY_DSN` + `SENTRY_ENVIRONMENT` env vars

### Configuration
All via `os.Getenv()`:
- `APP_PORT` — HTTP port (default in `.env.example`: `8999`)
- `BOLT_DB_PATH` — BoltDB file location
- `LOG_LEVEL` — zerolog level (`debug`/`info`/`warn`/`error`)
- `LOG_PATH` — Windows service log file
- `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DB_NAME`, `DB_LOG_MODE`
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- `BOLT_DB_PATH` — BoltDB file location

## Automation
- Playbooks, inventories, and their run configuration are managed by the Go API and frontend.
- Playbook execution is intentionally not implemented; the editor remains a static runner UI for the next implementation.

### Running Backend
```bash
go mod download
go run cmd/api/main.go --env .env.stag
```
## Key Conventions
- **Backend:** Feature modules live in `internal/usecase/<name>/` — controller, usecase, and DTOs are co-located
- **Backend:** `(data, error)` return pattern in usecases; classified by `mapper.NewResponse()` in controllers
- **Backend:** Repositories are generic and type-safe: `RepositoryInterface[T any]`
- **Backend:** New features plug in via the `Router` interface — no global route registries
- **Backend:** Environment-specific `.env` files: `.env.stag` (default), `.env.prod`
