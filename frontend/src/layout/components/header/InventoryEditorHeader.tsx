import {FileText, Save} from "lucide-react"
import {Button} from "@/components/ui/button.tsx"

const InventoryEditorHeader: React.FC = () => {
  const file = {filename: ''}
  const unsaved = false
  const save = async () => {}
  return <div className="basis-3/4 flex min-w-0 items-center h-full gap-3"><FileText className="h-5 w-5 text-amber-600" /><span className="text-sm text-muted-foreground">{file.filename || 'Inventory'}</span><Button onClick={save} disabled={!unsaved}><Save className="h-4 w-4 mr-2" />Save Inventory</Button></div>
}

export default InventoryEditorHeader
