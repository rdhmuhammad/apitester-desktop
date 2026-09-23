import {useEffect, useMemo, useRef, useState} from "react";
import {cn} from "@/lib/utils.ts";
import {isTestTab} from "@/lib/tabUtils.ts";

import {Input} from "@/components/ui/input.tsx";
import {Button} from "@/components/ui/button.tsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select.tsx";
import { LoaderCircle, Plus, Send, X } from "lucide-react";
import DeleteRequestDialog from "./DeleteRequestDialog.tsx";
import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import {
    type ISendRequest, useRequestSender
} from "@/layout/hooks/useSendRequest.ts";
import type {ColtReqMethod} from "@/pages/editor/types/editor.ts";
import type {CollectionVar, ItemUrl} from "@/pages/editor/types/api.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";


const RequestHeader: React.FC = () => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const {activeCollection, variables, preScript, createVariableMutation} = useCollection()
    const baseUrlOptions = useMemo(() => {
        return Array.from(
            new Set(
                variables
                    .filter((item) => item.category === "BASE_URL")
                    .map((item) => item.value)
                    .filter(Boolean)
            )
        )
    }, [variables])
    const {request, updateMethod, updateUrl, updateQuery} = useRequestConfig(activeCollection?.id ?? "", activeTabId)
    const sendRequestAction = useRequestSender()
    const scriptValue = request?.script ?? ""
    const collectionData = activeCollection
    const envVars: Record<string, string> = {}
    const [runtimeVariables, setRuntimeVariables] = useState<CollectionVar[]>(variables)

    useEffect(() => setRuntimeVariables(variables), [variables])

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
        GET: "bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-700 text-white dark:text-white border-emerald-600 dark:border-emerald-600",
        POST: "bg-amber-600 dark:bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-700 text-white dark:text-white border-amber-600 dark:border-amber-600",
        PUT: "bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white dark:text-white border-blue-600 dark:border-blue-600",
        PATCH: "bg-violet-600 dark:bg-violet-600 hover:bg-violet-700 dark:hover:bg-violet-700 text-white dark:text-white border-violet-600 dark:border-violet-600",
        DELETE: "bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700 text-white dark:text-white border-red-600 dark:border-red-600"
    };
    
    const currentMethod = (request?.method ?? "GET") as ColtReqMethod;
    const rawUrl = request?.url?.raw ?? "";
    const queryIndex = rawUrl.indexOf('?');
    const currentEndpoint = queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl;

    const [selectedBaseUrl, setSelectedBaseUrl] = useState("");
    const [newBaseUrl, setNewBaseUrl] = useState("");
    const [selectOpen, setSelectOpen] = useState(false);
    const [isAddingBaseUrl, setIsAddingBaseUrl] = useState(false);
    const [isAddingLoading, setIsAddingLoading] = useState(false);
    const newBaseUrlInputRef = useRef<HTMLInputElement | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isHoveringButton, setIsHoveringButton] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (isAddingBaseUrl) {
            const timer = setTimeout(() => {
                newBaseUrlInputRef.current?.focus()
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [isAddingBaseUrl]);

    const resolveVariableValue = (value: unknown): string => {
        if (value === null || value === undefined) return ""
        let str: string
        if (typeof value === "string") {
            str = value
        } else if (typeof value === "object") {
            if (value && typeof (value as any).toString === "function" && (value as any).toString !== Object.prototype.toString) {
                str = (value as any).toString()
            } else {
                str = JSON.stringify(value)
            }
        } else {
            str = String(value)
        }
        return str.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
            const k = key.trim()
            const matchedVar = runtimeVariables.find((item) => item.key === k)
            if (matchedVar?.category === "BASE_URL" && selectedBaseUrl) {
                return selectedBaseUrl
            }
            const resolved = envVars[k] ?? matchedVar?.value ?? `{{${key}}}`
            if (resolved === undefined || resolved === null) return `{{${key}}}`
            return typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved)
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

    const formatEndpoint = (endpoint: unknown): string => {
        if (endpoint === null || endpoint === undefined) return ""
        let str = typeof endpoint === "string" ? endpoint : String(endpoint)
        const baseUrlVarKeys = new Set(
            runtimeVariables
                .filter((item) => item.category === "BASE_URL")
                .map((item) => item.key)
        )
        str = str.replace(/^\{\{([^{}]+)\}\}/, (match, key: string) => {
            if (baseUrlVarKeys.has(key.trim())) {
                return ""
            }
            return match
        }).trim()

        if (/^https?:\/\//i.test(str)) {
            try {
                const parsedUrl = new URL(str)
                return `${parsedUrl.pathname}${parsedUrl.hash}`
            } catch {
                return str.split('?')[0]
            }
        }

        return str.split('?')[0]
    }

    const handleSendRequest = () => {
        if (!request?.id || isSending) return
        setIsSending(true)
        
        abortControllerRef.current = new AbortController();
        const headerValue = request.headers?.find(h => h?.key.toLowerCase() === 'content-type' && !h.disabled)?.value ?? '';
        console.log(selectedBaseUrl)
        const sendRequestConfig: ISendRequest = {
            baseUrl: selectedBaseUrl,
            endpoint: formatEndpoint(currentEndpoint),
            method: currentMethod,
            headers: (request.headers ?? [])
                .filter(h => !h.disabled)
                .filter(h => h.key.toLowerCase() !== 'Content-Type'.toLowerCase())
                .map((header) => ({
                    ...header,
                    value: resolveVariableValue(header.value ?? "")
                })),
            requestParams: (request.url?.query ?? [])
                .filter(q => !q.disabled),
            contentType: headerValue,
            raw: request.body?.raw,
            formData: request.body?.formdata,
            signal: abortControllerRef.current.signal
        }
        const effectiveRuntimeVariables = runtimeVariables.map(v => 
            v.category === 'BASE_URL' ? { ...v, value: selectedBaseUrl } : v
        )

        sendRequestAction(sendRequestConfig, {
            requestId: request.id,
            request,
            preScriptValue: preScript,
            scriptValue,
            runtimeVariables: effectiveRuntimeVariables,
            setRuntimeVariables
        }).finally(() => {
            setIsSending(false)
            abortControllerRef.current = null
        })
    };

    const handleCancelRequest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsSending(false);
    };

    // Handle Ctrl+Enter keyboard shortcut to send request
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!collectionData) return
            if (!event.ctrlKey && !event.metaKey) return
            if (event.key === "Enter") {
                if (isSending) return
                event.preventDefault()
                handleSendRequest()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    })

    const getNextBaseUrlKey = (vars: CollectionVar[]): string => {
        const existingKeys = new Set(vars.map((v) => v.key.toLowerCase()))
        if (!existingKeys.has("base_url")) {
            return "base_url"
        }
        let index = 1
        while (existingKeys.has(`base_url_${index}`)) {
            index++
        }
        return `base_url_${index}`
    }

    const handleAddBaseUrl = async () => {
        const trimmed = newBaseUrl.trim()
        if (!trimmed) return
        if (!collectionData?.version) return

        setIsAddingLoading(true)
        try {
            const nextKey = getNextBaseUrlKey(variables)
            await createVariableMutation.mutateAsync({
                baseVersion: collectionData.version,
                key: nextKey,
                value: trimmed,
                type: 'string'
            })
            setSelectedBaseUrl(trimmed)
            setNewBaseUrl('')
            setIsAddingBaseUrl(false)
            setSelectOpen(false)
        } catch {
            // Error is handled by createVariableMutation onError
        } finally {
            setIsAddingLoading(false)
        }
    }

    return (
        <div className="basis-3/4 flex items-center h-full gap-3">
            <Select
                value={currentMethod}
                disabled={!collectionData}
                onValueChange={(value) => {
                    const method = value as ColtReqMethod;
                    updateMethod(method)
                }}
            >
                <SelectTrigger
                    className={cn("min-w-[110px] font-semibold text-white [&_svg]:text-white [&_svg]:opacity-100", methodColorClass[currentMethod])}>
                    <SelectValue placeholder="Method"/>
                </SelectTrigger>
                <SelectContent>
                    {requestMethods.map((method) => (
                        <SelectItem key={method} value={method} className={cn("font-semibold", "text-foreground")}>
                            {method}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex w-full items-center rounded-md border border-input bg-transparent shadow-xs">
                <Select
                    open={selectOpen}
                    onOpenChange={(open) => {
                        setSelectOpen(open)
                        if (!open) {
                            setIsAddingBaseUrl(false)
                            setNewBaseUrl("")
                        }
                    }}
                    value={selectedBaseUrl}
                    disabled={!collectionData}
                    onValueChange={setSelectedBaseUrl}
                >
                    <SelectTrigger
                        className="w-[240px] rounded-none border-0 border-r border-input shadow-none focus-visible:ring-0">
                        <SelectValue placeholder="Select Base URL"/>
                    </SelectTrigger>
                    <SelectContent>
                        {baseUrlOptions.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                                No base URL configured
                            </div>
                        ) : (
                            baseUrlOptions.map((baseUrl) => (
                                <SelectItem key={baseUrl} value={baseUrl}>
                                    {baseUrl}
                                </SelectItem>
                            ))
                        )}
                        <SelectSeparator />
                        <div
                            className="p-1"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {!isAddingBaseUrl ? (
                                <button
                                    type="button"
                                    onClick={() => setIsAddingBaseUrl(true)}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add New</span>
                                </button>
                            ) : (
                                <div className="flex w-full items-center gap-1.5 animate-in fade-in-0 duration-200">
                                    <Input
                                        ref={newBaseUrlInputRef}
                                        value={newBaseUrl}
                                        disabled={isAddingLoading}
                                        onChange={(e) => setNewBaseUrl(e.target.value)}
                                        onKeyDown={(e) => {
                                            e.stopPropagation()
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                void handleAddBaseUrl()
                                            } else if (e.key === "Escape") {
                                                e.preventDefault()
                                                setIsAddingBaseUrl(false)
                                                setNewBaseUrl("")
                                            }
                                        }}
                                        className="flex-[4] basis-4/5 min-w-0 h-8 text-xs shadow-none focus-visible:ring-1"
                                        placeholder="https://api.example.com"
                                        aria-label="New Base URL"
                                    />
                                    <Button
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        disabled={isAddingLoading || !newBaseUrl.trim()}
                                        onClick={() => void handleAddBaseUrl()}
                                        className="flex-[1] basis-1/5 min-w-0 h-8 p-0 flex items-center justify-center shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                                        title="Add Base URL"
                                    >
                                        {isAddingLoading ? (
                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </SelectContent>
                </Select>
                <Input
                    value={formatEndpoint(currentEndpoint)}
                    disabled={!collectionData}
                    onChange={(event) => {
                        const value = event.target.value
                        const {cleanUrl, params} = parseQueryParamsFromUrl(value)
                        
                        const nextUrl = {...(request?.url ?? {raw: "", host: [], path: [], query: []}), raw: cleanUrl}
                        updateUrl(nextUrl)
                        const currentParams = request?.url?.query ?? []
                        const nextParams = params.map((param) => currentParams.find((item) => item.key === param.key) ? {
                            ...currentParams.find((item) => item.key === param.key)!,
                            value: param.value
                        } : param)
                        updateQuery(nextParams)
                    }}
                    className="border-0 rounded-none shadow-none focus-visible:ring-0"
                    placeholder="/v1/users"
                    aria-label="Endpoint path"
                />
            </div>
            <Button
                disabled={!collectionData || (!isSending && isTestTab(activeTabId))}
                onClick={isSending ? handleCancelRequest : handleSendRequest}
                onMouseEnter={() => setIsHoveringButton(true)}
                onMouseLeave={() => setIsHoveringButton(false)}
                className={cn(
                    "text-white whitespace-nowrap transition-colors",
                    (isSending && isHoveringButton)
                        ? "bg-red-600 hover:bg-red-700 hover:text-white" 
                        : "bg-indigo-600 hover:bg-indigo-700 hover:disabled:bg-indigo-600"
                )}
            >
                {isSending ? (
                    isHoveringButton ? (
                        <>
                            <X className="h-4 w-4 mr-2"/>
                            Cancel Request
                        </>
                    ) : (
                        <>
                            <LoaderCircle className="h-4 w-4 mr-2 animate-spin"/>
                            Sending...
                        </>
                    )
                ) : (
                    <>
                        <Send className="h-4 w-4 mr-2"/>
                        Send Request
                    </>
                )}
            </Button>
            <DeleteRequestDialog disabled={!collectionData || isSending} />
        </div>
    )
}

export default RequestHeader
