import {FileCode2} from "lucide-react"

const AutomationEditorHeader: React.FC = () => {
  const file = {filename: ''}
  return <div className="basis-3/4 flex min-w-0 items-center h-full gap-3"><FileCode2 className="h-5 w-5 text-violet-600" /><span className="text-sm text-muted-foreground">{file.filename || 'Automation'}</span></div>
}

export default AutomationEditorHeader
