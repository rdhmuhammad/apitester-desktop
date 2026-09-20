import {useEffect, useMemo, useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {cn} from "@/lib/utils.ts";
import {Maximize2, Minimize2, Play, Save, Trash2} from "lucide-react";
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx";
import {runScript} from "@/layout/hooks/useScriptRunner.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import type {ScriptLog, SendResponse} from "@/types/response.ts";
import {pmCompletionSource, resCompletionSource} from "@/lib/pmCompletions.ts";
import {jsCompletionSource} from "@/lib/jsCompletions.ts";
import {linter} from "@codemirror/lint";
import {getJavaScriptDiagnostic} from "@/pages/editor/components/RequestConfig/ScriptEditor.tsx";

interface ScriptManageProps {
    isExpanded: boolean
    onExpand: () => void
    onCollapse: () => void
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

    useEffect(() => setScript(preScript), [preScript])

    const completionSources = useMemo(() => [pmCompletionSource, resCompletionSource, jsCompletionSource], [])

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
        try {
            const varMap: Record<string, string> = {}
            for (const variable of variables) varMap[variable.key] = variable.value
            const response: SendResponse = {
                rawRequest: "", responseTime: 0, responseSize: "0", protocol: "",
                statusCode: 0, statusText: "", data: {},
            }
            const output = await runScript({script, response, variables: varMap})
            setRunResult(typeof output.result === "string" ? output.result : JSON.stringify(output.result, null, 2))
            setRunLogs(output.logs)
            setRunMutations(output.mutations)
        } catch (err: unknown) {
            setRunError(err instanceof Error ? err.message : "Unknown error")
            setRunResult("")
            setRunLogs([])
            setRunMutations({})
        } finally {
            setIsRunning(false)
        }
    }

    return <div className="flex flex-col min-h-0 h-full">
        {isExpanded && <div className="flex items-center justify-between shrink-0 mb-2 px-1">
            <span className="text-sm font-medium text-foreground">Collection Pre-request Script</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCollapse}>
                <Minimize2 className="h-4 w-4"/>
            </Button>
        </div>}
        <div className="flex items-center gap-2 shrink-0 mb-2">
            <Button variant="outline" size="sm" disabled={updatePreScriptMutation.isPending || !collection?.version} onClick={handleSave}>
                <Save className="h-4 w-4 mr-1"/> Save
            </Button>
            <Button variant="outline" size="sm" disabled={isRunning || !script.trim()} onClick={handleRun}>
                <Play className="h-4 w-4 mr-1"/> Run
            </Button>
            {!isExpanded && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-auto" onClick={onExpand}>
                <Maximize2 className="h-4 w-4"/>
            </Button>}
        </div>
        <div className={cn("min-h-0 rounded-lg border border-border overflow-hidden", isExpanded ? "flex-1" : "flex-[1_0_280px]")}>
            <SandpackScriptEditor
                value={script}
                onChange={setScript}
                fileName="script.js"
                theme="dark"
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
        {showOutput && <div className={cn("shrink-0 overflow-auto rounded-lg border border-border mt-2", isExpanded ? "flex-[0_0_200px]" : "flex-[0_0_180px]")}>
            <div className="px-3 py-1.5 bg-muted text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Output</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setShowOutput(false)}>
                    <Trash2 className="h-3 w-3"/>
                </Button>
            </div>
            <div className="p-3 space-y-2 text-xs font-mono">
                {isRunning && <div className="text-muted-foreground">Running...</div>}
                {runError && <div className="text-red-500 whitespace-pre-wrap">{runError}</div>}
                {runResult && !runError && <div><div className="text-muted-foreground mb-1">Result:</div><pre className="text-foreground whitespace-pre-wrap">{runResult}</pre></div>}
                {Object.keys(runMutations).length > 0 && <div>
                    <div className="text-muted-foreground mb-1">Mutations:</div>
                    {Object.entries(runMutations).map(([key, value]) => <div key={key} className="flex gap-2">
                        <span className="text-foreground">{key}</span><span className="text-muted-foreground">→</span><span className="text-foreground">{value ?? "(deleted)"}</span>
                    </div>)}
                </div>}
                {runLogs.map((log, index) => {
                    const colors: Record<string, string> = {error: "text-red-400", warn: "text-amber-400", info: "text-blue-400", log: "text-foreground"}
                    return <div key={index} className="flex gap-2"><span className={cn("shrink-0", colors[log.type] ?? "text-muted-foreground")}>[{log.type}]</span><span className="text-foreground break-all">{log.message}</span></div>
                })}
            </div>
        </div>}
    </div>
}

export default ScriptManage
