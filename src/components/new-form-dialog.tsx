import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { FormCreator } from './form-creator'

interface NewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewFormDialog({ open, onOpenChange }: NewFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
        </DialogHeader>
        <FormCreator />
      </DialogContent>
    </Dialog>
  )
}