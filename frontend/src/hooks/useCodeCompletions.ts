import { useMemo } from "react"
import {
    snippetCompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult,
    type CompletionSource,
} from "@codemirror/autocomplete"
import type {
    CompletionNamespaceSchema,
    CompletionNode,
    ScriptCompletionPreset,
} from "@/types/codeEditor"
import {
    CRYPTO_JS_NAMESPACE_SCHEMA,
    JS_GENERIC_MEMBER_COMPLETIONS,
    JS_MEMBER_COMPLETIONS,
    JS_TOP_LEVEL_COMPLETIONS,
    PM_NAMESPACE_SCHEMA,
    POST_REQUEST_COMPLETION_SCHEMAS,
    PRE_REQUEST_COMPLETION_SCHEMAS,
    REQUEST_NAMESPACE_SCHEMA,
    RESPONSE_NAMESPACE_SCHEMA,
} from "@/types/scriptCompletionSchemas"

export function nodesToCompletions(entries: CompletionNode[]): Completion[] {
    return entries.map((entry) => {
        const inferredType =
            entry.type ??
            (entry.children
                ? "property"
                : entry.label.includes("(") || entry.apply?.includes("(")
                  ? "function"
                  : "property")

        if (entry.apply && entry.apply.includes("${")) {
            return snippetCompletion(entry.apply, {
                label: entry.label,
                type: inferredType,
                detail: entry.detail,
                boost: entry.boost,
            })
        }

        return {
            label: entry.label,
            type: inferredType,
            detail: entry.detail,
            apply: entry.apply ?? entry.label,
            boost: entry.boost,
        }
    })
}

function normalizeSegment(segment: string, allowIndexAccess?: boolean): string {
    return allowIndexAccess ? segment.replace(/\[\d*\]/g, "") : segment
}

function findMatchingNode(nodes: CompletionNode[], segment: string): CompletionNode | undefined {
    return (
        nodes.find((node) => node.label === segment) ??
        nodes.find((node) => node.label.split("(")[0] === segment) ??
        nodes.find((node) => node.label.startsWith(segment))
    )
}

function resolveChainNodes(
    rootNodes: CompletionNode[],
    segments: string[],
    trailingDot: boolean,
    allowIndexAccess?: boolean
): CompletionNode[] | null {
    let current = rootNodes
    const lookupSegments = trailingDot ? segments : segments.slice(0, -1)

    for (let i = 0; i < lookupSegments.length; i++) {
        const rawSeg = lookupSegments[i]
        if (!rawSeg) continue
        const seg = normalizeSegment(rawSeg, allowIndexAccess)
        const found = findMatchingNode(current, seg)
        if (!found || !found.children) return null
        current = found.children
    }

    if (trailingDot) return current

    const lastRaw = segments[segments.length - 1] ?? ""
    const lastSeg = normalizeSegment(lastRaw, allowIndexAccess)
    if (!lastSeg) return current

    const filtered = current.filter((node) => node.label.startsWith(lastSeg))
    return filtered.length > 0 ? filtered : null
}

export function createNamespaceCompletionSource(schema: CompletionNamespaceSchema): CompletionSource {
    const { root, detail, type = "variable", boost, topLevelPattern, allowIndexAccess, members, chainPatterns } = schema
    const compiledChains = (chainPatterns ?? []).map((cp) => ({
        fullRegex: new RegExp(`${cp.invocationPattern}(?:\\.[\\w$]+)*\\.?`),
        headRegex: new RegExp(cp.invocationPattern),
        members: cp.members,
    }))
    const rootDotRegex = new RegExp(`(?<![\\w$])${root}\\.`)
    const memberAccessRegex = allowIndexAccess
        ? new RegExp(`(?<![\\w$])${root}(?:\\.[\\w$]*|\\[\\d*\\])*\\.?[\\w$]*`)
        : new RegExp(`(?<![\\w$])${root}(?:\\.[\\w$]*)*\\.?`)

    return (context: CompletionContext): CompletionResult | null => {
        for (const chainDef of compiledChains) {
            const chainMatch = context.matchBefore(chainDef.fullRegex)
            if (chainMatch) {
                const text = chainMatch.text
                const headExec = chainDef.headRegex.exec(text)
                if (!headExec) continue
                const afterInvocation = text.slice(headExec[0].length)
                if (afterInvocation === "") return null

                const trailingDot = text.endsWith(".")
                const segments = afterInvocation.replace(/^\./, "").split(".").filter(Boolean)
                const resolved = resolveChainNodes(chainDef.members, segments, trailingDot, allowIndexAccess)
                if (!resolved) return null

                const lastSeg = trailingDot ? "" : (segments[segments.length - 1] ?? "")
                return {
                    from: chainMatch.to - lastSeg.length,
                    options: nodesToCompletions(resolved),
                }
            }
        }

        if (topLevelPattern) {
            const topWord = context.matchBefore(topLevelPattern)
            if (topWord && !context.matchBefore(rootDotRegex)) {
                return {
                    from: topWord.from,
                    options: [
                        {
                            label: root,
                            type,
                            detail,
                            apply: root,
                            boost,
                        },
                    ],
                }
            }
        }

        const word = context.matchBefore(memberAccessRegex)
        if (!word) return null

        const text = word.text
        if (text === root || text === `${root}.`) {
            return { from: word.to, options: nodesToCompletions(members) }
        }

        const segments = text.split(".")
        const afterRoot = segments.slice(1)
        const trailingDot = text.endsWith(".")
        const cleanSegments = afterRoot.filter((s) => s.length > 0)

        const resolved = resolveChainNodes(members, cleanSegments, trailingDot, allowIndexAccess)
        if (!resolved) return null

        const lastSeg = trailingDot ? "" : (afterRoot[afterRoot.length - 1] ?? "")
        return {
            from: word.to - lastSeg.length,
            options: nodesToCompletions(resolved),
        }
    }
}

export function createJsCompletionSource(
    excludedSchemas: CompletionNamespaceSchema[] = [
        PM_NAMESPACE_SCHEMA,
        RESPONSE_NAMESPACE_SCHEMA,
        REQUEST_NAMESPACE_SCHEMA,
        CRYPTO_JS_NAMESPACE_SCHEMA,
    ]
): CompletionSource {
    const rootsPattern = excludedSchemas.map((s) => s.root).join("|")
    const excludedMemberRegex = rootsPattern
        ? new RegExp(`(?<!\\w)(?:${rootsPattern})(?:\\.[\\w$]*)*\\.[\\w$]*$`)
        : null
    const excludedChainRegexes = excludedSchemas.flatMap((s) =>
        (s.chainPatterns ?? []).map((cp) => new RegExp(`(?<!\\w)${cp.invocationPattern}(?:\\.[\\w$]+)*\\.?$`))
    )

    return (context: CompletionContext): CompletionResult | null => {
        const recentSlice = context.state.sliceDoc(Math.max(0, context.pos - 100), context.pos)
        for (const chainRegex of excludedChainRegexes) {
            if (chainRegex.test(recentSlice)) {
                return null
            }
        }

        const dotMatch = context.matchBefore(/\.([a-zA-Z_$][\w$]*)?$/)
        if (dotMatch) {
            const textBeforePos = context.state.sliceDoc(Math.max(0, context.pos - 50), context.pos)
            if (excludedMemberRegex && excludedMemberRegex.test(textBeforePos)) {
                return null
            }

            const namedObjMatch = context.matchBefore(/([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)?$/)
            if (namedObjMatch) {
                const dotIdx = namedObjMatch.text.lastIndexOf(".")
                const targetObj = namedObjMatch.text.slice(0, dotIdx)
                if (targetObj in JS_MEMBER_COMPLETIONS) {
                    return {
                        from: dotMatch.from + 1,
                        options: JS_MEMBER_COMPLETIONS[targetObj],
                    }
                }
            }

            return {
                from: dotMatch.from + 1,
                options: JS_GENERIC_MEMBER_COMPLETIONS,
            }
        }

        const word = context.matchBefore(/[a-zA-Z_$][\w$]*/)
        if (!word && !context.explicit) return null

        return {
            from: word ? word.from : context.pos,
            options: JS_TOP_LEVEL_COMPLETIONS,
        }
    }
}

export const pmCompletionSource = createNamespaceCompletionSource(PM_NAMESPACE_SCHEMA)
export const resCompletionSource = createNamespaceCompletionSource(RESPONSE_NAMESPACE_SCHEMA)
export const requestCompletionSource = createNamespaceCompletionSource(REQUEST_NAMESPACE_SCHEMA)
export const cryptoJsCompletionSource = createNamespaceCompletionSource(CRYPTO_JS_NAMESPACE_SCHEMA)
export const jsCompletionSource = createJsCompletionSource()

export function useCodeCompletions(
    presetOrSchemas: ScriptCompletionPreset | CompletionNamespaceSchema[] = "none"
): CompletionSource[] {
    return useMemo(() => {
        if (presetOrSchemas === "none") return []

        const schemas = Array.isArray(presetOrSchemas)
            ? presetOrSchemas
            : presetOrSchemas === "prerequest"
              ? PRE_REQUEST_COMPLETION_SCHEMAS
              : POST_REQUEST_COMPLETION_SCHEMAS

        return [
            ...schemas.map((schema) => createNamespaceCompletionSource(schema)),
            createJsCompletionSource(schemas),
        ]
    }, [presetOrSchemas])
}
