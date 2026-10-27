import React from "react"
import {FolderGit2} from "lucide-react"

const TestScenarioSidebar: React.FC<{searchQuery: string}> = () => {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 border-b border-sidebar-border px-2 py-2">
        <FolderGit2 className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Test Suites (0)
        </span>
      </div>
      <div className="py-1">
        <div className="px-4 py-8 text-center text-xs text-slate-400">
          No suites found. Test suite state is not connected yet.
        </div>
      </div>
    </div>
  )
}

export default TestScenarioSidebar
