import {FileText, CheckCircle2, XCircle, Trash2, FolderGit2} from "lucide-react"
import {toTestTabId} from "@/lib/tabUtils.ts"
import {cn} from "@/lib/utils.ts"

const TestScenarioSidebar: React.FC<{searchQuery: string}> = ({searchQuery}) => {
  const scenarios: Array<{
    id: string
    name: string
    filename: string
    totalSteps?: number
    lastRunStatus?: 'passed' | 'failed' | 'unrun'
  }> = []
  const activeTabId = ''
  const hasUnsavedChanges = false
  const handleSelectScenario = (id: string) => { void id }
  const handleDeleteScenario = (id: string) => { void id }
  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scenario.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2">
        <FolderGit2 className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Test Suites ({scenarios.length})
        </span>
      </div>
      <div className="py-1">
        {filteredScenarios.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            No suites found. Test suite state is not connected yet.
          </div>
        ) : filteredScenarios.map((scenario) => {
          const isActive = activeTabId === toTestTabId(scenario.id)
          const stepCount = scenario.totalSteps || 0
          return (
            <button key={scenario.id} type="button" onClick={() => handleSelectScenario(scenario.id)}
                    className={cn('group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100', isActive && 'bg-indigo-100')}>
              {scenario.lastRunStatus === 'passed' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
              {scenario.lastRunStatus === 'failed' && <XCircle className="h-4 w-4 text-rose-600 shrink-0" />}
              {(!scenario.lastRunStatus || scenario.lastRunStatus === 'unrun') && <FileText className={cn('h-4 w-4 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />}
              <span className="capitalize flex-1 truncate text-slate-700">{scenario.name}</span>
              <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{stepCount} step{stepCount === 1 ? '' : 's'}</span>
              {isActive && hasUnsavedChanges && <span className="ml-auto h-2 w-2 rounded-full bg-orange-400 shrink-0" title="Unsaved changes" />}
              {scenarios.length > 1 && (
                <span onClick={(event) => { event.stopPropagation(); handleDeleteScenario(scenario.id) }} role="button"
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition shrink-0" title="Delete Scenario">
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TestScenarioSidebar
