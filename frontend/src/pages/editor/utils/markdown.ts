const EMOJI_MAP: Record<string, string> = {
    tent: "⛺",
    joy: "😂",
    smile: "😄",
    grin: "😁",
    wink: "😉",
    heart: "❤️",
    fire: "🔥",
    rocket: "🚀",
    star: "⭐",
    sparkles: "✨",
    tada: "🎉",
    thumbsup: "👍",
    "+1": "👍",
    thumbsdown: "👎",
    "-1": "👎",
    check: "✅",
    white_check_mark: "✅",
    x: "❌",
    warning: "⚠️",
    bulb: "💡",
    memo: "📝",
    bug: "🐛",
    info: "ℹ️",
    question: "❓",
    eyes: "👀",
    wave: "👋",
    clap: "👏",
    thinking: "🤔",
    gear: "⚙️",
    lock: "🔒",
    key: "🔑",
    link: "🔗",
    book: "📖",
    folder: "📁",
    file: "📄",
}

const escapeHtml = (str: string): string =>
    str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")

interface RefLink {
    url: string
    title?: string
}

interface ParseContext {
    refLinks: Map<string, RefLink>
    footnotes: Map<string, string>
    footnoteOrder: string[]
    taskCounter: {value: number}
}

export const slugifyHeading = (text: string): string =>
    text
        .toLowerCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")

const parseInline = (raw: string, ctx: ParseContext): string => {
    if (!raw) return ""

    // 1. Handle escaped characters (\*, \_, \`, \\, \#, etc.)
    const escapes: string[] = []
    let text = raw.replace(/\\([\\`*_{}[\]<>()#+-.!|~^=])/g, (_m, ch: string) => {
        const idx = escapes.length
        escapes.push(escapeHtml(ch))
        return `\u0000ESC${idx}\u0000`
    })

    // Handle &#124; pipe escape
    text = text.replace(/&#124;/g, () => {
        const idx = escapes.length
        escapes.push("|")
        return `\u0000ESC${idx}\u0000`
    })

    // 2. Protect inline code spans (double backticks first, then single backticks)
    const codeSpans: string[] = []
    text = text.replace(/``([\s\S]+?)``/g, (_m, code: string) => {
        const idx = codeSpans.length
        const cleaned = code.startsWith(" ") && code.endsWith(" ") && code.length > 2 ? code.slice(1, -1) : code
        codeSpans.push(
            `<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400">${escapeHtml(cleaned)}</code>`
        )
        return `\u0000CODE${idx}\u0000`
    })
    text = text.replace(/`([^`\n]+?)`/g, (_m, code: string) => {
        const idx = codeSpans.length
        codeSpans.push(
            `<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[0.875em] text-rose-600 dark:text-rose-400">${escapeHtml(code)}</code>`
        )
        return `\u0000CODE${idx}\u0000`
    })

    // 3. Protect angle-bracket autolinks <https://...> and <email@domain.com>
    const htmlPlaceholders: string[] = []
    const stashHtml = (html: string): string => {
        const idx = htmlPlaceholders.length
        htmlPlaceholders.push(html)
        return `\u0000HTML${idx}\u0000`
    }

    text = text.replace(/<(https?:\/\/[^>\s]+)>/g, (_m, url: string) => {
        const safeUrl = escapeHtml(url)
        return stashHtml(
            `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${safeUrl}</a>`
        )
    })
    text = text.replace(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, (_m, email: string) => {
        const safeEmail = escapeHtml(email)
        return stashHtml(
            `<a href="mailto:${safeEmail}" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${safeEmail}</a>`
        )
    })

    // 4. Allow safe inline HTML tags (<em>, <strong>, <mark>, <sub>, <sup>, <br>, <code>, <kbd>, <a>, <img>, <span>)
    text = text.replace(
        /<(\/?(?:em|strong|b|i|u|s|del|mark|sub|sup|br|kbd|span|a|img)(?:\s+[^>]*)?)>/gi,
        (match) => stashHtml(match)
    )

    // Escape remaining raw < and >
    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;")

    // 5. Linked images: [![alt](imgUrl "imgTitle")](linkUrl "linkTitle")
    text = text.replace(
        /\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (_m, alt: string, imgUrl: string, imgTitle: string | undefined, linkUrl: string, linkTitle: string | undefined) => {
            const imgTitleAttr = imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ""
            const linkTitleAttr = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : ""
            return stashHtml(
                `<a href="${escapeHtml(linkUrl)}"${linkTitleAttr} target="_blank" rel="noopener noreferrer" class="inline-block"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(alt)}"${imgTitleAttr} class="max-w-full rounded-lg border border-border my-2" /></a>`
            )
        }
    )

    // 6. Standard Images: ![alt](url "title")
    text = text.replace(
        /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (_m, alt: string, url: string, title: string | undefined) => {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
            return stashHtml(
                `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttr} class="max-w-full rounded-lg border border-border my-2 inline-block" />`
            )
        }
    )

    // 7. Standard Links: [text](url "title")
    text = text.replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (_m, label: string, url: string, title: string | undefined) => {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : ""
            const inner = parseInline(label, ctx)
            return stashHtml(
                `<a href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${inner}</a>`
            )
        }
    )

    // 8. Reference-style Links: [text][id] or [text] [id]
    text = text.replace(/\[([^\]]+)\]\s*\[([^\]]*)\]/g, (match, label: string, refId: string) => {
        const key = (refId || label).trim().toLowerCase()
        const ref = ctx.refLinks.get(key)
        if (!ref) return match
        const titleAttr = ref.title ? ` title="${escapeHtml(ref.title)}"` : ""
        const inner = parseInline(label, ctx)
        return stashHtml(
            `<a href="${escapeHtml(ref.url)}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${inner}</a>`
        )
    })

    // 9. Footnotes: [^id]
    text = text.replace(/\[\^([^\s\]]+)\]/g, (_m, id: string) => {
        let idx = ctx.footnoteOrder.indexOf(id)
        if (idx === -1) {
            ctx.footnoteOrder.push(id)
            idx = ctx.footnoteOrder.length - 1
        }
        const num = idx + 1
        return stashHtml(
            `<sup class="footnote-ref text-xs font-semibold text-indigo-600 dark:text-indigo-400"><a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}">[${num}]</a></sup>`
        )
    })

    // 10. Bold + Italic: ***text***, ___text___, **_text_**, __*text*__
    text = text.replace(/(\*\*\*|___)(?=\S)([\s\S]*?\S)\1/g, (_m, _d, content: string) => {
        return `<strong><em>${parseInline(content, ctx)}</em></strong>`
    })
    text = text.replace(/\*\*_(?=\S)([\s\S]*?\S)_\*\*/g, (_m, content: string) => {
        return `<strong><em>${parseInline(content, ctx)}</em></strong>`
    })
    text = text.replace(/__\*(?=\S)([\s\S]*?\S)\*__/g, (_m, content: string) => {
        return `<strong><em>${parseInline(content, ctx)}</em></strong>`
    })

    // 11. Bold: **text** or __text__
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, (_m, _d, content: string) => {
        return `<strong>${parseInline(content, ctx)}</strong>`
    })

    // 12. Italic: *text* or _text_
    text = text.replace(/(\*|_)(?=\S)([^\n*]+?\S|\S)\1/g, (_m, _d, content: string) => {
        return `<em>${parseInline(content, ctx)}</em>`
    })

    // 13. Strikethrough: ~~text~~
    text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, (_m, content: string) => {
        return `<del class="line-through text-muted-foreground">${parseInline(content, ctx)}</del>`
    })

    // 14. Highlight: ==text==
    text = text.replace(/==(?=\S)([\s\S]*?\S)==/g, (_m, content: string) => {
        return `<mark class="rounded bg-amber-200/80 dark:bg-amber-500/30 px-1 text-foreground">${parseInline(content, ctx)}</mark>`
    })

    // 15. Superscript: ^text^
    text = text.replace(/\^([^\s^~]+)\^/g, (_m, content: string) => {
        return `<sup>${escapeHtml(content)}</sup>`
    })

    // 16. Subscript: ~text~
    text = text.replace(/~([^\s~^]+)~/g, (_m, content: string) => {
        return `<sub>${escapeHtml(content)}</sub>`
    })

    // 17. Emoji shortcodes: :shortcode:
    text = text.replace(/:([a-z0-9_+-]+):/gi, (match, code: string) => {
        const emoji = EMOJI_MAP[code.toLowerCase()]
        return emoji ?? match
    })

    // 18. Automatic URL linking for bare http(s):// URLs
    text = text.replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, (_m, prefix: string, url: string) => {
        // Trim trailing punctuation like . or ,
        let cleanUrl = url
        let trailing = ""
        const trailMatch = cleanUrl.match(/[.,;:!?]+$/)
        if (trailMatch) {
            trailing = trailMatch[0]
            cleanUrl = cleanUrl.slice(0, -trailing.length)
        }
        return `${prefix}<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-500">${cleanUrl}</a>${trailing}`
    })

    // Restore HTML placeholders, code spans, and escaped characters
    text = text.replace(/\u0000HTML(\d+)\u0000/g, (_m, idx: string) => htmlPlaceholders[Number(idx)] ?? "")
    text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx: string) => codeSpans[Number(idx)] ?? "")
    text = text.replace(/\u0000ESC(\d+)\u0000/g, (_m, idx: string) => escapes[Number(idx)] ?? "")

    return text
}

const splitTableCells = (row: string): string[] => {
    // Protect escaped pipes \|
    const safe = row.trim().replace(/\\\|/g, "\u0000PIPE\u0000")
    const stripped = safe.replace(/^\|/, "").replace(/\|$/, "")
    return stripped.split("|").map((c) => c.trim().replace(/\u0000PIPE\u0000/g, "|"))
}

const isTableSeparator = (line: string): boolean => {
    const trimmed = line.trim()
    if (!trimmed.includes("|") && !trimmed.includes("-")) return false
    const cells = splitTableCells(trimmed)
    if (cells.length === 0) return false
    return cells.every((c) => /^:?-{3,}:?$/.test(c))
}

const parseTableAlignments = (line: string): Array<"left" | "center" | "right"> => {
    return splitTableCells(line).map((c) => {
        if (c.startsWith(":") && c.endsWith(":")) return "center"
        if (c.endsWith(":")) return "right"
        return "left"
    })
}

const renderListBlocks = (lines: string[], ctx: ParseContext): string => {
    interface ListItemNode {
        indent: number
        ordered: boolean
        task: null | boolean
        taskIndex?: number
        content: string
        children: string[]
    }

    const parseLevel = (rawLines: string[], baseIndent: number): string => {
        if (rawLines.length === 0) return ""
        const items: ListItemNode[] = []

        let i = 0
        while (i < rawLines.length) {
            const line = rawLines[i]
            if (!line.trim()) {
                i++
                continue
            }
            const indentMatch = line.match(/^(\s*)/)
            const indent = indentMatch ? indentMatch[1].replace(/\t/g, "    ").length : 0
            const trimmed = line.trim()

            const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/)
            const ulMatch = !taskMatch ? trimmed.match(/^[-*+]\s+(.*)$/) : null
            const olMatch = !taskMatch && !ulMatch ? trimmed.match(/^\d+\.\s+(.*)$/) : null

            if (indent <= baseIndent && (taskMatch || ulMatch || olMatch)) {
                const task = taskMatch ? taskMatch[1].toLowerCase() === "x" : null
                const taskIndex = taskMatch ? ctx.taskCounter.value++ : undefined
                const content = taskMatch ? taskMatch[2] : ulMatch ? ulMatch[1] : olMatch ? olMatch[1] : trimmed
                items.push({
                    indent,
                    ordered: Boolean(olMatch),
                    task,
                    taskIndex,
                    content,
                    children: [],
                })
                i++
            } else if (items.length > 0) {
                items[items.length - 1].children.push(line)
                i++
            } else {
                items.push({
                    indent: baseIndent,
                    ordered: false,
                    task: null,
                    content: trimmed,
                    children: [],
                })
                i++
            }
        }

        if (items.length === 0) return ""
        const isOrdered = items[0].ordered
        const isTaskList = items.some((it) => it.task !== null)
        const tag = isOrdered ? "ol" : "ul"
        const listClass = isTaskList
            ? "my-2 space-y-1.5 list-none pl-1"
            : isOrdered
            ? "my-2 space-y-1 list-decimal pl-6"
            : "my-2 space-y-1 list-disc pl-6"

        const innerHtml = items
            .map((item) => {
                let childHtml = ""
                if (item.children.length > 0) {
                    const firstChildIndent =
                        item.children[0].match(/^(\s*)/)?.[1].replace(/\t/g, "    ").length ?? baseIndent + 2
                    const hasNestedList = item.children.some((cl) =>
                        /^\s*(?:[-*+]|\d+\.)\s+/.test(cl)
                    )
                    if (hasNestedList) {
                        childHtml = parseLevel(item.children, firstChildIndent)
                    } else {
                        const unindented = item.children.map((cl) => cl.replace(/^\s{1,4}/, "")).join("\n")
                        childHtml = `<div class="mt-1">${parseBlocks(unindented, ctx)}</div>`
                    }
                }

                if (item.task !== null) {
                    const checkedAttr = item.task ? " checked" : ""
                    const textClass = item.task ? "line-through text-muted-foreground" : ""
                    return `<li class="flex items-start gap-2" data-task-item="true"><input type="checkbox" data-task-index="${item.taskIndex}"${checkedAttr} class="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" /><span class="${textClass}">${parseInline(item.content, ctx)}${childHtml}</span></li>`
                }

                return `<li class="leading-relaxed">${parseInline(item.content, ctx)}${childHtml}</li>`
            })
            .join("")

        return `<${tag} class="${listClass}">${innerHtml}</${tag}>`
    }

    const firstIndent = lines[0]?.match(/^(\s*)/)?.[1].replace(/\t/g, "    ").length ?? 0
    return parseLevel(lines, firstIndent)
}

const parseBlocks = (markdown: string, ctx: ParseContext): string => {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    const out: string[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        // Skip empty lines
        if (!trimmed) {
            i++
            continue
        }

        // 1. Fenced Code Blocks (``` or ~~~)
        const fenceMatch = trimmed.match(/^(`{3,}|~{3,})\s*([^\s`~]*)$/)
        if (fenceMatch) {
            const fence = fenceMatch[1]
            const lang = fenceMatch[2] || ""
            const codeLines: string[] = []
            i++
            while (i < lines.length && !lines[i].trim().startsWith(fence)) {
                codeLines.push(lines[i])
                i++
            }
            if (i < lines.length) i++ // consume closing fence
            const langBadge = lang
                ? `<div class="flex items-center justify-between border-b border-slate-700/60 bg-slate-800/90 px-3 py-1 text-[11px] font-mono text-slate-300"><span>${escapeHtml(lang)}</span></div>`
                : ""
            out.push(
                `<div class="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-slate-100" data-code-block="true" data-lang="${escapeHtml(lang)}">${langBadge}<pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`
            )
            continue
        }

        // 2. Horizontal Rule (***, ---, ___)
        if (/^(?:\*\s*){3,}$|^-\s*-\s*-[-\s]*$|^(?:_\s*){3,}$/.test(trimmed)) {
            out.push(`<hr class="my-6 border-t border-border" />`)
            i++
            continue
        }

        // 3. ATX Headings (# to ######) with optional {#custom-id}
        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
        if (headingMatch) {
            const level = headingMatch[1].length
            let rawHeading = headingMatch[2].replace(/\s+#+\s*$/, "")
            let customId = ""
            const idMatch = rawHeading.match(/\s*\{#([^}]+)\}\s*$/)
            if (idMatch) {
                customId = idMatch[1].trim()
                rawHeading = rawHeading.slice(0, idMatch.index).trim()
            }
            const id = customId || slugifyHeading(rawHeading)
            const headingClasses: Record<number, string> = {
                1: "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3 pb-1 border-b border-border/60",
                2: "text-2xl font-semibold tracking-tight text-foreground mt-5 mb-2.5 pb-1 border-b border-border/40",
                3: "text-xl font-semibold text-foreground mt-4 mb-2",
                4: "text-lg font-semibold text-foreground mt-3 mb-1.5",
                5: "text-base font-semibold text-foreground mt-2.5 mb-1",
                6: "text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1",
            }
            out.push(
                `<h${level} id="${escapeHtml(id)}" data-custom-id="${escapeHtml(customId)}" class="${headingClasses[level]}">${parseInline(rawHeading, ctx)}</h${level}>`
            )
            i++
            continue
        }

        // 4. Setext Headings (line followed by === or ---)
        if (
            i + 1 < lines.length &&
            /^\s{0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) &&
            !trimmed.startsWith(">") &&
            !/^[-*+]\s+/.test(trimmed) &&
            !trimmed.includes("|")
        ) {
            const isH1 = lines[i + 1].trim().startsWith("=")
            const level = isH1 ? 1 : 2
            const id = slugifyHeading(trimmed)
            const cls =
                level === 1
                    ? "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3 pb-1 border-b border-border/60"
                    : "text-2xl font-semibold tracking-tight text-foreground mt-5 mb-2.5 pb-1 border-b border-border/40"
            out.push(`<h${level} id="${escapeHtml(id)}" class="${cls}">${parseInline(trimmed, ctx)}</h${level}>`)
            i += 2
            continue
        }

        // 5. Pipe Tables
        if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            const headerCells = splitTableCells(lines[i])
            const alignments = parseTableAlignments(lines[i + 1])
            i += 2
            const bodyRows: string[][] = []
            while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
                bodyRows.push(splitTableCells(lines[i]))
                i++
            }
            const thHtml = headerCells
                .map((cell, idx) => {
                    const align = alignments[idx] ?? "left"
                    return `<th style="text-align:${align}" class="border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground">${parseInline(cell, ctx)}</th>`
                })
                .join("")
            const tbodyHtml = bodyRows
                .map((row) => {
                    const tds = headerCells
                        .map((_, idx) => {
                            const align = alignments[idx] ?? "left"
                            const cellContent = row[idx] ?? ""
                            return `<td style="text-align:${align}" class="border border-border px-3 py-2 text-sm text-foreground">${parseInline(cellContent, ctx)}</td>`
                        })
                        .join("")
                    return `<tr class="even:bg-muted/20">${tds}</tr>`
                })
                .join("")
            out.push(
                `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse border border-border text-sm"><thead><tr>${thHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div>`
            )
            continue
        }

        // 6. Blockquotes (> or >>)
        if (/^\s{0,3}>/.test(line)) {
            const quoteLines: string[] = []
            while (i < lines.length && (/^\s{0,3}>/.test(lines[i]) || (lines[i].trim() && quoteLines.length > 0 && !lines[i].trim().startsWith("#")))) {
                if (/^\s{0,3}>/.test(lines[i])) {
                    quoteLines.push(lines[i].replace(/^\s{0,3}>\s?/, ""))
                    i++
                } else {
                    break
                }
            }
            out.push(
                `<blockquote class="my-3 border-l-4 border-indigo-500/70 bg-indigo-50/40 dark:bg-indigo-950/20 pl-4 py-1.5 italic text-slate-700 dark:text-slate-300 rounded-r">${parseBlocks(quoteLines.join("\n"), ctx)}</blockquote>`
            )
            continue
        }

        // 7. Lists (Unordered, Ordered, Task Lists)
        if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
            const listLines: string[] = []
            while (
                i < lines.length &&
                (
                    /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i]) ||
                    /^\s{2,}\S/.test(lines[i]) ||
                    (lines[i].trim() === "" && i + 1 < lines.length && (/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i + 1]) || /^\s{4,}\S/.test(lines[i + 1])))
                )
            ) {
                listLines.push(lines[i])
                i++
            }
            out.push(renderListBlocks(listLines, ctx))
            continue
        }

        // 8. Indented Code Blocks (4+ spaces or tab)
        if (/^(?: {4}|\t)/.test(line)) {
            const codeLines: string[] = []
            while (i < lines.length && (/^(?: {4}|\t)/.test(lines[i]) || !lines[i].trim())) {
                codeLines.push(lines[i].replace(/^(?: {4}|\t)/, ""))
                i++
            }
            // Trim trailing blank lines
            while (codeLines.length > 0 && !codeLines[codeLines.length - 1].trim()) {
                codeLines.pop()
            }
            out.push(
                `<div class="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-slate-100" data-code-block="true"><pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed"><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`
            )
            continue
        }

        // 9. Definition Lists (Term followed by `: Definition`)
        if (i + 1 < lines.length && /^:\s+.+/.test(lines[i + 1].trim())) {
            const dlItems: string[] = []
            while (i < lines.length && lines[i].trim() && i + 1 < lines.length && /^:\s+.+/.test(lines[i + 1].trim())) {
                const term = lines[i].trim()
                dlItems.push(`<dt class="font-semibold text-foreground mt-2">${parseInline(term, ctx)}</dt>`)
                i++
                while (i < lines.length && /^:\s+(.+)/.test(lines[i].trim())) {
                    const def = lines[i].trim().replace(/^:\s+/, "")
                    dlItems.push(`<dd class="pl-4 text-muted-foreground mb-1">${parseInline(def, ctx)}</dd>`)
                    i++
                }
                while (i < lines.length && !lines[i].trim()) {
                    i++
                }
            }
            out.push(`<dl class="my-3">${dlItems.join("")}</dl>`)
            continue
        }

        // 10. Block-level HTML passthrough
        if (/^<(?:div|table|pre|p|details|summary|section|article|aside|header|footer|ul|ol|dl|blockquote|hr|br)\b/i.test(trimmed)) {
            out.push(line)
            i++
            continue
        }

        // 11. Paragraph (with support for two-space line breaks)
        const paraLines: string[] = []
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^\s{0,3}(?:#{1,6}\s|>|```|~~~)/.test(lines[i]) &&
            !/^(?:\*\s*){3,}$|^-\s*-\s*-[-\s]*$|^(?:_\s*){3,}$/.test(lines[i].trim()) &&
            !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i]) &&
            !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
            !(i + 1 < lines.length && /^\s{0,3}(?:=+|-+)\s*$/.test(lines[i + 1]))
        ) {
            paraLines.push(lines[i])
            i++
        }

        if (paraLines.length > 0) {
            const renderedLines = paraLines.map((pLine, idx) => {
                const hasHardBreak = / {2,}$/.test(pLine) || /\\$/.test(pLine)
                const cleaned = pLine.replace(/ {2,}$/, "").replace(/\\$/, "")
                const inline = parseInline(cleaned, ctx)
                if (idx < paraLines.length - 1) {
                    return hasHardBreak ? `${inline}<br />` : `${inline}\n`
                }
                return inline
            })
            out.push(`<p class="my-2.5 leading-7 text-foreground">${renderedLines.join("")}</p>`)
        } else {
            i++
        }
    }

    return out.join("\n")
}

export const renderMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return ""

    const ctx: ParseContext = {
        refLinks: new Map<string, RefLink>(),
        footnotes: new Map<string, string>(),
        footnoteOrder: [],
        taskCounter: {value: 0},
    }

    // Pre-pass: extract reference link definitions and footnote definitions
    const rawLines = markdown.replace(/\r\n/g, "\n").split("\n")
    const contentLines: string[] = []

    let i = 0
    let inFence = false
    while (i < rawLines.length) {
        const line = rawLines[i]
        const trimmed = line.trim()

        if (/^(`{3,}|~{3,})/.test(trimmed)) {
            inFence = !inFence
            contentLines.push(line)
            i++
            continue
        }

        if (!inFence) {
            // Footnote definition: [^id]: text (plus optional indented continuation lines)
            const fnMatch = line.match(/^\s{0,3}\[\^([^\s\]]+)\]:\s*(.*)$/)
            if (fnMatch) {
                const id = fnMatch[1]
                const fnLines = [fnMatch[2]]
                i++
                while (i < rawLines.length && (/^(?: {4}|\t)/.test(rawLines[i]) || (!rawLines[i].trim() && i + 1 < rawLines.length && /^(?: {4}|\t)/.test(rawLines[i + 1])))) {
                    fnLines.push(rawLines[i].replace(/^(?: {4}|\t)/, ""))
                    i++
                }
                ctx.footnotes.set(id, fnLines.join("\n").trim())
                continue
            }

            // Reference link definition: [label]: <url> "title"
            const refMatch = line.match(
                /^\s{0,3}\[([^\]^][^\]]*)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?\s*$/
            )
            if (refMatch) {
                ctx.refLinks.set(refMatch[1].trim().toLowerCase(), {
                    url: refMatch[2].trim(),
                    title: refMatch[3]?.trim(),
                })
                i++
                continue
            }
        }

        contentLines.push(line)
        i++
    }

    let html = parseBlocks(contentLines.join("\n"), ctx)

    // Append footnotes section if any footnotes exist
    const allFootnotes = [
        ...ctx.footnoteOrder,
        ...Array.from(ctx.footnotes.keys()).filter((k) => !ctx.footnoteOrder.includes(k)),
    ]
    if (allFootnotes.length > 0 && ctx.footnotes.size > 0) {
        const itemsHtml = allFootnotes
            .map((id) => {
                const body = ctx.footnotes.get(id) ?? ""
                return `<li id="fn-${escapeHtml(id)}" class="text-xs text-muted-foreground leading-relaxed">${parseInline(body, ctx)} <a href="#fnref-${escapeHtml(id)}" class="text-indigo-600 hover:underline">↩</a></li>`
            })
            .join("")
        html += `\n<section class="footnotes mt-8 border-t border-border pt-4"><ol class="list-decimal pl-5 space-y-1.5">${itemsHtml}</ol></section>`
    }

    return html
}

const serializeInlineNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? ""
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return ""
    }
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (el.classList.contains("footnote-ref")) {
        const href = el.querySelector("a")?.getAttribute("href") ?? ""
        const id = href.replace(/^#fn-/, "")
        return id ? `[^${id}]` : el.textContent ?? ""
    }

    const inner = Array.from(el.childNodes).map(serializeInlineNode).join("")

    switch (tag) {
        case "strong":
        case "b":
            return inner ? `**${inner}**` : ""
        case "em":
        case "i":
            return inner ? `*${inner}*` : ""
        case "del":
        case "s":
        case "strike":
            return inner ? `~~${inner}~~` : ""
        case "mark":
            return inner ? `==${inner}==` : ""
        case "sup":
            return inner ? `^${inner}^` : ""
        case "sub":
            return inner ? `~${inner}~` : ""
        case "code":
            return inner.includes("`") ? `\`\` ${inner} \`\`` : `\`${inner}\``
        case "br":
            return "  \n"
        case "a": {
            const href = el.getAttribute("href") ?? ""
            const title = el.getAttribute("title")
            const titlePart = title ? ` "${title}"` : ""
            return `[${inner}](${href}${titlePart})`
        }
        case "img": {
            const src = el.getAttribute("src") ?? ""
            const alt = el.getAttribute("alt") ?? ""
            const title = el.getAttribute("title")
            const titlePart = title ? ` "${title}"` : ""
            return `![${alt}](${src}${titlePart})`
        }
        default:
            return inner
    }
}

const serializeBlockNode = (node: Node, listIndent = ""): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? "").trim()
        return text
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return ""
    }
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (el.classList.contains("footnotes")) {
        const items = Array.from(el.querySelectorAll("li"))
        return items
            .map((li) => {
                const id = (li.getAttribute("id") ?? "").replace(/^fn-/, "") || "1"
                const clone = li.cloneNode(true) as HTMLElement
                clone.querySelectorAll("a[href^='#fnref-']").forEach((a) => a.remove())
                return `[^${id}]: ${serializeInlineNode(clone).trim()}`
            })
            .join("\n\n")
    }

    if (el.getAttribute("data-code-block") === "true" || tag === "pre") {
        const lang = el.getAttribute("data-lang") ?? ""
        const codeEl = el.querySelector("code") ?? el
        const code = codeEl.textContent ?? ""
        return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1])
        const customId = el.getAttribute("data-custom-id")
        const idSuffix = customId ? ` {#${customId}}` : ""
        return `${"#".repeat(level)} ${serializeInlineNode(el).trim()}${idSuffix}`
    }

    if (tag === "hr") {
        return "---"
    }

    if (tag === "blockquote") {
        const inner = Array.from(el.childNodes)
            .map((child) => serializeBlockNode(child))
            .filter(Boolean)
            .join("\n\n")
        return inner
            .split("\n")
            .map((line) => (line ? `> ${line}` : ">"))
            .join("\n")
    }

    if (tag === "ul" || tag === "ol") {
        const isOrdered = tag === "ol"
        const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === "li")
        return items
            .map((li, idx) => {
                const prefix = isOrdered ? `${idx + 1}. ` : "- "
                const checkbox = li.querySelector("input[type='checkbox']") as HTMLInputElement | null
                const taskPrefix = checkbox ? (checkbox.checked ? "[x] " : "[ ] ") : ""
                const inlineParts: string[] = []
                const nestedBlocks: string[] = []

                Array.from(li.childNodes).forEach((child) => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const childEl = child as HTMLElement
                        const childTag = childEl.tagName.toLowerCase()
                        if (childTag === "input") return
                        if (childTag === "ul" || childTag === "ol") {
                            nestedBlocks.push(serializeBlockNode(childEl, listIndent + "    "))
                            return
                        }
                        if (childTag === "span") {
                            Array.from(childEl.childNodes).forEach((grandChild) => {
                                if (
                                    grandChild.nodeType === Node.ELEMENT_NODE &&
                                    ["ul", "ol"].includes((grandChild as HTMLElement).tagName.toLowerCase())
                                ) {
                                    nestedBlocks.push(serializeBlockNode(grandChild, listIndent + "    "))
                                } else {
                                    inlineParts.push(serializeInlineNode(grandChild))
                                }
                            })
                            return
                        }
                    }
                    inlineParts.push(serializeInlineNode(child))
                })

                const mainLine = `${listIndent}${prefix}${taskPrefix}${inlineParts.join("").trim()}`
                return nestedBlocks.length > 0 ? `${mainLine}\n${nestedBlocks.join("\n")}` : mainLine
            })
            .join("\n")
    }

    if (tag === "table" || (tag === "div" && el.querySelector("table"))) {
        const table = tag === "table" ? el : el.querySelector("table")!
        const headerRow = table.querySelector("thead tr") ?? table.querySelector("tr")
        if (!headerRow) return ""
        const ths = Array.from(headerRow.querySelectorAll("th, td"))
        const headers = ths.map((th) => serializeInlineNode(th).trim())
        const seps = ths.map((th) => {
            const align = (th as HTMLElement).style.textAlign
            if (align === "center") return ":---:"
            if (align === "right") return "---:"
            if (align === "left") return "---"
            return "---"
        })
        const bodyTrs = Array.from(table.querySelectorAll("tbody tr"))
        const rows = bodyTrs.map((tr) => {
            const tds = Array.from(tr.querySelectorAll("td")).map((td) => serializeInlineNode(td).trim())
            return `| ${tds.join(" | ")} |`
        })
        return [`| ${headers.join(" | ")} |`, `| ${seps.join(" | ")} |`, ...rows].join("\n")
    }

    if (tag === "dl") {
        const lines: string[] = []
        Array.from(el.children).forEach((child) => {
            const cTag = child.tagName.toLowerCase()
            if (cTag === "dt") {
                if (lines.length > 0) lines.push("")
                lines.push(serializeInlineNode(child).trim())
            } else if (cTag === "dd") {
                lines.push(`: ${serializeInlineNode(child).trim()}`)
            }
        })
        return lines.join("\n")
    }

    if (tag === "p" || tag === "div") {
        return serializeInlineNode(el).trim()
    }

    return serializeInlineNode(el).trim()
}

export const htmlToMarkdown = (root: HTMLElement): string => {
    const blocks: string[] = []
    Array.from(root.childNodes).forEach((node) => {
        const serialized = serializeBlockNode(node)
        if (serialized) {
            blocks.push(serialized)
        }
    })
    return blocks.join("\n\n")
}
