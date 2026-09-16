import {useState} from "react"
import {Code, Layers, Play, Plus, Settings} from "lucide-react"
import {Button} from "@/components/ui/button.tsx"
import EnvironmentVariablesDialog from "@/pages/editor/components/EnvironmentVariablesDialog.tsx"

const TestScenarioEditorHeader: React.FC = () => {
  const scenario = {name: '', filename: '', steps: [] as unknown[]}
  const isRunning = false
  const hasUnsavedChanges = false
  const viewMode = 'visual'
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const handleAddStep = () => {}
  const handleViewRaw = () => {}

  return (
    <>
      <div className="basis-3/4 flex min-w-0 items-center h-full gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Layers className="h-5 w-5 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{scenario.name}</span>
              {hasUnsavedChanges && <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">Unsaved</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">tests/{scenario.filename}</span>
              <span className="shrink-0 rounded bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">{scenario.steps.length} steps</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleViewRaw} className="text-xs whitespace-nowrap"><Code className="w-4 h-4 mr-1" />{viewMode === 'visual' ? 'View Raw' : 'Visual'}</Button>
          <Button variant="outline" onClick={() => setEnvDialogOpen(true)} className="text-xs whitespace-nowrap"><Settings className="w-4 h-4 mr-1" />Variables</Button>
          <Button variant="outline" onClick={handleAddStep} className="text-xs whitespace-nowrap"><Plus className="w-4 h-4 mr-1" />Add Step</Button>
          <Button onClick={() => {}} disabled={isRunning} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Play className="w-4 h-4 mr-1" />Run All</Button>
        </div>
      </div>
      <EnvironmentVariablesDialog open={envDialogOpen} onOpenChange={setEnvDialogOpen} />
    </>
  )
}

export default TestScenarioEditorHeader
