import {AlertTriangle, Loader2} from "lucide-react"
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  selectActiveAutomationInventory,
  updateAutomationInventoryContent,
} from "@/app/slices/automationSlice.ts"

const InventoryEditor: React.FC = () => {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectActiveAutomationInventory)

  if (!file) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Select an inventory from the sidebar</div>
  }

  const updateSource = (value: string) => {
    dispatch(updateAutomationInventoryContent({id: file.id, content: value}))
  }

  return (
    <div className="space-y-4 p-4">
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
          value={file.content ?? ''}
          onChange={updateSource}
          fileName={file.filename}
          editorKey={file.id}
        />
      </section>
    </div>
  )
}

export default InventoryEditor
