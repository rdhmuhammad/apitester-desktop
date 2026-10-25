import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button.tsx"
import {Input} from "@/components/ui/input.tsx"
import {FileCode2, Folder, FolderUp, Plus, Save, Trash2} from "lucide-react"
import {cn} from "@/lib/utils.ts"
import {pickFolderPath} from "@/lib/pickFolderPath.ts"
import type {Collection} from "@/layout/services/collection.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts"
import {useProject} from "@/layout/hooks/useProject.ts"
import {useQueryClient} from "@tanstack/react-query"
import CustomToast from "@/components/common/toast"
import {useAppDispatch} from "@/app/store/hooks.ts"
import {resetEditorTabs} from "@/app/slices/editorTabsSlice.ts"
import {documentTreeQueryKey} from "@/pages/editor/services/documentation.ts"

interface CollectionManageProps {
    onOpenChange: (open: boolean) => void
}

const collectionListQueryKey = ["collection", "list"]

const CollectionManage: React.FC<CollectionManageProps> = ({onOpenChange}) => {
    const queryClient = useQueryClient()
    const dispatch = useAppDispatch()
    const [loading, setLoading] = useState(false)
    const [inlineIndex, setInlineIndex] = useState<number | null>(null)
    const [inlineName, setInlineName] = useState("")
    const [inlinePath, setInlinePath] = useState("")

    const {activeProject, updateProjectMutation} = useProject()
    const {
        collections,
        refetchCollections,
        refetchTree,
        createCollectionMutation,
        deleteCollectionMutation,
        selectCollectionMutation,
    } = useCollection()

    const activeProjectId = activeProject?.id

    useEffect(() => {
        if (!activeProjectId) return
        setLoading(true)
        refetchCollections()
            .catch((reason) => CustomToast.error(reason))
            .finally(() => setLoading(false))
    }, [activeProjectId, refetchCollections])

    const updateCollectionList = (updater: (items: Collection[]) => Collection[]) => {
        queryClient.setQueryData<Collection[]>(collectionListQueryKey, (current = []) => updater(current))
    }

    const handleChangeProjectFolder = async () => {
        if (!activeProject) return
        const path = await pickFolderPath()
        if (!path) return
        try {
            await updateProjectMutation.mutateAsync({id: activeProject.id, data: {path}})
            await refetchCollections()
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to update project")
        }
    }

    const handleSelectCollection = async (collectionId: string) => {
        try {
            await selectCollectionMutation.mutateAsync(collectionId)
            updateCollectionList((items) =>
                items.map((col) => ({...col, is_selected: col.id === collectionId}))
            )
            dispatch(resetEditorTabs())
            await refetchTree()
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            onOpenChange(false)
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to select collection")
        }
    }

    const handleDeleteCollection = async (collection: Collection) => {
        try {
            await deleteCollectionMutation.mutateAsync(collection.id)
            if (collection.is_selected) {
                dispatch(resetEditorTabs())
                await queryClient.resetQueries({queryKey: ["collection", "active"]})
            }
            updateCollectionList((items) => items.filter((c) => c.id !== collection.id))
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to delete collection")
        }
    }

    const handleOpenInlineCreate = (index: number) => {
        setInlineIndex(index)
        setInlineName("")
        setInlinePath(activeProject?.path || "")
    }

    const handleBrowseInlineFolder = async () => {
        const path = await pickFolderPath()
        if (path) setInlinePath(path)
    }

    const handleSaveInlineCollection = async (insertIndex: number) => {
        if (!activeProject || !inlineName.trim() || !inlinePath.trim()) return
        try {
            const created = await createCollectionMutation.mutateAsync({
                projectId: activeProject.id,
                name: inlineName.trim(),
                path: inlinePath.trim(),
            })
            updateCollectionList((items) => {
                const next = [...items]
                next.splice(insertIndex, 0, created)
                return next
            })
            setInlineIndex(null)
            setInlineName("")
            setInlinePath("")
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to create collection")
        }
    }

    const renderHoverSeparator = (index: number) => {
        if (inlineIndex === index) {
            return (
                <div
                    key={`inline-create-${index}`}
                    className="grid grid-cols-12 border-t border-border bg-muted/30 px-3 py-2 items-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="col-span-1 flex justify-center">
                        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground"/>
                    </div>
                    <div className="col-span-4 pr-2">
                        <Input
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                            placeholder="Collection name"
                            className="h-7 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveInlineCollection(index)
                                if (e.key === "Escape") setInlineIndex(null)
                            }}
                        />
                    </div>
                    <div className="col-span-5 pr-2">
                        <div className="flex items-center gap-1">
                            <Input
                                value={inlinePath}
                                onChange={(e) => setInlinePath(e.target.value)}
                                placeholder="Select folder path"
                                className="h-7 text-xs flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs shrink-0"
                                onClick={handleBrowseInlineFolder}
                                title="Select folder"
                            >
                                <FolderUp className="h-3.5 w-3.5"/>
                            </Button>
                        </div>
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700"
                            title="Save collection"
                            onClick={() => handleSaveInlineCollection(index)}
                        >
                            <Save className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            )
        }

        return (
            <div
                key={`sep-${index}`}
                className="group/sep relative h-2 -my-1 z-10 flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation()
                    handleOpenInlineCreate(index)
                }}
            >
                <div className="w-full border-t border-indigo-500/60 opacity-0 group-hover/sep:opacity-100 transition-opacity"/>
                <button
                    type="button"
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm opacity-0 group-hover/sep:opacity-100 transition-opacity hover:bg-indigo-700"
                    title="Add collection"
                >
                    <Plus className="h-3 w-3"/>
                </button>
            </div>
        )
    }

    if (!activeProject) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
                <Folder className="h-8 w-8 text-muted-foreground"/>
                <p className="text-sm font-medium text-foreground">No project opened</p>
                <p className="text-xs text-muted-foreground">
                    Use the project switcher in the title bar and choose <span className="font-medium">Open...</span>
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="shrink-0 mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Folder className="h-4 w-4 text-indigo-500 shrink-0"/>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{activeProject.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{activeProject.path || "(no folder)"}</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Change project folder"
                    onClick={handleChangeProjectFolder}
                >
                    <FolderUp className="h-4 w-4"/>
                </Button>
            </div>
            <div className="flex-1 overflow-auto rounded-lg border border-border">
                <div className="grid grid-cols-12 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="col-span-1"/>
                    <span className="col-span-4">Collection</span>
                    <span className="col-span-5">Path</span>
                    <span className="col-span-2"/>
                </div>
                {renderHoverSeparator(0)}
                {loading ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">Loading...</div>
                ) : collections.length === 0 && inlineIndex === null ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">
                        No collections in this project. Hover the line above to add one.
                    </div>
                ) : (
                    collections.map((collection, idx) => (
                        <div key={collection.id} className="flex flex-col">
                            <div
                                className={cn(
                                    "grid grid-cols-12 border-t border-border/60 px-3 py-2 items-center cursor-pointer hover:bg-muted/30",
                                    collection.is_selected && "bg-indigo-50 dark:bg-indigo-950/40"
                                )}
                                onClick={() => handleSelectCollection(collection.id)}
                            >
                                <div className="col-span-1 flex justify-center">
                                    <div
                                        className={cn(
                                            "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                                            collection.is_selected
                                                ? "border-indigo-600"
                                                : "border-slate-300 dark:border-slate-600"
                                        )}
                                    >
                                        {collection.is_selected && (
                                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"/>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-4 flex items-center gap-2 min-w-0">
                                    <FileCode2 className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                                    <span className="text-sm font-medium text-foreground truncate">
                                        {collection.name}
                                    </span>
                                </div>
                                <span className="col-span-5 text-xs text-muted-foreground truncate">
                                    {collection.path || "(no file)"}
                                </span>
                                <div className="col-span-2 flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                        title="Delete collection"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            handleDeleteCollection(collection)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>
                            {renderHoverSeparator(idx + 1)}
                        </div>
                    ))
                )}
            </div>
        </>
    )
}

export default CollectionManage
