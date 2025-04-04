import { useState, useEffect } from 'react'
import { X, Send, Paperclip, FoldVertical, UnfoldVertical, Check, Circle } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { FeedbackResponse, FeedbackReply, FeedbackAttachment } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { TiptapEditor } from './tiptap-editor'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

interface ResponseDetailsProps {
  response: FeedbackResponse | null
  onClose: () => void
  onDelete: (id: string) => void
  onStatusChange?: (id: string, status: 'open' | 'closed') => void
}

export function ResponseDetails({ response, onClose, onDelete, onStatusChange }: ResponseDetailsProps) {
  if (!response) return null

  const [showImagePreview, setShowImagePreview] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replies, setReplies] = useState<FeedbackReply[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [currentStatus, setCurrentStatus] = useState<'open' | 'closed'>(response.status)

  useEffect(() => {
    if (response) {
      fetchReplies()
      const channel = subscribeToReplies()
      
      // Set up an interval to periodically check for new replies
      const refreshInterval = setInterval(() => {
        fetchReplies()
      }, 5000) // Check every 5 seconds
      
      // Update current status when response changes
      setCurrentStatus(response.status)
      
      return () => {
        supabase.removeChannel(channel)
        clearInterval(refreshInterval)
      }
    }
  }, [response.id, response.status])

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
      // Rich text content is already in HTML format
      const htmlContent = replyContent;
      
      // Extract plain text from HTML for the content field
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = replyContent;
      const plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
      
      const { data, error } = await supabase
        .from('feedback_replies')
        .insert([{
          feedback_id: response.id,
          sender_type: 'admin',
          content: plainTextContent.trim(),
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
            replyContent: plainTextContent.trim(),
            replyId: data?.[0]?.id,
            htmlContent: htmlContent,
            isAdminDashboardReply: true
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

  const handleStatusChange = async (newStatus: 'open' | 'closed') => {
    if (newStatus === currentStatus) return
    
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status: newStatus })
        .eq('id', response.id)
      
      if (error) throw error
      
      setCurrentStatus(newStatus)
      
      // Notify parent component about status change
      if (onStatusChange) {
        onStatusChange(response.id, newStatus)
      }
    } catch (error) {
      console.error('Error updating feedback status:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseFeedback = async (withReply = false) => {
    setIsSubmitting(true)
    try {
      // First send the reply if there is content and withReply is true
      if (withReply && replyContent.trim()) {
        await handleSendReply()
      }
      
      // Use the same status update function for consistency
      await handleStatusChange('closed')
      
      // No need to set replyContent as empty if handleSendReply was called, it already does that
      if (!withReply) {
        setReplyContent('')
      }
    } catch (error) {
      console.error('Error closing feedback:', error)
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

  // Handle key events for Ctrl+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSendReply()
    }
  }

  // Toggle the expanded state for a reply's quoted content
  const toggleQuotedContent = (replyId: string) => {
    setExpandedReplies(prev => {
      const newExpandedReplies = new Set(prev);
      if (newExpandedReplies.has(replyId)) {
        newExpandedReplies.delete(replyId);
      } else {
        newExpandedReplies.add(replyId);
      }
      return newExpandedReplies;
    });
  }

  // Process HTML content to separate main content from quoted content
  function processHtmlContent(html: string | undefined): {
    mainContent: string;
    dateLine: string | null;
    quotedContent: string | null;
  } {
    if (!html) return { mainContent: '', dateLine: null, quotedContent: null }
    
    console.log("Processing HTML content:", html.substring(0, 200) + "...");
    
    // Look for common date line patterns
    
    // First try to match the "On [date]... wrote:" pattern
    const onWrotePattern = /(<div[^>]*>|<p[^>]*>|<span[^>]*>)On [^<>]+wrote:(<\/div>|<\/p>|<\/span>)?/i;
    const onWroteMatch = html.match(onWrotePattern);
    
    if (onWroteMatch && onWroteMatch[0]) {
      console.log("Found 'On... wrote:' pattern:", onWroteMatch[0]);
      const dateLineIndex = html.indexOf(onWroteMatch[0]);
      if (dateLineIndex > 0) {
        // The main content is everything before the date line
        const mainContent = html.substring(0, dateLineIndex);
        
        // The quoted content is everything starting from the date line (including it)
        const quotedContent = html.substring(dateLineIndex);
        
        console.log("Split content at index:", dateLineIndex);
        console.log("Main content length:", mainContent.length);
        console.log("Quoted content length:", quotedContent.length);
        
        return {
          mainContent,
          dateLine: onWroteMatch[0],
          quotedContent
        };
      }
    }
    
    // Add more pattern matching logic for email threads...
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
          {/* Status section - added at top */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={isSubmitting}>
                <Button 
                  variant="outline" 
                  className={`w-full justify-between ${
                    currentStatus === 'open' 
                      ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-700' 
                      : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-700'
                  }`}
                >
                  <div className="flex items-center">
                    {currentStatus === 'open' ? (
                      <Circle className="h-3 w-3 mr-2 fill-blue-500 text-blue-500" />
                    ) : (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    )}
                    {currentStatus === 'open' ? 'Open' : 'Closed'}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--trigger-width]">
                <DropdownMenuItem 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleStatusChange('open')}
                >
                  <Circle className="h-3 w-3 mr-2 fill-blue-500 text-blue-500" />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleStatusChange('closed')}
                >
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span>Closed</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
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
                  const { mainContent, quotedContent } = processHtmlContent(reply.html_content);
                  const isExpanded = expandedReplies.has(reply.id)
                  
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
                      
                      {reply.html_content ? (
                        <div className="space-y-2">
                          {/* Show the main content */}
                          <div dangerouslySetInnerHTML={{ __html: mainContent }} />
                          
                          {/* Show quoted content if it exists and is expanded */}
                          {quotedContent && (
                            <div>
                              <button
                                onClick={() => toggleQuotedContent(reply.id)}
                                className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <FoldVertical className="h-3 w-3 mr-1" />
                                    Hide quoted text
                                  </>
                                ) : (
                                  <>
                                    <UnfoldVertical className="h-3 w-3 mr-1" />
                                    Show quoted text
                                  </>
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div 
                                  className="border-l-2 pl-2 text-muted-foreground" 
                                  dangerouslySetInnerHTML={{ __html: quotedContent }}
                                />
                              )}
                            </div>
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
            </div>
            <div className="mb-2">
              <TiptapEditor
                value={replyContent}
                onChange={setReplyContent}
                onKeyDown={handleKeyDown}
                placeholder="Type your reply..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => replyContent.trim() 
                  ? handleCloseFeedback(true) 
                  : handleCloseFeedback(false)}
                disabled={isSubmitting}
              >
                {replyContent.trim() ? 'Close with reply' : 'Close'} 
              </Button>
              <Button
                size="sm"
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