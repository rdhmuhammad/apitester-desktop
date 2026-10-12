import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete"

interface ApiEntry {
    label: string
    detail: string
    type?: Completion["type"]
    apply?: string
    children?: ApiEntry[]
}

const itemUrlChildren: ApiEntry[] = [
    { label: "id", detail: "string" },
    { label: "key", detail: "string" },
    { label: "value", detail: "string" },
    { label: "description", detail: "string" },
    { label: "disabled", detail: "boolean" },
    { label: "type", detail: "string" },
    { label: "src", detail: "string" },
]

const pathVariableChildren: ApiEntry[] = [
    { label: "id", detail: "string" },
    { label: "key", detail: "string" },
    { label: "value", detail: "string" },
]

const exampleResponseChildren: ApiEntry[] = [
    { label: "id", detail: "string" },
    { label: "name", detail: "string" },
    { label: "status", detail: "string" },
    { label: "code", detail: "number" },
    { label: "body", detail: "string" },
    { label: "header", detail: "ItemUrl[]", children: itemUrlChildren },
    {
        label: "cookie",
        detail: "ResponseCookie[]",
        children: [
            { label: "key", detail: "string" },
            { label: "value", detail: "string" },
            { label: "domain", detail: "string" },
            { label: "path", detail: "string" },
            { label: "secure", detail: "boolean" },
            { label: "httpOnly", detail: "boolean" },
        ],
    },
    { label: "_postman_previewlanguage", detail: "string | null" },
]

export const requestApi: ApiEntry[] = [
    {
        label: "id",
        detail: "string",
    },
    {
        label: "name",
        detail: "string",
    },
    {
        label: "method",
        detail: "string (e.g. GET, POST, PUT, DELETE)",
    },
    {
        label: "url",
        detail: "RequestURL",
        children: [
            { label: "raw", detail: "string (full URL string)" },
            { label: "host", detail: "string[]" },
            { label: "path", detail: "string[]" },
            {
                label: "query",
                detail: "ItemUrl[]",
                children: itemUrlChildren,
            },
            {
                label: "variable",
                detail: "PathVariable[]",
                children: pathVariableChildren,
            },
        ],
    },
    {
        label: "headers",
        detail: "ItemUrl[]",
        children: itemUrlChildren,
    },
    {
        label: "query",
        detail: "ItemUrl[]",
        children: itemUrlChildren,
    },
    {
        label: "body",
        detail: "RequestBody",
        children: [
            { label: "mode", detail: '"raw" | "formdata"' },
            { label: "raw", detail: "string" },
            {
                label: "formdata",
                detail: "ItemUrl[]",
                children: itemUrlChildren,
            },
        ],
    },
    {
        label: "auth",
        detail: "ReqAuth",
        children: [
            { label: "type", detail: "string" },
            {
                label: "bearer",
                detail: "ItemUrl[]",
                children: itemUrlChildren,
            },
            { label: "authSource", detail: '"inherit" | "onrequest" | "none" | string' },
        ],
    },
    {
        label: "script",
        detail: "string",
    },
    {
        label: "responses",
        detail: "ExampleResponse[]",
        children: exampleResponseChildren,
    },
    {
        label: "version",
        detail: "string",
    },
]

const pmApi: ApiEntry[] = [
    {
        label: "environment",
        detail: "pm.environment",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: "get(\"$1\")" },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: "set(\"$1\", \"$2\")" },
            { label: "unset(key)", detail: "(key: string) => void", apply: "unset(\"$1\")" },
            { label: "toObject()", detail: "() => Record<string, string>", apply: "toObject()" },
        ],
    },
    {
        label: "collectionVariables",
        detail: "pm.collectionVariables",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: "get(\"$1\")" },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: "set(\"$1\", \"$2\")" },
            { label: "has(key)", detail: "(key: string) => boolean", apply: "has(\"$1\")" },
            { label: "unset(key)", detail: "(key: string) => void", apply: "unset(\"$1\")" },
            { label: "clear()", detail: "() => void", apply: "clear()" },
        ],
    },
    {
        label: "variables",
        detail: "pm.variables",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: "get(\"$1\")" },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: "set(\"$1\", \"$2\")" },
            { label: "unset(key)", detail: "(key: string) => void", apply: "unset(\"$1\")" },
            { label: "toObject()", detail: "() => Record<string, string>", apply: "toObject()" },
        ],
    },
    {
        label: "request",
        detail: "pm.request (RestRequestResponse)",
        children: requestApi,
    },
    {
        label: "expect",
        detail: "pm.expect(value: any)",
        apply: "expect($1)",
    },
]

const resApi: ApiEntry[] = [
    {
        label: "statusCode",
        detail: "{ statusCode: number }",
    },
    {
        label: "statusText",
        detail: "{ statusText: string }",
    },
    {
        label: "data",
        detail: "Object"
    },
    {
        label: "headers",
        detail: "{ headers: Record<string, string> }",
    },
    {
        label: "json()",
        detail: "{ json(): any }",
        apply: "json()",
    },
    {
        label: "text()",
        detail: "{ text(): string }",
        apply: "text()",
    },
]

const expectChain: ApiEntry[] = [
    { label: "toBe(expected)", detail: "(expected: any) => void", apply: "toBe($1)" },
    { label: "not", detail: "negate assertion", children: [
            { label: "toBe(expected)", detail: "(expected: any) => void", apply: "toBe($1)" },
        ]},
    { label: "include(value)", detail: "(value: any) => void", apply: "include($1)" },
    { label: "equal(value)", detail: "(value: any) => void", apply: "equal($1)" },
    { label: "exist", detail: "assert value is truthy" },
    { label: "be", detail: "language chain", children: [
            { label: "true", detail: "assert true" },
            { label: "false", detail: "assert false" },
            { label: "null", detail: "assert null" },
            { label: "undefined", detail: "assert undefined" },
            { label: "empty", detail: "assert empty" },
        ]},
    { label: "have", detail: "language chain", children: [
            { label: "property(name)", detail: "(name: string) => Assertion", apply: "property(\"$1\")" },
            { label: "length(length)", detail: "(length: number) => Assertion", apply: "length($1)" },
        ]},
]

function toCompletions(entries: ApiEntry[]): Completion[] {
    return entries.map((e) => ({
        label: e.label,
        type: e.type ?? (e.children ? "property" : (e.label.includes("(") || e.apply?.includes("(") ? "function" : "property")),
        detail: e.detail,
        apply: e.apply ?? e.label,
    }))
}

function resolveExpectChain(segments: string[], trailingDot: boolean): ApiEntry[] | null {
    let current = expectChain
    const count = trailingDot ? segments.length : segments.length - 1
    for (let i = 0; i < count; i++) {
        const found = current.find((e) => e.label.startsWith(segments[i]))
        if (!found) return null
        if (!found.children) return i === segments.length - 1 && !trailingDot ? current : []
        current = found.children
    }
    return current
}

export function pmCompletionSource(context: CompletionContext): CompletionResult | null {
    const expectMatch = context.matchBefore(/pm\.expect\([^)]*\)(?:\.[\w]+)*\.?/)
    if (expectMatch) {
        const text = expectMatch.text
        const chainStart = /pm\.expect\([^)]*\)/.exec(text)![0].length
        const afterExpect = text.slice(chainStart)
        if (afterExpect === "") return null

        const chain = afterExpect.replace(/^\./, "")
        const trailingDot = text.endsWith(".")
        const segments = chain.split(".").filter(Boolean)
        const entries = resolveExpectChain(segments, trailingDot)
        if (!entries) return null

        const lastSeg = trailingDot ? "" : (segments[segments.length - 1] ?? "")
        return {
            from: expectMatch.to - lastSeg.length,
            options: toCompletions(entries),
        }
    }

    const word = context.matchBefore(/(?<!\w)pm(?:\.[\w]*)*\.?/)
    if (!word) return null

    const text = word.text
    if (text === "pm") {
        return { from: word.to, options: toCompletions(pmApi) }
    }

    const segments = text.split(".")
    const afterPm = segments.slice(1)
    const methodKey = afterPm[0]

    if (afterPm.length === 1 && !text.endsWith(".")) {
        return { from: word.from + "pm.".length, options: toCompletions(pmApi) }
    }

    const methodDef = pmApi.find((m) => m.label.startsWith(methodKey))
    if (!methodDef?.children) return null

    return {
        from: word.to,
        options: toCompletions(methodDef.children),
    }
}

export function resCompletionSource(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/(?<!\w)response(?:\.[\w]*)*\.?/)
    if (!word) return null

    const text = word.text

    if (text === "response" || text === "response.") {
        return { from: word.to, options: toCompletions(resApi) }
    }

    const segments = text.split(".")
    if (segments.length === 2 && !text.endsWith(".")) {
        const partial = segments[1]
        const filtered = resApi.filter((e) => e.label.startsWith(partial))
        if (filtered.length > 0) {
            return { from: word.from + "response.".length, options: toCompletions(filtered) }
        }
    }

    return null
}

export function requestCompletionSource(context: CompletionContext): CompletionResult | null {
    // If typing request at top level
    const topWord = context.matchBefore(/(?<![\w$])req(?:uest)?$/i)
    if (topWord && !context.matchBefore(/(?<![\w$])request\./)) {
        return {
            from: topWord.from,
            options: [
                {
                    label: "request",
                    type: "variable",
                    detail: "RestRequestResponse (request payload)",
                    apply: "request",
                    boost: 10,
                },
            ],
        }
    }

    const word = context.matchBefore(/(?<![\w$])request(?:\.[\w$]+|\[\d*\])*\.?[\w$]*/i)
    if (!word) return null

    const text = word.text
    if (text === "request" || text === "request.") {
        return { from: word.to, options: toCompletions(requestApi) }
    }

    const segments = text.split(".")
    const afterRequest = segments.slice(1)
    const trailingDot = text.endsWith(".")
    const lookupPath = trailingDot ? afterRequest.slice(0, -1) : afterRequest.slice(0, -1)

    let current: ApiEntry[] = requestApi
    for (const seg of lookupPath) {
        if (!seg) continue
        const cleanSeg = seg.replace(/\[\d*\]/g, "")
        const found = current.find((e) => e.label === cleanSeg)
        if (!found || !found.children) return null
        current = found.children
    }

    const lastSeg = trailingDot ? "" : (afterRequest[afterRequest.length - 1] ?? "")
    const cleanLastSeg = lastSeg.replace(/\[\d*\]/g, "")
    const filtered = cleanLastSeg ? current.filter((e) => e.label.startsWith(cleanLastSeg)) : current
    if (filtered.length === 0) return null

    return {
        from: word.to - lastSeg.length,
        options: toCompletions(filtered),
    }
}