import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { submitFeedback } from '@/lib/services/feedback'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface FeedbackFormProps {
  formId: string
}

type DialogState = 'normal' | 'success' | 'error'

export function FeedbackForm({ formId }: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>('normal')

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Only close if we're not in success state
      if (dialogState !== 'success') {
        setIsOpen(false)
      }
    } else {
      setIsOpen(open)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    // Reset state after dialog closes
    setTimeout(() => {
      setDialogState('normal')
      setMessage('')
      setError(null)
    }, 150)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await submitFeedback({ formId, message })
      setDialogState('success')
      // Don't close immediately - let user see success state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
      setDialogState('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderContent = () => {
    switch (dialogState) {
      case 'success':
        return (
          <div className="text-center py-6 px-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Thank you for your feedback!</h3>
              <p className="text-sm text-muted-foreground">
                Your message has been received and will be reviewed by our team.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="mt-4"
            >
              Close
            </Button>
          </div>
        )

      case 'error':
      case 'normal':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              required
              className="min-h-[100px]"
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </form>
        )
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="text-sm font-medium">Feedback</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold mb-4">
            {dialogState === 'success' ? 'Feedback Sent' : 'Send Feedback'}
          </Dialog.Title>
          {renderContent()}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}