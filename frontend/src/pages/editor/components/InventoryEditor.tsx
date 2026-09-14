import {AlertTriangle, Loader2} from "lucide-react"
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx"
const InventoryEditor: React.FC = () => {
  const getEmptyFile = (): {id: string; filename: string; content?: string} | null => null
  const file = getEmptyFile()

  if (!file) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Select an inventory from the sidebar</div>
  }

  const updateSource = (value: string) => {
    void value
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>Inventory content is passed directly to Ansible. Keep the format consistent with the file extension and review host variables before running a playbook.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
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
