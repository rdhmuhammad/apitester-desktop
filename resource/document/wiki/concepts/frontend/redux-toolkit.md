# Redux Toolkit

**Summary**: Redux Toolkit (RTK) is the recommended modern approach for Redux state in React applications. It combines `configureStore`, `createSlice`, typed React-Redux hooks, and RTK Query while keeping shared client state separate from local UI state and server state.
**Sources**: `resource/document/raw/concepts/frontend/Redux Tool Kit.md`
**Last updated**: 2026-09-08

---

## Core stack

RTK applications commonly use these layers:

- `configureStore` creates the store and applies sensible middleware and DevTools defaults.
- `createSlice` colocates feature state, reducers, and generated action creators.
- React-Redux `Provider`, `useSelector`, and `useDispatch` connect components to the store.
- Typed `useAppSelector` and `useAppDispatch` wrappers keep TypeScript usage consistent.
- RTK Query handles API fetching, caching, loading, and error state.

## State boundaries

Redux is intended for shared client state used by multiple unrelated parts of an application, such as authentication, settings, notifications, or complex workflow state. Temporary input values, modal visibility, hover state, and a tab local to one component should normally remain in React local state.

Server state should not be modeled as ordinary client state when a query library can manage it. RTK Query is the Redux-native option for this purpose. Projects already using TanStack Query may use RTK slices for shared client state and TanStack Query for server state instead of introducing RTK Query.

## Feature organization

Prefer feature-oriented modules over the legacy split of `actions`, `reducers`, `constants`, and `selectors` directories:

```text
src/
├── app/
|   ├── slices
|   |   └── authSlice.ts
│   ├── store.ts
│   └── hooks.ts

```

The feature owns its state logic and related UI, while `app` contains only global store configuration.

## Update model

The standard data flow is:

```text
component
  -> dispatch(action)
  -> slice reducer
  -> new immutable state
  -> selector detects change
  -> component re-renders
```

Slice reducers may use mutation-style syntax because Immer converts those updates into immutable state changes.

## Project applicability

The API Tester frontend previously used Redux slices for collections, requests, environments, test scenarios, and automation. Those slices were removed during the frontend state reset on 2026-09-08; this page remains a general reference if Redux is reintroduced.

## Related pages

- [[patterns/frontend/index]]
- [[patterns/frontend/create-new-tabs-kind]]
- [[concepts/index]]
