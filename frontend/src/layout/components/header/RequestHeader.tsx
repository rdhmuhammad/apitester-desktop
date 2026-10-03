import React, {useEffect, useMemo, useRef, useState} from "react";
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
import {LoaderCircle, Plus, Send, X} from "lucide-react";
import DeleteRequestDialog from "./DeleteRequestDialog.tsx";
import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import type {ColtReqMethod} from "@/pages/editor/types/editor.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import {useRequestSender} from "@/layout/hooks/useSendRequest.ts";
import {useEnvResolve} from "@/layout/hooks/useEnvResolve.ts";
import {useDebouncedCallback} from "use-debounce";
import {useQueryClient} from "@tanstack/react-query";

const requestMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const methodColorClass: Record<ColtReqMethod, string> = {
    GET: "bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-700 text-white dark:text-white border-emerald-600 dark:border-emerald-600",
    POST: "bg-amber-600 dark:bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-700 text-white dark:text-white border-amber-600 dark:border-amber-600",
    PUT: "bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white dark:text-white border-blue-600 dark:border-blue-600",
    PATCH: "bg-violet-600 dark:bg-violet-600 hover:bg-violet-700 dark:hover:bg-violet-700 text-white dark:text-white border-violet-600 dark:border-violet-600",
    DELETE: "bg-red-600 dark:bg-red-600 hover:bg-red-700 dark:hover:bg-red-700 text-white dark:text-white border-red-600 dark:border-red-600"
};

const RequestHeader: React.FC = () => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const {
        activeCollection,
        variables,
        createVariableMutation,
        selectBaseUrlMutation,
    } = useCollection()

    // Base URL options — all BASE_URL category variables' values
    const baseUrlOptions = useMemo(() =>
        Array.from(new Set(
            variables
                .filter(v => v.category === "BASE_URL")
                .map(v => v.value)
                .filter(Boolean)
        )), [variables])

    // Selected base URL comes from the variable with isSelected === true
    const {selectedBaseUrl} = useEnvResolve()
    const queryClient = useQueryClient()

    const {request, updateMethod, updateUrl, activeExampleId} = useRequestConfig(
        activeCollection?.id ?? "",
        activeTabId
    )
    const isExampleActive = Boolean(activeExampleId)

    const requestSender = useRequestSender()
    const collectionData = activeCollection

    const handleMethodChange = async (value: string) => {
        await updateMethod(value as ColtReqMethod)
        await queryClient.invalidateQueries({queryKey: ["collection", "tree"]})
    }

    // Request method — directly from service, no local processing needed
    const currentMethod = (request?.method ?? "GET") as ColtReqMethod

    // Endpoint input — driven by request.url.raw from service (backend manages it)
    const [editedEndpoint, setEditedEndpoint] = useState<string>(request?.url?.raw ?? "")
    useEffect(() => {
        setEditedEndpoint(request?.url?.raw ?? "")
    }, [request?.url?.raw])

    // Send / cancel state
    const [isSending, setIsSending] = useState(false)
    const [isHoveringButton, setIsHoveringButton] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Base URL add UI state
    const [newBaseUrl, setNewBaseUrl] = useState("")
    const [selectOpen, setSelectOpen] = useState(false)
    const [isAddingBaseUrl, setIsAddingBaseUrl] = useState(false)
    const [isAddingLoading, setIsAddingLoading] = useState(false)
    const newBaseUrlInputRef = useRef<HTMLInputElement>(null)

    const isUpdatingSelectedBaseUrl = selectBaseUrlMutation.isPending

    // Focus input when "Add New" is clicked
    useEffect(() => {
        if (isAddingBaseUrl) {
            const timer = setTimeout(() => { newBaseUrlInputRef.current?.focus() }, 50)
            return () => clearTimeout(timer)
        }
    }, [isAddingBaseUrl])

    // Persist base URL selection to backend
    const handleSelectBaseUrl = async (value: string) => {
        const targetVar = variables.find(v => v.category === "BASE_URL" && v.value === value)
        if (!targetVar) return
        await selectBaseUrlMutation.mutateAsync({
            id: targetVar.id,
            key: targetVar.key,
            value: targetVar.value,
        })
    }

    // Debounced endpoint update — syncs user input to backend
    const debounceChangeEndpoint = useDebouncedCallback((value: string) => {
        const nextUrl = {...(request?.url ?? {raw: "", host: [], path: [], query: []}), raw: value}
        console.log(value)
        updateUrl(nextUrl)
    }, 300)

    const handleChangeEndpoint = (value: string) => {
        console.log(value)
        setEditedEndpoint(value)
        debounceChangeEndpoint(value)
    }

    // Send request
    const handleSendRequest = () => {
        if (!request?.id || isSending || isExampleActive) return
        setIsSending(true)
        abortControllerRef.current = new AbortController()
        requestSender(abortControllerRef.current.signal).finally(() => {
            setIsSending(false)
            abortControllerRef.current = null
        })
    }

    const handleCancelRequest = () => {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        setIsSending(false)
    }

    // Add a new base URL variable
    const getNextBaseUrlKey = (): string => {
        const existingKeys = new Set(variables.map(v => v.key.toLowerCase()))
        if (!existingKeys.has("base_url")) return "base_url"
        let index = 1
        while (existingKeys.has(`base_url_${index}`)) index++
        return `base_url_${index}`
    }

    const handleAddBaseUrl = async () => {
        const trimmed = newBaseUrl.trim()
        if (!trimmed || !collectionData?.version) return
        setIsAddingLoading(true)
        try {
            await createVariableMutation.mutateAsync({
                baseVersion: collectionData.version,
                key: getNextBaseUrlKey(),
                value: trimmed,
                type: "string",
            })
            setNewBaseUrl("")
            setIsAddingBaseUrl(false)
            setSelectOpen(false)
            // Select the newly added URL
            await handleSelectBaseUrl(trimmed)
        } catch {
            // Error handled by createVariableMutation onError
        } finally {
            setIsAddingLoading(false)
        }
    }

    // Ctrl+Enter shortcut
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

    return (
        <div className="basis-3/4 flex items-center h-full gap-3">
            <Select
                value={currentMethod}
                disabled={!collectionData}
                onValueChange={handleMethodChange}
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
                    disabled={!collectionData || isUpdatingSelectedBaseUrl}
                    onValueChange={handleSelectBaseUrl}
                >
                    <SelectTrigger
                        className="w-[240px] rounded-none border-0 border-r border-input shadow-none focus-visible:ring-0">
                        {isUpdatingSelectedBaseUrl ? (
                            <div className="flex items-center gap-2">
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground"/>
                                <span className="truncate">{selectedBaseUrl || "Updating..."}</span>
                            </div>
                        ) : (
                            <SelectValue placeholder="Select Base URL"/>
                        )}
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
                        <SelectSeparator/>
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
                                    <Plus className="h-4 w-4"/>
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
                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin"/>
                                        ) : (
                                            <Plus className="h-4 w-4"/>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </SelectContent>
                </Select>
                <Input
                    value={editedEndpoint}
                    disabled={!collectionData || !request}
                    onBlur={() => {
                        // If user typed a URL with query string, parse it on blur
                        if (editedEndpoint.includes("?")) {
                            setEditedEndpoint(editedEndpoint)
                        }
                    }}
                    onChange={(event) => handleChangeEndpoint(event.target.value)}
                    className="border-0 rounded-none shadow-none focus-visible:ring-0"
                    placeholder="/v1/users"
                    aria-label="Endpoint path"
                />
            </div>
            <Button
                disabled={!collectionData || (!isSending && isTestTab(activeTabId)) || isExampleActive}
                onClick={isSending ? handleCancelRequest : handleSendRequest}
                title={isExampleActive ? "Cannot send request while viewing an example response. Switch to Actual Response first." : undefined}
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
            <DeleteRequestDialog disabled={!collectionData || isSending}/>
        </div>
    )
}

export default RequestHeader
