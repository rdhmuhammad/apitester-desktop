import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete"

interface ApiEntry {
    label: string
    detail: string
    apply?: string
    children?: ApiEntry[]
}

const cryptoJsApi: ApiEntry[] = [
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

function toCompletions(entries: ApiEntry[]): Completion[] {
    return entries.map((e) => {
        if (e.apply && e.apply.includes("${")) {
            return snippetCompletion(e.apply, {
                label: e.label,
                type: e.children ? "property" : "function",
                detail: e.detail,
            })
        }
        return {
            label: e.label,
            type: e.children ? "property" : "function",
            detail: e.detail,
            apply: e.apply ?? e.label,
        }
    })
}

export function cryptoJsCompletionSource(context: CompletionContext): CompletionResult | null {
    // If typing CryptoJS at top level
    const topWord = context.matchBefore(/(?<![\w$])Crypto?(?:JS)?$/i)
    if (topWord && !context.matchBefore(/(?<![\w$])CryptoJS\./)) {
        return {
            from: topWord.from,
            options: [
                {
                    label: "CryptoJS",
                    type: "variable",
                    detail: "CryptoJS crypto library",
                    apply: "CryptoJS",
                },
            ],
        }
    }

    const word = context.matchBefore(/(?<![\w$])CryptoJS(?:\.[\w$]*)*\.?/)
    if (!word) return null

    const text = word.text
    if (text === "CryptoJS") {
        return { from: word.to, options: toCompletions(cryptoJsApi) }
    }

    const segments = text.split(".")
    const afterCrypto = segments.slice(1)
    const trailingDot = text.endsWith(".")
    const lookupPath = trailingDot ? afterCrypto.slice(0, -1) : afterCrypto.slice(0, -1)

    let current: ApiEntry[] = cryptoJsApi
    for (const seg of lookupPath) {
        if (!seg) continue
        const found = current.find((e) => e.label === seg)
        if (!found || !found.children) return null
        current = found.children
    }

    const lastSeg = trailingDot ? "" : (afterCrypto[afterCrypto.length - 1] ?? "")
    return {
        from: word.to - lastSeg.length,
        options: toCompletions(current),
    }
}

