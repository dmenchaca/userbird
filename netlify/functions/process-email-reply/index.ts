import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as multipart from 'parse-multipart-data';
import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import fetch from 'node-fetch';
import { getSecretFromVault } from '../utils/vault';

// Log environment variables at startup
console.log('Process email reply function environment:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Define ParsedMail and Attachment interfaces since they're not exported from mailparser
interface ParsedMail {
  from?: { text?: string; value?: Array<{ address?: string; name?: string }> };
  to?: { text?: string; value?: Array<{ address?: string; name?: string }> };
  cc?: { text?: string; value?: Array<{ address?: string; name?: string }> };
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content?: Buffer;
    contentType?: string;
    contentDisposition?: string;
    contentId?: string;
    filename?: string;
  }>;
  messageId?: string;
  inReplyTo?: string;
  references?: string | string[];
}

// Add interface for attachment structure
interface EmailAttachment {
  filename: string;
  contentType: string;
  contentId?: string;
  data: Buffer;
  isInline: boolean;
  url?: string; // Add URL property for public access
}

// Add a global flag for table existence
let feedbackAttachmentsTableExists = true;

// Helper function to create new feedback from an email
async function createFeedbackFromEmail(
  parsedEmail: ParsedMail, 
  formId: string
): Promise<string | undefined> {
  try {
    console.log(`Creating new feedback from email for form ${formId}`);
    console.log('Email content analysis:', {
      hasHtml: !!parsedEmail.html,
      hasText: !!parsedEmail.text,
      htmlLength: parsedEmail.html?.length || 0,
      textLength: parsedEmail.text?.length || 0
    });
    
    // Get sender email and name
    const fromAddress = parsedEmail.from?.value?.[0]?.address || '';
    const fromName = parsedEmail.from?.value?.[0]?.name || '';
    
    if (!fromAddress) {
      console.error('Cannot create feedback: No sender email address found');
      return undefined;
    }
    
    // Extract message content - prefer HTML over text
    const content = parsedEmail.html || parsedEmail.text || '';
    console.log('Using content type:', parsedEmail.html ? 'HTML' : 'Text');
    
    // Create feedback record
    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        form_id: formId,
        message: content,
        user_email: fromAddress,
        user_name: fromName || undefined,
        status: 'open',
        operating_system: 'Unknown',
        screen_category: 'Unknown'
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating feedback from email:', error);
      return undefined;
    }
    
    console.log(`Created new feedback with ID: ${feedback.id}`, {
      formId,
      userEmail: fromAddress,
      userName: fromName,
      contentLength: content.length
    });

    return feedback.id;
  } catch (error) {
    console.error('Error in createFeedbackFromEmail:', error);
    return undefined;
  }
}

// Helper function to find feedback ID from message ID
async function findFeedbackIdFromMessageId(messageId: string): Promise<string | undefined> {
  try {
    // Extract feedback ID from our notification format: <feedback-notification-UUID@userbird.co>
    const feedbackNotificationMatch = messageId.match(/<feedback-notification-([a-f0-9-]+)@userbird\.co>/i);
    if (feedbackNotificationMatch) {
      const feedbackId = feedbackNotificationMatch[1];
      console.log('Found feedback ID in notification message ID:', feedbackId);
      return feedbackId;
    }
    
    // Extract feedback ID from our reply format: <reply-replyId-feedbackId@userbird.co>
    const replyMatch = messageId.match(/<reply-[a-f0-9-]+-([a-f0-9-]+)@userbird\.co>/i);
    if (replyMatch) {
      const feedbackId = replyMatch[1];
      console.log('Found feedback ID in reply message ID:', feedbackId);
      return feedbackId;
    }
    
    // Also check direct feedback reference format: <feedback-UUID@userbird.co>
    const feedbackDirectMatch = messageId.match(/<feedback-([a-f0-9-]+)@userbird\.co>/i);
    if (feedbackDirectMatch) {
      const feedbackId = feedbackDirectMatch[1];
      console.log('Found feedback ID in direct feedback message ID:', feedbackId);
      return feedbackId;
    }
    
    return undefined;
  } catch (error) {
    console.error('Error finding feedback ID from message ID:', error);
    return undefined;
  }
}

// Helper function to extract feedback ID from email
async function extractFeedbackId(parsedEmail: ParsedMail): Promise<string | undefined> {
  try {
    // Check In-Reply-To header first - most reliable indicator of a reply
    if (parsedEmail.inReplyTo) {
      console.log('Found In-Reply-To header:', parsedEmail.inReplyTo);
      const feedbackId = await findFeedbackIdFromMessageId(parsedEmail.inReplyTo);
      if (feedbackId) {
        console.log('Found feedback ID from In-Reply-To:', feedbackId);
        return feedbackId;
      }
    }

    // Check References header - second most reliable
    if (parsedEmail.references) {
      console.log('Found References header:', parsedEmail.references);
      const references = Array.isArray(parsedEmail.references) 
        ? parsedEmail.references 
        : [parsedEmail.references];
      
      for (const ref of references) {
        const feedbackId = await findFeedbackIdFromMessageId(ref);
        if (feedbackId) {
          console.log('Found feedback ID from References:', feedbackId);
          return feedbackId;
        }
      }
    }

    // Check recipient email addresses for form ID
    const toAddresses = parsedEmail.to?.value || [];
    const ccAddresses = parsedEmail.cc?.value || [];
    const allRecipients = [...toAddresses, ...ccAddresses];
    
    let formId: string | undefined;
    
    // Get the recipient email for direct lookup
    if (allRecipients.length > 0) {
      const firstRecipient = allRecipients[0].address?.toLowerCase().trim() || '';
      
      // Direct lookup by default_email - more efficient
      console.log('Looking up form directly by default_email:', firstRecipient);
      const { data: directMatchForm, error: directMatchError } = await supabase
        .from('forms')
        .select('id, default_email')
        .eq('default_email', firstRecipient)
        .single();
      
      if (directMatchForm) {
        console.log('Found direct match in database:', directMatchForm);
        formId = directMatchForm.id;
      } else if (directMatchError) {
        console.log('No direct match found for email:', firstRecipient);
        // No fallback to fetching all forms - this would not scale with large numbers of forms
      }
    }
    
    // Continue with the existing recipient loop
    for (const recipient of allRecipients) {
      if (!recipient.address) continue;
      
      const recipientEmail = recipient.address.toLowerCase().trim();
      console.log('Checking recipient:', recipientEmail);
      
      // Check for direct form email pattern - both old and new format
      const formEmailMatch = recipientEmail.match(/^([a-zA-Z0-9]+)@userbird-mail\.com$/i) || 
                             recipientEmail.match(/^support@([a-zA-Z0-9]+)\.userbird-mail\.com$/i) ||
                             recipientEmail.match(/^support-([a-zA-Z0-9]+)@userbird-mail\.com$/i);
      if (formEmailMatch) {
        // Extract form ID from original email to preserve case
        const originalFormIdMatch = recipient.address.match(/^([a-zA-Z0-9]+)@userbird-mail\.com$/i) ||
                                   recipient.address.match(/^support@([a-zA-Z0-9]+)\.userbird-mail\.com$/i) ||
                                   recipient.address.match(/^support-([a-zA-Z0-9]+)@userbird-mail\.com$/i);
        
        // Check if this is the old format (direct form ID) or new format (product name)
        const extractedValue = originalFormIdMatch ? originalFormIdMatch[1] : formEmailMatch[1];
        
        // If it's the old format (formid@userbird-mail.com), use the extracted value directly
        if (recipient.address.match(/^([a-zA-Z0-9]+)@userbird-mail\.com$/i)) {
          formId = extractedValue;
          console.log('Found case-sensitive form ID from old email pattern:', formId);
        } 
        // If it's any of the new formats (support@productname.userbird-mail.com or support-productname@userbird-mail.com), 
        // look up the form by default_email
        else {
          const incomingEmail = recipient.address.toLowerCase().trim();
          console.log('Looking up form by default_email:', incomingEmail);
          
          // More detailed logging for debugging
          console.log('Executing query: SELECT id FROM forms WHERE default_email = ' + incomingEmail);
          
          // Look up form ID by default_email
          const { data: formData, error: formLookupError } = await supabase
            .from('forms')
            .select('id')
            .eq('default_email', incomingEmail)
            .single();
            
          if (formLookupError) {
            console.error('Error looking up form by default_email:', formLookupError);
          }
            
          if (formData) {
            formId = formData.id;
            console.log('Found form ID from default_email lookup:', formId);
          } else {
            console.log('No form found with default_email:', incomingEmail);
            
            // Additional debug query - list forms with similar emails
            const { data: similarForms } = await supabase
              .from('forms')
              .select('id, default_email')
              .like('default_email', `%${incomingEmail.split('@')[0]}%`)
              .limit(5);
              
            console.log('Similar forms found:', similarForms || 'none');
          }
        }
        
        if (formId) break;
      }
      
      // Check for custom domain email
      const { data: customEmailSettings } = await supabase
        .from('custom_email_settings')
        .select('form_id')
        .eq('custom_email', recipientEmail)
        .eq('verified', true)
        .single();
      
      if (customEmailSettings) {
        console.log('Found matching custom email setting:', customEmailSettings);
        // Don't return here, continue looking for a feedback ID
      }
    }

    // Check email body for thread identifier - less reliable but still useful
    const text = parsedEmail.text || '';
    const threadMatch = text.match(/\[Thread: ([a-f0-9-]+)\]/i);
    if (threadMatch) {
      const threadId = threadMatch[1];
      console.log('Found thread ID in email body:', threadId);
      
      // Look up feedback ID from thread ID
      const { data: feedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('thread_id', threadId)
        .single();
        
      if (feedback) {
        console.log('Found feedback ID from thread ID:', feedback.id);
        return feedback.id;
      }
    }

    // Check email body for UUID pattern - least reliable
    const uuidMatch = text.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    if (uuidMatch) {
      const potentialId = uuidMatch[0];
      console.log('Found potential UUID in email body:', potentialId);
      
      // Verify this is a valid feedback ID
      const { data: feedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('id', potentialId)
        .single();
        
      if (feedback) {
        console.log('Found valid feedback ID from UUID:', feedback.id);
        return feedback.id;
      }
    }

    // Check email subject for UUID pattern - least reliable
    const subject = parsedEmail.subject || '';
    const subjectUuidMatch = subject.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    if (subjectUuidMatch) {
      const potentialId = subjectUuidMatch[0];
      console.log('Found potential UUID in subject:', potentialId);
      
      // Verify this is a valid feedback ID
      const { data: feedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('id', potentialId)
        .single();
        
      if (feedback) {
        console.log('Found valid feedback ID from subject UUID:', feedback.id);
        return feedback.id;
      }
    }

    console.log('No feedback ID found in email');
    return undefined;
  } catch (error) {
    console.error('Error extracting feedback ID:', error);
    return undefined;
  }
}

// Process and store parsed email attachments
async function processAttachments(
  parsedEmail: ParsedMail,
  feedbackId: string,
  replyId?: string
): Promise<{ attachments: EmailAttachment[], cidToUrlMap: Record<string, string> }> {
  const attachments: EmailAttachment[] = [];
  const cidToUrlMap: Record<string, string> = {};
  
  if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
    console.log(`Processing ${parsedEmail.attachments.length} attachments`);
    
    for (const attachment of parsedEmail.attachments) {
      const filename = attachment.filename || `attachment-${Date.now()}.${attachment.contentType?.split('/')[1] || 'bin'}`;
      const contentId = attachment.contentId ? attachment.contentId.replace(/[<>]/g, '') : undefined;
      const isInline = !!contentId || attachment.contentDisposition === 'inline';
      
      if (attachment.content) {
        try {
          // Create our attachment structure
          const emailAttachment: EmailAttachment = {
            filename,
            contentType: attachment.contentType || 'application/octet-stream',
            data: attachment.content,
            isInline,
          };
          
          if (contentId) {
            emailAttachment.contentId = contentId;
          }
          
          attachments.push(emailAttachment);
          console.log(`Processed attachment: ${filename}, size: ${attachment.content.length} bytes, isInline: ${isInline}`);
        } catch (error) {
          console.error(`Error processing attachment ${filename}:`, error);
        }
      }
    }
  }
  
  // Upload attachments to Supabase Storage and create mapping
  for (const attachment of attachments) {
    const shouldProcess = attachment.isInline || attachment.contentType.startsWith('image/');
    
    if (shouldProcess) {
      try {
        const filename = `${feedbackId}_${attachment.filename}`;
        const storagePath = `feedback-replies/${feedbackId}/${filename}`;
        
        // Check if storage bucket exists
        const { data: buckets, error: bucketsError } = await supabase
          .storage
          .listBuckets();
        
        const bucketName = 'userbird-attachments';
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (!bucketExists) {
          console.log(`Creating storage bucket: ${bucketName}`);
          // Create the bucket if it doesn't exist
          const { error: createBucketError } = await supabase
            .storage
            .createBucket(bucketName, {
              public: true // Make bucket publicly accessible
            });
          
          if (createBucketError) {
            console.error(`Error creating storage bucket: ${bucketName}`, createBucketError);
            continue;
          }
        }
        
        // Upload to Supabase Storage
        const { data, error } = await supabase
          .storage
          .from(bucketName)
          .upload(storagePath, attachment.data, {
            contentType: attachment.contentType,
            upsert: true
          });
        
        if (error) {
          console.error('Error uploading attachment to storage:', error);
          continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase
          .storage
          .from(bucketName)
          .getPublicUrl(storagePath);
        
        if (urlData && urlData.publicUrl) {
          // Store URL and handle content ID
          if (attachment.contentId) {
            console.log(`Generated public URL for ${attachment.contentId}: ${urlData.publicUrl}`);
            cidToUrlMap[attachment.contentId] = urlData.publicUrl;
          } else {
            // For attachments without content ID
            const cidKey = `generated-${attachment.filename}-${Date.now()}`;
            console.log(`Generated key ${cidKey} for attachment without content ID: ${urlData.publicUrl}`);
            cidToUrlMap[cidKey] = urlData.publicUrl;
          }
          
          // Set URL in the attachment object
          attachment.url = urlData.publicUrl;
          
          // Store attachment metadata if we have a valid replyId
          if (feedbackAttachmentsTableExists && replyId) {
            try {
              const attachmentId = crypto.randomUUID();
              
              // Prepare attachment data
              const attachmentData: any = {
                id: attachmentId,
                reply_id: replyId,
                filename: attachment.filename,
                url: urlData.publicUrl,
                is_inline: attachment.isInline
              };
              
              // Add optional fields if they exist
              if (attachment.contentId) {
                attachmentData.content_id = attachment.contentId;
              }
              if (attachment.contentType) {
                attachmentData.content_type = attachment.contentType;
              }
              
              const { error: insertError } = await supabase
                .from('feedback_attachments')
                .insert(attachmentData);
              
              if (insertError) {
                console.error('Error storing attachment metadata:', insertError);
              } else {
                console.log(`Successfully stored attachment metadata with ID: ${attachmentId}`);
              }
            } catch (insertErr) {
              console.error('Exception while inserting attachment metadata:', insertErr);
            }
          } else {
            console.log('Skipping attachment metadata storage because replyId is not available yet');
          }
        }
      } catch (error) {
        console.error('Error processing attachment:', error);
      }
    }
  }
  
  console.log(`Found ${Object.keys(cidToUrlMap).length} CID mappings from attachments`);
  
  return { attachments, cidToUrlMap };
}

// Replace CID references in HTML with public URLs
function replaceCidWithUrls(
  content: string, 
  cidToUrlMap: Record<string, string>, 
  attachments: EmailAttachment[] = []
): string {
  if (!content || (Object.keys(cidToUrlMap).length === 0 && attachments.length === 0)) return content;
  
  console.log('CID to URL mappings:', JSON.stringify(cidToUrlMap));
  
  // Replace <img src="cid:xxx"> format
  let result = content.replace(
    /<img\s+[^>]*src=(?:"|'|3D")cid:([^"']+)(?:"|'|")[^>]*>/gi,
    (match, cid) => {
      const publicUrl = cidToUrlMap[cid];
      if (publicUrl) {
        console.log(`Replacing cid:${cid} with ${publicUrl}`);
        return `<img src="${publicUrl}" alt="Email attachment" style="max-width: 100%;">`;
      }
      // If no matching URL found, replace with a placeholder
      return '[Image attachment]';
    }
  );
  
  // Handle any remaining attachments that aren't inline images but should be shown
  const nonInlineAttachments = attachments.filter(
    attachment => !attachment.isInline && attachment.url
  );
  
  if (nonInlineAttachments.length > 0) {
    console.log(`Adding ${nonInlineAttachments.length} non-inline attachments`);
    
    // If any content exists, add a separator
    if (result.trim().length > 0) {
      result += '<br><br><div class="attachments-section">';
    }
    
    // Add each attachment
    for (const attachment of nonInlineAttachments) {
      if (attachment.url) {
        // For images, display them
        if (attachment.contentType.startsWith('image/')) {
          result += `<div class="attachment">
            <img src="${attachment.url}" alt="${attachment.filename}" style="max-width: 100%;">
            <div class="attachment-name">${attachment.filename}</div>
          </div>`;
        } else {
          // For other files, add a download link
          result += `<div class="attachment">
            <a href="${attachment.url}" target="_blank" download="${attachment.filename}">
              ${attachment.filename}
            </a>
          </div>`;
        }
      }
    }
    
    if (result.trim().length > 0) {
      result += '</div>';
    }
  }
  
  return result;
}

// Convert HTML to Slack's mrkdwn format
function convertHtmlToSlack(html: string): string {
  if (!html) return '';
  
  let slackText = html
    // Remove most HTML tags, keep their content
    .replace(/<(?!\/?(strong|b|em|i|del|s|pre|code|a)(?=>|\s[^>]*>))([^>])*>/gi, '')
    
    // Convert paragraph and line breaks to newlines
    .replace(/<\/p>\s*<p[^>]*>|<br\s*\/?>/gi, '\n')
    
    // Convert bold
    .replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '*$2*')
    
    // Convert italic
    .replace(/<(em|i)>(.*?)<\/(em|i)>/gi, '_$2_')
    
    // Convert strikethrough
    .replace(/<(del|s)>(.*?)<\/(del|s)>/gi, '~$2~')
    
    // Convert code blocks
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```$1```')
    
    // Convert inline code
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    
    // Convert links - handle both <a href="url">text</a> and <a href="url" target="_blank">text</a>
    .replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, '<$1|$2>')
    
    // Remove any remaining HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Replace HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  
  // Limit length to avoid Slack message limits
  const maxLength = 3000;
  if (slackText.length > maxLength) {
    slackText = slackText.substring(0, maxLength) + '... (message truncated)';
  }
  
  return slackText;
}

// Helper function to send reply to Slack thread
async function sendReplyToSlackThread(
  feedbackId: string,
  replyContent: string,
  senderName: string
): Promise<boolean> {
  try {
    console.log(`Checking if feedback ${feedbackId} has an associated Slack thread`);
    
    // First, get the form_id for this feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('form_id')
      .eq('id', feedbackId)
      .single();
    
    if (feedbackError || !feedback) {
      console.error('Error finding feedback:', feedbackError);
      return false;
    }
    
    // Look for a feedback_reply with Slack thread reference
    const { data: threadRefs, error: threadError } = await supabase
      .from('feedback_replies')
      .select('meta')
      .eq('feedback_id', feedbackId)
      .eq('meta->is_slack_reference', true)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (threadError) {
      console.error('Error finding Slack thread reference:', threadError);
      return false;
    }
    
    // No thread reference found, can't append to Slack
    if (!threadRefs || threadRefs.length === 0 || !threadRefs[0].meta) {
      console.log('No Slack thread found for this feedback');
      return false;
    }
    
    const meta = threadRefs[0].meta as any;
    if (!meta.slack_thread_ts || !meta.slack_channel_id) {
      console.log('Incomplete Slack thread reference:', meta);
      return false;
    }
    
    // Get the Slack integration for this form
    const { data: slackIntegration, error: slackError } = await supabase
      .from('slack_integrations')
      .select('bot_token, bot_token_id')
      .eq('form_id', feedback.form_id)
      .eq('enabled', true)
      .single();
    
    if (slackError || !slackIntegration) {
      console.error('Error finding Slack integration:', slackError);
      return false;
    }
    
    // Get the bot token - either from Vault using bot_token_id or fallback to bot_token
    let botToken: string | null = null;
    
    if (slackIntegration.bot_token_id) {
      // Retrieve from Vault
      botToken = await getSecretFromVault(slackIntegration.bot_token_id);
    } else if (slackIntegration.bot_token) {
      // Fallback to plain text token if available
      botToken = slackIntegration.bot_token;
    }
    
    if (!botToken) {
      console.error(`Could not retrieve bot token for integration (form_id: ${feedback.form_id})`);
      return false;
    }
    
    // Format the message
    const slackMessage = `*${senderName} replied:*\n${replyContent}`;
    
    // Send the reply to the Slack thread
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`
      },
      body: JSON.stringify({
        channel: meta.slack_channel_id,
        thread_ts: meta.slack_thread_ts,
        text: slackMessage,
        mrkdwn: true
      })
    });
    
    const slackResult = await slackResponse.json() as any;
    
    if (!slackResult.ok) {
      console.error('Error sending reply to Slack thread:', slackResult.error);
      return false;
    }
    
    console.log(`Successfully appended reply to Slack thread in channel ${meta.slack_channel_id}`);
    return true;
  } catch (error) {
    console.error('Error in sendReplyToSlackThread:', error);
    return false;
  }
}

// Store the reply in the database
async function storeReply(
  parsedEmail: ParsedMail, 
  feedbackId: string,
  attachments: EmailAttachment[],
  cidToUrlMap: Record<string, string>
): Promise<string> {
  try {
    // Extract content from the parsed email
    let htmlContent = parsedEmail.html || null;
    let textContent = parsedEmail.text || null;
    
    console.log(`