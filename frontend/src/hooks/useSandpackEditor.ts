import { useEffect, useMemo, useRef, useState } from "react"
import { useSandpack, type SandpackThemeProp } from "@codesandbox/sandpack-react"
import { autocompletion, completionKeymap, acceptCompletion, type CompletionSource } from "@codemirror/autocomplete"
import {
    search,
    searchKeymap,
    highlightSelectionMatches,
    openSearchPanel,
    searchPanelOpen,
} from "@codemirror/search"
import type { Extension } from "@codemirror/state"
import { EditorView, tooltips, keymap } from "@codemirror/view"
import { yaml } from "@codemirror/lang-yaml"
import {
    DARK_EDITOR_PALETTE,
    LIGHT_EDITOR_PALETTE,
    type EditorThemePalette,
} from "@/types/codeEditor"

function createEditorThemeFromPalette(p: EditorThemePalette): Extension {
    return EditorView.theme(
        {
            ".cm-tooltip": {
                backgroundColor: `${p.bg} !important`,
                border: `1px solid ${p.border} !important`,
                color: `${p.text} !important`,
                borderRadius: "6px",
                boxShadow: p.shadow,
                zIndex: "9999 !important",
                pointerEvents: "auto !important",
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
                    scrollbarColor: p.scrollbar,
                },
                "& > ul > li": {
                    padding: "5px 10px",
                    lineHeight: "1.4",
                    color: p.textItem,
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
                    backgroundColor: `${p.bgMuted} !important`,
                },
                "& > ul > completion-section": {
                    borderBottom: `1px solid ${p.border}`,
                    color: p.textMuted,
                    fontSize: "11px",
                    padding: "4px 8px",
                    opacity: "0.8",
                },
            },
            ".cm-completionMatchedText": {
                color: `${p.matchText} !important`,
                textDecoration: "underline",
                fontWeight: "600",
            },
            ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText": {
                color: "#ffffff !important",
                textDecoration: "underline",
                fontWeight: "700",
            },
            ".cm-completionDetail": {
                color: p.textMuted,
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
                color: p.iconFunction,
            },
            ".cm-completionIcon-variable, .cm-completionIcon-property": {
                color: p.iconVariable,
            },
            ".cm-completionIcon-keyword": {
                color: p.iconKeyword,
            },
            ".cm-completionIcon-class, .cm-completionIcon-interface": {
                color: p.iconClass,
            },
            ".cm-completionIcon-constant": {
                color: p.iconConstant,
            },
            ".cm-completionIcon-type": {
                color: p.iconType,
            },
            ".cm-tooltip.cm-completionInfo": {
                backgroundColor: `${p.bg} !important`,
                border: `1px solid ${p.border} !important`,
                color: `${p.text} !important`,
                borderRadius: "6px",
                padding: "8px 12px",
                boxShadow: p.shadow,
                fontSize: "12px",
                lineHeight: "1.5",
            },
            ".cm-panels": {
                backgroundColor: `${p.bg} !important`,
                color: `${p.text} !important`,
                zIndex: "20 !important",
            },
            ".cm-panels.cm-panels-top": {
                borderBottom: `1px solid ${p.borderMuted} !important`,
            },
            ".cm-panels.cm-panels-bottom": {
                borderTop: `1px solid ${p.borderMuted} !important`,
            },
            ".cm-panel.cm-search": {
                backgroundColor: `${p.bg} !important`,
                color: `${p.text} !important`,
                padding: "6px 28px 6px 10px !important",
                fontFamily: "var(--font-sans, system-ui, sans-serif) !important",
                fontSize: "12px !important",
                display: "flex !important",
                flexWrap: "wrap !important",
                alignItems: "center !important",
                gap: "4px 6px !important",
                position: "relative !important",
            },
            ".cm-panel.cm-search [name=close]": {
                position: "absolute !important",
                top: "6px !important",
                right: "6px !important",
                cursor: "pointer !important",
                color: p.textMuted,
                backgroundColor: "transparent !important",
                border: "none !important",
                borderRadius: "4px !important",
                width: "20px !important",
                height: "20px !important",
                padding: "0 !important",
                fontSize: "16px !important",
                lineHeight: "1 !important",
                display: "inline-flex !important",
                alignItems: "center !important",
                justifyContent: "center !important",
                transition: "background-color 0.15s, color 0.15s",
            },
            ".cm-panel.cm-search [name=close]:hover": {
                backgroundColor: `${p.bgMuted} !important`,
                color: p.text,
            },
            ".cm-panel.cm-search input.cm-textfield": {
                backgroundColor: `${p.bgField} !important`,
                color: `${p.text} !important`,
                border: `1px solid ${p.border} !important`,
                borderRadius: "4px !important",
                padding: "2px 8px !important",
                fontSize: "12px !important",
                fontFamily: "var(--font-mono, monospace) !important",
                outline: "none !important",
                minWidth: "130px !important",
                maxWidth: "200px !important",
                height: "24px !important",
                margin: "0 !important",
                transition: "border-color 0.15s, box-shadow 0.15s",
            },
            ".cm-panel.cm-search input.cm-textfield:focus": {
                borderColor: "#3b82f6 !important",
                boxShadow: "0 0 0 1px #3b82f6 !important",
            },
            ".cm-panel.cm-search button.cm-button": {
                backgroundColor: `${p.bgMuted} !important`,
                color: `${p.textItem} !important`,
                border: `1px solid ${p.border} !important`,
                borderRadius: "4px !important",
                padding: "2px 8px !important",
                height: "24px !important",
                fontSize: "11px !important",
                fontWeight: "500 !important",
                cursor: "pointer !important",
                margin: "0 !important",
                display: "inline-flex !important",
                alignItems: "center !important",
                justifyContent: "center !important",
                transition: "background-color 0.15s, color 0.15s",
            },
            ".cm-panel.cm-search button.cm-button:hover": {
                backgroundColor: `${p.border} !important`,
                color: p.text,
            },
            ".cm-panel.cm-search button.cm-button:active": {
                backgroundColor: `${p.activeButtonBg} !important`,
            },
            ".cm-panel.cm-search label": {
                fontSize: "11px !important",
                color: `${p.textMuted} !important`,
                display: "inline-flex !important",
                alignItems: "center !important",
                gap: "4px !important",
                cursor: "pointer !important",
                margin: "0 2px !important",
                userSelect: "none !important",
            },
            ".cm-panel.cm-search label:hover": {
                color: `${p.text} !important`,
            },
            ".cm-panel.cm-search input[type=checkbox]": {
                accentColor: "#2563eb",
                cursor: "pointer",
                margin: "0 !important",
            },
            ".cm-panel.cm-search br": {
                flexBasis: "100% !important",
                height: "0px !important",
                margin: "0 !important",
                display: "block !important",
            },
            ".cm-searchMatch": {
                backgroundColor: `${p.searchMatchBg} !important`,
                outline: `${p.searchMatchOutline} !important`,
                borderRadius: "2px",
            },
            ".cm-searchMatch.cm-searchMatch-selected": {
                backgroundColor: `${p.searchMatchSelectedBg} !important`,
                outline: `${p.searchMatchSelectedOutline} !important`,
                borderRadius: "2px",
            },
            ".cm-selectionMatch": {
                backgroundColor: `${p.selectionMatchBg} !important`,
                borderRadius: "2px",
            },
        },
        { dark: p.isDark }
    )
}

const darkEditorTheme = createEditorThemeFromPalette(DARK_EDITOR_PALETTE)
const lightEditorTheme = createEditorThemeFromPalette(LIGHT_EDITOR_PALETTE)

export function useSandpackFileSync(
    value: string,
    onChange: (code: string) => void,
    fileName: string
): void {
    const { sandpack } = useSandpack()
    const filePath = `/${fileName}`
    const code = sandpack.files[filePath]?.code
    const lastCodeRef = useRef(code ?? "")
    const previousValueRef = useRef(value)
    const pendingEchoesRef = useRef<string[]>([])
    const onChangeRef = useRef(onChange)
    const updateFileRef = useRef(sandpack.updateFile)
    onChangeRef.current = onChange
    updateFileRef.current = sandpack.updateFile

    useEffect(() => {
        if (code !== undefined && code !== lastCodeRef.current) {
            lastCodeRef.current = code
            const pending = pendingEchoesRef.current
            pending.push(code)
            if (pending.length > 100) pending.shift()
            onChangeRef.current(code)
        }
    }, [code])

    useEffect(() => {
        if (value === previousValueRef.current) return
        previousValueRef.current = value

        const pending = pendingEchoesRef.current
        const echoIndex = pending.indexOf(value)
        if (echoIndex !== -1) {
            pending.splice(0, echoIndex + 1)
            return
        }

        pending.length = 0
        if (value === lastCodeRef.current) return
        lastCodeRef.current = value
        updateFileRef.current(filePath, value)
    }, [filePath, value])
}

export interface UseSandpackEditorExtensionsParams {
    fileName: string
    theme?: SandpackThemeProp
    showSearch: boolean
    autoComplete?: boolean | CompletionSource[]
    completionSources?: CompletionSource[]
    extensions: Extension[]
}

export function useSandpackEditorExtensions({
    fileName,
    theme,
    showSearch,
    autoComplete = false,
    completionSources = [],
    extensions,
}: UseSandpackEditorExtensionsParams) {
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    const effectiveTheme: SandpackThemeProp = theme ?? "dark"
    const isDark = effectiveTheme !== "light"
    const themeExtension = useMemo(() => (isDark ? darkEditorTheme : lightEditorTheme), [isDark])

    const yamlLanguage = useMemo(() => {
        if (!/\.(ya?ml)$/i.test(fileName)) return undefined
        return yaml()
    }, [fileName])

    const additionalLanguages = useMemo(() => {
        if (!yamlLanguage) return undefined
        return [
            {
                name: "yaml",
                extensions: ["yml", "yaml"],
                language: yamlLanguage,
            },
        ]
    }, [yamlLanguage])

    const tooltipExtension = useMemo(() => {
        if (typeof document === "undefined") return []
        return tooltips({ parent: document.body })
    }, [])

    const searchExtensions = useMemo(() => {
        if (!showSearch) return []
        return [
            search({ top: true }),
            highlightSelectionMatches(),
            keymap.of([
                ...searchKeymap,
                { key: "Mod-h", run: openSearchPanel, scope: "editor search-panel" },
            ]),
        ]
    }, [showSearch])

    const searchListenerExtension = useMemo(() => {
        if (!showSearch) return []
        let lastOpen = false
        return EditorView.updateListener.of((update) => {
            const isOpen = searchPanelOpen(update.state)
            if (isOpen !== lastOpen) {
                lastOpen = isOpen
                setIsSearchOpen(isOpen)
            }
        })
    }, [showSearch])

    const resolvedCompletionSources = useMemo(() => {
        if (completionSources.length > 0) return completionSources
        if (Array.isArray(autoComplete)) return autoComplete
        return []
    }, [autoComplete, completionSources])

    const isAutoCompleteEnabled = Boolean(autoComplete) || resolvedCompletionSources.length > 0

    const baseExtensions = useMemo(() => {
        const result: Extension[] = [
            themeExtension,
            tooltipExtension,
            ...searchExtensions,
            searchListenerExtension,
            ...extensions,
        ]
        if (yamlLanguage && resolvedCompletionSources.length > 0) {
            result.unshift(yamlLanguage.language.data.of({ autocomplete: resolvedCompletionSources }))
        }
        return result
    }, [
        extensions,
        resolvedCompletionSources,
        searchExtensions,
        searchListenerExtension,
        themeExtension,
        tooltipExtension,
        yamlLanguage,
    ])

    const customCompletionKeymap = useMemo(() => {
        return keymap.of([
            { key: "Tab", run: acceptCompletion },
            ...completionKeymap.filter((binding) => binding.key !== "Enter"),
        ])
    }, [])

    const editorExtensions = useMemo(() => {
        if (!isAutoCompleteEnabled) return undefined
        const autocompletionConfig = {
            defaultKeymap: false,
            ...(!yamlLanguage && resolvedCompletionSources.length > 0
                ? { override: resolvedCompletionSources }
                : {}),
        }
        return {
            extensions: [
                autocompletion(autocompletionConfig),
                customCompletionKeymap,
                ...baseExtensions,
            ],
            extensionsKeymap: [],
        }
    }, [baseExtensions, customCompletionKeymap, isAutoCompleteEnabled, resolvedCompletionSources, yamlLanguage])

    return {
        effectiveTheme,
        isSearchOpen,
        additionalLanguages,
        baseExtensions,
        editorExtensions,
    }
}
