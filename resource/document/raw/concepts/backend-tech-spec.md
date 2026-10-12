# Apitester Desktop Backend - Technical Specification

**Document Type**: Technical Specification & Architecture Design  
**Target Path**: `resource/document/raw/concepts/backend-tech-spec.md`  
**System**: Apitester Desktop Backend (`github.com/rdhmuhammad/apitester`)  
**Language & Runtime**: Go 1.26.0 (Windows Service / Cross-platform HTTP + WebSocket server)  
**Last Updated**: 2026-10-12  

---

## Table of Contents
1. [Overview & System Architecture](#1-overview--system-architecture)
2. [Design Patterns & Code Architecture](#2-design-patterns--code-architecture)
   - [Architectural Paradigm: Ports and Adapters (Hexagonal)](#architectural-paradigm-ports-and-adapters-hexagonal)
   - [File-Backed Canonical Storage Pattern](#file-backed-canonical-storage-pattern)
   - [Presentation & Transport Adapters](#presentation--transport-adapters)
   - [Application Service / Usecase Layer](#application-service--usecase-layer)
   - [Domain Entities](#domain-entities)
   - [Persistence Layer & Repository Pattern](#persistence-layer--repository-pattern)
   - [Reactive File Watcher & Change Synchronization](#reactive-file-watcher--change-synchronization)
   - [Cross-Cutting Concerns & Utilities](#cross-cutting-concerns--utilities)
3. [Libraries & Dependencies](#3-libraries--dependencies)
   - [Core / Direct Dependencies](#core--direct-dependencies)
   - [Indirect & Utility Libraries](#indirect--utility-libraries)
   - [Build & Code Generation Tools](#build--code-generation-tools)
4. [Service Dependencies & Data Stores](#4-service-dependencies--data-stores)
   - [Embedded Key-Value Store (BoltDB)](#embedded-key-value-store-boltdb)
   - [Local Filesystem Data Stores](#local-filesystem-data-stores)
   - [Windows OS Service Infrastructure](#windows-os-service-infrastructure)
   - [Client & Upstream Service Interactions](#client--upstream-service-interactions)
5. [Transport Protocols & API Specifications](#5-transport-protocols--api-specifications)
   - [HTTP / RESTful API (TCP / HTTP 1.1)](#http--restful-api-tcp--http-11)
   - [HTTP Route Catalog](#http-route-catalog)
   - [WebSockets & Socket.IO Specification](#websockets--socketio-specification)
   - [Socket.IO Event Inventory & Payloads](#socketio-event-inventory--payloads)

---

## 1. Overview & System Architecture

The **Apitester Desktop Backend** is a local daemon and API engine written in **Go 1.26**. It powers the Apitester Desktop client (Electron + React) for API testing, environment orchestration, automated HTTP test suites, and playbook automations.

The backend can execute in two modes:
1. **Interactive CLI / Standalone Server** (`cmd/api/main.go`): Run via command line flags for staging/development.
2. **Native Windows Service** (`cmd/windows/main.go`): Background service managed by the Windows Service Control Manager (SCM), executing under service name `Apitester-backend`.

### High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    Electron UI                                        |
+-------------------------------------------+-------------------------------------------+
                                            |
                         HTTP / REST API    |   WebSockets (Socket.IO v3)
                         (Port APP_PORT)    |   (/socket.io)
                                            v
+---------------------------------------------------------------------------------------+
|                               Apitester Backend Daemon                                 |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                     Transport Layer (Adapters: Controller & Socket)             |  |
|  |   - Controllers: collection, tree, restrequest, environment, testsuits, auto    |  |
|  |   - Sockets: /collection (refresh), /restrequest (granular mutation events)      |  |
|  +----------------------------------------+----------------------------------------+  |
|                                           |                                           |
|                                           v                                           |
|  +---------------------------------------------------------------------------------+  |
|  |                     Application Layer (Usecases / Services)                     |  |
|  |   - collection, restrequest, tree, environment, testsuits, automation           |  |
|  |   - Implements Usecase Rules of Engagement (SRP, Parameter budgets)             |  |
|  +----------------------------------------+----------------------------------------+  |
|                                           |                                           |
|                                           v                                           |
|  +---------------------------------------------------------------------------------+  |
|  |                     Shared Base Port (`shared/base/port.go`)                    |  |
|  |   - Mutex Concurrency Control (WriteMu)                                         |  |
|  |   - SHA-256 Versioning & Content Hashing                                        |  |
|  |   - Collection History & Mutation Line Tracking                                 |  |
|  |   - File System Read/Write + State Notification                                 |  |
|  +---------------------+-----------------------------------+-----------------------+  |
|                        |                                   |                          |
|                        v                                   v                          |
|         +-----------------------------+     +-----------------------------+           |
|         |    BoltDB Repository        |     |     fsnotify Watcher        |           |
|         |    (`pkg/db/repository.go`) |     |  (`pkg/watcher/watcher.go`) |           |
|         +--------------+--------------+     +--------------+--------------+           |
+------------------------|-----------------------------------|--------------------------+
                         |                                   |
                         v                                   v
             +-----------------------+           +-----------------------+
             |    collection.db      |           |    Local Filesystem   |
             |  (Metadata & History) |           |  (collection.json,    |
             +-----------------------+           |   .http, .yaml files) |
                                                 +-----------------------+
```

---

## 2. Design Patterns & Code Architecture

### Architectural Paradigm: Ports and Adapters (Hexagonal)
The codebase adheres to **Clean Architecture / Ports and Adapters (Hexagonal Architecture)**:
- **Core Domain & Use Cases** (`internal/domain/`, `internal/service/`): Isolated from transport and specific frameworks. Domain logic depends only on ports and interfaces.
- **Adapters** (`internal/adapter/`): Divided into `controller/` (HTTP/REST via Gin) and `socket/` (Real-time events via Socket.IO). Adapters implement specific interface boundaries (`api.Router`, `api.Namespace`).
- **Dependency Injection**: Dependencies (`*bbolt.DB`, `logger.Logger`) are injected at the composition root (`cmd/api/main.go`, `cmd/windows/main.go`, `shared/api/default.go`) and threaded into constructors (`NewController`, `NewRestRequestSocket`, `NewUsecase`).

### File-Backed Canonical Storage Pattern
Unlike conventional backends that store documents directly in an RDBMS, Apitester Desktop adopts the **Filesystem as the Single Source of Truth**:
1. **Canonical State on Disk**: Primary collections reside on disk as Postman v2.1 JSON files (`collection.json`). Tests reside as `.http` files, environments as `http-client.private.env.json`, and automations as Ansible YAML files.
2. **Metadata & History in BoltDB**: BoltDB acts as a coordination and auditing journal, tracking collection metadata (`ID`, `Path`, `IsSelected`, `UpdatedAt`) and change history (`CollectionHistory`).
3. **Optimistic Versioning & Concurrency**:
   - Updates calculate SHA-256 digests (`hex.EncodeToString(sha256.Sum256(content))`) of the payload before and after modification.
   - Operations acquire `Port.WriteMu` (mutex) during writes to ensure serialized, atomic operations.
   - Every mutation records a `CollectionHistory` entry with `OldHash`, `NewHash`, `OldValue`, `NewValue`, `Line` number, and `Operation` identifier.

### Presentation & Transport Adapters

#### 1. HTTP Controllers (`internal/adapter/controller/`)
- Every controller struct implements the `api.Router` interface:
  ```go
  type Router interface {
      Route(handler *gin.RouterGroup)
  }
  ```
- Controllers use a local `Usecase` interface containing only the subset of usecase methods needed by the controller, avoiding direct coupling to concrete usecase implementations.
- Controllers utilize `pkg/mapper` to map domain errors to HTTP response structures (e.g., `localerror.InvalidDataError` -> `400 Bad Request`, other errors -> `500 Internal Server Error`).

#### 2. WebSocket / Socket.IO Adapters (`internal/adapter/socket/`)
- Socket adapters implement the `api.Namespace` interface:
  ```go
  type Namespace interface {
      OnSpace(ns cio.NSInitiate)
  }
  ```
- Modules bind handlers to discrete events using `cio.NS.Event(eventName, payloadPrototype, handler)`.
- Incoming event payloads must satisfy the `cio.MessagePayload` interface (`From(msg ...any)`).

### Application Service / Usecase Layer
Located in `internal/service/` (`collection`, `restrequest`, `tree`, `environment`, `testsuits`, `automation`).

#### Usecase Rules of Engagement:
1. **Centralized Error Handling**: Errors returned from usecases are processed via `u.ErrHandler.ErrorReturn(err)`. If the error is typed (`localerror.InvalidDataError`), it bypasses internal error logging and is returned cleanly. Internal errors are logged automatically.
2. **Single Separation of Concern**: If a business operation within a usecase method exceeds 4 lines of implementation, the logic is extracted into a focused private helper method.
3. **Parameter & Return Budgeting**: Methods accept a maximum of 3 arguments (excluding `context.Context`) and return a maximum of 2 values (excluding `error`). Multi-argument inputs are encapsulated into typed DTO structs.
4. **Context Propagation**: All usecase methods accept `context.Context`. In Socket handlers, a context with a 3-second deadline is created (`context.WithTimeout(context.Background(), 3*time.Second)`).
5. **Port Embedding**: Usecases embed `*base.Port` to share collection loading, file persistence, version hashing, watcher notification, and history recording.

### Domain Entities
Defined in `internal/domain/`:
- **`Collection`**: Represents a workspace collection registered in the system (`ID`, `Name`, `IsSelected`, `Path`, `TestSuiteID`, `AutomationID`, `UpdatedAt`, `CreatedAt`).
- **`CollectionHistory`**: Immutable audit log of collection mutations (`ID`, `CollectionID`, `RequestID`, `Operation`, `Field`, `OldValue`, `NewValue`, `OldHash`, `NewHash`, `FilePath`, `Line`, `CreatedAt`).
- **`TestSuite`**: Module link associating a collection with its test suite workspace directory (`ID`, `Name`, `CollectionID`, `Path`).
- **`Automation`**: Module link associating a collection with its Ansible automation workspace directory (`ID`, `Name`, `CollectionID`, `Path`).

### Persistence Layer & Repository Pattern
Located in `pkg/db/`:
- Generic Go repository abstraction:
  ```go
  type RepositoryInterface[T any] interface {
      Create(ctx context.Context, id string, entity *T) error
      Update(ctx context.Context, id string, entity *T) error
      Delete(ctx context.Context, id string) error
      View(ctx context.Context, id string) (*T, error)
      List(ctx context.Context) ([]T, error)
      Exists(ctx context.Context, id string) (bool, error)
  }
  ```
- Concrete implementation `repository[T]` uses `go.etcd.io/bbolt`:
  - Entities are serialized to JSON before storage in BoltDB buckets.
  - Bucket names default to the struct type name (e.g. `Collection`, `TestSuite`, `Automation`) or can be overridden via `WithBucketName("collection_history")`.
  - Ensures buckets exist upon repository creation (`tx.CreateBucketIfNotExists`).

### Reactive File Watcher & Change Synchronization
Located in `pkg/watcher/watcher.go`:
- **Observer / File Monitoring Pattern**: Uses `github.com/fsnotify/fsnotify` to listen for OS file modification and creation events.
- **Deduplication via State Check**: Maintains a `FileState` containing the last read content string, modified timestamp, and read/write mutex. When the backend itself writes a file via `base.Port.SaveCollection`, it immediately updates `FileWatcher.State` via `NotifyWatcher(path, content)`.
- When an external application (e.g., VS Code, Git, text editor) modifies the file on disk:
  1. `fsnotify` detects the change.
  2. The watcher reads the file and compares it to `FileState.Read()`.
  3. If content has diverged, it fires registered `onChanges` callbacks.
  4. In `collection.Usecase`, `NotifyChanges` verifies if `latestHistory.NewHash != currentHash`. If true, it calls `u.onRefresh(true)`.
  5. `CollectionSocket.NotifyRefresh` broadcasts the `collection:refresh` event over Socket.IO to notify the frontend to reload.

### Cross-Cutting Concerns & Utilities
- **`pkg/cio` (Socket IO Hub)**: Fluent wrapper over `zishang520/socket.io/v3` supporting namespaces, rooms (`useRoom`), auth middleware, connection/disconnection hooks, and typed event routing.
- **`pkg/elog` (Windows Event Logger)**: Dual-mode logger supporting native Windows Event Log (`golang.org/x/sys/windows/svc/eventlog`) and standard console fallback. Defines explicit Windows Event IDs (`EIDSuccess=0`, `EIDFileNotFound=2`, `EIDAccessDenied=5`, `EIDGenericError=1`, `EIDServiceNotStarted=1062`).
- **`pkg/logger` (Zerolog Logger)**: Structured logger supporting configurable log levels (`debug`, `info`, `warn`, `error`, `fatal`), file sink (`os.OpenFile`), console writer, and Gin request logging middleware (`LoggingRequest`).
- **`pkg/localerror`**: Domain error abstraction distinguishing bad user input (`InvalidDataError`) from unexpected internal faults (`InternalError`).
- **`pkg/mapper`**: Standard HTTP envelope builder formatting outputs into `payload.Response` or `payload.ErrorResponse`.
- **`pkg/middleware/cors.go`**: CORS handler configuring permitted headers, methods, credentials, and `204 No Content` preflight response.
- **`internal/mockdata`**: Value generator for mock template tokens (`mock.uuid`, `mock.email`, `mock.name`, `mock.date`, etc.) backed by `gofakeit`.

---

## 3. Libraries & Dependencies

All dependencies are defined in `go.mod` for Go version `1.26.0`.

### Core / Direct Dependencies
| Library | Version | Purpose |
| :--- | :--- | :--- |
| **`github.com/gin-gonic/gin`** | `v1.12.0` | High-performance HTTP web framework, routing, request binding, and middleware execution. |
| **`github.com/zishang520/socket.io/v3`** | `v3.0.4` | Full-featured Socket.IO v3/v4 server implementation in Go. |
| **`github.com/zishang520/socket.io/servers/socket/v3`** | `v3.0.4` | Server engine and namespace management for Socket.IO. |
| **`go.etcd.io/bbolt`** | `v1.5.0` | Embedded ACID key-value database (pure Go fork of BoltDB). |
| **`github.com/fsnotify/fsnotify`** | `v1.10.1` | Cross-platform filesystem notification library using OS kernel hooks (`ReadDirectoryChangesW` on Windows). |
| **`golang.org/x/sys`** | `v0.47.0` | Low-level Windows OS system calls (`windows/svc` for Windows Service lifecycle, `eventlog` for Windows Event Log). |
| **`golang.org/x/sync`** | `v0.22.0` | Concurrency primitives (`errgroup.Group`) for coordinated server lifecycle and graceful shutdown. |
| **`github.com/rs/zerolog`** | `v3.35.1` | Zero-allocation JSON structured logging framework. |
| **`github.com/joho/godotenv`** | `v1.5.1` | Loads environment configurations from `.env` files (`.env.stag`, `.env.prod`). |
| **`github.com/google/uuid`** | `v1.6.0` | RFC 4122 compliant UUID v4 generator for requests, entities, and history tokens. |

### Indirect & Utility Libraries
| Library | Version | Purpose |
| :--- | :--- | :--- |
| **`github.com/brianvoe/gofakeit/v6`** | `v6.28.0` | Random and mock data generator (names, emails, phones, addresses, UUIDs, dates). |
| **`github.com/gorilla/websocket`** | `v1.5.3` | Low-level WebSocket protocol framing for Socket.IO connections. |
| **`github.com/go-playground/validator/v10`** | `v10.30.3` | Struct validation for incoming JSON payload bindings. |
| **`github.com/bytedance/sonic`** | `v1.15.2` | JIT-accelerated JSON parser used by Gin. |
| **`github.com/goccy/go-json`** | `v0.10.6` | Fast JSON serialization alternative. |
| **`github.com/klauspost/compress`** | `v1.18.6` | Data compression (used by HTTP and WebSocket transport). |
| **`github.com/quic-go/quic-go`** | `v0.60.0` | QUIC protocol transport library (underlying socket engine dependency). |
| **`github.com/quic-go/webtransport-go`** | `v0.10.0` | WebTransport protocol support. |

### Build & Code Generation Tools
- **`stringer`**: Generates `String()` methods for enum types (`//go:generate stringer -type=RequestEvent` in `internal/adapter/socket/restrequest/dto.go`).
- **`mockery`**: Generates test mock objects for interfaces (`//go:generate mockery --all --inpackage --case snake` in `pkg/mapper/default.go`).

---

## 4. Service Dependencies & Data Stores

### Embedded Key-Value Store (BoltDB)
- **Engine**: `go.etcd.io/bbolt` (embedded, serverless, single-file database).
- **Location**:
  - Configurable via `BOLT_DB_PATH`.
  - Default Fallback: `%USERPROFILE%\AppData\Roaming\apitester\collection.db` or `resource/db/collection.db`.
- **Buckets**:
  * `Collection`: Stores `domain.Collection` records (collection name, file path, active selection flag, linked module IDs).
  * `collection_history`: Stores `domain.CollectionHistory` records (mutation logs, before/after hashes, line numbers).
  * `TestSuite`: Stores `domain.TestSuite` module references and folder paths.
  * `Automation`: Stores `domain.Automation` module references and folder paths.

### Local Filesystem Data Stores
The filesystem is the primary, canonical persistence medium for application artifacts:
1. **Postman Collection Files (`collection.json`)**: Postman v2.1 schema JSON containing folders, requests, headers, query params, path variables, form-data, JSON bodies, authentication settings, and saved responses.
2. **Environment Files (`http-client.private.env.json`)**: Stored under `<collectionDir>/tests/http-client.private.env.json` in IntelliJ HTTP Client format (mapping environment names to key-value maps).
3. **HTTP Test Files (`.http`)**: Stored under the test suite path. Plaintext HTTP request files partitioned by `###` delimiters with custom post-response evaluation blocks (`>> {% assert ... capture ... %}`).
4. **Ansible Playbooks & Automations**:
   - YAML files (`.yml` / `.yaml`) containing automation task pipelines.
   - Inventories in `<automationDir>/inventory/`.
   - Automation configuration in `<automationDir>/.config.json`.

### Windows OS Service Infrastructure
When compiled and deployed via `cmd/windows/main.go`:
- **Windows Service Control Manager (SCM)**: Registered as service `Apitester-backend`.
  - Binary path: `C:\Program Files\Apitester\apitester-backend.exe --env "C:\Program Files\Apitester\.env.prod"`.
  - Service controls handled: `AcceptStop`, `AcceptShutdown`, `AcceptPauseAndContinue`, `Interrogate`.
- **Windows Event Log**: Emits service lifecycle events directly into the Windows Event Log under provider `"Apitester-backend"`.
- **File Logging**: Writes release logs to `%USERPROFILE%\AppData\Roaming\apitester\debug.log` or `LOG_PATH` (`C:\ProgramData\Apitester\logs\debug.log`).

### Client & Upstream Service Interactions
- **Desktop Electron Frontend**: Interacts with the backend locally over `127.0.0.1:<APP_PORT>` via HTTP REST and Socket.IO.
- **Python Automation Runner (Optional / Microservice)**:
  - Configured via `PYTHON_SERVICE_URL` (`http://localhost:5000`) and `ANSIBLE_PLAYBOOK_BINARY`.
  - Intended to execute Ansible playbooks and return live run event streams.
- **MySQL Database (Staging)**:
  - Configuration defined in `.env.stag` (`MYSQL_HOST:3307`, `MYSQL_USER`, `MYSQL_DATABASE`) for testing external database scenarios.

---

## 5. Transport Protocols & API Specifications

### HTTP / RESTful API (TCP / HTTP 1.1)
- **Host Binding**: `0.0.0.0:<APP_PORT>`
  - Default Staging Port: `8990`
  - Default Production Port: `8999`
- **Root URL Prefix**: `/api/v1`
- **CORS Configuration**:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - Permitted Headers: `Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Menu-Slug, X-Origin-Path, X-Request-Id, Sig, Timestamp, Email`
- **Envelope Response Format**:
  ```json
  {
    "success": true,
    "messageTitle": "Success",
    "message": "Collections retrieved",
    "data": { ... }
  }
  ```
  Error Format:
  ```json
  {
    "success": false,
    "messageTitle": "Oops, something went wrong.",
    "message": "Collection not found",
    "errorServer": "...",
    "data": null
  }
  ```

### HTTP Route Catalog

#### Collection Module (`/api/v1/collection`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/collection/list` | List all registered collections |
| `GET` | `/api/v1/collection/get-active` | Get active/selected collection metadata |
| `POST` | `/api/v1/collection/create` | Register/create a new collection entry |
| `PUT` | `/api/v1/collection/:id` | Update collection metadata |
| `DELETE`| `/api/v1/collection/:id` | Delete a collection record |
| `PUT` | `/api/v1/collection/select/:id` | Set collection as active/selected |
| `GET` | `/api/v1/collection/variables` | Get all variables for active collection |
| `GET` | `/api/v1/collection/variables/search` | Search variables by key query parameter |
| `GET` | `/api/v1/collection/variables/resolve` | Resolve a variable value |
| `POST` | `/api/v1/collection/variable` | Create a new collection variable |
| `PUT` | `/api/v1/collection/variable/:id` | Update collection variable |
| `DELETE`| `/api/v1/collection/variable/:id` | Delete collection variable |
| `GET` | `/api/v1/collection/pre-script` | Get collection pre-request script |
| `PUT` | `/api/v1/collection/pre-script` | Update collection pre-request script |
| `GET` | `/api/v1/collection/auth` | Get collection authentication config |
| `PUT` | `/api/v1/collection/auth` | Update collection authentication config |
| `PUT` | `/api/v1/collection/select-base-url`| Select base URL variable for collection |

#### Rest Request Module (`/api/v1/restrequest`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/restrequest/mock-data` | Generate dynamic mock value for key (`?key=mock.email`) |
| `POST` | `/api/v1/restrequest/create-request/:collectionId` | Create a new empty request in collection |
| `POST` | `/api/v1/restrequest/create-request` | Create request in currently active collection |
| `GET` | `/api/v1/restrequest/:collectionId/:requestId` | Get request details by ID |
| `GET` | `/api/v1/restrequest/request/:requestId` | Get request details from active collection |
| `DELETE`| `/api/v1/restrequest/:collectionId/:requestId` | Delete request from collection |
| `DELETE`| `/api/v1/restrequest/request/:requestId` | Delete request from active collection |
| `PUT` | `/api/v1/restrequest/tree/:collectionId` | Reorder/update collection request tree items |
| `PUT` | `/api/v1/restrequest/tree` | Reorder/update active collection request tree items |

#### Tree Navigation Module (`/api/v1/restrequest/tree`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/restrequest/tree` | Retrieve full hierarchical request tree of active collection |
| `GET` | `/api/v1/restrequest/tree/automation/:collectionId` | Get automation folder/file tree |
| `GET` | `/api/v1/restrequest/tree/automation` | Get automation tree for active collection |
| `GET` | `/api/v1/restrequest/tree/testsuite/:collectionId` | Get test suite `.http` tree |
| `GET` | `/api/v1/restrequest/tree/testsuite` | Get test suite tree for active collection |

#### Environments Module (`/api/v1/collection/:id/environments`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/collection/:id/environments` | Read private environments (`http-client.private.env.json`) |
| `PUT` | `/api/v1/collection/:id/environments` | Write/update private environments |

#### Test Suites Module (`/api/v1/collection/:id/tests`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/collection/:id/tests` | List all `.http` test files in module |
| `GET` | `/api/v1/collection/:id/tests/:name` | Read parsed test steps from `.http` file |
| `PUT` | `/api/v1/collection/:id/tests/:name` | Serialize and save test steps to `.http` file |
| `DELETE`| `/api/v1/collection/:id/tests/:name` | Delete a test file |

#### Automation Playbooks Module (`/api/v1/collection/:id/automation`)
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/collection/:id/automation` | List automation YAML playbooks |
| `GET` | `/api/v1/collection/:id/automation/:name` | Read playbook content |
| `PUT` | `/api/v1/collection/:id/automation/:name` | Write/save playbook content |
| `DELETE`| `/api/v1/collection/:id/automation/:name` | Delete playbook file |
| `GET` | `/api/v1/collection/:id/automation/inventory` | List inventory files |
| `POST` | `/api/v1/collection/:id/automation/inventory` | Create new inventory file |
| `GET` | `/api/v1/collection/:id/automation/inventory/:name` | Read inventory file content |
| `PUT` | `/api/v1/collection/:id/automation/inventory/:name` | Write inventory file content |
| `DELETE`| `/api/v1/collection/:id/automation/inventory/:name` | Delete inventory file |
| `GET` | `/api/v1/collection/:id/automation/config` | Read `.config.json` automation run settings |
| `PUT` | `/api/v1/collection/:id/automation/:name/config` | Update automation run settings |

---

### WebSockets & Socket.IO Specification
Real-time bi-directional messaging is provided by **Socket.IO v3/v4** mounted on the Gin server at `/socket.io/*any`.

- **Supported Transports**: WebSocket and HTTP Long-Polling fallback.
- **Server Engine Options**:
  - `PingInterval`: 25 seconds
  - `PingTimeout`: 20 seconds
  - `MaxHttpBufferSize`: 1,000,000 bytes (1 MB)
  - `ConnectTimeout`: 1,000 ms
  - `CORS`: Origin `*`, Credentials `true`
- **Room Support**: `cio.NS.UserRoom()` enables auto-joining rooms based on query parameter `roomId` upon handshake.

### Socket.IO Event Inventory & Payloads

#### Namespace: `/collection`
Used for global collection state synchronization between backend and frontend.

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `collection:refresh` | Bi-directional (Server -> Client & Client -> Server) | `{"refresh": true}` | Emitted by the server when external filesystem changes are detected by `fsnotify`. Emitted by the client to request synchronization. |

#### Namespace: `/restrequest`
Provides low-latency, debounce-friendly, granular mutation of individual fields within an active HTTP request definition.

##### Client-to-Server Events (Mutations)
All payloads embed `RequestIdentity` (`collectionId`, `requestId`), which can also fallback to client handshake query parameters.

| Event Name | Incoming Payload Struct | Fields Updated |
| :--- | :--- | :--- |
| `request:update:url` | `RequestUpdateURLPayload` | Updates raw URL, host array, path segments, and synchronizes path variables. |
| `request:edit:path:variable` | `RequestEditPathVariablePayload` | Updates key/value pair of a path variable. |
| `request:update:headers` | `RequestUpdateHeadersPayload` | Updates header key, value, description, and enabled status. |
| `request:update:auth` | `RequestUpdateAuthPayload` | Updates request authentication type (e.g. `bearer`), token properties, and inheritance mode. |
| `request:update:method` | `RequestUpdateMethodPayload` | Updates HTTP method (`GET`, `POST`, `PUT`, `DELETE`, etc.). |
| `request:update:name` | `RequestUpdateNamePayload` | Updates request title/name. |
| `request:update:query` | `RequestUpdateQueryPayload` | Updates query parameters array. |
| `request:update:body:json` | `RequestUpdateJSONBodyPayload` | Updates raw JSON body string and sets body mode to `raw`. |
| `request:update:body:formdata` | `RequestUpdateFormDataBodyPayload` | Updates multipart form-data properties and sets body mode to `formdata`. |
| `request:update:script` | `RequestUpdateScriptPayload` | Updates post-request test script code. |
| `request:delete` | `RequestDeletePayload` | Deletes the request from the collection. |
| `request:save:response` | `RequestSaveResponsePayload` | Appends or updates a saved response example (status, code, body, headers). |
| `request:save:script` | `RequestSaveScriptPayload` | Saves post-request script content. |

##### Server-to-Client Responses
Each socket mutation replies directly to the calling client:

1. **Success Event**: `request:success`
   ```json
   {
     "operation": "request:update:url",
     "request": {
       "version": "b47c9...",
       "item": {
         "id": "req-123",
         "name": "Get User Details",
         "request": { ... }
       }
     }
   }
   ```
2. **Error Event**: `request:error`
   ```json
   {
     "operation": "request:update:url",
     "message": "Collection id and request id are required"
   }
   ```

---

## 6. Summary Matrix

| Metric / Dimension | Specification Detail |
| :--- | :--- |
| **Language & Toolchain** | Go `1.26.0`, Go Modules |
| **Architectural Model** | Clean Architecture, Hexagonal / Ports & Adapters |
| **Storage Strategy** | Local Filesystem as canonical source of truth + Embedded BoltDB metadata/history journal |
| **Primary File Formats** | Postman Collection JSON v2.1, IntelliJ `.env.json`, RFC-like `.http`, Ansible YAML |
| **Concurrency Guard** | Mutex serialization (`WriteMu`) + SHA-256 content hashes |
| **Filesystem Monitoring** | `fsnotify` in-process watcher with hash-based deduplication |
| **HTTP Transport** | `gin-gonic/gin` HTTP/1.1 REST (`/api/v1`) |
| **WebSocket Transport** | `zishang520/socket.io/v3` Engine.IO / Socket.IO (`/socket.io`) |
| **OS Platform Deployment**| Native Windows Service daemon via `golang.org/x/sys/windows/svc` + EventLog |
| **Target Distribution** | Inno Setup Windows installer (`Apitester-Setup.exe`) packaging `apitester-backend.exe` |
