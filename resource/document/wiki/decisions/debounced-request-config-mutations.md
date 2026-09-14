# Debounced Request Configuration Mutations

**Summary**: Historical decision for the removed frontend debounce and mutation coordinator. Request configuration writes now use Socket.IO; the backend serializes writes but currently performs no version conflict check.
**Sources**: `frontend/src/pages/editor/components/RequestConfig/hooks/useRequestConfig.ts`
**Last updated**: 2026-09-12

---

> **Superseded**: The coordinator was removed on 2026-09-11. Its `baseVersion` conflict assumptions also stopped applying when backend checks were removed on 2026-09-12. See [[patterns/frontend/socket-io-service-and-hook-wiring]] for the current wiring pattern.

## Decision

Coordinate request configuration mutations in `useRequestConfig` rather than allowing each editor control to call the API independently. Each request has a coordinator keyed by its React Query key. The coordinator tracks the latest server version, pending field timers, and a promise queue.

Each field update follows this sequence:

1. Update the React Query cache optimistically.
2. Cancel the existing timer for that field.
3. Schedule a mutation after 350 ms of inactivity.
4. Append the mutation to the shared promise queue.
5. Store the returned version and response in the cache after success.

The queue serialized writes across fields, while field-specific timers prevented rapid edits to one field from producing unnecessary requests. Mutations sent the coordinator's latest `baseVersion`, which the backend used at the time to reject stale writes.

The hook owns the wiring for method, URL, headers, query parameters, JSON body, multipart form-data body, and post-request script updates. It also cancels pending timers, waits for queued writes, deletes with the latest version, and removes the query cache when a request is deleted.

## Example

The following simplified example shows what each part of the mechanism is for:

```ts
type Coordinator = {
  version: string
  timers: Map<string, ReturnType<typeof setTimeout>>
  queue: Promise<void>
}

// One coordinator is shared by all request-config controls for this request.
const coordinator: Coordinator = {
  version: currentRequest.version,
  timers: new Map(),
  queue: Promise.resolve(),
}

function enqueue(field: string, mutation: () => Promise<Request>) {
  // Replace the previous timer for this field.
  const previousTimer = coordinator.timers.get(field)
  if (previousTimer) clearTimeout(previousTimer)

  coordinator.timers.set(field, setTimeout(() => {
    coordinator.timers.delete(field)

    // Chain onto the queue so writes run one at a time.
    coordinator.queue = coordinator.queue.then(async () => {
      const savedRequest = await mutation()
      coordinator.version = savedRequest.version
      queryClient.setQueryData(queryKey, savedRequest)
    })
  }, 350))
}

function updateUrl(url: RequestURL) {
  // Make the UI respond immediately.
  queryClient.setQueryData(queryKey, {
    ...currentRequest,
    url,
  })

  // Persist the latest URL after the user stops editing for 350 ms.
  enqueue("url", () => RequestConfigServices.updateUrl(collectionId, requestId, {
    baseVersion: coordinator.version,
    url,
  }))
}
```

In this historical example, `queryClient.setQueryData` provided immediate UI feedback, `enqueue` reduced and ordered writes, and `RequestConfigServices.updateUrl` performed the API call. The shown `baseVersion` no longer has backend conflict semantics.

Deletion follows the opposite order: cancel timers, await `coordinator.queue`, delete with the latest `coordinator.version`, then remove the cached request.

## Consequences

- The editor remains responsive because local state is updated before persistence completes.
- Typing and repeated field edits are reduced to the latest debounced mutation for that field.
- Mutations for different fields cannot overwrite one another due to concurrent client-side writes.
- A failed mutation is surfaced through the hook's mutation error state, but the optimistic cache is not automatically rolled back.
- Deletion is ordered after already-enqueued mutations, while not-yet-fired debounced updates are discarded.

## Related Pages

- [[decisions/file-backed-restrequest-editing]]
- [[patterns/frontend/api-service-and-query-hook-wiring]]
- [[concepts/backend/file-backed-editor-sync]]
