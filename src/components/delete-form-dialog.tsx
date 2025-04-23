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

interface DeleteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  productName: string
}

export function DeleteFormDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  productName 
}: DeleteFormDialogProps) {
  const [confirmProduct, setConfirmProduct] = useState('')
  const [error, setError] = useState(false)

  const productMatches = confirmProduct === productName

  const handleConfirm = () => {
    if (productMatches) {
      onConfirm()
      onOpenChange(false)
      setConfirmProduct('')
      setError(false)
    } else {
      setError(true)
    }
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setConfirmProduct('')
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
          <div className="grid gap-2 pb-2">
            <div className="text-sm">
              <span className="font-normal">Please type </span>
              <span className="font-medium select-text">{productName}</span>
              <span className="font-normal"> to confirm:</span>
            </div>
            <Input
              value={confirmProduct}
              onChange={(e) => {
                setConfirmProduct(e.target.value)
                setError(false)
              }}
              placeholder={productName}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>The product name you entered doesn't match</span>
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
            disabled={!productMatches}
          >
            Delete Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}