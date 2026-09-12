import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@/app/store/store.ts";
import type {SendResponse} from "@/types/response.ts";

export type ResponseData = SendResponse;

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
    },
});

export const {setResponse} = restApiSlice.actions;
export const selectResponseByRequestId = (state: RootState, requestId: string) =>
    state.RestApi.responses.get(requestId);

export default restApiSlice.reducer;
