import {type Action, configureStore, type ThunkAction} from "@reduxjs/toolkit";
import {enableMapSet} from "immer";
import editorTabsReducer from "@/app/slices/editorTabsSlice.ts";

enableMapSet();

export const store = configureStore({
    reducer: {
        editorTabs: editorTabsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredPaths: ['collection.dirTree'],
            },
        }),
})

export type AppStore = typeof store
export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
export type AppThunk = ThunkAction<void, RootState, unknown, Action>
