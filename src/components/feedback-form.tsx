import { useState, useEffect } from 'react'
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
  const [gifUrls, setGifUrls] = useState<string[]>([])
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null)

  useEffect(() => {
    // Fetch form settings including GIF URLs when the component mounts
    const fetchFormSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('show_gif_on_success, gif_urls')
          .eq('id', formId)
          .single();
        
        if (error) {
          console.error('Error fetching form settings:', error);
          return;
        }

        if (data && data.gif_urls && Array.isArray(data.gif_urls)) {
          setGifUrls(data.gif_urls);
        }
      } catch (error) {
        console.error('Error fetching form settings:', error);
      }
    };

    fetchFormSettings();
  }, [formId]);

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
      setSelectedGifUrl(null); // Reset selected GIF
    }, 150)
  }

  // Select a random GIF from available GIFs
  const selectRandomGif = () => {
    if (gifUrls && gifUrls.length > 0) {
      const randomIndex = Math.floor(Math.random() * gifUrls.length);
      return gifUrls[randomIndex];
    }
    // Return null if no custom GIFs are available
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const feedbackMessage = message
    console.log('1. Starting submission, showing success immediately')
    
    // Select a random GIF if GIFs are enabled
    if (window.UserBird?.showGifOnSuccess) {
      setSelectedGifUrl(selectRandomGif());
    }
    
    // Immediately show success and clear form
    setError(null)
    setMessage('')
    setShowSuccess(true)
    console.log('2. Success state shown, form cleared')
    
    // Submit in background
    console.log('3. Making API request in background...')
    const { error: submitError } = await supabase
      .from('feedback')
      .insert([{ form_id: formId, message: feedbackMessage }])

    console.log('4. API request completed:', { success: !submitError })
    
    // If submission fails, show error and restore message
    if (submitError) {
      console.log('5. Error occurred, reverting to form state:', submitError)
      setShowSuccess(false)
      setMessage(feedbackMessage)
      setError(submitError.message || MSG.error.default)
    } else {
      console.log('5. Submission successful')
    }
  }

  const renderContent = () => {
    if (showSuccess) {
        return (
          <div className="text-center py-6 px-4 space-y-4">
            {!window.UserBird?.showGifOnSuccess && (
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            )}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{MSG.success.title}</h3>
              <p className="text-sm text-muted-foreground">
                {MSG.success.description}
              </p>
              {window.UserBird?.showGifOnSuccess && selectedGifUrl && (
                <img 
                  src={selectedGifUrl} 
                  alt="Success GIF" 
                  className="mx-auto max-h-64" 
                />
              )}
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