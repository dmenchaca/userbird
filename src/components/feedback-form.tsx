import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { FEEDBACK_MESSAGES as MSG } from '@/lib/constants/messages'
import { supabase } from '@/lib/supabase'

interface FeedbackFormProps {
  formId: string
}

export function FeedbackForm({ formId }: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (!showSuccess) {
        setIsOpen(false)
      }
    } else {
      setIsOpen(open)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(() => {
      setShowSuccess(false)
      setMessage('')
      setError(null)
    }, 150)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const feedbackMessage = message
    
    // Immediately show success and clear form
    setError(null)
    setMessage('')
    setShowSuccess(true)
    
    // Submit in background
    await supabase
      .from('feedback')
      .insert([{ form_id: formId, message: feedbackMessage }])
      .catch(err => {
        // If submission fails, show error and restore message
        setShowSuccess(false)
        setMessage(feedbackMessage)
        setError(err instanceof Error ? err.message : MSG.error.default)
      });
  }

  const renderContent = () => {
    if (showSuccess) {
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

    } else {
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={MSG.placeholders.textarea}
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
              <Button type="submit">
                {MSG.labels.submit}
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
            {showSuccess ? MSG.success.title : 'Send Feedback'}
          </Dialog.Title>
          {renderContent()}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}