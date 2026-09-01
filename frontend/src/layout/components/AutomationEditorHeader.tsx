import {useEffect} from "react"
import {FileCode2} from "lucide-react"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  fetchAutomationContent,
  selectActiveAutomation,
  selectAutomationConfig,
} from "@/app/slices/automationSlice.ts"
import {ANSIBLE_CATALOG_VERSION} from "@/lib/ansibleCompletions.ts"

const AutomationEditorHeader: React.FC = () => {
  const dispatch = useAppDispatch()
  const file = useAppSelector(selectActiveAutomation)
  const config = useAppSelector(state => file ? selectAutomationConfig(state, file.id) : null)
  const fileId = file?.id
  const fileContent = file?.content

  useEffect(() => {
    if (!fileId || fileContent) return
    dispatch(fetchAutomationContent(fileId))
  }, [dispatch, fileId])

  if (!file || !config) return null

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
    </div>
  )
}

export default AutomationEditorHeader
