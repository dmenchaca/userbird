import { useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DeleteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  productName: string
  userName?: string
}

export function DeleteFormDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  productName,
  userName = 'User'
}: DeleteFormDialogProps) {
  const [confirmProduct, setConfirmProduct] = useState('')
  const [error, setError] = useState(false)
  const [acknowledgements, setAcknowledgements] = useState({
    permanentDelete: false,
    includesWorkspace: false,
    cannotUndo: false
  })

  const productMatches = confirmProduct === productName
  const allAcknowledgementsChecked = Object.values(acknowledgements).every(value => value === true)
  const canDelete = productMatches && allAcknowledgementsChecked

  const handleConfirm = () => {
    if (canDelete) {
      onConfirm()
      onOpenChange(false)
      setConfirmProduct('')
      setError(false)
      resetAcknowledgements()
    } else {
      setError(true)
    }
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setConfirmProduct('')
      setError(false)
      resetAcknowledgements()
    }
  }

  const resetAcknowledgements = () => {
    setAcknowledgements({
      permanentDelete: false,
      includesWorkspace: false,
      cannotUndo: false
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Workspace</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the workspace
            and all of its data.
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

          <div className="space-y-4 mt-2">
            <div className="text-sm font-medium">
              {userName}, please acknowledge the following:
            </div>
            
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => 
                setAcknowledgements(prev => ({
                  ...prev, 
                  permanentDelete: !prev.permanentDelete
                }))
              }
            >
              <Checkbox 
                id="permanentDelete" 
                checked={acknowledgements.permanentDelete}
                onCheckedChange={(checked) => 
                  setAcknowledgements(prev => ({...prev, permanentDelete: checked === true}))
                }
              />
              <Label 
                htmlFor="permanentDelete"
                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                All data will be permanently and forever deleted
              </Label>
            </div>
            
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => 
                setAcknowledgements(prev => ({
                  ...prev, 
                  includesWorkspace: !prev.includesWorkspace
                }))
              }
            >
              <Checkbox 
                id="includesWorkspace" 
                checked={acknowledgements.includesWorkspace}
                onCheckedChange={(checked) => 
                  setAcknowledgements(prev => ({...prev, includesWorkspace: checked === true}))
                }
              />
              <Label 
                htmlFor="includesWorkspace"
                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                This includes my workspace and all submitted tickets
              </Label>
            </div>
            
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => 
                setAcknowledgements(prev => ({
                  ...prev, 
                  cannotUndo: !prev.cannotUndo
                }))
              }
            >
              <Checkbox 
                id="cannotUndo" 
                checked={acknowledgements.cannotUndo}
                onCheckedChange={(checked) => 
                  setAcknowledgements(prev => ({...prev, cannotUndo: checked === true}))
                }
              />
              <Label 
                htmlFor="cannotUndo"
                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                This action can't be undone
              </Label>
            </div>
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
            disabled={!canDelete}
          >
            Delete Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}