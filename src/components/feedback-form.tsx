import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { useFeedback } from '@/lib/core/hooks/use-feedback'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { FEEDBACK_MESSAGES as MSG } from '@/lib/constants/messages'

interface FeedbackFormProps {
  formId: string
}

type DialogState = 'normal' | 'success' | 'error'

export function FeedbackForm({ formId }: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const { state, submissionStatus, error, submitFeedback, reset } = useFeedback()

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (state !== 'success') {
        setIsOpen(false)
      }
    } else {
      setIsOpen(open)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(() => {
      reset()
      setMessage('')
    }, 150)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await submitFeedback({ formId, message })
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    }
  }

  const renderContent = () => {
    switch (state) {
      case 'success':
        return (
          <div className="text-center py-6 px-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{MSG.success.title}</h3>
              <p className="text-sm text-muted-foreground">
                {MSG.success.description}
              </p>
            </div>
            <Button onClick={handleClose} className="mt-4">
              {MSG.labels.close}
            </Button>
          </div>
        )

      case 'normal':
      case 'submitting':
      case 'error':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={MSG.placeholders.textarea}
              disabled={submissionStatus === 'pending'}
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
                  {MSG.labels.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={submissionStatus === 'pending'}>
                {submissionStatus === 'pending' ? MSG.labels.submitting : MSG.labels.submit}
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
            {dialogState === 'success' ? MSG.success.title : 'Send Feedback'}
          </Dialog.Title>
          {renderContent()}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}