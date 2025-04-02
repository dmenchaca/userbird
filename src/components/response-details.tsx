import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FeedbackResponse, FeedbackReply } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { Textarea } from './ui/textarea'

interface ResponseDetailsProps {
  response: FeedbackResponse | null
  onClose: () => void
  onDelete: (id: string) => void
}

export function ResponseDetails({ response, onClose, onDelete }: ResponseDetailsProps) {
  if (!response) return null

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replies, setReplies] = useState<FeedbackReply[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (response) {
      fetchReplies()
      const channel = subscribeToReplies()
      
      // Set up an interval to periodically check for new replies
      const refreshInterval = setInterval(() => {
        fetchReplies()
      }, 5000) // Check every 5 seconds
      
      return () => {
        supabase.removeChannel(channel)
        clearInterval(refreshInterval)
      }
    }
  }, [response.id])

  const fetchReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', response.id)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setReplies(data || [])
    } catch (error) {
      console.error('Error fetching replies:', error)
    }
  }

  const subscribeToReplies = () => {
    const channelName = `replies_channel_${response.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback_replies',
        filter: `feedback_id=eq.${response.id}`
      }, () => {
        fetchReplies()
      })
      .subscribe()
      
    return channel
  }

  const handleSendReply = async () => {
    if (!replyContent.trim()) return
    
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert([{
          feedback_id: response.id,
          sender_type: 'admin',
          content: replyContent.trim()
        }])
        .select()
      
      if (error) throw error

      if (response.user_email) {
        const res = await fetch('/.netlify/functions/send-reply-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feedbackId: response.id,
            replyContent: replyContent.trim(),
            replyId: data?.[0]?.id
          }),
        })

        if (!res.ok) {
          console.error('Failed to send email notification:', await res.text())
        }
      }
      
      setReplyContent('')
    } catch (error) {
      console.error('Error sending reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

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
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-medium">Response Details</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="space-y-6 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Message</p>
              <p className="text-sm whitespace-pre-wrap">{response.message}</p>
            </div>

            {/* Thread/Replies section */}
            {replies.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <p className="text-xs text-muted-foreground">Thread</p>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
                
                <div className="space-y-3">
                  {replies.map(reply => (
                    <div 
                      key={reply.id} 
                      className={`p-2 rounded-lg text-sm ${
                        reply.sender_type === 'admin' 
                          ? 'bg-primary/10 ml-6' 
                          : 'bg-muted mr-6'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-xs">
                          {reply.sender_type === 'admin' ? 'You' : 'User'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <p>Page URL: {response.url_path || '-'}</p>
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

        {/* Reply input area */}
        <div className="p-4 border-t mt-auto">
          <div className="flex items-center space-x-2">
            <Textarea
              placeholder="Type a reply..."
              className="min-h-[80px] resize-none"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => {
                // Check for Cmd/Ctrl + Enter
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (replyContent.trim() && !isSubmitting) {
                    handleSendReply();
                  }
                }
              }}
            />
            <Button 
              className="h-10 w-10 p-0" 
              onClick={handleSendReply}
              disabled={!replyContent.trim() || isSubmitting}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send reply</span>
            </Button>
          </div>
        </div>
      </div>
      
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <div className="relative">
            <img
              src={response.image_url || ''}
              alt={response.image_name || 'Feedback image'}
              className="max-w-full max-h-[85vh] object-contain mx-auto"
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