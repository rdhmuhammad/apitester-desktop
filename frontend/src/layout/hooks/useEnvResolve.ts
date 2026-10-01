import {useMemo} from "react"
import {useCollection} from "@/layout/hooks/useCollection.ts"
import type {ItemUrl} from "@/pages/editor/types/api.ts"

// ---------------------------------------------------------------------------
// resolveVars — pure helper, replaces {{KEY}} placeholders with env values
// ---------------------------------------------------------------------------
export const resolveVars = (value: unknown, vars: Record<string, string>): string => {
    if (value === null || value === undefined) return ""
    let str: string
    if (typeof value === "string") {
        str = value
    } else if (typeof value === "object") {
        if (value && typeof (value as any).toString === "function" && (value as any).toString !== Object.prototype.toString) {
            str = (value as any).toString()
        } else {
            str = JSON.stringify(value)
        }
    } else {
        str = String(value)
    }

    return str.replace(/\{\{([^{}]+)\}\}/g, (_, key: string) => {
        const k = key.trim()
        const resolved = vars[k]
        if (resolved === undefined || resolved === null) return `{{${key}}}`
        if (typeof resolved === "object") {
            if (resolved && typeof (resolved as any).toString === "function" && (resolved as any).toString !== Object.prototype.toString) {
                return (resolved as any).toString()
            }
            return JSON.stringify(resolved)
        }
        return String(resolved)
    })
}

// ---------------------------------------------------------------------------
// buildEnvVarsRecord — builds a flat key→value map from CollectionVar[]
// The selected BASE_URL var's value is also stored under "BASE_URL" key.
// ---------------------------------------------------------------------------
export const buildEnvVarsRecord = (
    variables: {id: string; key: string; value: string; category: string; type: string; isSelected?: boolean}[]
): Record<string, string> => {
    const record: Record<string, string> = {}
    for (const v of variables) {
        record[v.key] = v.value
    }
    // Expose the selected base URL under the conventional BASE_URL key
    const selectedBaseUrlVar = variables.find(v => v.isSelected && v.category === "BASE_URL")
    if (selectedBaseUrlVar) {
        record["BASE_URL"] = selectedBaseUrlVar.value
        // Also update the entry under its own key to the selected value
        record[selectedBaseUrlVar.key] = selectedBaseUrlVar.value
    }
    return record
}

// ---------------------------------------------------------------------------
// useEnvResolve — hook that provides env-aware resolver functions
// ---------------------------------------------------------------------------
export const useEnvResolve = () => {
    const {variables} = useCollection()

    const envVars = useMemo(() => buildEnvVarsRecord(variables), [variables])

    const selectedBaseUrl = useMemo(
        () => variables.find(v => v.isSelected && v.category === "BASE_URL")?.value ?? "",
        [variables]
    )

    /** Resolve {{VAR}} placeholders in a string/value */
    const resolve = (value: unknown): string => resolveVars(value, envVars)

    /** Resolve an array of ItemUrl (headers / query params), skipping disabled rows */
    const resolveItems = (items: ItemUrl[]): ItemUrl[] =>
        items
            .filter(item => !item.disabled)
            .map(item => ({
                ...item,
                key: resolveVars(item.key, envVars),
                value: resolveVars(item.value ?? "", envVars),
            }))

    /** Resolve a JSON body string */
    const resolveBody = (raw: string | undefined): string =>
        raw ? resolveVars(raw, envVars) : ""

    return {
        envVars,
        selectedBaseUrl,
        resolve,
        resolveItems,
        resolveBody,
    }
}
