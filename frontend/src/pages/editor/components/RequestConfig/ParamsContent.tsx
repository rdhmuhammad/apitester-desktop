import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input.tsx"
import { VariableInput } from "./VariableInput.tsx"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { useAppSelector } from "@/app/store/hooks.ts"
import { selectEditorActiveTabId } from "@/app/slices/editorTabsSlice.ts"
import { useQueryClient } from "@tanstack/react-query"
import { type Collection } from "@/layout/services/collection"
import { useRequestConfig } from "@/pages/editor/hooks/useRequestConfig.ts"
import type { ItemUrl, PathVariable } from "@/pages/editor/types/api.ts"
import { useDebouncedCallback } from "use-debounce"

export interface ParamsContentProps {
    query?: ItemUrl[]
    updateQuery?: (query: ItemUrl[]) => void
    className?: string
}

export const ParamsContent: React.FC<ParamsContentProps> = ({
    query: propQuery,
    updateQuery: propUpdateQuery,
    className,
}) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const queryClient = useQueryClient()
    const activeCollection = queryClient.getQueryData<Collection>(["collection", "active"])
    const { request, updateQuery: hookUpdateQuery, editPathVariable } = useRequestConfig(
        activeCollection?.id ?? "",
        activeTabId
    )

    const query = propQuery ?? request?.query ?? []
    const updateQuery = propUpdateQuery ?? hookUpdateQuery
    const pathVariables = request?.url?.variable ?? []

    const [newParamKey, setNewParamKey] = useState("")
    const [newParamValue, setNewParamValue] = useState("")
    const [newParamDesc, setNewParamDesc] = useState("")

    const updateQueryItem = (next: ItemUrl) =>
        updateQuery(query.map((item) => (item.id === next.id ? next : item)))

    const handleToggleParam = (item: ItemUrl) => {
        updateQueryItem({ ...item, disabled: !item.disabled })
    }

    const handleDeleteParam = (id?: string) => {
        updateQuery(query.filter((entry) => entry.id !== id))
    }

    const handleAddParam = () => {
        if (!newParamKey.trim()) return
        updateQuery([
            ...query,
            {
                id: crypto.randomUUID(),
                key: newParamKey.trim(),
                value: newParamValue,
                description: newParamDesc,
            },
        ])
        setNewParamKey("")
        setNewParamValue("")
        setNewParamDesc("")
    }

    return (
        <div className={cn("space-y-4", className)}>
        <div className="space-y-2">
        <h3 className="text-sm font-medium">Query Params</h3>
        <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-12 gap-x-2 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="col-span-3">Key</span>
                <span className="col-span-3">Value</span>
                <span className="col-span-4">Description</span>
                <span className="col-span-2" />
            </div>
            {query.map((item) => (
                <div
                    key={item.id ?? item.key}
                    className={cn(
                        "grid grid-cols-12 gap-x-2 border-t border-border px-3 py-2 items-center",
                        item.disabled && "opacity-50"
                    )}
                >
                    <Input
                        value={item.key}
                        readOnly
                        className="col-span-3 h-8"
                        disabled={item.disabled}
                    />
                    <VariableInput
                        value={item.value}
                        onChange={(event) =>
                            updateQueryItem({ ...item, value: event.target.value })
                        }
                        className="col-span-3 h-8"
                        disabled={item.disabled}
                    />
                    <Input
                        value={item.description ?? ""}
                        onChange={(event) =>
                            updateQueryItem({ ...item, description: event.target.value })
                        }
                        className="col-span-4 h-8 text-xs"
                        disabled={item.disabled}
                        placeholder="description"
                    />
                    <div className="col-span-2 flex justify-end gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleParam(item)}
                            className="h-8 w-8 p-0"
                        >
                            {item.disabled ? (
                                <ToggleLeft className="h-4 w-4 text-slate-400" />
                            ) : (
                                <ToggleRight className="h-4 w-4 text-emerald-600" />
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteParam(item.id)}
                            className="h-8 w-8 p-0 text-red-500"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
            <div className="grid grid-cols-12 gap-x-2 border-t border-border px-3 py-2 items-center">
                <VariableInput
                    value={newParamKey}
                    onChange={(event) => setNewParamKey(event.target.value)}
                    className="col-span-3 h-8"
                    placeholder="key"
                />
                <VariableInput
                    value={newParamValue}
                    onChange={(event) => setNewParamValue(event.target.value)}
                    className="col-span-3 h-8"
                    placeholder="value"
                />
                <Input
                    value={newParamDesc}
                    onChange={(event) => setNewParamDesc(event.target.value)}
                    className="col-span-4 h-8 text-xs"
                    placeholder="description"
                />
                <div className="col-span-2 flex justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddParam}
                        className="h-8 w-8 p-0"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
        </div>
        {pathVariables.length > 0 && (
            <div className="space-y-2">
                <h3 className="text-sm font-medium">Path Variables</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-12 gap-x-2 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="col-span-4">Key</span>
                        <span className="col-span-8">Value</span>
                    </div>
                    {pathVariables.map((item) => (
                        <PathVariableRow
                            key={item.id ?? item.key}
                            item={item}
                            onChange={editPathVariable}
                        />
                    ))}
                </div>
            </div>
        )}
        </div>
    )
}

interface PathVariableRowProps {
    item: PathVariable
    onChange: (key: string, value: string) => void
}

const PathVariableRow: React.FC<PathVariableRowProps> = ({ item, onChange }) => {
    const [localValue, setLocalValue] = useState(item.value ?? "")

    useEffect(() => {
        setLocalValue(item.value ?? "")
    }, [item.value])

    const debouncedOnChange = useDebouncedCallback((val: string) => {
        onChange(item.key, val)
    }, 300)

    useEffect(() => {
        return () => {
            debouncedOnChange.flush()
        }
    }, [debouncedOnChange])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = event.target.value
        setLocalValue(val)
        debouncedOnChange(val)
    }

    const handleBlur = () => {
        debouncedOnChange.flush()
    }

    return (
        <div className="grid grid-cols-12 gap-x-2 border-t border-border px-3 py-2 items-center">
            <Input value={item.key} readOnly className="col-span-4 h-8" />
            <VariableInput
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                className="col-span-8 h-8"
                placeholder="value"
            />
        </div>
    )
}

export default ParamsContent
