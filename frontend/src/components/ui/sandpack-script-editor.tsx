import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    useSandpack,
} from "@codesandbox/sandpack-react"
import { autocompletion, completionKeymap, type CompletionSource } from "@codemirror/autocomplete"
import type { Extension } from "@codemirror/state"
import { yaml } from "@codemirror/lang-yaml"
import { useEffect, useMemo, useRef } from "react"

export interface SandpackScriptEditorProps {
    value: string
    onChange: (code: string) => void
    readOnly?: boolean
    editorKey?: string
    autoComplete?: boolean | CompletionSource[]
    completionSources?: CompletionSource[]
    fileName?: string
    extensions?: Extension[]
}

function SyncScript({ onChange, fileName }: { onChange: (code: string) => void; fileName: string }) {
    const { sandpack } = useSandpack()
    const filePath = `/${fileName}`
    const lastCodeRef = useRef(sandpack.files[filePath]?.code ?? "")
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    useEffect(() => {
        const code = sandpack.files[filePath]?.code
        if (code !== undefined && code !== lastCodeRef.current) {
            lastCodeRef.current = code
            onChangeRef.current(code)
        }
    }, [filePath, sandpack.files])

    return null
}

export const SandpackScriptEditor: React.FC<SandpackScriptEditorProps> = ({
                                                                              value,
                                                                              onChange,
                                                                               readOnly,
                                                                               editorKey,
                                                                               autoComplete = false,
                                                                               completionSources = [],
                                                                               fileName = "index.js",
                                                                               extensions = [],
                                                                           }) => {
    const entryFile = "/__apitester_entry__.js"
    const files = useMemo(() => ({
        [`/${fileName}`]: { code: value, active: true },
        [entryFile]: { code: "export default {};", hidden: true },
    }), [entryFile, fileName, value])

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
        if (autoComplete === true) return {
            extensions: [autocompletion(), ...languageExtensions],
            extensionsKeymap: completionKeymap.slice(),
        }
        return {
            extensions: [autocompletion({ override: autoComplete }), ...languageExtensions],
            extensionsKeymap: completionKeymap.slice(),
        }
    }, [autoComplete, languageExtensions])

    return (
        <SandpackProvider
            key={editorKey}
            files={files}
            customSetup={{
                entry: entryFile,
            }}
            options={{
                autorun: false,
                activeFile: `/${fileName}`,
                visibleFiles: [`/${fileName}`],
            }}
        >
            <SyncScript onChange={onChange} fileName={fileName} />
            <SandpackLayout>
                <SandpackCodeEditor
                    showTabs={false}
                    showLineNumbers
                    showRunButton={false}
                    wrapContent
                    readOnly={readOnly}
                    additionalLanguages={additionalLanguages}
                    {...editorExtensions}
                    extensions={editorExtensions?.extensions ?? languageExtensions}
                />
            </SandpackLayout>
        </SandpackProvider>
    )
}
