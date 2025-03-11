import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { FormCreator } from './form-creator'
import { InstallInstructionsModal } from './install-instructions-modal'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

interface NewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFormSelect: (formId: string) => void
}

export function NewFormDialog({ open, onOpenChange, onFormSelect }: NewFormDialogProps) {
  const [formId, setFormId] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const navigate = useNavigate()

  const handleFormCreated = (newFormId: string) => {
    setFormId(newFormId)
    setShowInstructions(true)
    onFormSelect(newFormId)
    navigate(`/forms/${newFormId}`)
  }

  const handleInstructionsClose = () => {
    setFormId(null)
    setShowInstructions(false)
    onOpenChange(false)
  }

  return (
    <>
    <Dialog 
      open={open && !showInstructions} 
      onOpenChange={(open) => {
        if (!open && !showInstructions) {
          onOpenChange(false)
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
        </DialogHeader>
        <FormCreator onFormCreated={handleFormCreated} />
      </DialogContent>
    </Dialog>

    {formId && (
      <InstallInstructionsModal
        formId={formId}
        open={showInstructions}
        onOpenChange={(open) => {
          if (!open) {
            handleInstructionsClose()
          }
        }}
      />
    )}
    </>
  )
}