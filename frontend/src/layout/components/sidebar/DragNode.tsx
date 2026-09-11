import {ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen, GripVertical} from "lucide-react";
import {cn} from "@/lib/utils.ts";
import {type ReactNode} from "react";
import {type RequestTree} from "@/layout/services/collection.ts";
import {useDraggable, useDroppable} from "@dnd-kit/core";
import {methodColorClass} from "@/layout/components/sidebar/constants.ts";

export type DropPosition = 'before' | 'after' | 'inside' | null

const dropIndicatorAbove = "absolute left-0 right-0 top-0 h-0.5 bg-indigo-500 rounded-full z-10"
const dropIndicatorBelow = "absolute left-0 right-0 bottom-0 h-0.5 bg-indigo-500 rounded-full z-10"
const dropIndicatorInside = "ring-2 ring-indigo-400 rounded-md bg-indigo-50/50"

const DragNode: React.FC<{
    node: RequestTree
    depth: number
    onClick: () => void
    onToggle: () => void
    isOpen: boolean
    isActive: boolean
    dropPosition: DropPosition
    isDragOver: boolean
    children?: ReactNode
}> = ({node, depth, onClick, onToggle, isOpen, isActive, dropPosition, isDragOver, children}) => {
    const indentStyle = {paddingLeft: `${depth * 14}px`}
    const {setNodeRef: setDroppableRef, isOver} = useDroppable({id: node.id, data: {node}})
    const {attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging} = useDraggable({
        id: node.id,
        data: {node},
    })
    const draggableStyle = transform ? {opacity: isDragging ? 0.4 : undefined} : undefined
    const effectiveOver = isOver || isDragOver

    if (node.category === "FOLD") {
        return (
            <div key={node.id} className="space-y-1" ref={setDroppableRef}>
                <div
                    className={cn(
                        "group flex items-center relative rounded-md",
                        dropPosition === 'inside' && effectiveOver && dropIndicatorInside,
                    )}
                    style={{...indentStyle, ...draggableStyle}}
                >
                    {dropPosition === 'before' && effectiveOver && <div className={dropIndicatorAbove}/>} 
                    {dropPosition === 'after' && effectiveOver && <div className={dropIndicatorBelow}/>} 
                    <button
                        type="button"
                        className="cursor-grab flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        {...listeners}
                        {...attributes}
                        ref={setDraggableRef}
                    >
                        <GripVertical className="h-3.5 w-3.5"/>
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
                    </button>
                </div>
                {isOpen && children}
            </div>
        )
    }

    return (
        <div
            key={node.id}
            className={cn("flex items-center group relative rounded-md", isActive && "bg-indigo-100")}
            style={{...indentStyle, ...draggableStyle}}
            ref={setDroppableRef}
        >
            {dropPosition === 'before' && effectiveOver && <div className={dropIndicatorAbove}/>} 
            {dropPosition === 'after' && effectiveOver && <div className={dropIndicatorBelow}/>} 
            <button
                type="button"
                className="cursor-grab flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-slate-200 text-slate-300 hover:text-slate-500 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                {...listeners}
                {...attributes}
                ref={setDraggableRef}
            >
                <GripVertical className="h-3.5 w-3.5"/>
            </button>
            <button
                type="button"
                onClick={onClick}
                className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100', isActive && 'bg-indigo-100')}
            >
                <FileCode2 className="h-4 w-4 text-slate-400"/>
                <span className={`w-12 text-xs font-semibold ${methodColorClass[node.method ?? "GET"]}`}>{node.method ?? "GET"}</span>
                <span className="truncate text-slate-700">{node.name}</span>
            </button>
        </div>
    )
}

export default DragNode
