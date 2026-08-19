import {ChevronDown, ChevronRight, FileCode2, FileText, Trash2, Wrench} from "lucide-react"
import {useState} from "react"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  deleteAutomationFile,
  deleteAutomationInventory,
  defaultAutomationConfig,
  openAutomationInventoryTab,
  openAutomationTab,
  selectAutomationFiles,
  selectAutomationInventories,
} from "@/app/slices/automationSlice.ts"
import {selectActiveTabId, setActiveTabId} from "@/app/slices/collectionSlices.ts"
import {toAutomationInventoryTabId, toAutomationTabId} from "@/lib/tabUtils.ts"
import {cn} from "@/lib/utils.ts"

const AutomationSidebar: React.FC<{searchQuery: string}> = ({searchQuery}) => {
  const dispatch = useAppDispatch()
  const files = useAppSelector(selectAutomationFiles)
  const inventories = useAppSelector(selectAutomationInventories)
  const configs = useAppSelector(state => state.automation.configs)
  const activeTabId = useAppSelector(selectActiveTabId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const query = searchQuery.toLowerCase()

  const openFile = (id: string) => {
    dispatch(openAutomationTab(id))
    dispatch(setActiveTabId({id: toAutomationTabId(id)}))
  }

  const openInventory = (filename: string) => {
    dispatch(openAutomationInventoryTab(filename))
    dispatch(setActiveTabId({id: toAutomationInventoryTabId(filename)}))
  }

  const status = (file: typeof files[number]) => {
    if (file.lastRunStatus === 'passed') return <span className="text-emerald-600">passed</span>
    if (file.lastRunStatus === 'failed') return <span className="text-rose-600">failed</span>
    if (file.lastRunStatus === 'check') return <span className="text-amber-600">check</span>
    return <span className="text-slate-400">unrun</span>
  }

  const visibleFiles = files.filter(file => {
    const config = configs[file.id] ?? defaultAutomationConfig()
    return file.filename.toLowerCase().includes(query) || config.inventoryFiles.some(name => name.toLowerCase().includes(query))
  })

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2">
        <Wrench className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Automation ({files.length})
        </span>
      </div>
      <div className="py-1">
        {visibleFiles.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            No playbooks found. Add `.yml` or `.yaml` files to `automation/`.
          </div>
        ) : visibleFiles.map(file => {
          const tabId = toAutomationTabId(file.id)
          const isActive = activeTabId === tabId
          const config = configs[file.id] ?? defaultAutomationConfig()
          const attached = config.inventoryFiles
            .map(filename => inventories.find(inventory => inventory.filename === filename))
            .filter((inventory): inventory is typeof inventories[number] => Boolean(inventory))
          const childMatches = attached.some(inventory => inventory.filename.toLowerCase().includes(query))
          const isExpanded = Boolean(expanded[file.id] || (query && childMatches))

          return (
            <div key={file.id} className="space-y-0.5">
              <div className={cn('group flex w-full items-center rounded-md', isActive && 'bg-violet-100')}>
                <button
                  type="button"
                  aria-label={isExpanded ? `Collapse ${file.filename}` : `Expand ${file.filename}`}
                  onClick={() => setExpanded(previous => ({...previous, [file.id]: !isExpanded}))}
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => openFile(file.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-slate-100"
                >
                  <FileCode2 className={cn('h-4 w-4 shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{file.filename}</span>
                  <span className="text-[10px] font-semibold">{status(file)}</span>
                  {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" title="Open playbook" />}
                </button>
                <button
                  type="button"
                  title="Delete playbook"
                  onClick={() => {
                    if (confirm(`Delete ${file.filename}?`)) dispatch(deleteAutomationFile(file.filename))
                  }}
                  className="shrink-0 p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {isExpanded && attached.length > 0 && (
                <div className="ml-7 space-y-0.5 border-l border-violet-100 pl-2">
                  {attached.map(inventory => {
                    const inventoryTabId = toAutomationInventoryTabId(inventory.filename)
                    const inventoryActive = activeTabId === inventoryTabId
                    return (
                      <div key={inventory.id} className={cn('group flex items-center rounded-md', inventoryActive && 'bg-amber-50')}>
                        <button
                          type="button"
                          onClick={() => openInventory(inventory.filename)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-slate-100"
                        >
                          <FileText className={cn('h-3.5 w-3.5 shrink-0', inventoryActive ? 'text-amber-600' : 'text-slate-400')} />
                          <span className="min-w-0 flex-1 truncate text-slate-600">{inventory.filename}</span>
                          {inventoryActive && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                        </button>
                        <button
                          type="button"
                          title="Delete inventory"
                          onClick={() => {
                            if (confirm(`Delete ${inventory.filename}?`)) dispatch(deleteAutomationInventory(inventory.filename))
                          }}
                          className="shrink-0 p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AutomationSidebar
