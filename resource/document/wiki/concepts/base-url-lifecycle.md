# Base URL Lifecycle

**Summary**: Explains the end-to-end lifecycle and mechanism of `baseUrl` in API Tester, from regex-based backend collection variable categorization to frontend header selection, template resolution, pre-request script mutation, and CORS proxy routing.
**Sources**: `internal/service/collection/usecase.go`, `frontend/src/layout/components/header/RequestHeader.tsx`, `frontend/src/layout/hooks/useSendRequest.ts`
**Last updated**: 2026-09-23

---

The `baseUrl` represents the root endpoint for API requests within a collection. Rather than being a static string, its lifecycle spans backend collection categorization, UI selection and dynamic generation, template variable interpolation, pre-request script sandboxing, and runtime transport resolution.

## 1. Backend Detection & Categorization

In the backend collection service, collection variables are evaluated to detect if they represent a base URL.

- **Pattern Matching**: The collection usecase defines a case-insensitive regular expression:
  ```go
  var baseURLRegex = regexp.MustCompile(`(?i)(base.*url|url.*base)`)
  ```
- **Lifecycle Evaluation**:
  - `PrepareCreate()`: When a collection is created or imported, any variable key matching `baseURLRegex` is assigned `Category = "BASE_URL"` and persisted directly to the collection JSON on disk.
  - `PrepareVariables()`: When a collection is loaded, any variable key matching `baseURLRegex` without an existing category is tagged with `Category = "BASE_URL"`.
  - `AddVariable()` and `UpdateVariable()`: When a variable is inserted or updated via collection usecases, if `isBaseURLVar(key)` evaluates to `true`, the variable's category is set to `"BASE_URL"`.

## 2. Frontend Header Selection & Provisioning

The frontend editor header manages available base URLs for the active collection:

- **Option Extraction**: `RequestHeader.tsx` reads collection variables and filters for those with `category === "BASE_URL"`, deduplicating unique values into `baseUrlOptions`.
- **Active Selection**: If available options exist, the component retains the current valid selection or automatically defaults to `baseUrlOptions[0]`.
- **Dynamic Creation**: Users can add a new base URL directly via the dropdown interface. `getNextBaseUrlKey()` sequentially generates keys (`base_url`, `base_url_1`, `base_url_2`, etc.) and invokes the `createVariableMutation` to persist the new variable into the collection.

## 3. Template Resolution & Enforcement

During request preparation in `RequestHeader.tsx`, variable interpolation replaces Mustache-style tags (`{{...}}`):

- **Category-Enforced Resolution**: In `resolveVariableValue()`, a variable reference is resolved to `selectedBaseUrl` **only if** the matched collection variable has `category === "BASE_URL"`. Variables without this category are treated as standard collection variables.
- **Runtime Variables Synchronization**: All variables with `category === "BASE_URL"` in `effectiveRuntimeVariables` and `useSendRequest.ts` `varsObj` are dynamically bound to the current `selectedBaseUrl`.
- **Endpoint Prefix Extraction**: `formatEndpoint()` only strips leading variable tags from the endpoint URL if the variable belongs to `category === "BASE_URL"`, preserving URL path variables (e.g. `/users/{{userId}}`).

## 4. Pre-Request Script Sandboxing & Mutation

Before an HTTP request is dispatched, pre-request scripts have the ability to inspect and mutate the base URL:

- **Sandbox Injection**: In `useSendRequest.ts`, `varsObj["BASE_URL"] = config.baseUrl` exposes the base URL to the execution sandbox.
- **Script Mutation**: If a pre-request script mutates `BASE_URL` (e.g. `pm.environment.set("BASE_URL", "https://api.staging.example.com")`), the request runner overrides `config.baseUrl` with `String(preOutput.mutations["BASE_URL"])`.
- **Origin Re-parsing**: If the script rewrites `request.url` to an absolute URL (`https://...`), `applyMutatedRequestToSendConfig()` parses the URL using `new URL(rawUrl)` to split and update `baseUrl = parsed.origin` and `endpoint = parsed.pathname + ...`.

## 5. Network Dispatch & CORS Proxying

The final HTTP transmission in `sendApiRequest()` adapts depending on the runtime target:

- **Electron Runtime**: When running inside desktop Electron (`window.electronAPI`), requests bypass browser security models and are dispatched directly through Axios with `baseURL` and `url`.
- **Browser Dev Mode**: Outside Electron during local development, cross-origin requests are routed via a Vite proxy path:
  ```ts
  baseURL = ""
  url = `/__cors_proxy__?target=${encodeURIComponent(fullTarget)}`
  ```
- **Raw Request Protocol Preview**: `generateRawRequest()` parses `new URL(request.baseUrl).host` to construct the canonical HTTP/1.1 wire lines for debugging (`METHOD baseUrl/endpoint HTTP/1.1\nHost: ...`).

## Related pages

- [[concepts/backend/postman-prerequest-script-dto]]
- [[patterns/frontend/api-service-and-query-hook-wiring]]
- [[decisions/debounced-request-config-mutations]]
- [[patterns/usecase/new-usecase-workflow]]
