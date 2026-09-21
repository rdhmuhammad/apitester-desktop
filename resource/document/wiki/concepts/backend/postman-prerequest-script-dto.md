# Postman Pre-Request Script DTO

**Summary**: Data transfer object specifications for Postman pre-request scripts, detailing the collection serialization schema (v2.1.0 JSON) and the sandboxed execution context parameters (`pm.*`).
**Sources**: `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`, Postman Sandbox API Reference, `internal/service/collection/dto.go`
**Last updated**: 2026-09-21

---

## Overview

A pre-request script in Postman executes prior to dispatching an HTTP request. It can dynamically set headers, generate authentication tokens, calculate timestamps, or manage environment and collection variables.

Representing and executing pre-request scripts involves two complementary DTO layers:
1. **Collection Schema DTO**: How the script is persisted, imported, and exported within Postman collection JSON files.
2. **Sandbox Runtime Context DTO**: The data models and objects provided to the JavaScript execution engine under the `pm.*` global namespace.

---

## 1. Collection Schema DTO (JSON Schema v2.1.0)

In the Postman Collection format, scripts are stored in an `event` array attached to a collection, folder, or request item. For pre-request scripts, the event is identified by `listen: "prerequest"`.

### `Event` Object Specification

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `listen` | `string` | **Yes** | Event lifecycle hook. Must be `"prerequest"` for pre-request scripts (or `"test"` for test scripts). |
| `script` | `Script` | **Yes** | The script payload containing executable code lines and metadata. |
| `id` | `string` | No | Unique identifier for the event instance. |
| `disabled` | `boolean` | No | Flag to disable script execution without deleting it (defaults to `false`). |

### `Script` Object Specification

| Property | Type | Description |
| :--- | :--- | :--- |
| `exec` | `string[]` \| `string` | Script contents. Typically formatted as an array of strings representing individual lines of JavaScript code. |
| `type` | `string` | MIME type of the script engine (standard: `"text/javascript"`). |
| `id` | `string` | Optional unique identifier for referencing the script. |
| `name` | `string` | Optional human-readable script name or description. |
| `src` | `string` \| `Url` | Optional URL pointing to an external script resource. |

### Serialized JSON Example

```json
{
  "event": [
    {
      "listen": "prerequest",
      "disabled": false,
      "script": {
        "id": "e39149aa-f3b1-4d10-8b1e-0a56bd31a90c",
        "type": "text/javascript",
        "name": "Pre-request Auth Generator",
        "exec": [
          "// Set dynamic timestamp and auth header",
          "const timestamp = Date.now().toString();",
          "pm.environment.set('timestamp', timestamp);",
          "pm.request.headers.add({ key: 'X-Timestamp', value: timestamp });"
        ]
      }
    }
  ]
}
```

---

## 2. Local Codebase DTO Mapping

In this repository, the Postman pre-request script schema is modeled in Go under `internal/service/collection/dto.go`:

* **`CollectionEvent`**:
  ```go
  type CollectionEvent struct {
      Listen string      `json:"listen"`
      Script EventScript `json:"script"`
  }
  ```
* **`EventScript`**:
  ```go
  type EventScript struct {
      Exec []string `json:"exec"`
      Type string   `json:"type"`
  }
  ```
* **`UpdatePreScriptRequest`**:
  ```go
  type UpdatePreScriptRequest struct {
      Exec []string `json:"exec"`
      Type string   `json:"type"`
  }
  ```
* **`UpdatePreScriptResponse`**:
  ```go
  type UpdatePreScriptResponse struct {
      Script  string `json:"script"`
      Version string `json:"version"`
  }
  ```

Pre-request script retrieval joins `event.Script.Exec` lines via `strings.Join(lines, "\n")`, while mutation overwrites or appends the event with `Listen: "prerequest"`.

---

## 3. Postman Sandbox Runtime DTO (`pm.*` Context)

When executing a pre-request script, the Postman sandbox exposes a structured execution context via the global `pm` object:

### `pm.request` (Outgoing Request DTO)
Provides read/write access to the pending HTTP request:
* `pm.request.url`: URL model (`host`, `path`, `query`, `protocol`, `port`).
* `pm.request.method`: HTTP method string (e.g. `GET`, `POST`, `PUT`).
* `pm.request.headers`: Header list with helper methods (`.add()`, `.remove()`, `.upsert()`, `.get()`).
* `pm.request.body`: Request payload body model (mode: `raw`, `urlencoded`, `formdata`).
* `pm.request.auth`: Authentication configuration assigned to the request.

### Variable Scope DTOs
Exposes tiered variable stores according to precedence:
* `pm.variables`: Resolution lookup across all nested scopes (local > data > environment > collection > global).
* `pm.environment`: Active environment key-value pairs (`.get()`, `.set()`, `.unset()`).
* `pm.collectionVariables`: Collection-level variable store.
* `pm.globals`: Workspace-wide global variable store.
* `pm.iterationData`: Data row provided during collection runner or Newman test runs.

### `pm.info` (Execution Metadata DTO)
* `pm.info.eventName`: String literal `"prerequest"`.
* `pm.info.iteration`: Zero-based current iteration index.
* `pm.info.requestId`: Unique ID of the current request item.
* `pm.info.requestName`: Name of the active request item.

### `pm.execution` & Auxiliary APIs
* `pm.execution.skipRequest()`: Aborts sending the current request.
* `pm.execution.setNextRequest(target)`: Overrides collection workflow execution order.
* `pm.cookies`: Access to cookie storage via cookie jar helpers.
* `pm.sendRequest(request, callback)`: Dispatches asynchronous HTTP calls prior to the main request.

*(Note: `pm.response` is unavailable in pre-request scripts since the response lifecycle has not yet occurred).*

---

## Related pages

- [[concepts/index]]
- [[concepts/backend/file-backed-editor-sync]]
- [[decisions/file-backed-restrequest-editing]]
- [[index]]
