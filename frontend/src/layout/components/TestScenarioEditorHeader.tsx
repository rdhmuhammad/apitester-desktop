import {useState} from "react"
import {Code, Layers, Play, Plus, Settings} from "lucide-react"
import {Button} from "@/components/ui/button.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {

  selectActiveScenario,
  selectHasUnsavedChanges,
  selectIsRunning,
  selectViewMode,
  setViewMode,
  updateScenarioSteps,
} from "@/app/slices/testScenarioSlice.ts"
import {useTestRunner} from "@/layout/hooks/useTestRunner.ts"
import type {TestStep} from "@/pages/editor/types/testScenario.ts"
import EnvironmentVariablesDialog from "@/pages/editor/components/EnvironmentVariablesDialog.tsx"

const TestScenarioEditorHeader: React.FC = () => {
  const dispatch = useAppDispatch()
  const scenario = useAppSelector(selectActiveScenario)
  const isRunning = useAppSelector(selectIsRunning)
  const hasUnsavedChanges = useAppSelector(selectHasUnsavedChanges)
  const viewMode = useAppSelector(selectViewMode)
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const {run: runTests} = useTestRunner()

  if (!scenario) return null

  const handleAddStep = () => {
    const steps = scenario.steps ?? []
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1} — New Request`,
      method: 'GET',
      url: '{{baseUrl}}/resource',
      headers: [{key: 'Content-Type', value: 'application/json'}],
      body: '',
      assertions: [{id: `ast-${Date.now()}`, expression: 'response.status === 200'}],
      captures: [],
    }
    dispatch(updateScenarioSteps({id: scenario.id, steps: [...steps, newStep]}))
  }

  const handleViewRaw = () => {
    dispatch(setViewMode(viewMode === 'visual' ? 'raw' : 'visual'))
  }

  return (
    <>
      <div className="basis-3/4 flex min-w-0 items-center h-full gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Layers className="h-5 w-5 shrink-0 text-indigo-600"/>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{scenario.name}</span>
              {hasUnsavedChanges && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                  Unsaved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-400">tests/{scenario.filename}</span>
              <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                {scenario.steps.length} step{scenario.steps.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleViewRaw} className="text-xs whitespace-nowrap">
            <Code className="w-4 h-4 mr-1"/>
            {viewMode === 'visual' ? 'View Raw' : 'Visual'}
          </Button>
          <Button variant="outline" onClick={() => setEnvDialogOpen(true)} className="text-xs whitespace-nowrap">
            <Settings className="w-4 h-4 mr-1"/>
            Variables
          </Button>
          <Button variant="outline"  onClick={handleAddStep} className="text-xs whitespace-nowrap">
            <Plus className="w-4 h-4 mr-1"/>
            Add Step
          </Button>
          <Button  onClick={runTests} disabled={isRunning}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
            <Play className="w-4 h-4 mr-1"/>
            Run All
          </Button>
        </div>
      </div>
      <EnvironmentVariablesDialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}/>
    </>
  )
}

export default TestScenarioEditorHeader
