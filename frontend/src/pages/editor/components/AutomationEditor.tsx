import {useEffect, useState} from "react"
import {AlertTriangle, BookOpen, Check, Code2, ExternalLink, FileCode2, Loader2, Play, Save, Settings2, ShieldCheck} from "lucide-react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button.tsx"
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx"
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts"
import {
  fetchAutomationContent,
  runAutomation,
  saveAutomationFile,
  selectActiveAutomation,
  selectAutomationConfig,
  selectAutomationRunningId,
  selectAutomationRunResult,
  selectAutomationRuntime,
  selectAutomationUnsaved,
  updateAutomationConfig,
  updateAutomationContent,
} from "@/app/slices/automationSlice.ts"
import {cn} from "@/lib/utils.ts"
import {ansibleCompletionSource, YAML_SYNTAX_DOCS, ANSIBLE_CATALOG_VERSION} from "@/lib/ansibleCompletions.ts"

const AutomationEditor: React.FC = () => {
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
  const runResult = useAppSelector(state => selectAutomationRunResult(state, file?.id ?? ''))
  const [content, setContent] = useState('')
  const fileId = file?.id
  const fileContent = file?.content

  useEffect(() => {
    if (!fileId) return
    if (!fileContent) dispatch(fetchAutomationContent(fileId))
    setContent(fileContent ?? '')
  }, [dispatch, fileContent, fileId])

  if (!file || !config) {
    return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Select a playbook from the sidebar</div>
  }

  const updateConfig = (value: Partial<typeof config>) => {
    dispatch(updateAutomationConfig({id: file.id, config: value}))
  }

  const updateSource = (value: string) => {
    setContent(value)
    dispatch(updateAutomationContent({id: file.id, content: value}))
  }

  const save = () => {
    dispatch(saveAutomationFile({filename: file.filename, content}))
  }

  const isRunning = runningId === file.id

  const run = async () => {
    try {
      if (unsaved) await dispatch(saveAutomationFile({filename: file.filename, content})).unwrap()
      await dispatch(runAutomation({id: file.id, filename: file.filename, config})).unwrap()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Playbook run failed')
    }
  }

  const statusBadge = () => {
    switch (file.lastRunStatus) {
      case 'running':
        return <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700"><Loader2 className="h-3 w-3 animate-spin" /> RUNNING</span>
      case 'passed':
        return <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">PASSED</span>
      case 'check':
        return <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">CHECK</span>
      case 'failed':
        return <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">FAILED</span>
      default:
        return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">UNRUN</span>
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <FileCode2 className="h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{file.filename}</span>
              {unsaved && <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Unsaved</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-400">automation/{file.filename}</span>
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">{ANSIBLE_CATALOG_VERSION}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={save} disabled={!unsaved} className="text-xs">
            <Save className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
          <Button size="sm" onClick={run} disabled={!runtime.available || isRunning} className="bg-violet-600 text-xs text-white hover:bg-violet-700">
            {isRunning ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} {isRunning ? 'Running…' : 'Run Playbook'}
          </Button>
        </div>
      </div>

      {!runtime.available && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Managed Ansible runner is not available</p>
            <p className="mt-1 text-amber-800">{runtime.message} You can still edit and save this playbook. Execution will be enabled when the backend runner is bundled.</p>
          </div>
        </div>
      )}

      {runtime.available && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-semibold">{runtime.name} is ready</p>
          <p className="mt-1 text-emerald-800">
            Ansible {runtime.version ?? 'unknown'}{runtime.pythonVersion ? ` · ${runtime.pythonVersion}` : ''}
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Code2 className="h-4 w-4 text-violet-500" /> YAML playbook
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span>Ansible source of truth</span>
              <a href={YAML_SYNTAX_DOCS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700">
                <BookOpen className="h-3 w-3" /> YAML help <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <SandpackScriptEditor
            value={content}
            onChange={updateSource}
            fileName={file.filename}
            editorKey={file.id}
            completionSources={[ansibleCompletionSource]}
          />
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-slate-900">Run configuration</h3>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">Inventory path<input value={config.inventoryPath} onChange={event => updateConfig({inventoryPath: event.target.value})} placeholder="inventory/staging" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400" /></label>
              <label className="block text-xs font-medium text-slate-600">Limit<input value={config.limit} onChange={event => updateConfig({limit: event.target.value})} placeholder="web:&staging" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400" /></label>
              <label className="block text-xs font-medium text-slate-600">Tags<input value={config.tags} onChange={event => updateConfig({tags: event.target.value})} placeholder="deploy,configure" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400" /></label>
              <label className="block text-xs font-medium text-slate-600">Extra vars (JSON)<textarea value={config.extraVars} onChange={event => updateConfig({extraVars: event.target.value})} className="mt-1 min-h-20 w-full rounded-md border border-slate-200 p-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400" /></label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={config.checkMode} onChange={event => updateConfig({checkMode: event.target.checked})} className="accent-violet-600" /><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Check mode (safe preview)</label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={config.diffMode} onChange={event => updateConfig({diffMode: event.target.checked})} className="accent-violet-600" /> Show diff</label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Last run</h3>
              {statusBadge()}
            </div>
            {!runtime.available ? (
              <div className={cn('space-y-3 p-4 text-xs text-slate-500', 'bg-slate-50')}>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-slate-300" /> Playbook output will appear here after the managed runner is ready.</div>
                <div className="rounded-lg border border-dashed border-slate-200 p-3 font-mono text-[10px] text-slate-400">PLAY RECAP · no execution yet</div>
              </div>
            ) : isRunning ? (
              <div className="space-y-3 p-4 text-xs text-slate-500">
                <div className="flex items-center gap-2 text-amber-700"><Loader2 className="h-4 w-4 animate-spin" /> Running ansible-playbook — output will appear when it finishes.</div>
                <div className="rounded-lg border border-dashed border-slate-200 p-3 font-mono text-[10px] text-slate-400">PLAY RECAP · running…</div>
              </div>
            ) : runResult ? (
              <div className="space-y-3 p-4 text-xs text-slate-500">
                {runResult.stdout && (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] text-slate-100">{runResult.stdout}</pre>
                )}
                {runResult.stderr && (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-3 font-mono text-[10px] text-rose-700">{runResult.stderr}</pre>
                )}
                {!runResult.stdout && !runResult.stderr && <div className="text-slate-400">No output captured.</div>}
                <div className="rounded-lg border border-dashed border-slate-200 p-3 font-mono text-[10px] text-slate-400">PLAY RECAP · {(runResult.durationMs / 1000).toFixed(1)}s</div>
              </div>
            ) : (
              <div className="space-y-3 p-4 text-xs text-slate-500">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-slate-300" /> Hit Run Playbook to execute this file against the active inventory.</div>
                <div className="rounded-lg border border-dashed border-slate-200 p-3 font-mono text-[10px] text-slate-400">PLAY RECAP · no execution yet</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default AutomationEditor
