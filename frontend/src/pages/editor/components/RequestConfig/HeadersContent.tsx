import React, { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { VariableInput } from "./VariableInput.tsx"
import { cn } from "@/lib/utils.ts"
import { Eye, EyeOff, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { useAppSelector } from "@/app/store/hooks.ts"
import { selectEditorActiveTabId } from "@/app/slices/editorTabsSlice.ts"
import { useQueryClient } from "@tanstack/react-query"
import { type Collection } from "@/layout/services/collection"
import { useRequestConfig } from "@/pages/editor/hooks/useRequestConfig.ts"
import type { ItemUrl } from "@/pages/editor/types/api.ts"
import { useDebouncedCallback } from "use-debounce"

export interface HeadersContentProps {
    headers?: ItemUrl[]
    updateHeaders?: (headers: ItemUrl[]) => void
    className?: string
}

interface HeaderItemRowProps {
    item: ItemUrl
    onUpdate: (item: ItemUrl) => void
    onDelete: (id?: string) => void
}

const HeaderItemRow: React.FC<HeaderItemRowProps> = ({ item, onUpdate, onDelete }) => {
    const [localValue, setLocalValue] = useState(item.value ?? "")
    const isFocusedRef = useRef(false)

    useEffect(() => {
        if (!isFocusedRef.current && !debouncedOnUpdate.isPending()) {
            setLocalValue(item.value ?? "")
        }
    }, [item.value])

    const debouncedOnUpdate = useDebouncedCallback((val: string) => {
        onUpdate({ ...item, value: val })
    }, 300)

    useEffect(() => {
        return () => {
            debouncedOnUpdate.flush()
        }
    }, [debouncedOnUpdate])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const val = event.target.value
        setLocalValue(val)
        debouncedOnUpdate(val)
    }

    const handleFocus = () => {
        isFocusedRef.current = true
    }

    const handleBlur = () => {
        isFocusedRef.current = false
        debouncedOnUpdate.flush()
    }

    const handleToggle = () => {
        debouncedOnUpdate.cancel()
        onUpdate({ ...item, value: localValue, disabled: !item.disabled })
    }

    const handleDelete = () => {
        debouncedOnUpdate.cancel()
        onDelete(item.id)
    }

    return (
        <div
            className={cn(
                "grid grid-cols-12 border-t border-border px-3 py-2 items-center",
                item.disabled && "opacity-50"
            )}
        >
            <Input
                value={item.key}
                readOnly
                className="col-span-5 h-8"
                disabled={item.disabled}
            />
            <VariableInput
                value={localValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="col-span-5 ml-3 h-8"
                disabled={item.disabled}
            />
            <div className="col-span-2 ml-3 flex justify-end gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggle}
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
                    onClick={handleDelete}
                    className="h-8 w-8 p-0 text-red-500"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

export const HeadersContent: React.FC<HeadersContentProps> = ({
    headers: propHeaders,
    updateHeaders: propUpdateHeaders,
    className,
}) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const queryClient = useQueryClient()
    const activeCollection = queryClient.getQueryData<Collection>(["collection", "active"])
    const { request, updateHeaders: hookUpdateHeaders } = useRequestConfig(
        activeCollection?.id ?? "",
        activeTabId
    )

    const headers = propHeaders ?? request?.headers ?? []
    const updateHeaders = propUpdateHeaders ?? hookUpdateHeaders

    const [newHeaderKey, setNewHeaderKey] = useState("")
    const [newHeaderValue, setNewHeaderValue] = useState("")
    const [showSysHeader, setShowSysHeader] = useState(false)

    const headersRef = useRef(headers)
    headersRef.current = headers

    const headerShow = showSysHeader
        ? headers
        : headers.filter((item) => !["user-agent", "accept"].includes(item.key.toLowerCase()))

    const updateHeaderItem = useCallback((next: ItemUrl) => {
        const current = headersRef.current
        updateHeaders(current.map((item) => (item.id === next.id ? next : item)))
    }, [updateHeaders])

    const handleDeleteHeader = useCallback((id?: string) => {
        const current = headersRef.current
        updateHeaders(current.filter((entry) => entry.id !== id))
    }, [updateHeaders])

    const handleAddHeader = () => {
        if (!newHeaderKey.trim()) return
        updateHeaders([
            ...headers,
            {
                id: crypto.randomUUID(),
                key: newHeaderKey.trim(),
                value: newHeaderValue,
                disabled: false,
            },
        ])
        setNewHeaderKey("")
        setNewHeaderValue("")
    }

    return (
        <div className={className}>
            <Button
                variant="ghost"
                size="xs"
                className="mb-4 rounded-full bg-gray-100"
                onClick={() => setShowSysHeader((value) => !value)}
            >
                {showSysHeader ? (
                    <>
                        <Eye className="text-slate-600" size={10} />
                        <span className="text-[10px]">Show system headers</span>
                    </>
                ) : (
                    <>
                        <EyeOff className="text-slate-600" size={10} />
                        <span className="text-[10px]">Show system headers</span>
                    </>
                )}
            </Button>
            <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-12 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="col-span-5">Header</span>
                    <span className="col-span-5">Value</span>
                    <span className="col-span-2" />
                </div>
                {headerShow.map((item) => (
                    <HeaderItemRow
                        key={item.id ?? item.key}
                        item={item}
                        onUpdate={updateHeaderItem}
                        onDelete={handleDeleteHeader}
                    />
                ))}
                <div className="grid grid-cols-12 border-t border-border px-3 py-2 items-center">
                    <VariableInput
                        value={newHeaderKey}
                        onChange={(event) => setNewHeaderKey(event.target.value)}
                        className="col-span-5 h-8"
                        placeholder="header key"
                    />
                    <VariableInput
                        value={newHeaderValue}
                        onChange={(event) => setNewHeaderValue(event.target.value)}
                        className="col-span-5 ml-3 h-8"
                        placeholder="header value"
                    />
                    <div className="col-span-2 flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddHeader}
                            className="h-8 w-8 p-0"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeadersContent
