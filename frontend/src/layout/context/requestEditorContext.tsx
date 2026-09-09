import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts"
import {CollectionServices, type Collection} from "@/layout/services/collection.ts"
import {useRequestConfig} from "@/pages/editor/components/RequestConfig/hooks/useRequestConfig.ts"
import type {RestRequestResponse} from "@/pages/editor/components/RequestConfig/services/requestConfig.ts"
import type {CollectionVar, DocsContent, ItemUrl, RequestBody, RequestURL} from "@/pages/editor/types/api.ts"

type Mutation = () => Promise<RestRequestResponse>

interface RequestEditorContextValue {
    collection: Collection | null
    collectionId: string
    request: RestRequestResponse | null
    activeTabId: string
    variables: CollectionVar[]
    baseUrls: string[]
    loading: boolean
    error: string | null
    updateMethod: (method: string) => void
    updateUrl: (url: RequestURL) => void
    updateHeaders: (headers: ItemUrl[]) => void
    updateQuery: (query: ItemUrl[]) => void
    updateJsonBody: (raw: string) => void
    updateFormDataBody: (formdata: ItemUrl[]) => void
    updateScript: (script: string) => void
    deleteRequest: () => Promise<void>
}

const RequestEditorContext = createContext<RequestEditorContextValue | null>(null)

export const RequestEditorProvider = ({children}: {children: ReactNode}) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const [collection, setCollection] = useState<Collection | null>(null)
    const [collectionData, setCollectionData] = useState<DocsContent | null>(null)
    const [request, setRequest] = useState<RestRequestResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const versionRef = useRef("")
    const collectionIdRef = useRef("")
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
    const queue = useRef(Promise.resolve())

    useEffect(() => {
        let cancelled = false
        void CollectionServices.getActiveCollection().then((active) => {
            if (cancelled) return
            collectionIdRef.current = active.id
            setCollection(active)
            void CollectionServices.getCollection(active.id).then((loaded) => setCollectionData(loaded.content))
        }).catch((reason: unknown) => {
            if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
        })
        return () => { cancelled = true }
    }, [])

    const requestConfig = useRequestConfig(collection?.id ?? "", activeTabId)
    const requestQuery = requestConfig.requestQuery

    useEffect(() => {
        if (!collection?.id || !activeTabId) {
            setRequest(null)
            return
        }
        if (requestQuery.data) {
            versionRef.current = requestQuery.data.version
            setRequest(requestQuery.data)
            setError(null)
        }
    }, [activeTabId, collection?.id, requestQuery.data])

    useEffect(() => {
        if (requestQuery.error) {
            setError(requestQuery.error instanceof Error ? requestQuery.error.message : String(requestQuery.error))
        }
        setLoading(requestQuery.isLoading || requestQuery.isFetching)
    }, [requestQuery.error, requestQuery.isFetching, requestQuery.isLoading])

    const enqueue = useCallback((key: string, mutation: Mutation) => {
        const timer = timers.current.get(key)
        if (timer) clearTimeout(timer)
        timers.current.set(key, setTimeout(() => {
            timers.current.delete(key)
            queue.current = queue.current.then(async () => {
                const next = await mutation()
                versionRef.current = next.version
                setRequest(next)
                setError(null)
            }).catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : String(reason))
            })
        }, 350))
    }, [])

    const updateMethod = useCallback((method: string) => {
        if (!request || !collection?.id) return
        setRequest((current) => current ? {...current, method} : current)
        enqueue("method", () => requestConfig.updateMethodMutation.mutateAsync({
            baseVersion: versionRef.current, method,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateMethodMutation])

    const updateUrl = useCallback((url: RequestURL) => {
        if (!request || !collection?.id) return
        setRequest((current) => current ? {...current, url} : current)
        enqueue("url", () => requestConfig.updateUrlMutation.mutateAsync({
            baseVersion: versionRef.current, url,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateUrlMutation])

    const updateHeaders = useCallback((headers: ItemUrl[]) => {
        if (!request || !collection?.id) return
        setRequest((current) => current ? {...current, headers} : current)
        enqueue("headers", () => requestConfig.updateHeadersMutation.mutateAsync({
            baseVersion: versionRef.current, headers,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateHeadersMutation])

    const updateQuery = useCallback((query: ItemUrl[]) => {
        if (!request || !collection?.id) return
        setRequest((current) => current ? {...current, query, url: {...current.url, query}} : current)
        enqueue("query", () => requestConfig.updateQueryMutation.mutateAsync({
            baseVersion: versionRef.current, query,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateQueryMutation])

    const updateJsonBody = useCallback((raw: string) => {
        if (!request || !collection?.id) return
        const body: RequestBody = {mode: "raw", raw}
        setRequest((current) => current ? {...current, body} : current)
        enqueue("body", () => requestConfig.updateJsonBodyMutation.mutateAsync({
            baseVersion: versionRef.current, raw,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateJsonBodyMutation])

    const updateFormDataBody = useCallback((formdata: ItemUrl[]) => {
        if (!request || !collection?.id) return
        const body: RequestBody = {mode: "formdata", formdata}
        setRequest((current) => current ? {...current, body} : current)
        enqueue("body", () => requestConfig.updateFormDataBodyMutation.mutateAsync({
            baseVersion: versionRef.current, formdata,
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateFormDataBodyMutation])

    const updateScript = useCallback((script: string) => {
        if (!request || !collection?.id) return
        setRequest((current) => current ? {...current, script} : current)
        enqueue("script", () => requestConfig.updateScriptMutation.mutateAsync({
            baseVersion: versionRef.current, exec: script.split("\n"), type: "text/javascript",
        }))
    }, [collection?.id, enqueue, request, requestConfig.updateScriptMutation])

    const deleteRequest = useCallback(async () => {
        if (!request || !collection?.id) return
        await requestConfig.deleteMutation.mutateAsync({baseVersion: versionRef.current})
        setRequest(null)
    }, [collection?.id, request, requestConfig.deleteMutation])

    const value = useMemo<RequestEditorContextValue>(() => ({
        collection,
        collectionId: collection?.id ?? collectionIdRef.current,
        request,
        activeTabId,
        variables: collectionData?.variable ?? [],
        baseUrls: (collectionData?.variable ?? [])
            .filter((item) => item.category === "BASE_URL" || item.key.toLowerCase().includes("base_url"))
            .map((item) => item.value)
            .filter(Boolean),
        loading,
        error,
        updateMethod,
        updateUrl,
        updateHeaders,
        updateQuery,
        updateJsonBody,
        updateFormDataBody,
        updateScript,
        deleteRequest,
    }), [activeTabId, collection, collectionData, deleteRequest, error, loading, request, updateFormDataBody, updateHeaders, updateJsonBody, updateMethod, updateQuery, updateScript, updateUrl])

    return <RequestEditorContext.Provider value={value}>{children}</RequestEditorContext.Provider>
}

// The provider and its hook intentionally share one module so request editor consumers use one context instance.
// eslint-disable-next-line react-refresh/only-export-components
export const useRequestEditor = () => {
    const context = useContext(RequestEditorContext)
    if (!context) throw new Error("useRequestEditor must be used within RequestEditorProvider")
    return context
}
