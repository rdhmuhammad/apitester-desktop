import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@/app/store/store.ts";
import type {ColtReqMethod, EditorTab} from "@/pages/editor/types/editor.ts";

export interface EditorTabsState {
    tabs: EditorTab[];
    activeTabId: string;
    activeExampleIdByTab: Record<string, string | null>;
}

export const initialEditorTabsState: EditorTabsState = {
    tabs: [],
    activeTabId: '',
    activeExampleIdByTab: {},
};

const editorTabsSlice = createSlice({
    name: 'editorTabs',
    initialState: initialEditorTabsState,
    reducers: {
        syncEditorTabs(state, action: PayloadAction<EditorTab[]>) {
            const pinnedIds = new Set(state.tabs.filter(tab => tab.pinned).map(tab => tab.id));
            state.tabs = (action.payload || [])
                .filter((tab): tab is EditorTab => Boolean(tab?.id))
                .map(tab => ({...tab, pinned: tab.pinned ?? pinnedIds.has(tab.id)}))
                .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
            if (!state.tabs.some(tab => tab.id === state.activeTabId)) {
                state.activeTabId = state.tabs[state.tabs.length - 1]?.id ?? '';
            }
        },
        setEditorActiveTab(state, action: PayloadAction<string>) {
            if (action.payload === '' || state.tabs.some(tab => tab.id === action.payload)) {
                state.activeTabId = action.payload;
            }
        },
        setActiveExampleId(state, action: PayloadAction<{tabId: string; exampleId: string | null}>) {
            if (!state.activeExampleIdByTab) {
                state.activeExampleIdByTab = {};
            }
            state.activeExampleIdByTab[action.payload.tabId] = action.payload.exampleId;
        },
        resetEditorTabs() {
            return initialEditorTabsState;
        },
        openEditorTab(state, action: PayloadAction<EditorTab>) {
            if (!action.payload?.id) return;
            if (!state.tabs.some(tab => tab.id === action.payload.id)) {
                state.tabs.push(action.payload);
                state.tabs.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
            }
            state.activeTabId = action.payload.id;
        },
        removeEditorTab(state, action: PayloadAction<string>) {
            state.tabs = state.tabs.filter(tab => tab.id !== action.payload);
            if (state.activeExampleIdByTab) {
                delete state.activeExampleIdByTab[action.payload];
            }
            if (state.activeTabId === action.payload) {
                state.activeTabId = state.tabs[state.tabs.length - 1]?.id ?? '';
            }
        },
        closeAllEditorTabs(state) {
            state.tabs = state.tabs.filter(tab => tab.pinned);
            const keptIds = new Set(state.tabs.map(tab => tab.id));
            for (const tabId of Object.keys(state.activeExampleIdByTab)) {
                if (!keptIds.has(tabId)) delete state.activeExampleIdByTab[tabId];
            }
            if (!keptIds.has(state.activeTabId)) {
                state.activeTabId = state.tabs[state.tabs.length - 1]?.id ?? '';
            }
        },
        closeOtherEditorTabs(state, action: PayloadAction<string>) {
            if (!state.tabs.some(tab => tab.id === action.payload)) return;
            state.tabs = state.tabs.filter(tab => tab.id === action.payload || tab.pinned);
            const keptIds = new Set(state.tabs.map(tab => tab.id));
            for (const tabId of Object.keys(state.activeExampleIdByTab)) {
                if (!keptIds.has(tabId)) delete state.activeExampleIdByTab[tabId];
            }
            state.activeTabId = action.payload;
        },
        togglePinEditorTab(state, action: PayloadAction<string>) {
            const tab = state.tabs.find(tab => tab.id === action.payload);
            if (!tab) return;
            tab.pinned = !tab.pinned;
            state.tabs.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
        },
        renameEditorTab(state, action: PayloadAction<{id: string; newId?: string; label: string}>) {
            const tab = state.tabs.find(tab => tab.id === action.payload.id);
            if (tab?.type === 'request' || tab?.type === 'document') {
                tab.label = action.payload.label;
                if (action.payload.newId && action.payload.newId !== tab.id) {
                    const wasActive = state.activeTabId === tab.id;
                    tab.id = action.payload.newId;
                    if (wasActive) {
                        state.activeTabId = action.payload.newId;
                    }
                }
            }
        },
        updateEditorTab(state, action: PayloadAction<{id: string; label?: string; method?: ColtReqMethod | 'DOC'}>) {
            const tab = state.tabs.find(tab => tab.id === action.payload.id);
            if (tab?.type === 'request' || tab?.type === 'document') {
                if (action.payload.label !== undefined) {
                    tab.label = action.payload.label;
                }
                if (action.payload.method !== undefined) {
                    tab.method = action.payload.method;
                }
            }
        },
    },
});

export const {
    syncEditorTabs,
    setEditorActiveTab,
    setActiveExampleId,
    resetEditorTabs,
    openEditorTab,
    removeEditorTab,
    closeAllEditorTabs,
    closeOtherEditorTabs,
    togglePinEditorTab,
    renameEditorTab,
    updateEditorTab,
} = editorTabsSlice.actions;
export const setTabs = syncEditorTabs;
export const setActiveTabId = setEditorActiveTab;
export const removeTab = removeEditorTab;
export const selectEditorTabs = (state: RootState) => state.editorTabs.tabs;
export const selectEditorActiveTabId = (state: RootState) => state.editorTabs.activeTabId;
export const selectEditorActiveTabIds = (state: RootState) => state.editorTabs.tabs.map(tb=> tb.id);
export const selectEditorActiveTab = (state: RootState) =>
    state.editorTabs.tabs.find(tab => tab.id === state.editorTabs.activeTabId);
export const selectActiveExampleId = (state: RootState) =>
    state.editorTabs.activeExampleIdByTab?.[state.editorTabs.activeTabId] ?? null;

export default editorTabsSlice.reducer;
