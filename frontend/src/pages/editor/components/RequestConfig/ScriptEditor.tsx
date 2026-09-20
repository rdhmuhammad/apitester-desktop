import React, { useMemo, useState, useEffect } from "react"
import { SandpackScriptEditor } from "@/components/ui/sandpack-script-editor"
import { pmCompletionSource, resCompletionSource } from "@/lib/pmCompletions"
import { jsCompletionSource } from "@/lib/jsCompletions"
import { useDebouncedCallback } from "use-debounce"
import { useAppSelector } from "@/app/store/hooks.ts"
import { selectEditorActiveTabId, selectCollectionId } from "@/app/slices/editorTabsSlice.ts"
import { useRequestConfig } from "@/pages/editor/hooks/useRequestConfig.ts"
import { linter, type Diagnostic } from "@codemirror/lint"

interface ScriptEditorProps {
    value?: string
    onChange?: (value: string) => void
}

export const getJavaScriptDiagnostic = (value: string): Diagnostic | null => {
    if (!value.trim()) return null

    try {
        new Function("response", "pm", value)
        return null
    } catch (error) {
        let err = error
        if (err instanceof SyntaxError && /await/i.test(err.message)) {
            try {
                new Function("response", "pm", `(async () => {\n${value}\n})`)
                return null
            } catch (asyncError) {
                err = asyncError
            }
        }

        const message = err instanceof Error ? err.message : "Invalid JavaScript"
        const positionMatch = /position (\d+)/i.exec(message)
        const lineMatch = /line (\d+)/i.exec(message)
        const tokenMatch = /Unexpected (?:token|identifier)\s+['"]?([^'"\s]+)['"]?/i.exec(message)

        let from = 0
        if (positionMatch) {
            const position = Number(positionMatch[1])
            from = Math.min(position, Math.max(value.length - 1, 0))
        } else if (lineMatch) {
            const lineNum = Number(lineMatch[1])
            const lines = value.split("\n")
            let charCount = 0
            for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
                charCount += lines[i].length + 1
            }
            from = Math.min(charCount, Math.max(value.length - 1, 0))
        } else if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1]
            const idx = value.lastIndexOf(token)
            from = idx !== -1 ? idx : Math.max(value.length - 1, 0)
        } else {
            from = Math.max(value.length - 1, 0)
        }

        return {
            from,
            to: Math.min(from + 1, value.length),
            severity: "error",
            message,
        }
    }
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({value: propValue, onChange: propOnChange}) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const collectionId = useAppSelector(selectCollectionId)
    const { request, saveScript } = useRequestConfig(collectionId ?? "", activeTabId)

    const completionSources = useMemo(() => [pmCompletionSource, resCompletionSource, jsCompletionSource], [])

    const currentValue = propValue !== undefined ? propValue : (request?.script ?? "")
    const saveTrigger = propOnChange ?? saveScript

    const [editorValue, setEditorValue] = useState(currentValue)

    useEffect(() => {
        setEditorValue(currentValue)
    }, [currentValue])

    const scriptDiagnostic = useMemo(() => getJavaScriptDiagnostic(editorValue), [editorValue])

    const scriptLinter = useMemo(() => linter((view) => {
        const diagnostic = getJavaScriptDiagnostic(view.state.doc.toString())
        return diagnostic ? [diagnostic] : []
    }, {delay: 200}), [])

    const scriptExtensions = useMemo(() => [scriptLinter], [scriptLinter])

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
                    autoComplete={completionSources}
                    extensions={scriptExtensions}
                    className="h-full"
                />
            </div>
            {scriptDiagnostic && (
                <p role="alert" className="mt-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    Invalid JavaScript: {scriptDiagnostic.message}
                </p>
            )}
        </div>
    )
}

export default ScriptEditor
