import { useState, useEffect } from 'react'
import { X, Send, Paperclip, Loader, ChevronsDown, ChevronsUp } from 'lucide-react'
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
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({})

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

  // Toggle the expanded state for a reply's quoted content
  const toggleQuotedContent = (replyId: string) => {
    setExpandedQuotes(prev => ({
      ...prev,
      [replyId]: !prev[replyId]
    }))
  }

  // Check if the HTML content contains quoted content
  const hasQuotedContent = (html: string | undefined): boolean => {
    if (!html) return false
    return html.includes('gmail_quote') || 
           html.includes('<blockquote') || 
           html.includes('On') && html.includes('wrote:') ||
           html.includes('thread::')
  }

  // Process HTML content to separate main content from quoted content
  const processHtmlContent = (html: string | undefined, replyId: string): { 
    mainContent: string, 
    dateLine: string | null,
    quotedContent: string | null 
  } => {
    if (!html) return { mainContent: '', dateLine: null, quotedContent: null }
    
    // Look for common quoted content markers
    
    // First try to match the "On [date]... wrote:" pattern, which we'll use as the trigger
    const onWrotePattern = /(<div[^>]*>|<p[^>]*>|<span[^>]*>)On [^<>]+wrote:(<\/div>|<\/p>|<\/span>)?/i;
    const onWroteMatch = html.match(onWrotePattern);
    
    if (onWroteMatch && onWroteMatch[0]) {
      const dateLineIndex = html.indexOf(onWroteMatch[0]);
      if (dateLineIndex > 0) {
        // The main content is everything before the date line
        const mainContent = html.substring(0, dateLineIndex);
        
        // The date line is the "On [date]... wrote:" pattern
        const dateLine = onWroteMatch[0];
        
        // The quoted content is everything starting from the date line
        const quotedContent = html.substring(dateLineIndex);
        
        return {
          mainContent,
          dateLine,
          quotedContent
        };
      }
    }
    
    // Fall back to other methods if we can't find a date line
    const gmailQuoteMatch = html.match(/<div class="?gmail_quote"?.*?>[\s\S]*?<\/div>$/i) || 
                          html.match(/<div class="?gmail_quote.*?<\/div><\/div>$/i);

    if (gmailQuoteMatch && gmailQuoteMatch[0]) {
      const quoteIndex = html.indexOf(gmailQuoteMatch[0]);
      if (quoteIndex > 0) {
        return {
          mainContent: html.substring(0, quoteIndex),
          dateLine: null,
          quotedContent: gmailQuoteMatch[0]
        };
      }
    }
    
    // Look for blockquote tags
    const blockquoteMatch = html.match(/<blockquote[\s\S]*?<\/blockquote>/i);
    if (blockquoteMatch && blockquoteMatch[0]) {
      const quoteIndex = html.indexOf(blockquoteMatch[0]);
      if (quoteIndex > 0) {
        return {
          mainContent: html.substring(0, quoteIndex),
          dateLine: null,
          quotedContent: blockquoteMatch[0]
        };
      }
    }
    
    return { mainContent: html, dateLine: null, quotedContent: null };
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium">Feedback Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Message</p>
            <p className="text-sm whitespace-pre-wrap">{response.message}</p>
          </div>
          
          {/* Conversation section */}
          {replies.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <div className="h-px flex-1 bg-gray-200"></div>
                <p className="text-xs text-muted-foreground">Conversation</p>
                <div className="h-px flex-1 bg-gray-200"></div>
              </div>
              
              <div className="space-y-3">
                {replies.map((reply) => {
                  const { mainContent, dateLine, quotedContent } = processHtmlContent(reply.html_content, reply.id);
                  const isExpanded = expandedQuotes[reply.id] || false;
                  
                  return (
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
                      
                      {/* Main content */}
                      {reply.html_content ? (
                        <div className="space-y-2">
                          <div 
                            dangerouslySetInnerHTML={{ __html: mainContent }} 
                            className="prose prose-sm max-w-none prose-a:text-blue-600"
                          />
                          
                          {/* Quoted content section */}
                          {(dateLine || quotedContent) && (
                            <>
                              {/* Show/Hide quoted content button FIRST */}
                              <button
                                onClick={() => toggleQuotedContent(reply.id)}
                                className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronsUp size={14} className="mr-1" />
                                    Hide quoted content
                                  </>
                                ) : (
                                  <>
                                    <ChevronsDown size={14} className="mr-1" />
                                    Show quoted content
                                  </>
                                )}
                              </button>
                              
                              {/* Collapsible content INCLUDING date line */}
                              {isExpanded && quotedContent && (
                                <div className="mt-2 pl-3 border-l-2 border-muted text-muted-foreground">
                                  {/* All quoted content including date line */}
                                  <div 
                                    dangerouslySetInnerHTML={{ __html: quotedContent }}
                                    className="text-xs prose prose-sm max-w-none opacity-80"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{reply.content}</p>
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
                  );
                })}
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
      
      {/* Image preview dialog - keep this part */}
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