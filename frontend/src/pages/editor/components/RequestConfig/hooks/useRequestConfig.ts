import {useMutation, useQuery} from "@tanstack/react-query"
import {RequestConfigServices, type RestRequestResponse, type Versioned} from "../services/requestConfig.ts"
import type {ItemUrl, RequestURL} from "@/pages/editor/types/api.ts"

export const useRequestConfig = (collectionId: string, requestId: string) => {
    const enabled = Boolean(collectionId && requestId)
    const requestQuery = useQuery<RestRequestResponse>({
        queryKey: ["request-config", collectionId, requestId],
        queryFn: () => RequestConfigServices.get(collectionId, requestId),
        enabled,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const updateMethodMutation = useMutation({
        mutationFn: (data: Versioned & {method: string}) => RequestConfigServices.updateMethod(collectionId, requestId, data),
    })
    const updateUrlMutation = useMutation({
        mutationFn: (data: Versioned & {url: RequestURL}) => RequestConfigServices.updateUrl(collectionId, requestId, data),
    })
    const updateHeadersMutation = useMutation({
        mutationFn: (data: Versioned & {headers: ItemUrl[]}) => RequestConfigServices.updateHeaders(collectionId, requestId, data),
    })
    const updateQueryMutation = useMutation({
        mutationFn: (data: Versioned & {query: ItemUrl[]}) => RequestConfigServices.updateQuery(collectionId, requestId, data),
    })
    const updateJsonBodyMutation = useMutation({
        mutationFn: (data: Versioned & {raw: string}) => RequestConfigServices.updateJsonBody(collectionId, requestId, data),
    })
    const updateFormDataBodyMutation = useMutation({
        mutationFn: (data: Versioned & {formdata: ItemUrl[]}) => RequestConfigServices.updateFormDataBody(collectionId, requestId, data),
    })
    const updateScriptMutation = useMutation({
        mutationFn: (data: Versioned & {exec: string[]; type?: string}) => RequestConfigServices.updatePostRequestScript(collectionId, requestId, data),
    })
    const deleteMutation = useMutation({
        mutationFn: (data: Versioned) => RequestConfigServices.delete(collectionId, requestId, data),
    })

    return {
        requestQuery,
        updateMethodMutation,
        updateUrlMutation,
        updateHeadersMutation,
        updateQueryMutation,
        updateJsonBodyMutation,
        updateFormDataBodyMutation,
        updateScriptMutation,
        deleteMutation,
    }
}
