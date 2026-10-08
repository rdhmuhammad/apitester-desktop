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
            state.tabs = action.payload;
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
            if (!state.tabs.some(tab => tab.id === action.payload.id)) {
                state.tabs.push(action.payload);
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
        renameEditorTab(state, action: PayloadAction<{id: string; label: string}>) {
            const tab = state.tabs.find(tab => tab.id === action.payload.id);
            if (tab?.type === 'request') {
                tab.label = action.payload.label;
            }
        },
        updateEditorTab(state, action: PayloadAction<{id: string; label?: string; method?: ColtReqMethod}>) {
            const tab = state.tabs.find(tab => tab.id === action.payload.id);
            if (tab?.type === 'request') {
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
