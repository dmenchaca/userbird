import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FeedbackResponse } from '@/lib/types/feedback'

interface ResponseDetailsProps {
  response: FeedbackResponse | null
  onClose: () => void
  onDelete: (id: string) => void
}

export function ResponseDetails({ response, onClose, onDelete }: ResponseDetailsProps) {
  if (!response) return null

  const [showImagePreview, setShowImagePreview] = useState(false)

  const handleDownload = () => {
    if (!response.image_url) return
    const link = document.createElement('a')
    link.href = response.image_url
    link.download = response.image_name || 'feedback-image'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-lg transform transition-transform duration-200 ease-in-out translate-x-0">
      <div className="h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Response Details</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="h-[calc(100%-65px)] overflow-auto">
          <div className="space-y-6 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Message</p>
              <p className="text-sm whitespace-pre-wrap">{response.message}</p>
            </div>

            {response.image_url && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Image</p>
                <button
                  onClick={() => setShowImagePreview(true)}
                  className="w-full rounded-lg border overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img 
                    src={response.image_url} 
                    alt={response.image_name || 'Feedback image'} 
                    className="w-full"
                  />
                </button>
                {response.image_name && (
                  <p className="text-xs text-muted-foreground">{response.image_name}</p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">User Information</p>
                <div className="text-sm space-y-1">
                  <p>ID: {response.user_id || '-'}</p>
                  <p>Email: {response.user_email || '-'}</p>
                  <p>Name: {response.user_name || '-'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">System Information</p>
                <div className="text-sm space-y-1">
                  <p>OS: {response.operating_system}</p>
                  <p>Device: {response.screen_category}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="text-sm">
                  {new Date(response.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>
            <div>
              <Button
                variant="destructive"
                onClick={() => onDelete(response.id)}
              >
                Delete Response
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative">
            <img
              src={response.image_url || ''}
              alt={response.image_name || 'Feedback image'}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                onClick={handleDownload}
                className="rounded-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span className="sr-only">Download image</span>
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setShowImagePreview(false)}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}