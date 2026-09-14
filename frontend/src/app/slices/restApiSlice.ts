import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@/app/store/store.ts";
import type {ScriptLog, SendResponse} from "@/types/response.ts";

export interface ResponseData extends SendResponse {
    result?: unknown;
    mutations?: Record<string, string | null>;
    logs?: ScriptLog[];
}

export interface RestApiState {
    responses: Map<string, ResponseData>;
}

const initialRestApiState: RestApiState = {
    responses: new Map(),
};

const restApiSlice = createSlice({
    name: "RestApi",
    initialState: initialRestApiState,
    reducers: {
        setResponse(state, action: PayloadAction<{requestId: string; response: ResponseData}>) {
            state.responses.set(action.payload.requestId, action.payload.response);
        },
        setScriptResult(
            state,
            action: PayloadAction<{
                requestId: string;
                result?: unknown;
                mutations?: Record<string, string | null>;
                logs?: ScriptLog[];
            }>
        ) {
            const existing = state.responses.get(action.payload.requestId);
            if (existing) {
                state.responses.set(action.payload.requestId, {
                    ...existing,
                    result: action.payload.result,
                    mutations: action.payload.mutations,
                    logs: action.payload.logs,
                });
            } else {
                state.responses.set(action.payload.requestId, {
                    rawRequest: "",
                    responseTime: 0,
                    responseSize: "0",
                    protocol: "",
                    statusCode: 0,
                    statusText: "",
                    data: null,
                    result: action.payload.result,
                    mutations: action.payload.mutations,
                    logs: action.payload.logs,
                });
            }
        },
    },
});

export const {setResponse, setScriptResult} = restApiSlice.actions;
export const selectResponseByRequestId = (state: RootState, requestId: string) =>
    state.RestApi.responses.get(requestId);
export const selectScriptResultByRequestId = (state: RootState, requestId: string) =>
    state.RestApi.responses.get(requestId)?.result;
export const selectScriptMutationsByRequestId = (state: RootState, requestId: string) =>
    state.RestApi.responses.get(requestId)?.mutations;
export const selectScriptLogsByRequestId = (state: RootState, requestId: string) =>
    state.RestApi.responses.get(requestId)?.logs;

export default restApiSlice.reducer;
