import {Sidebar, SidebarContent} from "@/components/ui/sidebar.tsx";
import {type ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {FileCode2, Folder, FolderGit2, LoaderCircle, Search} from "lucide-react";
import TestScenarioSidebar from "@/layout/components/sidebar/TestScenarioSidebar.tsx";
import AutomationSidebar from "@/layout/components/sidebar/AutomationSidebar.tsx";
import DragNode, {type DropPosition} from "@/layout/components/sidebar/DragNode.tsx";
import {methodColorClass} from "@/layout/components/sidebar/constants.ts";
import {toUpdateTreePayload, type RequestTree} from "@/layout/services/collection.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import {
    openEditorTab,
    removeEditorTab,
    selectEditorActiveTabId,
} from "@/app/slices/editorTabsSlice.ts";
import type {ColtReqMethod} from "@/pages/editor/types/editor.ts";
import {
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

const collectRequestIds = (node: RequestTree): string[] => {
    const ids: string[] = []
    if (node.category === "REQ") {
        ids.push(node.id)
    }
    if (node.item) {
        for (const child of node.item) {
            ids.push(...collectRequestIds(child))
        }
    }
    return ids
}

const containsNode = (nodes: RequestTree[], id: string): boolean => {
    for (const node of nodes) {
        if (node.id === id) return true
        if (node.item && containsNode(node.item, id)) return true
    }
    return false
}

const isDescendantNode = (nodes: RequestTree[], parentId: string, targetId: string): boolean => {
    for (const node of nodes) {
        if (node.id === parentId) {
            return containsNode(node.item || [], targetId)
        }
        if (node.item && isDescendantNode(node.item, parentId, targetId)) {
            return true
        }
    }
    return false
}

const findNodeById = (nodes: RequestTree[], id: string): RequestTree | null => {
    for (const node of nodes) {
        if (node.id === id) return node
        if (node.item) {
            const found = findNodeById(node.item, id)
            if (found) return found
        }
    }
    return null
}

const removeNode = (
    nodes: RequestTree[],
    id: string
): { newNodes: RequestTree[]; removed: RequestTree | null } => {
    let removed: RequestTree | null = null
    const newNodes: RequestTree[] = []

    for (const node of nodes) {
        if (node.id === id) {
            removed = node
            continue
        }
        if (node.item && node.item.length > 0) {
            const childResult = removeNode(node.item, id)
            if (childResult.removed) {
                removed = childResult.removed
                newNodes.push({
                    ...node,
                    item: childResult.newNodes,
                })
                continue
            }
        }
        newNodes.push(node)
    }

    return { newNodes, removed }
}

const insertNode = (
    nodes: RequestTree[],
    targetId: string,
    nodeToInsert: RequestTree,
    position: 'before' | 'after' | 'inside'
): RequestTree[] => {
    if (position === 'inside') {
        return nodes.map((node) => {
            if (node.id === targetId) {
                return {
                    ...node,
                    item: [...(node.item || []), nodeToInsert],
                }
            }
            if (node.item && node.item.length > 0) {
                return {
                    ...node,
                    item: insertNode(node.item, targetId, nodeToInsert, position),
                }
            }
            return node
        })
    }

    const targetIndex = nodes.findIndex((node) => node.id === targetId)
    if (targetIndex !== -1) {
        const nextNodes = [...nodes]
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
        nextNodes.splice(insertIndex, 0, nodeToInsert)
        return nextNodes
    }

    return nodes.map((node) => {
        if (node.item && node.item.length > 0) {
            return {
                ...node,
                item: insertNode(node.item, targetId, nodeToInsert, position),
            }
        }
        return node
    })
}

const reorderTree = (
    nodes: RequestTree[],
    activeId: string,
    overId: string,
    position: 'before' | 'after' | 'inside'
): RequestTree[] | null => {
    if (activeId === overId) return null
    if (isDescendantNode(nodes, activeId, overId)) return null

    const { newNodes, removed } = removeNode(nodes, activeId)
    if (!removed) return null

    return insertNode(newNodes, overId, removed, position)
}

const SidebarLayout: React.FC = () => {
    const dispatch = useAppDispatch()
    const queryClient = useQueryClient();
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('')
    const expandedBeforeSearch = useRef<Record<string, boolean>>({})
    const [activeDragId, setActiveDragId] = useState<string | null>(null)
    const [dropTargetId, setDropTargetId] = useState<string | null>(null)
    const [dropPosition, setDropPosition] = useState<DropPosition>(null)
    const dropPositionRef = useRef<DropPosition>(null)
    const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const activeTabsId = useAppSelector(selectEditorActiveTabId)
    const [nodeToDelete, setNodeToDelete] = useState<RequestTree | null>(null)
    const {
        requestTree: tree,
        activeCollection,
        updateTreeMutation,
        isUpdatingTree,
    } = useCollection()

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}})
    )

    const countFolders = (nodes: RequestTree[]): number => {
        let count = 0
        for (const node of nodes) {
            if (node.category === "FOLD") count++
            if (node.item) count += countFolders(node.item)
        }
        return count
    }

    const matchesSearch = (node: RequestTree, query: string): boolean => {
        if (!query) return true
        const q = query.toLowerCase()
        if (node.name.toLowerCase().includes(q)) return true
        if (node.category === "FOLD" && node.item) {
            return node.item.some(child => matchesSearch(child, q))
        }
        return false
    }

    useEffect(() => {
        if (searchQuery) {
            expandedBeforeSearch.current = {...expandedFolders}
            const autoExpand: Record<string, boolean> = {}
            const walkAndExpand = (nodes: RequestTree[]) => {
                for (const node of nodes) {
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
    }, [searchQuery, tree])

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((prevState => ({
            ...prevState,
            [folderId]: !prevState[folderId]
        })));
    };

    useEffect(() => {
        queryClient.removeQueries({queryKey: ["collection", "tree"]})
        setExpandedFolders({})
    }, [activeCollection, queryClient]);

    useEffect(() => {
        setExpandedFolders((prev) => {
            const record: Record<string, boolean> = {}
            const loadExpandFolder = (nodes: RequestTree[]) => {
                for (const node of nodes) {
                    if (node.category === "FOLD") {
                        record[node.id] = prev[node.id] ?? false
                        if (node.item) loadExpandFolder(node.item)
                    }
                }
            }
            loadExpandFolder(tree)
            return record
        })
    }, [tree]);

    const computeDropPosition = useCallback((event: DragOverEvent): DropPosition => {
        const targetRect = event.over?.rect
        if (!targetRect) return null

        const pointerY = event.delta.y + (event.active.rect.current.initial?.top ?? 0)
        const relativeY = pointerY - targetRect.top
        const ratio = relativeY / targetRect.height

        const overNode = event.over?.data.current?.node as RequestTree | undefined

        if (overNode?.category === 'FOLD' && ratio > 0.25 && ratio < 0.75) {
            return 'inside'
        }

        return ratio < 0.5 ? 'before' : 'after'
    }, [])

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragId(String(event.active.id))
        dropPositionRef.current = null
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
            dropPositionRef.current = null
            return
        }

        const activeId = String(event.active.id)
        const targetId = String(overId)

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

        const overNode = event.over?.data.current?.node as RequestTree | undefined
        if (overNode?.category === 'FOLD' && position === 'inside' && !expandedFolders[targetId]) {
            expandTimerRef.current = setTimeout(() => {
                toggleFolder(targetId)
            }, 800)
        }
    }, [computeDropPosition, expandedFolders])

    const handleDragEnd = useCallback((event: DragEndEvent) => {
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

        const activeId = String(active.id)
        const overId = String(over.id)

        const targetNode = findNodeById(tree, overId)
        if (!targetNode) return

        let effectivePosition = targetPosition
        if (effectivePosition === 'inside' && targetNode.category !== 'FOLD') {
            effectivePosition = 'after'
        }

        const reorderedTree = reorderTree(tree, activeId, overId, effectivePosition)
        if (!reorderedTree) return

        if (effectivePosition === 'inside') {
            setExpandedFolders((prev) => ({...prev, [overId]: true}))
        }

        // 1. Optimistically update TanStack Query tree state
        queryClient.setQueryData(["collection", "tree"], reorderedTree)

        // 2. Persist new tree order to backend
        if (activeCollection?.id) {
            const payload = toUpdateTreePayload(reorderedTree)
            updateTreeMutation.mutate({
                collectionId: activeCollection.id,
                tree: payload,
            })
        }
    }, [tree, dropPosition, activeCollection, queryClient, updateTreeMutation])

    const handleConfirmDelete = () => {
        if (!nodeToDelete) return

        const targetId = nodeToDelete.id
        const affectedRequestIds = collectRequestIds(nodeToDelete)

        // Close any open editor tabs for deleted request(s)
        for (const reqId of affectedRequestIds) {
            if (activeTabsId.includes(reqId)) {
                dispatch(removeEditorTab(reqId))
            }
        }

        const {newNodes, removed} = removeNode(tree, targetId)
        if (!removed) {
            setNodeToDelete(null)
            return
        }

        // 1. Optimistically update TanStack Query tree state
        queryClient.setQueryData(["collection", "tree"], newNodes)

        // 2. Persist new tree order to backend (pruned node will be omitted)
        if (activeCollection?.id) {
            const payload = toUpdateTreePayload(newNodes)
            updateTreeMutation.mutate({
                collectionId: activeCollection.id,
                tree: payload,
            })
        }

        setNodeToDelete(null)
    }

    const renderNode = (node: RequestTree, depth = 0): ReactNode => {
        if (searchQuery && !matchesSearch(node, searchQuery)) return null

        const isOpen = Boolean(expandedFolders[node.id]);
        const isActive = node.isActive || activeTabsId.includes(node.id) || node.id === activeDragId

        return (
            <DragNode
                key={node.id}
                node={node}
                depth={depth}
                onClick={() => handleRequestClick(node)}
                onToggle={() => toggleFolder(node.id)}
                onDelete={() => setNodeToDelete(node)}
                isOpen={isOpen}
                isActive={isActive}
                dropPosition={dropTargetId === node.id ? dropPosition : null}
                isDragOver={dropTargetId === node.id}
            >
                {isOpen && node?.item && (
                    <div className="space-y-1">
                        {node.item.map((child) => {
                            return renderNode(child, depth + 1)
                        })}
                    </div>
                )}
            </DragNode>
        );
    };

    const draggedNode = activeDragId ? findNodeById(tree, activeDragId) : null

    const handleRequestClick = (node: RequestTree) => {
        if (node.category !== "REQ") return

        dispatch(openEditorTab({
            id: node.id,
            label: node.name,
            method: (node.method ?? 'GET') as ColtReqMethod,
            type: 'request',
        }))
    }

    const treeContent = (
        <div className="">
            {tree.map((collection) => {
                return renderNode(collection)
            })}
        </div>
    )

    return (
        <Sidebar
            className="fixed left-0 top-[90px] z-30 h-[calc(100dvh-90px)] w-64 flex-col border-r border-sidebar-border bg-sidebar"
            collapsible={"none"}
        >
            <SidebarContent className="flex flex-col overflow-y-auto px-3 py-2 bg-sidebar">
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground"/>
                        <input
                            type="text"
                            placeholder="Search collections & test suites..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-sidebar-accent border border-sidebar-border text-sidebar-foreground placeholder-muted-foreground text-xs pl-8 pr-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                        />
                    </div>
                </div>
                <div className="mb-2 px-2 flex items-center space-x-1.5">
                    <FolderGit2 className="w-4 h-4 text-indigo-600"/>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collections
                        ({countFolders(tree)})</p>
                </div>
                <div className="relative">
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
                                    <div
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card shadow-lg border border-border opacity-90">
                                        {draggedNode.category === 'FOLD'
                                            ? <Folder className="h-4 w-4 text-indigo-500 shrink-0"/>
                                            : <FileCode2 className="h-4 w-4 text-slate-400 shrink-0"/>
                                        }
                                        {draggedNode.category === 'REQ' && (
                                            <span
                                                className={`text-xs font-semibold shrink-0 ${methodColorClass[draggedNode?.method ?? "GET"]}`}>{draggedNode?.method ?? "GET"}</span>
                                        )}
                                        <span className="truncate text-sm text-foreground">{draggedNode.name}</span>
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                    {isUpdatingTree && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px] rounded-md transition-opacity">
                            <LoaderCircle className="h-6 w-6 animate-spin text-white"/>
                            <span className="mt-1 text-xs font-medium text-white/90">Updating tree...</span>
                        </div>
                    )}
                </div>
                <TestScenarioSidebar searchQuery={searchQuery}/>
                <AutomationSidebar searchQuery={searchQuery}/>
            </SidebarContent>
            <AlertDialog open={Boolean(nodeToDelete)} onOpenChange={(open) => !open && setNodeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {nodeToDelete?.category === "FOLD" ? "Folder" : "Request"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {nodeToDelete?.category === "FOLD"
                                ? `Are you sure you want to delete folder "${nodeToDelete?.name}" and all of its items? This action cannot be undone.`
                                : `Are you sure you want to delete request "${nodeToDelete?.name}"? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setNodeToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sidebar>
    );
};

export default SidebarLayout;
