import axios from "@/config/axios.ts"
import type {ItemUrl, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"
import type {Response} from "@/types/response.ts"
import {socketCollection} from "@/pages/editor/services/mainSocket.ts"

export interface RestRequestResponse {
    id: string
    name: string
    method: string
    url: RequestURL
    headers: ItemUrl[]
    query: ItemUrl[]
    body?: RequestBody
    script: string
    version: string
}

export type Versioned = {baseVersion: string}

export const requestConfigQueryKey = (collectionId: string, requestId: string) =>
    ["request-config", collectionId, requestId] as const

const socketEvents = {
    updateMethod: "restrequest:update:method",
    updateUrl: "restrequest:update:url",
    updateHeaders: "restrequest:update:headers",
    updateAuthorization: "restrequest:update:authorization",
    updateQuery: "restrequest:update:query",
    updateJsonBody: "restrequest:update:body:json",
    updateFormDataBody: "restrequest:update:body:formdata",
    updatePostRequestScript: "restrequest:update:script",
    delete: "restrequest:delete",
    error: "restrequest:error",
    success: "restrequest:success",
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
    get: async (collectionId: string, requestId: string): Promise<RestRequestResponse> => {
        const response = await axios.get<Response<RestRequestResponse>>(
            `/restrequest/${collectionId}/${requestId}`
        )
        return response.data.data
    },

    updateMethod: (collectionId: string, requestId: string, data: Versioned & {method: string}) =>
        emitRequestEvent(socketEvents.updateMethod, "restrequest:update:method", {collectionId, requestId}, data),

    updateUrl: (collectionId: string, requestId: string, data: Versioned & {url: RequestURL}) =>
        emitRequestEvent(socketEvents.updateUrl, "restrequest:update:url", {collectionId, requestId}, data),

    updateHeaders: (collectionId: string, requestId: string, data: Versioned & {headers: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateHeaders, "restrequest:update:headers", {collectionId, requestId}, data),

    updateAuthorization: (collectionId: string, requestId: string, data: Versioned & {type: string; token?: string}) =>
        emitRequestEvent(socketEvents.updateAuthorization, "restrequest:update:authorization", {collectionId, requestId}, data),

    updateQuery: (collectionId: string, requestId: string, data: Versioned & {query: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateQuery, "restrequest:update:query", {collectionId, requestId}, data),

    updateJsonBody: (collectionId: string, requestId: string, data: Versioned & {raw: string}) =>
        emitRequestEvent(socketEvents.updateJsonBody, "restrequest:update:body:json", {collectionId, requestId}, data),

    updateFormDataBody: (collectionId: string, requestId: string, data: Versioned & {formdata: ItemUrl[]}) =>
        emitRequestEvent(socketEvents.updateFormDataBody, "restrequest:update:body:formdata", {collectionId, requestId}, data),

    updatePostRequestScript: (collectionId: string, requestId: string, data: Versioned & {exec: string[]; type?: string}) =>
        emitRequestEvent(socketEvents.updatePostRequestScript, "restrequest:update:script", {collectionId, requestId}, data),

    delete: (collectionId: string, requestId: string, data: Versioned) =>
        emitRequestEvent(socketEvents.delete, "restrequest:delete", {collectionId, requestId}, data),
}
