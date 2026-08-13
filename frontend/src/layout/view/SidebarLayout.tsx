import {Sidebar, SidebarContent} from "@/components/ui/sidebar.tsx";
import {type ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {ChevronDown, ChevronRight, FileCode2, Folder, FolderGit2, FolderOpen, GripVertical, Search, Trash2} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import {
    type ColtReqMethod,
    type DirTree,
    moveItem,
    selectDirTree,
    setActiveRequest,
    setActiveTree,
    deleteRequest,
    deleteFolder,
    selectDirtyRequestIds
} from "@/app/slices/collectionSlices.ts";
import {cn} from "@/lib/utils.ts";
import TestScenarioSidebar from "@/layout/components/TestScenarioSidebar.tsx";
import WarningDialog from "@/components/common/WarningDialog.tsx";
import {
    DndContext,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";


const methodColorClass: Record<ColtReqMethod, string> = {
    GET: "text-emerald-600",
    POST: "text-amber-600",
    PUT: "text-blue-600",
    PATCH: "text-violet-600",
    DELETE: "text-red-600"
};

const isFolderDirty = (node: DirTree, dirtyIds: string[]): boolean => {
    if (node.category === "REQ") return dirtyIds.includes(node.id)
    if (node?.item) {
        return Array.from(node.item.values()).some((child) => isFolderDirty(child, dirtyIds))
    }
    return false
}

type DropPosition = 'before' | 'after' | 'inside' | null

const dropIndicatorAbove = "absolute left-0 right-0 top-0 h-0.5 bg-indigo-500 rounded-full z-10"
const dropIndicatorBelow = "absolute left-0 right-0 bottom-0 h-0.5 bg-indigo-500 rounded-full z-10"
const dropIndicatorInside = "ring-2 ring-indigo-400 rounded-md bg-indigo-50/50"

const DragNode: React.FC<{
    node: DirTree
    depth: number
    onClick: () => void
    onToggle: () => void
    isOpen: boolean
    isActive: boolean
    isDirty: boolean
    onDelete: (e: React.MouseEvent) => void
    dropPosition: DropPosition
    isDragOver: boolean
    children?: ReactNode
}> = ({ node, depth, onClick, onToggle, isOpen, isActive, isDirty, onDelete, dropPosition, isDragOver, children }) => {
    const indentStyle = { paddingLeft: `${depth * 14}px` }

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: node.id, data: { node } })
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id: node.id, data: { node } })

    const draggableStyle = transform ? {
        opacity: isDragging ? 0.4 : undefined,
    } : undefined

    const effectiveOver = isOver || isDragOver

    if (node.category === "FOLD") {
        return (
            <div key={node.id} className="space-y-1" ref={setDroppableRef}>
                <div
                    className={cn(
                        "group flex items-center relative rounded-md",
                        dropPosition === 'inside' && effectiveOver && dropIndicatorInside,
                    )}
                    style={{ ...indentStyle, ...draggableStyle }}
                >
                    {dropPosition === 'before' && effectiveOver && <div className={dropIndicatorAbove} />}
                    {dropPosition === 'after' && effectiveOver && <div className={dropIndicatorBelow} />}
                    <button
                        type="button"
                        className="cursor-grab flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        {...listeners}
                        {...attributes}
                        ref={setDraggableRef}
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500"/> :
                            <ChevronRight className="h-4 w-4 text-slate-500"/>}
                        {isOpen ? <FolderOpen className="h-4 w-4 text-indigo-500"/> :
                            <Folder className="h-4 w-4 text-indigo-500"/>}
                        <span className="truncate">{node.name}</span>
                        {isDirty && (
                            <span className="ml-auto h-2 w-2 rounded-full bg-orange-400 shrink-0" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="hidden group-hover:flex shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
                {isOpen && children}
            </div>
        );
    }

    return (
        <div
            key={node.id}
            className={cn("flex items-center group relative rounded-md", isActive && "bg-indigo-100", isActive && "rounded-md")}
            style={{ ...indentStyle, ...draggableStyle }}
            ref={setDroppableRef}
        >
            {dropPosition === 'before' && effectiveOver && <div className={dropIndicatorAbove} />}
            {dropPosition === 'after' && effectiveOver && <div className={dropIndicatorBelow} />}
            <button
                type="button"
                className="cursor-grab flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                {...listeners}
                {...attributes}
                ref={setDraggableRef}
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onClick}
                className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100', isActive && 'bg-indigo-100')}
            >
                <FileCode2 className="h-4 w-4 text-slate-400"/>
                <span className={`w-12 text-xs font-semibold ${methodColorClass[node?.method ?? "GET"]}`}>{node?.method ?? "GET"}</span>
                <span className="truncate text-slate-700">{node.name}</span>
                {isDirty && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-orange-400 shrink-0" />
                )}
            </button>
            <button
                type="button"
                onClick={onDelete}
                className="hidden group-hover:flex shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
};

const SidebarLayout: React.FC = () => {
    const tree = useAppSelector(selectDirTree)
    const dispatch = useAppDispatch()
    const dirtyRequestIds = useAppSelector(selectDirtyRequestIds)
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<DirTree | null>(null)
    const expandedBeforeSearch = useRef<Record<string, boolean>>({})
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [dropTargetId, setDropTargetId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<DropPosition>(null)
    const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )

    const countFolders = (t: Map<string, DirTree>): number => {
        let count = 0
        for (const [, node] of t) {
            if (node.category === "FOLD") count++
            if (node.item) count += countFolders(node.item)
        }
        return count
    }

    const matchesSearch = (node: DirTree, query: string): boolean => {
        if (!query) return true
        const q = query.toLowerCase()
        if (node.name.toLowerCase().includes(q)) return true
        if (node.category === "FOLD" && node.item) {
            return Array.from(node.item.values()).some(child => matchesSearch(child, q))
        }
        return false
    }

    useEffect(() => {
        if (searchQuery) {
            expandedBeforeSearch.current = {...expandedFolders}
            const autoExpand: Record<string, boolean> = {}
            const walkAndExpand = (t: Map<string, DirTree>) => {
                for (const [, node] of t) {
                    if (node.category === "FOLD" && matchesSearch(node, searchQuery)) {
                        autoExpand[node.id] = true
                        if (node.item) walkAndExpand(node.item)
                    }
                }
            }
            walkAndExpand(tree)
            setExpandedFolders(autoExpand)
        } else if (Object.keys(expandedBeforeSearch.current).length > 0) {
            setExpandedFolders(expandedBeforeSearch.current)
            expandedBeforeSearch.current = {}
        }
    }, [searchQuery])

    const toggleRequest = (reqId: string)=>{
        dispatch(setActiveRequest({id: reqId}))
        dispatch(setActiveTree({id: reqId, status: true}))
    }

    const handleDeleteClick = (e: React.MouseEvent, node: DirTree) => {
        e.stopPropagation()
        setDeleteTarget(node)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return
        if (deleteTarget.category === 'REQ') {
            dispatch(deleteRequest({id: deleteTarget.id}))
        } else {
            dispatch(deleteFolder({id: deleteTarget.id}))
        }
        setDeleteTarget(null)
    }

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prevState=>({
            ...prevState,
            [folderId]: !prevState[folderId]
        })));
    };

    useEffect(() => {
        const record: Record<string, boolean> = {}
        loadExpandFolder(tree, record)
    }, [tree]);

    const loadExpandFolder = (tree: Map<string, DirTree>, record: Record<string, boolean>) =>{
        for (const [key, val] of tree){
            if (val?.category === "FOLD"){
                record[key] = false
                if (val?.item) loadExpandFolder(val.item, record)
            }
        }
    }

    const computeDropPosition = useCallback((event: DragOverEvent): DropPosition => {
        const targetRect = event.over?.rect
        if (!targetRect) return null

        const pointerY = event.delta.y + (event.active.rect.current.initial?.top ?? 0)
        const relativeY = pointerY - targetRect.top
        const ratio = relativeY / targetRect.height

        const overNode = event.over?.data.current?.node as DirTree | undefined

        if (overNode?.category === 'FOLD' && ratio > 0.25 && ratio < 0.75) {
            return 'inside'
        }

        return ratio < 0.5 ? 'before' : 'after'
    }, [])

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(String(event.active.id))
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current)
            expandTimerRef.current = null
        }
    }, [])

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const overId = event.over?.id
        if (!overId || !event.active.id) {
            setDropTargetId(null)
            setDropPosition(null)
            return
        }

        const activeId = String(event.active.id)
        const targetId = String(overId)

        if (activeId === targetId) {
            setDropTargetId(null)
            setDropPosition(null)
            return
        }

        setDropTargetId(targetId)

        const position = computeDropPosition(event)
        setDropPosition(position)

        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current)
            expandTimerRef.current = null
        }

        const overNode = event.over?.data.current?.node as DirTree | undefined
        if (overNode?.category === 'FOLD' && position === 'inside' && !expandedFolders[targetId]) {
            expandTimerRef.current = setTimeout(() => {
                toggleFolder(targetId)
            }, 800)
        }
    }, [computeDropPosition, expandedFolders])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveDragId(null)
        setDropTargetId(null)
        setDropPosition(null)

        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current)
            expandTimerRef.current = null
        }

        const { active, over } = event
        if (!over || !active || active.id === over.id) return

        const activeId = String(active.id)
        const targetId = String(over.id)

        const targetRect = over.rect
        const pointerY = event.delta.y + (active.rect.current.initial?.top ?? 0)
        const ratio = targetRect.height > 0 ? (pointerY - targetRect.top) / targetRect.height : 0

        const overNode = over.data.current?.node as DirTree | undefined
        let position: 'before' | 'after' | 'inside' = 'after'

        if (overNode?.category === 'FOLD' && ratio > 0.25 && ratio < 0.75) {
            position = 'inside'
        } else if (ratio < 0.5) {
            position = 'before'
        } else {
            position = 'after'
        }

        dispatch(moveItem({ movedId: activeId, targetId, position }))
    }, [dispatch])

    const renderNode = (node: DirTree, depth = 0): ReactNode => {
        if (searchQuery && !matchesSearch(node, searchQuery)) return null

        const isOpen = Boolean(expandedFolders[node.id]);
        const isActive = node.isActive || node.id === activeDragId

        return (
            <DragNode
                key={node.id}
                node={node}
                depth={depth}
                onClick={() => toggleRequest(node.id)}
                onToggle={() => toggleFolder(node.id)}
                isOpen={isOpen}
                isActive={isActive}
                isDirty={node.category === 'REQ'
                    ? dirtyRequestIds.includes(node.id)
                    : isFolderDirty(node, dirtyRequestIds)}
                onDelete={(e) => handleDeleteClick(e, node)}
                dropPosition={dropTargetId === node.id ? dropPosition : null}
                isDragOver={dropTargetId === node.id}
            >
                {isOpen && node?.item && (
                    <div className="space-y-1">
                        {Array.from(node?.item?.entries()).map(([_, child]) => {
                            return renderNode(child, depth + 1)
                        })}
                    </div>
                )}
            </DragNode>
        );
    };

    const findNodeById = (t: Map<string, DirTree>, id: string): DirTree | null => {
        for (const [, node] of t) {
            if (node.id === id) return node
            if (node.item) {
                const found = findNodeById(node.item, id)
                if (found) return found
            }
        }
        return null
    }

    const draggedNode = activeDragId ? findNodeById(tree, activeDragId) : null

    const treeContent = (
        <div className="">
            {Array.from(tree.entries()).map(([_, collection])=>{
               return renderNode(collection)
            })}
        </div>
    )

    return (
        <Sidebar
            className="fixed left-0 top-[60px] z-30 h-[calc(100dvh-60px)] w-64 flex-col border-r border-gray-200 bg-white"
            collapsible={"none"}
        >
            <SidebarContent className="flex flex-col overflow-y-auto px-3 py-2 bg-white">
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search collections & test suites..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs pl-8 pr-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                    </div>
                </div>
                <div className="mb-2 px-2 flex items-center space-x-1.5">
                    <FolderGit2 className="w-4 h-4 text-indigo-600" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collections ({countFolders(tree)})</p>
                </div>
                {searchQuery ? (
                    treeContent
                ) : (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        {treeContent}
                        <DragOverlay dropAnimation={null}>
                            {draggedNode ? (
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white shadow-lg border border-slate-200 opacity-90">
                                    {draggedNode.category === 'FOLD'
                                        ? <Folder className="h-4 w-4 text-indigo-500 shrink-0" />
                                        : <FileCode2 className="h-4 w-4 text-slate-400 shrink-0" />
                                    }
                                    {draggedNode.category === 'REQ' && (
                                        <span className={`text-xs font-semibold shrink-0 ${methodColorClass[draggedNode?.method ?? "GET"]}`}>{draggedNode?.method ?? "GET"}</span>
                                    )}
                                    <span className="truncate text-sm text-slate-700">{draggedNode.name}</span>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
                <TestScenarioSidebar searchQuery={searchQuery}/>
            </SidebarContent>
            <WarningDialog
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"?`}
                icon={<Trash2 className="h-10 w-10 text-red-500" />}
                onSubmit={handleDeleteConfirm}
                labelYes="Delete"
            />
        </Sidebar>
    );
};

export default SidebarLayout;
