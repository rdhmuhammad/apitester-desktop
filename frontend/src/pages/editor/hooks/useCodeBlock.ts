import {useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject} from "react"

export type CodeLanguage =
    | "go"
    | "javascript"
    | "java"
    | "typescript"
    | "c#"
    | "c++"
    | "python"
    | "html"
    | "md"
    | "css"
    | "xml"

export const SUPPORTED_CODE_LANGUAGES: readonly CodeLanguage[] = [
    "go",
    "javascript",
    "java",
    "typescript",
    "c#",
    "c++",
    "python",
    "html",
    "md",
    "css",
    "xml",
] as const

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
    go: "go",
    golang: "go",
    javascript: "javascript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    java: "java",
    typescript: "typescript",
    typscript: "typescript",
    ts: "typescript",
    tsx: "typescript",
    "c#": "c#",
    csharp: "c#",
    cs: "c#",
    dotnet: "c#",
    "c++": "c++",
    cpp: "c++",
    cc: "c++",
    cxx: "c++",
    c: "c++",
    hpp: "c++",
    h: "c++",
    python: "python",
    py: "python",
    html: "html",
    htm: "html",
    md: "md",
    markdown: "md",
    css: "css",
    scss: "css",
    less: "css",
    xml: "xml",
    svg: "xml",
    xhtml: "xml",
}

export const normalizeCodeLanguage = (lang?: string | null): CodeLanguage | null => {
    if (!lang) return null
    const key = lang.trim().toLowerCase()
    return LANGUAGE_ALIASES[key] ?? null
}

const escapeHtml = (str: string): string =>
    str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")

const span = (cls: string, text: string): string => `<span class="${cls}">${escapeHtml(text)}</span>`

interface CodeLangSpec {
    keywords: Set<string>
    types: Set<string>
    commentPattern: string
    stringPattern: string
    metaPattern?: string
}

const C_COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`
const PY_COMMENT = String.raw`#[^\n]*`
const BACKTICK_AND_QUOTES = String.raw`\`[\s\S]*?\`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`
const QUOTES_ONLY = String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`

const LANG_SPECS: Record<Exclude<CodeLanguage, "html" | "xml" | "css" | "md">, CodeLangSpec> = {
    go: {
        keywords: new Set([
            "break", "case", "chan", "const", "continue", "default", "defer", "else",
            "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
            "map", "package", "range", "return", "select", "struct", "switch", "type", "var",
        ]),
        types: new Set([
            "bool", "byte", "comparable", "complex64", "complex128", "error", "float32", "float64",
            "int", "int8", "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16",
            "uint32", "uint64", "uintptr", "any", "true", "false", "nil", "iota",
            "append", "cap", "clear", "close", "complex", "copy", "delete", "imag", "len",
            "make", "max", "min", "new", "panic", "print", "println", "real", "recover",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: BACKTICK_AND_QUOTES,
    },
    javascript: {
        keywords: new Set([
            "async", "await", "break", "case", "catch", "class", "const", "continue",
            "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
            "for", "from", "function", "get", "if", "import", "in", "instanceof", "let",
            "new", "of", "return", "set", "static", "super", "switch", "this", "throw",
            "try", "typeof", "var", "void", "while", "with", "yield",
        ]),
        types: new Set([
            "true", "false", "null", "undefined", "NaN", "Infinity", "globalThis",
            "window", "document", "console", "Promise", "Array", "Object", "String",
            "Number", "Boolean", "Map", "Set", "WeakMap", "WeakSet", "Symbol", "BigInt",
            "Error", "RegExp", "Date", "JSON", "Math",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: BACKTICK_AND_QUOTES,
        metaPattern: String.raw`@[a-zA-Z_$][a-zA-Z0-9_$]*`,
    },
    typescript: {
        keywords: new Set([
            "abstract", "as", "asserts", "async", "await", "break", "case", "catch", "class",
            "const", "continue", "debugger", "declare", "default", "delete", "do", "else",
            "enum", "export", "extends", "finally", "for", "from", "function", "get", "if",
            "implements", "import", "in", "infer", "instanceof", "interface", "is", "keyof",
            "let", "module", "namespace", "new", "of", "override", "private", "protected",
            "public", "readonly", "return", "satisfies", "set", "static", "super", "switch",
            "this", "throw", "try", "type", "typeof", " unique", "var", "void", "while", "with", "yield",
        ]),
        types: new Set([
            "any", "boolean", "bigint", "never", "null", "number", "object", "string",
            "symbol", "undefined", "unknown", "void", "true", "false", "NaN", "Infinity",
            "Partial", "Required", "Readonly", "Record", "Pick", "Omit", "Exclude", "Extract",
            "NonNullable", "Parameters", "ReturnType", "InstanceType", "Promise", "Array", "Map", "Set",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: BACKTICK_AND_QUOTES,
        metaPattern: String.raw`@[a-zA-Z_$][a-zA-Z0-9_$]*`,
    },
    java: {
        keywords: new Set([
            "abstract", "assert", "break", "case", "catch", "class", "const", "continue",
            "default", "do", "else", "enum", "extends", "final", "finally", "for", "goto",
            "if", "implements", "import", "instanceof", "interface", "native", "new",
            "non-sealed", "package", "permits", "private", "protected", "public", "record",
            "return", "sealed", "static", "strictfp", "super", "switch", "synchronized",
            "this", "throw", "throws", "transient", "try", "var", "volatile", "while", "yield",
        ]),
        types: new Set([
            "boolean", "byte", "char", "double", "float", "int", "long", "short", "void",
            "true", "false", "null", "String", "Object", "Integer", "Long", "Double",
            "Float", "Boolean", "List", "Map", "Set", "Optional", "Stream", "System",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: String.raw`"""[\s\S]*?"""|${QUOTES_ONLY}`,
        metaPattern: String.raw`@[a-zA-Z_][a-zA-Z0-9_]*`,
    },
    "c#": {
        keywords: new Set([
            "abstract", "as", "async", "await", "base", "break", "case", "catch", "checked",
            "class", "const", "continue", "default", "delegate", "do", "else", "enum", "event",
            "explicit", "extern", "finally", "fixed", "for", "foreach", "from", "get", "goto",
            "if", "implicit", "in", "init", "interface", "internal", "is", "lock", "namespace",
            "new", "not", "operator", "out", "override", "params", "partial", "private",
            "protected", "public", "readonly", "record", "ref", "required", "return", "sealed",
            "select", "set", "sizeof", "stackalloc", "static", "struct", "switch", "this",
            "throw", "try", "typeof", "unchecked", "unsafe", "using", "value", "var", "virtual",
            "volatile", "when", "where", "while", "with", "yield",
        ]),
        types: new Set([
            "bool", "byte", "char", "decimal", "double", "dynamic", "float", "int", "long",
            "nint", "nuint", "object", "sbyte", "short", "string", "uint", "ulong", "ushort",
            "void", "true", "false", "null", "Task", "List", "Dictionary", "IEnumerable", "Console",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: String.raw`(?:@|\$|\$@|@\$)"(?:""|\\.|[^"])*"|${QUOTES_ONLY}`,
        metaPattern: String.raw`^[ \t]*#[a-zA-Z_]\w*`,
    },
    "c++": {
        keywords: new Set([
            "alignas", "alignof", "and", "asm", "auto", "bitand", "bitor", "break", "case",
            "catch", "class", "co_await", "co_return", "co_yield", "compl", "concept", "const",
            "consteval", "constexpr", "constinit", "const_cast", "continue", "decltype", "default",
            "delete", "do", "dynamic_cast", "else", "enum", "explicit", "export", "extern",
            "final", "for", "friend", "goto", "if", "inline", "mutable", "namespace", "new",
            "noexcept", "not", "operator", "or", "override", "private", "protected", "public",
            "register", "reinterpret_cast", "requires", "return", "sizeof", "static",
            "static_assert", "static_cast", "struct", "switch", "template", "this", "thread_local",
            "throw", "try", "typedef", "typeid", "typename", "union", "using", "virtual",
            "volatile", "while", "xor",
        ]),
        types: new Set([
            "bool", "char", "char8_t", "char16_t", "char32_t", "double", "float", "int", "long",
            "short", "signed", "unsigned", "void", "wchar_t", "size_t", "int8_t", "int16_t",
            "int32_t", "int64_t", "uint8_t", "uint16_t", "uint32_t", "uint64_t", "true",
            "false", "nullptr", "NULL", "std", "string", "vector", "map", "set", "unique_ptr", "shared_ptr",
        ]),
        commentPattern: C_COMMENT,
        stringPattern: String.raw`R"\([^\)]*\)"|${QUOTES_ONLY}`,
        metaPattern: String.raw`^[ \t]*#[a-zA-Z_]\w*(?:[ \t]+<[^>\n]+>)?`,
    },
    python: {
        keywords: new Set([
            "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
            "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
            "import", "in", "is", "lambda", "match", "nonlocal", "not", "or", "pass",
            "raise", "return", "try", "case", "while", "with", "yield",
        ]),
        types: new Set([
            "True", "False", "None", "self", "cls", "int", "float", "str", "bool", "list",
            "dict", "set", "tuple", "bytes", "object", "type", "range", "len", "print",
            "enumerate", "zip", "map", "filter", "super", "isinstance", "Exception",
        ]),
        commentPattern: PY_COMMENT,
        stringPattern: String.raw`(?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')`,
        metaPattern: String.raw`@[a-zA-Z_][a-zA-Z0-9_.]*`,
    },
}

const highlightMarkupAttributes = (attrs: string): string => {
    const attrRegex = /([a-zA-Z0-9:._-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'=<>`]+)|([a-zA-Z0-9:._-]+)/g
    let out = ""
    let lastIdx = 0
    for (const m of attrs.matchAll(attrRegex)) {
        const idx = m.index ?? 0
        out += escapeHtml(attrs.slice(lastIdx, idx))
        if (m[1]) {
            out += span("text-sky-300", m[1]) + span("text-slate-400", m[2]) + span("text-emerald-400", m[3])
        } else if (m[4]) {
            out += span("text-sky-300", m[4])
        }
        lastIdx = idx + m[0].length
    }
    out += escapeHtml(attrs.slice(lastIdx))
    return out
}

const highlightHtmlOrXml = (code: string): string => {
    const tokenRegex = /(<!--[\s\S]*?-->)|(<!\[CDATA\[[\s\S]*?\]\]>|<![a-zA-Z][\s\S]*?>|<\?[\s\S]*?\?>)|(<\/?)([a-zA-Z0-9:._-]+)((?:\s+[^<>]*?)?)(\/?>)|(&[a-zA-Z0-9#]+;)/g
    let out = ""
    let lastIdx = 0
    for (const m of code.matchAll(tokenRegex)) {
        const idx = m.index ?? 0
        out += escapeHtml(code.slice(lastIdx, idx))
        if (m[1]) {
            out += span("text-slate-500 italic", m[1])
        } else if (m[2]) {
            out += span("text-purple-400", m[2])
        } else if (m[3] && m[4] && m[6]) {
            out +=
                span("text-slate-400", m[3]) +
                span("text-rose-400 font-medium", m[4]) +
                (m[5] ? highlightMarkupAttributes(m[5]) : "") +
                span("text-slate-400", m[6])
        } else if (m[7]) {
            out += span("text-amber-300", m[7])
        }
        lastIdx = idx + m[0].length
    }
    out += escapeHtml(code.slice(lastIdx))
    return out
}

const highlightCss = (code: string): string => {
    const tokenRegex = /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(@[a-zA-Z_-]+)|([a-zA-Z-]+)(\s*:)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|fr|ch|ex)?\b)|([.#][a-zA-Z_][a-zA-Z0-9_-]*|::?[a-zA-Z_-]+)|(!important\b|\b(?:var|calc|rgb|rgba|hsl|hsla|url|linear-gradient|radial-gradient|none|auto|inherit|initial|unset|solid|flex|grid|block|inline|absolute|relative|fixed|sticky|hidden|visible)\b)/g
    let out = ""
    let lastIdx = 0
    for (const m of code.matchAll(tokenRegex)) {
        const idx = m.index ?? 0
        out += escapeHtml(code.slice(lastIdx, idx))
        if (m[1]) {
            out += span("text-slate-500 italic", m[1])
        } else if (m[2]) {
            out += span("text-emerald-400", m[2])
        } else if (m[3]) {
            out += span("text-purple-400 font-medium", m[3])
        } else if (m[4] && m[5]) {
            out += span("text-sky-300", m[4]) + escapeHtml(m[5])
        } else if (m[6]) {
            out += span("text-orange-400", m[6])
        } else if (m[7]) {
            out += span("text-amber-300", m[7])
        } else if (m[8]) {
            out += span("text-rose-400", m[8])
        }
        lastIdx = idx + m[0].length
    }
    out += escapeHtml(code.slice(lastIdx))
    return out
}

const highlightMarkdown = (code: string): string => {
    const tokenRegex = /(`{3}[\s\S]*?`{3}|`[^`\n]+`)|(^[ \t]*#{1,6}[ \t]+[^\n]*)|(^[ \t]*>[ \t]?[^\n]*)|(^[ \t]*(?:[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+\.[ \t]+))|(!?\[[^\]]*\]\([^)\n]*\))|((?:\*\*|__)(?=\S)[^\n]*?\S(?:\*\*|__)|~~(?=\S)[^\n]*?\S~~|(?:\*|_)(?=\S)[^\n*]+?\S(?:\*|_))/gm
    let out = ""
    let lastIdx = 0
    for (const m of code.matchAll(tokenRegex)) {
        const idx = m.index ?? 0
        out += escapeHtml(code.slice(lastIdx, idx))
        if (m[1]) {
            out += span("text-emerald-400", m[1])
        } else if (m[2]) {
            out += span("text-sky-400 font-semibold", m[2])
        } else if (m[3]) {
            out += span("text-slate-400 italic", m[3])
        } else if (m[4]) {
            out += span("text-purple-400 font-medium", m[4])
        } else if (m[5]) {
            out += span("text-indigo-400 underline", m[5])
        } else if (m[6]) {
            out += span("text-amber-300 font-medium", m[6])
        }
        lastIdx = idx + m[0].length
    }
    out += escapeHtml(code.slice(lastIdx))
    return out
}

const highlightProgrammingLang = (code: string, spec: CodeLangSpec): string => {
    const numberPattern = String.raw`\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+)?[fFdDlLuUmM]*)\b`
    const parts = [
        `(?<comment>${spec.commentPattern})`,
        `(?<string>${spec.stringPattern})`,
        spec.metaPattern ? `(?<meta>${spec.metaPattern})` : null,
        `(?<number>${numberPattern})`,
        `(?<ident>\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)`,
    ].filter(Boolean)
    const masterRegex = new RegExp(parts.join("|"), "gm")

    let out = ""
    let lastIdx = 0
    for (const m of code.matchAll(masterRegex)) {
        const idx = m.index ?? 0
        out += escapeHtml(code.slice(lastIdx, idx))
        const groups = m.groups ?? {}
        if (groups.comment !== undefined) {
            out += span("text-slate-500 italic", m[0])
        } else if (groups.string !== undefined) {
            out += span("text-emerald-400", m[0])
        } else if (groups.meta !== undefined) {
            out += span("text-rose-400", m[0])
        } else if (groups.number !== undefined) {
            out += span("text-orange-400", m[0])
        } else if (groups.ident !== undefined) {
            const ident = groups.ident
            const rest = code.slice(idx + ident.length)
            if (spec.keywords.has(ident)) {
                out += span("text-purple-400 font-medium", ident)
            } else if (spec.types.has(ident) || /^[A-Z][a-zA-Z0-9_]*$/.test(ident)) {
                out += span("text-amber-300", ident)
            } else if (/^\s*\(/.test(rest)) {
                out += span("text-sky-400", ident)
            } else {
                out += escapeHtml(ident)
            }
        } else {
            out += escapeHtml(m[0])
        }
        lastIdx = idx + m[0].length
    }
    out += escapeHtml(code.slice(lastIdx))
    return out
}

export const formatCodeSyntax = (code: string, lang?: string | null): string => {
    const clean = code.replace(/\u200B/g, "")
    if (!clean) return "\u200B"
    const normalized = normalizeCodeLanguage(lang)
    let highlighted: string
    if (!normalized) {
        highlighted = escapeHtml(clean)
    } else if (normalized === "html" || normalized === "xml") {
        highlighted = highlightHtmlOrXml(clean)
    } else if (normalized === "css") {
        highlighted = highlightCss(clean)
    } else if (normalized === "md") {
        highlighted = highlightMarkdown(clean)
    } else {
        highlighted = highlightProgrammingLang(clean, LANG_SPECS[normalized])
    }
    return clean.endsWith("\n") ? `${highlighted}\u200B` : highlighted
}

export const buildCodeBlockHtml = (code = "", lang = ""): string => {
    const safeLang = escapeHtml(lang.trim())
    const innerHtml = formatCodeSyntax(code, lang)
    return `<div class="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-slate-100 transition-colors" data-code-block="true" data-lang="${safeLang}"><div contenteditable="false" data-code-header="true" class="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs font-mono text-slate-400 select-none transition-colors"><div class="flex items-center gap-1.5"><span class="text-[10px] uppercase tracking-wider text-slate-500">Language:</span><input type="text" data-lang-input="true" list="code-block-languages" value="${safeLang}" placeholder="plaintext" class="bg-transparent text-xs font-mono text-sky-400 placeholder:text-slate-600 focus:outline-none focus:ring-0 w-28" /></div><span class="text-[10px] text-slate-500">Code Block</span></div><pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><code contenteditable="true" spellcheck="false">${innerHtml}</code></pre></div>`
}

export const createCodeBlockElement = (code = "", lang = ""): HTMLDivElement => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = buildCodeBlockHtml(code, lang)
    return wrapper.firstElementChild as HTMLDivElement
}

const getOffsetInCode = (codeEl: HTMLElement, targetNode: Node, targetOffset: number): number => {
    const r = document.createRange()
    r.selectNodeContents(codeEl)
    r.setEnd(targetNode, targetOffset)
    return r.toString().replace(/\u200B/g, "").length
}

export const getCodeCaretOffsets = (codeEl: HTMLElement): {start: number; end: number} | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!codeEl.contains(range.startContainer) || !codeEl.contains(range.endContainer)) return null
    return {
        start: getOffsetInCode(codeEl, range.startContainer, range.startOffset),
        end: getOffsetInCode(codeEl, range.endContainer, range.endOffset),
    }
}

const findTextPosition = (codeEl: HTMLElement, charOffset: number): {node: Node; offset: number} => {
    const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
    let remaining = charOffset
    let lastText: Text | null = null
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        lastText = n
        const data = n.data
        for (let i = 0; i < data.length; i++) {
            if (data[i] === "\u200B") continue
            if (remaining === 0) {
                return {node: n, offset: i}
            }
            remaining--
        }
        if (remaining === 0) {
            const trailingOffset = data.endsWith("\u200B") ? data.length - 1 : data.length
            return {node: n, offset: trailingOffset}
        }
    }
    if (lastText) {
        const trailingOffset = lastText.data.endsWith("\u200B") ? lastText.data.length - 1 : lastText.data.length
        return {node: lastText, offset: trailingOffset}
    }
    return {node: codeEl, offset: 0}
}

export const setCodeCaretOffsets = (codeEl: HTMLElement, start: number, end = start): void => {
    const sel = window.getSelection()
    if (!sel) return
    const startPos = findTextPosition(codeEl, start)
    const endPos = start === end ? startPos : findTextPosition(codeEl, end)
    const r = document.createRange()
    r.setStart(startPos.node, startPos.offset)
    r.setEnd(endPos.node, endPos.offset)
    sel.removeAllRanges()
    sel.addRange(r)
}

const setCodeBlockSelectedVisual = (block: HTMLElement, selected: boolean) => {
    const header = block.querySelector<HTMLElement>("[data-code-header='true']") ?? (block.firstElementChild as HTMLElement | null)
    if (header && header.tagName.toLowerCase() === "div") {
        header.setAttribute("contenteditable", "false")
        header.setAttribute("data-code-header", "true")
    }
    if (selected) {
        block.setAttribute("data-code-selected", "true")
        block.classList.remove("border-slate-800", "bg-slate-900")
        block.classList.add("border-indigo-500", "bg-indigo-950", "ring-2", "ring-indigo-500/40")
        if (header && header.tagName.toLowerCase() === "div") {
            header.classList.remove("border-slate-800", "bg-slate-950/60")
            header.classList.add("border-indigo-500/60", "bg-indigo-900/70")
        }
    } else {
        block.removeAttribute("data-code-selected")
        block.removeAttribute("data-header-selected")
        block.classList.remove("border-indigo-500", "bg-indigo-950", "ring-2", "ring-indigo-500/40")
        block.classList.add("border-slate-800", "bg-slate-900")
        if (header && header.tagName.toLowerCase() === "div") {
            header.classList.remove("border-indigo-500/60", "bg-indigo-900/70")
            header.classList.add("border-slate-800", "bg-slate-950/60")
        }
    }
}

const isEntireCodeBlockSelected = (block: HTMLElement, range: Range): boolean => {
    if (block.getAttribute("data-header-selected") === "true") return true
    if (range.collapsed || !range.intersectsNode(block)) return false

    const codeEl = block.querySelector<HTMLElement>("code")
    if (!codeEl) return true

    const startsInsideCode = codeEl.contains(range.startContainer)
    const endsInsideCode = codeEl.contains(range.endContainer)

    // Selection spans outside `<code>` (e.g., dragged across the code block or its header)
    if (!startsInsideCode || !endsInsideCode) {
        return true
    }

    const codeText = (codeEl.textContent ?? "").replace(/\u200B/g, "")
    if (!codeText) return true

    const startOffset = getOffsetInCode(codeEl, range.startContainer, range.startOffset)
    const endOffset = getOffsetInCode(codeEl, range.endContainer, range.endOffset)
    return startOffset === 0 && endOffset >= codeText.length
}

export interface UseCodeBlockParams {
    editorRef: RefObject<HTMLDivElement | null>
    placeCaretAtStart: (el: HTMLElement) => void
    onSyncMarkdown: (updateDom?: boolean) => void
}

export interface UseCodeBlockReturn {
    handleCodeBlockKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => boolean
    handleCodeBlockInput: (e?: React.FormEvent<HTMLDivElement>) => void
    handleCodeBlockClick: (e: ReactMouseEvent<HTMLDivElement>) => boolean
    updateCodeBlockSelection: () => void
    formatCodeSyntax: typeof formatCodeSyntax
    buildCodeBlockHtml: typeof buildCodeBlockHtml
}

export const useCodeBlock = ({
    editorRef,
    placeCaretAtStart,
    onSyncMarkdown,
}: UseCodeBlockParams): UseCodeBlockReturn => {
    const removeCodeBlockElement = useCallback(
        (block: HTMLElement) => {
            const p = document.createElement("p")
            p.className = "my-2.5 leading-7 text-foreground"
            p.innerHTML = "<br />"
            block.replaceWith(p)
            placeCaretAtStart(p)
            onSyncMarkdown(false)
        },
        [onSyncMarkdown, placeCaretAtStart]
    )

    const updateCodeBlockSelection = useCallback(() => {
        const root = editorRef.current
        if (!root) return
        const sel = window.getSelection()
        const hasRange = Boolean(sel && sel.rangeCount > 0 && root.contains(sel.getRangeAt(0).commonAncestorContainer))
        const range = hasRange && sel ? sel.getRangeAt(0) : null

        root.querySelectorAll<HTMLElement>("div[data-code-block='true']").forEach((block) => {
            const selected = range ? isEntireCodeBlockSelected(block, range) : false
            setCodeBlockSelectedVisual(block, selected)
        })
    }, [editorRef])

    useEffect(() => {
        document.addEventListener("selectionchange", updateCodeBlockSelection)
        return () => {
            document.removeEventListener("selectionchange", updateCodeBlockSelection)
        }
    }, [updateCodeBlockSelection])

    const handleCodeBlockInput = useCallback(
        (e?: React.FormEvent<HTMLDivElement>) => {
            const root = editorRef.current
            if (!root) return

            const target = e?.target as HTMLElement | undefined
            if (target?.getAttribute("data-lang-input") === "true") {
                const input = target as HTMLInputElement
                const block = input.closest<HTMLElement>("div[data-code-block='true']")
                if (block) {
                    const lang = input.value.trim()
                    block.setAttribute("data-lang", lang)
                    const codeEl = block.querySelector<HTMLElement>("code")
                    if (codeEl) {
                        const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                        codeEl.innerHTML = formatCodeSyntax(rawCode, lang)
                    }
                }
                return
            }

            root.querySelectorAll<HTMLElement>("div[data-code-block='true']").forEach((block) => {
                const codeEl = block.querySelector<HTMLElement>("code")
                const headerEl = block.querySelector<HTMLElement>("[data-code-header='true'], input[data-lang-input='true']")
                if (!codeEl || !headerEl) {
                    block.remove()
                    return
                }
                const headerDiv = block.firstElementChild as HTMLElement | null
                if (headerDiv && headerDiv.tagName.toLowerCase() === "div") {
                    headerDiv.setAttribute("contenteditable", "false")
                    headerDiv.setAttribute("data-code-header", "true")
                }

                const langInput = block.querySelector<HTMLInputElement>("input[data-lang-input='true']")
                const lang = langInput ? langInput.value.trim() : (block.getAttribute("data-lang") ?? "")
                const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                const caret = getCodeCaretOffsets(codeEl)
                const nextHtml = formatCodeSyntax(rawCode, lang)

                if (codeEl.innerHTML !== nextHtml) {
                    codeEl.innerHTML = nextHtml
                    if (caret) {
                        setCodeCaretOffsets(codeEl, caret.start, caret.end)
                    }
                }
            })
        },
        [editorRef]
    )

    const handleCodeBlockClick = useCallback((e: ReactMouseEvent<HTMLDivElement>): boolean => {
        const target = e.target as HTMLElement
        if (target.getAttribute("data-lang-input") === "true") {
            const block = target.closest<HTMLElement>("div[data-code-block='true']")
            if (block) setCodeBlockSelectedVisual(block, false)
            return false
        }

        const header = target.closest<HTMLElement>("[data-code-header='true']")
        if (header) {
            const block = header.closest<HTMLElement>("div[data-code-block='true']")
            const codeEl = block?.querySelector<HTMLElement>("code")
            if (block && codeEl) {
                e.preventDefault()
                block.setAttribute("data-header-selected", "true")
                const sel = window.getSelection()
                if (sel) {
                    const r = document.createRange()
                    r.selectNodeContents(codeEl)
                    sel.removeAllRanges()
                    sel.addRange(r)
                }
                setCodeBlockSelectedVisual(block, true)
                return true
            }
        }
        return false
    }, [])

    const handleCodeBlockKeyDown = useCallback(
        (e: ReactKeyboardEvent<HTMLDivElement>): boolean => {
            const root = editorRef.current
            if (!root) return false

            const target = e.target as HTMLElement | null
            if (target?.getAttribute("data-lang-input") === "true") {
                if (e.key === "Enter" || e.key === "Escape") {
                    e.preventDefault()
                    const block = target.closest<HTMLElement>("div[data-code-block='true']")
                    const codeEl = block?.querySelector<HTMLElement>("code")
                    if (codeEl) {
                        codeEl.focus()
                        placeCaretAtStart(codeEl)
                    }
                    return true
                }
                return false
            }

            const sel = window.getSelection()
            if (!sel || sel.rangeCount === 0) return false
            const range = sel.getRangeAt(0)

            const anchorBlock =
                (sel.anchorNode?.nodeType === Node.ELEMENT_NODE
                    ? (sel.anchorNode as HTMLElement)
                    : sel.anchorNode?.parentElement
                )?.closest<HTMLElement>("div[data-code-block='true']") ?? null

            // 1. Ctrl+A / Cmd+A inside a code block selects all code in the block (and highlights the block)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && anchorBlock) {
                const codeEl = anchorBlock.querySelector<HTMLElement>("code")
                if (codeEl) {
                    const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                    const offsets = getCodeCaretOffsets(codeEl)
                    const alreadyAllSelected =
                        offsets !== null && offsets.start === 0 && offsets.end >= rawCode.length && rawCode.length > 0
                    if (!alreadyAllSelected) {
                        e.preventDefault()
                        const r = document.createRange()
                        r.selectNodeContents(codeEl)
                        sel.removeAllRanges()
                        sel.addRange(r)
                        setCodeBlockSelectedVisual(anchorBlock, true)
                        return true
                    }
                }
            }

            // 2. Backspace / Delete inside or across a code block
            if (e.key === "Backspace" || e.key === "Delete") {
                if (anchorBlock) {
                    const codeEl = anchorBlock.querySelector<HTMLElement>("code")
                    if (!codeEl) {
                        e.preventDefault()
                        removeCodeBlockElement(anchorBlock)
                        return true
                    }

                    const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                    const headerSelected = anchorBlock.getAttribute("data-header-selected") === "true"
                    const spansOutsideCode =
                        !range.collapsed && (!codeEl.contains(range.startContainer) || !codeEl.contains(range.endContainer))

                    // If content code is already empty, or the block header/container itself is selected -> remove entire code section
                    if (rawCode.length === 0 || headerSelected || (spansOutsideCode && anchorBlock.contains(range.commonAncestorContainer))) {
                        e.preventDefault()
                        removeCodeBlockElement(anchorBlock)
                        return true
                    }

                    const offsets = getCodeCaretOffsets(codeEl)
                    if (offsets) {
                        const selStart = Math.min(offsets.start, offsets.end)
                        const selEnd = Math.max(offsets.start, offsets.end)

                        // Non-collapsed selection inside `code`: if it covers all content code, clear content to empty first
                        if (selStart !== selEnd) {
                            if (selStart === 0 && selEnd >= rawCode.length) {
                                e.preventDefault()
                                codeEl.innerHTML = "\u200B"
                                setCodeBlockSelectedVisual(anchorBlock, false)
                                placeCaretAtStart(codeEl)
                                onSyncMarkdown(false)
                                return true
                            }
                            return false
                        }

                        // Collapsed caret inside `code`:
                        // Prevent Backspace at offset 0 or Delete at end from corrupting header or pulling outside blocks
                        if (e.key === "Backspace" && selStart === 0) {
                            e.preventDefault()
                            return true
                        }
                        if (e.key === "Delete" && selStart >= rawCode.length) {
                            e.preventDefault()
                            return true
                        }

                        // Deleting the last remaining character transitions codeEl to empty (\u200B) so the NEXT delete removes the code section
                        if (
                            rawCode.length === 1 &&
                            ((e.key === "Backspace" && selStart === 1) || (e.key === "Delete" && selStart === 0))
                        ) {
                            e.preventDefault()
                            codeEl.innerHTML = "\u200B"
                            setCodeBlockSelectedVisual(anchorBlock, false)
                            placeCaretAtStart(codeEl)
                            onSyncMarkdown(false)
                            return true
                        }
                    }
                } else if (!range.collapsed) {
                    // Selection started outside a code block but covers one or more code blocks
                    const selectedBlocks = Array.from(
                        root.querySelectorAll<HTMLElement>("div[data-code-block='true']")
                    ).filter((b) => isEntireCodeBlockSelected(b, range))
                    if (selectedBlocks.length > 0 && selectedBlocks.length === 1 && range.commonAncestorContainer === selectedBlocks[0]) {
                        e.preventDefault()
                        removeCodeBlockElement(selectedBlocks[0])
                        return true
                    }
                }
            }

            // 3. Tab key inside a code block
            if (e.key === "Tab" && anchorBlock) {
                const codeEl = anchorBlock.querySelector<HTMLElement>("code")
                if (codeEl) {
                    e.preventDefault()
                    const lang = anchorBlock.getAttribute("data-lang") ?? ""
                    const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                    const offsets = getCodeCaretOffsets(codeEl) ?? {start: rawCode.length, end: rawCode.length}
                    const selStart = Math.min(offsets.start, offsets.end)
                    const selEnd = Math.max(offsets.start, offsets.end)
                    const nextCode = rawCode.slice(0, selStart) + "  " + rawCode.slice(selEnd)
                    codeEl.innerHTML = formatCodeSyntax(nextCode, lang)
                    setCodeCaretOffsets(codeEl, selStart + 2)
                    onSyncMarkdown(false)
                    return true
                }
            }

            // 4. Enter key inside a code block or ```lang fence trigger
            if (e.key === "Enter") {
                if (anchorBlock) {
                    e.preventDefault()
                    if (e.shiftKey) {
                        const p = document.createElement("p")
                        p.className = "my-2.5 leading-7 text-foreground"
                        p.innerHTML = "<br />"
                        anchorBlock.parentElement?.insertBefore(p, anchorBlock.nextSibling)
                        setCodeBlockSelectedVisual(anchorBlock, false)
                        placeCaretAtStart(p)
                        onSyncMarkdown(false)
                        return true
                    }
                    const codeEl = anchorBlock.querySelector<HTMLElement>("code")
                    if (codeEl) {
                        const lang = anchorBlock.getAttribute("data-lang") ?? ""
                        const rawCode = (codeEl.textContent ?? "").replace(/\u200B/g, "")
                        const offsets = getCodeCaretOffsets(codeEl) ?? {start: rawCode.length, end: rawCode.length}
                        const selStart = Math.min(offsets.start, offsets.end)
                        const selEnd = Math.max(offsets.start, offsets.end)
                        const nextCode = rawCode.slice(0, selStart) + "\n" + rawCode.slice(selEnd)
                        codeEl.innerHTML = formatCodeSyntax(nextCode, lang)
                        setCodeCaretOffsets(codeEl, selStart + 1)
                        onSyncMarkdown(false)
                        return true
                    }
                }

                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                    const text = range.startContainer.textContent ?? ""
                    const fenceMatch = text.slice(0, range.startOffset).match(/^`{3,}([a-zA-Z0-9+#_-]*)$/)
                    if (fenceMatch) {
                        e.preventDefault()
                        const lang = fenceMatch[1] || ""
                        let block: HTMLElement | null = range.startContainer.parentElement
                        while (block && block.parentElement && block.parentElement !== root) {
                            block = block.parentElement
                        }
                        if (block) {
                            const div = createCodeBlockElement("", lang)
                            block.replaceWith(div)
                            const codeEl = div.querySelector<HTMLElement>("code")
                            if (codeEl) placeCaretAtStart(codeEl)
                            onSyncMarkdown(false)
                            return true
                        }
                    }
                }
            }

            return false
        },
        [editorRef, onSyncMarkdown, placeCaretAtStart, removeCodeBlockElement]
    )

    return {
        handleCodeBlockKeyDown,
        handleCodeBlockInput,
        handleCodeBlockClick,
        updateCodeBlockSelection,
        formatCodeSyntax,
        buildCodeBlockHtml,
    }
}
