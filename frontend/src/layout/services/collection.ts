import type {CollectionVar, GetCollectionResponse} from "@/pages/editor/types/api.ts";
import axios from "@/config/axios.ts";
import type {Response} from "@/types/response.ts";

export interface Collection {
    id: string
    name: string
    is_selected: boolean
    description: string,
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

export const CollectionServices = {
    getCollection: async (id: string): Promise<GetCollectionResponse> => {
        const response = await axios.get<Response<GetCollectionResponse>>(`/collection/read/${id}`)
        return response.data.data
    },

    uploadCollection: async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append("file", file)

        const response = await axios.post<Response<null>>('/collection/upload', formData, {
            headers: {"Content-Type": "multipart/form-data"}
        })

        return response.data.message
    },

    listCollections: async (): Promise<Collection[]> => {
        const response = await axios.get<Response<Collection[]>>('/collection/list')
        return response.data.data
    },

    createCollection: async (name: string, path: string): Promise<Collection> => {
        const response = await axios.post<Response<Collection>>('/collection/create', {name, path})
        return response.data.data
    },

    updateCollection: async (id: string, data: {name?: string; path?: string}): Promise<Collection> => {
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

    getPreScript: async (): Promise<string> => {
        const response = await axios.get<Response<string>>('/collection/pre-script')
        return response.data.data ?? ""
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

    getRequestTree: async (collectionId: string): Promise<RequestTree[]> => {
        const response = await axios.get<Response<RequestTree[]>>(`/restrequest/tree/${collectionId}`)
        return response.data.data
    },

    writeCollection: async (id: string, content: string): Promise<string> => {
        const response = await axios.put<Response<null>>(`/collection/write/${id}`, content, {
            headers: {"Content-Type": "application/json"}
        })
        return response.data.message
    },
}
