import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    useSandpack,
    type CodeEditorRef,
    type SandpackThemeProp,
} from "@codesandbox/sandpack-react"
import { autocompletion, completionKeymap, type CompletionSource } from "@codemirror/autocomplete"
import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { yaml } from "@codemirror/lang-yaml"
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"

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
}

const darkAutocompleteTheme = EditorView.theme({
    ".cm-tooltip": {
        backgroundColor: "#18181b !important",
        border: "1px solid #3f3f46 !important",
        color: "#f4f4f5 !important",
        borderRadius: "6px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        borderRadius: "6px",
        overflow: "hidden",
        "& > ul": {
            fontFamily: "var(--font-mono, monospace)",
            padding: "4px 0",
            maxHeight: "16em",
            minWidth: "260px",
            scrollbarWidth: "thin",
            scrollbarColor: "#3f3f46 transparent",
        },
        "& > ul > li": {
            padding: "5px 10px",
            lineHeight: "1.4",
            color: "#e4e4e7",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
        },
        "& > ul > li[aria-selected]": {
            backgroundColor: "#2563eb !important",
            color: "#ffffff !important",
        },
        "& > ul > li:hover:not([aria-selected])": {
            backgroundColor: "#27272a !important",
        },
        "& > ul > completion-section": {
            borderBottom: "1px solid #3f3f46",
            color: "#a1a1aa",
            fontSize: "11px",
            padding: "4px 8px",
            opacity: "0.8",
        },
    },
    ".cm-completionMatchedText": {
        color: "#60a5fa !important",
        textDecoration: "underline",
        fontWeight: "600",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText": {
        color: "#ffffff !important",
        textDecoration: "underline",
        fontWeight: "700",
    },
    ".cm-completionDetail": {
        color: "#a1a1aa",
        fontStyle: "italic",
        marginLeft: "auto",
        fontSize: "11px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail": {
        color: "#dbeafe !important",
    },
    ".cm-completionIcon": {
        opacity: "0.85",
        width: "1.2em",
        display: "inline-block",
        textAlign: "center",
        marginRight: "4px",
        fontSize: "12px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionIcon": {
        color: "#ffffff !important",
        opacity: "1",
    },
    ".cm-completionIcon-function, .cm-completionIcon-method": {
        color: "#a78bfa",
    },
    ".cm-completionIcon-variable, .cm-completionIcon-property": {
        color: "#38bdf8",
    },
    ".cm-completionIcon-keyword": {
        color: "#f472b6",
    },
    ".cm-completionIcon-class, .cm-completionIcon-interface": {
        color: "#fbbf24",
    },
    ".cm-completionIcon-constant": {
        color: "#34d399",
    },
    ".cm-completionIcon-type": {
        color: "#818cf8",
    },
    ".cm-tooltip.cm-completionInfo": {
        backgroundColor: "#18181b !important",
        border: "1px solid #3f3f46 !important",
        color: "#f4f4f5 !important",
        borderRadius: "6px",
        padding: "8px 12px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6)",
        fontSize: "12px",
        lineHeight: "1.5",
    },
}, { dark: true })

const lightAutocompleteTheme = EditorView.theme({
    ".cm-tooltip": {
        backgroundColor: "#ffffff !important",
        border: "1px solid #e2e8f0 !important",
        color: "#0f172a !important",
        borderRadius: "6px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        borderRadius: "6px",
        overflow: "hidden",
        "& > ul": {
            fontFamily: "var(--font-mono, monospace)",
            padding: "4px 0",
            maxHeight: "16em",
            minWidth: "260px",
            scrollbarWidth: "thin",
            scrollbarColor: "#cbd5e1 transparent",
        },
        "& > ul > li": {
            padding: "5px 10px",
            lineHeight: "1.4",
            color: "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
        },
        "& > ul > li[aria-selected]": {
            backgroundColor: "#2563eb !important",
            color: "#ffffff !important",
        },
        "& > ul > li:hover:not([aria-selected])": {
            backgroundColor: "#f1f5f9 !important",
        },
        "& > ul > completion-section": {
            borderBottom: "1px solid #e2e8f0",
            color: "#64748b",
            fontSize: "11px",
            padding: "4px 8px",
            opacity: "0.8",
        },
    },
    ".cm-completionMatchedText": {
        color: "#2563eb !important",
        textDecoration: "underline",
        fontWeight: "600",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText": {
        color: "#ffffff !important",
        textDecoration: "underline",
        fontWeight: "700",
    },
    ".cm-completionDetail": {
        color: "#64748b",
        fontStyle: "italic",
        marginLeft: "auto",
        fontSize: "11px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail": {
        color: "#dbeafe !important",
    },
    ".cm-completionIcon": {
        opacity: "0.85",
        width: "1.2em",
        display: "inline-block",
        textAlign: "center",
        marginRight: "4px",
        fontSize: "12px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionIcon": {
        color: "#ffffff !important",
        opacity: "1",
    },
    ".cm-tooltip.cm-completionInfo": {
        backgroundColor: "#ffffff !important",
        border: "1px solid #e2e8f0 !important",
        color: "#0f172a !important",
        borderRadius: "6px",
        padding: "8px 12px",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        fontSize: "12px",
        lineHeight: "1.5",
    },
}, { dark: false })

function SyncScript({ value, onChange, fileName }: {
    value: string
    onChange: (code: string) => void
    fileName: string
}) {
    const { sandpack } = useSandpack()
    const filePath = `/${fileName}`
    const code = sandpack.files[filePath]?.code
    const lastCodeRef = useRef(code ?? "")
    const previousValueRef = useRef(value)
    const onChangeRef = useRef(onChange)
    const updateFileRef = useRef(sandpack.updateFile)
    onChangeRef.current = onChange
    updateFileRef.current = sandpack.updateFile

    useEffect(() => {
        if (code !== undefined && code !== lastCodeRef.current) {
            lastCodeRef.current = code
            onChangeRef.current(code)
        }
    }, [code])

    useEffect(() => {
        if (value === previousValueRef.current) return

        previousValueRef.current = value
        if (value === code) return

        lastCodeRef.current = value
        updateFileRef.current(filePath, value)
    }, [code, filePath, value])

    return null
}

const SandpackScriptEditorInstance: React.FC<SandpackScriptEditorProps> = ({
                                                                               value,
                                                                               onChange,
                                                                                readOnly,
                                                                                showReadOnly,
                                                                                showLineNumbers = true,
                                                                                editorKey,
                                                                                autoComplete = false,
                                                                                completionSources = [],
                                                                                fileName = "index.js",
                                                                                extensions = [],
                                                                                className,
                                                                                theme,
                                                                                onSelectionContextMenu,
                                                                            }) => {
    const entryFile = "/__apitester_entry__.js"
    const editorRef = useRef<CodeEditorRef | null>(null)
    // Sandpack resets its file state when these prop identities change.
    const [files] = useState(() => ({
        [`/${fileName}`]: { code: value, active: true },
        [entryFile]: { code: "export default {};", hidden: true },
    }))
    const customSetup = useMemo(() => ({entry: entryFile}), [entryFile])
    const providerOptions = useMemo(() => ({
        autorun: false,
        activeFile: `/${fileName}`,
        visibleFiles: [`/${fileName}`],
    }), [fileName])

    const yamlLanguage = useMemo(() => {
        if (!/\.(ya?ml)$/i.test(fileName)) return undefined
        return yaml()
    }, [fileName])

    const additionalLanguages = useMemo(() => {
        if (!yamlLanguage) return undefined
        return [{
            name: "yaml",
            extensions: ["yml", "yaml"],
            language: yamlLanguage,
        }]
    }, [yamlLanguage])

    const effectiveTheme: SandpackThemeProp = theme ?? "dark"
    const isDark = effectiveTheme !== "light"
    const themeExtension = useMemo(() => isDark ? darkAutocompleteTheme : lightAutocompleteTheme, [isDark])

    const languageExtensions = useMemo(() => {
        const result: Extension[] = [themeExtension, ...extensions]
        if (yamlLanguage) {
            if (completionSources.length > 0) {
                result.unshift(yamlLanguage.language.data.of({autocomplete: completionSources}))
            }
        }
        return result
    }, [completionSources, extensions, themeExtension, yamlLanguage])

    const editorExtensions = useMemo(() => {
        if (!autoComplete) return undefined
        // If autoComplete is an array of CompletionSource[], use them as overrides
        if (Array.isArray(autoComplete)) {
            return {
                extensions: [autocompletion({ override: autoComplete }), ...languageExtensions],
                extensionsKeymap: completionKeymap.slice(),
            }
        }
        // autoComplete === true: enable autocompletion with no custom overrides
        return {
            extensions: [autocompletion(), ...languageExtensions],
            extensionsKeymap: completionKeymap.slice(),
        }
    }, [autoComplete, languageExtensions])

    const handleContextMenu = (event: ReactMouseEvent) => {
        if (!onSelectionContextMenu) return

        const editor = editorRef.current?.getCodemirror()
        if (!editor) return

        const {from, to} = editor.state.selection.main
        const selectedText = editor.state.sliceDoc(from, to)
        if (!selectedText) return

        event.preventDefault()
        onSelectionContextMenu(selectedText, {x: event.clientX, y: event.clientY})
    }



    return (
        <SandpackProvider
            key={editorKey}
            files={files}
            theme={effectiveTheme}
            style={className ? {height: "100%"} : undefined}
            customSetup={customSetup}
            options={providerOptions}
        >
            <SyncScript value={value} onChange={onChange} fileName={fileName} />
            <SandpackLayout className={className} onContextMenu={handleContextMenu}>
                <SandpackCodeEditor
                    ref={editorRef}
                    className={className}
                    style={className ? {height: "100%"} : undefined}
                    showTabs={false}
                    showLineNumbers={showLineNumbers}
                    showRunButton={false}
                    wrapContent
                    readOnly={readOnly}
                    showReadOnly={showReadOnly}
                    additionalLanguages={additionalLanguages}
                    {...editorExtensions}
                    extensions={editorExtensions?.extensions ?? languageExtensions}
                />
            </SandpackLayout>
        </SandpackProvider>
    )
}

export const SandpackScriptEditor: React.FC<SandpackScriptEditorProps> = ({ theme = "dark", ...props }) => (
    <SandpackScriptEditorInstance
        key={`${props.editorKey ?? ""}:${props.fileName ?? "index.js"}:${theme}`}
        theme={theme}
        {...props}
    />
)
