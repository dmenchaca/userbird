import { X } from 'lucide-react'
import { Button } from './ui/button'

interface Response {
  id: string
  message: string
  image_url: string | null
  image_name: string | null
  user_id: string | null
  user_email: string | null
  user_name: string | null
  operating_system: string
  screen_category: string
  created_at: string
}

interface ResponseDetailsProps {
  response: Response | null
  onClose: () => void
  onDelete: (id: string) => void
}

export function ResponseDetails({ response, onClose, onDelete }: ResponseDetailsProps) {
  if (!response) return null

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
                <img 
                  src={response.image_url} 
                  alt={response.image_name || 'Feedback image'} 
                  className="w-full rounded-lg border"
                />
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
    </div>
  )
}