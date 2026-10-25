import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button.tsx"
import {Input} from "@/components/ui/input.tsx"
import {FileCode2, Folder, FolderUp, Plus, Save, Trash2} from "lucide-react"
import {cn} from "@/lib/utils.ts"
import type {Project} from "@/layout/services/collection.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts"
import {useQueryClient} from "@tanstack/react-query"
import CustomToast from "@/components/common/toast"
import {useAppDispatch} from "@/app/store/hooks.ts"
import {resetEditorTabs} from "@/app/slices/editorTabsSlice.ts"
import {documentTreeQueryKey} from "@/pages/editor/services/documentation.ts"

async function pickFolderPath(): Promise<string | null> {
    if (window.electronAPI?.openFolderDialog) {
        const result = await window.electronAPI.openFolderDialog()
        if (result.canceled || result.filePaths.length === 0) return null
        return result.filePaths[0]
    }
    return null
}

interface CollectionManageProps {
    onOpenChange: (open: boolean) => void
}

interface InlineCreateState {
    projectId: string
    index: number
}

const CollectionManage: React.FC<CollectionManageProps> = ({onOpenChange}) => {
    const queryClient = useQueryClient()
    const dispatch = useAppDispatch()
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [newName, setNewName] = useState("")
    const [newFolderPath, setNewFolderPath] = useState("")
    const [loading, setLoading] = useState(false)
    const [inlineCreate, setInlineCreate] = useState<InlineCreateState | null>(null)
    const [inlineName, setInlineName] = useState("")
    const [inlinePath, setInlinePath] = useState("")

    const {
        projects,
        refetchTree,
        refetchProjects,
        createProjectMutation,
        updateProjectMutation,
        deleteProjectMutation,
        createCollectionMutation,
        deleteCollectionMutation,
        selectCollectionMutation,
    } = useCollection()

    useEffect(() => {
        setLoading(true)
        refetchProjects()
            .then((res) => {
                const list = res.data ?? []
                let activeColId: string | null = null
                let activeProjId: string | null = null
                for (const project of list) {
                    const selectedCol = project.collections?.find((c) => c.is_selected)
                    if (selectedCol) {
                        activeColId = selectedCol.id
                        activeProjId = project.id
                        break
                    }
                    if (project.is_selected && !activeProjId) {
                        activeProjId = project.id
                    }
                }
                setSelectedCollectionId(activeColId)
                setSelectedProjectId(activeProjId)
            })
            .catch((reason) => CustomToast.error(reason))
            .finally(() => setLoading(false))
    }, [dispatch, refetchProjects])

    const updateProjectList = (updater: (projects: Project[]) => Project[]) => {
        queryClient.setQueryData<Project[]>(["project", "list"], (current = []) => updater(current))
    }

    const deleteActiveCollection = () => {
        queryClient.removeQueries({queryKey: ["collection", "active"]})
    }

    const handleBrowseFolder = async () => {
        const path = await pickFolderPath()
        if (path) setNewFolderPath(path)
    }

    const handleAddProject = async () => {
        if (!newName.trim() || !newFolderPath.trim()) return
        try {
            const created = await createProjectMutation.mutateAsync({
                name: newName.trim(),
                path: newFolderPath.trim(),
            })
            updateProjectList((items) => [created, ...items])
            setNewName("")
            setNewFolderPath("")
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to create project")
        }
    }

    const handleDeleteProject = async (projectId: string) => {
        try {
            await deleteProjectMutation.mutateAsync(projectId)
            if (selectedProjectId === projectId) {
                deleteActiveCollection()
                setSelectedProjectId(null)
                setSelectedCollectionId(null)
            }
            updateProjectList((items) => items.filter((item) => item.id !== projectId))
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to delete project")
        }
    }

    const handleBrowseProjectFolder = async (projectId: string) => {
        const path = await pickFolderPath()
        if (!path) return
        try {
            const updated = await updateProjectMutation.mutateAsync({id: projectId, data: {path}})
            updateProjectList((items) => items.map((item) => item.id === projectId ? updated : item))
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to update project")
        }
    }

    const handleSelectCollection = async (projectId: string, collectionId: string) => {
        try {
            await selectCollectionMutation.mutateAsync(collectionId)
            updateProjectList((items) =>
                items.map((project) => ({
                    ...project,
                    is_selected: project.id === projectId,
                    collections: (project.collections ?? []).map((col) => ({
                        ...col,
                        is_selected: col.id === collectionId,
                    })),
                }))
            )
            setSelectedProjectId(projectId)
            setSelectedCollectionId(collectionId)
            dispatch(resetEditorTabs())
            await refetchTree()
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            onOpenChange(false)
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to select collection")
        }
    }

    const handleDeleteCollection = async (projectId: string, collectionId: string) => {
        try {
            await deleteCollectionMutation.mutateAsync(collectionId)
            if (selectedCollectionId === collectionId) {
                deleteActiveCollection()
                setSelectedCollectionId(null)
            }
            updateProjectList((items) =>
                items.map((project) =>
                    project.id === projectId
                        ? {
                              ...project,
                              collections: (project.collections ?? []).filter((c) => c.id !== collectionId),
                          }
                        : project
                )
            )
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to delete collection")
        }
    }

    const handleOpenInlineCreate = (project: Project, index: number) => {
        setInlineCreate({projectId: project.id, index})
        setInlineName("")
        setInlinePath(project.path || "")
    }

    const handleBrowseInlineFolder = async () => {
        const path = await pickFolderPath()
        if (path) setInlinePath(path)
    }

    const handleSaveInlineCollection = async (projectId: string, insertIndex: number) => {
        if (!inlineName.trim() || !inlinePath.trim()) return
        try {
            const created = await createCollectionMutation.mutateAsync({
                projectId,
                name: inlineName.trim(),
                path: inlinePath.trim(),
            })
            updateProjectList((items) =>
                items.map((project) => {
                    if (project.id !== projectId) return project
                    const nextCollections = [...(project.collections ?? [])]
                    nextCollections.splice(insertIndex, 0, created)
                    return {...project, collections: nextCollections}
                })
            )
            setInlineCreate(null)
            setInlineName("")
            setInlinePath("")
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to create collection")
        }
    }

    const renderHoverSeparator = (project: Project, index: number) => {
        const isOpen = inlineCreate?.projectId === project.id && inlineCreate?.index === index
        if (isOpen) {
            return (
                <div
                    key={`inline-create-${project.id}-${index}`}
                    className="grid grid-cols-12 border-t border-border bg-muted/30 px-3 py-2 items-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="col-span-1 flex justify-center">
                        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground"/>
                    </div>
                    <div className="col-span-4 pl-4 pr-2">
                        <Input
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                            placeholder="Collection name"
                            className="h-7 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveInlineCollection(project.id, index)
                                if (e.key === "Escape") setInlineCreate(null)
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
                            onClick={() => handleSaveInlineCollection(project.id, index)}
                        >
                            <Save className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            )
        }

        return (
            <div
                key={`sep-${project.id}-${index}`}
                className="group/sep relative h-2 -my-1 z-10 flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation()
                    handleOpenInlineCreate(project, index)
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

    return (
        <>
            <div className="flex-1 overflow-auto rounded-lg border border-border">
                <div className="grid grid-cols-12 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="col-span-1"/>
                    <span className="col-span-4">Project / Collection</span>
                    <span className="col-span-5">Path</span>
                    <span className="col-span-2"/>
                </div>
                {loading ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">Loading...</div>
                ) : projects.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">
                        No projects yet. Add a project folder below.
                    </div>
                ) : (
                    projects.map((project) => {
                        const isProjectSelected = selectedProjectId === project.id || project.is_selected
                        const childCollections = project.collections ?? []
                        return (
                            <div key={project.id} className="flex flex-col">
                                <div
                                    className={cn(
                                        "grid grid-cols-12 border-t border-border px-3 py-2 items-center",
                                        isProjectSelected && "bg-indigo-50/70 dark:bg-indigo-950/30"
                                    )}
                                >
                                    <div className="col-span-1 flex justify-center">
                                        <div
                                            className={cn(
                                                "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                                                isProjectSelected
                                                    ? "border-indigo-600"
                                                    : "border-slate-300 dark:border-slate-600"
                                            )}
                                        >
                                            {isProjectSelected && (
                                                <div className="h-2 w-2 rounded-full bg-indigo-600"/>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                                        <Folder className="h-4 w-4 text-indigo-500 shrink-0"/>
                                        <span className="text-sm font-semibold text-foreground truncate">
                                            {project.name}
                                        </span>
                                    </div>
                                    <span className="col-span-5 text-sm text-muted-foreground truncate">
                                        {project.path || "(no folder)"}
                                    </span>
                                    <div className="col-span-2 flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            title="Browse project folder"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                handleBrowseProjectFolder(project.id)
                                            }}
                                        >
                                            <FolderUp className="h-4 w-4"/>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                            title="Delete project"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                handleDeleteProject(project.id)
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>

                                {renderHoverSeparator(project, 0)}

                                {childCollections.map((collection, idx) => {
                                    const isCollectionSelected =
                                        selectedCollectionId === collection.id || collection.is_selected
                                    return (
                                        <div key={collection.id} className="flex flex-col">
                                            <div
                                                className={cn(
                                                    "grid grid-cols-12 border-t border-border/60 bg-muted/10 px-3 py-2 items-center cursor-pointer hover:bg-muted/30",
                                                    isCollectionSelected && "bg-indigo-50 dark:bg-indigo-950/40"
                                                )}
                                                onClick={() => handleSelectCollection(project.id, collection.id)}
                                            >
                                                <div className="col-span-1 flex justify-center">
                                                    <div
                                                        className={cn(
                                                            "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                                                            isCollectionSelected
                                                                ? "border-indigo-600"
                                                                : "border-slate-300 dark:border-slate-600"
                                                        )}
                                                    >
                                                        {isCollectionSelected && (
                                                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-600"/>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-4 pl-4 flex items-center gap-2 min-w-0">
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
                                                            handleDeleteCollection(project.id, collection.id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </div>
                                            </div>
                                            {renderHoverSeparator(project, idx + 1)}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })
                )}
            </div>
            <div className="shrink-0 pt-3">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Input
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder="Project name"
                            className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={handleBrowseFolder}>
                            <FolderUp className="h-4 w-4 mr-1"/> Browse
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleAddProject}>
                            <Plus className="h-4 w-4 mr-1"/> Add
                        </Button>
                    </div>
                    {newFolderPath && (
                        <p className="text-xs text-muted-foreground truncate px-1">Folder: {newFolderPath}</p>
                    )}
                </div>
            </div>
        </>
    )
}

export default CollectionManage
