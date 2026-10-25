import {useEffect, useState} from "react"
import {
    Bold,
    CheckSquare,
    ChevronDown,
    Code,
    Code2,
    FileText,
    Grid3X3,
    Image,
    Italic,
    Link2,
    List,
    ListOrdered,
    Redo2,
    Strikethrough,
    Type,
    Undo2,
} from "lucide-react"
import {Button} from "@/components/ui/button.tsx"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts"
import {
    dispatchDocumentToolbarAction,
    type DocumentToolbarState,
    onDocumentToolbarState,
} from "@/pages/editor/services/documentation.ts"
import {cn} from "@/lib/utils.ts"

const HEADING_LABELS: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, string> = {
    0: "Paragraph",
    1: "Heading 1",
    2: "Heading 2",
    3: "Heading 3",
    4: "Heading 4",
    5: "Heading 5",
    6: "Heading 6",
}

const preventBlur = (e: React.MouseEvent) => {
    e.preventDefault()
}

const DocumentEditorHeader: React.FC = () => {
    const activeTab = useAppSelector(selectEditorActiveTab)
    const [toolbarState, setToolbarState] = useState<DocumentToolbarState>({
        sourceMode: false,
        canUndo: false,
        canRedo: false,
        headingLevel: 0,
    })
    const [tableMenuOpen, setTableMenuOpen] = useState(false)
    const [hoverCols, setHoverCols] = useState(1)
    const [hoverRows, setHoverRows] = useState(1)

    const visibleCols = Math.min(20, Math.max(11, hoverCols + 1))
    const visibleRows = Math.min(20, Math.max(5, hoverRows + 1))

    useEffect(() => {
        return onDocumentToolbarState((nextState) => {
            setToolbarState(nextState)
        })
    }, [])

    return (
        <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto py-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!toolbarState.canUndo}
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "undo"})}
                    title="Undo (Ctrl+Z)"
                    className="h-8 w-8 p-0"
                >
                    <Undo2 className="h-4 w-4"/>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!toolbarState.canRedo}
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "redo"})}
                    title="Redo (Ctrl+Y)"
                    className="h-8 w-8 p-0"
                >
                    <Redo2 className="h-4 w-4"/>
                </Button>

                <div className="mx-1 h-5 w-px bg-border"/>

                <Button
                    type="button"
                    variant={toolbarState.sourceMode ? "secondary" : "ghost"}
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "toggle-source"})}
                    title="Toggle Markdown Source / Live Preview"
                    className={cn(
                        "h-8 gap-1.5 px-2.5 text-xs font-medium",
                        toolbarState.sourceMode && "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                    )}
                >
                    <Code2 className="h-3.5 w-3.5"/>
                    Source
                </Button>

                <div className="mx-1 h-5 w-px bg-border"/>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onMouseDown={preventBlur}
                            className="h-8 gap-1 px-2 text-xs font-medium"
                            title="Text / Heading style"
                        >
                            <Type className="h-3.5 w-3.5 text-muted-foreground"/>
                            <span>{HEADING_LABELS[toolbarState.headingLevel] ?? "Paragraph"}</span>
                            <ChevronDown className="h-3 w-3 text-muted-foreground"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                        {([0, 1, 2, 3, 4, 5, 6] as const).map((level) => (
                            <DropdownMenuItem
                                key={level}
                                onClick={() => dispatchDocumentToolbarAction({type: "heading", level})}
                                className={cn(
                                    "text-xs",
                                    toolbarState.headingLevel === level && "font-semibold text-indigo-600"
                                )}
                            >
                                {HEADING_LABELS[level]}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="mx-1 h-5 w-px bg-border"/>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "bold"})}
                    title="Bold (**text**)"
                    className="h-8 w-8 p-0 font-bold"
                >
                    <Bold className="h-4 w-4"/>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "italic"})}
                    title="Italic (*text*)"
                    className="h-8 w-8 p-0 italic"
                >
                    <Italic className="h-4 w-4"/>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "strikethrough"})}
                    title="Strikethrough (~~text~~)"
                    className="h-8 w-8 p-0"
                >
                    <Strikethrough className="h-4 w-4"/>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "code"})}
                    title="Inline or Fenced Code (`code`)"
                    className="h-8 w-8 p-0"
                >
                    <Code className="h-4 w-4"/>
                </Button>

                <div className="mx-1 h-5 w-px bg-border"/>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onMouseDown={preventBlur}
                            title="Insert List"
                            className="h-8 gap-0.5 px-1.5"
                        >
                            <List className="h-4 w-4"/>
                            <ChevronDown className="h-3 w-3 text-muted-foreground"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuItem
                            onClick={() => dispatchDocumentToolbarAction({type: "list", kind: "ul"})}
                            className="text-xs"
                        >
                            <List className="mr-2 h-3.5 w-3.5"/>
                            Bullet List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => dispatchDocumentToolbarAction({type: "list", kind: "ol"})}
                            className="text-xs"
                        >
                            <ListOrdered className="mr-2 h-3.5 w-3.5"/>
                            Numbered List
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => dispatchDocumentToolbarAction({type: "list", kind: "task"})}
                            className="text-xs"
                        >
                            <CheckSquare className="mr-2 h-3.5 w-3.5"/>
                            Task List
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "link"})}
                    title="Insert Link ([text](url))"
                    className="h-8 w-8 p-0"
                >
                    <Link2 className="h-4 w-4"/>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onMouseDown={preventBlur}
                    onClick={() => dispatchDocumentToolbarAction({type: "image"})}
                    title="Insert Image (![alt](url))"
                    className="h-8 w-8 p-0"
                >
                    <Image className="h-4 w-4"/>
                </Button>
                <DropdownMenu
                    open={tableMenuOpen}
                    onOpenChange={(open) => {
                        setTableMenuOpen(open)
                        if (open) {
                            setHoverCols(1)
                            setHoverRows(1)
                        }
                    }}
                >
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onMouseDown={preventBlur}
                            title="Insert Table"
                            className="h-8 w-8 p-0"
                        >
                            <Grid3X3 className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        onMouseDown={preventBlur}
                        className="w-auto p-3"
                    >
                        <div
                            className="flex flex-col gap-1"
                            onMouseLeave={() => {
                                setHoverCols(1)
                                setHoverRows(1)
                            }}
                        >
                            {Array.from({length: visibleRows}, (_, rIdx) => {
                                const r = rIdx + 1
                                return (
                                    <div key={r} className="flex items-center gap-1">
                                        {Array.from({length: visibleCols}, (_, cIdx) => {
                                            const c = cIdx + 1
                                            const active = c <= hoverCols && r <= hoverRows
                                            return (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onMouseDown={preventBlur}
                                                    onMouseEnter={() => {
                                                        setHoverCols(c)
                                                        setHoverRows(r)
                                                    }}
                                                    onClick={() => {
                                                        dispatchDocumentToolbarAction({
                                                            type: "table",
                                                            cols: c,
                                                            rows: r,
                                                        })
                                                        setTableMenuOpen(false)
                                                    }}
                                                    className={cn(
                                                        "h-4 w-4 rounded-[2px] border transition-colors",
                                                        active
                                                            ? "border-blue-500 bg-blue-100 dark:border-blue-400 dark:bg-blue-900/60"
                                                            : "border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40"
                                                    )}
                                                />
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="mt-2 text-center text-xs font-medium text-foreground">
                            {hoverCols} x {hoverRows}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <FileText className="h-4 w-4 text-sky-600"/>
                <span className="max-w-[220px] truncate font-medium text-foreground">
                    {activeTab?.label || "Document"}
                </span>
            </div>
        </div>
    )
}

export default DocumentEditorHeader
