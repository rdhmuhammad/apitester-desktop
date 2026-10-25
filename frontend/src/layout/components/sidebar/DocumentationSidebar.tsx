import {type ReactNode, useCallback, useEffect, useRef, useState} from "react"
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FileCode2,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    GripVertical,
    LoaderCircle,
    Trash2,
} from "lucide-react"
import {cn} from "@/lib/utils.ts"
import {useDocumentation} from "@/pages/editor/hooks/useDocumentation.ts"
import {
    documentTreeQueryKey,
    type DocumentTree,
} from "@/pages/editor/services/documentation.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts"
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
import PromptDialog from "@/components/common/PromptDialog.tsx"
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
        disabled: isFolder,
    })

    const draggableStyle = transform ? {opacity: isDragging ? 0.4 : undefined} : undefined
    const effectiveOver = isOver || isDragOver

    if (isFolder) {
        return (
            <div className="space-y-1" ref={setDroppableRef}>
                <div
                    className={cn(
                        "group flex items-center relative rounded-md",
                        dropPosition === "inside" && effectiveOver && dropIndicatorInside,
                    )}
                    style={indentStyle}
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
                        <span className="truncate">{node.name}</span>
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
                <span className="truncate flex-1 text-sidebar-foreground">{node.name}</span>
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
    const {activeCollection} = useCollection()

    const {
        documentTree,
        isMovingDocument,
        refetchDocumentTree,
        createFolderMutation,
        moveDocumentMutation,
        deleteItemMutation,
    } = useDocumentation(null, true)

    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [dropTargetId, setDropTargetId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<DocDropPosition>(null)
    const dropPositionRef = useRef<DocDropPosition>(null)
    const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [nodeToDelete, setNodeToDelete] = useState<DocumentTree | null>(null)
    const [folderPromptOpen, setFolderPromptOpen] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    )

    useEffect(() => {
        void refetchDocumentTree()
    }, [activeCollection?.id, activeCollection?.project_id, refetchDocumentTree])

    const countDocs = (nodes: DocumentTree[]): number => {
        let count = 0
        for (const node of nodes) {
            if (node.category === "DOC_MD" || node.category === "DOC_HTML") {
                count++
            }
            if (node.item) {
                count += countDocs(node.item)
            }
        }
        return count
    }

    const matchesSearch = (node: DocumentTree, query: string): boolean => {
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

    const handleCreateFolder = async (folderName: string) => {
        const trimmed = folderName.trim()
        setFolderPromptOpen(false)
        if (!trimmed) return
        try {
            await createFolderMutation.mutateAsync({name: trimmed})
        } catch {
            // Error toast handled by mutation
        }
    }

    const renderNode = (node: DocumentTree, depth = 0, isParentMatch = false): ReactNode => {
        const q = searchQuery.trim().toLowerCase()
        const matchesCurrent = q ? node.name.toLowerCase().includes(q) : false
        const isMatched = isParentMatch || (q ? matchesSearch(node, q) : true)

        if (!isMatched) return null

        const isChildParentMatch = isParentMatch || matchesCurrent

        const isOpen = Boolean(expandedFolders[node.id]) || Boolean(q)
        const isActive = activeTabId === node.id || activeDragId === node.id

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
            >
                {isOpen && node.item && node.item.length > 0 && (
                    <div className="space-y-1">
                        {node.item.map((child) => renderNode(child, depth + 1, isChildParentMatch))}
                    </div>
                )}
            </DocTreeNode>
        )
    }

    const draggedNode = activeDragId ? findDocNodeById(documentTree, activeDragId) : null

    const treeContent = (
        <div className="space-y-0.5">
            {documentTree.length === 0 ? (
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
                    onClick={() => setFolderPromptOpen(true)}
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

            <PromptDialog
                open={folderPromptOpen}
                title="Create new folder"
                defaultValue="docs"
                submitLabel="Create"
                onCancel={() => setFolderPromptOpen(false)}
                onSubmit={(name) => void handleCreateFolder(name)}
            />

            <AlertDialog open={Boolean(nodeToDelete)} onOpenChange={(open) => !open && setNodeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {nodeToDelete?.category === "FOLD" ? "Folder" : "Document"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {nodeToDelete?.category === "FOLD"
                                ? `Are you sure you want to delete folder "${nodeToDelete?.name}" and all of its contents? This action cannot be undone.`
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
