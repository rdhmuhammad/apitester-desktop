import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@/app/store/store.ts";
import type {EditorTab} from "@/app/slices/index.ts";

export interface EditorTabsState {
    tabs: EditorTab[];
    activeTabId: string;
}

export const initialEditorTabsState: EditorTabsState = {
    tabs: [],
    activeTabId: '',
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
        removeEditorTab(state, action: PayloadAction<string>) {
            state.tabs = state.tabs.filter(tab => tab.id !== action.payload);
            if (state.activeTabId === action.payload) {
                state.activeTabId = state.tabs[state.tabs.length - 1]?.id ?? '';
            }
        },
    },
});

export const {syncEditorTabs, setEditorActiveTab, removeEditorTab} = editorTabsSlice.actions;
export const setTabs = syncEditorTabs;
export const setActiveTabId = setEditorActiveTab;
export const removeTab = removeEditorTab;
export const selectEditorTabs = (state: RootState) => state.editorTabs.tabs;
export const selectEditorActiveTabId = (state: RootState) => state.editorTabs.activeTabId;
export const selectEditorActiveTab = (state: RootState) =>
    state.editorTabs.tabs.find(tab => tab.id === state.editorTabs.activeTabId);

export const selectTabs = selectEditorTabs;
export const selectActiveTabId = selectEditorActiveTabId;
export const selectActiveTab = selectEditorActiveTab;

export default editorTabsSlice.reducer;
