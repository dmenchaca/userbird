import { useState, useEffect } from 'react'
import { FoldVertical, UnfoldVertical, Paperclip, Send } from 'lucide-react'
import { Button } from './ui/button'
import { FeedbackResponse, FeedbackReply, FeedbackAttachment } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { TiptapEditor } from './tiptap-editor'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarFallback } from './ui/avatar'

interface ConversationThreadProps {
  response: FeedbackResponse | null
  onStatusChange?: (id: string, status: 'open' | 'closed') => void 
}

export function ConversationThread({ response, onStatusChange }: ConversationThreadProps) {
  if (!response) return null

  const { user } = useAuth()
  const [replyContent, setReplyContent] = useState('')
  const [replies, setReplies] = useState<FeedbackReply[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())

  // Get admin display information
  const adminName = user?.user_metadata?.full_name || user?.email || 'Admin'
  const adminInitials = adminName?.[0]?.toUpperCase() || 'A'
  const adminAvatarUrl = user?.user_metadata?.avatar_url

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

  useEffect(() => {
    // When response changes, reset the reply content
    setReplyContent('')
  }, [response?.id])

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
    
    // Remove any tracking pixels/images (commonly used by email services)
    const cleanedHtml = html.replace(/<img[^>]*width=["']?1["']?[^>]*height=["']?1["']?[^>]*>/g, '');
    
    // Check for common quoted content identifiers (client-agnostic approach)
    const quoteIdentifiers = [
      // Gmail quote container
      { pattern: /<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>/, isContainer: true },
      // Gmail quote container with gmail_quote_container class
      { pattern: /<div[^>]*class="[^"]*gmail_quote_container[^"]*"[^>]*>/, isContainer: true },
      // "On [date]... wrote:" pattern (common in many email clients)
      { pattern: /(<div[^>]*>|<p[^>]*>|<span[^>]*>)On [^<>]+wrote:(<\/div>|<\/p>|<\/span>)?/i, isContainer: false },
      // Generic blockquote
      { pattern: /<blockquote[^>]*>/, isContainer: true },
      // Apple Mail/Outlook style quoted messages
      { pattern: /<div[^>]*class="[^"]*AppleMailSignature[^"]*"[^>]*>/, isContainer: true },
      { pattern: /<div[^>]*class="[^"]*OutlookMessageHeader[^"]*"[^>]*>/, isContainer: true },
      // Common "From:" header in forwarded messages
      { pattern: /(<div[^>]*>|<p[^>]*>|<span[^>]*>)From:.*?<(?:div|p|span)[^>]*>.*?(?:To|Date|Subject):.*?</is, isContainer: false },
      // Common div with data-marker attribute (used by some clients)
      { pattern: /<div[^>]*data-marker="__QUOTED_TEXT__"[^>]*>/, isContainer: true },
      // Yahoo Mail style
      { pattern: /<hr[^>]*id="[^"]*yahoo_quoted_[^"]*"[^>]*>/, isContainer: true }
    ];
    
    for (const { pattern } of quoteIdentifiers) {
      const match = cleanedHtml.match(pattern);
      if (match && match[0]) {
        const quotedContentStartIndex = cleanedHtml.indexOf(match[0]);
        if (quotedContentStartIndex > 0) {
          // The main content is everything before the quoted content
          const mainContent = cleanedHtml.substring(0, quotedContentStartIndex);
          
          // The quoted content is everything starting from the quoted content marker
          const quotedContent = cleanedHtml.substring(quotedContentStartIndex);
          
          // Use the matched element as the dateLine
          const dateLine = match[0];
          
          return {
            mainContent,
            dateLine,
            quotedContent
          };
        }
      }
    }
    
    return { mainContent: cleanedHtml, dateLine: null, quotedContent: null };
  }

  // Function to handle closing feedback with or without a reply
  const handleCloseFeedback = async (withReply = false) => {
    setIsSubmitting(true)
    try {
      // First send the reply if there is content and withReply is true
      if (withReply && replyContent.trim()) {
        await handleSendReply()
      }
      
      // Update status to closed
      if (onStatusChange) {
        onStatusChange(response.id, 'closed')
      }
      
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main conversation area - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 overflow-x-hidden min-h-0">
        {/* Conversation thread - all messages */}
        <div className="space-y-3">
          {/* Original message */}
          <div className="p-2 rounded-lg text-sm overflow-hidden bg-muted mr-6">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-xs">{response.user_name || 'Anonymous'}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(response.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words overflow-wrap break-word">{response.message}</p>
          </div>
          
          {/* Reply messages */}
          {replies.map((reply) => {
            const { mainContent, quotedContent } = processHtmlContent(reply.html_content);
            const isExpanded = expandedReplies.has(reply.id);
            
            return (
              <div
                key={reply.id}
                className={`p-2 rounded-lg text-sm overflow-hidden ${
                  reply.sender_type === 'admin' 
                    ? 'bg-primary/10 ml-6' 
                    : 'bg-muted mr-6'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-xs flex items-center">
                    {reply.sender_type === 'admin' ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5 rounded-full">
                          {adminAvatarUrl ? (
                            <img src={adminAvatarUrl} alt={adminName} className="h-full w-full object-cover rounded-full" />
                          ) : (
                            <AvatarFallback className="rounded-full text-[10px]">{adminInitials}</AvatarFallback>
                          )}
                        </Avatar>
                        {adminName}
                      </span>
                    ) : (response.user_name || 'Anonymous')}
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
                  <div className="space-y-2 overflow-hidden">
                    {/* Show the main content */}
                    <div className="overflow-x-auto break-words" dangerouslySetInnerHTML={{ __html: mainContent }} />
                    
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
                            className="border-l-2 pl-2 text-muted-foreground overflow-x-auto" 
                            dangerouslySetInnerHTML={{ __html: quotedContent }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{reply.content}</p>
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
      
      {/* Reply section - sticky at bottom */}
      {response.user_email && (
        <div className="p-4 border-t sticky bottom-0 bg-background flex-shrink-0">
          <div className="flex flex-col">
            <div className="text-xs mb-2 text-muted-foreground">
              <span>
                Reply to <strong className="break-all">{response.user_email}</strong>
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
    </div>
  )
} 