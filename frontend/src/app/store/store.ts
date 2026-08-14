import {type Action, configureStore, type ThunkAction} from "@reduxjs/toolkit";
import {enableMapSet} from "immer";
import collectionReducer from "@/app/slices/collectionSlices.ts";
import testScenarioReducer from "@/app/slices/testScenarioSlice.ts";
import environmentReducer from "@/app/slices/environmentSlice.ts";
import automationReducer from "@/app/slices/automationSlice.ts";

enableMapSet();

export const store = configureStore({
    reducer: {
        collection: collectionReducer,
        testScenario: testScenarioReducer,
        environment: environmentReducer,
        automation: automationReducer,
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
