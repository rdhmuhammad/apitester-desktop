import React, { useMemo } from "react"
import { SandpackScriptEditor } from "@/components/ui/sandpack-script-editor"
import { pmCompletionSource, resCompletionSource } from "@/lib/pmCompletions"

interface ScriptEditorProps {
    value: string
    onChange: (value: string) => void
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({value, onChange}) => {
    const completionSources = useMemo(() => [pmCompletionSource, resCompletionSource], [])

    return (
        <div className="h-[280px] min-h-[280px] resize-y overflow-hidden rounded-lg border border-slate-200">
            <SandpackScriptEditor
                value={value}
                onChange={onChange}
                autoComplete={completionSources}
                className="h-full"
            />
        </div>
    )
}

export default ScriptEditor
