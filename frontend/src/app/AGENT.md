# AGENTS.md

### State Management
- **Store:** Two reducer keys: `collection` + `testScenario`
- **Slice architecture:** `collectionSlices.ts` is the central data store; `requestSlices.ts` reducers are consumed via `extraReducers` in `collectionSlices.ts` (requestSlices reducer is exported but NOT registered in the store directly)
- **Dirty tracking:** In-memory edits to requests are tracked via `dirtyRequestIds[]` array. Unsaved edits show an orange dot indicator. `saveActiveToData` reducer flushes active edits back to persisted data
- **Directory tree:** Nested `Map<string, DirTree>` (needs `enableMapSet()` + serializable check disabled for this path). Each node has `REQ` (request) or `FOLD` (folder) category
- **Typed hooks:** `useAppDispatch()` and `useAppSelector()` via Redux Toolkit's `.withTypes<>()`; `createAppAsyncThunk` for typed async thunks
