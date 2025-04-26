import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { FormCreator } from './form-creator'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog'
import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'

interface NewFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewFormDialog({ open, onOpenChange }: NewFormDialogProps) {
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
    console.log('NewFormDialog: handleFormCreated called with ID:', newFormId);
    
    // Set a flag in localStorage to indicate we're intentionally navigating to a new form
    // This will prevent the dashboard from overriding our navigation
    localStorage.setItem('userbird-navigating-to-new-form', newFormId);
    
    // Close dialog before navigation to prevent React state update issues
    onOpenChange(false);
    console.log('NewFormDialog: dialog closed');
    
    // Navigate to the new form
    navigate(`/forms/${newFormId}`);
    console.log('NewFormDialog: navigation triggered');
    
    // Clear the flag after a short timeout to allow the navigation to complete
    setTimeout(() => {
      localStorage.removeItem('userbird-navigating-to-new-form');
    }, 1000);
  }

  return (
    <>
    <Dialog 
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Workspace</DialogTitle>
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

    {/* InstallInstructionsModal intentionally not shown automatically after form creation */}
    </>
  )
}