import { useCallback, useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react"
import {
    type DocumentToolbarAction,
    onDocumentToolbarAction,
} from "@/pages/editor/services/documentation.ts"
import { buildImagePlaceholderHtml, htmlToMarkdown, renderMarkdownToHtml, slugifyHeading } from "@/pages/editor/utils/markdown.ts"
import { toggleInlineFormat, toggleMarkdownFormat } from "@/pages/editor/utils/inlineFormat.ts"
import { buildCodeBlockHtml } from "@/pages/editor/hooks/useCodeBlock.ts"

const HEADING_CLASSES_DEFAULT: Record<number, string> = {
    1: "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3 pb-1 border-b border-border/60",
    2: "text-2xl font-semibold tracking-tight text-foreground mt-5 mb-2.5 pb-1 border-b border-border/40",
    3: "text-xl font-semibold text-foreground mt-4 mb-2",
    4: "text-lg font-semibold text-foreground mt-3 mb-1.5",
    5: "text-base font-semibold text-foreground mt-2.5 mb-1",
    6: "text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1",
}

export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface UseApplyMarkdownTransformParams {
    sourceMode: boolean
    setSourceMode: Dispatch<SetStateAction<boolean>>
    markdown: string
    setMarkdown: Dispatch<SetStateAction<string>>
    editorRef: RefObject<HTMLDivElement | null>
    textareaRef: RefObject<HTMLTextAreaElement | null>
    savedRangeRef: MutableRefObject<Range | null>
    savedTextareaSelRef: MutableRefObject<{start: number; end: number}>
    historyRef: MutableRefObject<string[]>
    historyIndexRef: MutableRefObject<number>
    syncToolbarState: (override?: Partial<{sourceMode: boolean; headingLevel: HeadingLevel}>) => void
    scheduleSocketSync: (nextMarkdown: string) => void
    pushHistoryAndSync: (nextMarkdown: string, updateDom?: boolean) => void
    setHeadingLevel: Dispatch<SetStateAction<HeadingLevel>>
    findClosestTag: (node: Node | null | undefined, tags: string[], boundary: HTMLElement | null) => HTMLElement | null
    headingClasses?: Record<number, string>
}

export type UseApplyMarkdownTransformReturn = ((action: DocumentToolbarAction) => void) & {
    applyMarkdownTransform: (action: DocumentToolbarAction) => void
}

export const useApplyMarkdownTransform = ({
    sourceMode,
    setSourceMode,
    markdown,
    setMarkdown,
    editorRef,
    textareaRef,
    savedRangeRef,
    savedTextareaSelRef,
    historyRef,
    historyIndexRef,
    syncToolbarState,
    scheduleSocketSync,
    pushHistoryAndSync,
    setHeadingLevel,
    findClosestTag,
    headingClasses = HEADING_CLASSES_DEFAULT,
}: UseApplyMarkdownTransformParams): UseApplyMarkdownTransformReturn => {
    // Apply toolbar action to Markdown string (supports both selected ranges in Source mode and Live mode)
    const applyMarkdownTransform = useCallback(
        (action: DocumentToolbarAction) => {
            if (action.type === "toggle-source") {
                if (!sourceMode && editorRef.current) {
                    const currentMd = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                    setMarkdown(currentMd)
                }
                setSourceMode((prev) => !prev)
                return
            }

            if (action.type === "undo") {
                if (historyIndexRef.current > 0) {
                    historyIndexRef.current -= 1
                    const prevMd = historyRef.current[historyIndexRef.current]
                    setMarkdown(prevMd)
                    if (editorRef.current) {
                        editorRef.current.innerHTML = renderMarkdownToHtml(prevMd)
                    }
                    syncToolbarState()
                    scheduleSocketSync(prevMd)
                }
                return
            }

            if (action.type === "redo") {
                if (historyIndexRef.current < historyRef.current.length - 1) {
                    historyIndexRef.current += 1
                    const nextMd = historyRef.current[historyIndexRef.current]
                    setMarkdown(nextMd)
                    if (editorRef.current) {
                        editorRef.current.innerHTML = renderMarkdownToHtml(nextMd)
                    }
                    syncToolbarState()
                    scheduleSocketSync(nextMd)
                }
                return
            }

            // If in Source Mode, transform selection directly in textarea
            if (sourceMode && textareaRef.current) {
                const ta = textareaRef.current
                const start = ta.selectionStart ?? savedTextareaSelRef.current.start
                const end = ta.selectionEnd ?? savedTextareaSelRef.current.end
                const selected = markdown.slice(start, end)
                const before = markdown.slice(0, start)
                const after = markdown.slice(end)

                let replacement = selected
                switch (action.type) {
                    case "bold":
                    case "italic": {
                        const result = toggleMarkdownFormat(markdown, start, end, action.type)
                        pushHistoryAndSync(result.text, true)
                        setTimeout(() => {
                            ta.focus()
                            ta.setSelectionRange(result.selStart, result.selEnd)
                        }, 0)
                        return
                    }
                    case "strikethrough":
                        if (selected.startsWith("~~") && selected.endsWith("~~") && selected.length >= 4) {
                            replacement = selected.slice(2, -2)
                        } else {
                            replacement = `~~${selected || "strikethrough"}~~`
                        }
                        break
                    case "code":
                        replacement = selected.includes("\n")
                            ? `\`\`\`\n${selected}\n\`\`\``
                            : `\`${selected || "code"}\``
                        break
                    case "heading": {
                        const lineStart = markdown.lastIndexOf("\n", start - 1) + 1
                        const lineEndIdx = markdown.indexOf("\n", end)
                        const actualEnd = lineEndIdx === -1 ? markdown.length : lineEndIdx
                        const lineContent = markdown
                            .slice(lineStart, actualEnd)
                            .replace(/^\s*#{1,6}\s+/, "")
                        const newLine =
                            action.level === 0
                                ? lineContent
                                : `${"#".repeat(action.level)} ${lineContent || "Heading"}`
                        const nextFull = markdown.slice(0, lineStart) + newLine + markdown.slice(actualEnd)
                        setHeadingLevel(action.level)
                        pushHistoryAndSync(nextFull, true)
                        return
                    }
                    case "list": {
                        const lines = (selected || "List item").split("\n")
                        replacement = lines
                            .map((l, idx) => {
                                const clean = l.replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)/, "")
                                if (action.kind === "ol") return `${idx + 1}. ${clean}`
                                if (action.kind === "task") return `- [ ] ${clean}`
                                return `- ${clean}`
                            })
                            .join("\n")
                        break
                    }
                    case "link":
                        replacement = `[${selected || "link text"}](https://example.com)`
                        break
                    case "image":
                        replacement = `![${selected || "image"}]()`
                        break
                    case "table": {
                        const cols = Math.max(1, action.cols ?? 2)
                        const rows = Math.max(1, action.rows ?? 1)
                        const headers = Array.from({length: cols}, (_, i) => `Header ${i + 1}`).join(" | ")
                        const seps = Array.from({length: cols}, () => "---").join(" | ")
                        const body = Array.from({length: rows}, () =>
                            `| ${Array.from({length: cols}, (_, c) => `Cell ${c + 1}`).join(" | ")} |`
                        ).join("\n")
                        replacement = `\n| ${headers} |\n| ${seps} |\n${body}\n`
                        break
                    }
                }

                const nextFull = before + replacement + after
                pushHistoryAndSync(nextFull, true)
                setTimeout(() => {
                    ta.focus()
                    ta.setSelectionRange(start, start + replacement.length)
                }, 0)
                return
            }

            // In Live Mode: restore selection range if available and transform DOM directly
            if (!editorRef.current) return
            editorRef.current.focus()
            const sel = window.getSelection()
            if (sel && savedRangeRef.current && editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)) {
                sel.removeAllRanges()
                sel.addRange(savedRangeRef.current)
            }

            const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed
            const selectedText = hasSelection ? sel.toString() : ""

            const replaceSelectionWithHtml = (htmlFragment: string) => {
                if (!editorRef.current) return
                const currentSel = window.getSelection()
                if (currentSel && currentSel.rangeCount > 0 && editorRef.current.contains(currentSel.getRangeAt(0).commonAncestorContainer)) {
                    const range = currentSel.getRangeAt(0)
                    range.deleteContents()
                    const temp = document.createElement("div")
                    temp.innerHTML = htmlFragment
                    const frag = document.createDocumentFragment()
                    let lastNode: Node | null = null
                    while (temp.firstChild) {
                        lastNode = frag.appendChild(temp.firstChild)
                    }
                    range.insertNode(frag)
                    if (lastNode) {
                        const nextRange = document.createRange()
                        nextRange.setStartAfter(lastNode)
                        nextRange.collapse(true)
                        currentSel.removeAllRanges()
                        currentSel.addRange(nextRange)
                        savedRangeRef.current = nextRange.cloneRange()
                    }
                } else {
                    const temp = document.createElement("div")
                    temp.innerHTML = htmlFragment
                    while (temp.firstChild) {
                        editorRef.current.appendChild(temp.firstChild)
                    }
                }
                const nextMd = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                pushHistoryAndSync(nextMd, true)
            }

            switch (action.type) {
                case "bold":
                case "italic": {
                    const currentSel = window.getSelection()
                    if (!currentSel || currentSel.rangeCount === 0) return
                    const range = currentSel.getRangeAt(0)
                    if (!editorRef.current.contains(range.commonAncestorContainer)) return
                    if (toggleInlineFormat(editorRef.current, range, action.type)) {
                        const nextMd = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                        // DOM already holds the result: skip re-render so selection and caret survive
                        pushHistoryAndSync(nextMd, false)
                    }
                    break
                }
                case "strikethrough":
                    replaceSelectionWithHtml(
                        `<del class="md-node line-through text-muted-foreground" data-md-type="strikethrough"><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">~~</span><span class="md-content">${selectedText || "Strikethrough"}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">~~</span></del>`
                    )
                    break
                case "code":
                    if (selectedText.includes("\n")) {
                        replaceSelectionWithHtml(buildCodeBlockHtml(selectedText, ""))
                    } else {
                        replaceSelectionWithHtml(
                            `<code class="md-node rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400" data-md-type="code"><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">\`</span><span class="md-content">${selectedText || "code"}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">\`</span></code>`
                        )
                    }
                    break
                case "heading": {
                    setHeadingLevel(action.level)
                    const currentSel = window.getSelection()
                    let blockNode: HTMLElement | null = null
                    if (currentSel && currentSel.rangeCount > 0) {
                        let node: Node | null = currentSel.getRangeAt(0).startContainer
                        while (node && node !== editorRef.current) {
                            if (node.parentNode === editorRef.current && node.nodeType === Node.ELEMENT_NODE) {
                                blockNode = node as HTMLElement
                                break
                            }
                            node = node.parentNode
                        }
                    }
                    if (blockNode) {
                        const contentNode = blockNode.querySelector(":scope > .md-content") ?? blockNode
                        const text = contentNode.textContent?.replace(/\u200B/g, "").trim() || "Heading"
                        if (action.level === 0) {
                            const p = document.createElement("p")
                            p.className = "my-2.5 leading-7 text-foreground"
                            p.textContent = text
                            blockNode.replaceWith(p)
                        } else {
                            const h = document.createElement(`h${action.level}`)
                            const headingClass = headingClasses[action.level] ?? HEADING_CLASSES_DEFAULT[action.level] ?? ""
                            h.className = headingClass
                            h.id = slugifyHeading(text)
                            h.textContent = text
                            blockNode.replaceWith(h)
                        }
                        const nextMd = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                        pushHistoryAndSync(nextMd, true)
                    } else {
                        const tag = action.level === 0 ? "p" : `h${action.level}`
                        const cls =
                            action.level === 0
                                ? "my-2.5 leading-7 text-foreground"
                                : (headingClasses[action.level] ?? HEADING_CLASSES_DEFAULT[action.level] ?? "")
                        replaceSelectionWithHtml(`<${tag} class="${cls}">${selectedText || "Heading"}</${tag}>`)
                    }
                    break
                }
                case "list": {
                    const items = (selectedText || "List item").split("\n").filter(Boolean)
                    if (action.kind === "ol") {
                        const lis = items.map((it) => `<li class="leading-relaxed">${it}</li>`).join("")
                        replaceSelectionWithHtml(`<ol class="my-2 space-y-1 list-decimal pl-6">${lis}</ol>`)
                    } else if (action.kind === "task") {
                        const lis = items
                            .map(
                                (it) =>
                                    `<li class="flex items-start gap-2" data-task-item="true"><input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer" /><span>${it}</span></li>`
                            )
                            .join("")
                        replaceSelectionWithHtml(`<ul class="my-2 space-y-1.5 list-none pl-1">${lis}</ul>`)
                    } else {
                        const lis = items.map((it) => `<li class="leading-relaxed">${it}</li>`).join("")
                        replaceSelectionWithHtml(`<ul class="my-2 space-y-1 list-disc pl-6">${lis}</ul>`)
                    }
                    break
                }
                case "link":
                    replaceSelectionWithHtml(
                        `<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${selectedText || "link text"}</a>`
                    )
                    break
                case "image":
                    replaceSelectionWithHtml(buildImagePlaceholderHtml(selectedText || "image"))
                    break
                case "table": {
                    const cols = Math.max(1, action.cols ?? 2)
                    const rows = Math.max(1, action.rows ?? 1)
                    const ths = Array.from(
                        {length: cols},
                        (_, i) =>
                            `<th style="text-align:left" class="border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground">Header ${i + 1}</th>`
                    ).join("")
                    const trs = Array.from(
                        {length: rows},
                        () =>
                            `<tr class="even:bg-muted/20">${Array.from(
                                {length: cols},
                                (_, c) =>
                                    `<td style="text-align:left" class="border border-border px-3 py-2 text-sm text-foreground">Cell ${c + 1}</td>`
                            ).join("")}</tr>`
                    ).join("")
                    replaceSelectionWithHtml(
                        `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse border border-border text-sm"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
                    )
                    break
                }
            }
        },
        [
            editorRef,
            findClosestTag,
            headingClasses,
            historyIndexRef,
            historyRef,
            markdown,
            pushHistoryAndSync,
            savedRangeRef,
            savedTextareaSelRef,
            scheduleSocketSync,
            setHeadingLevel,
            setMarkdown,
            setSourceMode,
            sourceMode,
            syncToolbarState,
            textareaRef,
        ]
    )

    useEffect(() => {
        return onDocumentToolbarAction(applyMarkdownTransform)
    }, [applyMarkdownTransform])

    const result = applyMarkdownTransform as UseApplyMarkdownTransformReturn
    result.applyMarkdownTransform = applyMarkdownTransform
    return result
}
