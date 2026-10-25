import { useCallback, type RefObject } from "react"
import { slugifyHeading } from "@/pages/editor/utils/markdown.ts"
import { createCodeBlockElement } from "@/pages/editor/hooks/useCodeBlock.ts"

const HEADING_CLASSES_DEFAULT: Record<number, string> = {
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

export interface UseLiveTransformParams {
    editorRef: RefObject<HTMLDivElement | null>
    placeCaretAtStart: (el: HTMLElement) => void
    headingClasses?: Record<number, string>
}

export type UseLiveTransformReturn = (() => boolean) & {
    tryLiveTransform: () => boolean
}

export const useLiveTransform = ({
    editorRef,
    placeCaretAtStart,
    headingClasses = HEADING_CLASSES_DEFAULT,
}: UseLiveTransformParams): UseLiveTransformReturn => {
    const tryLiveTransform = useCallback((): boolean => {
        const root = editorRef.current
        const sel = window.getSelection()
        if (!root || !sel || sel.rangeCount === 0) return false

        const unwrapNode = (el: Node) => {
            const p = el.parentNode
            if (!p) return
            while (el.firstChild) p.insertBefore(el.firstChild, el)
            p.removeChild(el)
        }

        let caretNode: Node | null = sel.getRangeAt(0).startContainer
        let caretOffset = sel.getRangeAt(0).startOffset

        // Strip browser-injected <font>/<span style> (from deleting .md-syntax) and orphan .md-syntax nodes
        const bogus = root.querySelectorAll("font, span[style]")
        const orphanSyntax = Array.from(root.querySelectorAll(".md-syntax")).filter(
            (s) => !s.parentElement?.classList.contains("md-node")
        )
        if (bogus.length > 0 || orphanSyntax.length > 0) {
            bogus.forEach(unwrapNode)
            orphanSyntax.forEach(unwrapNode)
            if (caretNode && root.contains(caretNode)) {
                const r = document.createRange()
                const max =
                    caretNode.nodeType === Node.TEXT_NODE
                        ? (caretNode.textContent?.length ?? 0)
                        : caretNode.childNodes.length
                r.setStart(caretNode, Math.min(caretOffset, max))
                r.collapse(true)
                sel.removeAllRanges()
                sel.addRange(r)
            }
        }

        // Sync or unwrap headings whose `#` syntax was edited or deleted
        let headingChanged = false
        root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((h) => {
            const contentEl = h.querySelector<HTMLElement>(":scope > .md-content")
            if (contentEl && contentEl.textContent && contentEl.textContent.length > 1 && contentEl.textContent.includes("\u200B")) {
                contentEl.childNodes.forEach((n) => {
                    if (n.nodeType === Node.TEXT_NODE) {
                        const tn = n as Text
                        let idx = tn.data.indexOf("\u200B")
                        while (idx !== -1) {
                            tn.deleteData(idx, 1)
                            if (caretNode === tn && caretOffset > idx) caretOffset--
                            idx = tn.data.indexOf("\u200B")
                        }
                    }
                })
            }

            const syn = h.querySelector<HTMLElement>(":scope > .md-syntax")
            const synText = (syn?.textContent ?? "").replace(/\u00A0/g, " ")
            const match = synText.match(/^(#{1,6})([ ]?)([\s\S]*)$/)

            if (!match) {
                if (syn) {
                    const leftover = synText.replace(/^ +/, "")
                    if (leftover) {
                        const tn = document.createTextNode(leftover)
                        syn.replaceWith(tn)
                        caretNode = tn
                        caretOffset = leftover.length
                    } else {
                        syn.remove()
                    }
                }
                if (contentEl) unwrapNode(contentEl)
                const p = document.createElement("p")
                p.className = "my-2.5 leading-7 text-foreground"
                while (h.firstChild) p.appendChild(h.firstChild)
                if (p.textContent === "\u200B") p.textContent = ""
                if (!p.textContent && !p.querySelector("br")) p.innerHTML = "<br />"
                h.replaceWith(p)

                const r = document.createRange()
                if (caretNode && caretNode !== h && p.contains(caretNode)) {
                    const max =
                        caretNode.nodeType === Node.TEXT_NODE
                            ? (caretNode.textContent?.length ?? 0)
                            : caretNode.childNodes.length
                    r.setStart(caretNode, Math.min(caretOffset, max))
                } else {
                    r.selectNodeContents(p)
                }
                r.collapse(true)
                sel.removeAllRanges()
                sel.addRange(r)
                headingChanged = true
                return
            }

            const hashes = match[1]
            const extra = match[3]
            if (extra && syn) {
                syn.textContent = `${hashes} `
                let targetContent = h.querySelector<HTMLElement>(":scope > .md-content")
                if (!targetContent) {
                    targetContent = document.createElement("span")
                    targetContent.className = "md-content"
                    h.appendChild(targetContent)
                }
                const tn = document.createTextNode(extra)
                targetContent.insertBefore(tn, targetContent.firstChild)
                caretNode = tn
                caretOffset = extra.length
                const r = document.createRange()
                r.setStart(tn, extra.length)
                r.collapse(true)
                sel.removeAllRanges()
                sel.addRange(r)
                headingChanged = true
            }

            const newLevel = hashes.length
            const curLevel = Number(h.tagName[1])
            if (newLevel !== curLevel) {
                const nextH = document.createElement(`h${newLevel}`)
                const headingClass = headingClasses[newLevel] ?? HEADING_CLASSES_DEFAULT[newLevel] ?? ""
                nextH.className = `md-node ${headingClass} syntax-active`
                nextH.setAttribute("data-md-type", `h${newLevel}`)
                if (h.id) nextH.id = h.id
                const customId = h.getAttribute("data-custom-id")
                if (customId) nextH.setAttribute("data-custom-id", customId)
                while (h.firstChild) nextH.appendChild(h.firstChild)
                h.replaceWith(nextH)
                if (caretNode && nextH.contains(caretNode)) {
                    const r = document.createRange()
                    const max =
                        caretNode.nodeType === Node.TEXT_NODE
                            ? (caretNode.textContent?.length ?? 0)
                            : caretNode.childNodes.length
                    r.setStart(caretNode, Math.min(caretOffset, max))
                    r.collapse(true)
                    sel.removeAllRanges()
                    sel.addRange(r)
                }
                headingChanged = true
            }
        })
        if (headingChanged) return true

        if (!sel.isCollapsed || sel.rangeCount === 0) return false
        const range = sel.getRangeAt(0)
        const container = range.startContainer
        if (container.nodeType !== Node.TEXT_NODE) return false

        // Do not transform inside <code>, <pre> or revealed syntax markers (e.g. a typed space after a shown `*`)
        let parent: Node | null = container.parentNode
        while (parent && parent !== editorRef.current) {
            if (parent.nodeType === Node.ELEMENT_NODE) {
                const el = parent as HTMLElement
                const tag = el.tagName.toLowerCase()
                if (tag === "code" || tag === "pre" || el.classList.contains("md-syntax")) return false
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

        // 1. Block-level transformations (Headings, Lists, Blockquote, Horizontal Rule, Code Block)
        if (blockEl && blockEl.parentElement === editorRef.current) {
            if (beforeCaret.startsWith("\\")) {
                return false
            }

            const codeFenceMatch = beforeCaret.match(/^`{3,}([a-zA-Z0-9+#_-]*)\s*$/)
            if (codeFenceMatch) {
                const lang = codeFenceMatch[1] || ""
                const div = createCodeBlockElement("", lang)
                blockEl.replaceWith(div)
                const codeEl = div.querySelector("code")
                if (codeEl) placeCaretAtStart(codeEl as HTMLElement)
                return true
            }

            const headingMatch = beforeCaret.match(/^(#{1,6})\s(.*)$/)
            if (headingMatch) {
                const level = headingMatch[1].length
                const rest = headingMatch[2] + afterCaret
                const h = document.createElement(`h${level}`)
                const headingClass = headingClasses[level] ?? HEADING_CLASSES_DEFAULT[level] ?? ""
                h.className = `md-node ${headingClass}`
                h.setAttribute("data-md-type", `h${level}`)
                h.id = slugifyHeading(rest)
                h.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono select-none mr-1">${"#".repeat(level)} </span><span class="md-content">${rest || "\u200B"}</span>`
                blockEl.replaceWith(h)
                const contentEl = h.querySelector(".md-content") ?? h
                placeCaretAtStart(contentEl as HTMLElement)
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

        // 2. Inline-level transformations (*italic*, **bold**, ***bold+italic***, ~~strike~~, `code`, ==highlight==, [link](url), ![img](url))
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
        const boldItalicMatch = beforeCaret.match(/(^|[^\\])(?:\*\*\*|___)(\S(?:.*?\S)?)(?:\*\*\*|___)$/)
        if (boldItalicMatch) {
            const leading = boldItalicMatch[1]
            const inner = boldItalicMatch[2]
            const delim = beforeCaret.endsWith("___") ? "___" : "***"
            const token = `${leading}${delim}${inner}${delim}`
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const strong = document.createElement("strong")
                strong.className = "md-node"
                strong.setAttribute("data-md-type", "bold-italic")
                strong.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">${delim}</span><em class="md-content">${inner}</em><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">${delim}</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(strong, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(strong)
                return true
            }
        }

        // Bold: **text** or __text__
        const doubleBoldMatch = beforeCaret.match(/(^|[^\\])(?:\*\*|__)(\S(?:.*?\S)?)(?:\*\*|__)$/)
        if (doubleBoldMatch) {
            const leading = doubleBoldMatch[1]
            const inner = doubleBoldMatch[2]
            const delim = beforeCaret.endsWith("__") ? "__" : "**"
            const token = `${leading}${delim}${inner}${delim}`
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const strong = document.createElement("strong")
                strong.className = "md-node"
                strong.setAttribute("data-md-type", "bold")
                strong.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">${delim}</span><span class="md-content">${inner}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">${delim}</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(strong, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(strong)
                return true
            }
        }

        // Italic: *text* (single asterisk)
        const singleStarItalicMatch = beforeCaret.match(/(^|[^*\\\s])\*([^*\n\s](?:[^*\n]*[^*\n\s])?)\*$/)
        if (singleStarItalicMatch) {
            const leading = singleStarItalicMatch[1]
            const inner = singleStarItalicMatch[2]
            const token = `${leading}*${inner}*`
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const em = document.createElement("em")
                em.className = "md-node"
                em.setAttribute("data-md-type", "italic")
                em.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">*</span><span class="md-content">${inner}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">*</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(em, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(em)
                return true
            }
        }

        // Italic: _text_ (single underscore)
        const italicUnderscoreMatch = beforeCaret.match(/(^|[^_\\\s])_([^_\n\s](?:[^_\n]*[^_\n\s])?)_$/)
        if (italicUnderscoreMatch) {
            const leading = italicUnderscoreMatch[1]
            const inner = italicUnderscoreMatch[2]
            const token = `${leading}_${inner}_`
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const em = document.createElement("em")
                em.className = "md-node"
                em.setAttribute("data-md-type", "italic")
                em.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">_</span><span class="md-content">${inner}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">_</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(em, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(em)
                return true
            }
        }

        // Strikethrough: ~~text~~
        const strikeMatch = beforeCaret.match(/(^|[^\\])~~([^~\n]+?)~~$/)
        if (strikeMatch) {
            const leading = strikeMatch[1]
            const inner = strikeMatch[2]
            const token = `${leading}~~${inner}~~`
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const del = document.createElement("del")
                del.className = "md-node line-through text-muted-foreground"
                del.setAttribute("data-md-type", "strikethrough")
                del.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">~~</span><span class="md-content">${inner}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">~~</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(del, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(del)
                return true
            }
        }

        // Inline code: `code`
        const codeMatch = beforeCaret.match(/(^|[^\\])`([^`\n]+?)`$/)
        if (codeMatch) {
            const leading = codeMatch[1]
            const inner = codeMatch[2]
            const token = `${leading}\`${inner}\``
            const startIdx = beforeCaret.length - token.length + leading.length
            const prefixText = fullText.slice(0, startIdx)
            const parentNode = textNode.parentNode
            if (parentNode) {
                const code = document.createElement("code")
                code.className =
                    "md-node rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400"
                code.setAttribute("data-md-type", "code")
                code.innerHTML = `<span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">\`</span><span class="md-content">${inner}</span><span class="md-syntax text-muted-foreground/60 font-mono text-xs select-none">\`</span>`
                if (prefixText) parentNode.insertBefore(document.createTextNode(prefixText), textNode)
                parentNode.insertBefore(code, textNode)
                if (afterCaret) parentNode.insertBefore(document.createTextNode(afterCaret), textNode)
                parentNode.removeChild(textNode)
                placeCaretAfter(code)
                return true
            }
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
    }, [editorRef, headingClasses, placeCaretAtStart])

    const result = tryLiveTransform as UseLiveTransformReturn
    result.tryLiveTransform = tryLiveTransform
    return result
}
