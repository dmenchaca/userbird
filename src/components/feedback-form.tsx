import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Form } from 'react-final-form'
import { submitFeedback } from '@/lib/services/feedback'
import { FeedbackDialogContent } from './feedback-dialog-content'

interface FeedbackFormProps {
  formId: string
}

interface FormValues {
  message: string
}

type FormState = 'normal' | 'success'

export function FeedbackForm({ formId }: FeedbackFormProps) {
  const [state, setState] = useState<FormState>('normal')
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset form after close animation
      setTimeout(() => setState('normal'), 150)
    }
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await submitFeedback({ formId, message: values.message })
      setState('success')
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit feedback')
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="text-sm font-medium">Feedback</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-lg w-[400px] max-w-[calc(100vw-2rem)]">
          <Form
            onSubmit={onSubmit}
            render={({ handleSubmit, submitting, submitError }) => (
              <FeedbackDialogContent
                state={state}
                submitting={submitting}
                error={submitError}
                onSubmit={handleSubmit}
                onClose={() => handleOpenChange(false)}
              />
            )}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}