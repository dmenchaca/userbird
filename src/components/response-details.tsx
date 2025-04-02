import { useState, useEffect } from 'react'
import { X, Send, Paperclip, Loader } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FeedbackResponse, FeedbackReply, FeedbackAttachment } from '@/lib/types/feedback'
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
      // Fetch replies with their attachments
      const { data: repliesData, error: repliesError } = await supabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', response.id)
        .order('created_at', { ascending: true })
      
      if (repliesError) throw repliesError
      
      // Fetch attachments for all replies
      if (repliesData && repliesData.length > 0) {
        const replyIds = repliesData.map(reply => reply.id)
        
        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from('feedback_attachments')
          .select('*')
          .in('reply_id', replyIds)
          .order('created_at', { ascending: true })
        
        if (attachmentsError) {
          console.error('Error fetching attachments:', attachmentsError)
          // Continue anyway, just without attachments
        }
        
        // Group attachments by reply_id
        const attachmentsByReplyId: Record<string, FeedbackAttachment[]> = {}
        
        if (attachmentsData) {
          attachmentsData.forEach(attachment => {
            if (!attachmentsByReplyId[attachment.reply_id]) {
              attachmentsByReplyId[attachment.reply_id] = []
            }
            attachmentsByReplyId[attachment.reply_id].push(attachment)
          })
        }
        
        // Add attachments to replies
        const repliesWithAttachments = repliesData.map(reply => ({
          ...reply,
          attachments: attachmentsByReplyId[reply.id] || []
        }))
        
        setReplies(repliesWithAttachments)
      } else {
        setReplies(repliesData || [])
      }
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
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border shadow-lg max-w-3xl w-full max-h-[90vh] grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-medium">Feedback Details</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-lg font-medium mb-6">{response.message}</p>
          
          {response.image_url && (
            <div className="space-y-2 mb-6">
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

        <div className="border-t md:border-t-0 md:border-l p-6 overflow-y-auto bg-muted/30">
          <h2 className="font-medium mb-4">Conversation</h2>

          <div className="space-y-6 mb-6">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className={`rounded-lg p-4 ${
                  reply.sender_type === 'admin' ? 'bg-blue-50 ml-6' : 'bg-gray-100 mr-6'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {reply.sender_type === 'admin' ? 'Admin' : 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      hour12: true,
                    })}
                  </span>
                </div>
                
                {/* Display HTML content if available, otherwise use plain text */}
                {reply.html_content ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: reply.html_content }} 
                    className="text-sm prose prose-sm max-w-none"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                )}
                
                {/* Display attachments */}
                {reply.attachments && reply.attachments.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Paperclip size={12} />
                      <span>Attachments</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reply.attachments.map(attachment => (
                        <div key={attachment.id} className="relative group">
                          {attachment.content_type.startsWith('image/') ? (
                            <a 
                              href={attachment.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block border rounded overflow-hidden hover:opacity-90 transition-opacity"
                            >
                              <img 
                                src={attachment.url} 
                                alt={attachment.filename}
                                className="w-16 h-16 object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 p-2 border rounded hover:bg-muted transition-colors"
                            >
                              <Paperclip size={14} />
                              <span className="text-xs truncate max-w-[120px]">
                                {attachment.filename}
                              </span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to this feedback..."
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={handleSendReply}
              className="w-full"
              disabled={isSubmitting || !replyContent.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Image preview dialog */}
      {response.image_url && showImagePreview && (
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
                src={response.image_url} 
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