import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DeleteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  formUrl: string
}

export function DeleteFormDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  formUrl 
}: DeleteFormDialogProps) {
  const [confirmUrl, setConfirmUrl] = useState('')
  const [error, setError] = useState(false)

  const urlMatches = confirmUrl === formUrl

  const handleConfirm = () => {
    if (urlMatches) {
      onConfirm()
      onOpenChange(false)
      setConfirmUrl('')
      setError(false)
    } else {
      setError(true)
    }
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setConfirmUrl('')
      setError(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Form</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the form
            and all of its feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>
              Please type <span className="font-bold">{formUrl}</span> to confirm
            </Label>
            <Input
              value={confirmUrl}
              onChange={(e) => {
                setConfirmUrl(e.target.value)
                setError(false)
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>The URL you entered doesn't match</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!urlMatches}
          >
            Delete Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}