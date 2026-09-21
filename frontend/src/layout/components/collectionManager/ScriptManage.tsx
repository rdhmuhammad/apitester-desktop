import {useEffect, useMemo, useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Textarea} from "@/components/ui/textarea.tsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select.tsx";
import {cn} from "@/lib/utils.ts";
import {Maximize2, Minimize2, Play, Plus, RotateCcw, Save, SlidersHorizontal, Trash2, X} from "lucide-react";
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx";
import {runPreRequestScript} from "@/layout/hooks/useScriptRunner.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import type {ScriptLog} from "@/types/response.ts";
import type {RestRequestResponse} from "@/pages/editor/services/requestConfig.ts";
import {pmCompletionSource, resCompletionSource} from "@/lib/pmCompletions.ts";
import {jsCompletionSource} from "@/lib/jsCompletions.ts";
import {cryptoJsCompletionSource} from "@/lib/cryptoJsCompletions.ts";
import {linter} from "@codemirror/lint";
import {getJavaScriptDiagnostic} from "@/pages/editor/components/RequestConfig/ScriptEditor.tsx";

const SCRIPT_DEPENDENCIES = { "crypto-js": "^4.2.0" };

interface ScriptManageProps {
    isExpanded: boolean
    onExpand: () => void
    onCollapse: () => void
}

const defaultMockRequest: RestRequestResponse = {
    id: "mock-req-id",
    name: "Mock Request",
    method: "GET",
    url: {
        raw: "https://api.example.com/users",
        host: ["api", "example", "com"],
        path: ["users"],
        query: []
    },
    headers: [
        { id: "h1", key: "Accept", value: "application/json" }
    ],
    query: [],
    body: { mode: "raw", raw: '{\n  "title": "foo",\n  "body": "bar"\n}' },
    script: "",
    version: "1.0",
}

const ScriptManage: React.FC<ScriptManageProps> = ({isExpanded, onExpand, onCollapse}) => {
    const {collection, variables, preScript, updatePreScriptMutation} = useCollection()
    const [script, setScript] = useState(preScript)
    const [isRunning, setIsRunning] = useState(false)
    const [runResult, setRunResult] = useState("")
    const [runLogs, setRunLogs] = useState<ScriptLog[]>([])
    const [runMutations, setRunMutations] = useState<Record<string, string | null>>({})
    const [runError, setRunError] = useState<string | null>(null)
    const [showOutput, setShowOutput] = useState(false)

    // Collapsible mock request form state
    const [isMockOpen, setIsMockOpen] = useState(false)
    const [mockRequest, setMockRequest] = useState<RestRequestResponse>(defaultMockRequest)
    const [mutatedOutputRequest, setMutatedOutputRequest] = useState<RestRequestResponse | null>(null)

    useEffect(() => setScript(preScript), [preScript])

    const completionSources = useMemo(() => [pmCompletionSource, resCompletionSource, jsCompletionSource, cryptoJsCompletionSource], [])
    const scriptDiagnostic = useMemo(() => getJavaScriptDiagnostic(script), [script])
    const scriptLinter = useMemo(() => linter((view) => {
        const diagnostic = getJavaScriptDiagnostic(view.state.doc.toString())
        return diagnostic ? [diagnostic] : []
    }, {delay: 200}), [])
    const scriptExtensions = useMemo(() => [scriptLinter], [scriptLinter])

    const handleSave = () => {
        if (!collection?.version) return
        updatePreScriptMutation.mutate({baseVersion: collection.version, script})
    }

    const handleRun = async () => {
        if (!script.trim() || isRunning) return
        setIsRunning(true)
        setRunError(null)
        setShowOutput(true)
        setMutatedOutputRequest(null)
        try {
            const varMap: Record<string, string> = {}
            for (const variable of variables) varMap[variable.key] = variable.value

            const output = await runPreRequestScript({
                script,
                request: mockRequest,
                variables: varMap,
            })

            setRunResult(typeof output.result === "string" ? output.result : JSON.stringify(output.result, null, 2))
            setRunLogs(output.logs)
            setRunMutations(output.mutations)
            setMutatedOutputRequest(output.request)
        } catch (err: unknown) {
            setRunError(err instanceof Error ? err.message : "Unknown error")
            setRunResult("")
            setRunLogs([])
            setRunMutations({})
            setMutatedOutputRequest(null)
        } finally {
            setIsRunning(false)
        }
    }

    const handleAddHeader = () => {
        setMockRequest(prev => ({
            ...prev,
            headers: [...(prev.headers || []), { id: crypto.randomUUID(), key: "", value: "" }]
        }))
    }

    const handleUpdateHeader = (index: number, field: "key" | "value", value: string) => {
        setMockRequest(prev => {
            const nextHeaders = [...(prev.headers || [])]
            if (nextHeaders[index]) {
                nextHeaders[index] = { ...nextHeaders[index], [field]: value }
            }
            return { ...prev, headers: nextHeaders }
        })
    }

    const handleRemoveHeader = (index: number) => {
        setMockRequest(prev => ({
            ...prev,
            headers: (prev.headers || []).filter((_, i) => i !== index)
        }))
    }

    const handleResetMock = () => {
        setMockRequest(defaultMockRequest)
    }

    return (
        <div className="flex flex-col min-h-0 h-full">
            {isExpanded && (
                <div className="flex items-center justify-between shrink-0 mb-2 px-1">
                    <span className="text-sm font-medium text-foreground">Collection Pre-request Script</span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCollapse}>
                        <Minimize2 className="h-4 w-4"/>
                    </Button>
                </div>
            )}
            <div className="flex items-center gap-2 shrink-0 mb-2">
                <Button variant="outline" size="sm" disabled={updatePreScriptMutation.isPending || !collection?.version} onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1"/> Save
                </Button>
                <Button variant="outline" size="sm" disabled={isRunning || !script.trim()} onClick={handleRun}>
                    <Play className="h-4 w-4 mr-1"/> Run
                </Button>
                <Button
                    variant={isMockOpen ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setIsMockOpen(!isMockOpen)}
                    title="Configure mock request variable for testing"
                >
                    <SlidersHorizontal className="h-4 w-4 mr-1"/> Mock Request
                </Button>
                {!isExpanded && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto" onClick={onExpand}>
                        <Maximize2 className="h-4 w-4"/>
                    </Button>
                )}
            </div>

            <div className="flex flex-1 min-h-0 gap-3">
                {/* Main Script Column */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                    <div className={cn("min-h-0 rounded-lg border border-border overflow-hidden", isExpanded ? "flex-1" : "flex-[1_0_260px]")}>
                        <SandpackScriptEditor
                            value={script}
                            onChange={setScript}
                            fileName="script.js"
                            showSearch={true}
                            theme="dark"
                            dependencies={SCRIPT_DEPENDENCIES}
                            autoComplete={completionSources}
                            extensions={scriptExtensions}
                            className="h-full"
                        />
                    </div>
                    {scriptDiagnostic && (
                        <p role="alert" className="mt-2 shrink-0 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                            Invalid JavaScript: {scriptDiagnostic.message}
                        </p>
                    )}
                    {showOutput && (
                        <div className={cn("shrink-0 overflow-auto rounded-lg border border-border mt-2", isExpanded ? "flex-[0_0_220px]" : "flex-[0_0_190px]")}>
                            <div className="px-3 py-1.5 bg-muted text-xs font-medium text-muted-foreground flex items-center justify-between">
                                <span>Output</span>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setShowOutput(false)}>
                                    <Trash2 className="h-3 w-3"/>
                                </Button>
                            </div>
                            <div className="p-3 space-y-2 text-xs font-mono">
                                {isRunning && <div className="text-muted-foreground">Running pre-request script...</div>}
                                {runError && <div className="text-red-500 whitespace-pre-wrap">{runError}</div>}
                                {runResult && !runError && (
                                    <div>
                                        <div className="text-muted-foreground mb-1">Result:</div>
                                        <pre className="text-foreground whitespace-pre-wrap bg-muted/40 p-2 rounded">{runResult}</pre>
                                    </div>
                                )}
                                {Object.keys(runMutations).length > 0 && (
                                    <div>
                                        <div className="text-muted-foreground mb-1">Variable Mutations:</div>
                                        {Object.entries(runMutations).map(([key, value]) => (
                                            <div key={key} className="flex gap-2">
                                                <span className="text-foreground">{key}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="text-emerald-400">{value ?? "(deleted)"}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {mutatedOutputRequest && (
                                    <div className="pt-2 border-t border-border">
                                        <div className="text-muted-foreground mb-1 font-semibold text-emerald-400">Mutated Request Payload:</div>
                                        <div className="bg-muted/40 p-2 rounded space-y-1">
                                            <div><span className="text-muted-foreground">Method: </span><span className="font-semibold text-foreground">{mutatedOutputRequest.method}</span></div>
                                            <div><span className="text-muted-foreground">URL: </span><span className="text-blue-400 break-all">{mutatedOutputRequest.url?.raw}</span></div>
                                            {mutatedOutputRequest.headers && mutatedOutputRequest.headers.length > 0 && (
                                                <div>
                                                    <span className="text-muted-foreground">Headers ({mutatedOutputRequest.headers.length}):</span>
                                                    <div className="pl-2 space-y-0.5 mt-0.5">
                                                        {mutatedOutputRequest.headers.map((h, idx) => (
                                                            <div key={idx}><span className="text-slate-400">{h.key}:</span> <span className="text-foreground">{h.value}</span></div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {mutatedOutputRequest.body?.raw && (
                                                <div>
                                                    <span className="text-muted-foreground">Body:</span>
                                                    <pre className="text-foreground whitespace-pre-wrap text-[11px] max-h-24 overflow-auto pl-2">{mutatedOutputRequest.body.raw}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {runLogs.map((log, index) => {
                                    const colors: Record<string, string> = {error: "text-red-400", warn: "text-amber-400", info: "text-blue-400", log: "text-foreground"}
                                    return (
                                        <div key={index} className="flex gap-2">
                                            <span className={cn("shrink-0", colors[log.type] ?? "text-muted-foreground")}>[{log.type}]</span>
                                            <span className="text-foreground break-all">{log.message}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Collapsible Mock Request Form Column */}
                {isMockOpen && (
                    <div className="w-80 shrink-0 border border-border rounded-lg bg-card flex flex-col min-h-0 overflow-hidden text-xs">
                        <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center justify-between shrink-0">
                            <span className="font-semibold flex items-center gap-1.5 text-foreground">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-primary"/> Mock Request Variable
                            </span>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" title="Reset mock request" onClick={handleResetMock}>
                                    <RotateCcw className="h-3.5 w-3.5"/>
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setIsMockOpen(false)}>
                                    <X className="h-3.5 w-3.5"/>
                                </Button>
                            </div>
                        </div>

                        <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
                            {/* Method */}
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Method</label>
                                <Select
                                    value={mockRequest.method}
                                    onValueChange={(value) => setMockRequest(prev => ({ ...prev, method: value }))}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="Method"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GET">GET</SelectItem>
                                        <SelectItem value="POST">POST</SelectItem>
                                        <SelectItem value="PUT">PUT</SelectItem>
                                        <SelectItem value="PATCH">PATCH</SelectItem>
                                        <SelectItem value="DELETE">DELETE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Raw URL */}
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">URL (request.url.raw)</label>
                                <Input
                                    value={mockRequest.url?.raw ?? ""}
                                    onChange={(e) => setMockRequest(prev => ({
                                        ...prev,
                                        url: { ...(prev.url ?? { host: [], path: [], query: [] }), raw: e.target.value }
                                    }))}
                                    placeholder="https://api.example.com/users"
                                    className="h-7 text-xs font-mono"
                                />
                            </div>

                            {/* Headers */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-medium text-muted-foreground">Headers (request.headers)</label>
                                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={handleAddHeader}>
                                        <Plus className="h-3 w-3 mr-0.5"/> Add
                                    </Button>
                                </div>
                                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                    {(mockRequest.headers || []).map((h, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            <Input
                                                value={h.key}
                                                onChange={(e) => handleUpdateHeader(i, "key", e.target.value)}
                                                placeholder="Key"
                                                className="h-6 text-xs px-1.5 font-mono flex-1"
                                            />
                                            <Input
                                                value={h.value}
                                                onChange={(e) => handleUpdateHeader(i, "value", e.target.value)}
                                                placeholder="Value"
                                                className="h-6 text-xs px-1.5 font-mono flex-1"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                                                onClick={() => handleRemoveHeader(i)}
                                            >
                                                <Trash2 className="h-3 w-3"/>
                                            </Button>
                                        </div>
                                    ))}
                                    {(mockRequest.headers || []).length === 0 && (
                                        <div className="text-[11px] text-muted-foreground italic text-center py-2">
                                            No headers configured
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Body */}
                            <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1">Body (request.body.raw)</label>
                                <Textarea
                                    value={mockRequest.body?.raw ?? ""}
                                    onChange={(e) => setMockRequest(prev => ({
                                        ...prev,
                                        body: { mode: "raw", raw: e.target.value }
                                    }))}
                                    placeholder='{\n  "key": "value"\n}'
                                    className="text-xs font-mono min-h-[90px] h-28"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ScriptManage
