import {
    MatchDecorator,
    ViewPlugin,
    Decoration,
    type DecorationSet,
    hoverTooltip,
    EditorView,
    type ViewUpdate,
} from "@codemirror/view"
import type { Extension } from "@codemirror/state"
import type { CollectionVar } from "@/pages/editor/types/api.ts"

export interface VariableTriggerInfo {
    x: number
    y: number
    filter: string
    from: number
    to: number
    view: EditorView
}

export function createVariableExtensions(
    variables: CollectionVar[],
    onTrigger?: (info: VariableTriggerInfo) => void,
    onDismiss?: () => void
): Extension[] {
    const variablesMap = new Map<string, string>()
    for (const v of variables) {
        if (v.key) {
            variablesMap.set(v.key, v.value)
        }
    }

    // 1. Theme for highlighted variables and hover tooltip
    const variableTheme = EditorView.baseTheme({
        ".cm-var-valid": {
            backgroundColor: "rgba(16, 185, 129, 0.7) !important",
            fontWeight: "bold !important",
            borderRadius: "2px",
            padding: "0 2px",
            color: "inherit",
        },
        ".cm-var-invalid": {
            backgroundColor: "rgba(239, 68, 68, 0.7) !important",
            fontWeight: "bold !important",
            borderRadius: "2px",
            padding: "0 2px",
            color: "inherit",
        },
        ".cm-var-tooltip": {
            backgroundColor: "#18181b !important",
            color: "#f4f4f5 !important",
            border: "1px solid #3f3f46 !important",
            borderRadius: "6px !important",
            padding: "4px 8px !important",
            fontSize: "12px !important",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.4) !important",
            zIndex: "99999 !important",
        },
    })

    // 2. Completed pattern matcher
    const matcher = new MatchDecorator({
        regexp: /\{\{([^{}]+)\}\}/g,
        decoration: (match) => {
            const key = match[1].trim()
            const isValid = variablesMap.has(key)
            return Decoration.mark({
                class: isValid ? "cm-var-valid" : "cm-var-invalid",
            })
        },
    })

    const highlightPlugin = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet
            constructor(view: EditorView) {
                this.decorations = matcher.createDeco(view)
            }
            update(update: ViewUpdate) {
                this.decorations = matcher.updateDeco(update, this.decorations)
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )

    // 3. Hover Tooltip
    const tooltipExtension = hoverTooltip((view, pos) => {
        const line = view.state.doc.lineAt(pos)
        const regex = /\{\{([^{}]+)\}\}/g
        let match: RegExpExecArray | null

        while ((match = regex.exec(line.text)) !== null) {
            const from = line.from + match.index
            const to = from + match[0].length

            if (pos >= from && pos <= to) {
                const key = match[1].trim()
                const isFound = variablesMap.has(key)
                const val = variablesMap.get(key)

                return {
                    pos: from,
                    end: to,
                    above: true,
                    create() {
                        const dom = document.createElement("div")
                        dom.className = "cm-var-tooltip"
                        if (isFound) {
                            dom.innerHTML = `<span style="font-weight: 600;">${key}: </span><span>${val ?? ""}</span>`
                        } else {
                            dom.innerHTML = `<span style="color: #f87171;">Variable not found</span>`
                        }
                        return { dom }
                    },
                }
            }
        }
        return null
    })

    // 4. Trigger listener when typing "{{"
    const triggerExtension = EditorView.updateListener.of((update) => {
        if (!onTrigger) return
        const sel = update.state.selection.main
        if (sel.empty) {
            const pos = sel.head
            const line = update.state.doc.lineAt(pos)
            const textBefore = line.text.slice(0, pos - line.from)
            const lastDoubleOpen = textBefore.lastIndexOf("{{")

            if (lastDoubleOpen !== -1) {
                const remainder = textBefore.slice(lastDoubleOpen + 2)
                if (!remainder.includes("}")) {
                    const coords = update.view.coordsAtPos(pos)
                    if (coords) {
                        onTrigger({
                            x: coords.left,
                            y: coords.bottom,
                            filter: remainder,
                            from: line.from + lastDoubleOpen,
                            to: pos,
                            view: update.view,
                        })
                        return
                    }
                }
            }
        }
        onDismiss?.()
    })

    return [variableTheme, highlightPlugin, tooltipExtension, triggerExtension]
}
