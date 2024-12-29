import { AlertCircle, CheckCircle2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Field } from 'react-final-form'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

interface FeedbackDialogContentProps {
  state: 'normal' | 'success'
  submitting: boolean
  error: string | undefined
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function FeedbackDialogContent({
  state,
  submitting,
  error,
  onSubmit,
  onClose
}: FeedbackDialogContentProps) {
  if (state === 'success') {
    return (
      <div className="text-center py-6 px-4 space-y-4">
        <Dialog.Title className="text-lg font-semibold">
          Thank you for your feedback!
        </Dialog.Title>
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        <p className="text-sm text-muted-foreground">
          Your message has been received and will be reviewed by our team.
        </p>
        <Button onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Dialog.Title className="text-lg font-semibold">
        Send Feedback
      </Dialog.Title>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field name="message">
          {({ input, meta }) => (
            <div>
              <Textarea
                {...input}
                placeholder="What's on your mind?"
                required
                className="min-h-[100px]"
              />
              {meta.error && meta.touched && (
                <div className="text-sm text-destructive mt-1">
                  {meta.error}
                </div>
              )}
            </div>
          )}
        </Field>
        
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
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </div>
      </form>
    </div>
  )
}