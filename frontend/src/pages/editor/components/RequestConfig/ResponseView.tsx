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
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx";
import {Download, Link2, Eye, EyeOff, ChevronDown} from "lucide-react";
import {useMemo, useState, useCallback, useEffect} from "react";
import * as XLSX from 'xlsx';
import {useAppSelector} from "@/app/store/hooks.ts";
import {selectCollectionId, selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";
import {selectResponseByRequestId} from "@/app/slices/restApiSlice.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import CustomToast from "@/components/common/toast";
import type {ScriptLog} from "@/types/response.ts";
import {cn} from "@/lib/utils.ts";

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

const ResponseView: React.FC = () => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const collectionId = useAppSelector(selectCollectionId)
    const currResponse = useAppSelector((state) => selectResponseByRequestId(state, activeTabId))
    const {request, saveResponse} = useRequestConfig(collectionId ?? "", activeTabId)
    const [isSaving, setIsSaving] = useState(false)
    const scriptResult = currResponse?.result
    const scriptLogs = currResponse?.logs ?? EMPTY_LOGS
    const scriptMutations = currResponse?.mutations ?? EMPTY_MUTATIONS
    const examples = request?.responses ?? []

    const [sourceTab, setSourceTab] = useState("actual")

    const activeExample = sourceTab === "actual"
        ? null
        : examples[Number(sourceTab)]

    const responseCode = activeExample?.code ?? currResponse?.statusCode
    const responseStatus = activeExample?.status ?? currResponse?.statusText ?? "OK"
    const badgeColor = (() => {
        if (!responseCode) return "bg-slate-100 text-slate-700"
        const s = Math.floor(responseCode / 100)
        if (s === 2) return "bg-emerald-100 text-emerald-700"
        if (s === 3) return "bg-blue-100 text-blue-700"
        if (s === 4) return "bg-amber-100 text-amber-700"
        return "bg-red-100 text-red-700"
    })()

    const responseBody = useMemo(() => {
        if (activeExample) return activeExample.body
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
    const [responseOpen, setResponseOpen] = useState(true)
    const [resultOpen, setResultOpen] = useState(true)
    const [mutationsOpen, setMutationsOpen] = useState(true)
    const [logsOpen, setLogsOpen] = useState(true)

    const [dialogOpen, setDialogOpen] = useState(false)
    const [exampleName, setExampleName] = useState("")

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

            await saveResponse({
                name: exampleName.trim(),
                status: currResponse.statusText || "OK",
                code: currResponse.statusCode,
                body,
                header: headers,
            })
            CustomToast.success("Example response saved")
            setExampleName("")
            setDialogOpen(false)
        } catch (err) {
            CustomToast.error(err instanceof Error ? err.message : "Failed to save response")
        } finally {
            setIsSaving(false)
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
        setSourceTab(value)
    }, [])

    return (
        <>
        <section
            className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Response</h2>
                    {responseCode && <Badge className={badgeColor}>{`${responseCode} ${responseStatus}`}</Badge>}
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

            <div className="border-b border-border px-4 pt-2">
                <Tabs value={sourceTab} onValueChange={onSourceChange}>
                    <TabsList className="h-8 rounded-lg bg-muted">
                        <TabsTrigger value="actual" className="h-7 px-3 text-xs">
                            Actual Response
                        </TabsTrigger>
                        {examples.map((ex, i) => (
                            <TabsTrigger
                                key={i}
                                value={String(i)}
                                className="h-7 px-3 text-xs"
                            >
                                Example: {ex.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            <Tabs defaultValue="pretty" className="flex-1 overflow-hidden p-4">
                <div className="mb-3 flex items-center justify-between">
                    <TabsList className="h-9 rounded-lg bg-muted">
                        <TabsTrigger value="pretty">Pretty</TabsTrigger>
                        <TabsTrigger value="console">Console</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={!currResponse} onClick={() => setDialogOpen(true)}>
                            <Download className="mr-1 h-4 w-4"/>
                            Save
                        </Button>
                        <Button variant="outline" size="sm">
                            <Link2 className="mr-1 h-4 w-4"/>
                            Share
                        </Button>
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
                                    readOnly
                                    value={prettyResponse}
                                    onChange={() => undefined}
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
        </>
    )
}

export default ResponseView
