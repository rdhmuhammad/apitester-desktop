# Postman Pre-Request Script DTO

**Summary**: Data transfer object specifications for Postman pre-request and post-request scripts, detailing the collection serialization schema (v2.1.0 JSON), Go and TypeScript DTO mappings, and the sandboxed Web Worker execution runtime (`pm.*` and Postman Collection SDK classes).
**Sources**: `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`, Postman Sandbox API Reference, `internal/service/collection/dto.go`, `internal/service/restrequest/dto.go`, `frontend/src/layout/hooks/useScriptRunner.ts`, `frontend/src/layout/hooks/useSendRequest.ts`
**Last updated**: 2026-10-28

---

## Overview

Pre-request (`listen: "prerequest"`) and post-request (`listen: "test"`) scripts in API Tester follow the Postman Collection v2.1.0 specification and the Postman Sandbox API.

Representing and executing scripts involves two complementary layers:
1. **Collection Schema DTO**: How scripts, request URLs, headers, bodies, and authentication configurations are persisted, imported, and exported within Postman collection JSON files.
2. **Sandbox Runtime Context DTO**: The data models and Postman Collection SDK classes (`Url`, `HeaderList`, `PropertyList`, `RequestBody`, `RequestAuth`) hydrated inside the isolated Web Worker under the `pm.*`, `request`, and `res` globals.

---

## 1. Collection Schema DTO (JSON Schema v2.1.0)

In the Postman Collection format, scripts are stored in an `event` array attached to a collection, folder, or request item.

### `Event` Object Specification

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `listen` | `string` | **Yes** | Event lifecycle hook (`"prerequest"` for pre-request scripts, `"test"` for post-request scripts). |
| `script` | `Script` | **Yes** | The script payload containing executable code lines and metadata. |
| `id` | `string` | No | Unique identifier for the event instance. |
| `disabled` | `boolean` | No | Flag to disable script execution without deleting it (defaults to `false`). |

### `Script` Object Specification

| Property | Type | Description |
| :--- | :--- | :--- |
| `exec` | `string[]` \| `string` | Script contents formatted as an array of JavaScript source lines. |
| `type` | `string` | MIME type of the script engine (standard: `"text/javascript"`). |
| `id` | `string` | Optional unique identifier for referencing the script. |
| `name` | `string` | Optional human-readable script name or description. |
| `src` | `string` \| `Url` | Optional URL pointing to an external script resource. |

---

## 2. Local Codebase DTO Mapping

### Backend Go DTOs (`internal/service/collection/dto.go` & `internal/service/restrequest/dto.go`)

* **`CollectionEvent` & `EventScript`**:
  ```go
  type CollectionEvent struct {
      ID       string      `json:"id,omitempty"`
      Listen   string      `json:"listen"`
      Script   EventScript `json:"script"`
      Disabled bool        `json:"disabled,omitempty"`
  }

  type EventScript struct {
      ID   string   `json:"id,omitempty"`
      Name string   `json:"name,omitempty"`
      Exec []string `json:"exec"`
      Type string   `json:"type"`
      Src  any      `json:"src,omitempty"`
  }
  ```
* **`RequestURL` & `URLAuth`**:
  Includes `Raw`, `Protocol`, `Host`, `Port`, `Path`, `Query`, `Hash`, `Variable`, and `Auth *URLAuth` so Postman Collection v2.1 URL fields survive round-trip serialization.
* **`RequestBody`**:
  Supports `Mode` (`raw`, `urlencoded`, `formdata`, `file`, `graphql`), `Raw`, `URLEncoded []Property`, `FormData []Property`, `File`, `GraphQL`, `Options map[string]any`, and `Disabled`.
* **`ReqAuth`**:
  Supports `ID`, `Name`, `Type` (`bearer`, `basic`, `apikey`, `oauth2`, `noauth`), `Disabled`, `Bearer`, `Basic`, `APIKey`, and `OAuth2` property lists.
* **`restrequest.RequestResponse`**:
  Exposes both `PreScript string` (extracted from enabled `prerequest` events) and `Script string` (extracted from enabled `test` events).

---

## 3. Postman Sandbox Runtime DTO (`pm.*` Context in `useScriptRunner.ts`)

Inside the isolated Web Worker (`frontend/src/layout/hooks/useScriptRunner.ts`), outgoing requests and incoming responses are hydrated into Postman Collection SDK instances (`Url`, `HeaderList`, `PropertyList`, `RequestBody`, `RequestAuth`), which are also exposed globally and via `require('postman-collection')`.

### `pm.request` (`request` alias)
Available in both **pre-request** (mutable) and **post-request** (read-only body) phases:
* `pm.request.id` & `pm.request.name`: Request identifier and display name.
* `pm.request.method`: HTTP method string (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
* `pm.request.url`: `Url` SDK instance with `.raw` getter/setter, `protocol`, `host`, `port`, `path`, `query` (`PropertyList`), `variables` (`PropertyList`), `hash`, `auth`, `.update()`, `.toString()`, `.getPath()`, `.getHost()`, `.getQueryString()`, `.getRemote()`, `.addQueryParams()`, and `.removeQueryParams()`.
* `pm.request.headers`: `HeaderList` SDK instance (decorated `Array` supporting both legacy `request.headers[0].key` indexing and `.add()`, `.upsert()`, `.remove()`, `.get()`, `.has()`, `.each()`, `.count()`, `.clear()`, `.toObject()`, `.toString()`).
* `pm.request.body`: `RequestBody` SDK instance supporting `mode`, `raw`, `urlencoded` (`PropertyList`), `formdata` (`PropertyList`), `file`, `graphql`, `options`, `.update()`, `.isEmpty()`, and `.toString()`.
* `pm.request.auth`: `RequestAuth` SDK instance supporting `type`, `.use(type, options)`, `.current()`, `.parameters()`, and `.clear(type)` (`bearer`, `basic`, `apikey`, `oauth2`, `noauth`).
* Mutation Helpers: `pm.request.addHeader()`, `pm.request.removeHeader()`, `pm.request.upsertHeader()`, `pm.request.addQueryParams()`, `pm.request.removeQueryParams()`.

### `pm.response` (`res` alias)
Available in the **post-request** phase:
* `pm.response.code` & `pm.response.status`: Numeric HTTP status code and status reason string (`statusCode` and `statusText` retained as aliases).
* `pm.response.headers`: `HeaderList` SDK instance with case-insensitive `.get()`, `.has()`, `.toObject()`, plus direct lowercase property lookup (`res.headers['content-type']`) for backward compatibility.
* `pm.response.responseTime`: Duration in milliseconds.
* `pm.response.responseSize`: Byte size of the response payload.
* `pm.response.text()`: Returns the exact raw response string (`rawText`).
* `pm.response.json()`: Parses the response text (or returns the parsed JSON body).
* `pm.response.to`: Chai-style response assertions (`to.have.status(codeOrText)`, `to.have.header(key, val?)`, `to.have.body(valOrRegex?)`, `to.have.jsonBody(path?, val?)`, `to.have.jsonSchema(schema)`, `to.be.ok`, `to.be.success`, `to.be.redirection`, `to.be.clientError`, `to.be.serverError`, `to.be.error`, `to.be.json`, and `.not` negation).

### Variable Scope DTOs
Available in both **pre-request** and **post-request** phases with immediate in-memory updates and automatic collection variable persistence (`createVariableMutation`, `updateVariableMutation`, `deleteVariableMutation`):
* `pm.environment`, `pm.collectionVariables`, `pm.variables`, `pm.globals`, `pm.iterationData`: Each exposes `.get(key)`, `.set(key, value)`, `.unset(key)`, `.has(key)`, `.clear()`, `.toObject()`, and `.replaceIn(template)`.

### `pm.info`, `pm.execution`, `pm.test`, and `pm.expect`
* `pm.info`: `{ eventName: 'prerequest' | 'test', iteration: 1, iterationCount: 1, requestName, requestId }`.
* `pm.execution.skipRequest()`: Aborts sending the HTTP request when invoked during a pre-request script.
* `pm.execution.setNextRequest(target)`: Records the next request target on the execution result.
* `pm.test(name, fn)`: Executes assertion callbacks and records pass/fail results into the `AssertionResult[]` output.
* `pm.expect(actual)`: Supports Chai BDD chains (`.to.be.a()`, `.to.equal()`, `.to.eql()`, `.to.include()`, `.to.match()`, `.to.have.property()`, `.to.have.lengthOf()`, `.to.be.above()`, `.to.be.below()`, `.to.be.oneOf()`, `.to.be.true/false/null/undefined/empty/ok`, `.not`) alongside direct matchers.

---

## Related pages

- [[concepts/index]]
- [[concepts/backend/postman-script-documentation/index]]
- [[patterns/frontend/script-editor-and-code-completion]]
- [[concepts/backend/file-backed-editor-sync]]
- [[decisions/file-backed-restrequest-editing]]
- [[index]]
