import {useEffect, useState} from "react"
import {AlertTriangle, FileText, Loader2, Save, Trash2} from "lucide-react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button.tsx"
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  deleteAutomationInventory,
  fetchAutomationInventoryContent,
  saveAutomationInventory,
  selectActiveAutomationInventory,
  selectAutomationInventoryUnsaved,
  updateAutomationInventoryContent,
} from "@/app/slices/automationSlice.ts"
import {setActiveTabId} from "@/app/slices/collectionSlices.ts"

const InventoryEditor: React.FC = () => {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectActiveAutomationInventory)
  const unsaved = useAppSelector(state => file ? selectAutomationInventoryUnsaved(state, file.id) : false)
  const [content, setContent] = useState('')
  const fileId = file?.id
  const fileName = file?.filename
  const fileContent = file?.content

  useEffect(() => {
    if (!fileId || !fileName) return
    if (!fileContent) dispatch(fetchAutomationInventoryContent(fileName))
    setContent(fileContent ?? '')
  }, [dispatch, fileContent, fileId, fileName])

  if (!file) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Select an inventory from the sidebar</div>
  }

  const updateSource = (value: string) => {
    setContent(value)
    dispatch(updateAutomationInventoryContent({id: file.id, content: value}))
  }

  const save = async () => {
    try {
      await dispatch(saveAutomationInventory({filename: file.filename, content})).unwrap()
      toast.success('Inventory saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Inventory save failed')
    }
  }

  const remove = async () => {
    if (!confirm(`Delete ${file.filename}?`)) return
    try {
      await dispatch(deleteAutomationInventory(file.filename)).unwrap()
      dispatch(setActiveTabId({id: ''}))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Inventory deletion failed')
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{file.filename}</span>
              {unsaved && <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Unsaved</span>}
            </div>
            <span className="font-mono text-[10px] text-slate-400">automation/inventory/{file.filename}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={remove} className="text-xs text-rose-600 hover:text-rose-700">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" onClick={save} disabled={!unsaved} className="bg-amber-600 text-xs text-white hover:bg-amber-700">
            <Save className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>Inventory content is passed directly to Ansible. Keep the format consistent with the file extension and review host variables before running a playbook.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory source</div>
          {!file.content && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        <SandpackScriptEditor
          value={content}
          onChange={updateSource}
          fileName={file.filename}
          editorKey={file.id}
        />
      </section>
    </div>
  )
}

export default InventoryEditor
