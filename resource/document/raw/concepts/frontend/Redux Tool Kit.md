
Yes. The official Redux tutorial recommends the modern stack:

```text
React
  ↓
React-Redux
  ↓
Redux Toolkit (RTK)
  ├── configureStore
  ├── createSlice
  └── RTK Query
```

The Redux team recommends starting with **Redux Essentials**, using Redux Toolkit for Redux logic, React-Redux hooks for React integration, and RTK Query for API fetching/caching. ([Redux](https://redux.js.org/tutorials/index "Redux Tutorials Index | Redux"))

I'll use a **React + Vite + TypeScript** example.

## 1. Install RTK

```bash
npm install @reduxjs/toolkit react-redux
```

There are two packages because they have different jobs:

```text
@reduxjs/toolkit
    Redux itself
    configureStore()
    createSlice()
    createAsyncThunk()
    createApi()

react-redux
    connects React ↔ Redux
    Provider
    useSelector()
    useDispatch()
```

This is exactly the setup recommended by the official Quick Start. ([Redux](https://redux.js.org/tutorials/quick-start?utm_source=chatgpt.com "Quick Start | Redux"))

A reasonable project structure is:

```text
src/
├── app/
│   ├── store.ts
│   └── hooks.ts
│
├── features/
│   └── counter/
│       ├── counterSlice.ts
│       └── Counter.tsx
│
├── App.tsx
└── main.tsx
```

The important idea is:

```text
app/
    global Redux configuration

features/
    Redux state + UI belonging to individual features
```

---

# 2. Create the Redux store

Create:

```text
src/app/store.ts
```

```ts
import { configureStore } from '@reduxjs/toolkit'
import counterReducer from '../features/counter/counterSlice'

export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

The important part:

```ts
configureStore({
  reducer: {
    counter: counterReducer
  }
})
```

means your Redux state looks approximately like:

```ts
{
  counter: {
    value: 0
  }
}
```

You could eventually have:

```ts
configureStore({
  reducer: {
    counter: counterReducer,
    auth: authReducer,
    cart: cartReducer,
    settings: settingsReducer,
  },
})
```

Producing:

```ts
{
  counter: {...},
  auth: {...},
  cart: {...},
  settings: {...}
}
```

`configureStore` is the recommended RTK way to create a store. It also sets up sensible middleware defaults and Redux DevTools automatically. ([Redux](https://redux.js.org/tutorials/quick-start?utm_source=chatgpt.com "Quick Start | Redux"))

---

# 3. Create typed Redux hooks

Create:

```text
src/app/hooks.ts
```

```ts
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
```

Instead of repeatedly writing:

```ts
const dispatch = useDispatch<AppDispatch>()

const value = useSelector(
  (state: RootState) => state.counter.value
)
```

you can write:

```ts
const dispatch = useAppDispatch()

const value = useAppSelector(
  state => state.counter.value
)
```

The official TypeScript tutorial specifically recommends these pre-typed hooks. ([Redux](https://redux.js.org/tutorials/typescript-quick-start?utm_source=chatgpt.com "TypeScript Quick Start | Redux"))

---

# 4. Create your first Slice

This is one of the most important concepts in RTK.

Create:

```text
src/features/counter/counterSlice.ts
```

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface CounterState {
  value: number
}

const initialState: CounterState = {
  value: 0,
}

const counterSlice = createSlice({
  name: 'counter',

  initialState,

  reducers: {
    increment: state => {
      state.value += 1
    },

    decrement: state => {
      state.value -= 1
    },

    incrementByAmount: (
      state,
      action: PayloadAction<number>
    ) => {
      state.value += action.payload
    },

    reset: state => {
      state.value = 0
    },
  },
})

export const {
  increment,
  decrement,
  incrementByAmount,
  reset,
} = counterSlice.actions

export default counterSlice.reducer
```

There are several things happening here.

### `name`

```ts
name: 'counter'
```

RTK uses it when creating action names.

For example:

```ts
increment()
```

internally produces something similar to:

```ts
{
  type: 'counter/increment'
}
```

And:

```ts
incrementByAmount(10)
```

produces:

```ts
{
  type: 'counter/incrementByAmount',
  payload: 10
}
```

---

# 5. Why can we mutate `state`?

You may notice this:

```ts
increment: state => {
  state.value += 1
}
```

Classic Redux would normally tell you:

```ts
// Don't do this manually in vanilla Redux
state.value += 1
```

Instead you would need something similar to:

```ts
return {
  ...state,
  value: state.value + 1,
}
```

But RTK's `createSlice` uses **Immer**.

So:

```ts
state.value += 1
```

looks like mutation, but Immer produces an immutable state update behind the scenes. This is one of the reasons `createSlice` reduces so much Redux boilerplate. ([Redux](https://redux.js.org/tutorials/quick-start?utm_source=chatgpt.com "Quick Start | Redux"))

Conceptually:

```text
You write:

state.value += 1

              ↓

Immer observes changes

              ↓

Creates new immutable state

              ↓

Redux receives new state
```

---

# 6. Connect Redux to React

Open:

```text
src/main.tsx
```

Your Vite project probably starts roughly like this:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

Change it to:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'

import App from './App'
import { store } from './app/store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
)
```

This part:

```tsx
<Provider store={store}>
  <App />
</Provider>
```

is extremely important.

It essentially means:

```text
Redux Store
    ↓
Provider
    ↓
App
    ↓
all child components
```

Now every component underneath `<Provider>` can access Redux using React-Redux hooks. ([Redux](https://redux.js.org/tutorials/essentials/part-2-app-structure?utm_source=chatgpt.com "Redux Essentials, Part 2: Redux Toolkit App Structure | Redux"))

---

# 7. Use Redux inside a component

Create:

```text
src/features/counter/Counter.tsx
```

```tsx
import { useAppDispatch, useAppSelector } from '../../app/hooks'

import {
  increment,
  decrement,
  incrementByAmount,
  reset,
} from './counterSlice'

export function Counter() {
  const count = useAppSelector(
    state => state.counter.value
  )

  const dispatch = useAppDispatch()

  return (
    <div>
      <h1>{count}</h1>

      <button
        onClick={() => dispatch(increment())}
      >
        +1
      </button>

      <button
        onClick={() => dispatch(decrement())}
      >
        -1
      </button>

      <button
        onClick={() => dispatch(incrementByAmount(10))}
      >
        +10
      </button>

      <button
        onClick={() => dispatch(reset())}
      >
        Reset
      </button>
    </div>
  )
}
```

Then:

```tsx
// App.tsx

import { Counter } from './features/counter/Counter'

function App() {
  return (
    <main>
      <Counter />
    </main>
  )
}

export default App
```

---

# 8. Understand what happens when you click

This is probably the most important thing to understand.

Suppose:

```tsx
<button onClick={() => dispatch(increment())}>
```

You click it.

### Step 1 — Action creator

RTK generated:

```ts
increment()
```

It produces:

```ts
{
  type: 'counter/increment'
}
```

### Step 2 — Dispatch

```ts
dispatch(increment())
```

sends the action to Redux:

```text
Component
    ↓
dispatch()
    ↓
Redux Store
```

### Step 3 — Reducer receives it

RTK knows:

```text
counter/increment

belongs to

counterSlice
```

So this runs:

```ts
increment: state => {
  state.value += 1
}
```

If the previous state was:

```ts
{
  counter: {
    value: 0
  }
}
```

now it becomes:

```ts
{
  counter: {
    value: 1
  }
}
```

### Step 4 — selector detects change

Your component has:

```ts
const count = useAppSelector(
  state => state.counter.value
)
```

React-Redux observes:

```text
old: 0
new: 1
```

Therefore `<Counter />` re-renders.

So the complete cycle is:

```text
User
 │
 │ click "+1"
 ▼
Component
 │
 │ dispatch(increment())
 ▼
Action
{
  type: "counter/increment"
}
 │
 ▼
Redux Store
 │
 ▼
counterReducer
 │
 │ state.value += 1
 ▼
New Redux State
{
  counter: {
    value: 1
  }
}
 │
 ▼
useAppSelector()
 │
 ▼
React Re-render
 │
 ▼
UI shows 1
```

That is essentially the fundamental Redux data flow described by the Redux Essentials tutorial. ([Redux](https://redux.js.org/tutorials/essentials/part-3-data-flow?utm_source=chatgpt.com "Redux Essentials, Part 3: Basic Redux Data Flow | Redux"))

---

# 9. A more realistic example

Counter is good for learning, but let's say your application has authentication.

Structure:

```text
src/
├── app/
│   ├── store.ts
│   └── hooks.ts
│
└── features/
    └── auth/
        ├── authSlice.ts
        ├── LoginPage.tsx
        └── Profile.tsx
```

Your state might be:

```ts
interface AuthState {
  accessToken: string | null
  user: {
    id: string
    name: string
  } | null
  isAuthenticated: boolean
}
```

Slice:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface User {
  id: string
  name: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
}

const authSlice = createSlice({
  name: 'auth',

  initialState,

  reducers: {
    loginSuccess: (
      state,
      action: PayloadAction<{
        user: User
        accessToken: string
      }>
    ) => {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.isAuthenticated = true
    },

    logout: state => {
      state.user = null
      state.accessToken = null
      state.isAuthenticated = false
    },
  },
})

export const {
  loginSuccess,
  logout,
} = authSlice.actions

export default authSlice.reducer
```

Store:

```ts
import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

Now anywhere in the application:

```tsx
const user = useAppSelector(
  state => state.auth.user
)
```

or:

```tsx
const isAuthenticated = useAppSelector(
  state => state.auth.isAuthenticated
)
```

and logout:

```tsx
const dispatch = useAppDispatch()

<button onClick={() => dispatch(logout())}>
  Logout
</button>
```

This is where Redux becomes useful.

For example:

```text
LoginPage
    │
    │ login successful
    ▼
Redux auth state
    │
    ├──────────────┐
    ▼              ▼
Navbar          Profile
    │              │
shows name       user data
    │
    ▼
PrivateRoute
    │
checks isAuthenticated
```

All these components access one shared state instead of passing:

```text
App
 ↓ props
Layout
 ↓ props
Navbar
 ↓ props
Profile
```

---

# 10. But don't put everything into Redux

This is another important recommendation from the Redux tutorial.

For example:

```tsx
const [isModalOpen, setModalOpen] = useState(false)
```

Probably should remain local React state.

You don't necessarily need:

```ts
state.ui.isModalOpen
```

in Redux.

A useful rule:

```text
Does multiple unrelated parts of the app need this state?

        YES
         ↓
      Redux may make sense

        NO
         ↓
      useState may be enough
```

For example:

### Good Redux candidates

```text
authentication
current user
shopping cart
application settings
complex shared filters
notifications
global workflow state
```

### Usually local state

```text
input text
modal open/close
hover state
dropdown open
temporary form value
selected tab inside one component
```

The Redux Essentials docs explicitly distinguish global state that belongs in Redux from local state that should remain in React components. ([Redux](https://redux.js.org/tutorials/essentials/part-2-app-structure?utm_source=chatgpt.com "Redux Essentials, Part 2: Redux Toolkit App Structure | Redux"))

---

# 11. Then where does API data go?

This is where **RTK Query** enters the picture.

Suppose you have:

```text
GET /api/products
```

A common beginner approach would be:

```tsx
useEffect(() => {
  fetch('/api/products')
}, [])
```

and then:

```ts
loading
data
error
```

manually.

Modern Redux recommends RTK Query for this kind of **server state**. The tutorial index specifically lists RTK Query as the recommended tool for fetching and caching data. ([Redux](https://redux.js.org/tutorials/index "Redux Tutorials Index | Redux"))

Conceptually:

```text
Redux Toolkit
│
├── createSlice
│     ↓
│   client/global state
│
└── RTK Query
      ↓
    server/API state
```

For example:

```text
authSlice
    current logged-in user state

cartSlice
    shopping cart state

productApi
    GET /products
    GET /products/:id
    POST /products
```

---

# 12. RTK Query example

Suppose API:

```text
https://api.example.com/products
```

Create:

```text
src/services/productApi.ts
```

```ts
import {
  createApi,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react'

interface Product {
  id: number
  name: string
  price: number
}

export const productApi = createApi({
  reducerPath: 'productApi',

  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.example.com',
  }),

  endpoints: builder => ({
    getProducts: builder.query<Product[], void>({
      query: () => '/products',
    }),

    getProduct: builder.query<Product, number>({
      query: id => `/products/${id}`,
    }),
  }),
})

export const {
  useGetProductsQuery,
  useGetProductQuery,
} = productApi
```

Then register it:

```ts
import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import { productApi } from '../services/productApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,

    [productApi.reducerPath]: productApi.reducer,
  },

  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(
      productApi.middleware
    ),
})

export type RootState =
  ReturnType<typeof store.getState>

export type AppDispatch =
  typeof store.dispatch
```

And suddenly your component can do:

```tsx
import { useGetProductsQuery } from '../../services/productApi'

export function ProductList() {
  const {
    data,
    isLoading,
    error,
  } = useGetProductsQuery()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Something went wrong</div>
  }

  return (
    <div>
      {data?.map(product => (
        <div key={product.id}>
          {product.name}
        </div>
      ))}
    </div>
  )
}
```

No manual:

```ts
useEffect()
fetch()
setLoading()
setData()
setError()
```

RTK Query takes care of much of that.

---

# 13. Think about RTK as three layers

This mental model usually makes RTK easier to understand:

```text
┌─────────────────────────────────────┐
│               React                 │
│                                     │
│  ProductList   Navbar   LoginPage    │
└───────────────┬─────────────────────┘
                │
       React-Redux Hooks
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
 createSlice          RTK Query
       │                 │
       ▼                 ▼
 Client State        Server State
       │                 │
       │                 ▼
       │              REST API
       │
       └────────┬────────┘
                ▼
          Redux Store
```

Or, practically:

```text
useState
    ↓
temporary/local UI state

createSlice
    ↓
shared client-side state

RTK Query
    ↓
API/server state
```

---

# 14. Recommended structure for a real React app

I wouldn't create:

```text
redux/
├── actions/
├── reducers/
├── constants/
├── selectors/
└── types/
```

That's mostly the old Redux style.

With RTK, I would prefer feature-based organization:

```text
src/
├── app/
│   ├── store.ts
│   └── hooks.ts
│
├── features/
│   ├── auth/
│   │   ├── authSlice.ts
│   │   ├── LoginPage.tsx
│   │   └── Profile.tsx
│   │
│   ├── cart/
│   │   ├── cartSlice.ts
│   │   ├── Cart.tsx
│   │   └── CartItem.tsx
│   │
│   └── settings/
│       └── settingsSlice.ts
│
├── services/
│   ├── productApi.ts
│   └── orderApi.ts
│
├── components/
│
├── pages/
│
├── App.tsx
└── main.tsx
```

This closely follows the feature-oriented `"slices"` approach described by Redux Essentials. ([Redux](https://redux.js.org/tutorials/essentials/part-2-app-structure?utm_source=chatgpt.com "Redux Essentials, Part 2: Redux Toolkit App Structure | Redux"))

---

## The four pieces you should understand first

Don't try to learn all Redux concepts immediately. Start with these:

```text
1. configureStore()
        ↓
   creates Redux

2. createSlice()
        ↓
   defines state + how it changes

3. useAppSelector()
        ↓
   reads Redux state

4. useAppDispatch()
        ↓
   changes Redux state
```

Once these make sense:

```text
configureStore
createSlice
Provider
useSelector
useDispatch
```

then move to:

```text
RTK Query
```

for your backend requests.

That learning order is also aligned with the official Redux recommendation: **Redux Essentials first**, rather than starting with the lower-level Redux Fundamentals abstraction-free approach. ([Redux](https://redux.js.org/tutorials/index "Redux Tutorials Index | Redux"))

[Official Redux Tutorials](https://redux.js.org/tutorials/index?utm_source=chatgpt.com)

If your actual project is **React + TypeScript + Vite + TanStack Query**, there is also an important architectural question: **whether you need RTK Query at all or should use Redux Toolkit + TanStack Query together**. In that setup, I would normally use **RTK `createSlice` for global client state and TanStack Query for API/server state**, rather than introducing RTK Query too.