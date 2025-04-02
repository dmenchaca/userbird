import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FeedbackResponse, FeedbackReply } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { Textarea } from './ui/textarea'
import { textToHtml } from '@/lib/utils/html-sanitizer'

// Remove the inline sanitizer function since we now use the utility
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
      // Create HTML version of reply content using our new utility
      const htmlContent = textToHtml(replyContent);
      
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert([{
          feedback_id: response.id,
          sender_type: 'admin',
          content: replyContent.trim(),
          html_content: htmlContent
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
            replyId: data?.[0]?.id,
            htmlContent: htmlContent
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

  // Allow simple keyboard formatting: Ctrl+B for bold, Ctrl+I for italic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSendReply()
      return
    }
    
    // Bold: Ctrl+B / Command+B
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      
      // If text is selected, wrap it in **bold**
      if (start !== end) {
        const beforeText = text.substring(0, start)
        const selectedText = text.substring(start, end)
        const afterText = text.substring(end)
        
        setReplyContent(`${beforeText}**${selectedText}**${afterText}`)
        
        // Set cursor position after the bold text (after the closing **)
        setTimeout(() => {
          textarea.selectionStart = end + 4
          textarea.selectionEnd = end + 4
        }, 0)
      } else {
        // If no text is selected, insert **** and place cursor in the middle
        const newText = `${text.substring(0, start)}****${text.substring(end)}`
        setReplyContent(newText)
        
        setTimeout(() => {
          textarea.selectionStart = start + 2
          textarea.selectionEnd = start + 2
        }, 0)
      }
    }
    
    // Italic: Ctrl+I / Command+I
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      
      // If text is selected, wrap it in *italic*
      if (start !== end) {
        const beforeText = text.substring(0, start)
        const selectedText = text.substring(start, end)
        const afterText = text.substring(end)
        
        setReplyContent(`${beforeText}*${selectedText}*${afterText}`)
        
        // Set cursor position after the italic text (after the closing *)
        setTimeout(() => {
          textarea.selectionStart = end + 2
          textarea.selectionEnd = end + 2
        }, 0)
      } else {
        // If no text is selected, insert ** and place cursor in the middle
        const newText = `${text.substring(0, start)}**${text.substring(end)}`
        setReplyContent(newText)
        
        setTimeout(() => {
          textarea.selectionStart = start + 1
          textarea.selectionEnd = start + 1
        }, 0)
      }
    }
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
                      {reply.html_content ? (
                        <div 
                          className="prose prose-sm max-w-none prose-a:text-blue-600"
                          dangerouslySetInnerHTML={{ __html: reply.html_content }} 
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{reply.content}</p>
                      )}
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
                    minute: 'numeric',
                    hour12: true
                  })}
                </p>
              </div>

              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full"
                onClick={() => onDelete(response.id)}
              >
                Delete Feedback
              </Button>
            </div>
          </div>
        </div>

        {response.user_email && (
          <div className="p-4 border-t">
            <div className="flex flex-col">
              <div className="text-xs mb-2 text-muted-foreground">
                <span>
                  Reply to <strong>{response.user_email}</strong>
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  (Ctrl+B for bold, Ctrl+I for italic)
                </span>
              </div>
              <div className="relative">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder="Type your reply..."
                  className="resize-none text-sm"
                />
                <Button 
                  size="sm" 
                  className="absolute bottom-2 right-2"
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || isSubmitting}
                >
                  <Send className="h-3 w-3 mr-1" /> Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showImagePreview && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="max-w-3xl">
            <div className="flex justify-between mb-4">
              <h3 className="font-medium">Image Preview</h3>
              <div className="space-x-2">
                <Button size="sm" onClick={handleDownload}>Download</Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setShowImagePreview(false)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <img 
                src={response.image_url!} 
                alt={response.image_name || 'Feedback image'} 
                className="w-full"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}