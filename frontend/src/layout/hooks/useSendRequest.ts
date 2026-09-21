import {useAppDispatch} from "@/app/store/hooks.ts";
import {setResponse, setScriptResult} from "@/app/slices/restApiSlice.ts";
import {runScript} from "@/layout/hooks/useScriptRunner.ts";
import type {CollectionVar} from "@/pages/editor/types/api.ts";
import type React from "react";
import type {ItemUrl} from "@/pages/editor/types/api.ts";
import axios from "@/config/axios.ts";
import type {SendResponse} from "@/types/response.ts";
import {type AxiosResponse, isCancel} from "axios";
import {getFile} from "@/lib/fileStore.ts";
import CustomToast from "@/components/common/toast";

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
        return { data: dataUrl, size: (blob.size / 1024).toFixed(2), isBinary }
    }

    const text = await blob.text()
    try {
        return { data: JSON.parse(text), size: (new Blob([text]).size / 1024).toFixed(2), isBinary }
    } catch {
        return { data: text, size: (new Blob([text]).size / 1024).toFixed(2), isBinary }
    }
}

export const sendApiRequest = async (request: ISendRequest): Promise<SendResponse | null> => {
    const isFormData = request.contentType === "multipart/form-data"
    
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
            baseURL: request.baseUrl,
            url: request.endpoint,
            params: request.requestParams.reduce((acc, it) => {
                acc[it.key] = it.value ?? ""
                return acc
            }, {} as Record<string, string>),
            data: request.contentType === "application/json"
                ? (request.raw ?? "{}") :
                formData(request.formData ?? []),
            responseType: "blob",
            validateStatus: () => true, // Do not throw on non-2xx status codes
            signal: request.signal,
        }) as AxiosResponseWithDuration<Blob>

        const contentType = (response.headers["content-type"] as string)?.toLowerCase() ?? ""
        const { data, size: responseSize, isBinary } = await parseBlobResponse(response.data as Blob, contentType)

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

export const useRequestSender = () => {
    const dispatch = useAppDispatch();
    
    return async (
        config: ISendRequest,
        context: {
            requestId: string;
            scriptValue?: string;
            runtimeVariables: CollectionVar[];
            setRuntimeVariables: React.Dispatch<React.SetStateAction<CollectionVar[]>>;
        }
    ) => {
        const response = await sendApiRequest(config);
        if (!response) return;
        dispatch(setResponse({requestId: context.requestId, response}));
        
        if (!context.scriptValue?.trim()) return;

        try {
            const varsObj: Record<string, string> = {}
            context.runtimeVariables.forEach(v => {
                varsObj[v.key] = v.value
            })

            const {result, mutations, logs} = await runScript({
                script: context.scriptValue,
                response,
                variables: varsObj,
            })

            for (const [key, value] of Object.entries(mutations)) {
                const existing = context.runtimeVariables.find(v => v.key === key)
                if (value === null) {
                    if (existing) context.setRuntimeVariables((current) => current.filter((item) => item.id !== existing.id))
                } else if (existing) {
                    context.setRuntimeVariables((current) => current.map((item) => item.id === existing.id ? {
                        ...item,
                        value
                    } : item))
                } else {
                    context.setRuntimeVariables((current) => [...current, {
                        id: crypto.randomUUID(),
                        key,
                        value,
                        type: "string",
                        category: ""
                    }])
                }
            }

            dispatch(setScriptResult({
                requestId: context.requestId,
                result,
                mutations,
                logs,
            }))
        } catch (err: unknown) {
            CustomToast.error(`Script error: ${err instanceof Error ? err.message : String(err)}`)
        }
    }
}
