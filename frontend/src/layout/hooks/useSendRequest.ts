import {useAppDispatch} from "@/app/store/hooks.ts";
import {setResponse, setScriptResult} from "@/app/slices/restApiSlice.ts";
import {runPreRequestScript, runScript} from "@/layout/hooks/useScriptRunner.ts";
import type {ItemUrl} from "@/pages/editor/types/api.ts";
import type {RestRequestResponse} from "@/pages/editor/services/requestConfig.ts";
import type {ScriptResultDto} from "@/app/slices/index.ts";
import axios from "@/config/axios.ts";
import type {ScriptLog, SendResponse} from "@/types/response.ts";
import {type AxiosResponse, isCancel} from "axios";
import {getFile} from "@/lib/fileStore.ts";
import CustomToast from "@/components/common/toast";
import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import {requestConfigQueryKey} from "@/pages/editor/services/requestConfig.ts";
import {useQueryClient} from "@tanstack/react-query";
import {useEnvResolve, resolveVars, buildEnvVarsRecord} from "@/layout/hooks/useEnvResolve.ts";

export interface ISendRequest {
    baseUrl: string
    endpoint: string
    method: string
    headers: ItemUrl[]
    requestParams: ItemUrl[]
    contentType: string
    raw?: string
    formData?: ItemUrl[]
    signal?: AbortSignal
}

type AxiosResponseWithDuration<T = unknown> = AxiosResponse<T> & {
    duration?: number
}

const formData = (request: ItemUrl[]): FormData => {
    const dt = new FormData()
    for (const item of request) {
        if (item.type === "file" && item.id) {
            const file = getFile(item.id)
            if (file) {
                dt.append(item.key, file)
                continue
            }
        }
        dt.append(item.key, item.value ?? "")
    }
    return dt
}

export const buildRawRequest = (request: ISendRequest): string => {
    const allHeaders = [
        {key: 'Content-Type', value: request.contentType},
        ...request.headers,
    ].filter(h => h.value)

    const headerLines = allHeaders
        .map(h => `${h.key}: ${h.value}`)
        .join('\n')

    const queryString = request.requestParams.length > 0
        ? '?' + request.requestParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value ?? '')}`).join('&')
        : ''

    let host = ''
    try {
        host = new URL(request.baseUrl).host
    } catch {
        host = request.baseUrl
    }

    let bodyStr = ''
    if (request.contentType === 'application/json') {
        bodyStr = request.raw ?? ''
    } else if (request.contentType === 'multipart/form-data' && request.formData) {
        bodyStr = request.formData
            .map(f => `${f.key}: ${f.value}`)
            .join('\n')
    }

    const lines = [
        `${request.method} ${request.baseUrl}${request.endpoint}${queryString} HTTP/1.1`,
        `Host: ${host}`,
        headerLines,
        '',
        bodyStr,
    ]

    return lines.join('\n')
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })

export const parseBlobResponse = async (blob: Blob, contentType: string): Promise<{
    data: unknown
    size: string
    isBinary: boolean
}> => {
    const ct = (contentType ?? "").toLowerCase()
    const isJson = ct.includes("application/json") || ct.includes("text/")
    const isBinary = !!ct && !isJson

    if (isBinary) {
        const dataUrl = await blobToDataUrl(blob)
        return {data: dataUrl, size: (blob.size / 1024).toFixed(2), isBinary}
    }

    const text = await blob.text()
    try {
        return {data: JSON.parse(text), size: (new Blob([text]).size / 1024).toFixed(2), isBinary}
    } catch {
        return {data: text, size: (new Blob([text]).size / 1024).toFixed(2), isBinary}
    }
}

export const sendApiRequest = async (request: ISendRequest): Promise<SendResponse | null> => {
    const isFormData = request.contentType === "multipart/form-data"
    const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI)
    // requestParams is the single source of query params; url.raw may already carry "?a=b",
    // which would otherwise be sent twice (a=b&a=b) and parsed as an array by the server.
    const endpoint = request.endpoint.split(/[?#]/)[0]
    let params: Record<string, string> | undefined = request.requestParams.reduce((acc, it) => {
        acc[it.key] = it.value ?? ""
        return acc
    }, {} as Record<string, string>)
    let baseURL = request.baseUrl
    let url = endpoint

    // In browser dev mode outside Electron, route external requests through Vite CORS bypass proxy
    if (!isElectron && /^https?:\/\//i.test(request.baseUrl) && import.meta.env.DEV) {
        const cleanBase = request.baseUrl.replace(/\/+$/, "")
        const cleanEndpoint = endpoint.replace(/^\/+/, "")
        const qs = new URLSearchParams(params).toString()
        const fullTarget = (cleanEndpoint ? `${cleanBase}/${cleanEndpoint}` : cleanBase) + (qs ? `?${qs}` : "")
        baseURL = ""
        url = `/__cors_proxy__?target=${encodeURIComponent(fullTarget)}`
        params = undefined // proxy only reads `target`
    }

    try {
        const response = await axios.request({
            method: request.method,
            headers: {
                ...(isFormData ? {} : {"Content-Type": request.contentType}),
                ...request.headers.reduce((acc, it) => {
                    acc[it.key] = it.value ?? ""
                    return acc
                }, {} as Record<string, string>)
            },
            baseURL,
            url,
            params,
            data: request.contentType === "application/json"
                ? (request.raw ?? "{}") :
                formData(request.formData ?? []),
            responseType: "blob",
            validateStatus: () => true, // Do not throw on non-2xx status codes
            signal: request.signal,
        }) as AxiosResponseWithDuration<Blob>

        const contentType = (response.headers["content-type"] as string)?.toLowerCase() ?? ""
        const {data, size: responseSize, isBinary} = await parseBlobResponse(response.data as Blob, contentType)

        const responseHeaders: Record<string, string> = {}
        if (response.headers) {
            Object.entries(response.headers as Record<string, unknown>).forEach(([k, v]) => {
                if (typeof v === 'string') responseHeaders[k] = v
            })
        }

        return {
            rawRequest: buildRawRequest(request),
            protocol: "HTTP/1.1",
            responseTime: response.duration ?? 0,
            responseSize,
            statusCode: response?.status ?? 0,
            statusText: response?.statusText ?? 'UNKNOWN',
            data,
            contentType,
            isBinary,
            headers: responseHeaders,
        }
    } catch (err: unknown) {
        if (isCancel(err)) {
            CustomToast.error("Request canceled");
            return {
                rawRequest: buildRawRequest(request),
                protocol: "HTTP/1.1",
                responseTime: 0,
                responseSize: "0",
                statusCode: 0,
                statusText: "Canceled",
                data: null,
                contentType: "",
                isBinary: false,
                headers: {},
            }
        }

        const error = err as {
            message?: string
            duration?: number
            response?: {
                data?: Blob
                headers?: Record<string, string | undefined>
                status?: number
                statusText?: string
            }
        };
        // Handle network errors (e.g. ERR_CONNECTION_REFUSED, CORS)
        const blob = error?.response?.data
        const contentType = error?.response?.headers?.["content-type"] ?? ""
        const {data, size, isBinary} = blob
            ? await parseBlobResponse(blob, contentType)
            : {data: null, size: "0", isBinary: false}

        CustomToast.error(error.message ?? "Request failed");
        return {
            rawRequest: buildRawRequest(request),
            protocol: "HTTP/1.1",
            responseTime: error.duration ?? 0,
            responseSize: size,
            statusCode: error.response?.status ?? 0,
            statusText: error.response?.statusText ?? error.message ?? "UNKNOWN",
            data,
            contentType,
            isBinary,
            headers: {},
        }
    }
}

const formatVariableValue = (val: unknown): string | null => {
    if (val === null || val === undefined) return null
    if (typeof val === "string") return val
    if (typeof val === "object") {
        if (val && typeof (val as any).toString === "function" && (val as any).toString !== Object.prototype.toString) {
            return (val as any).toString()
        }
        return JSON.stringify(val)
    }
    return String(val)
}

const applyMutatedRequestToSendConfig = (
    baseConfig: ISendRequest,
    mutatedRequest: RestRequestResponse,
    vars: Record<string, string>,
    initialUrl?: string
): ISendRequest => {
    const method = String(mutatedRequest.method || baseConfig.method).toUpperCase()

    // 1. Headers normalization
    const rawHeaders: ItemUrl[] = []
    if (Array.isArray(mutatedRequest.headers)) {
        for (const item of mutatedRequest.headers) {
            if (!item) continue
            if (typeof item === "object") {
                const k = (item as any).key ?? (item as any).name ?? ""
                const v = (item as any).value !== undefined ? (item as any).value : ""
                rawHeaders.push({
                    id: (item as any).id || crypto.randomUUID(),
                    key: String(k),
                    value: resolveVars(v, vars),
                    disabled: Boolean((item as any).disabled),
                })
            }
        }
        // Also check if non-numeric properties were set on the array itself: e.g. headers["X-Signature"] = "..."
        for (const [propKey, propVal] of Object.entries(mutatedRequest.headers)) {
            if (/^\d+$/.test(propKey) || typeof propVal === "function") continue
            rawHeaders.push({
                id: crypto.randomUUID(),
                key: propKey,
                value: resolveVars(propVal, vars),
                disabled: false,
            })
        }
    } else if (mutatedRequest.headers && typeof mutatedRequest.headers === "object") {
        for (const [key, value] of Object.entries(mutatedRequest.headers)) {
            if (typeof value === "function") continue
            rawHeaders.push({
                id: crypto.randomUUID(),
                key,
                value: resolveVars(value, vars),
                disabled: false,
            })
        }
    }

    const contentTypeHeader = rawHeaders.find(
        (h) => h?.key?.toLowerCase() === "content-type" && !h.disabled
    )
    const contentType = contentTypeHeader
        ? contentTypeHeader.value
        : baseConfig.contentType

    const headers: ItemUrl[] = rawHeaders.filter(
        (h) => !h.disabled && h?.key?.toLowerCase() !== "content-type"
    )

    // 2. Query params normalization
    const rawParamsSource = mutatedRequest.query ?? (mutatedRequest.url && typeof mutatedRequest.url === "object" ? (mutatedRequest.url as any).query : undefined) ?? baseConfig.requestParams
    const requestParams: ItemUrl[] = []

    if (Array.isArray(rawParamsSource)) {
        for (const q of rawParamsSource) {
            if (!q || (q as any).disabled) continue
            requestParams.push({
                ...(q as any),
                key: resolveVars((q as any).key, vars),
                value: resolveVars((q as any).value, vars),
            })
        }
    } else if (rawParamsSource && typeof rawParamsSource === "object") {
        for (const [key, value] of Object.entries(rawParamsSource)) {
            if (typeof value === "function") continue
            requestParams.push({
                id: crypto.randomUUID(),
                key: resolveVars(key, vars),
                value: resolveVars(value, vars),
                disabled: false,
            })
        }
    }

    // 3. URL & Endpoint normalization
    let baseUrl = baseConfig.baseUrl
    let endpoint = baseConfig.endpoint

    let rawUrlString: unknown = undefined
    if (typeof mutatedRequest.url === "string") {
        rawUrlString = mutatedRequest.url
    } else if (mutatedRequest.url && typeof mutatedRequest.url === "object") {
        if ("raw" in mutatedRequest.url && (mutatedRequest.url as any).raw !== undefined) {
            rawUrlString = (mutatedRequest.url as any).raw
        } else if ("href" in mutatedRequest.url && (mutatedRequest.url as any).href !== undefined) {
            rawUrlString = (mutatedRequest.url as any).href
        }
    }

    if (rawUrlString !== undefined && rawUrlString !== "" && rawUrlString !== initialUrl) {
        const rawUrl = resolveVars(rawUrlString, vars)
        if (/^https?:\/\//i.test(rawUrl)) {
            try {
                const parsed = new URL(rawUrl)
                baseUrl = parsed.origin
                endpoint = `${parsed.pathname}${parsed.search ? parsed.search : ""}${parsed.hash}`
            } catch {
                endpoint = rawUrl.split("?")[0]
            }
        } else {
            endpoint = rawUrl.split("?")[0]
        }
    }

    // 4. Body normalization
    let raw = baseConfig.raw
    if (typeof mutatedRequest.body === "string") {
        raw = resolveVars(mutatedRequest.body, vars)
    } else if (mutatedRequest.body && typeof mutatedRequest.body === "object") {
        if ("raw" in mutatedRequest.body && (mutatedRequest.body as any).raw !== undefined) {
            raw = resolveVars((mutatedRequest.body as any).raw, vars)
        } else if (!("mode" in mutatedRequest.body) && !("formdata" in mutatedRequest.body)) {
            // User set request.body = { ... } directly
            raw = resolveVars(mutatedRequest.body, vars)
        }
    }

    const formDataBody = (mutatedRequest.body && typeof mutatedRequest.body === "object" && "formdata" in mutatedRequest.body)
        ? (mutatedRequest.body as any).formdata
        : baseConfig.formData

    return {
        baseUrl,
        endpoint,
        method,
        headers,
        requestParams,
        contentType,
        raw,
        formData: formDataBody,
        signal: baseConfig.signal,
    }
}

// ---------------------------------------------------------------------------
// useRequestSender — pure send logic, reads all context from hooks internally
// ---------------------------------------------------------------------------
export const useRequestSender = () => {
    const dispatch = useAppDispatch()
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const {activeCollection, preScript, variables, updateVariableMutation} = useCollection()
    const {request} = useRequestConfig(activeCollection?.id ?? "", activeTabId)
    const queryClient = useQueryClient()
    const {selectedBaseUrl} = useEnvResolve()

    return async (signal?: AbortSignal) => {
        const currentReq = queryClient.getQueryData<RestRequestResponse>(
            requestConfigQueryKey(activeCollection?.id ?? "", activeTabId)
        ) ?? request

        if (!currentReq || !request?.id) return

        // Build env vars record from collection variables (isSelected BASE_URL is resolved inside)
        const varsObj = buildEnvVarsRecord(variables)

        // endpoint = selectedBaseUrl + request.url.raw (backend keeps raw url with path+query)
        const rawEndpoint = currentReq.url?.raw ?? ""
        const endpoint = rawEndpoint

        const contentType = currentReq.headers?.find(
            h => h?.key.toLowerCase() === 'content-type' && !h.disabled
        )?.value ?? ''

        const config: ISendRequest = {
            baseUrl: selectedBaseUrl,
            endpoint,
            method: (currentReq.method ?? "GET"),
            headers: (currentReq.headers ?? [])
                .filter(h => !h.disabled)
                .filter(h => h.key.toLowerCase() !== 'content-type')
                .map(h => ({...h, value: resolveVars(h.value ?? '', varsObj)})),
            requestParams: (currentReq.url?.query ?? currentReq.query ?? [])
                .filter(q => !q.disabled)
                .map(q => ({...q, value: resolveVars(q.value ?? '', varsObj)})),
            contentType,
            raw: currentReq.body?.raw ? resolveVars(currentReq.body.raw, varsObj) : undefined,
            formData: currentReq.body?.formdata,
            signal,
        }

        const scriptValue = request.script ?? ""
        let finalConfig = config
        const collectedResults: ScriptResultDto[] = []
        const collectedLogs: ScriptLog[] = []
        const mergedMutations: Record<string, string | null> = {}

        // Helper: persist variable mutations via the backend UpdateVariable endpoint
        const applyVariableMutations = async (mutations: Record<string, unknown>) => {
            for (const [key, rawValue] of Object.entries(mutations)) {
                const value = formatVariableValue(rawValue)

                // Update local varsObj for subsequent resolves within this request
                if (value === null) {
                    delete varsObj[key]
                } else {
                    varsObj[key] = value
                }

                // Persist to backend (and invalidate react-query cache)
                const existing = variables.find(v => v.key === key)
                if (existing) {
                    if (value === null) {
                        // Deletion — no-op here; service has no delete-by-key, skip silently
                    } else {
                        await updateVariableMutation.mutateAsync({
                            id: existing.id,
                            baseVersion: activeCollection?.version ?? "",
                            key: existing.key,
                            value,
                        }).catch(() => {/* Handled by onError in mutation */})
                    }
                }
                // If the variable doesn't exist yet we skip creation here — pre-request scripts
                // should only mutate existing env vars.
            }
        }

        // 1. Pre-request script phase (mutates request payload before sending)
        if (preScript?.trim() && currentReq) {
            try {
                const initialFullUrl = selectedBaseUrl
                    ? (endpoint ? `${selectedBaseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}` : selectedBaseUrl)
                    : endpoint

                const initialRequest: RestRequestResponse = {
                    ...currentReq,
                    method: config.method,
                    url: {
                        ...(typeof currentReq.url === "object" ? currentReq.url : {}),
                        raw: initialFullUrl,
                    } as any,
                }

                const preOutput = await runPreRequestScript({
                    script: preScript,
                    request: initialRequest,
                    variables: varsObj,
                })

                if (preOutput.mutations) {
                    Object.assign(mergedMutations, preOutput.mutations)
                    await applyVariableMutations(preOutput.mutations)
                    if (preOutput.mutations["BASE_URL"]) {
                        config.baseUrl = String(preOutput.mutations["BASE_URL"])
                    }
                }

                if (preOutput.logs?.length) {
                    collectedLogs.push(...preOutput.logs)
                }

                if (preOutput.result !== undefined) {
                    collectedResults.push({
                        type: "prerequest",
                        data: preOutput.result,
                    })
                }

                finalConfig = applyMutatedRequestToSendConfig(config, preOutput.request, varsObj, initialFullUrl)
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err)
                CustomToast.error(`Pre-request script error: ${msg}`)
                collectedLogs.push({
                    type: "error",
                    message: `Pre-request script error: ${msg}`,
                    timestamp: Date.now(),
                    scriptType: "prerequest",
                })
                dispatch(setScriptResult({
                    requestId: request.id,
                    result: collectedResults,
                    mutations: mergedMutations,
                    logs: collectedLogs,
                }))
                return
            }
        }

        // 2. Send API request
        const response = await sendApiRequest(finalConfig)
        if (!response) return
        dispatch(setResponse({requestId: request.id, response}))

        // 3. Post-request script phase
        if (scriptValue?.trim()) {
            try {
                const {result, mutations, logs} = await runScript({
                    script: scriptValue,
                    response,
                    variables: varsObj,
                })

                if (mutations) {
                    Object.assign(mergedMutations, mutations)
                    await applyVariableMutations(mutations)
                }

                if (logs?.length) {
                    collectedLogs.push(...logs)
                }

                if (result !== undefined) {
                    collectedResults.push({
                        type: "postrequest",
                        data: result,
                    })
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err)
                CustomToast.error(`Post-request script error: ${msg}`)
                collectedLogs.push({
                    type: "error",
                    message: `Post-request script error: ${msg}`,
                    timestamp: Date.now(),
                    scriptType: "postrequest",
                })
            }
        }

        // 4. Save combined script results to Redux
        if (collectedResults.length > 0 || collectedLogs.length > 0 || Object.keys(mergedMutations).length > 0) {
            dispatch(setScriptResult({
                requestId: request.id,
                result: collectedResults,
                mutations: mergedMutations,
                logs: collectedLogs,
            }))
        }
    }
}