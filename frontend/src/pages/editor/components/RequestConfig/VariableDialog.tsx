import React, { useState, useEffect, useRef, useTransition } from "react"
import { Search } from "lucide-react"
import { CollectionServices } from "@/layout/services/collection.ts"
import { useCollectionVariables } from "@/layout/hooks/useCollectionVariables.ts"
import { cn } from "@/lib/utils.ts"

export interface VariableDialogProps {
    open: boolean
    position: { x: number; y: number }
    onSelect: (variableKey: string) => void
    onClose: () => void
    initialSearch?: string
}

export interface VariableDialogRef {
    handleKeyDown: (e: React.KeyboardEvent<HTMLElement>) => boolean
}

export const VariableDialog = React.forwardRef<VariableDialogRef, VariableDialogProps>(({
    open,
    position,
    onSelect,
    onClose,
    initialSearch = "",
}, ref) => {
    const dialogRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const { variables } = useCollectionVariables()

    const [searchTerm, setSearchTerm] = useState(initialSearch)
    const [remoteKeys, setRemoteKeys] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [, startTransition] = useTransition()

    useEffect(() => {
        if (open) {
            setSearchTerm(initialSearch)
            setSelectedIndex(0)
        }
    }, [open, initialSearch])

    // Query remote endpoint for variable keys
    useEffect(() => {
        if (!open) return
        let isMounted = true

        CollectionServices.searchVariables(searchTerm)
            .then((keys) => {
                if (isMounted) {
                    setRemoteKeys(keys)
                }
            })
            .catch(() => {
                if (isMounted) {
                    // Fallback to local filtering if remote fails
                    const filtered = variables
                        .map((v) => v.key)
                        .filter((k) =>
                            k.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                    setRemoteKeys(filtered)
                }
            })

        return () => {
            isMounted = false
        }
    }, [open, searchTerm, variables])

    // Determine the list of keys to display
    const displayedKeys = React.useMemo(() => {
        if (remoteKeys.length > 0) return remoteKeys
        if (!searchTerm) return variables.map((v) => v.key).filter(Boolean)
        return variables
            .map((v) => v.key)
            .filter((k) => k.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [remoteKeys, searchTerm, variables])

    useEffect(() => {
        setSelectedIndex(0)
    }, [displayedKeys])

    // Outside click listener
    useEffect(() => {
        if (!open) return
        const handleClickOutside = (e: MouseEvent) => {
            if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener("mousedown", handleClickOutside, true)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside, true)
        }
    }, [open, onClose])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>): boolean => {
        if (!open) return false

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedIndex((prev) =>
                displayedKeys.length === 0 ? 0 : (prev + 1) % displayedKeys.length
            )
            return true
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedIndex((prev) =>
                displayedKeys.length === 0 ? 0 : (prev - 1 + displayedKeys.length) % displayedKeys.length
            )
            return true
        } else if (e.key === "Enter") {
            if (displayedKeys[selectedIndex]) {
                e.preventDefault()
                onSelect(displayedKeys[selectedIndex])
                return true
            }
        } else if (e.key === "Escape") {
            e.preventDefault()
            onClose()
            return true
        }
        return false
    }

    React.useImperativeHandle(ref, () => ({
        handleKeyDown
    }), [open, displayedKeys, selectedIndex, onSelect, onClose])

    if (!open) return null

    // Compute placement
    const dialogWidth = 260
    const dialogHeight = 220
    const padding = 8

    let left = position.x
    if (left + dialogWidth > window.innerWidth - padding) {
        left = window.innerWidth - dialogWidth - padding
    }
    if (left < padding) {
        left = padding
    }

    let top = position.y + 4
    if (top + dialogHeight > window.innerHeight - padding) {
        top = position.y - dialogHeight - 28
    }

    return (
        <div
            ref={dialogRef}
            className="fixed z-50 flex flex-col w-[260px] max-h-[220px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95"
            style={{
                left: `${left}px`,
                top: `${top}px`,
            }}
            onKeyDown={handleKeyDown}
        >
            {/* Search header with magnifying-glass icon */}
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 bg-muted/40">
                <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        const val = e.target.value
                        startTransition(() => {
                            setSearchTerm(val)
                        })
                    }}
                    placeholder="Search Variable"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground font-sans"
                />
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>

            {/* List of variables matching PlantUML SI list */}
            <div className="flex-1 overflow-y-auto p-1 text-xs">
                {displayedKeys.length === 0 ? (
                    <div className="px-3 py-4 text-center text-muted-foreground text-[11px]">
                        No variables found
                    </div>
                ) : (
                    displayedKeys.map((key, index) => {
                        const isSelected = index === selectedIndex
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onSelect(key)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={cn(
                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded text-left font-mono cursor-pointer transition-colors",
                                    isSelected
                                        ? "bg-accent text-accent-foreground font-semibold"
                                        : "hover:bg-accent/60 text-foreground"
                                )}
                            >
                                <span className="text-muted-foreground text-[10px] select-none shrink-0">•</span>
                                <span className="truncate">{key}</span>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
})

export default VariableDialog
