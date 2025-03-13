import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { FormCreator } from './form-creator'
import { InstallInstructionsModal } from './install-instructions-modal'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog'
import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'

interface NewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFormSelect: (formId: string) => void
}

export function NewFormDialog({ open, onOpenChange, onFormSelect }: NewFormDialogProps) {
  const [formId, setFormId] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false)
  const hasUnsavedChangesRef = useRef(false)
  const navigate = useNavigate()

  const handleOpenChange = (open: boolean) => {
    if (!open && hasUnsavedChangesRef.current) {
      setShowUnsavedChanges(true)
      return
    }
    onOpenChange(open)
  }

  const handleDiscardChanges = () => {
    setShowUnsavedChanges(false)
    hasUnsavedChangesRef.current = false
    onOpenChange(false)
  }

  const handleContinueEditing = () => {
    setShowUnsavedChanges(false)
  }

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
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Form</DialogTitle>
        </DialogHeader>
        <FormCreator 
          onFormCreated={handleFormCreated} 
          onFormChange={(hasChanges) => {
            hasUnsavedChangesRef.current = hasChanges
          }}
        />
      </DialogContent>
    </Dialog>

    <AlertDialog open={showUnsavedChanges} onOpenChange={setShowUnsavedChanges}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Are you sure you want to discard them?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleContinueEditing}>
            Continue Editing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscardChanges}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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