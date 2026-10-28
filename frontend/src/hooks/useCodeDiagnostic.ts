import { useMemo } from "react"
import { linter } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import type { CodeDiagnostic, CodeDiagnosticOptions } from "@/types/codeEditor"

export function getJavaScriptDiagnostic(
    value: string,
    globals: string[] = ["response", "pm"]
): CodeDiagnostic | null {
    if (!value.trim()) return null

    try {
        new Function(...globals, value)
        return null
    } catch (error) {
        let err = error
        if (err instanceof SyntaxError && /await/i.test(err.message)) {
            try {
                new Function(...globals, `(async () => {\n${value}\n})`)
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

export function getJsonDiagnostic(value: string): CodeDiagnostic | null {
    if (!value.trim()) return null

    try {
        JSON.parse(value)
        return null
    } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON"
        const positionMatch = /position (\d+)/i.exec(message)
        const position = positionMatch ? Number(positionMatch[1]) : value.length - 1
        const from = Math.min(position, Math.max(value.length - 1, 0))

        return {
            from,
            to: Math.min(from + 1, value.length),
            severity: "error",
            message,
        }
    }
}

export function useCodeDiagnostic(
    value: string,
    options: CodeDiagnosticOptions
): {
    diagnostic: CodeDiagnostic | null
    linterExtension: Extension
} {
    const { language, globals, delay = 200 } = options
    const globalsKey = globals ? globals.join(",") : "response,pm"

    const stableGlobals = useMemo(
        () => (globalsKey ? globalsKey.split(",") : ["response", "pm"]),
        [globalsKey]
    )

    const diagnostic = useMemo(() => {
        return language === "json"
            ? getJsonDiagnostic(value)
            : getJavaScriptDiagnostic(value, stableGlobals)
    }, [language, stableGlobals, value])

    const linterExtension = useMemo(() => {
        return linter(
            (view) => {
                const docText = view.state.doc.toString()
                const diag =
                    language === "json"
                        ? getJsonDiagnostic(docText)
                        : getJavaScriptDiagnostic(docText, stableGlobals)
                return diag ? [diag] : []
            },
            { delay }
        )
    }, [delay, language, stableGlobals])

    return { diagnostic, linterExtension }
}
