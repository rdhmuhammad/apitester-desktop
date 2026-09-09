# Create New Tabs Kind

**Summary**: Checklist for adding a new editor tab kind across tab metadata, Redux state, tab identifiers, menu actions, close behavior, and rendering.
**Sources**: `frontend/src/pages/editor/index.tsx`, `frontend/src/lib/tabUtils.ts`, `frontend/src/app/slices/collectionSlices.ts`, `frontend/src/app/slices/testScenarioSlice.ts`, `frontend/src/app/slices/automationSlice.ts`
**Last updated**: 2026-09-07

---

The editor combines request tabs with feature-specific tabs in `frontend/src/pages/editor/index.tsx`. A new tab kind should have one stable identifier format and one source of truth for its open-tab state.

## Implementation Checklist

1. Add the new tab type to `EditorTab` and its type union in `frontend/src/app/slices/index.ts`.
2. Add `to...TabId` and `from...TabId` helpers in `frontend/src/lib/tabUtils.ts`.
3. Add backing state, selectors, and open/create/close actions in the relevant slice.
4. Add a tab mapping in `Editor()` and register its label and method metadata in `allTabs`.
5. Add a method badge style in `methodStyle`.
6. Add a `New Tab` menu action that creates the resource and activates its encoded tab ID.
7. Add close handling and select the last remaining tab when the active tab closes.
8. Import and render the new editor component in the active-tab branch.

## Simple Slice Example

The slice should store resource records separately from the list of open tabs. The open-tab list contains resource IDs, while the editor converts them to display tab IDs.

```ts
interface NotesState {
    notes: Note[]
    activeIds: string[]
}

const initialState: NotesState = {notes: [], activeIds: []}

const notesSlice = createSlice({
    name: 'notes',
    initialState,
    reducers: {
        openNoteTab(state, action: PayloadAction<string>) {
            if (!state.activeIds.includes(action.payload)) {
                state.activeIds.push(action.payload)
            }
        },
        closeNoteTab(state, action: PayloadAction<string>) {
            state.activeIds = state.activeIds.filter(id => id !== action.payload)
        },
    },
})

export const {openNoteTab, closeNoteTab} = notesSlice.actions
export const selectNotes = (state: RootState) => state.notes.notes
export const selectActiveNoteIds = (state: RootState) => state.notes.activeIds
export default notesSlice.reducer
```

## Editor Integration

For example, a `note` tab would use `note-<id>` IDs, map `activeIds` to `EditorTab` values, add `NOTE` to `methodStyle`, and render `NoteEditor` when `activeTab.type === 'note'`. The menu action should dispatch the create thunk, then dispatch `setActiveTabId({id: toNoteTabId(created.id)})` after creation succeeds.

## Related Files

- [[patterns/frontend/index]]
- [[concepts/index]]
