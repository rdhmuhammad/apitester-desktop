import {useState} from "react"
import {
  BookOpen,
  Check,
  Code2,
  ExternalLink,
  FilePlus2,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  Trash2
} from "lucide-react"
import {Button} from "@/components/ui/button.tsx"
import {SandpackScriptEditor} from "@/components/ui/sandpack-script-editor.tsx"
import {cn} from "@/lib/utils.ts"
import PromptDialog from "@/components/common/PromptDialog.tsx"
import {ansibleCompletionSource, YAML_SYNTAX_DOCS} from "@/lib/ansibleCompletions.ts"

const AutomationEditor: React.FC = () => {
    type AutomationFile = {id: string; filename: string; content?: string; lastRunStatus?: string}
    type AutomationConfig = {inventoryFiles: string[]; inventoryFile: string; limit: string; tags: string; extraVars: string; checkMode: boolean; diffMode: boolean}
    const getEmptyFile = (): AutomationFile | null => null
    const getEmptyConfig = (): AutomationConfig | null => null
    const file = getEmptyFile()
    const config = getEmptyConfig()
    const inventories: Array<{id: string; filename: string}> = []
    const [inventoryPromptOpen, setInventoryPromptOpen] = useState(false)
    if (!file || !config) {
        return <div className="flex items-center justify-center py-20 text-sm text-slate-400">Select a playbook from the
            sidebar</div>
    }

    const updateConfig = (value: Partial<typeof config>) => {
        void value
    }

    const updateSource = (value: string) => {
        void value
    }

    const persistConfig = async (nextConfig: typeof config) => {
        void nextConfig
    }

    const handleCreateInventory = async (filename: string) => {
        void filename
    }

    const attachInventory = (filename: string) => {
        if (!filename || config.inventoryFiles.includes(filename)) return
        const nextConfig = {
            ...config,
            inventoryFiles: [...config.inventoryFiles, filename],
            inventoryFile: config.inventoryFile || filename,
        }
        updateConfig(nextConfig)
        void persistConfig(nextConfig)
    }

    const detachInventory = (filename: string) => {
        const nextConfig = {
            ...config,
            inventoryFiles: config.inventoryFiles.filter(item => item !== filename),
            inventoryFile: config.inventoryFile === filename ? '' : config.inventoryFile,
        }
        updateConfig(nextConfig)
        void persistConfig(nextConfig)
    }

    const statusBadge = () => {
        switch (file.lastRunStatus) {
            case 'running':
                return <span
                    className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700"><Loader2
                    className="h-3 w-3 animate-spin"/> RUNNING</span>
            case 'passed':
                return <span
                    className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">PASSED</span>
            case 'check':
                return <span
                    className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">CHECK</span>
            case 'failed':
                return <span
                    className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">FAILED</span>
            case 'canceled':
                return <span
                    className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">CANCELED</span>
            default:
                return <span
                    className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">UNRUN</span>
        }
    }

    return (
        <div className="space-y-4 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Code2 className="h-4 w-4 text-violet-500"/> YAML playbook
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span>Ansible source of truth</span>
                            <a href={YAML_SYNTAX_DOCS} target="_blank" rel="noreferrer"
                               className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700">
                                <BookOpen className="h-3 w-3"/> YAML help <ExternalLink className="h-3 w-3"/>
                            </a>
                        </div>
                        <PromptDialog
                            open={inventoryPromptOpen}
                            title="Inventory filename"
                            defaultValue="inventory-1.ini"
                            submitLabel="Create"
                            onCancel={() => setInventoryPromptOpen(false)}
                            onSubmit={(name) => {
                                setInventoryPromptOpen(false)
                                void handleCreateInventory(name)
                            }}
                        />
                    </div>
                    <div className="min-h-0 flex-1">
                        <SandpackScriptEditor
                            value={file.content ?? ''}
                            onChange={updateSource}
                            fileName={file.filename}
                            editorKey={file.id}
                            completionSources={[ansibleCompletionSource]}
                            className="h-full"
                        />
                    </div>
                </section>

                <div className="space-y-4">
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-violet-600"/>
                            <h3 className="flex-1 text-sm font-semibold text-slate-900">Run configuration</h3>
                            <Button variant="ghost" size="sm" onClick={() => void persistConfig(config)}
                                    className="h-7 px-2 text-[11px] text-violet-700">
                                <Save className="mr-1 h-3 w-3"/> Save defaults
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-600">Inventory file</label>
                                    <Button variant="ghost" size="sm" onClick={() => setInventoryPromptOpen(true)}
                                            className="h-6 px-1.5 text-[11px] text-amber-700">
                                        <FilePlus2 className="mr-1 h-3 w-3"/> New inventory
                                    </Button>
                                </div>
                                <select
                                    value={config.inventoryFile}
                                    onChange={event => {
                                        const nextConfig = {...config, inventoryFile: event.target.value}
                                        updateConfig(nextConfig)
                                        void persistConfig(nextConfig)
                                    }}
                                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
                                >
                                    <option value="">No inventory</option>
                                    {config.inventoryFiles.map(filename => <option key={filename}
                                                                                   value={filename}>{filename}</option>)}
                                </select>
                                <div className="flex flex-wrap gap-1.5">
                                    {config.inventoryFiles.map(filename => (
                                        <span key={filename}
                                              className={cn('inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600', config.inventoryFile === filename && 'bg-amber-100 text-amber-800')}>
                      {filename}
                                            <button type="button" title={`Detach ${filename}`}
                                                    onClick={() => detachInventory(filename)}
                                                    className="text-slate-400 hover:text-rose-600">
                        <Trash2 className="h-3 w-3"/>
                      </button>
                    </span>
                                    ))}
                                </div>
                                {inventories.some(inventory => !config.inventoryFiles.includes(inventory.filename)) && (
                                    <select
                                        value=""
                                        onChange={event => attachInventory(event.target.value)}
                                        className="h-8 w-full rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 text-xs text-slate-600 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
                                    >
                                        <option value="">Attach existing inventory…</option>
                                        {inventories.filter(inventory => !config.inventoryFiles.includes(inventory.filename)).map(inventory =>
                                            <option key={inventory.filename}
                                                    value={inventory.filename}>{inventory.filename}</option>)}
                                    </select>
                                )}
                            </div>
                            <label className="block text-xs font-medium text-slate-600">Limit<input value={config.limit}
                                                                                                    onChange={event => updateConfig({limit: event.target.value})}
                                                                                                    placeholder="web:&staging"
                                                                                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"/></label>
                            <label className="block text-xs font-medium text-slate-600">Tags<input value={config.tags}
                                                                                                   onChange={event => updateConfig({tags: event.target.value})}
                                                                                                   placeholder="deploy,configure"
                                                                                                   className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs font-mono outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"/></label>
                            <div>
                                <label className="block text-xs font-medium text-slate-600">Extra vars (JSON)</label>
                                <div className="mt-1 h-32 min-h-0 overflow-hidden rounded-md">
                                    <SandpackScriptEditor
                                        value={config.extraVars}
                                        onChange={value => updateConfig({extraVars: value})}
                                        fileName="extra-vars.json"
                                        editorKey={`${file.id}-extra-vars`}
                                        className="h-full"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox"
                                                                                                     checked={config.checkMode}
                                                                                                     onChange={event => updateConfig({checkMode: event.target.checked})}
                                                                                                     className="accent-violet-600"/><ShieldCheck
                                className="h-3.5 w-3.5 text-emerald-600"/> Check mode (safe preview)</label>
                            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox"
                                                                                                     checked={config.diffMode}
                                                                                                     onChange={event => updateConfig({diffMode: event.target.checked})}
                                                                                                     className="accent-violet-600"/> Show
                                diff</label>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                            <h3 className="text-sm font-semibold text-slate-900">Last run</h3>
                            {statusBadge()}
                        </div>
                        <div className={cn('space-y-3 p-4 text-xs text-slate-500', 'bg-slate-50')}>
                                <div className="flex items-center gap-2"><Check
                                    className="h-4 w-4 text-slate-300"/> Playbook output will appear here after the
                                    managed runner is ready.
                                </div>
                                <div
                                    className="rounded-lg border border-dashed border-slate-200 p-3 font-mono text-[10px] text-slate-400">PLAY
                                    RECAP · no execution yet
                                </div>
                        </div>
                    </section>
                </div>
            </div>
            <PromptDialog
                open={inventoryPromptOpen}
                title="Inventory filename"
                defaultValue="inventory-1.ini"
                submitLabel="Create"
                onCancel={() => setInventoryPromptOpen(false)}
                onSubmit={(name) => {
                    setInventoryPromptOpen(false)
                    void handleCreateInventory(name)
                }}
            />
        </div>
    )
}

export default AutomationEditor
