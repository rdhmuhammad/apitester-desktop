import {
    snippetCompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult,
} from "@codemirror/autocomplete"

// 1. Members of specific global objects
const memberCompletions: Record<string, Completion[]> = {
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

// 2. Generic prototype and property completions (e.g. data.map, str.trim)
const genericMemberCompletions: Completion[] = [
    // Array methods
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

    // String methods
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

    // Object / Promise / Common methods
    { label: "toString", detail: "() => string", type: "method", apply: "toString()", boost: 8 },
    { label: "valueOf", detail: "() => any", type: "method", apply: "valueOf()" },
    snippetCompletion('hasOwnProperty("${1}")', { label: "hasOwnProperty", detail: "(prop) => boolean", type: "method" }),
    snippetCompletion("then((${1:res}) => {\n\t${2}\n})", { label: "then", detail: "(onfulfilled) => Promise", type: "method", boost: 9 }),
    snippetCompletion("catch((${1:err}) => {\n\t${2}\n})", { label: "catch", detail: "(onrejected) => Promise", type: "method", boost: 8 }),
    snippetCompletion("finally(() => {\n\t${1}\n})", { label: "finally", detail: "(onfinally) => Promise", type: "method" }),
]

// 3. Top-level keywords, built-in constructors, functions, and snippets
const topLevelCompletions: Completion[] = [
    // Keywords & Declarations
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

    // Snippets
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

    // Globals & Classes
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

    // Global utility functions
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

/**
 * Autocompletion source for standard JavaScript keywords, built-ins, member methods, and snippets.
 */
export function jsCompletionSource(context: CompletionContext): CompletionResult | null {
    // 1. Delegate pm and response chains to their respective completion sources
    const pmExpect = /(?<!\w)pm\.expect\([^)]*\)(?:\.[\w$]+)*\.?$/
    if (pmExpect.test(context.state.sliceDoc(Math.max(0, context.pos - 100), context.pos))) {
        return null
    }

    // 2. Check for member access after dot: e.g. "console.l", "JSON.p", "data.m"
    const dotMatch = context.matchBefore(/\.([a-zA-Z_$][\w$]*)?$/)
    if (dotMatch) {
        const textBeforePos = context.state.sliceDoc(Math.max(0, context.pos - 50), context.pos)

        // Ignore pm. and response. expressions
        if (/(?<!\w)(?:pm|response)(?:\.[\w$]*)*\.[\w$]*$/.test(textBeforePos)) {
            return null
        }

        // Check if there is a known named object preceding the dot: e.g. "console.", "JSON."
        const namedObjMatch = context.matchBefore(/([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)?$/)
        if (namedObjMatch) {
            const dotIdx = namedObjMatch.text.lastIndexOf(".")
            const targetObj = namedObjMatch.text.slice(0, dotIdx)
            if (targetObj in memberCompletions) {
                return {
                    from: dotMatch.from + 1,
                    options: memberCompletions[targetObj],
                }
            }
        }

        return {
            from: dotMatch.from + 1,
            options: genericMemberCompletions,
        }
    }

    // 3. Top-level word match (keywords, globals, snippets)
    const word = context.matchBefore(/[a-zA-Z_$][\w$]*/)
    if (!word && !context.explicit) return null

    return {
        from: word ? word.from : context.pos,
        options: topLevelCompletions,
    }
}
