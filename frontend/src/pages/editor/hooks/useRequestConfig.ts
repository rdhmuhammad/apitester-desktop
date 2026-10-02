import {useQuery, useQueryClient} from "@tanstack/react-query"
import {useCallback, useMemo, useState} from "react"
import {
    requestConfigQueryKey,
    RequestConfigServices,
    type ExampleResponse,
    type RestRequestResponse,
    type Versioned,
} from "../services/requestConfig.ts"
import type {ItemUrl, ReqAuth, Request, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectActiveExampleId} from "@/app/slices/editorTabsSlice.ts"

export const useRequestConfig = (collectionId: string, requestId: string) => {
    const queryClient = useQueryClient()
    const enabled = Boolean(collectionId && requestId)
    const queryKey = requestConfigQueryKey(collectionId, requestId)
    const [mutationError, setMutationError] = useState<string | null>(null)
    const activeExampleId = useAppSelector(selectActiveExampleId)

    const requestQuery = useQuery<RestRequestResponse>({
        queryKey,
        queryFn: () => RequestConfigServices.get(collectionId, requestId),
        enabled,    
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const rawRequest = requestQuery.data ?? null

    const activeExample = useMemo(() => {
        if (!rawRequest?.responses || !activeExampleId) return null
        return rawRequest.responses.find(r => r.id === activeExampleId) ?? null
    }, [rawRequest?.responses, activeExampleId])

    const request = useMemo(() => {
        if (!rawRequest) return null
        if (!activeExample) return rawRequest
        const orig = activeExample.originalRequest
        return {
            ...rawRequest,
            name: activeExample.name || rawRequest.name,
            method: orig?.method ?? rawRequest.method,
            url: orig?.url ?? rawRequest.url,
            headers: (orig?.header as ItemUrl[] | undefined) ?? rawRequest.headers,
            query: orig?.url?.query ?? rawRequest.query,
            body: orig?.body ?? rawRequest.body,
            auth: orig?.auth ?? rawRequest.auth,
        }
    }, [rawRequest, activeExample])

    const saveResponse = useCallback(
        async (payload: {
            id?: string
            action?: string
            name?: string
            status?: string
            code?: number
            body?: string
            header?: ItemUrl[] | Array<{key: string; value: string}>
            cookie?: Array<{key: string; value: string}>
            originalRequest?: Request
            response?: ExampleResponse
            responses?: ExampleResponse[]
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

    const update = useCallback(async <T extends keyof RestRequestResponse>(
        field: string,
        value: RestRequestResponse[T],
        mutation: (data: Versioned) => Promise<RestRequestResponse>,
        extra?: (request: RestRequestResponse) => Partial<RestRequestResponse>,
    ): Promise<RestRequestResponse | undefined> => {
        const current = queryClient.getQueryData<RestRequestResponse>(queryKey)
        if (!current || !enabled) return Promise.resolve(undefined)
        queryClient.setQueryData(queryKey, {...current, [field]: value, ...extra?.(current)})
        try {
            const next = await mutation({baseVersion: current.version, [field]: value} as Versioned)
            console.log(next)
            queryClient.setQueryData(queryKey, next)
            setMutationError(null)
            return next
        } catch (reason) {
            console.log(reason)
            setMutationError(reason instanceof Error ? reason.message : String(reason))
            return undefined
        }
    }, [enabled, queryClient, queryKey])

    const getBaseOrigRequest = useCallback((): Request => {
        const orig = activeExample?.originalRequest
        return {
            funIden: "",
            method: orig?.method ?? rawRequest?.method ?? "GET",
            url: orig?.url ?? rawRequest?.url ?? {raw: "", host: [], path: [], query: []},
            header: (orig?.header as ItemUrl[] | undefined) ?? rawRequest?.headers ?? [],
            body: orig?.body ?? rawRequest?.body,
            auth: orig?.auth ?? rawRequest?.auth,
            description: "",
        }
    }, [activeExample, rawRequest])

    // Mutators automatically direct to activeExample.originalRequest if example is selected
    const updateMethod = useCallback((method: string) => {
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, method}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("method", method, (data) =>
            RequestConfigServices.updateMethod(collectionId, requestId, {
                ...data,
                method
            }))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateName = useCallback((name: string) => {
        if (activeExample?.id) {
            return saveResponse({
                id: activeExample.id,
                name,
                response: {...activeExample, name},
            })
        }
        return update("name", name, (data) =>
            RequestConfigServices.updateName(collectionId, requestId, {
                ...data,
                name
            }))
    }, [activeExample, collectionId, requestId, saveResponse, update])

    const updateUrl = useCallback((url: RequestURL) => {
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, url}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("url", url, (data) =>
            RequestConfigServices.updateUrl(collectionId, requestId, {
                ...data,
                url
            }), (current) => ({query: url.query ?? current.query}))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateHeaders = useCallback((headers: ItemUrl[]) => {
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, header: headers}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("headers", headers, (data) =>
            RequestConfigServices.updateHeaders(collectionId, requestId, {
                ...data,
                headers
            }))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateAuth = useCallback((auth: ReqAuth) => {
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, auth}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("auth", auth, (data) =>
            RequestConfigServices.updateAuth(collectionId, requestId, {
                ...data,
                type: auth.type,
                bearer: auth.bearer,
                authSource: auth.authSource ?? "none",
            }))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateQuery = useCallback((query: ItemUrl[]) => {
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedUrl = {...(orig.url ?? {raw: "", host: [], path: []}), query}
            const updatedOrig: Request = {...orig, url: updatedUrl}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("query", query, (data) =>
            RequestConfigServices.updateQuery(collectionId, requestId, {
                ...data,
                query
            }), (current) => ({url: {...current.url, query}}))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateJsonBody = useCallback((raw: string) => {
        const body: RequestBody = {mode: "raw", raw}
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, body}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("body", body, (data) =>
            RequestConfigServices.updateJsonBody(collectionId, requestId, {...data, raw}))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

    const updateFormDataBody = useCallback((formdata: ItemUrl[]) => {
        const body: RequestBody = {mode: "formdata", formdata}
        if (activeExample?.id) {
            const orig = getBaseOrigRequest()
            const updatedOrig: Request = {...orig, body}
            return saveResponse({
                id: activeExample.id,
                originalRequest: updatedOrig,
                response: {...activeExample, originalRequest: updatedOrig},
            })
        }
        return update("body", body, (data) =>
            RequestConfigServices.updateFormDataBody(collectionId, requestId, {
                ...data,
                formdata
            }))
    }, [activeExample, collectionId, requestId, saveResponse, update, getBaseOrigRequest])

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
    }, [collectionId, enabled, queryClient, queryKey, requestId])

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

    const addExampleResponse = useCallback(async (name?: string) => {
        const current = queryClient.getQueryData<RestRequestResponse>(queryKey) ?? rawRequest
        const newId = crypto.randomUUID()
        const origRequest: Request | undefined = current ? {
            funIden: "",
            method: current.method,
            url: current.url,
            header: current.headers,
            body: current.body,
            auth: current.auth,
            description: "",
        } : undefined
        const result = await saveResponse({
            id: newId,
            name: name || "New Example",
            status: "OK",
            code: 200,
            body: "{\n  \"message\": \"success\"\n}",
            header: [{id: crypto.randomUUID(), key: "Content-Type", value: "application/json", disabled: false}],
            originalRequest: origRequest,
        })
        return {id: newId, result}
    }, [queryClient, queryKey, rawRequest, saveResponse])

    const deleteExampleResponse = useCallback(async (exampleId: string) => {
        return saveResponse({
            id: exampleId,
            action: "delete",
        })
    }, [saveResponse])

    const updateExampleResponse = useCallback(async (exampleId: string, updates: Partial<ExampleResponse>) => {
        const current = queryClient.getQueryData<RestRequestResponse>(queryKey) ?? rawRequest
        const ex = current?.responses?.find(r => r.id === exampleId)
        const next = ex ? {...ex, ...updates} : updates
        return saveResponse({
            id: exampleId,
            ...updates,
            response: next as ExampleResponse,
        })
    }, [queryClient, queryKey, rawRequest, saveResponse])

    return {
        rawRequest,
        request,
        activeExample,
        activeExampleId,
        isExampleMode: Boolean(activeExample),
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
        addExampleResponse,
        deleteExampleResponse,
        updateExampleResponse,
        deleteRequest,
    }
}

