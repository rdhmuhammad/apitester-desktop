import {useCallback, useEffect, useRef, useState} from "react"
import {FileText, Loader2, Sparkles} from "lucide-react"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts"
import {useDocumentContent} from "@/pages/editor/hooks/useDocumentation.ts"
import {
    computeDocumentDiff,
    dispatchDocumentToolbarState,
    DocumentationServices,
    type DocumentToolbarAction,
    onDocumentToolbarAction,
} from "@/pages/editor/services/documentation.ts"
import {htmlToMarkdown, renderMarkdownToHtml, slugifyHeading} from "@/pages/editor/utils/markdown.ts"

const HEADING_CLASSES: Record<number, string> = {
    1: "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3 pb-1 border-b border-border/60",
    2: "text-2xl font-semibold tracking-tight text-foreground mt-5 mb-2.5 pb-1 border-b border-border/40",
    3: "text-xl font-semibold text-foreground mt-4 mb-2",
    4: "text-lg font-semibold text-foreground mt-3 mb-1.5",
    5: "text-base font-semibold text-foreground mt-2.5 mb-1",
    6: "text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1",
}

const placeCaretAfter = (node: Node) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    const spacer = document.createTextNode("\u00A0")
    if (node.parentNode) {
        node.parentNode.insertBefore(spacer, node.nextSibling)
        range.setStart(spacer, 1)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
    }
}

const placeCaretAtStart = (el: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
}

const DocumentEditor: React.FC = () => {
    const activeTab = useAppSelector(selectEditorActiveTab)
    const documentId = activeTab?.type === "document" ? activeTab.id : ""
    const documentQuery = useDocumentContent(documentId)

    const [markdown, setMarkdown] = useState("")
    const [sourceMode, setSourceMode] = useState(false)
    const [headingLevel, setHeadingLevel] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0)

    const editorRef = useRef<HTMLDivElement | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const savedRangeRef = useRef<Range | null>(null)
    const savedTextareaSelRef = useRef<{start: number; end: number}>({start: 0, end: 0})

    const lastSentMarkdownRef = useRef("")
    const loadedDocIdRef = useRef("")
    const loadedVersionRef = useRef("")
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const historyRef = useRef<string[]>([""])
    const historyIndexRef = useRef<number>(0)

    const syncToolbarState = useCallback(
        (override?: Partial<{sourceMode: boolean; headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6}>) => {
            dispatchDocumentToolbarState({
                sourceMode: override?.sourceMode ?? sourceMode,
                canUndo: historyIndexRef.current > 0,
                canRedo: historyIndexRef.current < historyRef.current.length - 1,
                headingLevel: override?.headingLevel ?? headingLevel,
            })
        },
        [headingLevel, sourceMode]
    )

    const scheduleSocketSync = useCallback(
        (nextMarkdown: string) => {
            if (!documentId) return
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
                const prev = lastSentMarkdownRef.current
                if (prev === nextMarkdown) return
                const diff = computeDocumentDiff(prev, nextMarkdown)
                DocumentationServices.emitContentEdit({
                    id: documentId,
                    content: diff.content,
                    startPos: diff.startPos,
                    lenght: diff.lenght,
                })
                lastSentMarkdownRef.current = nextMarkdown
            }, 500)
        },
        [documentId]
    )

    const pushHistoryAndSync = useCallback(
        (nextMarkdown: string, updateDom = false) => {
            setMarkdown(nextMarkdown)
            if (historyRef.current[historyIndexRef.current] !== nextMarkdown) {
                const nextStack = historyRef.current.slice(0, historyIndexRef.current + 1)
                nextStack.push(nextMarkdown)
                if (nextStack.length > 100) nextStack.shift()
                historyRef.current = nextStack
                historyIndexRef.current = nextStack.length - 1
            }
            if (updateDom && editorRef.current) {
                editorRef.current.innerHTML = renderMarkdownToHtml(nextMarkdown)
            }
            syncToolbarState()
            scheduleSocketSync(nextMarkdown)
        },
        [scheduleSocketSync, syncToolbarState]
    )

    // Initialize or refresh content when documentQuery data arrives
    useEffect(() => {
        if (!documentQuery.data) return
        const {id, content, version} = documentQuery.data
        const isNewDoc = loadedDocIdRef.current !== id
        const isExternalRefresh = loadedVersionRef.current !== version && content !== lastSentMarkdownRef.current

        if (isNewDoc || isExternalRefresh) {
            loadedDocIdRef.current = id
            loadedVersionRef.current = version
            lastSentMarkdownRef.current = content
            setMarkdown(content)
            historyRef.current = [content]
            historyIndexRef.current = 0
            if (editorRef.current) {
                editorRef.current.innerHTML = renderMarkdownToHtml(content)
            }
            syncToolbarState()
        }
    }, [documentQuery.data, syncToolbarState])

    // Populate live DOM when toggling back from Source Mode to Live Mode
    useEffect(() => {
        if (!sourceMode && editorRef.current) {
            editorRef.current.innerHTML = renderMarkdownToHtml(markdown)
        }
        syncToolbarState({sourceMode})
    }, [sourceMode]) // eslint-disable-line react-hooks/exhaustive-deps

    // Listen to socket `document:refresh` (only refetch when payload is true)
    useEffect(() => {
        if (!documentId) return
        return DocumentationServices.onDocumentRefresh((shouldRefresh) => {
            if (shouldRefresh) {
                void documentQuery.refetch()
            }
        })
    }, [documentId, documentQuery])

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    // Track current selection inside contentEditable so toolbar dropdowns can restore it
    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection()
            if (!sel || sel.rangeCount === 0 || !editorRef.current) return
            const range = sel.getRangeAt(0)
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange()
                let node: Node | null = range.startContainer
                let detectedLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
                while (node && node !== editorRef.current) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const tag = (node as HTMLElement).tagName.toLowerCase()
                        if (/^h[1-6]$/.test(tag)) {
                            detectedLevel = Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6
                            break
                        }
                    }
                    node = node.parentNode
                }
                if (detectedLevel !== headingLevel) {
                    setHeadingLevel(detectedLevel)
                    syncToolbarState({headingLevel: detectedLevel})
                }
            }
        }
        document.addEventListener("selectionchange", handleSelectionChange)
        return () => document.removeEventListener("selectionchange", handleSelectionChange)
    }, [headingLevel, syncToolbarState])

    // Live inline & block markdown auto-transformation when typing in contentEditable
    const tryLiveTransform = useCallback((): boolean => {
        const sel = window.getSelection()
        if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !editorRef.current) return false
        const range = sel.getRangeAt(0)
        const container = range.startContainer
        if (container.nodeType !== Node.TEXT_NODE) return false

        // Do not transform inside <code> or <pre>
        let parent: Node | null = container.parentNode
        while (parent && parent !== editorRef.current) {
            if (parent.nodeType === Node.ELEMENT_NODE) {
                const tag = (parent as HTMLElement).tagName.toLowerCase()
                if (tag === "code" || tag === "pre") return false
            }
            parent = parent.parentNode
        }

        const textNode = container as Text
        const fullText = textNode.textContent ?? ""
        const offset = range.startOffset
        const beforeCaret = fullText.slice(0, offset).replace(/\u00A0/g, " ")
        const afterCaret = fullText.slice(offset)

        // Find immediate block element under editorRef
        let blockEl: HTMLElement | null = textNode.parentElement
        while (blockEl && blockEl.parentElement && blockEl.parentElement !== editorRef.current) {
            blockEl = blockEl.parentElement
        }

        // 1. Block-level transformations (Headings, Lists, Blockquote, Horizontal Rule)
        if (blockEl && blockEl.parentElement === editorRef.current) {
            const headingMatch = beforeCaret.match(/^(#{1,6})\s(.*)$/)
            if (headingMatch) {
                const level = headingMatch[1].length
                const rest = headingMatch[2] + afterCaret
                const h = document.createElement(`h${level}`)
                h.className = HEADING_CLASSES[level]
                h.id = slugifyHeading(rest)
                h.textContent = rest || "\u200B"
                blockEl.replaceWith(h)
                placeCaretAtStart(h)
                return true
            }

            const hrMatch = beforeCaret.match(/^(?:---|\*\*\*|___)\s*$/)
            if (hrMatch && !afterCaret.trim()) {
                const hr = document.createElement("hr")
                hr.className = "my-6 border-t border-border"
                const p = document.createElement("p")
                p.className = "my-2.5 leading-7 text-foreground"
                p.innerHTML = "<br />"
                blockEl.replaceWith(hr, p)
                placeCaretAtStart(p)
                return true
            }

            const quoteMatch = beforeCaret.match(/^>\s(.*)$/)
            if (quoteMatch) {
                const rest = quoteMatch[1] + afterCaret
                const bq = document.createElement("blockquote")
                bq.className =
                    "my-3 border-l-4 border-indigo-500/70 bg-indigo-50/40 dark:bg-indigo-950/20 pl-4 py-1.5 italic text-slate-700 dark:text-slate-300 rounded-r"
                const p = document.createElement("p")
                p.textContent = rest || "\u200B"
                bq.appendChild(p)
                blockEl.replaceWith(bq)
                placeCaretAtStart(p)
                return true
            }

            const taskMatch = beforeCaret.match(/^[-*+]\s\[([ xX])\]\s(.*)$/)
            if (taskMatch) {
                const checked = taskMatch[1].toLowerCase() === "x"
                const rest = taskMatch[2] + afterCaret
                const ul = document.createElement("ul")
                ul.className = "my-2 space-y-1.5 list-none pl-1"
                const li = document.createElement("li")
                li.className = "flex items-start gap-2"
                li.setAttribute("data-task-item", "true")
                const input = document.createElement("input")
                input.type = "checkbox"
                input.checked = checked
                input.className = "mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                const span = document.createElement("span")
                span.textContent = rest || "\u200B"
                li.append(input, span)
                ul.appendChild(li)
                blockEl.replaceWith(ul)
                placeCaretAtStart(span)
                return true
            }

            const ulMatch = beforeCaret.match(/^[-*+]\s(.*)$/)
            if (ulMatch) {
                const rest = ulMatch[1] + afterCaret
                const ul = document.createElement("ul")
                ul.className = "my-2 space-y-1 list-disc pl-6"
                const li = document.createElement("li")
                li.className = "leading-relaxed"
                li.textContent = rest || "\u200B"
                ul.appendChild(li)
                blockEl.replaceWith(ul)
                placeCaretAtStart(li)
                return true
            }

            const olMatch = beforeCaret.match(/^\d+\.\s(.*)$/)
            if (olMatch) {
                const rest = olMatch[1] + afterCaret
                const ol = document.createElement("ol")
                ol.className = "my-2 space-y-1 list-decimal pl-6"
                const li = document.createElement("li")
                li.className = "leading-relaxed"
                li.textContent = rest || "\u200B"
                ol.appendChild(li)
                blockEl.replaceWith(ol)
                placeCaretAtStart(li)
                return true
            }
        }

        // 2. Inline-level transformations (*Bold me* -> **Bold me**, _italic_, ~~strike~~, `code`, ==highlight==, [link](url), ![img](url))
        const replaceInlinePattern = (
            match: RegExpMatchArray,
            createNode: (innerText: string, extra?: string) => HTMLElement
        ): boolean => {
            const fullMatch = match[0]
            const inner = match[1]
            const extra = match[2]
            const startIdx = beforeCaret.length - fullMatch.length
            const prefixText = fullText.slice(0, startIdx)
            const suffixText = afterCaret

            const parentNode = textNode.parentNode
            if (!parentNode) return false

            const el = createNode(inner, extra)
            if (prefixText) {
                parentNode.insertBefore(document.createTextNode(prefixText), textNode)
            }
            parentNode.insertBefore(el, textNode)
            if (suffixText) {
                parentNode.insertBefore(document.createTextNode(suffixText), textNode)
            }
            parentNode.removeChild(textNode)
            placeCaretAfter(el)
            return true
        }

        // Bold + Italic: ***text***
        const boldItalicMatch = beforeCaret.match(/(?:\*\*\*|___)(\S(?:.*?\S)?)(?:\*\*\*|___)$/)
        if (boldItalicMatch) {
            return replaceInlinePattern(boldItalicMatch, (inner) => {
                const strong = document.createElement("strong")
                const em = document.createElement("em")
                em.textContent = inner
                strong.appendChild(em)
                return strong
            })
        }

        // Bold: **text**, __text__, or *Bold me* (per Acceptance Criteria: \*Bold me\* -> Bold Me)
        const doubleBoldMatch = beforeCaret.match(/(?:\*\*|__)(\S(?:.*?\S)?)(?:\*\*|__)$/)
        if (doubleBoldMatch) {
            return replaceInlinePattern(doubleBoldMatch, (inner) => {
                const strong = document.createElement("strong")
                strong.textContent = inner
                return strong
            })
        }

        const singleStarBoldMatch = beforeCaret.match(/(?:^|[^*])\*([^*\n]+?)\*$/)
        if (singleStarBoldMatch) {
            const fullToken = `*${singleStarBoldMatch[1]}*`
            const inner = singleStarBoldMatch[1]
            const startIdx = beforeCaret.length - fullToken.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const strong = document.createElement("strong")
                strong.textContent = inner
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(strong, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(strong)
                return true
            }
        }

        // Italic: _text_
        const italicMatch = beforeCaret.match(/(?:^|[^_])_([^_\n]+?)_$/)
        if (italicMatch) {
            const fullToken = `_${italicMatch[1]}_`
            const inner = italicMatch[1]
            const startIdx = beforeCaret.length - fullToken.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const em = document.createElement("em")
                em.textContent = inner
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(em, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(em)
                return true
            }
        }

        // Strikethrough: ~~text~~
        const strikeMatch = beforeCaret.match(/~~([^~\n]+?)~~$/)
        if (strikeMatch) {
            return replaceInlinePattern(strikeMatch, (inner) => {
                const del = document.createElement("del")
                del.className = "line-through text-muted-foreground"
                del.textContent = inner
                return del
            })
        }

        // Inline code: `code`
        const codeMatch = beforeCaret.match(/`([^`\n]+?)`$/)
        if (codeMatch) {
            return replaceInlinePattern(codeMatch, (inner) => {
                const code = document.createElement("code")
                code.className =
                    "rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400"
                code.textContent = inner
                return code
            })
        }

        // Highlight: ==text==
        const highlightMatch = beforeCaret.match(/==([^=\n]+?)==$/)
        if (highlightMatch) {
            return replaceInlinePattern(highlightMatch, (inner) => {
                const mark = document.createElement("mark")
                mark.className = "rounded bg-amber-200/80 dark:bg-amber-500/30 px-1 text-foreground"
                mark.textContent = inner
                return mark
            })
        }

        // Superscript: ^text^
        const supMatch = beforeCaret.match(/\^([^\s^~]+?)\^$/)
        if (supMatch) {
            return replaceInlinePattern(supMatch, (inner) => {
                const sup = document.createElement("sup")
                sup.textContent = inner
                return sup
            })
        }

        // Subscript: ~text~
        const subMatch = beforeCaret.match(/(?:^|[^~])~([^\s~^]+?)~$/)
        if (subMatch) {
            const fullToken = `~${subMatch[1]}~`
            const inner = subMatch[1]
            const startIdx = beforeCaret.length - fullToken.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const sub = document.createElement("sub")
                sub.textContent = inner
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(sub, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(sub)
                return true
            }
        }

        // Image: ![alt](url)
        const imgMatch = beforeCaret.match(/!\[([^\]]*)\]\(([^)\s]+)\)$/)
        if (imgMatch) {
            return replaceInlinePattern(imgMatch, (alt, url) => {
                const img = document.createElement("img")
                img.src = url ?? ""
                img.alt = alt
                img.className = "max-w-full rounded-lg border border-border my-2 inline-block"
                return img
            })
        }

        // Link: [text](url)
        const linkMatch = beforeCaret.match(/\[([^\]]+)\]\(([^)\s]+)\)$/)
        if (linkMatch) {
            return replaceInlinePattern(linkMatch, (label, url) => {
                const a = document.createElement("a")
                a.href = url ?? "#"
                a.target = "_blank"
                a.rel = "noopener noreferrer"
                a.className = "text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500"
                a.textContent = label
                return a
            })
        }

        return false
    }, [])

    const handleLiveInput = useCallback(() => {
        if (!editorRef.current) return
        tryLiveTransform()
        const serialized = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
        pushHistoryAndSync(serialized, false)
    }, [pushHistoryAndSync, tryLiveTransform])

    const handleLiveClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const target = e.target as HTMLElement
            if (target.tagName.toLowerCase() === "input" && (target as HTMLInputElement).type === "checkbox") {
                setTimeout(() => {
                    if (!editorRef.current) return
                    const serialized = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                    pushHistoryAndSync(serialized, true)
                }, 0)
            } else if (target.tagName.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                const href = (target as HTMLAnchorElement).getAttribute("href")
                if (href) {
                    if (window.electronAPI?.openExternal) {
                        void window.electronAPI.openExternal(href)
                    } else {
                        window.open(href, "_blank", "noopener,noreferrer")
                    }
                }
            }
        },
        [pushHistoryAndSync]
    )

    // Apply toolbar action to Markdown string (supports both selected ranges in Source mode and Live mode)
    const applyMarkdownTransform = useCallback(
        (action: DocumentToolbarAction) => {
            if (action.type === "toggle-source") {
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
                        replacement = `**${selected || "bold text"}**`
                        break
                    case "italic":
                        replacement = `*${selected || "italic text"}*`
                        break
                    case "strikethrough":
                        replacement = `~~${selected || "strikethrough"}~~`
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
                        replacement = `![${selected || "alt text"}](https://placehold.co/600x320)`
                        break
                    case "table":
                        replacement = `\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n`
                        break
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
                    replaceSelectionWithHtml(`<strong>${selectedText || "Bold text"}</strong>`)
                    break
                case "italic":
                    replaceSelectionWithHtml(`<em>${selectedText || "Italic text"}</em>`)
                    break
                case "strikethrough":
                    replaceSelectionWithHtml(
                        `<del class="line-through text-muted-foreground">${selectedText || "Strikethrough"}</del>`
                    )
                    break
                case "code":
                    if (selectedText.includes("\n")) {
                        replaceSelectionWithHtml(
                            `<div class="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-slate-100" data-code-block="true"><pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><code>${selectedText}</code></pre></div>`
                        )
                    } else {
                        replaceSelectionWithHtml(
                            `<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400">${selectedText || "code"}</code>`
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
                        const text = blockNode.textContent?.trim() || "Heading"
                        if (action.level === 0) {
                            const p = document.createElement("p")
                            p.className = "my-2.5 leading-7 text-foreground"
                            p.textContent = text
                            blockNode.replaceWith(p)
                        } else {
                            const h = document.createElement(`h${action.level}`)
                            h.className = HEADING_CLASSES[action.level]
                            h.id = slugifyHeading(text)
                            h.textContent = text
                            blockNode.replaceWith(h)
                        }
                        const nextMd = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
                        pushHistoryAndSync(nextMd, true)
                    } else {
                        const tag = action.level === 0 ? "p" : `h${action.level}`
                        const cls = action.level === 0 ? "my-2.5 leading-7 text-foreground" : HEADING_CLASSES[action.level]
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
                    replaceSelectionWithHtml(
                        `<img src="https://placehold.co/600x320" alt="${selectedText || "image"}" class="max-w-full rounded-lg border border-border my-2 inline-block" />`
                    )
                    break
                case "table":
                    replaceSelectionWithHtml(
                        `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse border border-border text-sm"><thead><tr><th style="text-align:left" class="border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground">Header 1</th><th style="text-align:left" class="border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground">Header 2</th></tr></thead><tbody><tr class="even:bg-muted/20"><td style="text-align:left" class="border border-border px-3 py-2 text-sm text-foreground">Cell 1</td><td style="text-align:left" class="border border-border px-3 py-2 text-sm text-foreground">Cell 2</td></tr></tbody></table></div>`
                    )
                    break
            }
        },
        [markdown, pushHistoryAndSync, scheduleSocketSync, sourceMode, syncToolbarState]
    )

    useEffect(() => {
        return onDocumentToolbarAction(applyMarkdownTransform)
    }, [applyMarkdownTransform])

    if (documentQuery.isLoading) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600"/>
                <span className="text-xs font-medium">Loading document...</span>
            </div>
        )
    }

    return (
        <div className="flex min-h-[calc(100dvh-260px)] flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-600"/>
                    <h2 className="text-sm font-semibold text-foreground">
                        {documentQuery.data?.name || activeTab?.label || "Markdown Editor"}
                    </h2>
                    <span className="rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                        {documentId}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500"/>
                    <span>
                        {sourceMode
                            ? "Source Markdown Mode (Auto-syncs in 500ms)"
                            : "Live Markdown Mode — type *bold*, # heading, - list, ~~strike~~ or select text & use toolbar"}
                    </span>
                </div>
            </div>

            {sourceMode ? (
                <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                    <div className="flex flex-col p-4">
                        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Markdown Source
                        </span>
                        <textarea
                            ref={textareaRef}
                            value={markdown}
                            onChange={(e) => {
                                pushHistoryAndSync(e.target.value, false)
                            }}
                            onSelect={(e) => {
                                const target = e.currentTarget
                                savedTextareaSelRef.current = {
                                    start: target.selectionStart,
                                    end: target.selectionEnd,
                                }
                            }}
                            placeholder="Write your Markdown here..."
                            className="min-h-[460px] w-full flex-1 resize-y rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex flex-col p-4">
                        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Rendered Preview
                        </span>
                        <div
                            className="min-h-[460px] flex-1 rounded-lg border border-border/60 bg-background/50 p-5 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{__html: renderMarkdownToHtml(markdown)}}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex-1 p-6">
                    <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleLiveInput}
                        onClick={handleLiveClick}
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                                e.preventDefault()
                                if (e.shiftKey) {
                                    applyMarkdownTransform({type: "redo"})
                                } else {
                                    applyMarkdownTransform({type: "undo"})
                                }
                            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "redo"})
                            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "bold"})
                            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "italic"})
                            }
                        }}
                        data-placeholder="Start typing Markdown (e.g. # Heading, *Bold me*, - list item)..."
                        className="min-h-[480px] w-full rounded-xl border border-transparent px-4 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-indigo-500/30 focus:bg-background/60 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                    />
                </div>
            )}
        </div>
    )
}

export default DocumentEditor
