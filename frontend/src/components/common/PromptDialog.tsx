import {useEffect, useState} from "react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"

interface PromptDialogProps {
  open: boolean
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  submitLabel?: string
  cancelLabel?: string
  onCancel: () => void
  onSubmit: (value: string) => void
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  description,
  defaultValue = "",
  placeholder,
  submitLabel = "OK",
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
}) => {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit()
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PromptDialog
