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
- `PYTHON_SERVICE_URL` — base URL of the Python automation service (default `http://localhost:5000`); the `python/` Flask app (`ansible-runner`) executes playbooks for the `automation` usecase

## Python Automation Service (`python/`)

### Stack
- **Flask** app factory (`create_app` in `app/__init__.py`), served via `wsgi.py` (port 5000)
- **`ansible-runner` 2.4.0 + `ansible-core` 2.19.1** — executes playbooks asynchronously (`run_async`)
- **Runs on Windows** via the compat layer below (ansible-core only supports POSIX control nodes otherwise)

### Project Layout
```
python/
  wsgi.py                # Entry point: python wsgi.py (0.0.0.0:5000)
  app/
    __init__.py          # create_app(); imports app.compat
    config.py            # ANSIBLE_RUNNER_DIR, ANSIBLE_PROCESS_ISOLATION, MAX_CONCURRENT_JOBS
    api/                 # Blueprint: POST /api/v1/jobs/run, GET /api/v1/jobs/<id>, GET /api/v1/runtime
      routes.py schemas.py
    services/runner_service.py  # playbook/inventory path resolution, run_async trigger, event_handler, runtime info
    tasks/queue.py       # Job/JobRegistry: status = running/successful/failed + stdout + rc + duration_ms
    compat/              # Windows compatibility layer (see below)
  ansible_data/          # private_data_dir: project/, inventory/, env/
  tests/                 # pytest (mock ansible_runner) + real-run integration smoke
```

### Windows compatibility layer (`app/compat/`)
The service makes `ansible-runner`/`ansible-core` run on a Windows control node. `deployment/desktop/build-ansible-runtime.ps1` applies equivalent fixes by patching the bundled runtime's site-packages; the dev venv gets them at runtime instead:

1. **`app/compat/__init__.py`** — sets `PYTHONUTF8=1`, prepends `app/compat` to `PYTHONPATH` (so child ansible interpreters auto-load `sitecustomize.py`), installs `sys.modules` shims for POSIX-only `fcntl`/`termios`/`pwd`/`grp`, and `patch_ansible_runner()` (must be called after `import ansible_runner`):
   - pexpect has no `spawn` on win32 → maps it to a `WindowsSpawn(PopenSpawn)` adding the `isalive`/`close`/`terminate` API ansible-runner's runner.py needs
   - `Runner.handle_termination` (uses `os.getpgid`/`os.killpg`) → `os.kill(pid, 9)` fallback on Windows
2. **`app/compat/sitecustomize.py`** — auto-loaded by every child `ansible-playbook` process (and its spawn workers) via `PYTHONPATH`; monkeypatches:
   - locale check: `locale.getlocale()` reports UTF-8 when `PYTHONUTF8=1` (Windows locales are cp1252)
   - `multiprocessing.get_context('fork')` → `spawn` (no fork on Windows)
   - no-op `os.register_at_fork`/`os.setsid`, `os.O_NONBLOCK = 0`
   - libc `wcwidth`/`wcswidth` ctypes stub for `ansible/utils/display.py`
   - import hooks re-adding `ansible/parsing/dataloader.py`'s `RE_TASKS` (raw `os.path.sep` breaks the regex) and `ansible/_internal/_datatag/_tags.py`'s `Origin._post_validate` (`os.path.isabs` instead of `startswith('/')`)
   - `WorkerProcess.run` calls `init_plugin_loader()` first (spawn workers are fresh interpreters)
   - `ShellBase._normalize_system_tmpdirs` substitutes `tempfile.gettempdir()` for the POSIX `/tmp` defaults
   - `_wrapt.ObjectProxy` becomes picklable (restores the proxy around its wrapped object) — spawn requires pickling the whole `WorkerProcess` state, including `PluginInterposer`/`HostVars` proxies
3. **`app/compat/{fcntl,termios,pwd,grp}.py`** — minimal POSIX shims (fcntl `_fd()` helper accepts int fds and file objects)

### Notes / gotchas
- **localhost targets on Windows** hit `C.DEFAULT_EXECUTABLE` (`/bin/sh`) in `plugins/connection/local.py` — pure action tasks (`debug`/`set_fact`/`assert`) work, but `command`/`shell`/`ping` do not. Real automation targets remote hosts via SSH.
- The compat mechanism assumes the service is run with a **venv python** whose `Scripts/` contains `ansible-playbook.exe` (the same wheel set the build script bundles).

### Running Python Service
```bash
cd python
uv venv .venv && uv pip install -r requirements.txt   # or: python -m venv .venv ...
python wsgi.py   # 0.0.0.0:5000
```

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