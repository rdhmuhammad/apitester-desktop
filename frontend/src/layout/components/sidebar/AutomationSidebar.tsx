import {Wrench} from "lucide-react"

const AutomationSidebar: React.FC<{searchQuery: string}> = () => {
  const files: never[] = []

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 border-b border-sidebar-border px-2 py-2">
        <Wrench className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Automation ({files.length})
        </span>
      </div>
      <div className="px-4 py-6 text-center text-xs text-slate-400">
        Automation state is not connected yet.
      </div>
    </div>
  )
}

export default AutomationSidebar
