import {useEffect} from "react"
import {FileText, Save} from "lucide-react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  fetchAutomationInventoryContent,
  saveAutomationInventory,
  selectActiveAutomationInventory,
  selectAutomationInventoryUnsaved,
} from "@/app/slices/automationSlice.ts"

const InventoryEditorHeader: React.FC = () => {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectActiveAutomationInventory)
  const unsaved = useAppSelector(state => file ? selectAutomationInventoryUnsaved(state, file.id) : false)
  const fileName = file?.filename
  const fileContent = file?.content

  useEffect(() => {
    if (!fileName || fileContent) return
    dispatch(fetchAutomationInventoryContent(fileName))
  }, [dispatch, fileContent, fileName])

  if (!file) return null

  const save = async () => {
    try {
      await dispatch(saveAutomationInventory({filename: file.filename, content: file.content ?? ''})).unwrap()
      toast.success('Inventory saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Inventory save failed')
    }
  }

  return (
    <div className="basis-3/4 flex min-w-0 items-center h-full gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{file.filename}</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">automation/inventory/{file.filename}</span>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button onClick={save} disabled={!unsaved} className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
          <Save className="h-4 w-4 mr-2" /> Save Inventory
        </Button>
      </div>
    </div>
  )
}

export default InventoryEditorHeader
