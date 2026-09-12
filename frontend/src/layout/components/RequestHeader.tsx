import {forwardRef, useEffect, useImperativeHandle, useState} from "react";
import {cn, getContentType} from "@/lib/utils.ts";
import {isTestTab} from "@/lib/tabUtils.ts";

import {Input} from "@/components/ui/input.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {LoaderCircle, Plus, Send, Trash2} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import {removeEditorTab, selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import {setResponse} from "@/app/slices/restApiSlice.ts";
import type {HeaderAction} from "@/layout/types/headerContext.ts";
import {buildRawRequest, parseBlobResponse, type ISendRequest, useSendRequest as sendRequest} from "@/layout/hooks/useSendRequest.ts";
import {runScript} from "@/layout/hooks/useScriptRunner.ts";
import CustomToast from "@/components/common/toast";
import type {ColtReqMethod} from "@/pages/editor/types/editor.ts";
import type {CollectionVar, ItemUrl} from "@/pages/editor/types/api.ts";
import type { RequestHeaderHandle } from "../types/HeaderSync";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useRequestConfig} from "@/pages/editor/components/RequestConfig/hooks/useRequestConfig.ts";


const RequestHeader = forwardRef<RequestHeaderHandle, { onSend: HeaderAction }>(({onSend}, ref) => {
    const dispatch = useAppDispatch()
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const {activeCollection, variables} = useCollection()
    const baseUrls = variables
        .filter((item) => item.category === "BASE_URL" || item.key.toLowerCase().includes("base_url"))
        .map((item) => item.value)
        .filter(Boolean)
    const {request, updateMethod, updateUrl, updateQuery, deleteRequest} =
        useRequestConfig(activeCollection?.id ?? "", activeTabId)
    const currRequest = request ? {id: request.id, name: request.name, request: {method: request.method, header: request.headers, url: request.url, body: request.body}} : null
    const baseUrlOptions = baseUrls
    const scriptValue = request?.script ?? ""
    const collectionData = activeCollection
    const envVars: Record<string, string> = {}
    const [runtimeVariables, setRuntimeVariables] = useState<CollectionVar[]>(variables)
    useEffect(() => setRuntimeVariables(variables), [variables])

    useEffect(() => {
        const raw = currRequest?.request?.url?.raw ?? ''
        const queryIndex = raw.indexOf('?')
        setEndpoint(queryIndex >= 0 ? raw.slice(0, queryIndex) : raw)
    }, [currRequest?.request?.url?.raw]);

    useEffect(() => {
        setRequestMethod((currRequest?.request?.method ?? 'GET') as ColtReqMethod)
    }, [currRequest?.request?.method]);

    useEffect(() => {
        if (baseUrlOptions.length === 0) {
            setSelectedBaseUrl("")
            return
        }

        setSelectedBaseUrl((currentValue) => {
            if (currentValue && baseUrlOptions.includes(currentValue)) {
                return currentValue
            }

            return baseUrlOptions[0] ?? ""
        })
    }, [baseUrlOptions]);

    const requestMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
    const methodColorClass: Record<ColtReqMethod, string> = {
        GET: "bg-emerald-600",
        POST: "bg-amber-600",
        PUT: "bg-blue-600",
        PATCH: "bg-violet-600",
        DELETE: "bg-red-600"
    };
    const [requestMethod, setRequestMethod] = useState<ColtReqMethod>("GET");
    const [selectedBaseUrl, setSelectedBaseUrl] = useState("");
    const [endpoint, setEndpoint] = useState(currRequest?.request?.url.raw ?? "");
    const [newBaseUrl, setNewBaseUrl] = useState("");
    const [isSending, setIsSending] = useState(false);

    const resolveVariableValue = (value: string): string => {
        return value.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
            const k = key.trim()
            const matchedVar = runtimeVariables.find((item) => item.key === k)
            return envVars[k] ?? matchedVar?.value ?? `{{${key}}}`
        })
    }

    const parseQueryParamsFromUrl = (url: string): { cleanUrl: string; params: ItemUrl[] } => {
        const queryIndex = url.indexOf('?')
        if (queryIndex === -1) return {cleanUrl: url, params: []}

        const beforeQuery = url.slice(0, queryIndex)
        const afterQuery = url.slice(queryIndex + 1)
        const hashIndex = afterQuery.indexOf('#')
        const queryString = hashIndex >= 0 ? afterQuery.slice(0, hashIndex) : afterQuery
        const hash = hashIndex >= 0 ? afterQuery.slice(hashIndex) : ''

        const params: ItemUrl[] = []
        const searchParams = new URLSearchParams(queryString)
        searchParams.forEach((value, key) => {
            params.push({id: crypto.randomUUID(), key, value, disabled: false})
        })

        return {cleanUrl: beforeQuery + hash, params}
    }

    const formatEndpoint = (endpoint: string): string => {
        const sanitizedEndpoint = endpoint.replace(/\{\{[^{}]+\}\}/g, "").trim()

        if (/^https?:\/\//i.test(sanitizedEndpoint)) {
            try {
                const parsedUrl = new URL(sanitizedEndpoint)
                return `${parsedUrl.pathname}${parsedUrl.hash}`
            } catch {
                return sanitizedEndpoint.split('?')[0]
            }
        }

        return sanitizedEndpoint.split('?')[0]
    }

    const handleSendRequest = () => {
        if (!currRequest?.id || isSending) return
        if (onSend) onSend()
        setIsSending(true)
        const sendRequestConfig: ISendRequest = {
            baseUrl: selectedBaseUrl,
            endpoint: formatEndpoint(endpoint),
            method: requestMethod,
            headers: (currRequest?.request?.header ?? [])
                .filter(h => !h.disabled)
                .map((header) => ({
                    ...header,
                    value: resolveVariableValue(header.value ?? "")
                })),
            requestParams: (currRequest?.request?.url.query ?? [])
                .filter(q => !q.disabled),
            contentType: getContentType(currRequest),
            raw: currRequest?.request?.body?.raw,
            formData: currRequest?.request?.body?.formdata
        }
        sendRequest(sendRequestConfig).then(async (response) => {
            if (!response) return
            dispatch(setResponse({requestId: currRequest.id, response}))
            if (!scriptValue?.trim()) return

            try {
                const varsObj: Record<string, string> = {}
                runtimeVariables.forEach(v => { varsObj[v.key] = v.value })

                const {result, mutations, logs} = await runScript({
                    script: scriptValue,
                    response,
                    variables: varsObj,
                })

                for (const [key, value] of Object.entries(mutations)) {
                    const existing = runtimeVariables.find(v => v.key === key)
                    if (value === null) {
                        if (existing) setRuntimeVariables((current) => current.filter((item) => item.id !== existing.id))
                    } else if (existing) {
                        setRuntimeVariables((current) => current.map((item) => item.id === existing.id ? {...item, value} : item))
                    } else {
                        setRuntimeVariables((current) => [...current, {id: crypto.randomUUID(), key, value, type: "string", category: ""}])
                    }
                }
                void result
                void logs
            } catch (err: unknown) {
                CustomToast.error(`Script error: ${err instanceof Error ? err.message : String(err)}`)
            }
        }).catch(async (error: {
            message?: string
            duration?: number
            response?: {
                data?: Blob
                headers?: Record<string, string | undefined>
                status?: number
                statusText?: string
            }
        }) => {
            const blob = error.response?.data
            const contentType = error.response?.headers?.["content-type"] ?? ""
            const {data, size, isBinary} = blob
                ? await parseBlobResponse(blob, contentType)
                : {data: null, size: "0", isBinary: false}
            dispatch(setResponse({
                requestId: currRequest.id,
                response: {
                    rawRequest: buildRawRequest(sendRequestConfig),
                    protocol: "HTTP/1.1",
                    responseTime: error.duration ?? 0,
                    responseSize: size,
                    statusCode: error.response?.status ?? 0,
                    statusText: error.response?.statusText ?? error.message ?? "UNKNOWN",
                    data,
                    contentType,
                    isBinary,
                },
            }))
            CustomToast.error(error.message ?? "Request failed");
        }).finally(() => setIsSending(false))
    };

    useImperativeHandle(ref, () => ({
        sendRequest: handleSendRequest,
        isSending,
    }))

    const handleAddBaseUrl = () => {
        const trimmed = newBaseUrl.trim()
        if (!trimmed) return
        const newVar: CollectionVar = {
            id: crypto.randomUUID(),
            key: 'base_url',
            value: trimmed,
            category: 'BASE_URL',
            type: 'string'
        }
        void newVar
        setSelectedBaseUrl(trimmed)
        setNewBaseUrl('')
    }

    const handleDeleteRequest = async () => {
        if (!request || !activeTabId) return
        if (!window.confirm(`Delete ${request.name}?`)) return
        try {
            await deleteRequest()
            dispatch(removeEditorTab(activeTabId))
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : String(error))
        }
    }

    return (
        <div className="basis-3/4 flex items-center h-full gap-3">
            <Select
                value={requestMethod}
                disabled={!collectionData}
                         onValueChange={(value) => { const method = value as ColtReqMethod; setRequestMethod(method); updateMethod(method) }}
            >
                <SelectTrigger
                    className={cn("min-w-[110px] font-semibold text-white", methodColorClass[requestMethod])}>
                    <SelectValue placeholder="Method"/>
                </SelectTrigger>
                <SelectContent>
                    {requestMethods.map((method) => (
                        <SelectItem key={method} value={method} className={cn("font-semibold", "text-black")}>
                            {method}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex w-full items-center rounded-md border border-input bg-transparent shadow-xs">
                {(baseUrlOptions.length > 0) ? (
                    <Select
                        value={selectedBaseUrl}
                        disabled={!collectionData}
                        onValueChange={setSelectedBaseUrl}
                    >
                        <SelectTrigger
                            className="w-[240px] rounded-none border-0 border-r border-input shadow-none focus-visible:ring-0">
                            <SelectValue placeholder="Select Base URL"/>
                        </SelectTrigger>
                        <SelectContent>
                            {baseUrlOptions.map((baseUrl) => (
                                <SelectItem key={baseUrl} value={baseUrl}>
                                    {baseUrl}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex w-full items-center">
                        <Input
                            value={newBaseUrl}
                            disabled={!collectionData}
                            onChange={(e) => setNewBaseUrl(e.target.value)}
                            className="border-0 rounded-none shadow-none focus-visible:ring-0"
                            placeholder="https://api.example.com"
                            aria-label="Add base URL"
                        />
             <Button
                            variant="ghost"
                            size="sm"
                            disabled={!collectionData || !newBaseUrl.trim()}
                            className="h-full rounded-none border-l border-input px-2 shrink-0"
                            onClick={handleAddBaseUrl}
                        >
                            <Plus className="h-4 w-4"/>
                        </Button>
                    </div>
                )}
                <Input
                    value={formatEndpoint(endpoint)}
                    disabled={!collectionData}
                    onChange={(event) => {
                        const value = event.target.value
                        const {cleanUrl, params} = parseQueryParamsFromUrl(value)
                        setEndpoint(cleanUrl)
                        const nextUrl = {...(request?.url ?? {raw: "", host: [], path: [], query: []}), raw: cleanUrl}
                        updateUrl(nextUrl)
                        const currentParams = currRequest?.request?.url?.query ?? []
                        const nextParams = params.map((param) => currentParams.find((item) => item.key === param.key) ? {...currentParams.find((item) => item.key === param.key)!, value: param.value} : param)
                        updateQuery(nextParams)
                    }}
                    className="border-0 rounded-none shadow-none focus-visible:ring-0"
                    placeholder="/v1/users"
                    aria-label="Endpoint path"
                />
            </div>
            <Button
                disabled={!collectionData || isSending || isTestTab(activeTabId)}
                onClick={handleSendRequest}
                className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
            >
                {isSending ? (
                    <LoaderCircle className="h-4 w-4 mr-2 animate-spin"/>
                ) : (
                    <Send className="h-4 w-4 mr-2"/>
                )}
                Send Request
             </Button>
             <Button
                 type="button"
                 variant="outline"
                 disabled={!collectionData || isSending || !request}
                 onClick={handleDeleteRequest}
                 className="text-red-600 hover:bg-red-50 hover:text-red-700"
                 aria-label="Delete request"
             >
                 <Trash2 className="h-4 w-4" />
             </Button>
        </div>
    )
})

RequestHeader.displayName = "RequestHeader"

export default RequestHeader
