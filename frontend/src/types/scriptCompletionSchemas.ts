import { snippetCompletion, type Completion } from "@codemirror/autocomplete"
import type { RestRequestResponse } from "@/pages/editor/services/requestConfig"
import type { CompletionNamespaceSchema, CompletionNode } from "@/types/codeEditor"

export const ITEM_URL_COMPLETION_NODES: CompletionNode[] = [
    { label: "id", detail: "string" },
    { label: "key", detail: "string" },
    { label: "value", detail: "string" },
    { label: "description", detail: "string" },
    { label: "disabled", detail: "boolean" },
    { label: "type", detail: "string" },
    { label: "src", detail: "string" },
]

export const PATH_VARIABLE_COMPLETION_NODES: CompletionNode[] = [
    { label: "id", detail: "string" },
    { label: "key", detail: "string" },
    { label: "value", detail: "string" },
]

export const EXAMPLE_RESPONSE_COMPLETION_NODES: CompletionNode[] = [
    { label: "id", detail: "string" },
    { label: "name", detail: "string" },
    { label: "status", detail: "string" },
    { label: "code", detail: "number" },
    { label: "body", detail: "string" },
    { label: "header", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
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

export const REQUEST_COMPLETION_NODES: CompletionNode[] = [
    { label: "id", detail: "string" },
    { label: "name", detail: "string" },
    { label: "method", detail: "string (e.g. GET, POST, PUT, DELETE)" },
    {
        label: "url",
        detail: "RequestURL",
        children: [
            { label: "raw", detail: "string (full URL string)" },
            { label: "host", detail: "string[]" },
            { label: "path", detail: "string[]" },
            { label: "query", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
            { label: "variable", detail: "PathVariable[]", children: PATH_VARIABLE_COMPLETION_NODES },
        ],
    },
    { label: "headers", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
    { label: "query", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
    {
        label: "body",
        detail: "RequestBody",
        children: [
            { label: "mode", detail: '"raw" | "formdata"' },
            { label: "raw", detail: "string" },
            { label: "formdata", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
        ],
    },
    {
        label: "auth",
        detail: "ReqAuth",
        children: [
            { label: "type", detail: "string" },
            { label: "bearer", detail: "ItemUrl[]", children: ITEM_URL_COMPLETION_NODES },
            { label: "authSource", detail: '"inherit" | "onrequest" | "none" | string' },
        ],
    },
    { label: "script", detail: "string" },
    { label: "responses", detail: "ExampleResponse[]", children: EXAMPLE_RESPONSE_COMPLETION_NODES },
    { label: "version", detail: "string" },
]

export const EXPECT_CHAIN_COMPLETION_NODES: CompletionNode[] = [
    { label: "toBe(expected)", detail: "(expected: any) => void", apply: "toBe(${1})" },
    {
        label: "not",
        detail: "negate assertion",
        children: [
            { label: "toBe(expected)", detail: "(expected: any) => void", apply: "toBe(${1})" },
        ],
    },
    { label: "include(value)", detail: "(value: any) => void", apply: "include(${1})" },
    { label: "equal(value)", detail: "(value: any) => void", apply: "equal(${1})" },
    { label: "exist", detail: "assert value is truthy" },
    {
        label: "be",
        detail: "language chain",
        children: [
            { label: "true", detail: "assert true" },
            { label: "false", detail: "assert false" },
            { label: "null", detail: "assert null" },
            { label: "undefined", detail: "assert undefined" },
            { label: "empty", detail: "assert empty" },
        ],
    },
    {
        label: "have",
        detail: "language chain",
        children: [
            { label: "property(name)", detail: "(name: string) => Assertion", apply: 'property("${1}")' },
            { label: "length(length)", detail: "(length: number) => Assertion", apply: "length(${1})" },
        ],
    },
]

export const PM_COMPLETION_NODES: CompletionNode[] = [
    {
        label: "environment",
        detail: "pm.environment",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: 'get("${1}")' },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: 'set("${1}", "${2}")' },
            { label: "unset(key)", detail: "(key: string) => void", apply: 'unset("${1}")' },
            { label: "toObject()", detail: "() => Record<string, string>", apply: "toObject()" },
        ],
    },
    {
        label: "collectionVariables",
        detail: "pm.collectionVariables",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: 'get("${1}")' },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: 'set("${1}", "${2}")' },
            { label: "has(key)", detail: "(key: string) => boolean", apply: 'has("${1}")' },
            { label: "unset(key)", detail: "(key: string) => void", apply: 'unset("${1}")' },
            { label: "clear()", detail: "() => void", apply: "clear()" },
        ],
    },
    {
        label: "variables",
        detail: "pm.variables",
        children: [
            { label: "get(key)", detail: "(key: string) => string | undefined", apply: 'get("${1}")' },
            { label: "set(key, value)", detail: "(key: string, value: string) => void", apply: 'set("${1}", "${2}")' },
            { label: "unset(key)", detail: "(key: string) => void", apply: 'unset("${1}")' },
            { label: "toObject()", detail: "() => Record<string, string>", apply: "toObject()" },
        ],
    },
    {
        label: "request",
        detail: "pm.request (RestRequestResponse)",
        children: REQUEST_COMPLETION_NODES,
    },
    {
        label: "expect",
        detail: "pm.expect(value: any)",
        apply: "expect(${1})",
    },
]

export const RESPONSE_COMPLETION_NODES: CompletionNode[] = [
    { label: "statusCode", detail: "{ statusCode: number }" },
    { label: "statusText", detail: "{ statusText: string }" },
    { label: "data", detail: "Object" },
    { label: "headers", detail: "{ headers: Record<string, string> }" },
    { label: "json()", detail: "{ json(): any }", apply: "json()" },
    { label: "text()", detail: "{ text(): string }", apply: "text()" },
]

export const CRYPTO_JS_COMPLETION_NODES: CompletionNode[] = [
    { label: "MD5(message)", detail: "CryptoJS.MD5(message: string | WordArray) => WordArray", apply: 'MD5("${1:message}")' },
    { label: "SHA1(message)", detail: "CryptoJS.SHA1(message: string | WordArray) => WordArray", apply: 'SHA1("${1:message}")' },
    { label: "SHA256(message)", detail: "CryptoJS.SHA256(message: string | WordArray) => WordArray", apply: 'SHA256("${1:message}")' },
    { label: "SHA512(message)", detail: "CryptoJS.SHA512(message: string | WordArray) => WordArray", apply: 'SHA512("${1:message}")' },
    { label: "SHA3(message)", detail: "CryptoJS.SHA3(message: string | WordArray) => WordArray", apply: 'SHA3("${1:message}")' },
    { label: "SHA224(message)", detail: "CryptoJS.SHA224(message: string | WordArray) => WordArray", apply: 'SHA224("${1:message}")' },
    { label: "SHA384(message)", detail: "CryptoJS.SHA384(message: string | WordArray) => WordArray", apply: 'SHA384("${1:message}")' },
    { label: "RIPEMD160(message)", detail: "CryptoJS.RIPEMD160(message: string | WordArray) => WordArray", apply: 'RIPEMD160("${1:message}")' },
    { label: "HmacMD5(message, key)", detail: "CryptoJS.HmacMD5(message, key) => WordArray", apply: 'HmacMD5("${1:message}", "${2:secret}")' },
    { label: "HmacSHA1(message, key)", detail: "CryptoJS.HmacSHA1(message, key) => WordArray", apply: 'HmacSHA1("${1:message}", "${2:secret}")' },
    { label: "HmacSHA256(message, key)", detail: "CryptoJS.HmacSHA256(message, key) => WordArray", apply: 'HmacSHA256("${1:message}", "${2:secret}")' },
    { label: "HmacSHA512(message, key)", detail: "CryptoJS.HmacSHA512(message, key) => WordArray", apply: 'HmacSHA512("${1:message}", "${2:secret}")' },
    {
        label: "AES",
        detail: "CryptoJS.AES",
        children: [
            { label: "encrypt(message, secret)", detail: "AES.encrypt(message, secret, cfg?) => CipherParams", apply: 'encrypt("${1:message}", "${2:secret}")' },
            { label: "decrypt(ciphertext, secret)", detail: "AES.decrypt(ciphertext, secret, cfg?) => WordArray", apply: 'decrypt(${1:ciphertext}, "${2:secret}")' },
        ],
    },
    {
        label: "DES",
        detail: "CryptoJS.DES",
        children: [
            { label: "encrypt(message, secret)", detail: "DES.encrypt(message, secret) => CipherParams", apply: 'encrypt("${1:message}", "${2:secret}")' },
            { label: "decrypt(ciphertext, secret)", detail: "DES.decrypt(ciphertext, secret) => WordArray", apply: 'decrypt(${1:ciphertext}, "${2:secret}")' },
        ],
    },
    {
        label: "TripleDES",
        detail: "CryptoJS.TripleDES",
        children: [
            { label: "encrypt(message, secret)", detail: "TripleDES.encrypt(message, secret) => CipherParams", apply: 'encrypt("${1:message}", "${2:secret}")' },
            { label: "decrypt(ciphertext, secret)", detail: "TripleDES.decrypt(ciphertext, secret) => WordArray", apply: 'decrypt(${1:ciphertext}, "${2:secret}")' },
        ],
    },
    {
        label: "RC4",
        detail: "CryptoJS.RC4",
        children: [
            { label: "encrypt(message, secret)", detail: "RC4.encrypt(message, secret) => CipherParams", apply: 'encrypt("${1:message}", "${2:secret}")' },
            { label: "decrypt(ciphertext, secret)", detail: "RC4.decrypt(ciphertext, secret) => WordArray", apply: 'decrypt(${1:ciphertext}, "${2:secret}")' },
        ],
    },
    {
        label: "enc",
        detail: "CryptoJS.enc",
        children: [
            {
                label: "Utf8",
                detail: "CryptoJS.enc.Utf8",
                children: [
                    { label: "parse(str)", detail: "Utf8.parse(str: string) => WordArray", apply: 'parse("${1:str}")' },
                    { label: "stringify(wordArray)", detail: "Utf8.stringify(wordArray: WordArray) => string", apply: "stringify(${1:wordArray})" },
                ],
            },
            {
                label: "Base64",
                detail: "CryptoJS.enc.Base64",
                children: [
                    { label: "parse(str)", detail: "Base64.parse(str: string) => WordArray", apply: 'parse("${1:str}")' },
                    { label: "stringify(wordArray)", detail: "Base64.stringify(wordArray: WordArray) => string", apply: "stringify(${1:wordArray})" },
                ],
            },
            {
                label: "Hex",
                detail: "CryptoJS.enc.Hex",
                children: [
                    { label: "parse(str)", detail: "Hex.parse(str: string) => WordArray", apply: 'parse("${1:str}")' },
                    { label: "stringify(wordArray)", detail: "Hex.stringify(wordArray: WordArray) => string", apply: "stringify(${1:wordArray})" },
                ],
            },
            {
                label: "Latin1",
                detail: "CryptoJS.enc.Latin1",
                children: [
                    { label: "parse(str)", detail: "Latin1.parse(str: string) => WordArray", apply: 'parse("${1:str}")' },
                    { label: "stringify(wordArray)", detail: "Latin1.stringify(wordArray: WordArray) => string", apply: "stringify(${1:wordArray})" },
                ],
            },
        ],
    },
    {
        label: "lib",
        detail: "CryptoJS.lib",
        children: [
            {
                label: "WordArray",
                detail: "CryptoJS.lib.WordArray",
                children: [
                    { label: "create(words?, sigBytes?)", detail: "WordArray.create() => WordArray", apply: "create(${1})" },
                    { label: "random(nBytes)", detail: "WordArray.random(nBytes: number) => WordArray", apply: "random(${1:16})" },
                ],
            },
        ],
    },
]

export const PM_NAMESPACE_SCHEMA: CompletionNamespaceSchema = {
    root: "pm",
    detail: "Postman Sandbox API",
    allowIndexAccess: true,
    members: PM_COMPLETION_NODES,
    chainPatterns: [
        {
            invocationPattern: "pm\\.expect\\([^)]*\\)",
            members: EXPECT_CHAIN_COMPLETION_NODES,
        },
    ],
}

export const RESPONSE_NAMESPACE_SCHEMA: CompletionNamespaceSchema = {
    root: "response",
    detail: "HTTP Response payload",
    members: RESPONSE_COMPLETION_NODES,
}

export const REQUEST_NAMESPACE_SCHEMA: CompletionNamespaceSchema = {
    root: "request",
    detail: "RestRequestResponse (request payload)",
    boost: 10,
    topLevelPattern: /(?<![\w$])req(?:uest)?$/i,
    allowIndexAccess: true,
    members: REQUEST_COMPLETION_NODES,
}

export const CRYPTO_JS_NAMESPACE_SCHEMA: CompletionNamespaceSchema = {
    root: "CryptoJS",
    detail: "CryptoJS crypto library",
    topLevelPattern: /(?<![\w$])Crypto?(?:JS)?$/i,
    members: CRYPTO_JS_COMPLETION_NODES,
}

export const JS_MEMBER_COMPLETIONS: Record<string, Completion[]> = {
    console: [
        snippetCompletion("log(${1})", { label: "log", detail: "(...data: any[]) => void", type: "method", boost: 10 }),
        snippetCompletion("warn(${1})", { label: "warn", detail: "(...data: any[]) => void", type: "method", boost: 9 }),
        snippetCompletion("error(${1})", { label: "error", detail: "(...data: any[]) => void", type: "method", boost: 9 }),
        snippetCompletion("info(${1})", { label: "info", detail: "(...data: any[]) => void", type: "method", boost: 8 }),
        snippetCompletion("debug(${1})", { label: "debug", detail: "(...data: any[]) => void", type: "method" }),
        snippetCompletion("table(${1})", { label: "table", detail: "(tabularData?: any) => void", type: "method" }),
        { label: "clear", detail: "() => void", type: "method", apply: "clear()" },
        snippetCompletion('time("${1:label}")', { label: "time", detail: "(label?: string) => void", type: "method" }),
        snippetCompletion('timeEnd("${1:label}")', { label: "timeEnd", detail: "(label?: string) => void", type: "method" }),
        snippetCompletion("dir(${1:item})", { label: "dir", detail: "(item?: any) => void", type: "method" }),
        snippetCompletion("trace(${1})", { label: "trace", detail: "(...data: any[]) => void", type: "method" }),
    ],
    JSON: [
        snippetCompletion("parse(${1})", { label: "parse", detail: "(text: string) => any", type: "method", boost: 10 }),
        snippetCompletion("stringify(${1}, null, 2)", { label: "stringify", detail: "(value: any, replacer?, space?) => string", type: "method", boost: 10 }),
    ],
    Math: [
        snippetCompletion("abs(${1})", { label: "abs", detail: "(x: number) => number", type: "method" }),
        snippetCompletion("floor(${1})", { label: "floor", detail: "(x: number) => number", type: "method", boost: 9 }),
        snippetCompletion("ceil(${1})", { label: "ceil", detail: "(x: number) => number", type: "method", boost: 9 }),
        snippetCompletion("round(${1})", { label: "round", detail: "(x: number) => number", type: "method", boost: 9 }),
        snippetCompletion("max(${1})", { label: "max", detail: "(...values: number[]) => number", type: "method", boost: 8 }),
        snippetCompletion("min(${1})", { label: "min", detail: "(...values: number[]) => number", type: "method", boost: 8 }),
        { label: "random", detail: "() => number", type: "method", apply: "random()", boost: 8 },
        snippetCompletion("sqrt(${1})", { label: "sqrt", detail: "(x: number) => number", type: "method" }),
        snippetCompletion("pow(${1:base}, ${2:exponent})", { label: "pow", detail: "(x: number, y: number) => number", type: "method" }),
        snippetCompletion("trunc(${1})", { label: "trunc", detail: "(x: number) => number", type: "method" }),
        snippetCompletion("sign(${1})", { label: "sign", detail: "(x: number) => number", type: "method" }),
        { label: "PI", detail: "3.141592653589793", type: "constant" },
        { label: "E", detail: "2.718281828459045", type: "constant" },
    ],
    Object: [
        snippetCompletion("keys(${1})", { label: "keys", detail: "(o: object) => string[]", type: "method", boost: 10 }),
        snippetCompletion("values(${1})", { label: "values", detail: "(o: object) => any[]", type: "method", boost: 9 }),
        snippetCompletion("entries(${1})", { label: "entries", detail: "(o: object) => [string, any][]", type: "method", boost: 9 }),
        snippetCompletion("assign(${1:target}, ${2:source})", { label: "assign", detail: "(target: object, ...sources: any[]) => object", type: "method", boost: 8 }),
        snippetCompletion("freeze(${1})", { label: "freeze", detail: "(o: any) => any", type: "method" }),
        snippetCompletion('hasOwn(${1:object}, "${2:prop}")', { label: "hasOwn", detail: "(o: object, prop: PropertyKey) => boolean", type: "method" }),
        snippetCompletion("create(${1:proto})", { label: "create", detail: "(proto: object | null) => any", type: "method" }),
    ],
    Array: [
        snippetCompletion("isArray(${1})", { label: "isArray", detail: "(arg: any) => boolean", type: "method", boost: 10 }),
        snippetCompletion("from(${1})", { label: "from", detail: "(arrayLike: any) => any[]", type: "method", boost: 8 }),
        snippetCompletion("of(${1})", { label: "of", detail: "(...items: any[]) => any[]", type: "method" }),
    ],
    Promise: [
        snippetCompletion("resolve(${1})", { label: "resolve", detail: "(value: any) => Promise<any>", type: "method", boost: 9 }),
        snippetCompletion("reject(${1})", { label: "reject", detail: "(reason: any) => Promise<never>", type: "method" }),
        snippetCompletion("all([${1}])", { label: "all", detail: "(values: any[]) => Promise<any[]>", type: "method", boost: 8 }),
        snippetCompletion("allSettled([${1}])", { label: "allSettled", detail: "(values: any[]) => Promise<any[]>", type: "method" }),
        snippetCompletion("race([${1}])", { label: "race", detail: "(values: any[]) => Promise<any>", type: "method" }),
    ],
    Date: [
        { label: "now", detail: "() => number", type: "method", apply: "now()", boost: 9 },
        snippetCompletion('parse("${1}")', { label: "parse", detail: "(s: string) => number", type: "method" }),
    ],
}

export const JS_GENERIC_MEMBER_COMPLETIONS: Completion[] = [
    snippetCompletion("map((${1:item}) => ${2})", { label: "map", detail: "(callback) => any[]", type: "method", boost: 10 }),
    snippetCompletion("filter((${1:item}) => ${2})", { label: "filter", detail: "(predicate) => any[]", type: "method", boost: 10 }),
    snippetCompletion("forEach((${1:item}) => {\n\t${2}\n})", { label: "forEach", detail: "(callback) => void", type: "method", boost: 9 }),
    snippetCompletion("reduce((${1:acc}, ${2:curr}) => ${3}, ${4:initial})", { label: "reduce", detail: "(callback, initial) => any", type: "method", boost: 8 }),
    snippetCompletion("find((${1:item}) => ${2})", { label: "find", detail: "(predicate) => any", type: "method", boost: 9 }),
    snippetCompletion("findIndex((${1:item}) => ${2})", { label: "findIndex", detail: "(predicate) => number", type: "method" }),
    snippetCompletion("some((${1:item}) => ${2})", { label: "some", detail: "(predicate) => boolean", type: "method" }),
    snippetCompletion("every((${1:item}) => ${2})", { label: "every", detail: "(predicate) => boolean", type: "method" }),
    snippetCompletion("includes(${1})", { label: "includes", detail: "(searchElement: any) => boolean", type: "method", boost: 9 }),
    snippetCompletion("indexOf(${1})", { label: "indexOf", detail: "(searchElement: any) => number", type: "method", boost: 8 }),
    snippetCompletion('join("${1:,}")', { label: "join", detail: "(separator?: string) => string", type: "method", boost: 7 }),
    snippetCompletion("slice(${1:start}, ${2:end})", { label: "slice", detail: "(start?, end?) => any", type: "method", boost: 8 }),
    snippetCompletion("splice(${1:start}, ${2:deleteCount})", { label: "splice", detail: "(start, deleteCount, ...items) => any[]", type: "method" }),
    snippetCompletion("push(${1})", { label: "push", detail: "(...items: any[]) => number", type: "method", boost: 9 }),
    { label: "pop", detail: "() => any", type: "method", apply: "pop()" },
    { label: "shift", detail: "() => any", type: "method", apply: "shift()" },
    snippetCompletion("unshift(${1})", { label: "unshift", detail: "(...items: any[]) => number", type: "method" }),
    snippetCompletion("concat(${1})", { label: "concat", detail: "(...items: any[]) => any[]", type: "method" }),
    snippetCompletion("flat(${1:1})", { label: "flat", detail: "(depth?: number) => any[]", type: "method" }),
    snippetCompletion("flatMap((${1:item}) => ${2})", { label: "flatMap", detail: "(callback) => any[]", type: "method" }),
    snippetCompletion("sort((${1:a}, ${2:b}) => ${3})", { label: "sort", detail: "(compareFn) => any[]", type: "method" }),
    { label: "reverse", detail: "() => any[]", type: "method", apply: "reverse()" },
    { label: "length", detail: "number", type: "property", boost: 10 },
    snippetCompletion('split("${1}")', { label: "split", detail: "(separator: string | RegExp) => string[]", type: "method", boost: 9 }),
    { label: "trim", detail: "() => string", type: "method", apply: "trim()", boost: 8 },
    { label: "trimStart", detail: "() => string", type: "method", apply: "trimStart()" },
    { label: "trimEnd", detail: "() => string", type: "method", apply: "trimEnd()" },
    { label: "toLowerCase", detail: "() => string", type: "method", apply: "toLowerCase()", boost: 8 },
    { label: "toUpperCase", detail: "() => string", type: "method", apply: "toUpperCase()", boost: 8 },
    snippetCompletion('startsWith("${1}")', { label: "startsWith", detail: "(search: string) => boolean", type: "method", boost: 8 }),
    snippetCompletion('endsWith("${1}")', { label: "endsWith", detail: "(search: string) => boolean", type: "method", boost: 8 }),
    snippetCompletion('replace("${1}", "${2}")', { label: "replace", detail: "(pattern, replacement) => string", type: "method", boost: 8 }),
    snippetCompletion('replaceAll("${1}", "${2}")', { label: "replaceAll", detail: "(pattern, replacement) => string", type: "method" }),
    snippetCompletion("substring(${1:start}, ${2:end})", { label: "substring", detail: "(start, end?) => string", type: "method" }),
    snippetCompletion("charAt(${1:0})", { label: "charAt", detail: "(index: number) => string", type: "method" }),
    snippetCompletion("charCodeAt(${1:0})", { label: "charCodeAt", detail: "(index: number) => number", type: "method" }),
    snippetCompletion('padStart(${1:length}, "${2:0}")', { label: "padStart", detail: "(targetLength, padString?) => string", type: "method" }),
    snippetCompletion('padEnd(${1:length}, "${2:0}")', { label: "padEnd", detail: "(targetLength, padString?) => string", type: "method" }),
    snippetCompletion("repeat(${1:count})", { label: "repeat", detail: "(count: number) => string", type: "method" }),
    snippetCompletion("match(${1:regexp})", { label: "match", detail: "(regexp: RegExp) => RegExpMatchArray | null", type: "method" }),
    { label: "toString", detail: "() => string", type: "method", apply: "toString()", boost: 8 },
    { label: "valueOf", detail: "() => any", type: "method", apply: "valueOf()" },
    snippetCompletion('hasOwnProperty("${1}")', { label: "hasOwnProperty", detail: "(prop) => boolean", type: "method" }),
    snippetCompletion("then((${1:res}) => {\n\t${2}\n})", { label: "then", detail: "(onfulfilled) => Promise", type: "method", boost: 9 }),
    snippetCompletion("catch((${1:err}) => {\n\t${2}\n})", { label: "catch", detail: "(onrejected) => Promise", type: "method", boost: 8 }),
    snippetCompletion("finally(() => {\n\t${1}\n})", { label: "finally", detail: "(onfinally) => Promise", type: "method" }),
]

export const JS_TOP_LEVEL_COMPLETIONS: Completion[] = [
    { label: "const", type: "keyword", detail: "declare constant", boost: 10 },
    { label: "let", type: "keyword", detail: "declare variable", boost: 10 },
    { label: "var", type: "keyword", detail: "declare variable", boost: 5 },
    { label: "function", type: "keyword", detail: "declare function", boost: 9 },
    { label: "return", type: "keyword", detail: "return statement", boost: 10 },
    { label: "async", type: "keyword", detail: "async function modifier", boost: 9 },
    { label: "await", type: "keyword", detail: "await promise expression", boost: 9 },
    { label: "if", type: "keyword", detail: "if statement", boost: 9 },
    { label: "else", type: "keyword", detail: "else statement", boost: 8 },
    { label: "for", type: "keyword", detail: "for loop", boost: 8 },
    { label: "while", type: "keyword", detail: "while loop", boost: 7 },
    { label: "do", type: "keyword", detail: "do...while loop" },
    { label: "switch", type: "keyword", detail: "switch statement" },
    { label: "case", type: "keyword", detail: "switch case" },
    { label: "default", type: "keyword", detail: "switch default" },
    { label: "break", type: "keyword", detail: "break statement" },
    { label: "continue", type: "keyword", detail: "continue statement" },
    { label: "try", type: "keyword", detail: "try block", boost: 9 },
    { label: "catch", type: "keyword", detail: "catch block", boost: 9 },
    { label: "finally", type: "keyword", detail: "finally block" },
    { label: "throw", type: "keyword", detail: "throw statement" },
    { label: "class", type: "keyword", detail: "declare class" },
    { label: "extends", type: "keyword", detail: "class extends" },
    { label: "super", type: "keyword", detail: "super call" },
    { label: "this", type: "keyword", detail: "current context", boost: 8 },
    { label: "new", type: "keyword", detail: "constructor operator", boost: 9 },
    { label: "typeof", type: "keyword", detail: "type query operator", boost: 8 },
    { label: "instanceof", type: "keyword", detail: "instance check operator" },
    { label: "delete", type: "keyword", detail: "delete property" },
    { label: "void", type: "keyword", detail: "void operator" },
    { label: "yield", type: "keyword", detail: "generator yield" },
    { label: "true", type: "constant", detail: "boolean true", boost: 7 },
    { label: "false", type: "constant", detail: "boolean false", boost: 7 },
    { label: "null", type: "constant", detail: "null value", boost: 7 },
    { label: "undefined", type: "constant", detail: "undefined value", boost: 6 },
    snippetCompletion("console.log(${1})", { label: "clg", detail: "console.log()", type: "function", boost: 10 }),
    snippetCompletion("if (${1:condition}) {\n\t${2}\n}", { label: "if (snippet)", detail: "if statement snippet", type: "keyword", boost: 8 }),
    snippetCompletion("if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}", { label: "ifelse", detail: "if ... else ...", type: "keyword", boost: 8 }),
    snippetCompletion("for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}", { label: "for (snippet)", detail: "indexed for loop", type: "keyword", boost: 7 }),
    snippetCompletion("for (const ${1:item} of ${2:iterable}) {\n\t${3}\n}", { label: "forof", detail: "for (const item of list)", type: "keyword", boost: 8 }),
    snippetCompletion("for (const ${1:key} in ${2:object}) {\n\t${3}\n}", { label: "forin", detail: "for (const key in obj)", type: "keyword" }),
    snippetCompletion("while (${1:condition}) {\n\t${2}\n}", { label: "while (snippet)", detail: "while loop", type: "keyword" }),
    snippetCompletion("try {\n\t${1}\n} catch (${2:err}) {\n\t${3}\n}", { label: "trycatch", detail: "try ... catch ...", type: "keyword", boost: 9 }),
    snippetCompletion("function ${1:name}(${2:params}) {\n\t${3}\n}", { label: "func", detail: "function declaration", type: "keyword", boost: 9 }),
    snippetCompletion("async function ${1:name}(${2:params}) {\n\t${3}\n}", { label: "afunc", detail: "async function declaration", type: "keyword", boost: 8 }),
    snippetCompletion("(${1:params}) => {\n\t${2}\n}", { label: "arrow", detail: "arrow function", type: "function", boost: 9 }),
    snippetCompletion("setTimeout(() => {\n\t${1}\n}, ${2:1000})", { label: "settimeout", detail: "setTimeout(() => ..., ms)", type: "function", boost: 7 }),
    snippetCompletion("setInterval(() => {\n\t${1}\n}, ${2:1000})", { label: "setinterval", detail: "setInterval(() => ..., ms)", type: "function" }),
    snippetCompletion("new Promise((${1:resolve}, ${2:reject}) => {\n\t${3}\n})", { label: "promise", detail: "new Promise((res, rej) => ...)", type: "class", boost: 8 }),
    { label: "console", type: "variable", detail: "Console API", boost: 9 },
    { label: "JSON", type: "class", detail: "JSON parser & serializer", boost: 9 },
    { label: "Math", type: "class", detail: "Math utilities and constants", boost: 8 },
    { label: "Object", type: "class", detail: "Object constructor", boost: 8 },
    { label: "Array", type: "class", detail: "Array constructor", boost: 8 },
    { label: "String", type: "class", detail: "String constructor", boost: 7 },
    { label: "Number", type: "class", detail: "Number constructor", boost: 7 },
    { label: "Boolean", type: "class", detail: "Boolean constructor", boost: 6 },
    { label: "Date", type: "class", detail: "Date constructor", boost: 7 },
    { label: "RegExp", type: "class", detail: "RegExp constructor", boost: 6 },
    { label: "Promise", type: "class", detail: "Promise constructor", boost: 8 },
    { label: "Map", type: "class", detail: "Map collection", boost: 6 },
    { label: "Set", type: "class", detail: "Set collection", boost: 6 },
    { label: "Error", type: "class", detail: "Error constructor", boost: 7 },
    { label: "TypeError", type: "class", detail: "TypeError constructor" },
    snippetCompletion("parseInt(${1:string}, ${2:10})", { label: "parseInt", detail: "(string, radix?) => number", type: "function", boost: 7 }),
    snippetCompletion("parseFloat(${1:string})", { label: "parseFloat", detail: "(string) => number", type: "function", boost: 7 }),
    snippetCompletion("isNaN(${1:number})", { label: "isNaN", detail: "(number) => boolean", type: "function" }),
    snippetCompletion("isFinite(${1:number})", { label: "isFinite", detail: "(number) => boolean", type: "function" }),
    snippetCompletion("encodeURI(${1:uri})", { label: "encodeURI", detail: "(uri) => string", type: "function" }),
    snippetCompletion("encodeURIComponent(${1:uriComponent})", { label: "encodeURIComponent", detail: "(uriComponent) => string", type: "function", boost: 6 }),
    snippetCompletion("decodeURI(${1:encodedURI})", { label: "decodeURI", detail: "(encodedURI) => string", type: "function" }),
    snippetCompletion("decodeURIComponent(${1:encodedURIComponent})", { label: "decodeURIComponent", detail: "(encodedURIComponent) => string", type: "function" }),
    snippetCompletion("setTimeout(${1:handler}, ${2:timeout})", { label: "setTimeout", detail: "(handler, timeout?) => number", type: "function", boost: 7 }),
    snippetCompletion("clearTimeout(${1:id})", { label: "clearTimeout", detail: "(id) => void", type: "function" }),
    snippetCompletion("setInterval(${1:handler}, ${2:timeout})", { label: "setInterval", detail: "(handler, timeout?) => number", type: "function" }),
    snippetCompletion("clearInterval(${1:id})", { label: "clearInterval", detail: "(id) => void", type: "function" }),
    snippetCompletion("btoa(${1:data})", { label: "btoa", detail: "(data: string) => string", type: "function" }),
    snippetCompletion("atob(${1:data})", { label: "atob", detail: "(data: string) => string", type: "function" }),
]

export const PRE_REQUEST_COMPLETION_SCHEMAS: CompletionNamespaceSchema[] = [
    PM_NAMESPACE_SCHEMA,
    REQUEST_NAMESPACE_SCHEMA,
    CRYPTO_JS_NAMESPACE_SCHEMA,
]

export const POST_REQUEST_COMPLETION_SCHEMAS: CompletionNamespaceSchema[] = [
    PM_NAMESPACE_SCHEMA,
    RESPONSE_NAMESPACE_SCHEMA,
]

export const DEFAULT_MOCK_REQUEST: RestRequestResponse = {
    id: "mock-req-id",
    name: "Mock Request",
    method: "GET",
    url: {
        raw: "https://api.example.com/users",
        host: ["api", "example", "com"],
        path: ["users"],
        query: [],
    },
    headers: [
        { id: "h1", key: "Accept", value: "application/json" },
    ],
    query: [],
    body: { mode: "raw", raw: '{\n  "title": "foo",\n  "body": "bar"\n}' },
    script: "",
    version: "1.0",
}
