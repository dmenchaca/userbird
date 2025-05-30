import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Paperclip, Send, CornerDownLeft, Command, MoreHorizontal, UserPlus, Sparkles, Loader, StopCircle, Tag, Zap, XCircle, AlertTriangle, Info, ZoomIn, ZoomOut, Download, X } from 'lucide-react'
import { Button } from './ui/button'
import { FeedbackResponse, FeedbackReply, FeedbackAttachment, FeedbackTag } from '@/lib/types/feedback'
import { supabase } from '@/lib/supabase'
import { TiptapEditor } from './tiptap-editor'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { toast } from 'sonner'
import { format, isToday } from 'date-fns'
import { getTagColors } from '@/lib/utils/colors'
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { FeedbackImage } from "../../app/components/FeedbackImage"
import { ConsoleLogsDialog } from './console-logs-dialog'

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
  availableTags?: FeedbackTag[]
}

export interface ConversationThreadRef {
  focusReplyBox: () => void
}

export const ConversationThread = forwardRef<ConversationThreadRef, ConversationThreadProps>(
  ({ response, onStatusChange, collaborators = [], availableTags }, ref) => {
    if (!response) return null

    const { user } = useAuth()
    const [replyContent, setReplyContent] = useState('')
    const [replies, setReplies] = useState<FeedbackReply[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGeneratingAIReply, setIsGeneratingAIReply] = useState(false)
    const [aiReplyGenController, setAiReplyGenController] = useState<AbortController | null>(null)
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
    const editorRef = useRef<HTMLDivElement>(null)
    const [productName, setProductName] = useState('Userbird')
    const [supportEmail, setSupportEmail] = useState('support@userbird.co')
    const { resolvedTheme } = useTheme()
    const [showImagePreview, setShowImagePreview] = useState(false)
    const [showConsoleLogsDialog, setShowConsoleLogsDialog] = useState(false)
    const [imageZoom, setImageZoom] = useState(100)

    // Calculate log counts for the button
    let errorCount = 0;
    let warningCount = 0;
    let infoLogCount = 0;

    if (response.metadata?.consoleLogs && response.metadata.consoleLogs.length > 0) {
      response.metadata.consoleLogs.forEach(log => {
        const level = log.level?.toLowerCase();
        if (['error', 'uncaught', 'unhandledrejection'].includes(level)) {
          errorCount++;
        } else if (level === 'warn') {
          warningCount++;
        } else {
          infoLogCount++;
        }
      });
    }

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
    const adminName = user?.user_metadata?.full_name || user?.email || '';
    const adminInitials = adminName?.[0]?.toUpperCase() || '?';
    const adminAvatarUrl = user?.user_metadata?.avatar_url
    
    // Get the admin's first name for the sender display
    const getFirstName = (displayName: string): string => {
      if (!displayName) return '';
      
      // If the name contains an @ symbol, it's likely an email address
      if (displayName.includes('@')) {
        return displayName.split('@')[0]; // Return part before @
      }
      
      // Otherwise, take the first word as the first name
      return displayName.split(' ')[0];
    }
    
    // Validate if a name is usable as an admin name
    const isValidAdminName = (name: string | null | undefined): boolean => {
      if (!name) return false;
      
      // Convert to string and trim
      const trimmedName = String(name).trim().toLowerCase();
      
      // Check for empty string
      if (trimmedName === '') return false;
      
      // Check for minimum length
      if (trimmedName.length < 2) return false;
      
      // Check for generic/default names
      const invalidNames = ['admin', 'administrator', 'support', 'user', 'customer', 'help', 'service'];
      if (invalidNames.includes(trimmedName)) return false;
      
      // Valid name
      return true;
    };
    
    const adminFirstName = getFirstName(adminName)

    // Check if we have a valid admin name to use for AI generation
    const hasValidAdminName = isValidAdminName(adminFirstName);
    
    // Use a ref to track if the component has been re-rendered with different values
    const adminNameRef = useRef(adminName)
    const adminFirstNameRef = useRef(adminFirstName)
    
    // Check for inconsistencies during renders
    if (adminNameRef.current !== adminName) {
      console.log(`[Conversation Thread] WARNING: adminName changed from "${adminNameRef.current}" to "${adminName}"`)
      adminNameRef.current = adminName
    }
    
    if (adminFirstNameRef.current !== adminFirstName) {
      console.log(`[Conversation Thread] WARNING: adminFirstName changed from "${adminFirstNameRef.current}" to "${adminFirstName}"`)
      adminFirstNameRef.current = adminFirstName
    }

    // Add a useEffect to watch for user data changes and update admin name information
    // This solves the issue when loading directly to a ticket URL
    const [cachedAdminFirstName, setCachedAdminFirstName] = useState(adminFirstName);
    const [cachedHasValidName, setCachedHasValidName] = useState(hasValidAdminName);

    useEffect(() => {
      // When user data changes, update our admin name values
      if (user) {
        // Recalculate admin name info from user data
        const updatedAdminName = user.user_metadata?.full_name || user.email || '';
        const updatedAdminFirstName = getFirstName(updatedAdminName);
        const updatedHasValidName = isValidAdminName(updatedAdminFirstName);
        
        // Update our cached values for use in the component
        setCachedAdminFirstName(updatedAdminFirstName);
        setCachedHasValidName(updatedHasValidName);
        
        // Update refs to avoid unnecessary warnings
        adminNameRef.current = updatedAdminName;
        adminFirstNameRef.current = updatedAdminFirstName;
      }
    }, [user, isValidAdminName]); // Only re-run when user object changes

    useEffect(() => {
      if (response) {
        fetchReplies()
        const channel = subscribeToReplies()
        
        // Set up an interval to periodically check for new replies
        const refreshInterval = setInterval(() => {
          fetchReplies()
        }, 5000) // Check every 5 seconds
        
        // Fetch the product name for the form if form_id exists
        if (response.form_id) {
          fetchFormData(response.form_id)
        }
        
        // Set up global keyboard shortcut for AI reply generation
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
          // Generate AI reply with Ctrl+J or Command+J (even when editor is not focused)
          if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
            // Only if we're not already generating and there is a response to work with
            if (!isGeneratingAIReply && !isSubmitting && response) {
              e.preventDefault();
              // Check cached admin name validity before proceeding
              if (!cachedHasValidName) {
                toast.error('Cannot generate AI reply: Please update your profile with a valid name (not "Admin" or "Support").');
                return;
              }
              generateAIReply();
            }
          }
        };
        
        // Add the global event listener
        window.addEventListener('keydown', handleGlobalKeyDown);
        
        return () => {
          supabase.removeChannel(channel)
          clearInterval(refreshInterval)
          window.removeEventListener('keydown', handleGlobalKeyDown);
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [response?.id, isGeneratingAIReply, isSubmitting, cachedHasValidName, cachedAdminFirstName])

    useEffect(() => {
      // When response changes, reset the reply content and image zoom
      setReplyContent('')
      setImageZoom(100)
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
        
        // Filter out system entries - we don't want to display those in the conversation
        // These are typically used for storing references to external systems like Slack threads
        // and shouldn't appear in the user interface
        const filteredReplies = repliesData ? repliesData.filter(reply => reply.sender_type !== 'system') : [];
        
        // Reverse to get chronological order (oldest first)
        const chronologicalReplies = filteredReplies ? [...filteredReplies].reverse() : [];
        
        // Get unique sender_ids for fetching profiles
        const senderIds = chronologicalReplies
          .filter(reply => reply.sender_id)
          .map(reply => reply.sender_id)
          .filter((id, index, self) => id && self.indexOf(id) === index) as string[];
        
        // Fetch user profiles for senders if we have any sender_ids
        let profilesByUserId: Record<string, any> = {};
        
        if (senderIds.length > 0) {
          // Use RPC to call the get_user_profile_by_id function for each sender ID
          const profiles = await Promise.all(
            senderIds.map(async (senderId) => {
              const { data, error } = await supabase
                .rpc('get_user_profile_by_id', { user_id_param: senderId });
                
              if (error) {
                console.error(`Error fetching profile for user ${senderId}:`, error);
                return null;
              }
              
              return data && data.length > 0 ? data[0] : null;
            })
          );
          
          // Create a map of user_id to profile, filtering out nulls
          profilesByUserId = profiles
            .filter(Boolean)
            .reduce((acc, profile) => {
              // Use profile_user_id as the key (that's how the function returns it)
              acc[profile.profile_user_id] = {
                user_id: profile.profile_user_id,
                username: profile.username,
                avatar_url: profile.avatar_url,
                email: profile.email
              };
              return acc;
            }, {} as Record<string, any>);
        }
        
        // Process the replies to include user information when available
        const processedReplies = chronologicalReplies.map(reply => {
          // Add sender profile information if available
          const senderProfile = reply.sender_id ? profilesByUserId[reply.sender_id] : null;
          
          return {
            ...reply,
            // Include profile data if we have it
            sender_profile: senderProfile || null,
            // These will be null since we're not fetching the related data
            assigned_to_user: null,
            assigned_by_user: null
          };
        });
        
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
      if (!replyContent.trim()) return
      
      setIsSubmitting(true)
      try {
        // Convert rich text content to HTML format with proper line breaks
        // This ensures AI-generated content with newlines is properly preserved
        let htmlContent = replyContent;
        
        // Check if the content is already HTML (starts with a div or contains HTML tags)
        const isHtml = /^<div|<br|<p/.test(htmlContent) || /<\/?[a-z][\s\S]*>/i.test(htmlContent);
        
        // If it's not already HTML, convert plain text with newlines to HTML
        if (!isHtml) {
          // Escape any HTML content that might be in the text
          htmlContent = htmlContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            
          // Use a single div with <br> tags for newlines instead of multiple divs
          // This preserves the line breaks in a visually consistent way, and add an extra <br> for spacing
          htmlContent = `<div>${htmlContent.replace(/\n/g, '<br>')}</div><br>`;
        } else {
          // For HTML content, ensure we're using <br> tags for line breaks rather than separate divs
          // This ensures consistent rendering in email clients
          htmlContent = htmlContent
            .replace(/<\/div>\s*<div>/g, '<br>') // Replace adjacent divs with <br>
            .replace(/<div><\/div>/g, '<br>'); // Replace empty divs with <br>
            
          // Ensure we have a wrapping div
          if (!htmlContent.startsWith('<div>')) {
            htmlContent = `<div>${htmlContent}</div>`;
          }
          
          // Add an extra <br> after the content for spacing in emails
          htmlContent = `${htmlContent}<br>`;
        }
        
        // Get the message ID to respond to (for email threading)
        let lastReplyMessageId: string | null = null;
        
        // If this is a reply to another message, append the previous message as blockquote
        if (replies.length > 0) {
          // Get the most recent message to quote
          const lastReply = replies[replies.length - 1]; // Use the last reply for quoting
          // Store the message ID of the last reply (for email threading)
          lastReplyMessageId = lastReply.message_id || null;
          
          const senderEmail = lastReply.sender_type === 'user' ? response.user_email : supportEmail;
          
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
            <div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On ${replyDate}, &lt;${senderEmail}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid hsl(var(--border));padding-left:1ex">
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
          const lastReply = replies[replies.length - 1];
          const senderEmail = lastReply.sender_type === 'user' ? response.user_email : supportEmail;
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
        
        // Create the reply data object with proper in_reply_to field for email threading
        const replyData: any = {
          feedback_id: response.id,
          sender_type: 'admin',
          content: plainTextContent.trim(),
          html_content: htmlContent,
          sender_id: user?.id
        };
        
        // Add in_reply_to if we have a last reply message ID
        if (lastReplyMessageId) {
          replyData.in_reply_to = lastReplyMessageId;
        }
        
        const { data, error } = await supabase
          .from('feedback_replies')
          .insert([replyData])
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
              isAdminDashboardReply: true,
              productName: productName
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
      // Don't capture cmd/ctrl+R (browser refresh)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        return; // Let the browser handle the refresh
      }
      
      // Send on Ctrl+Enter or Command+Enter, but only if there's content
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        // Prevent default behavior immediately to avoid adding a new line
        e.preventDefault();
        e.stopPropagation();
        
        // Only send if there's content
        if (replyContent.trim()) {
          handleSendReply();
        }
      }
      
      // Generate AI reply with Ctrl+J or Command+J - only needed for when editor is focused
      // The global event listener handles this for when it's not focused
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        e.stopPropagation();
        
        // Only generate if not already generating
        if (!isGeneratingAIReply && !isSubmitting) {
          generateAIReply();
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
            
            // Clean up trailing whitespace/breaks in the main content, but preserve intentional breaks
            // First check if this is an email-like message with greeting/signature
            const hasGreeting = /Hi\s+\w+,/i.test(mainContent);
            const hasSignature = /Best,|Regards,|Thanks,|Cheers,/i.test(mainContent);
            
            if (hasGreeting || hasSignature) {
              // Only clean up trailing whitespace at the very end
              // This preserves intentional line breaks after greeting and before signature
              mainContent = mainContent.replace(/\s*<br\s*\/?>\s*<br\s*\/?>\s*$/gi, '');
              mainContent = mainContent.replace(/\s*(<div><br\s*\/?><\/div>\s*)+$/gi, '');
            } else {
              // For non-email content, apply the original cleaning logic
              mainContent = mainContent.replace(/<br\s*\/?>\s*<br\s*\/?>\s*$/gi, '');
              mainContent = mainContent.replace(/(<div><br\s*\/?><\/div>\s*)+$/gi, '');
            }
            
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

    // Near the top of the component, update the grouping function
    const groupConsecutiveSystemEvents = (replies: FeedbackReply[]) => {
      const groupedReplies: (FeedbackReply | FeedbackReply[])[] = [];
      let currentSystemGroup: FeedbackReply[] = [];

      replies.forEach((reply) => {
        // We only consider assignment and tag_change as system events for grouping
        // (system sender_type entries are already filtered out)
        if (reply.type === 'assignment' || reply.type === 'tag_change') {
          // Add to current system event group
          currentSystemGroup.push(reply);
        } else {
          // If we have system events in the group, add them first
          if (currentSystemGroup.length > 0) {
            groupedReplies.push([...currentSystemGroup]);
            currentSystemGroup = [];
          }
          // Add the regular reply
          groupedReplies.push(reply);
        }
      });

      // Add any remaining system events
      if (currentSystemGroup.length > 0) {
        groupedReplies.push([...currentSystemGroup]);
      }

      return groupedReplies;
    };

    // Helper to format time ago (shorter format)
    const formatTimeAgo = (dateString: string) => {
      try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        // If less than a minute ago, show "now"
        if (diffInSeconds < 60) {
          return "now";
        }
        
        if (isToday(date)) {
          return format(date, 'h:mm a') // Format as "2:04 PM"
        } else {
          return format(date, 'MMM d') // Format as "Mar 5"
        }
      } catch (error) {
        return 'unknown date'
      }
    }

    // Add the tag change event renderer
    const renderTagChangeEvent = (reply: FeedbackReply) => {
      // Format date in a readable format
      const formattedDate = formatTimeAgo(reply.created_at);
      
      // Determine preposition based on whether it's today or not
      // Skip preposition entirely when date is "now"
      const preposition = formattedDate === "now" ? '' : isToday(new Date(reply.created_at)) ? 'at' : 'on';
      
      // Extract tag change info from meta
      const action = reply.meta?.action || 'changed';
      const tagId = reply.meta?.tag_id;
      const oldTagId = reply.meta?.old_tag_id;
      const source = reply.meta?.source; // 'ai' for auto-tagged
      
      // Find tag info from availableTags
      const tag = tagId ? availableTags?.find(t => t.id === tagId) : null;
      const oldTag = oldTagId ? availableTags?.find(t => t.id === oldTagId) : null;
      
      // Check if this is an AI-generated tag
      const isAiTagged = reply.sender_type === 'ai' || source === 'ai';
      
      // Get sender name - same approach as in assignment
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

      // Render the tag name with its color when available
      const renderTagBadge = (tagInfo: FeedbackTag | null | undefined) => {
        if (!tagInfo) return "a label";
        
        // Get tag colors using the same function as inbox
        const isDarkMode = resolvedTheme === "dark";
        const colors = getTagColors(tagInfo.color, isDarkMode);
        
        return (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
            style={{ 
              backgroundColor: colors.background,
              color: colors.text
            }}
          >
            {tagInfo.name}
          </span>
        );
      };

      return (
        <div key={reply.id} className="max-w-[40rem] mx-auto w-full flex items-center gap-2 py-0.5">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            {isAiTagged ? (
              <Zap className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Tag className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {isAiTagged ? (
              <>
                Auto-labeled as {renderTagBadge(tag)} {preposition && <>{preposition} </>}{formattedDate}
              </>
            ) : action === 'removed' ? (
              <>
                <span className="font-medium">{senderName}</span> removed {renderTagBadge(oldTag)} {preposition} {formattedDate}
              </>
            ) : action === 'added' ? (
              <>
                <span className="font-medium">{senderName}</span> added {renderTagBadge(tag)} {preposition} {formattedDate}
              </>
            ) : (
              <>
                <span className="font-medium">{senderName}</span> changed label from {renderTagBadge(oldTag)} to {renderTagBadge(tag)} {preposition} {formattedDate}
              </>
            )}
          </div>
        </div>
      );
    };

    // Render assignment event
    const renderAssignmentEvent = (reply: FeedbackReply) => {
      // Format date in a readable format
      const formattedDate = formatTimeAgo(reply.created_at);
      
      // Determine preposition based on whether it's today or not
      const preposition = isToday(new Date(reply.created_at)) ? 'at' : 'on';
      
      // Extract assignment info
      const isUnassignment = !reply.assigned_to;
      
      // Get assignee name - check user info if it's current user
      let assigneeName = 'Unknown';
      
      if (user && reply.assigned_to === user.id) {
        assigneeName = user.user_metadata?.full_name || user.email || 'Admin';
      }
      else if (reply.assigned_to && collaborators.length > 0) {
        const assigneeCollaborator = collaborators.find(c => c.user_id === reply.assigned_to);
        if (assigneeCollaborator) {
          assigneeName = 
            assigneeCollaborator.user_profile?.username || 
            assigneeCollaborator.invitation_email?.split('@')[0] || 
            'User';
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
        <div key={reply.id} className="max-w-[40rem] mx-auto w-full flex items-center gap-2 py-0.5">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            <UserPlus className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">
            {isUnassignment ? (
              <>
                <span className="font-medium">{senderName}</span> removed ticket assignment {preposition} {formattedDate}
              </>
            ) : (
              <>
                Assigned to <span className="font-medium">{assigneeName}</span> by <span className="font-medium">{senderName}</span> {preposition} {formattedDate}
              </>
            )}
          </div>
        </div>
      );
    };

    // Add a function to fetch form data
    const fetchFormData = async (formId: string) => {
      try {
        // First try to get the form data
        const { data, error } = await supabase
          .from('forms')
          .select('product_name, url, default_email')
          .eq('id', formId)
          .single()
          
        if (error) {
          console.error('Error fetching form data:', error)
          return
        }
        
        if (data && data.product_name) {
          setProductName(data.product_name)
        } else if (data && data.url) {
          // Use the URL if no product name is set
          setProductName(data.url)
        }

        // Now try to get custom email from custom_email_settings if available
        const { data: customEmailData, error: customEmailError } = await supabase
          .from('custom_email_settings')
          .select('custom_email')
          .eq('form_id', formId)
          .eq('verified', true)
          .single()

        if (!customEmailError && customEmailData?.custom_email) {
          // Use verified custom email if available
          setSupportEmail(customEmailData.custom_email)
        } else if (data?.default_email) {
          // Fallback to default email from form
          setSupportEmail(data.default_email)
        }
        // If neither is available, we keep the default 'support@userbird.co'
      } catch (error) {
        console.error('Error fetching form data:', error)
      }
    }

    // Add AI reply generation function
    const generateAIReply = async () => {
      if (isGeneratingAIReply || isSubmitting) return;
      
      // Use the cached value that gets updated when user data changes
      if (!cachedHasValidName) {
        toast.error('Cannot generate AI reply: Please update your profile with a valid name (not "Admin" or "Support").');
        return;
      }
      
      // Clear any existing content in the editor
      setReplyContent('');
      setIsGeneratingAIReply(true);
      
      console.log("=== CLIENT: Starting AI reply generation ===");
      console.log(`=== CLIENT: Using admin first name from cached state: "${cachedAdminFirstName}" ===`);
      console.log(`=== CLIENT: User metadata:`, user?.user_metadata, `===`);
      
      // Ensure we're using the correct admin name - recalculate it here to be sure
      const currentAdminName = user?.user_metadata?.full_name || user?.email || '';
      const currentAdminFirstName = getFirstName(currentAdminName);
      console.log(`=== CLIENT: Re-calculated admin first name: "${currentAdminFirstName}" ===`);
      
      // Validate admin name again to be extra safe
      if (!isValidAdminName(currentAdminFirstName)) {
        toast.error('Cannot generate AI reply: Please update your profile with a valid name (not "Admin" or "Support").');
        setIsGeneratingAIReply(false);
        return;
      }
      
      try {
        // Create abort controller for cancellation
        const controller = new AbortController();
        setAiReplyGenController(controller);
        
        // Use the admin name without any fallbacks
        const adminNameToSend = currentAdminFirstName.trim();
          
        console.log(`=== CLIENT: Using admin name for API request: "${adminNameToSend}" ===`);
          
        const requestBody = { 
          feedback_id: response.id,
          admin_first_name: adminNameToSend // Use the validated name
        };
        console.log("=== CLIENT: Request body:", JSON.stringify(requestBody), "===");
        
        // Intercept the original fetch to log details
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
          console.log("=== CLIENT: Fetch called with:", JSON.stringify(args), "===");
          
          // Restore original fetch to avoid recursive interception
          window.fetch = originalFetch;
          
          // Call the original fetch
          const result = await originalFetch.apply(this, args);
          
          // Log response information for debugging
          console.log(`=== CLIENT: Fetch response status: ${result.status} ===`);
          
          return result;
        };
        
        // Call the generate-reply edge function
        const streamResponse = await fetch('/api/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        // Restore original fetch
        window.fetch = originalFetch;
        
        if (!streamResponse.ok) {
          throw new Error(`Failed to generate reply: ${streamResponse.statusText}`);
        }
        
        if (!streamResponse.body) {
          throw new Error('No response body from AI generation');
        }
        
        // Process the streaming response
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedContent = '';
        
        console.log("=== CLIENT: Stream connection established ===");
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // We're done with the stream
            console.log("=== CLIENT: Stream complete ===");
            console.log("=== CLIENT: Final content from stream ===");
            // Log with visible line breaks
            console.log(accumulatedContent.replace(/\n/g, "\\n"));
            console.log("Line breaks count:", (accumulatedContent.match(/\n/g) || []).length);
            break;
          }
          
          // Decode the chunk and process it
          const chunk = decoder.decode(value, { stream: true });
          console.log(`=== CLIENT: Received chunk (${chunk.length} chars) ===`);
          
          // Process full chunk first
          if (chunk.includes('event: full_replacement')) {
            try {
              // Extract the JSON data from the full_replacement event
              const fullReplaceMatch = chunk.match(/event: full_replacement\ndata: (.*?)(?:\n\n|$)/s);
              if (fullReplaceMatch && fullReplaceMatch[1]) {
                const jsonData = JSON.parse(fullReplaceMatch[1]);
                if (jsonData.fullText) {
                  console.log("=== CLIENT: Processing full_replacement event ===");
                  accumulatedContent = jsonData.fullText;
                  setReplyContent(accumulatedContent);
                  console.log(`=== CLIENT: Full replacement applied ===`);
                  console.log(accumulatedContent.replace(/\n/g, "\\n"));
                  continue;
                }
              }
            } catch (e) {
              console.error('Error processing full_replacement event:', e);
            }
          }
          
          // Now process line by line
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            // Special event handling
            if (line.startsWith('event: full_replacement')) {
              try {
                // Extract the data portion
                const dataMatch = line.match(/data: (.*?)$/);
                if (dataMatch && dataMatch[1]) {
                  const jsonData = JSON.parse(dataMatch[1]);
                  if (jsonData.fullText) {
                    accumulatedContent = jsonData.fullText;
                    setReplyContent(accumulatedContent);
                    console.log(`=== CLIENT: Full replacement applied from event ===`);
                    console.log(accumulatedContent.replace(/\n/g, "\\n"));
                  }
                }
              } catch (e) {
                console.error('Error processing full_replacement event:', e);
              }
              continue;
            }
            
            if (line.startsWith('event: admin_name_correction')) {
              try {
                // Extract the data portion
                const dataMatch = line.match(/data: (.*?)$/);
                if (dataMatch && dataMatch[1]) {
                  const jsonData = JSON.parse(dataMatch[1]);
                  console.log(`=== CLIENT: Admin name correction: "${jsonData.original}" -> "${jsonData.replacement}" ===`);
                }
              } catch (e) {
                console.error('Error processing admin_name_correction event:', e);
              }
              continue;
            }
            
            if (line.startsWith('event: error')) {
              console.error('Error in AI generation:', line);
              throw new Error('Error generating AI reply');
            }
            
            if (line.startsWith('event: done')) {
              console.log('AI generation complete');
              continue;
            }
            
            // Standard data line processing
            if (line.startsWith('data: ')) {
              const data = line.substring(6); // Remove "data: " prefix
              
              // Check for done event
              if (data === '[DONE]') {
                console.log("=== CLIENT: Received [DONE] marker ===");
                continue;
              }
              
              try {
                // Check if this is JSON data for a special event
                JSON.parse(data);
                // If it parses without error but doesn't match any special event type,
                // we'll just skip it as it's likely metadata
                console.log(`=== CLIENT: Received JSON data, skipping as not content: ${data} ===`);
                continue;
              } catch (e) {
                // Not JSON, process as regular content
              }
              
              // Restore line breaks from special markers
              let processedData = data;
              if (data.includes("[[DOUBLE_NEWLINE]]") || data.includes("[[NEWLINE]]")) {
                processedData = data
                  .replace(/\[\[DOUBLE_NEWLINE\]\]/g, "\n\n")
                  .replace(/\[\[NEWLINE\]\]/g, "\n");
                console.log(`=== CLIENT: Restored line breaks in chunk ===`);
              }
              
              // Append this content to the editor
              accumulatedContent += processedData;
              setReplyContent(accumulatedContent);
            }
          }
        }
      } catch (error) {
        console.error('Error generating AI reply:', error);
        toast.error('Failed to generate an AI reply. Please try again.');
      } finally {
        setAiReplyGenController(null);
        setIsGeneratingAIReply(false);
      }
    };
    
    // Cancel ongoing AI reply generation
    const cancelAIReplyGeneration = () => {
      if (aiReplyGenController) {
        aiReplyGenController.abort();
        setAiReplyGenController(null);
        setIsGeneratingAIReply(false);
      }
    };

    // Image zoom functions
    const handleZoomIn = () => {
      setImageZoom(prev => Math.min(prev + 25, 300));
    };

    const handleZoomOut = () => {
      setImageZoom(prev => Math.max(prev - 25, 25));
    };

    const handleImageClick = () => {
      setImageZoom(prev => prev === 100 ? 150 : 100);
    };

    const handleDownload = () => {
      if (response.image_url) {
        const link = document.createElement('a');
        link.href = response.image_url;
        link.download = `feedback-attachment-${response.id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
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
              margin-top: 0.5em;
              margin-bottom: 0.5em;
            }
            /* Adjust first div for proper spacing */
            .email-content > div:first-child {
              margin-top: 0;
            }
            /* Adjust last div for proper spacing */
            .email-content > div:last-child {
              margin-bottom: 0;
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
              margin: 0.5em 0 !important; /* Increased from 0.25em to 0.5em for more spacing */
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
                        To: {supportEmail}
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
                dangerouslySetInnerHTML={{ 
                  __html: response.message.includes('<') && response.message.includes('>') 
                    ? response.message.trim() 
                    : response.message.trim().replace(/\n/g, '<br>')
                }} 
              />
              {/* Attachment Section: Renders if there's an image OR logs */}
              {(response.image_url || (response.metadata?.consoleLogs && response.metadata.consoleLogs.length > 0)) && (
                <div className="p-3 border-t border-border flex items-start space-x-4">
                  
                  {/* Image Display (if image_url exists) */}
                  {response.image_url && (
                    <div> 
                      <p className="text-xs text-muted-foreground mb-1">Attachment</p>
                      <Dialog open={showImagePreview} onOpenChange={(open) => {
                        setShowImagePreview(open);
                        if (!open) setImageZoom(100); // Reset zoom when closing
                      }}>
                        <DialogTrigger asChild>
                          <div className="cursor-pointer w-auto inline-block">
                            <FeedbackImage
                              imagePath={response.image_url}
                              alt="Feedback attachment thumbnail"
                              className="max-h-[3rem] max-w-[5rem] object-cover border rounded"
                            />
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 overflow-hidden focus:outline-none focus:ring-0" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                          <div className="relative flex flex-col h-full">
                                                        {/* Image container */}
                            <div className="flex-1 overflow-auto bg-black/5 dark:bg-black/20">
                              <div 
                                className="p-4"
                                style={{ 
                                  width: `${Math.max(100, imageZoom)}%`,
                                  height: `${Math.max(100, imageZoom)}%`,
                                  minWidth: '100%',
                                  minHeight: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <div 
                                  className={`transition-transform duration-200 ease-in-out select-none ${
                                    imageZoom === 100 ? 'cursor-zoom-in' : 'cursor-zoom-out'
                                  }`}
                                  style={{
                                    transform: `scale(${imageZoom / 100})`,
                                    transformOrigin: 'center center'
                                  }}
                                  onClick={handleImageClick}
                                >
                                  <FeedbackImage
                                    key={response.image_url} // Add key to prevent unnecessary re-renders
                                    imagePath={response.image_url}
                                    alt="Feedback attachment"
                                    className="max-h-[80vh] max-w-[80vw] object-contain cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                            
                                                         {/* Bottom controls - Notion style */}
                             <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                               <TooltipProvider disableHoverableContent>
                                 <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5 shadow-lg">
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button
                                         onClick={handleZoomOut}
                                         variant="ghost"
                                         size="sm"
                                         disabled={imageZoom <= 25}
                                         className="h-7 w-7 p-0 hover:bg-muted"
                                       >
                                         <ZoomOut className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top" className="text-xs">
                                       Zoom out
                                     </TooltipContent>
                                   </Tooltip>
                                   <span className="text-xs font-medium min-w-[45px] text-center px-2 text-muted-foreground">
                                     {imageZoom}%
                                   </span>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button
                                         onClick={handleZoomIn}
                                         variant="ghost"
                                         size="sm"
                                         disabled={imageZoom >= 300}
                                         className="h-7 w-7 p-0 hover:bg-muted"
                                       >
                                         <ZoomIn className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top" className="text-xs">
                                       Zoom in
                                     </TooltipContent>
                                   </Tooltip>
                                   <div className="w-px h-4 bg-border mx-1" />
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button
                                         onClick={handleDownload}
                                         variant="ghost"
                                         size="sm"
                                         className="h-7 w-7 p-0 hover:bg-muted"
                                       >
                                         <Download className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top" className="text-xs">
                                       Download image
                                     </TooltipContent>
                                   </Tooltip>
                                   <div className="w-px h-4 bg-border mx-1" />
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button
                                         onClick={() => setShowImagePreview(false)}
                                         variant="ghost"
                                         size="sm"
                                         className="h-7 w-7 p-0 hover:bg-muted"
                                       >
                                         <X className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top" className="text-xs">
                                       Close
                                     </TooltipContent>
                                   </Tooltip>
                                 </div>
                               </TooltipProvider>
                             </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {/* Console Logs Button Display (if logs exist) */}
                  {response.metadata?.consoleLogs && response.metadata.consoleLogs.length > 0 && (
                    <div> 
                      <p className="text-xs text-muted-foreground mb-1">
                        Console logs
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 px-2 py-1 text-xs flex items-center gap-2.5 whitespace-nowrap"
                        onClick={() => setShowConsoleLogsDialog(true)}
                      >
                        {errorCount > 0 && (
                          <span className="flex items-center">
                            <XCircle className="h-3.5 w-3.5 text-red-500 mr-1" />
                            {errorCount}
                          </span>
                        )}
                        {warningCount > 0 && (
                          <span className="flex items-center">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1" />
                            {warningCount}
                          </span>
                        )}
                        {infoLogCount > 0 && (
                          <span className="flex items-center">
                            <Info className="h-3.5 w-3.5 text-blue-500 mr-1" />
                            {infoLogCount}
                          </span>
                        )}
                      </Button>
                      
                      {/* Console Logs Dialog */}
                      {response.metadata?.consoleLogs && (
                        <ConsoleLogsDialog 
                          logs={response.metadata.consoleLogs}
                          open={showConsoleLogsDialog}
                          onOpenChange={setShowConsoleLogsDialog}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Reply messages */}
            {groupConsecutiveSystemEvents(replies).map((replyOrGroup, index) => {
              // Check if this is a group of system events
              if (Array.isArray(replyOrGroup)) {
                return (
                  <div key={`system-group-${index}`} className="space-y-0 py-1 mb-4">
                    {replyOrGroup.map((systemReply) => 
                      systemReply.type === 'assignment' 
                        ? renderAssignmentEvent(systemReply)
                        : renderTagChangeEvent(systemReply)
                    )}
                  </div>
                );
              }
              
              const reply = replyOrGroup;
              
              // Normal reply rendering
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
                            {/* Check if the reply has a sender_id that matches a collaborator */}
                            {reply.sender_id && reply.sender_id !== user?.id ? (
                              // Render collaborator avatar if available
                              (() => {
                                // First check if we have a sender_profile
                                if (reply.sender_profile?.avatar_url) {
                                  return <img src={reply.sender_profile.avatar_url} alt={reply.sender_profile.username || "Collaborator"} className="h-full w-full object-cover rounded-full" />;
                                }
                                
                                // Fall back to collaborator data if available
                                const senderCollaborator = collaborators.find(c => c.user_id === reply.sender_id);
                                if (senderCollaborator?.user_profile?.avatar_url) {
                                  return <img src={senderCollaborator.user_profile.avatar_url} alt={senderCollaborator.user_profile?.username || "Collaborator"} className="h-full w-full object-cover rounded-full" />;
                                } else {
                                  return <AvatarFallback className="rounded-full text-xs">
                                    {reply.sender_profile?.username?.[0]?.toUpperCase() ||
                                     senderCollaborator?.user_profile?.username?.[0]?.toUpperCase() || 
                                     senderCollaborator?.invitation_email?.[0]?.toUpperCase() || 'A'}
                                  </AvatarFallback>;
                                }
                              })()
                            ) : (
                              // Render current user avatar (fallback or when sender_id matches current user)
                              adminAvatarUrl ? (
                                <img src={adminAvatarUrl} alt={adminName || "Admin"} className="h-full w-full object-cover rounded-full" />
                              ) : (
                                <AvatarFallback className="rounded-full text-xs">{adminInitials}</AvatarFallback>
                              )
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
                                {/* Show collaborator name if this is a reply from a collaborator */}
                                {reply.sender_id && reply.sender_id !== user?.id ? (
                                  (() => {
                                    // First check if we have a sender_profile
                                    if (reply.sender_profile?.username) {
                                      // Get first name of the collaborator
                                      const collabName = reply.sender_profile.username;
                                      const collabFirstName = getFirstName(collabName);
                                      return `${collabFirstName} at ${productName}`;
                                    }
                                    
                                    // Fall back to collaborator data if available
                                    const senderCollaborator = collaborators.find(c => c.user_id === reply.sender_id);
                                    const collabName = senderCollaborator?.user_profile?.username || 
                                          senderCollaborator?.invitation_email?.split('@')[0] || 
                                          adminName;
                                    const collabFirstName = getFirstName(collabName);
                                    return `${collabFirstName} at ${productName}`;
                                  })()
                                ) : `${adminFirstName} at ${productName}`} <span className="text-xs text-muted-foreground">&lt;{supportEmail}&gt;</span>
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
                              <>To: {supportEmail}</>
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
                        <img src={adminAvatarUrl} alt={adminName || "Admin"} className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="rounded-full text-xs">{adminInitials}</AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-sm font-medium">
                      Reply as {cachedAdminFirstName || <span className="text-red-500">Set your name in profile</span>} at {productName} <span className="text-muted-foreground">&lt;{supportEmail}&gt;</span>
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
                  <div className="flex items-center space-x-2">
                    {/* AI Generation Button */}
                    {!isGeneratingAIReply ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={generateAIReply}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 text-xs"
                              disabled={isSubmitting || !cachedHasValidName}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Generate
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center" className="px-2 py-1">
                            <p className="text-sm font-medium text-muted-foreground flex items-center">
                              {!cachedHasValidName ? (
                                "Set your name in profile settings to use AI generation"
                              ) : (
                                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex items-center">
                                  {navigator.platform.includes('Mac') ? 
                                    <Command className="inline h-3 w-3" /> : 
                                    'Ctrl'} 
                                  <span className="ml-0.5">J</span>
                                </span>
                              )}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={cancelAIReplyGeneration}
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 text-xs"
                        >
                          <StopCircle className="h-3.5 w-3.5" />
                          Stop
                        </Button>
                        {!replyContent && (
                          <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
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