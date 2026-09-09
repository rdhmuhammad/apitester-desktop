import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button.tsx"
import {Input} from "@/components/ui/input.tsx"
import {FileUp, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine} from "lucide-react"
import {cn} from "@/lib/utils.ts"
import {type Collection} from "@/layout/services/collection.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts"
import {useCollectionPushPull} from "@/layout/hooks/useCollectionPushPull.ts"
import {useQueryClient} from "@tanstack/react-query"
import CustomToast from "@/components/common/toast"

async function pickFilePath(): Promise<string | null> {
    if (window.electronAPI) {
        const result = await window.electronAPI.openFileDialog()
        if (result.canceled || result.filePaths.length === 0) return null
        return result.filePaths[0]
    }

    return new Promise((resolve) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".json,application/json"
        input.onchange = () => {
            const file = input.files?.[0]
            resolve(file ? ((file as File & {path?: string}).path ?? file.name) : null)
        }
        input.click()
    })
}

interface CollectionManageProps {
    onOpenChange: (open: boolean) => void
}

const CollectionManage: React.FC<CollectionManageProps> = ({onOpenChange}) => {
    const {pull, push, isPulling, isPushing} = useCollectionPushPull()
    const queryClient = useQueryClient()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [newName, setNewName] = useState("")
    const [newFilePath, setNewFilePath] = useState("")
    const [loading, setLoading] = useState(false)

    const {
        collections,
        refetchCollections,
        createCollectionMutation,
        updateCollectionMutation,
        deleteCollectionMutation,
        selectCollectionMutation,
    } = useCollection()

    useEffect(() => {
        setLoading(true)
        refetchCollections()
            .then((list) => {
                const selected = list.data?.find((collection) => collection.is_selected)
                setSelectedId(selected?.id ?? null)
            })
            .catch((reason) => CustomToast.error(reason))
            .finally(() => setLoading(false))
    }, [refetchCollections])

    const updateCollectionList = (updater: (collections: Collection[]) => Collection[]) => {
        queryClient.setQueryData<Collection[]>(["collection", "list"], updater)
    }

    const handleBrowseFile = async () => {
        const path = await pickFilePath()
        if (path) setNewFilePath(path)
    }

    const handleAdd = async () => {
        if (!newName.trim()) return
        try {
            const created = await createCollectionMutation.mutateAsync({name: newName.trim(), path: newFilePath})
            updateCollectionList((items) => [created, ...items])
            setNewName("")
            setNewFilePath("")
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to create collection")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteCollectionMutation.mutateAsync(id)
            updateCollectionList((items) => items.filter((item) => item.id !== id))
            if (selectedId === id) setSelectedId(null)
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to delete collection")
        }
    }

    const handleRowClick = async (id: string) => {
        try {
            await selectCollectionMutation.mutateAsync(id)
            updateCollectionList((items) => items.map((item) => ({...item, is_selected: item.id === id})))
            setSelectedId(id)
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to select collection")
        }
    }

    const handleBrowseRowFile = async (id: string) => {
        const path = await pickFilePath()
        if (!path) return
        try {
            await updateCollectionMutation.mutateAsync({id, data: {path}})
            updateCollectionList((items) => items.map((item) => item.id === id ? {...item, path} : item))
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to update collection")
        }
    }

    return <>
        <div className="flex-1 overflow-auto rounded-lg border border-slate-200">
            <div className="grid grid-cols-12 bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                <span className="col-span-1"/>
                <span className="col-span-4">Collection Name</span>
                <span className="col-span-5">File Path</span>
                <span className="col-span-2"/>
            </div>
            {loading ? (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Loading...</div>
            ) : collections.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-slate-400">No collections yet. Add one below.</div>
            ) : collections.map((collection) => (
                <div key={collection.id}
                     className={cn("grid grid-cols-12 border-t border-slate-200 px-3 py-2 items-center cursor-pointer", selectedId === collection.id && "bg-indigo-50")}
                     onClick={() => handleRowClick(collection.id)}>
                    <div className="col-span-1 flex justify-center">
                        <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", selectedId === collection.id ? "border-indigo-600" : "border-slate-300")}>
                            {selectedId === collection.id && <div className="h-2 w-2 rounded-full bg-indigo-600"/>}
                        </div>
                    </div>
                    <span className="col-span-4 text-sm font-medium text-slate-700">{collection.name}</span>
                    <span className="col-span-5 text-sm text-slate-500 truncate">{collection.path || "(no file)"}</span>
                    <div className="col-span-2 flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(event) => { event.stopPropagation(); handleBrowseRowFile(collection.id) }}>
                            <FileUp className="h-4 w-4"/>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={(event) => { event.stopPropagation(); handleDelete(collection.id) }}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            ))}
        </div>
        <div className="shrink-0 pt-3">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Collection name" className="flex-1"/>
                    <Button variant="outline" size="sm" onClick={handleBrowseFile}><FileUp className="h-4 w-4 mr-1"/> Browse</Button>
                    <Button variant="outline" size="sm" onClick={handleAdd}><Plus className="h-4 w-4 mr-1"/> Add</Button>
                </div>
                {newFilePath && <p className="text-xs text-slate-500 truncate px-1">Path: {newFilePath}</p>}
            </div>
            {selectedId && <div className="flex items-center justify-end gap-2 pt-2 mt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" disabled={isPulling} onClick={() => pull().then(() => onOpenChange(false))}><ArrowDownToLine className="h-4 w-4 mr-1"/> Pull</Button>
                <Button variant="outline" size="sm" disabled={isPushing} onClick={() => push()}><ArrowUpFromLine className="h-4 w-4 mr-1"/> Push</Button>
            </div>}
        </div>
    </>
}

export default CollectionManage
