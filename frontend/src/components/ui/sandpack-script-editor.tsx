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

    const languageExtensions = useMemo(() => {
        const result: Extension[] = [...extensions]
        if (yamlLanguage) {
            if (completionSources.length > 0) {
                result.unshift(yamlLanguage.language.data.of({autocomplete: completionSources}))
            }
        }
        return result
    }, [completionSources, extensions, yamlLanguage])

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
            theme={theme}
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

export const SandpackScriptEditor: React.FC<SandpackScriptEditorProps> = (props) => (
    <SandpackScriptEditorInstance
        key={`${props.editorKey ?? ""}:${props.fileName ?? "index.js"}`}
        {...props}
    />
)
