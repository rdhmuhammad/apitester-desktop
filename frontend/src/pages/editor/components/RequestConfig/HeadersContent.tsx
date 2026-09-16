import React, { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { cn } from "@/lib/utils.ts"
import { Eye, EyeOff, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { useAppSelector } from "@/app/store/hooks.ts"
import { selectEditorActiveTabId } from "@/app/slices/editorTabsSlice.ts"
import { useQueryClient } from "@tanstack/react-query"
import { type Collection } from "@/layout/services/collection"
import { useRequestConfig } from "@/pages/editor/hooks/useRequestConfig.ts"
import type { ItemUrl } from "@/pages/editor/types/api.ts"

export interface HeadersContentProps {
    headers?: ItemUrl[]
    updateHeaders?: (headers: ItemUrl[]) => void
    className?: string
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

    const headerShow = showSysHeader
        ? headers
        : headers.filter((item) => !["user-agent", "accept"].includes(item.key.toLowerCase()))

    const updateHeaderItem = (next: ItemUrl) =>
        updateHeaders(headers.map((item) => (item.id === next.id ? next : item)))

    const handleToggleHeader = (item: ItemUrl) => {
        updateHeaderItem({ ...item, disabled: !item.disabled })
    }

    const handleDeleteHeader = (id?: string) => {
        updateHeaders(headers.filter((entry) => entry.id !== id))
    }

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
                    <div
                        key={item.id ?? item.key}
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
                        <Input
                            value={item.value}
                            onChange={(event) =>
                                updateHeaderItem({ ...item, value: event.target.value })
                            }
                            className="col-span-5 ml-3 h-8"
                            disabled={item.disabled}
                        />
                        <div className="col-span-2 ml-3 flex justify-end gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleHeader(item)}
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
                                onClick={() => handleDeleteHeader(item.id)}
                                className="h-8 w-8 p-0 text-red-500"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                <div className="grid grid-cols-12 border-t border-border px-3 py-2 items-center">
                    <Input
                        value={newHeaderKey}
                        onChange={(event) => setNewHeaderKey(event.target.value)}
                        className="col-span-5 h-8"
                        placeholder="header key"
                    />
                    <Input
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
