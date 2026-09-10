# API Service and Query Hook Wiring

**Summary**: Frontend feature API calls are organized as typed Axios service methods and exposed through a feature-local TanStack Query hook. Components use the hook for server data, loading state, refetching, and mutations.
**Sources**: `resource/document/raw/patterns/frontend/Pattern of wiring.md`, `frontend/src/pages/editor/components/RequestConfig/services/requestConfig.ts`, `frontend/src/pages/editor/components/RequestConfig/hooks/useRequestConfig.ts`, `frontend/src/layout/components/RequestHeader.tsx`, `frontend/src/pages/editor/components/RequestConfig/index.tsx`, `frontend/src/App.tsx`
**Last updated**: 2026-09-10

---

## Service Layer

Create a service object in a feature-local `services` folder. Each method should represent one endpoint call, use the shared endpoint constants, encode path parameters, and return the useful value from the API response rather than the full Axios response.

```ts
export const SessionManagementServices = {
  getSessions: async (): Promise<ISessionCurrentResponse[]> => {
    const response = await axios.get<Response<ISessionCurrentResponse[]>>(
      ENDPOINTS.SESSIONS.CURRENT,
    )
    return response.data.result ?? []
  },
  getTimeline: async (phone: string): Promise<ISessionTimelineResponse[]> => {
    const response = await axios.get<Response<ISessionTimelineResponse[]>>(
      ENDPOINTS.SESSIONS.TIMELINE.replace('{phoneNumber}', encodeURIComponent(phone)),
    )
    return response.data.result ?? []
  },
}
```

## Query Hook

Create a feature-local hook in a `hooks` folder. Use `useQuery` for reads and `useMutation` or an equivalent hook-owned mutation coordinator for writes. Query keys should include the feature name and any parameter that changes the result. Dependent queries should be disabled until their required input exists.

Recommended options from the source pattern include:

- `gcTime: 0` when the feature should not retain cached data after it is unused.
- `refetchOnWindowFocus: false` when implicit refetching is not desired.
- `enabled: Boolean(parameter)` for queries that require a selected resource.
- Stable empty-array fallbacks when query data is not yet available.

The hook should return domain-oriented data and flags, not require components to understand the query objects:

```ts
return {
  sessions: sessionsQuery.data ?? EMPTY_SESSIONS,
  timeline: timelineQuery.data ?? EMPTY_TIMELINE,
  isLoadingSessions: sessionsQuery.isLoading || sessionsQuery.isFetching,
  isLoadingTimeline: timelineQuery.isLoading || timelineQuery.isFetching,
  refetchSessions: sessionsQuery.refetch,
  refetchTimeline: timelineQuery.refetch,
  createSessionMutation,
  endSessionMutation,
}
```

Mutation errors should be typed where possible and mapped to user-visible toast messages. Successful mutations can also show confirmation feedback in the hook, keeping common request feedback out of feature components.

## Component Usage

Components should validate and normalize input before calling the hook's domain operation. After a successful mutation, close or reset the relevant UI, refetch affected queries, and update the selected resource when the response identifies one. When multiple sibling components edit the same resource, the hook should use one stable query key and coordinate versioned writes so components share cache state without an intermediate context proxy.

```ts
const handleCreateSession = async (payload: ICreateSessionRequest) => {
  const phone = payload.phone.trim()
  const message = payload.message.trim()

  if (!phone || !message || !payload.step) {
    CustomToast.error('Phone, step, and message are required')
    return
  }

  const created = await createSessionMutation.mutateAsync({
    phone,
    step: payload.step,
    message,
  })

  closeCreateDialog(false)
  await refetchSessions()
  if (created?.phone) {
    setSelectedPhone(created.phone)
  }
}
```

## Related Pages

- [[patterns/frontend/index]]
- [[concepts/frontend/redux-toolkit]]
- [[patterns/frontend/create-new-tabs-kind]]
