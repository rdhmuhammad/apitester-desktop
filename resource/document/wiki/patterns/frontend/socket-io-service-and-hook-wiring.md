	 # Socket.IO Service and Hook Wiring

**Summary**: Frontend Socket.IO features separate connection creation from event services and React hooks. Request-response events are emitted with typed payloads, correlated through operation names, and reflected in the TanStack Query cache.
**Sources**: `frontend/src/pages/editor/services/mainSocket.ts`, `frontend/src/pages/editor/components/RequestConfig/services/requestConfig.ts`, `frontend/src/pages/editor/components/RequestConfig/hooks/useRequestConfig.ts`, `internal/adapter/socket/restrequest/restrequest.go`, `internal/adapter/socket/restrequest/dto.go`
**Last updated**: 2026-09-11

---

## Connection Factory

Create the Socket.IO connection once in a feature service module. The namespace must match the backend namespace, and the configured socket URL should be normalized before appending it:

```ts
const URL = (import.meta.env.VITE_SOCKET_URL || "http://localhost:8993")
  .replace(/\/+$/, "")

export const socketCollection = io(`${URL}/restrequest`, {
  path: "/socket.io",
  autoConnect: true,
  transports: ["websocket", "polling"],
})
```

Keep connection setup out of components. A separate hook such as `useSocket` is appropriate when a component owns connection status and lifecycle; a shared feature socket can use `autoConnect: true` when its service owns the connection.

## Event Contract

The frontend event name must match the backend's `RequestEvent.Name()` result. The `restrequest` backend currently exposes:

- `restrequest:update:url`
- `restrequest:update:headers`
- `restrequest:update:authorization`
- `restrequest:update:method`
- `restrequest:update:query`
- `restrequest:update:body:json`
- `restrequest:update:body:formdata`
- `restrequest:update:script`
- `restrequest:delete`
- `restrequest:error`
- `restrequest:success`

Mutation payloads include the request identity and the version token expected by the backend:

```ts
{
  collectionId,
  requestId,
  baseVersion,
  method,
}
```

The identity can be sent in the event payload or supplied during the socket handshake. Sending it in the payload keeps each event self-contained.

## Request-Response Service

Put event emission in a feature-local service, not in the hook or component. Since the backend responds with separate success and error events, subscribe before emitting, filter by operation, and always remove listeners:

```ts
const emitRequestEvent = (event, operation, identity, data) =>
  new Promise((resolve, reject) => {
    const handleSuccess = payload => {
      if (payload?.operation !== operation) return
      cleanup()
      resolve(payload.request)
    }

    const handleError = payload => {
      if (payload?.operation !== operation) return
      cleanup()
      reject(new Error(payload.message))
    }

    const cleanup = () => {
      socket.off("restrequest:success", handleSuccess)
      socket.off("restrequest:error", handleError)
    }

    socket.on("restrequest:success", handleSuccess)
    socket.on("restrequest:error", handleError)
    socket.emit(event, {...identity, ...data})
  })
```

Use a client timeout as a second failure path. Without timeout cleanup, a disconnected server can leave promises and listeners pending indefinitely. Operation filtering is required because the socket is shared by multiple request-config controls.

## Hook and Cache Wiring

The feature hook should continue to own query reads, optimistic cache updates, and mutation errors. The service replaces the HTTP write implementation while preserving the hook's domain operations:

```ts
queryClient.setQueryData(queryKey, optimisticRequest)

void RequestConfigServices.updateMethod(collectionId, requestId, {
  baseVersion: current.version,
  method,
}).then(next => {
  queryClient.setQueryData(queryKey, next)
})
```

The backend owns ordering and optimistic-version conflict handling. Do not add a frontend debounce or serialized coordinator when the backend is responsible for those concerns. On success, replace the optimistic value with the server response so the cache contains the authoritative version. On failure, expose the error through the hook and decide explicitly whether the feature should roll back or refetch.

Reads can remain HTTP-backed when the socket module only defines mutation events. This allows the existing `useQuery` loading and initial-data flow to remain unchanged while writes use Socket.IO.

## Event Cleanup Rules

- Register listeners before calling `emit` so fast server responses cannot be missed.
- Filter success and error events by operation, and by request identity when the server includes it.
- Remove every listener on success, error, timeout, and component/service disposal.
- Do not use `socket.timeout()` as an acknowledgement timeout unless the backend invokes the Socket.IO acknowledgement callback; server-emitted result events require an explicit client timer.
- Keep event names and payload types centralized in the service module or a shared contract.

## Related Pages

- [[patterns/frontend/api-service-and-query-hook-wiring]]
- [[patterns/frontend/index]]
- [[patterns/socket/example-of-module-socket]]
- [[patterns/socket/socket-error-handling]]
- [[decisions/file-backed-restrequest-editing]]
