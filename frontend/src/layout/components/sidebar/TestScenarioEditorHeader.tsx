import React from "react"
import {Layers} from "lucide-react"

const TestScenarioEditorHeader: React.FC = () => {
  return (
    <div className="basis-3/4 flex min-w-0 items-center h-full gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Layers className="h-5 w-5 shrink-0 text-indigo-600" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">Test Suite</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestScenarioEditorHeader
