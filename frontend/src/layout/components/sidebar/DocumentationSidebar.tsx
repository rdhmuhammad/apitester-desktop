import {type ReactNode, useCallback, useEffect, useRef, useState} from "react"
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Copy,
    ExternalLink,
    FileCode2,
    FilePlus2,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    FolderSearch,
    GripVertical,
    LoaderCircle,
    Pencil,
    Trash2,
} from "lucide-react"
import {cn} from "@/lib/utils.ts"
import {useDocumentation} from "@/pages/editor/hooks/useDocumentation.ts"
import {
    documentTreeQueryKey,
    type DocumentTree,
} from "@/pages/editor/services/documentation.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts"
import {useProject} from "@/layout/hooks/useProject.ts"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
    openEditorTab,
    removeEditorTab,
    renameEditorTab,
    selectEditorActiveTabId,
    selectEditorTabs,
} from "@/app/slices/editorTabsSlice.ts"
import {
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import {useQueryClient} from "@tanstack/react-query"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx"
import CustomToast from "@/components/common/toast"

type DocDropPosition = "before" | "after" | "inside" | null

const dropIndicatorAbove = "absolute left-0 right-0 top-0 h-0.5 bg-sky-500 rounded-full z-10"
const dropIndicatorBelow = "absolute left-0 right-0 bottom-0 h-0.5 bg-sky-500 rounded-full z-10"
const dropIndicatorInside = "ring-2 ring-sky-400 rounded-md bg-sky-50/50 dark:bg-sky-950/40"

const collectMarkdownIds = (node: DocumentTree): string[] => {
    const ids: string[] = []
    if (node.category === "DOC_MD") {
        ids.push(node.id)
    }
    if (node.item) {
        for (const child of node.item) {
            ids.push(...collectMarkdownIds(child))
        }
    }
    return ids
}

const countAllFolderFiles = (node: DocumentTree): number => {
    if (!node.item) return 0
    let count = 0
    for (const child of node.item) {
        if (child.category === "FOLD") {
            count += 1 + countAllFolderFiles(child)
        } else {
            count += 1
        }
    }
    return count
}

const findDocNodeById = (nodes: DocumentTree[], id: string): DocumentTree | null => {
    for (const node of nodes) {
        if (node.id === id) return node
        if (node.item) {
            const found = findDocNodeById(node.item, id)
            if (found) return found
        }
    }
    return null
}

const getParentFolderId = (relId: string): string => {
    const idx = relId.lastIndexOf("/")
    return idx === -1 ? "" : relId.slice(0, idx)
}

const DocTreeNode: React.FC<{
    node: DocumentTree
    depth: number
    isOpen: boolean
    isActive: boolean
    dropPosition: DocDropPosition
    isDragOver: boolean
    onToggle: () => void
    onClick: () => void
    onDelete: () => void
    onContextMenu: (e: React.MouseEvent) => void
    onDoubleClick: (e: React.MouseEvent) => void
    isRenaming: boolean
    renameValue: string
    onRenameChange: (val: string) => void
    onRenameSubmit: () => void
    onRenameCancel: () => void
    children?: ReactNode
}> = ({
    node,
    depth,
    isOpen,
    isActive,
    dropPosition,
    isDragOver,
    onToggle,
    onClick,
    onDelete,
    onContextMenu,
    onDoubleClick,
    isRenaming,
    renameValue,
    onRenameChange,
    onRenameSubmit,
    onRenameCancel,
    children,
}) => {
    const indentStyle = {paddingLeft: `${depth * 14}px`}
    const isFolder = node.category === "FOLD"
    const {setNodeRef: setDroppableRef, isOver} = useDroppable({
        id: `doc-tree:${node.id}`,
        data: {node},
    })
    const {attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging} = useDraggable({
        id: `doc-tree:${node.id}`,
        data: {node},
        disabled: isFolder || isRenaming,
    })
    const inputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (isRenaming) {
            const timer = setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [isRenaming])

    const draggableStyle = transform ? {opacity: isDragging ? 0.4 : undefined} : undefined
    const effectiveOver = isOver || isDragOver

    const renderNameOrInput = (textClassName: string) => {
        if (isRenaming) {
            return (
                <input
                    ref={inputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onBlur={() => onRenameSubmit()}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === "Enter") {
                            e.preventDefault()
                            onRenameSubmit()
                        } else if (e.key === "Escape") {
                            e.preventDefault()
                            onRenameCancel()
                        }
                    }}
                    className="h-6 min-w-0 flex-1 rounded border border-sky-400 bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-sky-500"
                />
            )
        }
        return <span className={textClassName}>{node.name}</span>
    }

    if (isFolder) {
        return (
            <div className="space-y-1" ref={setDroppableRef}>
                <div
                    className={cn(
                        "group flex items-center relative rounded-md",
                        dropPosition === "inside" && effectiveOver && dropIndicatorInside,
                    )}
                    style={indentStyle}
                    onContextMenu={onContextMenu}
                    onDoubleClick={onDoubleClick}
                >
                    {dropPosition === "before" && effectiveOver && <div className={dropIndicatorAbove}/>}
                    {dropPosition === "after" && effectiveOver && <div className={dropIndicatorBelow}/>}
                    <span className="w-5 h-5 mr-1 shrink-0"/>
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                        {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0"/>
                        ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500 shrink-0"/>
                        )}
                        {isOpen ? (
                            <FolderOpen className="h-4 w-4 text-sky-500 shrink-0"/>
                        ) : (
                            <Folder className="h-4 w-4 text-sky-500 shrink-0"/>
                        )}
                        {renderNameOrInput("truncate")}
                    </button>
                    <button
                        type="button"
                        title="Delete folder"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete()
                        }}
                        className="cursor-pointer flex items-center justify-center shrink-0 w-6 h-6 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                </div>
                {isOpen && children}
            </div>
        )
    }

    const isHtml = node.category === "DOC_HTML"

    return (
        <div
            className={cn(
                "flex items-center group relative rounded-md",
                isActive && "bg-sky-100 dark:bg-sky-950/60",
            )}
            style={{...indentStyle, ...draggableStyle}}
            ref={setDroppableRef}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
        >
            {dropPosition === "before" && effectiveOver && <div className={dropIndicatorAbove}/>}
            {dropPosition === "after" && effectiveOver && <div className={dropIndicatorBelow}/>}
            <button
                type="button"
                className="cursor-grab flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                {...listeners}
                {...attributes}
                ref={setDraggableRef}
            >
                <GripVertical className="h-3.5 w-3.5"/>
            </button>
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent",
                    isActive && "bg-sky-100 dark:bg-sky-950/60",
                )}
            >
                {isHtml ? (
                    <FileCode2 className="h-4 w-4 text-orange-500 shrink-0"/>
                ) : (
                    <FileText className="h-4 w-4 text-sky-600 shrink-0"/>
                )}
                <span
                    className={cn(
                        "w-10 text-[10px] font-bold shrink-0",
                        isHtml ? "text-orange-600 dark:text-orange-400" : "text-sky-600 dark:text-sky-400",
                    )}
                >
                    {isHtml ? "HTML" : "MD"}
                </span>
                {renderNameOrInput("truncate flex-1 text-sidebar-foreground")}
                {isHtml && (
                    <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0"/>
                )}
            </button>
            <button
                type="button"
                title="Delete document"
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                }}
                className="cursor-pointer flex items-center justify-center shrink-0 w-6 h-6 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Trash2 className="h-3.5 w-3.5"/>
            </button>
        </div>
    )
}

const DocumentationSidebar: React.FC<{searchQuery: string}> = ({searchQuery}) => {
    const dispatch = useAppDispatch()
    const queryClient = useQueryClient()
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const openTabs = useAppSelector(selectEditorTabs)
    const {activeProject} = useProject()
    const {activeCollection} = useCollection()

    const {
        documentTree: rawDocumentTree,
        isMovingDocument,
        refetchDocumentTree,
        createDocumentMutation,
        createFolderMutation,
        renameDocumentMutation,
        moveDocumentMutation,
        deleteItemMutation,
    } = useDocumentation(null, Boolean(activeProject))
    const documentTree = activeProject ? rawDocumentTree : []

    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [dropTargetId, setDropTargetId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<DocDropPosition>(null)
    const dropPositionRef = useRef<DocDropPosition>(null)
    const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [nodeToDelete, setNodeToDelete] = useState<DocumentTree | null>(null)
    const [contextMenu, setContextMenu] = useState<{x: number; y: number; node: DocumentTree} | null>(null)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [creatingItem, setCreatingItem] = useState<{parentId: string; kind: "FOLD" | "DOC_MD"} | null>(null)
    const [createValue, setCreateValue] = useState("")
    const createInputRef = useRef<HTMLInputElement | null>(null)
    const isSubmittingCreateRef = useRef(false)
    const isSubmittingRenameRef = useRef(false)

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    )

    useEffect(() => {
        if (!activeProject?.id) return
        void refetchDocumentTree()
    }, [activeProject?.id, activeCollection?.id, refetchDocumentTree])

    const countDocs = (nodes: DocumentTree[]): number => {
        let count = 0
        for (const node of nodes) {
            if (node.show && (node.category === "DOC_MD" || node.category === "DOC_HTML")) {
                count++
            }
            if (node.item) {
                count += countDocs(node.item)
            }
        }
        return count
    }

    const matchesSearch = (node: DocumentTree, query: string): boolean => {
        if (!node.show) return false
        const q = query.trim().toLowerCase()
        if (!q) return true
        if (node.name.toLowerCase().includes(q)) return true
        if (node.category === "FOLD" && node.item) {
            return node.item.some((child) => matchesSearch(child, q))
        }
        return false
    }

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prev) => ({
            ...prev,
            [folderId]: !prev[folderId],
        }))
    }

    const handleDocClick = async (node: DocumentTree) => {
        if (node.category === "FOLD") {
            toggleFolder(node.id)
            return
        }

        if (node.category === "DOC_HTML") {
            if (window.electronAPI?.openExternal) {
                const errMsg = await window.electronAPI.openExternal(node.path)
                if (errMsg) {
                    CustomToast.error(`Failed to open HTML file: ${errMsg}`)
                }
            } else {
                window.open(`file:///${node.path.replace(/\\/g, "/")}`, "_blank", "noopener,noreferrer")
            }
            return
        }

        if (node.category === "DOC_MD") {
            dispatch(
                openEditorTab({
                    id: node.id,
                    label: node.name,
                    method: "DOC",
                    type: "document",
                }),
            )
        }
    }

    const stripPrefix = (rawId: string): string => rawId.replace(/^doc-tree:/, "")

    const computeDropPosition = useCallback((event: DragOverEvent): DocDropPosition => {
        const targetRect = event.over?.rect
        if (!targetRect) return null

        const pointerY = event.delta.y + (event.active.rect.current.initial?.top ?? 0)
        const relativeY = pointerY - targetRect.top
        const ratio = relativeY / targetRect.height

        const overNode = event.over?.data.current?.node as DocumentTree | undefined
        if (overNode?.category === "FOLD") {
            return "inside"
        }

        return ratio < 0.5 ? "before" : "after"
    }, [])

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(stripPrefix(String(event.active.id)))
        dropPositionRef.current = null
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current)
            expandTimerRef.current = null
        }
    }, [])

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
            const overRaw = event.over?.id
            if (!overRaw || !event.active.id) {
                setDropTargetId(null)
                setDropPosition(null)
                dropPositionRef.current = null
                return
            }

            const activeId = stripPrefix(String(event.active.id))
            const targetId = stripPrefix(String(overRaw))
            if (activeId === targetId) {
                setDropTargetId(null)
                setDropPosition(null)
                dropPositionRef.current = null
                return
            }

            setDropTargetId(targetId)
            const position = computeDropPosition(event)
            setDropPosition(position)
            dropPositionRef.current = position

            if (expandTimerRef.current) {
                clearTimeout(expandTimerRef.current)
                expandTimerRef.current = null
            }

            const overNode = event.over?.data.current?.node as DocumentTree | undefined
            if (overNode?.category === "FOLD" && !expandedFolders[targetId]) {
                expandTimerRef.current = setTimeout(() => {
                    toggleFolder(targetId)
                }, 700)
            }
        },
        [computeDropPosition, expandedFolders],
    )

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const targetPosition = dropPositionRef.current ?? dropPosition

            setActiveDragId(null)
            setDropTargetId(null)
            setDropPosition(null)
            dropPositionRef.current = null

            if (expandTimerRef.current) {
                clearTimeout(expandTimerRef.current)
                expandTimerRef.current = null
            }

            const {active, over} = event
            if (!over || !active || active.id === over.id || !targetPosition) return

            const activeId = stripPrefix(String(active.id))
            const overId = stripPrefix(String(over.id))

            const activeNode = findDocNodeById(documentTree, activeId)
            const targetNode = findDocNodeById(documentTree, overId)
            if (!activeNode || !targetNode) return

            // Only .md and .html files can be moved
            if (activeNode.category === "FOLD") return

            const targetFolderId =
                targetNode.category === "FOLD" && targetPosition === "inside"
                    ? targetNode.id
                    : getParentFolderId(targetNode.id)

            const currentParentId = getParentFolderId(activeNode.id)
            if (targetFolderId === currentParentId) return

            if (targetFolderId) {
                setExpandedFolders((prev) => ({...prev, [targetFolderId]: true}))
            }

            try {
                const moved = await moveDocumentMutation.mutateAsync({
                    id: activeNode.id,
                    targetFolderId,
                })
                if (activeNode.category === "DOC_MD" && openTabs.some((t) => t.id === activeNode.id)) {
                    dispatch(
                        renameEditorTab({
                            id: activeNode.id,
                            newId: moved.id,
                            label: moved.name,
                        }),
                    )
                }
            } catch {
                // Error toast handled by mutation
            }
        },
        [dispatch, documentTree, dropPosition, moveDocumentMutation, openTabs],
    )

    const handleConfirmDelete = async () => {
        if (!nodeToDelete) return
        const target = nodeToDelete
        setNodeToDelete(null)

        const affectedDocIds = collectMarkdownIds(target)
        try {
            await deleteItemMutation.mutateAsync(target.id)
            for (const docId of affectedDocIds) {
                if (openTabs.some((t) => t.id === docId)) {
                    dispatch(removeEditorTab(docId))
                }
            }
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
        } catch {
            // Error toast handled by mutation
        }
    }

    useEffect(() => {
        if (!contextMenu) return
        const close = () => setContextMenu(null)
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        window.addEventListener("pointerdown", close)
        window.addEventListener("keydown", onKeyDown)
        window.addEventListener("scroll", close, true)
        return () => {
            window.removeEventListener("pointerdown", close)
            window.removeEventListener("keydown", onKeyDown)
            window.removeEventListener("scroll", close, true)
        }
    }, [contextMenu])

    useEffect(() => {
        if (creatingItem) {
            const timer = setTimeout(() => {
                createInputRef.current?.focus()
                createInputRef.current?.select()
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [creatingItem])

    const handleOpenContextMenu = (e: React.MouseEvent, node: DocumentTree) => {
        e.preventDefault()
        e.stopPropagation()
        if (node.category === "FOLD" && !expandedFolders[node.id]) {
            setExpandedFolders((prev) => ({...prev, [node.id]: true}))
        }
        setContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 190),
            y: Math.min(e.clientY, window.innerHeight - 190),
            node,
        })
    }

    const handleCopyAbsolutePath = async (node: DocumentTree) => {
        setContextMenu(null)
        try {
            await navigator.clipboard.writeText(node.path)
            CustomToast.success("Absolute path copied")
        } catch {
            CustomToast.error("Failed to copy path")
        }
    }

    const handleShowInFileSystem = async (node: DocumentTree) => {
        setContextMenu(null)
        if (window.electronAPI?.showItemInFolder) {
            await window.electronAPI.showItemInFolder(node.path)
        } else if (window.electronAPI?.openExternal) {
            await window.electronAPI.openExternal(node.path)
        }
    }

    const handleStartRename = (node: DocumentTree) => {
        setContextMenu(null)
        setCreatingItem(null)
        setRenamingId(node.id)
        setRenameValue(node.name)
    }

    const handleRenameSubmit = async (node: DocumentTree) => {
        if (isSubmittingRenameRef.current) return
        const trimmed = renameValue.trim()
        setRenamingId(null)
        setRenameValue("")
        if (!trimmed || trimmed === node.name) return

        isSubmittingRenameRef.current = true
        try {
            const updated = await renameDocumentMutation.mutateAsync({
                id: node.id,
                name: trimmed,
            })
            if (node.category === "DOC_MD" && openTabs.some((t) => t.id === node.id)) {
                dispatch(
                    renameEditorTab({
                        id: node.id,
                        newId: updated.id,
                        label: updated.name,
                    }),
                )
            } else if (node.category === "FOLD") {
                setExpandedFolders((prev) => {
                    const next = {...prev}
                    if (node.id in next) {
                        next[updated.id] = next[node.id]
                        delete next[node.id]
                    }
                    return next
                })
                const oldPrefix = `${node.id}/`
                for (const tab of openTabs) {
                    if (tab.type === "document" && tab.id.startsWith(oldPrefix)) {
                        const nextId = `${updated.id}/${tab.id.slice(oldPrefix.length)}`
                        dispatch(
                            renameEditorTab({
                                id: tab.id,
                                newId: nextId,
                                label: tab.label,
                            }),
                        )
                    }
                }
            }
        } catch {
            // Error toast handled by mutation
        } finally {
            isSubmittingRenameRef.current = false
        }
    }

    const handleStartCreate = (parentId: string, kind: "FOLD" | "DOC_MD") => {
        setContextMenu(null)
        setRenamingId(null)
        if (parentId) {
            setExpandedFolders((prev) => ({...prev, [parentId]: true}))
        }
        setCreatingItem({parentId, kind})
        setCreateValue(kind === "FOLD" ? "docs" : "Untitled")
    }

    const handleCreateSubmit = async () => {
        if (isSubmittingCreateRef.current || !creatingItem) return
        const current = creatingItem
        const trimmed = createValue.trim()
        setCreatingItem(null)
        setCreateValue("")
        if (!trimmed) return

        isSubmittingCreateRef.current = true
        try {
            if (current.kind === "FOLD") {
                const created = await createFolderMutation.mutateAsync({
                    name: trimmed,
                    parentId: current.parentId,
                })
                setExpandedFolders((prev) => ({...prev, [created.id]: true}))
            } else {
                const created = await createDocumentMutation.mutateAsync({
                    name: trimmed,
                    parentId: current.parentId,
                })
                dispatch(
                    openEditorTab({
                        id: created.id,
                        label: created.name || trimmed,
                        method: "DOC",
                        type: "document",
                    }),
                )
            }
        } catch {
            // Error toast handled by mutation
        } finally {
            isSubmittingCreateRef.current = false
        }
    }

    const renderCreateRow = (depth: number) => {
        if (!creatingItem) return null
        return (
            <div
                className="flex items-center gap-2 rounded-md px-2 py-1"
                style={{paddingLeft: `${depth * 14 + 28}px`}}
            >
                {creatingItem.kind === "FOLD" ? (
                    <Folder className="h-4 w-4 text-sky-500 shrink-0"/>
                ) : (
                    <FileText className="h-4 w-4 text-sky-600 shrink-0"/>
                )}
                <input
                    ref={createInputRef}
                    type="text"
                    value={createValue}
                    onChange={(e) => setCreateValue(e.target.value)}
                    onBlur={() => void handleCreateSubmit()}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === "Enter") {
                            e.preventDefault()
                            void handleCreateSubmit()
                        } else if (e.key === "Escape") {
                            e.preventDefault()
                            setCreatingItem(null)
                            setCreateValue("")
                        }
                    }}
                    placeholder={creatingItem.kind === "FOLD" ? "Folder name..." : "File name..."}
                    className="h-6 min-w-0 flex-1 rounded border border-sky-400 bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-sky-500"
                />
            </div>
        )
    }

    const renderNode = (node: DocumentTree, depth = 0, isParentMatch = false): ReactNode => {
        if (!node.show) return null

        const q = searchQuery.trim().toLowerCase()
        const matchesCurrent = q ? node.name.toLowerCase().includes(q) : false
        const isMatched = isParentMatch || (q ? matchesSearch(node, q) : true)

        if (!isMatched) return null

        const isChildParentMatch = isParentMatch || matchesCurrent

        const isOpen = Boolean(expandedFolders[node.id]) || Boolean(q)
        const isActive = activeTabId === node.id || activeDragId === node.id
        const isCreatingInside = creatingItem?.parentId === node.id

        return (
            <DocTreeNode
                key={node.id}
                node={node}
                depth={depth}
                isOpen={isOpen}
                isActive={isActive}
                dropPosition={dropTargetId === node.id ? dropPosition : null}
                isDragOver={dropTargetId === node.id}
                onToggle={() => toggleFolder(node.id)}
                onClick={() => void handleDocClick(node)}
                onDelete={() => setNodeToDelete(node)}
                onContextMenu={(e) => handleOpenContextMenu(e, node)}
                onDoubleClick={(e) => handleOpenContextMenu(e, node)}
                isRenaming={renamingId === node.id}
                renameValue={renamingId === node.id ? renameValue : node.name}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => void handleRenameSubmit(node)}
                onRenameCancel={() => {
                    setRenamingId(null)
                    setRenameValue("")
                }}
            >
                {isOpen && (
                    <div className="space-y-1">
                        {isCreatingInside && renderCreateRow(depth + 1)}
                        {node.item?.map((child) => renderNode(child, depth + 1, isChildParentMatch))}
                    </div>
                )}
            </DocTreeNode>
        )
    }

    const draggedNode = activeDragId ? findDocNodeById(documentTree, activeDragId) : null
    const hasVisibleNodes = documentTree.some((node) => node.show) || creatingItem?.parentId === ""
    const deleteFileCount = nodeToDelete?.category === "FOLD" ? countAllFolderFiles(nodeToDelete) : 0

    const treeContent = (
        <div className="space-y-0.5">
            {creatingItem?.parentId === "" && renderCreateRow(0)}
            {!hasVisibleNodes ? (
                <div className="px-4 py-4 text-center text-xs text-slate-400">
                    No documents found in project.
                </div>
            ) : (
                documentTree.map((node) => renderNode(node))
            )}
        </div>
    )

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between border-b border-sidebar-border px-2 py-2">
                <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-sky-600"/>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Documents ({countDocs(documentTree)})
                    </span>
                </div>
                <button
                    type="button"
                    title="Create new folder"
                    onClick={() => handleStartCreate("", "FOLD")}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-sidebar-accent hover:text-sky-600 transition"
                >
                    <FolderPlus className="h-3.5 w-3.5"/>
                </button>
            </div>

            <div className="relative py-1">
                {searchQuery ? (
                    treeContent
                ) : (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={(e) => void handleDragEnd(e)}
                    >
                        {treeContent}
                        <DragOverlay dropAnimation={null}>
                            {draggedNode ? (
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card shadow-lg border border-border opacity-90">
                                    {draggedNode.category === "DOC_HTML" ? (
                                        <FileCode2 className="h-4 w-4 text-orange-500 shrink-0"/>
                                    ) : (
                                        <FileText className="h-4 w-4 text-sky-600 shrink-0"/>
                                    )}
                                    <span className="text-[10px] font-bold text-sky-600 shrink-0">
                                        {draggedNode.category === "DOC_HTML" ? "HTML" : "MD"}
                                    </span>
                                    <span className="truncate text-sm text-foreground">{draggedNode.name}</span>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}

                {isMovingDocument && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px] rounded-md transition-opacity">
                        <LoaderCircle className="h-6 w-6 animate-spin text-white"/>
                        <span className="mt-1 text-xs font-medium text-white/90">Moving document...</span>
                    </div>
                )}
            </div>

            {contextMenu && (
                <div
                    style={{top: contextMenu.y, left: contextMenu.x}}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="fixed z-50 min-w-[175px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                >
                    {contextMenu.node.category === "FOLD" && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleStartCreate(contextMenu.node.id, "FOLD")}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                            >
                                <FolderPlus className="h-3.5 w-3.5 text-muted-foreground"/>
                                <span>New folder</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStartCreate(contextMenu.node.id, "DOC_MD")}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                            >
                                <FilePlus2 className="h-3.5 w-3.5 text-muted-foreground"/>
                                <span>New file</span>
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => void handleCopyAbsolutePath(contextMenu.node)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground"/>
                        <span>Copy absolute path</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleShowInFileSystem(contextMenu.node)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                        <FolderSearch className="h-3.5 w-3.5 text-muted-foreground"/>
                        <span>Show in file system</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStartRename(contextMenu.node)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground"/>
                        <span>Rename</span>
                    </button>
                </div>
            )}

            <AlertDialog open={Boolean(nodeToDelete)} onOpenChange={(open) => !open && setNodeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {nodeToDelete?.category === "FOLD" ? "Folder" : "Document"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {nodeToDelete?.category === "FOLD"
                                ? deleteFileCount > 0
                                    ? `Are you sure you want to delete folder "${nodeToDelete?.name}"? You will delete ${deleteFileCount} file(s) inside it. This action cannot be undone.`
                                    : `Are you sure you want to delete empty folder "${nodeToDelete?.name}"? This action cannot be undone.`
                                : `Are you sure you want to delete document "${nodeToDelete?.name}"? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => void handleConfirmDelete()}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default DocumentationSidebar
