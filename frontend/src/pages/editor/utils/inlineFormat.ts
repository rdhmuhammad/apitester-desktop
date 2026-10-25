export type InlineFormat = "bold" | "italic"

const SYNTAX_CLASS = "md-syntax text-muted-foreground/60 font-mono text-xs select-none"
const FORMAT_TAG: Record<InlineFormat, string> = {bold: "strong", italic: "em"}
const FORMAT_DELIM: Record<InlineFormat, string> = {bold: "**", italic: "*"}
const FORMAT_SELECTOR: Record<InlineFormat, string> = {bold: "strong,b", italic: "em,i"}
const SKIP_SELECTOR = ".md-syntax,pre,code,[data-code-block]"

/** Splits a string into [leading whitespace, trimmed core, trailing whitespace]. */
const splitWhitespace = (text: string): [string, string, string] => {
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
    return m ? [m[1], m[2], m[3]] : ["", text, ""]
}

const syntaxSpan = (doc: Document, delim: string): HTMLElement => {
    const span = doc.createElement("span")
    span.className = SYNTAX_CLASS
    span.textContent = delim
    return span
}

/** Builds the canonical live-mode element: `<strong|em><syntax/><span.md-content/><syntax/></strong|em>`. */
const buildFormatEl = (doc: Document, format: InlineFormat): {el: HTMLElement; content: HTMLElement} => {
    const el = doc.createElement(FORMAT_TAG[format])
    el.className = "md-node"
    el.setAttribute("data-md-type", format)
    const content = doc.createElement("span")
    content.className = "md-content"
    el.append(syntaxSpan(doc, FORMAT_DELIM[format]), content, syntaxSpan(doc, FORMAT_DELIM[format]))
    return {el, content}
}

const formatOf = (el: Element): InlineFormat | null => {
    const tag = el.tagName.toLowerCase()
    if (tag === "strong" || tag === "b") return "bold"
    if (tag === "em" || tag === "i") return "italic"
    return null
}

const hasClass = (node: Node | null, cls: string): node is HTMLElement =>
    node?.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains(cls)

const isCanonical = (el: HTMLElement): boolean => {
    const kids = el.childNodes
    return (
        el.classList.contains("md-node") &&
        kids.length === 3 &&
        hasClass(kids[0], "md-syntax") &&
        hasClass(kids[2], "md-syntax") &&
        hasClass(kids[1], "md-content") &&
        (kids[1] as HTMLElement).tagName === "SPAN"
    )
}

/** Rebuilds every bold/italic element (inner first) into canonical form, e.g. parser `***x***` and `<b>`/`<i>`. */
const canonicalizeAll = (root: HTMLElement) => {
    const els = Array.from(root.querySelectorAll<HTMLElement>("strong,b,em,i")).reverse()
    els.forEach((el) => {
        const format = formatOf(el)
        if (!format || isCanonical(el)) return
        const next = buildFormatEl(root.ownerDocument, format)
        Array.from(el.childNodes).forEach((child) => {
            if (hasClass(child, "md-syntax")) return
            if (hasClass(child, "md-content") && (child as HTMLElement).tagName === "SPAN") {
                while (child.firstChild) next.content.appendChild(child.firstChild)
            } else {
                next.content.appendChild(child)
            }
        })
        el.replaceWith(next.el)
    })
}

/** Text nodes of `scope` that are real content (not syntax markers or code). */
const contentTextNodes = (scope: Node): Text[] => {
    const out: Text[] = []
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.parentElement?.closest(SKIP_SELECTOR))) out.push(n as Text)
    }
    return out
}

/** Splits boundary text nodes so the range covers whole text nodes, returning those nodes. */
const collectPortions = (root: HTMLElement, range: Range): Text[] => {
    const portions: Text[] = []
    contentTextNodes(root).forEach((node) => {
        if (!range.intersectsNode(node)) return
        let start = node === range.startContainer ? range.startOffset : 0
        let end = node === range.endContainer ? range.endOffset : node.length
        if (end <= start) return
        let target = node
        if (start > 0) {
            target = target.splitText(start)
            end -= start
            start = 0
        }
        if (end < target.length) target.splitText(end)
        portions.push(target)
    })
    return portions
}

const closestFormatEl = (node: Node, format: InlineFormat, root: HTMLElement): HTMLElement | null => {
    const el = node.parentElement?.closest<HTMLElement>(FORMAT_SELECTOR[format]) ?? null
    return el && root.contains(el) && el !== root ? el : null
}

/**
 * Wraps a text node in a format element. Surrounding whitespace is kept outside the delimiters
 * so the serialized markdown (`**text** `) stays valid. Returns the wrapper and the right-most piece.
 */
const wrapTextNode = (
    node: Text,
    format: InlineFormat
): {wrapper: HTMLElement; last: Text} | null => {
    const [lead, core, trail] = splitWhitespace(node.data)
    if (!core || !node.parentNode) return null
    let coreNode = node
    if (lead) coreNode = node.splitText(lead.length)
    const trailNode = trail ? coreNode.splitText(core.length) : null
    const {el, content} = buildFormatEl(node.ownerDocument, format)
    coreNode.parentNode!.insertBefore(el, coreNode)
    content.appendChild(coreNode)
    return {wrapper: el, last: trailNode ?? coreNode}
}

/** Dissolves a format element, re-wrapping the leaves that are not in `selected` so only the selection loses the format. */
const unwrapFormatEl = (el: HTMLElement, format: InlineFormat, selected: Set<Text>): HTMLElement[] => {
    const leaves = contentTextNodes(el)
    const parent = el.parentNode!
    const moved: Node[] = []
    Array.from(el.childNodes).forEach((child) => {
        if (hasClass(child, "md-syntax")) return
        if (hasClass(child, "md-content") && (child as HTMLElement).tagName === "SPAN") {
            moved.push(...Array.from(child.childNodes))
        } else {
            moved.push(child)
        }
    })
    moved.forEach((child) => parent.insertBefore(child, el))
    parent.removeChild(el)
    const created: HTMLElement[] = []
    leaves.forEach((leaf) => {
        if (selected.has(leaf)) return
        const wrapped = wrapTextNode(leaf, format)
        if (wrapped) created.push(wrapped.wrapper)
    })
    return created
}

const isWhitespaceText = (node: Node | null): node is Text =>
    node?.nodeType === Node.TEXT_NODE && /^\s+$/.test((node as Text).data)

const sameFormatEl = (node: Node | null, format: InlineFormat): node is HTMLElement =>
    node?.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === FORMAT_TAG[format]

/** Merges `el` with the next same-format sibling (also across a whitespace-only text node). */
const mergeForward = (el: HTMLElement, format: InlineFormat) => {
    const content = el.querySelector<HTMLElement>(":scope > .md-content")
    if (!content) return
    for (;;) {
        const gap = isWhitespaceText(el.nextSibling) ? (el.nextSibling as Text) : null
        const next = gap ? gap.nextSibling : el.nextSibling
        if (!sameFormatEl(next, format)) return
        if (gap) content.appendChild(gap)
        const nextContent = next.querySelector<HTMLElement>(":scope > .md-content")
        while (nextContent?.firstChild) content.appendChild(nextContent.firstChild)
        next.remove()
    }
}

const mergeAround = (created: HTMLElement[], format: InlineFormat) => {
    created.forEach((el) => {
        if (!el.isConnected) return
        let prev = el.previousSibling
        if (isWhitespaceText(prev)) prev = prev.previousSibling
        if (sameFormatEl(prev, format)) mergeForward(prev, format)
        if (el.isConnected) mergeForward(el, format)
    })
}

const selectNodes = (first: Text, last: Text) => {
    const doc = first.ownerDocument
    const sel = doc.getSelection()
    if (!sel) return
    const range = doc.createRange()
    range.setStart(first, 0)
    range.setEnd(last, last.length)
    sel.removeAllRanges()
    sel.addRange(range)
}

const toggleCollapsed = (root: HTMLElement, range: Range, format: InlineFormat): boolean => {
    const anchor = range.startContainer
    const el = closestFormatEl(anchor, format, root)
    const caret = anchor.nodeType === Node.TEXT_NODE ? {node: anchor as Text, offset: range.startOffset} : null
    canonicalizeAll(root)
    if (el) {
        const target = el.isConnected ? el : closestFormatEl(anchor, format, root)
        if (!target) return false
        unwrapFormatEl(target, format, new Set(contentTextNodes(target)))
    } else {
        const {el: wrapper, content} = buildFormatEl(root.ownerDocument, format)
        const placeholder = root.ownerDocument.createTextNode(format === "bold" ? "Bold text" : "Italic text")
        content.appendChild(placeholder)
        range.insertNode(wrapper)
        selectNodes(placeholder, placeholder)
        return true
    }
    if (caret && caret.node.isConnected) {
        const r = root.ownerDocument.createRange()
        r.setStart(caret.node, caret.offset)
        r.collapse(true)
        const sel = root.ownerDocument.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(r)
    }
    return true
}

/**
 * Toggles bold/italic on the range inside the live editor DOM without re-rendering the document,
 * so the text selection is preserved. Returns true when the DOM changed.
 */
export const toggleInlineFormat = (root: HTMLElement, range: Range, format: InlineFormat): boolean => {
    if (range.collapsed) return toggleCollapsed(root, range, format)

    const portions = collectPortions(root, range)
    if (!portions.some((p) => p.data.trim())) return false
    canonicalizeAll(root)

    const core = portions.filter((p) => p.data.trim())
    const allFormatted = core.every((p) => closestFormatEl(p, format, root))
    const created: HTMLElement[] = []
    let lastNode = portions[portions.length - 1]

    if (allFormatted) {
        const selected = new Set(portions)
        for (let guard = 0; guard < 1000; guard++) {
            const hit = portions.find((p) => closestFormatEl(p, format, root))
            if (!hit) break
            created.push(...unwrapFormatEl(closestFormatEl(hit, format, root)!, format, selected))
        }
    } else {
        portions.forEach((p) => {
            if (!p.data.trim() || closestFormatEl(p, format, root)) return
            const wrapped = wrapTextNode(p, format)
            if (!wrapped) return
            created.push(wrapped.wrapper)
            if (p === lastNode) lastNode = wrapped.last
        })
    }

    mergeAround(created, format)
    selectNodes(portions[0], lastNode)
    return true
}

/** Toggles `*`-delimited bold/italic on a markdown source selection. Returns the new text and selection. */
export const toggleMarkdownFormat = (
    markdown: string,
    start: number,
    end: number,
    format: InlineFormat
): {text: string; selStart: number; selEnd: number} => {
    const bit = format === "bold" ? 2 : 1
    const selected = markdown.slice(start, end)
    const [lead, core, trail] = splitWhitespace(selected)
    if (!core) {
        const placeholder = format === "bold" ? "bold text" : "italic text"
        const stars = "*".repeat(bit)
        const text = markdown.slice(0, start) + stars + placeholder + stars + markdown.slice(end)
        return {text, selStart: start + bit, selEnd: start + bit + placeholder.length}
    }

    let from = start + lead.length
    let to = end - trail.length
    let inner = core
    let level = 0
    const wrapped = core.match(/^(\*{1,3})(?=\S)([\s\S]*?\S)\1$/)
    const innerHasRun = (m: RegExpMatchArray) =>
        m[1].length === 1 ? /(^|[^*])\*([^*]|$)/.test(m[2]) : m[2].includes(m[1])
    if (wrapped && !innerHasRun(wrapped)) {
        level = wrapped[1].length
        inner = wrapped[2]
    } else {
        for (let k = 3; k >= 1; k--) {
            const stars = "*".repeat(k)
            if (from - k >= 0 && markdown.slice(from - k, from) === stars && markdown.slice(to, to + k) === stars) {
                level = k
                from -= k
                to += k
                break
            }
        }
    }

    const nextStars = "*".repeat(level ^ bit)
    // adding bold over text that already holds bold pieces merges them into the single new pair
    if (format === "bold" && !(level & bit)) inner = inner.replace(/\*\*/g, "")
    const replacement = `${nextStars}${inner}${nextStars}`
    const text = markdown.slice(0, from) + replacement + markdown.slice(to)
    return {
        text,
        selStart: from + nextStars.length,
        selEnd: from + nextStars.length + inner.length,
    }
}
