import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@/app/store/store.ts";
import type {EditorTab} from "@/pages/editor/types/editor.ts";

export interface EditorTabsState {
    tabs: EditorTab[];
    activeTabId: string;
    collectionId: string | null;
}

export const initialEditorTabsState: EditorTabsState = {
    tabs: [],
    activeTabId: '',
    collectionId: null,
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
        setCollectionId(state, action: PayloadAction<string | null>) {
            state.collectionId = action.payload;
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
    },
});

export const {
    syncEditorTabs,
    setEditorActiveTab,
    setCollectionId,
    resetEditorTabs,
    openEditorTab,
    removeEditorTab,
    renameEditorTab,
} = editorTabsSlice.actions;
export const setTabs = syncEditorTabs;
export const setActiveTabId = setEditorActiveTab;
export const removeTab = removeEditorTab;
export const selectEditorTabs = (state: RootState) => state.editorTabs.tabs;
export const selectEditorActiveTabId = (state: RootState) => state.editorTabs.activeTabId;
export const selectCollectionId = (state: RootState) => state.editorTabs.collectionId;
export const selectEditorActiveTabIds = (state: RootState) => state.editorTabs.tabs.map(tb=> tb.id)
export const selectEditorActiveTab = (state: RootState) =>
    state.editorTabs.tabs.find(tab => tab.id === state.editorTabs.activeTabId);

export default editorTabsSlice.reducer;
