import React, { useMemo, useState, useEffect } from "react"
import { SandpackScriptEditor } from "@/components/ui/sandpack-script-editor"
import { useCodeCompletions } from "@/hooks/useCodeCompletions"
import { getJavaScriptDiagnostic, useCodeDiagnostic } from "@/hooks/useCodeDiagnostic"
import { useDebouncedCallback } from "use-debounce"
import { useAppSelector } from "@/app/store/hooks.ts"
import { selectEditorActiveTabId } from "@/app/slices/editorTabsSlice.ts"
import { useRequestConfig } from "@/pages/editor/hooks/useRequestConfig.ts"
import { useCollection } from "@/layout/hooks/useCollection.ts"

export { getJavaScriptDiagnostic }

interface ScriptEditorProps {
    value?: string
    onChange?: (value: string) => void
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
    value: propValue,
    onChange: propOnChange,
}) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const { activeCollection } = useCollection()
    const { request, saveScript } = useRequestConfig(activeCollection?.id ?? "", activeTabId)

    const completionSources = useCodeCompletions("postrequest")

    const currentValue = propValue !== undefined ? propValue : (request?.script ?? "")
    const saveTrigger = propOnChange ?? saveScript

    const [editorValue, setEditorValue] = useState(currentValue)

    useEffect(() => {
        setEditorValue(currentValue)
    }, [currentValue])

    const { diagnostic: scriptDiagnostic, linterExtension } = useCodeDiagnostic(editorValue, {
        language: "javascript",
        globals: ["response", "pm"],
    })

    const scriptExtensions = useMemo(() => [linterExtension], [linterExtension])

    const debouncedSave = useDebouncedCallback((val: string) => {
        saveTrigger(val)
    }, 400)

    const handleChange = (val: string) => {
        setEditorValue(val)
        debouncedSave(val)
    }

    return (
        <div className="relative rounded-lg overflow-hidden">
            <div className="h-[280px] min-h-[280px] resize-y overflow-hidden rounded-lg border border-border">
                <SandpackScriptEditor
                    value={currentValue}
                    onChange={handleChange}
                    fileName="script.js"
                    theme="dark"
                    completionSources={completionSources}
                    extensions={scriptExtensions}
                    className="h-full"
                />
            </div>
            {scriptDiagnostic && (
                <p
                    role="alert"
                    className="mt-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300"
                >
                    Invalid JavaScript: {scriptDiagnostic.message}
                </p>
            )}
        </div>
    )
}

export default ScriptEditor
