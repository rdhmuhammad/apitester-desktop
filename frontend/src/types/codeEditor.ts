import type { Completion, CompletionSource } from "@codemirror/autocomplete"
import type { Diagnostic } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import type { SandpackThemeProp } from "@codesandbox/sandpack-react"

export interface CompletionNode {
    label: string
    detail: string
    type?: Completion["type"]
    apply?: string
    boost?: number
    children?: CompletionNode[]
}

export interface ChainPatternSchema {
    /** Regex string matching the root chain invocation, e.g. `pm\\.expect\\([^)]*\\)` */
    invocationPattern: string
    members: CompletionNode[]
}

export interface CompletionNamespaceSchema {
    root: string
    detail: string
    type?: Completion["type"]
    boost?: number
    topLevelPattern?: RegExp
    allowIndexAccess?: boolean
    members: CompletionNode[]
    chainPatterns?: ChainPatternSchema[]
}

export type ScriptCompletionPreset = "prerequest" | "postrequest" | "none"

export type CodeDiagnosticLanguage = "javascript" | "json"

export interface CodeDiagnosticOptions {
    language: CodeDiagnosticLanguage
    globals?: string[]
    delay?: number
}

export type CodeDiagnostic = Diagnostic

export interface SandpackScriptEditorProps {
    value: string
    onChange: (code: string) => void
    readOnly?: boolean
    showReadOnly?: boolean
    showLineNumbers?: boolean
    editorKey?: string
    autoComplete?: boolean | CompletionSource[]
    completionSources?: CompletionSource[]
    fileName?: string
    extensions?: Extension[]
    className?: string
    theme?: SandpackThemeProp
    onSelectionContextMenu?: (selectedText: string, position: { x: number; y: number }) => void
    showSearch?: boolean
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    extraFiles?: Record<string, string | { code: string; hidden?: boolean; active?: boolean }>
    diagnostic?: CodeDiagnostic | null
    diagnosticPrefix?: string
}

export interface EditorThemePalette {
    isDark: boolean
    bg: string
    bgMuted: string
    bgField: string
    border: string
    borderMuted: string
    text: string
    textMuted: string
    textItem: string
    scrollbar: string
    matchText: string
    shadow: string
    activeButtonBg: string
    iconFunction: string
    iconVariable: string
    iconKeyword: string
    iconClass: string
    iconConstant: string
    iconType: string
    searchMatchBg: string
    searchMatchOutline: string
    searchMatchSelectedBg: string
    searchMatchSelectedOutline: string
    selectionMatchBg: string
}

export const DARK_EDITOR_PALETTE: EditorThemePalette = {
    isDark: true,
    bg: "#18181b",
    bgMuted: "#27272a",
    bgField: "#27272a",
    border: "#3f3f46",
    borderMuted: "#27272a",
    text: "#f4f4f5",
    textMuted: "#a1a1aa",
    textItem: "#e4e4e7",
    scrollbar: "#3f3f46 transparent",
    matchText: "#60a5fa",
    shadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
    activeButtonBg: "#52525b",
    iconFunction: "#a78bfa",
    iconVariable: "#38bdf8",
    iconKeyword: "#f472b6",
    iconClass: "#fbbf24",
    iconConstant: "#34d399",
    iconType: "#818cf8",
    searchMatchBg: "rgba(234, 179, 8, 0.35)",
    searchMatchOutline: "1px solid rgba(234, 179, 8, 0.6)",
    searchMatchSelectedBg: "rgba(249, 115, 22, 0.55)",
    searchMatchSelectedOutline: "1px solid rgba(249, 115, 22, 0.9)",
    selectionMatchBg: "rgba(59, 130, 246, 0.25)",
}

export const LIGHT_EDITOR_PALETTE: EditorThemePalette = {
    isDark: false,
    bg: "#ffffff",
    bgMuted: "#f1f5f9",
    bgField: "#f8fafc",
    border: "#e2e8f0",
    borderMuted: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#64748b",
    textItem: "#334155",
    scrollbar: "#cbd5e1 transparent",
    matchText: "#2563eb",
    shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    activeButtonBg: "#cbd5e1",
    iconFunction: "#7c3aed",
    iconVariable: "#0284c7",
    iconKeyword: "#db2777",
    iconClass: "#d97706",
    iconConstant: "#059669",
    iconType: "#4f46e5",
    searchMatchBg: "rgba(234, 179, 8, 0.4)",
    searchMatchOutline: "1px solid rgba(234, 179, 8, 0.7)",
    searchMatchSelectedBg: "rgba(249, 115, 22, 0.5)",
    searchMatchSelectedOutline: "1px solid rgba(249, 115, 22, 0.8)",
    selectionMatchBg: "rgba(59, 130, 246, 0.2)",
}

export const SCRIPT_DEPENDENCIES: Record<string, string> = {
    "crypto-js": "^4.2.0",
}
