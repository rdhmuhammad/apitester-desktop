import {useEffect} from "react"
import {FileCode2, Loader2, Play} from "lucide-react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  fetchAutomationContent,
  runAutomation,
  saveAutomationConfig,
  saveAutomationFile,
  selectActiveAutomation,
  selectAutomationConfig,
  selectAutomationRuntime,
  selectAutomationRunningId,
  selectAutomationUnsaved,
} from "@/app/slices/automationSlice.ts"
import {ANSIBLE_CATALOG_VERSION} from "@/lib/ansibleCompletions.ts"

const AutomationEditorHeader: React.FC = () => {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectActiveAutomation)
  const runtime = useAppSelector(selectAutomationRuntime) ?? {
    available: false,
    name: 'Managed Ansible runner',
    message: 'Runtime health is unavailable until a collection is loaded.',
  }
  const unsaved = useAppSelector(state => file ? selectAutomationUnsaved(state, file.id) : false)
  const config = useAppSelector(state => file ? selectAutomationConfig(state, file.id) : null)
  const runningId = useAppSelector(selectAutomationRunningId)
  const fileId = file?.id
  const fileContent = file?.content
  const isRunning = runningId === file?.id

  useEffect(() => {
    if (!fileId || fileContent) return
    dispatch(fetchAutomationContent(fileId))
  }, [dispatch, fileContent, fileId])

  if (!file || !config) return null

  const run = async () => {
    try {
      if (unsaved) await dispatch(saveAutomationFile({filename: file.filename, content: file.content ?? ''})).unwrap()
      await dispatch(saveAutomationConfig({id: file.id, config})).unwrap()
      await dispatch(runAutomation({id: file.id, filename: file.filename, config})).unwrap()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Playbook run failed')
    }
  }

  return (
    <div className="basis-3/4 flex min-w-0 items-center h-full gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileCode2 className="h-5 w-5 shrink-0 text-violet-600" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{file.filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400">automation/{file.filename}</span>
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">{ANSIBLE_CATALOG_VERSION}</span>
          </div>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button onClick={run} disabled={!runtime.available || isRunning} className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
          {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />} {isRunning ? 'Running…' : 'Run Playbook'}
        </Button>
      </div>
    </div>
  )
}

export default AutomationEditorHeader
