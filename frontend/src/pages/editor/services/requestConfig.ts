import axios from "@/config/axios.ts"
import type {ItemUrl, ReqAuth, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"
import type {Response} from "@/types/response.ts"
import {socketCollection} from "@/pages/editor/services/mainSocket.ts"

export interface ExampleResponse {
    name: string
    status?: string
    code?: number
    body?: string
    header?: ItemUrl[] | Array<{key: string; value: string}>
}

export interface RestRequestResponse {
    id: string
    name: string
    method: string
    url: RequestURL
    headers: ItemUrl[]
    query: ItemUrl[]
    body?: RequestBody
    auth?: ReqAuth
    script: string
    responses?: ExampleResponse[]
    version: string
}

export type Versioned = {baseVersion: string}

export const requestConfigQueryKey = (collectionId: string, requestId: string) =>
    ["request-config", collectionId, requestId] as const

const socketEvents = {
    updateMethod: "request:update:method",
    updateName: "request:update:name",
    updateUrl: "request:update:url",
    updateHeaders: "request:update:headers",
    updateAuth: "request:update:auth",
    updateQuery: "request:update:query",
    updateJsonBody: "request:update:body:json",
    updateFormDataBody: "request:update:body:formdata",
    updatePostRequestScript: "request:update:script",
    delete: "request:delete",
    saveResponse: "request:save:response",
    saveScript: "request:save:script",
    error: "request:error",
    success: "request:success",
} as const

type RequestIdentity = {collectionId: string; requestId: string}
type SocketResult = {operation: string; request: RestRequestResponse}
type SocketError = {operation: string; message: string}

const emitRequestEvent = <T extends Versioned>(
    event: string,
    operation: string,
    identity: RequestIdentity,
    data: T,
): Promise<RestRequestResponse> => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Socket event timed out: ${operation}`))
    }, 30_000)

    const handleSuccess = (payload: SocketResult) => {
        console.log(payload)
        if (payload?.operation !== operation) return
        cleanup()
        resolve(payload.request)
    }
    const handleError = (payload: SocketError) => {
        if (payload?.operation !== operation) return
        cleanup()
        reject(new Error(payload.message || `Failed to execute ${operation}`))
    }
    const cleanup = () => {
        clearTimeout(timeout)
        socketCollection.off(socketEvents.success, handleSuccess)
        socketCollection.off(socketEvents.error, handleError)
    }

    socketCollection.on(socketEvents.success, handleSuccess)
    socketCollection.on(socketEvents.error, handleError)
    socketCollection.emit(event, {...identity, ...data})
})

export const RequestConfigServices = {
    create: async (collectionId: string): Promise<RestRequestResponse> => {
        const response = await axios.post<Response<RestRequestResponse>>(
            `/restrequest/create-request/${collectionId}`
        )
        return response.data.data
    },

    get: async (collectionId: string, requestId: string): Promise<RestRequestResponse> => {
        const response = await axios.get<Response<RestRequestResponse>>(
            `/restrequest/${collectionId}/${requestId}`
        )
        return response.data.data
    },

    updateMethod: (collectionId: string, requestId: string, data: Versioned & {method: string}) =>
        emitRequestEvent(socketEvents.updateMethod, socketEvents.updateMethod, {collectionId, requestId}, data),

    updateName: (collectionId: string, requestId: string, data: Versioned & {name: string}) =>
        emitRequestEvent(socketEvents.updateName, socketEvents.updateName, {collectionId, requestId}, data),

    updateUrl: (collectionId: string, requestId: string, data: Versioned & {url: RequestURL}) =>
        emitRequestEvent(socketEvents.updateUrl, socketEvents.updateUrl, {collectionId, requestId}, data),

    updateHeaders: (collectionId: string, requestId: string, data: Versioned & {headers: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateHeaders, socketEvents.updateHeaders, {collectionId, requestId}, data),

    updateAuth: (collectionId: string, requestId: string, data: Versioned & {type: string; bearer?: ItemUrl[]; authSource: string}) =>
        emitRequestEvent(socketEvents.updateAuth, socketEvents.updateAuth, {collectionId, requestId}, data),

    updateQuery: (collectionId: string, requestId: string, data: Versioned & {query: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateQuery, socketEvents.updateQuery, {collectionId, requestId}, data),

    updateJsonBody: (collectionId: string, requestId: string, data: Versioned & {raw: string}) =>
        emitRequestEvent(socketEvents.updateJsonBody, socketEvents.updateJsonBody, {collectionId, requestId}, data),

    updateFormDataBody: (collectionId: string, requestId: string, data: Versioned & {formdata: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateFormDataBody, socketEvents.updateFormDataBody, {collectionId, requestId}, data),

    updatePostRequestScript: (collectionId: string, requestId: string, data: Versioned & {exec: string[]; type?: string}) =>
        emitRequestEvent(socketEvents.updatePostRequestScript, socketEvents.updatePostRequestScript, {collectionId, requestId}, data),

    saveResponse: (
        collectionId: string,
        requestId: string,
        data: Versioned & {
            name: string
            status?: string
            code?: number
            body?: string
            header?: Array<{key: string; value: string}>
        }
    ) =>
        emitRequestEvent(
            socketEvents.saveResponse,
            socketEvents.saveResponse,
            {collectionId, requestId},
            data
        ),

    savePostRequestScript: (
        collectionId: string,
        requestId: string,
        data: Versioned & {exec?: string[]; script?: string; type?: string}
    ) =>
        emitRequestEvent(
            socketEvents.saveScript,
            socketEvents.saveScript,
            {collectionId, requestId},
            data
        ),


    delete: async (collectionId: string, requestId: string, data: Versioned): Promise<RestRequestResponse> => {
        const response = await axios.delete<Response<RestRequestResponse>>(
            `/restrequest/${collectionId}/${requestId}`,
            {data},
        )
        return response.data.data
    },
}
