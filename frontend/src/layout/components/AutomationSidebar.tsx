import {FileCode2, Trash2, Wrench} from "lucide-react"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {deleteAutomationFile, openAutomationTab, selectAutomationFiles} from "@/app/slices/automationSlice.ts"
import {selectActiveTabId, setActiveTabId} from "@/app/slices/collectionSlices.ts"
import {toAutomationTabId} from "@/lib/tabUtils.ts"
import {cn} from "@/lib/utils.ts"

const AutomationSidebar: React.FC<{searchQuery: string}> = ({searchQuery}) => {
  const dispatch = useAppDispatch()
  const files = useAppSelector(selectAutomationFiles)
  const activeTabId = useAppSelector(selectActiveTabId)
  const filteredFiles = files.filter(file => file.filename.toLowerCase().includes(searchQuery.toLowerCase()))

  const openFile = (id: string) => {
    dispatch(openAutomationTab(id))
    dispatch(setActiveTabId({id: toAutomationTabId(id)}))
  }

  const status = (file: typeof files[number]) => {
    if (file.lastRunStatus === 'passed') return <span className="text-emerald-600">passed</span>
    if (file.lastRunStatus === 'failed') return <span className="text-rose-600">failed</span>
    if (file.lastRunStatus === 'check') return <span className="text-amber-600">check</span>
    return <span className="text-slate-400">unrun</span>
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2">
        <Wrench className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Automation ({files.length})
        </span>
      </div>
      <div className="py-1">
        {filteredFiles.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            No playbooks found. Add `.yml` or `.yaml` files to `automation/`.
          </div>
        ) : filteredFiles.map(file => {
          const tabId = toAutomationTabId(file.id)
          const isActive = activeTabId === tabId
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => openFile(file.id)}
              className={cn(
                'group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100',
                isActive && 'bg-violet-100',
              )}
            >
              <FileCode2 className={cn('h-4 w-4 shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')} />
              <span className="min-w-0 flex-1 truncate text-slate-700">{file.filename}</span>
              <span className="text-[10px] font-semibold">{status(file)}</span>
              {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" title="Open playbook" />}
              <span
                role="button"
                title="Delete playbook"
                onClick={event => {
                  event.stopPropagation()
                  if (confirm(`Delete ${file.filename}?`)) dispatch(deleteAutomationFile(file.filename))
                }}
                className="shrink-0 p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AutomationSidebar
