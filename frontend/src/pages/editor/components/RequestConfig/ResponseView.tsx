import {Badge} from "@/components/ui/badge.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible.tsx";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx";
import {Download, Link2, Eye, EyeOff, ChevronDown, Plus, X, Pencil, Copy} from "lucide-react";
import {useMemo, useState, useCallback, useEffect} from "react";
import * as XLSX from 'xlsx';
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTabId, setActiveExampleId} from "@/app/slices/editorTabsSlice.ts";
import {selectResponseByRequestId} from "@/app/slices/restApiSlice.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import CustomToast from "@/components/common/toast";
import type {ScriptLog} from "@/types/response.ts";
import {cn} from "@/lib/utils.ts";
import {useDebouncedCallback} from "use-debounce";
import {getHttpStatusText, HTTP_STATUS_TEXTS} from "@/lib/httpStatusCodes.ts";

const EMPTY_LOGS: ScriptLog[] = []
const EMPTY_MUTATIONS: Record<string, string | null> = {}

const SectionHeader: React.FC<{
    label: string
    count?: number
    open: boolean
    onToggle: () => void
}> = ({ label, count, open, onToggle }) => (
    <CollapsibleTrigger asChild onClick={onToggle}>
        <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent rounded-md">
            <div className="flex items-center gap-2">
                <ChevronDown
                    className="h-4 w-4 text-slate-500 transition-transform duration-200"
                    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
                <span className="text-sm font-medium text-foreground">{label}</span>
                {count !== undefined && count > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{count}</Badge>
                )}
            </div>
        </div>
    </CollapsibleTrigger>
)

const LogEntry: React.FC<{ log: ScriptLog }> = ({ log }) => {
    const time = new Date(log.timestamp).toISOString().slice(11, 23)
    const colors: Record<string, string> = {
        error: "text-red-400",
        warn: "text-amber-400",
        info: "text-blue-400",
        log: "text-slate-200",
    }
    return (
        <div className="flex items-start gap-2 py-0.5 font-mono text-xs">
            <span className="text-slate-500 shrink-0">{time}</span>
            {log.scriptType && (
                <span className={cn(
                    "px-1 py-0.2 rounded text-[10px] uppercase shrink-0 font-medium",
                    log.scriptType === "prerequest" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                )}>
                    {log.scriptType === "prerequest" ? "pre" : "post"}
                </span>
            )}
            <span className={colors[log.type] ?? "text-slate-200"}>[{log.type}]</span>
            <span className="text-slate-300 break-all">{log.message}</span>
        </div>
    )
}

const getStatusBadgeColor = (code?: number) => {
    if (!code) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800/80"
    const s = Math.floor(code / 100)
    if (s === 2) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/40"
    if (s === 3) return "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800/60 hover:bg-blue-200/70 dark:hover:bg-blue-900/40"
    if (s === 4) return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-200/70 dark:hover:bg-amber-900/40"
    return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border-red-200 dark:border-red-800/60 hover:bg-red-200/70 dark:hover:bg-red-900/40"
}

const getStatusDotColor = (code?: number) => {
    if (!code) return "bg-slate-400"
    const s = Math.floor(code / 100)
    if (s === 2) return "bg-emerald-500"
    if (s === 3) return "bg-blue-500"
    if (s === 4) return "bg-amber-500"
    return "bg-red-500"
}

const STATUS_GROUPS = [
    {
        label: "2xx Success",
        options: [
            { code: 200, label: "OK", dot: "bg-emerald-500" },
            { code: 201, label: "Created", dot: "bg-emerald-500" },
            { code: 204, label: "No Content", dot: "bg-emerald-500" },
        ],
    },
    {
        label: "3xx Redirection",
        options: [
            { code: 301, label: "Moved Permanently", dot: "bg-blue-500" },
            { code: 302, label: "Found", dot: "bg-blue-500" },
            { code: 304, label: "Not Modified", dot: "bg-blue-500" },
        ],
    },
    {
        label: "4xx Client Error",
        options: [
            { code: 400, label: "Bad Request", dot: "bg-amber-500" },
            { code: 401, label: "Unauthorized", dot: "bg-amber-500" },
            { code: 403, label: "Forbidden", dot: "bg-amber-500" },
            { code: 404, label: "Not Found", dot: "bg-amber-500" },
            { code: 422, label: "Unprocessable Entity", dot: "bg-amber-500" },
            { code: 429, label: "Too Many Requests", dot: "bg-amber-500" },
        ],
    },
    {
        label: "5xx Server Error",
        options: [
            { code: 500, label: "Internal Server Error", dot: "bg-red-500" },
            { code: 502, label: "Bad Gateway", dot: "bg-red-500" },
            { code: 503, label: "Service Unavailable", dot: "bg-red-500" },
            { code: 504, label: "Gateway Timeout", dot: "bg-red-500" },
        ],
    },
]

const ResponseView: React.FC = () => {
    const dispatch = useAppDispatch()
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const {activeCollection} = useCollection()
    const collectionId = activeCollection?.id
    const currResponse = useAppSelector((state) => selectResponseByRequestId(state, activeTabId))
    const {
        request,
        saveResponse,
        addExampleResponse,
        deleteExampleResponse,
        updateExampleResponse,
        activeExample,
        activeExampleId,
    } = useRequestConfig(collectionId ?? "", activeTabId)
    const [isSaving, setIsSaving] = useState(false)
    const scriptResult = currResponse?.result
    const scriptLogs = currResponse?.logs ?? EMPTY_LOGS
    const scriptMutations = currResponse?.mutations ?? EMPTY_MUTATIONS
    const examples = request?.responses ?? []

    const sourceTab = activeExampleId ?? "actual"

    console.log(currResponse)
    const responseCode = activeExample?.code ?? currResponse?.statusCode
    const responseStatus = activeExample?.status || getHttpStatusText(currResponse?.statusCode, currResponse?.statusText) || "OK"
    const badgeColor = getStatusBadgeColor(responseCode)
    const activeExampleCode = activeExample?.code ?? 200
    const isKnownCode = STATUS_GROUPS.some(g => g.options.some(o => o.code === activeExampleCode))
    const customOption = (!isKnownCode && activeExample?.code) ? {
        code: activeExample.code,
        label: HTTP_STATUS_TEXTS[activeExample.code] ?? "Custom",
        dot: getStatusDotColor(activeExample.code),
    } : null

    const responseBody = useMemo(() => {
        if (activeExample) return activeExample.body ?? ""
        if (!currResponse?.data) return ""
        return typeof currResponse.data === "string"
            ? currResponse.data
            : JSON.stringify(currResponse.data)
    }, [activeExample, currResponse])

    const prettyResponse = useMemo(() => {
        if (!responseBody) return ""
        try {
            return JSON.stringify(JSON.parse(responseBody), null, 2)
        } catch {
            return responseBody
        }
    }, [responseBody])

    const normalizedScriptResults = useMemo((): Array<{ type?: string; display: string }> => {
        if (scriptResult === null || scriptResult === undefined) return []
        const list = Array.isArray(scriptResult) ? scriptResult : [scriptResult]
        return list.map((item: any) => {
            if (item && typeof item === "object" && "type" in item) {
                const data = item.data
                let display = ""
                try {
                    display = typeof data === "string" ? data : JSON.stringify(data, null, 2)
                } catch {
                    display = String(data)
                }
                return { type: item.type, display: display || "(empty)" }
            }
            let display = ""
            try {
                display = typeof item === "string" ? item : JSON.stringify(item, null, 2)
            } catch {
                display = String(item)
            }
            return { display: display || "(empty)" }
        }).filter(item => item.display !== "(empty)" || item.type)
    }, [scriptResult])

    const mutationKeys = Object.keys(scriptMutations)
    const hasLogs = scriptLogs.length > 0
    const hasMutations = mutationKeys.length > 0
    const hasResult = normalizedScriptResults.length > 0

    const [editorBody, setEditorBody] = useState(prettyResponse)

    useEffect(() => {
        setEditorBody(prettyResponse)
    }, [prettyResponse])

    const debouncedSaveBody = useDebouncedCallback(async (val: string) => {
        if (!activeExample?.id) return
        try {
            await updateExampleResponse(activeExample.id, { body: val })
        } catch (err) {
            console.error("Failed to update example body:", err)
        }
    }, 400)

    const handleBodyChange = (val: string) => {
        setEditorBody(val)
        if (activeExample?.id) {
            debouncedSaveBody(val)
        }
    }

    const [responseOpen, setResponseOpen] = useState(true)
    const [resultOpen, setResultOpen] = useState(true)
    const [mutationsOpen, setMutationsOpen] = useState(true)
    const [logsOpen, setLogsOpen] = useState(true)

    // Save actual response dialog
    const [dialogOpen, setDialogOpen] = useState(false)
    const [exampleName, setExampleName] = useState("")

    // Add new example dialog
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newExampleName, setNewExampleName] = useState("")

    // Rename example dialog
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [renameValue, setRenameValue] = useState("")

    const [visualizeExcel, setVisualizeExcel] = useState(false)
    const [excelHeaders, setExcelHeaders] = useState<string[]>([])
    const [excelData, setExcelData] = useState<unknown[][]>([])

    const responseContentType = currResponse?.contentType ?? ""
    const isImage = responseContentType.startsWith("image/")
    const isAudio = responseContentType.startsWith("audio/")
    const isVideo = responseContentType.startsWith("video/")
    const isPdf = responseContentType === "application/pdf"
    const isExcel = responseContentType === "application/vnd.ms-excel"
        || responseContentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    useEffect(() => {
        setVisualizeExcel(false)
        setExcelHeaders([])
        setExcelData([])
    }, [currResponse])

    const handleSaveExample = async () => {
        if (!activeTabId || !collectionId || !exampleName.trim() || !currResponse) return
        try {
            setIsSaving(true)
            const headers = currResponse.headers
                ? Object.entries(currResponse.headers).map(([key, value]) => ({ key, value }))
                : []
            const body = typeof currResponse.data === "string"
                ? currResponse.data
                : JSON.stringify(currResponse.data)

            const saved = await saveResponse({
                name: exampleName.trim(),
                status: currResponse.statusText || "OK",
                code: currResponse.statusCode,
                body,
                header: headers,
            })
            CustomToast.success("Example response saved")
            setExampleName("")
            setDialogOpen(false)
            if (saved?.responses && saved.responses.length > 0) {
                const latest = saved.responses[saved.responses.length - 1]
                if (latest?.id) {
                    dispatch(setActiveExampleId({ tabId: activeTabId, exampleId: latest.id }))
                }
            }
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to save response")
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddExample = async () => {
        if (!activeTabId || !collectionId) return
        try {
            setIsSaving(true)
            const name = newExampleName.trim() || "New Example"
            const {id} = await addExampleResponse(name)
            dispatch(setActiveExampleId({tabId: activeTabId, exampleId: id}))
            CustomToast.success("New example created")
            setNewExampleName("")
            setAddDialogOpen(false)
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to create example")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteExample = async (exampleId: string) => {
        if (!activeTabId || !collectionId) return
        try {
            await deleteExampleResponse(exampleId)
            if (activeExampleId === exampleId) {
                dispatch(setActiveExampleId({tabId: activeTabId, exampleId: null}))
            }
            CustomToast.success("Example response removed")
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to remove example")
        }
    }

    const handleOpenRename = () => {
        if (!activeExample) return
        setRenameValue(activeExample.name)
        setRenameDialogOpen(true)
    }

    const handleRenameExample = async () => {
        if (!activeExample?.id || !renameValue.trim()) return
        try {
            setIsSaving(true)
            await updateExampleResponse(activeExample.id, {name: renameValue.trim()})
            CustomToast.success("Example renamed")
            setRenameDialogOpen(false)
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to rename example")
        } finally {
            setIsSaving(false)
        }
    }

    const handleStatusChange = async (statusCodeStr: string) => {
        if (!activeExample?.id) return
        const code = Number(statusCodeStr)
        const status = HTTP_STATUS_TEXTS[code] ?? activeExample.status ?? "OK"
        try {
            await updateExampleResponse(activeExample.id, {code, status})
        } catch (err) {
            CustomToast.error("Failed to update status code")
        }
    }

    const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
        const base64 = dataUrl.split(',')[1]
        const binaryString = atob(base64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
    }

    const handleVisualize = useCallback(() => {
        if (!isExcel || !currResponse?.data) return
        if (visualizeExcel) {
            setVisualizeExcel(false)
            return
        }
        try {
            const workbook = XLSX.read(dataUrlToArrayBuffer(currResponse.data as string), { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
            if (data.length > 0) {
                setExcelHeaders(data[0].map(String))
                setExcelData(data.slice(1))
            }
            setVisualizeExcel(true)
        } catch {
            setVisualizeExcel(false)
        }
    }, [isExcel, currResponse?.data, visualizeExcel])

    const onSourceChange = useCallback((value: string) => {
        dispatch(setActiveExampleId({
            tabId: activeTabId,
            exampleId: value === "actual" ? null : value,
        }))
    }, [activeTabId, dispatch])

    const handleCopyResponseBody = useCallback(async () => {
        const textToCopy = editorBody || prettyResponse
        if (!textToCopy) {
            CustomToast.error("No response body to copy")
            return
        }
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy)
            } else {
                const textArea = document.createElement("textarea")
                textArea.value = textToCopy
                textArea.style.position = "fixed"
                textArea.style.opacity = "0"
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand("copy")
                document.body.removeChild(textArea)
            }
            CustomToast.success("Response body copied to clipboard")
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to copy response")
        }
    }, [editorBody, prettyResponse])

    return (
        <>
        <section
            className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Response</h2>
                    {activeExample ? (
                        <div className="flex items-center gap-2">
                            <Select
                                value={String(activeExampleCode)}
                                onValueChange={handleStatusChange}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "h-[22px] data-[size=default]:h-[22px] data-[size=sm]:h-[22px] min-h-[22px] py-0 px-2 text-xs font-semibold rounded-md border gap-1 transition-colors cursor-pointer shadow-none [&_svg]:size-3 [&_svg]:text-current [&_svg]:opacity-70",
                                        getStatusBadgeColor(activeExampleCode)
                                    )}
                                >
                                    <SelectValue placeholder="Status Code" />
                                </SelectTrigger>
                                <SelectContent align="start" className="w-[230px]">
                                    {customOption && (
                                        <>
                                            <SelectGroup>
                                                <SelectLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-1">
                                                    Custom Status
                                                </SelectLabel>
                                                <SelectItem value={String(customOption.code)} className="text-xs cursor-pointer py-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn("size-1.5 rounded-full shrink-0", customOption.dot)} />
                                                        <span className="font-semibold">{customOption.code}</span>
                                                        <span className="text-current opacity-90">{customOption.label}</span>
                                                    </div>
                                                </SelectItem>
                                            </SelectGroup>
                                            <SelectSeparator />
                                        </>
                                    )}
                                    {STATUS_GROUPS.map((group, groupIndex) => (
                                        <div key={group.label}>
                                            {groupIndex > 0 && <SelectSeparator />}
                                            <SelectGroup>
                                                <SelectLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-1">
                                                    {group.label}
                                                </SelectLabel>
                                                {group.options.map((opt) => (
                                                    <SelectItem
                                                        key={opt.code}
                                                        value={String(opt.code)}
                                                        className="text-xs cursor-pointer py-1.5"
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={cn("size-1.5 rounded-full shrink-0", opt.dot)} />
                                                            <span className="font-semibold">{opt.code}</span>
                                                            <span className="text-current opacity-90">{opt.label}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        responseCode && (
                            <Badge
                                className={cn(
                                    "h-[22px] text-xs font-semibold px-2 py-0 rounded-md border shadow-none flex items-center gap-1",
                                    badgeColor
                                )}
                            >
                                <span className={cn("size-1.5 rounded-full shrink-0", getStatusDotColor(responseCode))} />
                                <span>{`${responseCode} ${responseStatus}`}</span>
                            </Badge>
                        )
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    {sourceTab === "actual" && (
                        <>
                            <span>{currResponse?.responseTime ?? 0} ms</span>
                            <span>{currResponse?.responseSize ?? 0} kb</span>
                            <span>{currResponse?.protocol}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between border-b border-border px-4 pt-2">
                <Tabs value={sourceTab} onValueChange={onSourceChange} className="w-full">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                        <TabsList className="h-8 rounded-lg bg-muted flex items-center shrink-0">
                            <TabsTrigger value="actual" className="h-7 px-3 text-xs">
                                Actual Response
                            </TabsTrigger>
                            {examples.map((ex, i) => {
                                const exId = ex.id ?? String(i)
                                return (
                                    <div key={exId} className="flex items-center group relative">
                                        <TabsTrigger
                                            value={exId}
                                            className="h-7 pl-3 pr-6 text-xs flex items-center gap-1"
                                        >
                                            <span>Example: {ex.name}</span>
                                        </TabsTrigger>
                                        <button
                                            type="button"
                                            title="Remove Example"
                                            aria-label="Remove Example"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-red-500 hover:bg-muted-foreground/10 transition-colors z-10"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteExample(exId)
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )
                            })}
                        </TabsList>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs flex items-center gap-1 shrink-0"
                            onClick={() => {
                                setNewExampleName("New Example")
                                setAddDialogOpen(true)
                            }}
                            title="Add New Request Example"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {activeExample && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs flex items-center gap-1 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={handleOpenRename}
                                title="Rename Example"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Rename</span>
                            </Button>
                        )}
                    </div>
                </Tabs>
            </div>

            <Tabs defaultValue="pretty" className="flex-1 overflow-hidden p-4">
                <div className="mb-3 flex items-center justify-between">
                    <TabsList className="h-9 rounded-lg bg-muted">
                        <TabsTrigger value="pretty">Pretty</TabsTrigger>
                        <TabsTrigger value="console">Console</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!currResponse || Boolean(activeExample)}
                            onClick={() => setDialogOpen(true)}
                            title={activeExample ? "Cannot save example while viewing an example. Switch to Actual Response first." : undefined}
                        >
                            <Download className="mr-1 h-4 w-4"/>
                            Save
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Link2 className="mr-1 h-4 w-4"/>
                                    Share
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                    onClick={handleCopyResponseBody}
                                    disabled={!editorBody && !prettyResponse}
                                    className="cursor-pointer"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" disabled={!isExcel} onClick={handleVisualize}>
                            {visualizeExcel ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                            {visualizeExcel ? 'Show Raw' : 'Visualize'}
                        </Button>
                    </div>
                </div>

                <TabsContent value="pretty" className="h-[calc(100%-3.2rem)]">
                    <div>
                        {isImage && currResponse?.data ? (
                            <div className="flex items-center justify-center h-[300px] bg-slate-100 rounded-md">
                                <img src={currResponse.data as string} alt="response" className="max-w-full max-h-full object-contain" />
                            </div>
                        ) : isAudio && currResponse?.data ? (
                            <div className="flex items-center justify-center py-8">
                                <audio controls src={currResponse.data as string} className="w-full max-w-md" />
                            </div>
                        ) : isVideo && currResponse?.data ? (
                            <div className="flex items-center justify-center">
                                <video controls src={currResponse.data as string} className="max-w-full max-h-[400px]" />
                            </div>
                        ) : isPdf && currResponse?.data ? (
                            <iframe src={currResponse.data as string} className="w-full h-[500px] border-0 rounded-md" />
                        ) : isExcel && visualizeExcel ? (
                            <div className="h-full overflow-auto rounded-md border border-border">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-100">
                                            {excelHeaders.map((h, i) => (
                                                <th key={i} className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {excelData.map((row, ri) => (
                                            <tr key={ri} className="hover:bg-muted/50 even:bg-muted/30">
                                                {excelHeaders.map((_, ci) => (
                                                    <td key={ci} className="border border-border px-3 py-1.5 text-muted-foreground whitespace-nowrap">{row[ci] != null ? String(row[ci]) : ''}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-[300px] overflow-hidden rounded-md">
                                <SandpackScriptEditor
                                    readOnly={!activeExample}
                                    value={editorBody}
                                    onChange={handleBodyChange}
                                    fileName="response.json"
                                    theme="dark"
                                    showReadOnly={false}
                                    showLineNumbers={false}
                                    className="h-full"
                                />
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="console" className="h-[calc(100%-3.2rem)] overflow-auto">
                    {activeExample ? (
                        <div className="flex items-center justify-center h-full text-sm text-slate-400">
                            No console data for example responses
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Request Raw */}
                            {currResponse?.rawRequest && (
                                <Collapsible open={responseOpen} onOpenChange={setResponseOpen}
                                    className="rounded-lg border border-border">
                                    <SectionHeader
                                        label="Request Raw"
                                        open={responseOpen}
                                        onToggle={() => setResponseOpen(!responseOpen)}
                                    />
                                    <CollapsibleContent className="px-3 pb-3">
                                        <pre className="font-mono text-xs text-slate-300 bg-[#272822] rounded-md p-3 overflow-auto max-h-[200px] whitespace-pre-wrap">
                                            {currResponse.rawRequest}
                                        </pre>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}

                            {/* Script Result */}
                            {hasResult && (
                                <Collapsible open={resultOpen} onOpenChange={setResultOpen}
                                    className="rounded-lg border border-border">
                                    <SectionHeader
                                        label="Script Result"
                                        count={normalizedScriptResults.length > 1 ? normalizedScriptResults.length : undefined}
                                        open={resultOpen}
                                        onToggle={() => setResultOpen(!resultOpen)}
                                    />
                                    <CollapsibleContent className="px-3 pb-3 space-y-2">
                                        {normalizedScriptResults.map((res, idx) => (
                                            <div key={idx} className="rounded-md border border-border/50 bg-[#272822] p-3">
                                                {res.type && (
                                                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-700/50">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase",
                                                            res.type === "prerequest"
                                                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                        )}>
                                                            {res.type === "prerequest" ? "Pre-request Script" : "Post-request Script"}
                                                        </span>
                                                    </div>
                                                )}
                                                <pre className="font-mono text-xs text-slate-300 overflow-auto max-h-[200px] whitespace-pre-wrap">
                                                    {res.display}
                                                </pre>
                                            </div>
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            )}

                            {/* Mutations */}
                            {hasMutations && (
                                <Collapsible open={mutationsOpen} onOpenChange={setMutationsOpen}
                                    className="rounded-lg border border-border">
                                    <SectionHeader
                                        label="Mutations"
                                        count={mutationKeys.length}
                                        open={mutationsOpen}
                                        onToggle={() => setMutationsOpen(!mutationsOpen)}
                                    />
                                    <CollapsibleContent className="px-3 pb-3">
                                        <div className="overflow-hidden rounded-md border border-border">
                                            <div
                                                className="grid grid-cols-2 bg-muted px-3 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                                                <span>Key</span>
                                                <span>Value</span>
                                            </div>
                                            {mutationKeys.map((key) => (
                                                <div key={key}
                                                    className="grid grid-cols-2 border-t border-border px-3 py-1.5 text-xs">
                                                    <span
                                                        className="font-mono text-foreground truncate">{key}</span>
                                                    <span className="font-mono text-muted-foreground truncate">
                                                        {scriptMutations[key] ?? "(deleted)"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}

                            {/* Console Logs */}
                            {hasLogs && (
                                <Collapsible open={logsOpen} onOpenChange={setLogsOpen}
                                    className="rounded-lg border border-border">
                                    <SectionHeader
                                        label="Console Logs"
                                        count={scriptLogs.length}
                                        open={logsOpen}
                                        onToggle={() => setLogsOpen(!logsOpen)}
                                    />
                                    <CollapsibleContent className="px-3 pb-3">
                                        <div className="bg-[#272822] rounded-md p-3 max-h-[300px] overflow-auto font-mono">
                                            {scriptLogs.map((log, i) => (
                                                <LogEntry key={i} log={log}/>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}

                            {!currResponse?.rawRequest && !hasResult && !hasMutations && !hasLogs && (
                                <div className="flex items-center justify-center h-full text-sm text-slate-400 py-12">
                                    Send a request to see console output
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </section>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Save Example Response</DialogTitle>
                    <DialogDescription>
                        Enter a name for this response example.
                    </DialogDescription>
                </DialogHeader>
                <Input
                    value={exampleName}
                    onChange={(e) => setExampleName(e.target.value)}
                    placeholder="e.g. Success 200"
                    disabled={isSaving}
                    onKeyDown={(e) => { if (e.key === "Enter" && !isSaving) handleSaveExample() }}
                />
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                    <Button size="sm" disabled={!exampleName.trim() || isSaving} onClick={handleSaveExample}>
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add Request Example</DialogTitle>
                    <DialogDescription>
                        Create a new mock example response for this request from scratch.
                    </DialogDescription>
                </DialogHeader>
                <Input
                    value={newExampleName}
                    onChange={(e) => setNewExampleName(e.target.value)}
                    placeholder="e.g. 404 Not Found"
                    disabled={isSaving}
                    onKeyDown={(e) => { if (e.key === "Enter" && !isSaving) handleAddExample() }}
                />
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                    <Button size="sm" disabled={isSaving} onClick={handleAddExample}>
                        {isSaving ? "Creating..." : "Create Example"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Rename Example</DialogTitle>
                    <DialogDescription>
                        Enter a new name for this example response.
                    </DialogDescription>
                </DialogHeader>
                <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="e.g. Success 200"
                    disabled={isSaving}
                    onKeyDown={(e) => { if (e.key === "Enter" && !isSaving) handleRenameExample() }}
                />
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setRenameDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                    <Button size="sm" disabled={!renameValue.trim() || isSaving} onClick={handleRenameExample}>
                        {isSaving ? "Renaming..." : "Rename"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}

export default ResponseView
