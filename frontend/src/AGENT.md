# AGENTS.md

## Frontend
### Stack
- **Language:** TypeScript ~5.8 (strict mode, `verbatimModuleSyntax`, `erasableSyntaxOnly`)
- **Framework:** React 19.1 + React DOM 19.1
- **Bundler:** Vite 7.0 with `@vitejs/plugin-react`
- **State:** Redux Toolkit 2.11 + react-redux 9.2 (with `enableMapSet()` for Map-based state)
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin (no PostCSS config) + shadcn/ui (New York style, neutral base color)
- **Package manager:** pnpm
- **Class utils:** `cn()` = `twMerge(clsx(inputs))` in `src/lib/utils.ts`
- **Desktop:** Electron 35 with electron-builder (Windows portable target)

### Project Layout
```
frontend/src/
├── main.tsx                         # React entry (mounts <App />)
├── App.tsx                          # Root: Provider + TooltipProvider + Sonner + RouterProvider
├── index.css                        # Tailwind CSS entry + theme design tokens (OKLCH dark mode)
├── app/
│   ├── store/
│   │   ├── store.ts                 # configureStore: collection + testScenario reducers
│   │   ├── hooks.ts                # useAppDispatch, useAppSelector (typed)
│   │   └── withTypes.ts            # createAppAsyncThunk (pre-typed)
│   └── slices/
│       ├── index.ts                # Shared types (ColtReqMethod, DirTree, CollectionState)
│       ├── collectionSlices.ts     # Main slice (558 lines): collection data, directory tree, active requests, variables
│       ├── requestSlices.ts        # Request-level reducers (323 lines): method, headers, query params, body, URL
│       └── testScenarioSlice.ts    # Test scenario CRUD + execution state (229 lines)
├── assets/images/                  # logo.svg, AppLogo.svg, api-tester-banner.png
├── components/
│   ├── ui/                         # 47 shadcn/ui components (accordion through tooltip)
│   └── common/                     # AppSidebar, CustomToast, BasePagination, CustomBreadcrumb, Dialogs
├── config/
│   ├── axios.ts                    # Axios instance (base URL from VITE_API_URL) + request/response interceptors
│   ├── constant/
│   │   ├── ENDPOINTS.ts           # API endpoint constants
│   │   ├── ROUTES.ts              # Route path constants
│   │   ├── sidebarRoutes.ts       # Sidebar navigation config
│   │   └── ...                    # Images, Language, localstorage
│   └── types/                     # BasePagination, BaseResponse (legacy, not actively used)
├── hooks/
│   ├── use-mobile.ts              # Mobile breakpoint detection
│   └── useLocalStorage.ts         # CryptoJS-encrypted localStorage wrapper
├── layout/
│   ├── view/
│   │   ├── MainLayout.tsx         # Root layout: Header + Sidebar + ShortcutLegend + <Outlet/>
│   │   ├── Header.tsx             # Main header (388 lines): logo, method, base URL, endpoint, send
│   │   └── SidebarLayout.tsx      # Collection tree sidebar (194 lines): search, expand/collapse
│   ├── components/
│   │   ├── CollectionManagerDialog.tsx  # Modal for collection CRUD + env vars + pre-request script (453 lines)
│   │   ├── TestScenarioSidebar.tsx      # Test suite list in sidebar (137 lines)
│   │   └── ShortcutLegend.tsx           # Bottom-left keyboard shortcuts overlay
│   ├── hooks/
│   │   ├── useSendRequest.ts      # Axios request builder: JSON, multipart, blob handling (153 lines)
│   │   ├── useTestRunner.ts       # Multi-step test execution coordinator
│   │   ├── useScriptRunner.ts     # Web Worker-based JS script executor (pm.environment mock)
│   │   └── useCollectionPushPull.ts # Push/pull collection data to/from backend
│   ├── services/
│   │   ├── collection.ts         # CollectionService: CRUD + file operations (67 lines)
│   │   └── testScenario.ts       # TestScenarioService: test file CRUD (31 lines)
│   └── types/
│       └── headerContext.ts      # HeaderAction type
├── lib/
│   ├── assertionEngine.ts        # Expression evaluation for test assertions
│   ├── fileStore.ts              # In-memory file reference store (for multipart uploads)
│   ├── httpParser.ts             # .http file parser/serializer (168 lines)
│   └── utils.ts                  # cn() utility
├── pages/
│   ├── NotFound/index.tsx        # 404 page
│   └── editor/
│       ├── index.tsx             # Main Editor workspace (160 lines): tabs, request/response layout
│       ├── components/
│       │   ├── RequestConfigTabs.tsx      # Params / Auth / Headers / Body tabs (508 lines)
│       │   ├── ResponseView.tsx           # Response display: Pretty, Console, binary preview (446 lines)
│       │   ├── TestScenarioEditor.tsx     # Visual + raw .http test editor (565 lines)
│       │   ├── WelcomeEditor.tsx          # Empty state when no collection loaded
│       │   └── RequestConfig/
│       │       ├── AuthContent.tsx        # Auth type switcher (none/inherit/bearer)
│       │       ├── BodyEditor.tsx         # JSON (Sandpack) or multipart/form-data editors (448 lines)
│       │       └── ScriptEditor.tsx       # Sandpack-based script editor
│       └── types/
│           ├── api.ts                    # Postman-compatible collection types (114 lines)
│           └── testScenario.ts           # Test scenario types (72 lines)
├── routes/
│   └── index.tsx                  # createHashRouter: root → /editor (only one route), * → NotFound
└── types/
    ├── electron.d.ts             # Window.electronAPI interface
    └── response.ts               # Response<T>, SendResponse, ScriptLog
```

### Routing
- **Router:** React Router v7 `createHashRouter` (hash-based, no server-side routing needed)
- **Single route:** `/editor` → `MainLayout` > `<Editor />`; root redirects to `/editor`; `*` → `NotFound`


### Key Libraries
- **Forms:** react-hook-form 7 + zod 4 + @hookform/resolvers
- **Code editors:** @codesandbox/sandpack-react (JSON/body and scripts)
- **Notifications:** sonner (toast), sweetalert2 (dialog)
- **Dates:** date-fns 4, moment 2
- **Charts:** recharts 2
- **i18n:** i18next 25 + react-i18next 15
- **Misc:** xlsx (Excel preview), crypto-js (localStorage encryption), cmdk (command palette)

### Electron
- Main process: `electron/main.ts` — BrowserWindow (1200x800), contextIsolation, preload
- Preload: `electron/preload.cjs` — exposes `window.electronAPI.openFileDialog()` via contextBridge
- Build: electron-builder targeting Windows portable; resedit for exe metadata
- Scripts: `dev:electron`, `build:electron`, `build:electron:dist`, `copy-preload`

### Running Frontend
```bash
cd frontend
pnpm install
pnpm run dev            # Vite dev server only
pnpm run dev:electron   # Vite + Electron concurrently
```

- **Frontend:** Redux slice actions flow through `collectionSlices.ts` central store; `requestSlices.ts` reducers are consumed as extraReducers (not registered independently)
- **Frontend:** Dirty/unsaved request edits are tracked via `dirtyRequestIds[]` and shown with orange dot indicators
- **Frontend:** Test scripts run in isolated Web Workers with a `pm.environment` mock and 5s timeout
- **Frontend:** Push/pull model for persistence: Ctrl+S to push, Ctrl+P to pull, Ctrl+Enter to send request
- **Frontend:** Variable resolution with `{{variableName}}` template syntax across collection and captured test variables
