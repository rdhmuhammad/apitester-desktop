import type {CollectionAuth, CollectionVar} from "@/pages/editor/types/api.ts";
import axios from "@/config/axios.ts";
import {SOCKET_EVENTS} from "@/config/socket.ts";
import type {Response} from "@/types/response.ts";
import {socketCollection} from "@/pages/editor/services/mainSocket.ts";

export interface Collection {
    id: string
    name: string
    is_selected: boolean
    description: string
    version: string
    path: string
    testsuite_id: string
    automation_id: string
    updated_at: string
    created_at: string
}

export interface RequestTree {
    id: string
    name: string
    item?: RequestTree[]
    isActive: boolean
    method?: string
    category: "REQ" | "FOLD"
}

export interface CreateCollectionVariableRequest {
    baseVersion: string
    key: string
    value?: string
    type?: string
}

export interface CreateCollectionVariableResponse {
    variable: CollectionVar
    version: string
}

export interface UpdateCollectionVariableRequest extends CreateCollectionVariableRequest {
    id: string
}

export interface DeleteCollectionVariableRequest {
    id: string
    baseVersion: string
}

export interface UpdateCollectionPreScriptRequest {
    baseVersion: string
    script: string
    type?: string
}

export interface UpdateCollectionPreScriptResponse {
    script: string
    version: string
}

export interface UpdateCollectionAuthRequest {
    type: string
    bearer?: Array<{
        id?: string
        key: string
        value: string
        type?: string
    }>
}

export interface SelectBaseURLRequest {
    id?: string
    key?: string
    value?: string
}

export interface SelectBaseURLResponse {
    variable: CollectionVar
    version: string
}


export const CollectionServices = {
    listCollections: async (): Promise<Collection[]> => {
        const response = await axios.get<Response<Collection[]>>('/collection/list')
        return response.data.data
    },

    createCollection: async (name: string, path: string): Promise<Collection> => {
        const response = await axios.post<Response<Collection>>('/collection/create', {name, path})
        return response.data.data
    },

    updateCollection: async (id: string, data: { name?: string; path?: string }): Promise<Collection> => {
        const response = await axios.put<Response<Collection>>(`/collection/${id}`, data)
        return response.data.data
    },

    deleteCollection: async (id: string): Promise<string> => {
        const response = await axios.delete<Response<null>>(`/collection/${id}`)
        return response.data.message
    },

    selectCollection: async (id: string): Promise<Collection> => {
        const response = await axios.put<Response<Collection>>(`/collection/select/${id}`)
        return response.data.data
    },

    getActiveCollection: async (): Promise<Collection> => {
        const response = await axios.get<Response<Collection>>('/collection/get-active')
        return response.data.data
    },

    getVariables: async (): Promise<CollectionVar[]> => {
        const response = await axios.get<Response<CollectionVar[]>>('/collection/variables')
        return response.data.data ?? []
    },

    searchVariables: async (key?: string): Promise<string[]> => {
        const response = await axios.get<Response<string[]>>('/collection/variables/search', {
            params: key ? { key } : undefined,
        })
        return response.data.data ?? []
    },

    getPreScript: async (): Promise<string> => {
        const response = await axios.get<Response<string>>('/collection/pre-script')
        return response.data.data ?? ""
    },

    getAuth: async (): Promise<CollectionAuth | null> => {
        const response = await axios.get<Response<CollectionAuth | null>>(`/collection/auth`)
        return response.data.data ?? null
    },

    updateAuth: async (data: UpdateCollectionAuthRequest): Promise<CollectionAuth | null> => {
        const response = await axios.put<Response<CollectionAuth | null>>('/collection/auth', data)
        return response.data.data ?? null
    },

    updatePreScript: async (
        data: UpdateCollectionPreScriptRequest,
    ): Promise<UpdateCollectionPreScriptResponse> => {
        const response = await axios.put<Response<UpdateCollectionPreScriptResponse>>(
            '/collection/pre-script',
            {
                baseVersion: data.baseVersion,
                exec: data.script.split("\n"),
                type: data.type ?? "text/javascript",
            },
        )
        return response.data.data
    },

    createVariable: async (
        data: CreateCollectionVariableRequest,
    ): Promise<CreateCollectionVariableResponse> => {
        const response = await axios.post<Response<CreateCollectionVariableResponse>>(
            '/collection/variable',
            data,
        )
        return response.data.data
    },

    updateVariable: async (
        data: UpdateCollectionVariableRequest,
    ): Promise<CreateCollectionVariableResponse> => {
        const {id, ...payload} = data
        const response = await axios.put<Response<CreateCollectionVariableResponse>>(
            `/collection/variable/${id}`,
            payload,
        )
        return response.data.data
    },

    deleteVariable: async (
        data: DeleteCollectionVariableRequest,
    ): Promise<CreateCollectionVariableResponse> => {
        const response = await axios.delete<Response<CreateCollectionVariableResponse>>(
            `/collection/variable/${data.id}`,
            {data: {baseVersion: data.baseVersion}},
        )
        return response.data.data
    },

    selectBaseUrl: async (
        data: SelectBaseURLRequest,
    ): Promise<SelectBaseURLResponse> => {
        const response = await axios.put<Response<SelectBaseURLResponse>>(
            '/collection/select-base-url',
            data,
        )
        return response.data.data
    },

    getRequestTree: async (): Promise<RequestTree[]> => {
        const response = await axios.get<Response<RequestTree[]>>(`/restrequest/tree`)
        return response.data.data
    },

    updateTree: async (collectionId: string, tree: UpdateTreeItem[]): Promise<UpdateTreeResponse> => {
        const response = await axios.put<Response<UpdateTreeResponse>>(`/restrequest/tree/${collectionId}`, tree)
        return response.data.data
    },

    onNotifyChanges: (callback: (payload: NotifyChangesPayload) => void): (() => void) => {
        const handler = (payload: NotifyChangesPayload) => {
            callback(payload)
        }
        socketCollection.on(SOCKET_EVENTS.collectionRefresh, handler)
        return () => {
            socketCollection.off(SOCKET_EVENTS.collectionRefresh, handler)
        }
    },
}

export interface NotifyChangesPayload {
    refresh: boolean
}

export const onNotifyChanges = CollectionServices.onNotifyChanges
export const onCollectionRefresh = CollectionServices.onNotifyChanges


export interface UpdateTreeItem {
    id: string
    item?: UpdateTreeItem[]
}

export interface UpdateTreeResponse {
    item: unknown[]
    version: string
}

export const toUpdateTreePayload = (nodes: RequestTree[]): UpdateTreeItem[] => {
    return nodes.map((node) => {
        const item: UpdateTreeItem = {
            id: node.id,
        }
        if (node.category === "FOLD") {
            item.item = node.item ? toUpdateTreePayload(node.item) : []
        }
        return item
    })
}
