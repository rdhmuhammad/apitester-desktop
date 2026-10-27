import React, {useCallback, useEffect, useMemo, useRef, useState} from "react"
import {AtSign, File, FileCode, FileCode2, FileJson, FileText} from "lucide-react"
import {filterWorkdirFiles, type WorkdirFileItem} from "@/pages/editor/utils/fileTree.ts"
import {cn} from "@/lib/utils.ts"

export interface FileTagDropdownProps {
    open: boolean
    position: {x: number; y: number}
    query: string
    files: WorkdirFileItem[]
    onSelect: (file: WorkdirFileItem) => void
    onClose: () => void
}

const getFileIcon = (ext: string, category: string) => {
    switch (ext) {
        case ".md":
            return <FileText className="h-4 w-4 text-sky-500 shrink-0"/>
        case ".html":
        case ".htm":
            return <FileCode className="h-4 w-4 text-orange-500 shrink-0"/>
        case ".go":
            return <FileCode2 className="h-4 w-4 text-cyan-500 shrink-0"/>
        case ".ts":
        case ".tsx":
            return <FileCode2 className="h-4 w-4 text-blue-500 shrink-0"/>
        case ".js":
        case ".jsx":
            return <FileCode2 className="h-4 w-4 text-amber-500 shrink-0"/>
        case ".json":
        case ".yaml":
        case ".yml":
            return <FileJson className="h-4 w-4 text-emerald-500 shrink-0"/>
        default:
            if (category === "DOC_MD") return <FileText className="h-4 w-4 text-sky-500 shrink-0"/>
            return <File className="h-4 w-4 text-slate-400 shrink-0"/>
    }
}

const FileTagDropdownComponent: React.FC<FileTagDropdownProps> = ({
    open,
    position,
    query,
    files,
    onSelect,
    onClose,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [prevQuery, setPrevQuery] = useState(query)

    const {items: visibleFiles, total: totalMatches} = useMemo(
        () => filterWorkdirFiles(files, query, 40),
        [files, query]
    )

    if (prevQuery !== query) {
        setPrevQuery(query)
        setSelectedIndex(0)
    }

    // Scroll active item into view
    useEffect(() => {
        if (!listRef.current) return
        const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined
        if (activeItem) {
            activeItem.scrollIntoView({block: "nearest"})
        }
    }, [selectedIndex])

    // Outside click listener
    useEffect(() => {
        if (!open) return
        const handleMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener("mousedown", handleMouseDown, true)
        return () => {
            document.removeEventListener("mousedown", handleMouseDown, true)
        }
    }, [open, onClose])

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!open) return

            if (e.key === "ArrowDown") {
                e.preventDefault()
                e.stopPropagation()
                setSelectedIndex((prev) => (visibleFiles.length > 0 ? (prev + 1) % visibleFiles.length : 0))
                return
            }

            if (e.key === "ArrowUp") {
                e.preventDefault()
                e.stopPropagation()
                setSelectedIndex((prev) =>
                    visibleFiles.length > 0 ? (prev - 1 + visibleFiles.length) % visibleFiles.length : 0,
                )
                return
            }

            if (e.key === "Enter" || e.key === "Tab") {
                if (visibleFiles.length > 0 && visibleFiles[selectedIndex]) {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(visibleFiles[selectedIndex])
                }
                return
            }

            if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                onClose()
            }
        },
        [onClose, onSelect, open, selectedIndex, visibleFiles],
    )

    useEffect(() => {
        if (!open) return
        window.addEventListener("keydown", handleKeyDown, true)
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true)
        }
    }, [open, handleKeyDown])

    if (!open) return null

    // Ensure the popover stays within viewport boundaries
    const safeLeft = Math.min(Math.max(16, position.x), Math.max(16, window.innerWidth - 340))
    const popoverHeight = 280
    const fitsBelow = position.y + popoverHeight + 10 < window.innerHeight
    const safeTop = fitsBelow ? position.y + 6 : Math.max(16, position.y - popoverHeight - 6)

    return (
        <div
            ref={containerRef}
            style={{top: `${safeTop}px`, left: `${safeLeft}px`}}
            className="fixed z-50 w-80 rounded-xl border border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col"
        >
            <div className="flex items-center justify-between border-b border-border/70 px-3 py-2 bg-muted/40">
                <div className="flex items-center gap-1.5 min-w-0">
                    <AtSign className="h-3.5 w-3.5 text-sky-500 shrink-0"/>
                    <span className="text-xs font-semibold text-foreground truncate">
                        {query ? `@${query}` : "Tag File"}
                    </span>
                </div>
                <span className="text-[10px] font-mono font-medium text-muted-foreground ml-2 shrink-0">
                    {totalMatches > visibleFiles.length
                        ? `${visibleFiles.length} of ${totalMatches} files`
                        : `${totalMatches} ${totalMatches === 1 ? "file" : "files"}`}
                </span>
            </div>

            <div ref={listRef} className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                {visibleFiles.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No matching files in workspace
                    </div>
                ) : (
                    visibleFiles.map((file, idx) => {
                        const isSelected = idx === selectedIndex
                        return (
                            <button
                                key={file.id}
                                type="button"
                                onClick={() => onSelect(file)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                                    isSelected
                                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
                                        : "hover:bg-muted/60 text-foreground",
                                )}
                            >
                                {getFileIcon(file.extension, file.category)}
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs truncate leading-tight font-medium">
                                        {file.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                        {file.id}
                                    </span>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>

            <div className="border-t border-border/50 px-2.5 py-1 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>↑↓ navigate</span>
                <span>↵ / Tab to tag</span>
                <span>Esc to close</span>
            </div>
        </div>
    )
}

export const FileTagDropdown = React.memo(FileTagDropdownComponent)
export default FileTagDropdown
