import axios from "@/config/axios.ts"
import type {ItemUrl, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"
import type {Response} from "@/types/response.ts"

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

type Versioned = {baseVersion: string}

const endpoint = (collectionId: string, requestId: string, field: string) =>
    `/restrequest/${collectionId}/${requestId}/${field}`

export const RestRequestServices = {
    get: async (collectionId: string, requestId: string): Promise<RestRequestResponse> => {
        const response = await axios.get<Response<RestRequestResponse>>(
            `/restrequest/${collectionId}/${requestId}`
        )
        return response.data.data
    },

    updateMethod: async (collectionId: string, requestId: string, data: Versioned & {method: string}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "method"), data
        )
        return response.data.data
    },

    updateUrl: async (collectionId: string, requestId: string, data: Versioned & {url: RequestURL}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "url"), data
        )
        return response.data.data
    },

    updateHeaders: async (collectionId: string, requestId: string, data: Versioned & {headers: ItemUrl[]}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "headers"), data
        )
        return response.data.data
    },

    updateQuery: async (collectionId: string, requestId: string, data: Versioned & {query: ItemUrl[]}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "query"), data
        )
        return response.data.data
    },

    updateJsonBody: async (collectionId: string, requestId: string, data: Versioned & {raw: string}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "body/json"), data
        )
        return response.data.data
    },

    updateFormDataBody: async (collectionId: string, requestId: string, data: Versioned & {formdata: ItemUrl[]}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "body/formdata"), data
        )
        return response.data.data
    },

    updatePostRequestScript: async (collectionId: string, requestId: string, data: Versioned & {exec: string[]; type?: string}) => {
        const response = await axios.put<Response<RestRequestResponse>>(
            endpoint(collectionId, requestId, "script/post-request"), data
        )
        return response.data.data
    },

    delete: async (collectionId: string, requestId: string, data: Versioned) => {
        const response = await axios.delete<Response<RestRequestResponse>>(
            `/restrequest/${collectionId}/${requestId}`, {data}
        )
        return response.data.data
    },
}
