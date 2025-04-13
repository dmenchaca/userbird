import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Paperclip, Send, CornerDownLeft, Command, MoreHorizontal, UserPlus } from 'lucide-react'
import { Button } from './ui/button'
import { FeedbackResponse, FeedbackReply, FeedbackAttachment } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { TiptapEditor } from './tiptap-editor'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarFallback } from './ui/avatar'

interface ConversationThreadProps {
  response: FeedbackResponse | null
  onStatusChange?: (id: string, status: 'open' | 'closed') => void 
  collaborators?: Array<{
    id?: string
    user_id: string
    user_profile?: {
      username?: string
      email?: string
      avatar_url?: string | null
    }
    invitation_email?: string
    role?: "admin" | "agent"
    invitation_accepted?: boolean
  }>
}

export interface ConversationThreadRef {
  focusReplyBox: () => void
}

export const ConversationThread = forwardRef<ConversationThreadRef, ConversationThreadProps>(
  ({ response, onStatusChange, collaborators = [] }, ref) => {
    if (!response) return null

    const { user } = useAuth()
    const [replyContent, setReplyContent] = useState('')
    const [replies, setReplies] = useState<FeedbackReply[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
    const editorRef = useRef<HTMLDivElement>(null)

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      focusReplyBox: () => {
        // Find the TiptapEditor and focus it
        if (editorRef.current) {
          const editorElement = editorRef.current.querySelector('.ProseMirror') as HTMLElement
          if (editorElement) {
            editorElement.focus()
          }
        }
      }
    }))

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
        // Fetch replies with their attachments - simplified query to avoid foreign key issues
        const { data: repliesData, error: repliesError } = await supabase
          .from('feedback_replies')
          .select('*')
          .eq('feedback_id', response.id)
          .order('created_at', { ascending: false }) // Get newest first, then reverse
        
        if (repliesError) throw repliesError;
        
        // Reverse to get chronological order (oldest first)
        const chronologicalReplies = repliesData ? [...repliesData].reverse() : [];
        
        // Debug: Log replies and check for assignment events
        console.log('Raw replies data:', chronologicalReplies);
        if (chronologicalReplies.length > 0) {
          console.log('Timestamps of all replies:', chronologicalReplies.map(r => ({ 
            id: r.id,
            type: r.type || 'reply',
            created_at: r.created_at, 
            created_date: new Date(r.created_at).toLocaleString()
          })));
          
          const assignmentEvents = chronologicalReplies.filter(reply => reply.type === 'assignment');
          console.log('Assignment events:', assignmentEvents);
        }
        
        // Process the replies to extract user information, but without joins
        const processedReplies = chronologicalReplies.map(reply => {
          // No need to process assigned_to_user or sender_user since we're not fetching those

          // Return the reply without additional processing
          return {
            ...reply,
            // These will be null since we're not fetching the related data
            assigned_to_user: null,
            assigned_by_user: null
          };
        });
        
        // Debug: Log processed replies
        console.log('Processed replies:', processedReplies);
        
        // Fetch attachments for all replies
        if (processedReplies && processedReplies.length > 0) {
          const replyIds = processedReplies
            .filter(reply => reply.type !== 'assignment') // Only get attachments for normal replies
            .map(reply => reply.id);
          
          if (replyIds.length > 0) {
            const { data: attachmentsData, error: attachmentsError } = await supabase
              .from('feedback_attachments')
              .select('*')
              .in('reply_id', replyIds)
              .order('created_at', { ascending: true });
            
            if (attachmentsError) {
              console.error('Error fetching attachments:', attachmentsError);
              // Continue anyway, just without attachments
            }
            
            // Group attachments by reply_id
            const attachmentsByReplyId: Record<string, FeedbackAttachment[]> = {};
            
            if (attachmentsData) {
              attachmentsData.forEach(attachment => {
                if (!attachmentsByReplyId[attachment.reply_id]) {
                  attachmentsByReplyId[attachment.reply_id] = [];
                }
                attachmentsByReplyId[attachment.reply_id].push(attachment);
              });
            }
            
            // Add attachments to replies
            const repliesWithAttachments = processedReplies.map(reply => ({
              ...reply,
              attachments: attachmentsByReplyId[reply.id] || []
            }));
            
            setReplies(repliesWithAttachments);
          } else {
            setReplies(processedReplies || []);
          }
        } else {
          setReplies(processedReplies || []);
        }
        
        // Debug: Log final replies state after processing
        console.log('Final replies state:', replies);
      } catch (error) {
        console.error('Error fetching replies:', error);
      }
    };

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
      console.log('handleSendReply triggered with content:', replyContent.length > 100 ? replyContent.substring(0, 100) + '...' : replyContent);
      
      if (!replyContent.trim()) return
      
      setIsSubmitting(true)
      try {
        // Rich text content is already in HTML format
        let htmlContent = replyContent;
        
        // If this is a reply to another message, append the previous message as blockquote
        if (replies.length > 0) {
          // Get the most recent message to quote
          const lastReply = replies[0];
          const senderEmail = lastReply.sender_type === 'user' ? response.user_email : 'support@userbird.co';
          
          // Format date in email client style
          const replyDate = new Date(lastReply.created_at).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          // Extract only the main content from the previous reply to avoid nested quotes
          const { mainContent: quotedMainContent } = processHtmlContent(lastReply.html_content || lastReply.content);
          
          // Add the attribution line and blockquote formatting with Gmail's structure
          htmlContent += `
            <div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On ${replyDate}, &lt;${senderEmail}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
              ${quotedMainContent}
            </blockquote></div>
          `;
        }
        
        // Extract plain text from HTML for the content field
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = replyContent;
        let plainTextContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // If we added quoted content to the HTML, append a simplified version to plainTextContent too
        if (replies.length > 0) {
          const lastReply = replies[0];
          const senderEmail = lastReply.sender_type === 'user' ? response.user_email : 'support@userbird.co';
          const replyDate = new Date(lastReply.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          // Get only the main content from the previous message to avoid nested quotes
          const { mainContent: quotedMainContent } = processHtmlContent(lastReply.html_content || lastReply.content);
          
          // Extract plain text from the quoted content
          const tempQuoteDiv = document.createElement('div');
          tempQuoteDiv.innerHTML = quotedMainContent;
          const quotedPlainText = tempQuoteDiv.textContent || tempQuoteDiv.innerText || '';
          
          // Append the plain text quoted content
          plainTextContent += `\n\nOn ${replyDate}, ${senderEmail} wrote:\n\n${quotedPlainText.split('\n').map(line => `> ${line}`).join('\n')}`;
        }
        
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
      console.log('ConversationThread handleKeyDown triggered', { 
        key: e.key, 
        ctrl: e.ctrlKey, 
        meta: e.metaKey 
      });
      
      // Don't capture cmd/ctrl+R (browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        return; // Let the browser handle the refresh
      }
      
      // Send on Ctrl+Enter or Command+Enter, but only if there's content
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        console.log('ConversationThread detected Cmd/Ctrl+Enter, checking content');
        
        // Prevent default behavior immediately to avoid adding a new line
        e.preventDefault();
        e.stopPropagation();
        
        // Only send if there's content
        if (replyContent.trim()) {
          console.log('Content found, sending reply...');
          handleSendReply();
        } else {
          console.log('No content to send');
        }
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
      
      // Check specifically for Gmail's quote pattern first
      const gmailQuoteMatch = cleanedHtml.match(/<div class="gmail_quote gmail_quote_container">/);
      if (gmailQuoteMatch) {
        const quotedContentStartIndex = cleanedHtml.indexOf(gmailQuoteMatch[0]);
        if (quotedContentStartIndex > 0) {
          const mainContent = cleanedHtml.substring(0, quotedContentStartIndex);
          const quotedContent = cleanedHtml.substring(quotedContentStartIndex);
          
          // Extract the attribution line (On <date> <email> wrote:)
          const attrMatch = quotedContent.match(/<div dir="ltr" class="gmail_attr">([^<]+)<\/div>/);
          const dateLine = attrMatch ? attrMatch[1] : null;
          
          return { mainContent, dateLine, quotedContent };
        }
      }
      
      // Also check for the old pattern with <br> for backward compatibility
      const oldGmailQuoteMatch = cleanedHtml.match(/<br><div class="gmail_quote gmail_quote_container">/);
      if (oldGmailQuoteMatch) {
        const quotedContentStartIndex = cleanedHtml.indexOf(oldGmailQuoteMatch[0]);
        if (quotedContentStartIndex > 0) {
          const mainContent = cleanedHtml.substring(0, quotedContentStartIndex);
          const quotedContent = cleanedHtml.substring(quotedContentStartIndex);
          
          // Extract the attribution line (On <date> <email> wrote:)
          const attrMatch = quotedContent.match(/<div dir="ltr" class="gmail_attr">([^<]+)<\/div>/);
          const dateLine = attrMatch ? attrMatch[1] : null;
          
          return { mainContent, dateLine, quotedContent };
        }
      }
      
      // iPhone quote pattern detection
      // First try the specific pattern with div dir="ltr"
      const iphoneSpecificMatch = cleanedHtml.match(/<div dir="ltr"><br><blockquote type="cite">/);
      if (iphoneSpecificMatch) {
        const quotedContentStartIndex = cleanedHtml.indexOf(iphoneSpecificMatch[0]);
        if (quotedContentStartIndex > 0) {
          // Look for attribution line before the blockquote
          const mainContentBeforeQuote = cleanedHtml.substring(0, quotedContentStartIndex);
          const attributionMatch = mainContentBeforeQuote.match(/On \d+ [A-Za-z]+ \d+, at \d+:\d+, .+?wrote:/);
          
          let mainContentEndIndex = quotedContentStartIndex;
          let dateLine = null;
          
          if (attributionMatch) {
            const attrIndex = mainContentBeforeQuote.lastIndexOf(attributionMatch[0]);
            if (attrIndex >= 0) {
              mainContentEndIndex = attrIndex;
              dateLine = attributionMatch[0];
            }
          }
          
          const mainContent = cleanedHtml.substring(0, mainContentEndIndex);
          const quotedContent = cleanedHtml.substring(mainContentEndIndex);
          
          return { mainContent, dateLine, quotedContent };
        }
      }
      
      // Generic blockquote with type="cite" (more general iPhone/Apple Mail detection)
      const genericCiteMatch = cleanedHtml.match(/<blockquote type="cite">/);
      if (genericCiteMatch) {
        const quotedContentStartIndex = cleanedHtml.indexOf(genericCiteMatch[0]);
        if (quotedContentStartIndex > 0) {
          // Look for attribution lines containing "On" and "wrote:"
          const mainContentBeforeQuote = cleanedHtml.substring(0, quotedContentStartIndex);
          const attributionMatch = mainContentBeforeQuote.match(/On [^<>]+(wrote:|at [^<>]+wrote:)/i);
          
          let mainContentEndIndex = quotedContentStartIndex;
          let dateLine = null;
          
          if (attributionMatch) {
            const attrIndex = mainContentBeforeQuote.lastIndexOf(attributionMatch[0]);
            if (attrIndex >= 0) {
              mainContentEndIndex = attrIndex;
              dateLine = attributionMatch[0];
            }
          }
          
          const mainContent = cleanedHtml.substring(0, mainContentEndIndex);
          const quotedContent = cleanedHtml.substring(mainContentEndIndex);
          
          return { mainContent, dateLine, quotedContent };
        }
      }
      
      // If specific patterns not found, try other patterns
      const quoteIdentifiers = [
        // Gmail quote container
        { pattern: /<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>/, isContainer: true },
        // "On [date]... wrote:" pattern (common in many email clients)
        { pattern: /(<div[^>]*>|<p[^>]*>|<span[^>]*>)On [^<>]+wrote:(<\/div>|<\/p>|<\/span>)?/i, isContainer: false },
        // Our custom email quote container
        { pattern: /<div[^>]*class="[^"]*email_quote_container[^"]*"[^>]*>/, isContainer: true },
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
            let mainContent = cleanedHtml.substring(0, quotedContentStartIndex);
            
            // The quoted content is everything starting from the quoted content marker
            let quotedContent = cleanedHtml.substring(quotedContentStartIndex);
            
            // Clean up trailing whitespace/breaks in the main content
            mainContent = mainContent.replace(/<br\s*\/?>\s*<br\s*\/?>\s*$/gi, '');
            mainContent = mainContent.replace(/(<div><br\s*\/?><\/div>\s*)+$/gi, '');
            
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

    // Near the top of the component, add a new helper function to group assignment events
    const groupConsecutiveAssignmentEvents = (replies: FeedbackReply[]) => {
      const groupedReplies: (FeedbackReply | FeedbackReply[])[] = [];
      let currentAssignmentGroup: FeedbackReply[] = [];

      replies.forEach((reply) => {
        if (reply.type === 'assignment') {
          // Add to current assignment group
          currentAssignmentGroup.push(reply);
        } else {
          // If we have assignment events in the group, add them first
          if (currentAssignmentGroup.length > 0) {
            groupedReplies.push([...currentAssignmentGroup]);
            currentAssignmentGroup = [];
          }
          // Add the regular reply
          groupedReplies.push(reply);
        }
      });

      // Add any remaining assignment events
      if (currentAssignmentGroup.length > 0) {
        groupedReplies.push([...currentAssignmentGroup]);
      }

      return groupedReplies;
    };

    // Render assignment event
    const renderAssignmentEvent = (reply: FeedbackReply) => {
      console.log('Rendering assignment event:', reply);
      
      // Format date in a readable format
      const formattedDate = new Date(reply.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Determine if this is an unassignment event (assigned_to is null)
      const isUnassignment = reply.assigned_to === null;
      const action = reply.meta?.action === 'unassign' || isUnassignment ? 'unassign' : 'assign';

      // Get assignee name if this is an assignment (not an unassignment)
      let assigneeName = 'User';
      if (!isUnassignment) {
        // First check if this is the current assignee
        if (response.assignee && reply.assigned_to === response.assignee_id) {
          assigneeName = response.assignee.user_name || response.assignee.email;
        } 
        // Then check collaborators list
        else if (reply.assigned_to && collaborators.length > 0) {
          const assigneeCollaborator = collaborators.find(c => c.user_id === reply.assigned_to);
          if (assigneeCollaborator) {
            assigneeName = 
              assigneeCollaborator.user_profile?.username || 
              assigneeCollaborator.invitation_email?.split('@')[0] || 
              'User';
          }
        }
      }

      // Get sender name - same approach as assignee
      let senderName = 'Administrator';
      
      // Current user
      if (user && reply.sender_id === user.id) {
        senderName = user.user_metadata?.full_name || user.email || 'Admin';
      }
      // Check collaborators for sender too
      else if (reply.sender_id && collaborators.length > 0) {
        const senderCollaborator = collaborators.find(c => c.user_id === reply.sender_id);
        if (senderCollaborator) {
          senderName = 
            senderCollaborator.user_profile?.username || 
            senderCollaborator.invitation_email?.split('@')[0] || 
            'Administrator';
        }
      }

      return (
        <div className="max-w-[40rem] mx-auto w-full flex items-center gap-2 py-0.5">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            <UserPlus className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">
            {isUnassignment ? (
              <>
                <span className="font-medium">{senderName}</span> removed ticket assignment on {formattedDate}
              </>
            ) : (
              <>
                Assigned to <span className="font-medium">{assigneeName}</span> by <span className="font-medium">{senderName}</span> on {formattedDate}
              </>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* CSS to handle email content formatting */}
        <style dangerouslySetInnerHTML={{ 
          __html: `
            .email-content p:empty {
              display: initial;
            }
            .email-content {
              margin-bottom: 0;
            }
            .email-content > *:last-child {
              margin-bottom: 0;
            }
            .email-content p {
              margin-top: 0;
              margin-bottom: 0;
            }
            .email-content div {
              min-height: 0;
            }
            /* Fix whitespace around content */
            .email-content p:after,
            .email-content div:after {
              content: '';
              display: inline;
              white-space: normal;
            }
            .preserve-breaks br {
              display: block !important;
              content: " " !important;
              margin: 0.5em 0 !important;
            }
            .email-content a {
              color: hsl(var(--primary));
              text-decoration: none;
            }
            .email-content a:hover {
              text-decoration: underline;
            }
            .email-content .gmail_signature {
              margin-top: 8px;
              color: hsl(var(--muted-foreground));
            }
            /* Styling for email quotes */
            .gmail_quote_container {
              margin-top: 8px;
            }
            .gmail_attr {
              color: hsl(var(--muted-foreground));
              margin-bottom: 8px;
              font-size: 0.9em;
            }
            .gmail_quote {
              margin: 0 0 0 0.8ex !important;
              border-left: 1px solid hsl(var(--border)) !important;
              padding-left: 1ex !important;
              color: hsl(var(--muted-foreground));
            }
          `
        }} />
        
        {/* Main conversation area - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
          <div className="max-w-[40rem] mx-auto w-full">
            {/* Initial message */}
            <div className="border border-border rounded-md overflow-hidden bg-background mb-4">
              <div className="border-b border-border bg-muted/20 px-4 py-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 rounded-full bg-muted">
                      <AvatarFallback className="rounded-full text-xs">
                        {(response.user_name?.[0] || 'A').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium flex items-center gap-1">
                        {response.user_name || 'Anonymous'} 
                        {response.user_email && (
                          <span className="text-xs text-muted-foreground">&lt;{response.user_email}&gt;</span>
                        )}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        To: support@userbird.co
                      </div>
                    </div>
                  </div>
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
              </div>
              <div className="p-3 text-sm email-content preserve-breaks" 
                dangerouslySetInnerHTML={{ __html: response.message.trim() }} 
              />
            </div>
            
            {/* Reply messages */}
            {groupConsecutiveAssignmentEvents(replies).map((replyOrGroup, index) => {
              // Check if this is a group of assignment events
              if (Array.isArray(replyOrGroup)) {
                return (
                  <div key={`assignment-group-${index}`} className="space-y-0 py-1 mb-4">
                    {replyOrGroup.map((assignmentReply) => renderAssignmentEvent(assignmentReply))}
                  </div>
                );
              }
              
              const reply = replyOrGroup;
              
              // Normal reply rendering
              console.log('Rendering regular reply');
              const { mainContent, quotedContent } = processHtmlContent(reply.html_content);
              const isExpanded = expandedReplies.has(reply.id);
              
              return (
                <div
                  key={reply.id}
                  className="border border-border rounded-md overflow-hidden bg-background mb-4"
                >
                  <div className={`border-b border-border ${reply.sender_type === 'admin' ? 'bg-primary/5' : 'bg-muted/20'} px-4 py-3`}>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        {reply.sender_type === 'admin' ? (
                          <Avatar className="h-8 w-8 rounded-full">
                            {adminAvatarUrl ? (
                              <img src={adminAvatarUrl} alt={adminName} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <AvatarFallback className="rounded-full text-xs">{adminInitials}</AvatarFallback>
                            )}
                          </Avatar>
                        ) : (
                          <Avatar className="h-8 w-8 rounded-full bg-muted">
                            <AvatarFallback className="rounded-full text-xs">
                              {(response.user_name?.[0] || 'A').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium flex items-center gap-1">
                            {reply.sender_type === 'admin' ? (
                              <>
                                {adminName} <span className="text-xs text-muted-foreground">&lt;support@userbird.co&gt;</span>
                              </>
                            ) : (
                              <>
                                {response.user_name || 'Anonymous'} 
                                {response.user_email && (
                                  <span className="text-xs text-muted-foreground">&lt;{response.user_email}&gt;</span>
                                )}
                              </>
                            )}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {reply.sender_type === 'admin' ? (
                              <>To: {response.user_name || 'Anonymous'} {response.user_email && `<${response.user_email}>`}</>
                            ) : (
                              <>To: support@userbird.co</>
                            )}
                          </div>
                        </div>
                      </div>
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
                  </div>
                  
                  <div className="p-3 text-sm">
                    {reply.html_content ? (
                      <div className="space-y-1 overflow-hidden">
                        {/* Show the main content with button */}
                        <div>
                          <div className="overflow-x-auto break-words whitespace-pre-wrap preserve-breaks email-content" dangerouslySetInnerHTML={{ __html: mainContent.trim() }} />
                          {quotedContent && (
                            <button
                              onClick={() => toggleQuotedContent(reply.id)}
                              className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-2.5"
                              title={isExpanded ? "Hide quoted text" : "Show quoted text"}
                              aria-label={isExpanded ? "Hide quoted text" : "Show quoted text"}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        
                        {/* Quoted content - only shown when expanded */}
                        {quotedContent && isExpanded && (
                          <div 
                            className="border-l-2 pl-2 text-muted-foreground overflow-x-auto whitespace-pre-wrap email-content preserve-breaks mt-1" 
                            dangerouslySetInnerHTML={{ __html: quotedContent }}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{reply.content}</p>
                    )}
                    
                    {/* Display attachments */}
                    {reply.attachments && reply.attachments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <Paperclip size={12} />
                          <span>Attachments ({reply.attachments.length})</span>
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
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Reply section - sticky at bottom */}
        {response.user_email && (
          <div className="p-4 sticky bottom-0 bg-muted/20 flex-shrink-0">
            <div className="max-w-[40rem] mx-auto w-full">
              <div className="rounded-md overflow-hidden">
                <div className="flex items-center px-0 py-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 rounded-full">
                      {adminAvatarUrl ? (
                        <img src={adminAvatarUrl} alt={adminName} className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="rounded-full text-xs">{adminInitials}</AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-sm font-medium">
                      Reply as {adminName} <span className="text-muted-foreground">&lt;support@userbird.co&gt;</span>
                    </span>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Press <span className="font-semibold">R</span> to focus
                    </span>
                  </div>
                </div>
                <div className="py-2">
                  <div className="p-[1px]" ref={editorRef}>
                    <TiptapEditor
                      value={replyContent}
                      onChange={setReplyContent}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your reply..."
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center px-0 py-1">
                  <div></div>
                  <div className="flex gap-2">
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
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground flex items-center">
                        {navigator.platform.includes('Mac') ? <Command className="inline h-3 w-3" /> : 'Ctrl'} <CornerDownLeft className="inline h-3 w-3 ml-0.5" />
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
) 