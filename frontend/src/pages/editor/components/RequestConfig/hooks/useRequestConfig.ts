import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useCallback, useState} from "react"
import {
    requestConfigQueryKey,
    RequestConfigServices,
    type RestRequestResponse,
    type Versioned,
} from "../services/requestConfig.ts"
import type {ItemUrl, ReqAuth, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"

export const useRequestConfig = (collectionId: string, requestId: string) => {
    const queryClient = useQueryClient()
    const enabled = Boolean(collectionId && requestId)
    const queryKey = requestConfigQueryKey(collectionId, requestId)
    const [mutationError, setMutationError] = useState<string | null>(null)

    const requestQuery = useQuery<RestRequestResponse>({
        queryKey,
        queryFn: () => RequestConfigServices.get(collectionId, requestId),
        enabled,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const update = useCallback(<T extends keyof RestRequestResponse>(
        field: string,
        value: RestRequestResponse[T],
        mutation: (data: Versioned) => Promise<RestRequestResponse>,
        extra?: (request: RestRequestResponse) => Partial<RestRequestResponse>,
    ): Promise<RestRequestResponse | undefined> => {
        const current = queryClient.getQueryData<RestRequestResponse>(queryKey)
        console.log(current)
        if (!current || !enabled) return Promise.resolve(undefined)
        queryClient.setQueryData(queryKey, {...current, [field]: value, ...extra?.(current)})
        return mutation({baseVersion: current.version, [field]: value} as Versioned)
            .then(next => {
                console.log(next)
                queryClient.setQueryData(queryKey, next)
                setMutationError(null)
                return next
            })
            .catch((reason: unknown) => {
                console.log(reason)
                setMutationError(reason instanceof Error ? reason.message : String(reason))
                return undefined
            })
    }, [enabled, queryClient, queryKey])

    // Place wiring endpoint for request mutation here
    const updateMethod = useCallback((method: string) =>
            update("method", method, (data) =>
                RequestConfigServices.updateMethod(collectionId, requestId, {
                    ...data,
                    method
                })),
        [collectionId, requestId, update])
    const updateName = useCallback((name: string) =>
            update("name", name, (data) =>
                RequestConfigServices.updateName(collectionId, requestId, {
                    ...data,
                    name
                })),
        [collectionId, requestId, update])
    const updateUrl = useCallback((url: RequestURL) =>
            update("url", url, (data) =>
                RequestConfigServices.updateUrl(collectionId, requestId, {
                    ...data,
                    url
                })),
        [collectionId, requestId, update])
    const updateHeaders = useCallback((headers: ItemUrl[]) =>
            update("headers", headers, (data) =>
                RequestConfigServices.updateHeaders(collectionId, requestId, {
                    ...data,
                    headers
                })),
        [collectionId, requestId, update])
    const updateAuth = useCallback((auth: ReqAuth) =>
            update("auth", auth, (data) =>
                RequestConfigServices.updateAuth(collectionId, requestId, {
                    ...data,
                    type: auth.type,
                    bearer: auth.bearer,
                    authSource: auth.authSource ?? "none",
                })),
        [collectionId, requestId, update])
    const updateQuery = useCallback((query: ItemUrl[]) =>
            update("query", query, (data) =>
                RequestConfigServices.updateQuery(collectionId, requestId, {
                    ...data,
                    query
                }), (current) => ({url: {...current.url, query}})),
        [collectionId, requestId, update])
    const updateJsonBody = useCallback((raw: string) => {
            const body: RequestBody = {mode: "raw", raw}
            update("body", body, (data) =>
                RequestConfigServices.updateJsonBody(collectionId, requestId, {...data, raw}))
        },
        [collectionId, requestId, update])
    const updateFormDataBody = useCallback((formdata: ItemUrl[]) => {
            const body: RequestBody = {mode: "formdata", formdata}
            update("body", body, (data) =>
                RequestConfigServices.updateFormDataBody(collectionId, requestId, {
                    ...data,
                    formdata
                }))
        },
        [collectionId, requestId, update])
    const updateScript = useCallback((script: string) =>
            update("script", script, (data) =>
                RequestConfigServices.updatePostRequestScript(collectionId, requestId, {
                    ...data,
                    exec: script.split("\n"),
                    type: "text/javascript"
                })),
        [collectionId, requestId, update])
    const deleteRequest = useCallback(async () => {
            const current = queryClient.getQueryData<RestRequestResponse>(queryKey)
            if (!current || !enabled) return

            await RequestConfigServices.delete(collectionId, requestId, {baseVersion: current.version})

            queryClient.removeQueries({queryKey})
            await queryClient.invalidateQueries({queryKey: ["collection", "tree", collectionId]})
        },
        [collectionId, enabled, queryClient, queryKey, requestId])

    const saveResponse = useCallback(
        async (payload: {
            name: string
            status?: string
            code?: number
            body?: string
            header?: Array<{key: string; value: string}>
        }) => {
            const current = queryClient.getQueryData<RestRequestResponse>(queryKey)
            const baseVersion = current?.version ?? ""
            const result = await RequestConfigServices.saveResponse(collectionId, requestId, {
                baseVersion,
                ...payload,
            })
            queryClient.setQueryData(queryKey, result)
            setMutationError(null)
            await queryClient.invalidateQueries({queryKey: ["collection", "tree", collectionId]})
            return result
        },
        [collectionId, queryClient, queryKey, requestId]
    )

    const saveScript = useCallback(
        (script: string) =>
            update("script", script, (data) =>
                RequestConfigServices.savePostRequestScript(collectionId, requestId, {
                    ...data,
                    exec: script.split("\n"),
                    script,
                    type: "text/javascript",
                })),
        [collectionId, requestId, update]
    )


    return {
        request: requestQuery.data ?? null,
        loading: requestQuery.isLoading || requestQuery.isFetching,
        error: requestQuery.error ? (requestQuery.error.message) : mutationError,
        requestQuery,
        updateMethod,
        updateName,
        updateUrl,
        updateHeaders,
        updateAuth,
        updateQuery,
        updateJsonBody,
        updateFormDataBody,
        updateScript,
        saveScript,
        saveResponse,
        deleteRequest,
    }
}
