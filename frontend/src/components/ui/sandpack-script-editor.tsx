import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    type CodeEditorRef,
} from "@codesandbox/sandpack-react"
import { openSearchPanel, closeSearchPanel, searchPanelOpen } from "@codemirror/search"
import {
    useMemo,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { Search } from "lucide-react"
import type { SandpackScriptEditorProps } from "@/types/codeEditor"
import { useSandpackEditorExtensions, useSandpackFileSync } from "@/hooks/useSandpackEditor"

export type { SandpackScriptEditorProps }

function SyncScript({
    value,
    onChange,
    fileName,
}: {
    value: string
    onChange: (code: string) => void
    fileName: string
}) {
    useSandpackFileSync(value, onChange, fileName)
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
    showSearch = true,
    dependencies,
    devDependencies,
    extraFiles,
}) => {
    const entryFile = "/__apitester_entry__.js"
    const editorRef = useRef<CodeEditorRef | null>(null)
    const [files] = useState(() => ({
        [`/${fileName}`]: { code: value, active: true },
        [entryFile]: { code: "export default {};", hidden: true },
        ...(extraFiles ?? {}),
    }))

    const customSetup = useMemo(
        () => ({
            entry: entryFile,
            ...(dependencies ? { dependencies } : {}),
            ...(devDependencies ? { devDependencies } : {}),
        }),
        [entryFile, dependencies, devDependencies]
    )

    const providerOptions = useMemo(
        () => ({
            autorun: false,
            activeFile: `/${fileName}`,
            visibleFiles: [`/${fileName}`],
        }),
        [fileName]
    )

    const {
        effectiveTheme,
        isSearchOpen,
        additionalLanguages,
        baseExtensions,
        editorExtensions,
    } = useSandpackEditorExtensions({
        fileName,
        theme,
        showSearch,
        autoComplete,
        completionSources,
        extensions,
    })

    const handleContextMenu = (event: ReactMouseEvent) => {
        if (!onSelectionContextMenu) return

        const editor = editorRef.current?.getCodemirror()
        if (!editor) return

        const { from, to } = editor.state.selection.main
        const selectedText = editor.state.sliceDoc(from, to)
        if (!selectedText) return

        event.preventDefault()
        onSelectionContextMenu(selectedText, { x: event.clientX, y: event.clientY })
    }

    const handleToggleSearch = () => {
        const editor = editorRef.current?.getCodemirror()
        if (!editor) return

        if (searchPanelOpen(editor.state)) {
            closeSearchPanel(editor)
        } else {
            openSearchPanel(editor)
        }
    }

    const handleKeyDown = (event: ReactKeyboardEvent) => {
        if (!showSearch) return
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
            const editor = editorRef.current?.getCodemirror()
            if (editor && !searchPanelOpen(editor.state)) {
                event.preventDefault()
                openSearchPanel(editor)
            }
        }
    }

    return (
        <SandpackProvider
            key={editorKey}
            files={files}
            theme={effectiveTheme}
            style={className ? { height: "100%" } : undefined}
            customSetup={customSetup}
            options={providerOptions}
        >
            <SyncScript value={value} onChange={onChange} fileName={fileName} />
            <SandpackLayout
                className={`relative ${className ?? ""}`}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
            >
                {showSearch && !isSearchOpen && (
                    <button
                        type="button"
                        onClick={handleToggleSearch}
                        title="Search (Ctrl+F)"
                        aria-label="Search code"
                        className="absolute top-2 right-2 z-10 flex items-center justify-center h-6 w-6 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted bg-background/80 backdrop-blur-xs border border-border/50 transition-all cursor-pointer shadow-xs opacity-70 hover:opacity-100"
                    >
                        <Search className="h-3.5 w-3.5" />
                    </button>
                )}
                <SandpackCodeEditor
                    ref={editorRef}
                    className={className}
                    style={className ? { height: "100%" } : undefined}
                    showTabs={false}
                    showLineNumbers={showLineNumbers}
                    showRunButton={false}
                    wrapContent
                    readOnly={readOnly}
                    showReadOnly={showReadOnly}
                    additionalLanguages={additionalLanguages}
                    {...editorExtensions}
                    extensions={editorExtensions?.extensions ?? baseExtensions}
                />
            </SandpackLayout>
        </SandpackProvider>
    )
}

export const SandpackScriptEditor: React.FC<SandpackScriptEditorProps> = ({
    theme = "dark",
    diagnostic,
    diagnosticPrefix = "Invalid JavaScript",
    ...props
}) => {
    const depsKey = useMemo(() => {
        if (!props.dependencies && !props.devDependencies) return ""
        const deps = Object.entries(props.dependencies ?? {})
            .sort()
            .map(([k, v]) => `${k}@${v}`)
            .join(",")
        const devDeps = Object.entries(props.devDependencies ?? {})
            .sort()
            .map(([k, v]) => `${k}@${v}`)
            .join(",")
        return `:${deps}:${devDeps}`
    }, [props.dependencies, props.devDependencies])

    return (
        <>
            <SandpackScriptEditorInstance
                key={`${props.editorKey ?? ""}:${props.fileName ?? "index.js"}:${theme}${depsKey}`}
                theme={theme}
                {...props}
            />
            {diagnostic && (
                <p
                    role="alert"
                    className="mt-2 shrink-0 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300"
                >
                    {diagnosticPrefix}: {diagnostic.message}
                </p>
            )}
        </>
    )
}
