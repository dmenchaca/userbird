import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as multipart from 'parse-multipart-data';
import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import fetch from 'node-fetch';

// Log environment variables at startup
console.log('Process email reply function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
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
    
    console.log(`Content extraction from parser: hasHTML=${!!htmlContent}, hasText=${!!textContent}`);
    
    // If we have HTML content and CID mappings, replace CID references
    if (htmlContent && Object.keys(cidToUrlMap).length > 0) {
      console.log('Replacing CID references in HTML content');
      htmlContent = replaceCidWithUrls(htmlContent, cidToUrlMap, attachments);
    }
    
    // Generate a UUID for the reply
    const replyId = crypto.randomUUID();
    const messageId = parsedEmail.messageId || `reply-${crypto.randomUUID()}`;
    
    // Process in-reply-to header to ensure proper threading
    let inReplyTo: string | null = null;
    if (parsedEmail.inReplyTo) {
      // Store the original in-reply-to value
      inReplyTo = parsedEmail.inReplyTo;
      console.log('Using in-reply-to header for threading:', inReplyTo);
    } else if (parsedEmail.references && parsedEmail.references.length > 0) {
      // If no in-reply-to but we have references, use the last reference as in-reply-to
      // This helps maintain thread continuity
      const refs = Array.isArray(parsedEmail.references) 
        ? parsedEmail.references 
        : [parsedEmail.references];
      
      if (refs.length > 0) {
        inReplyTo = refs[refs.length - 1]; // Use the last reference
        console.log('Using last reference as in-reply-to for threading:', inReplyTo);
      }
    }
    
    // Use HTML content when available, and text content only as a fallback
    const finalContent = htmlContent ? '' : (textContent || '');
    
    // Create reply data object
    const replyData: any = {
      id: replyId,
      feedback_id: feedbackId,
      content: finalContent,
      html_content: htmlContent,
      message_id: messageId,
      in_reply_to: inReplyTo,
      created_at: new Date().toISOString()
    };
    
    // Add sender info if available from parsed email
    if (parsedEmail.from?.value?.length) {
      replyData.sender_type = 'user';
    }
    
    // Log the data we're about to insert
    console.log('Inserting reply with data:', Object.keys(replyData));
    
    // Insert the reply
    const { data: reply, error } = await supabase
      .from('feedback_replies')
      .insert(replyData)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error storing reply:', error);
      throw new Error(`Failed to store reply: ${error.message}`);
    }
    
    if (!reply) {
      throw new Error('No reply data returned after insert');
    }
    
    console.log(`Reply stored with ID: ${reply.id}`);
    
    // Now that we have a valid reply ID, store the attachment metadata
    if (feedbackAttachmentsTableExists && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.url) {
          try {
            const attachmentId = crypto.randomUUID();
            
            const attachmentData: any = {
              id: attachmentId,
              reply_id: replyId,
              filename: attachment.filename,
              content_type: attachment.contentType,
              url: attachment.url,
              is_inline: attachment.isInline
            };
            
            if (attachment.contentId) {
              attachmentData.content_id = attachment.contentId;
            }
            
            const { error: insertError } = await supabase
              .from('feedback_attachments')
              .insert(attachmentData);
            
            if (insertError) {
              console.error('Error storing attachment metadata after reply creation:', insertError);
            } else {
              console.log(`Successfully stored attachment metadata with ID: ${attachmentId}`);
            }
          } catch (insertErr) {
            console.error('Exception while inserting attachment metadata after reply creation:', insertErr);
          }
        }
      }
    }
    
    // Try to update the feedback record
    try {
      const { error: updateError } = await supabase
        .from('feedback')
        .update({ 
          updated_at: new Date().toISOString() 
        })
        .eq('id', feedbackId);
      
      if (updateError) {
        console.log('Could not update feedback record with timestamp, but reply was stored successfully');
      }
    } catch (updateErr) {
      console.log('Error updating feedback record, but reply was stored successfully');
    }
    
    return reply.id;
  } catch (error) {
    console.error('Error in storeReply:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  console.log('Process email reply function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length,
    path: event.path,
    headers: event.headers,
    contentType: event.headers['content-type'] || event.headers['Content-Type']
  });

  // Check for feedback_attachments table
  try {
    const { error } = await supabase.from('feedback_attachments').select('id').limit(1);
    if (error && error.code === '42P01') { // Table does not exist
      feedbackAttachmentsTableExists = false;
      console.log('The feedback_attachments table does not exist');
    }
  } catch (e) {
    feedbackAttachmentsTableExists = false;
    console.error('Error checking for feedback_attachments table:', e);
  }

  // Allow GET requests for testing
  if (event.httpMethod === 'GET') {
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: 'Email reply processing endpoint is active',
        timestamp: new Date().toISOString()
      }) 
    };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Parse the email data from the request
    let rawEmailData: any = {};
    let emailText: string = '';
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    // Handle multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      console.log('Parsing multipart/form-data');
      
      // Extract boundary from content type
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';
      
      if (boundary && event.body) {
        try {
          // Convert body to buffer if it's a string
          const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
          const parts = multipart.parse(bodyBuffer, boundary);
          
          // Process parts into emailData
          for (const part of parts) {
            const fieldName = part.name || '';
            const value = part.data.toString();
            rawEmailData[fieldName] = value;
          }
          
          console.log('Parsed form data fields:', Object.keys(rawEmailData));
          
          // For SendGrid, the raw email is in the 'email' field
          if (rawEmailData.email) {
            emailText = rawEmailData.email;
          } else if (rawEmailData.text) {
            emailText = rawEmailData.text;
          }
        } catch (parseError) {
          console.error('Error parsing multipart data:', parseError);
        }
      }
    } else {
      // Try to parse as JSON if not multipart
      try {
        rawEmailData = JSON.parse(event.body || '{}');
        
        // Extract raw email content
        if (rawEmailData.email) {
          emailText = rawEmailData.email;
        } else if (rawEmailData.text) {
          emailText = rawEmailData.text;
        } else {
          emailText = event.body || '';
        }
      } catch (e) {
        // If not JSON, use raw body as text
        console.log('Not JSON, using raw body as text');
        emailText = event.body || '';
      }
    }
    
    // Parse the email with mailparser
    const parsedEmail = await simpleParser(emailText);
    console.log('Email parsed successfully:', {
      from: parsedEmail.from?.text,
      to: parsedEmail.to?.value?.map((v: any) => v.address),
      cc: parsedEmail.cc?.value?.map((v: any) => v.address),
      subject: parsedEmail.subject,
      hasText: !!parsedEmail.text,
      hasHtml: !!parsedEmail.html,
      hasAttachments: !!parsedEmail.attachments?.length,
      messageId: parsedEmail.messageId,
      inReplyTo: parsedEmail.inReplyTo,
      references: parsedEmail.references
    });

    // Step 1: Try to extract feedback ID
    console.log('Extracting feedback ID from email');
    let feedbackId = await extractFeedbackId(parsedEmail);

    // Step 2: If no feedback ID, try to create new feedback
    if (!feedbackId) {
      console.log('No feedback ID found, checking if we can create a new feedback');
      
      // Get form ID from recipient email
      const toAddresses = parsedEmail.to?.value || [];
      const ccAddresses = parsedEmail.cc?.value || [];
      const allRecipients = [...toAddresses, ...ccAddresses];
      
      console.log('All recipients:', JSON.stringify(allRecipients.map(r => r.address)));
      
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
          formId = customEmailSettings.form_id;
          break;
        }
      }
      
      if (formId) {
        console.log(`Creating new feedback for form ${formId}`);
        const newFeedbackId = await createFeedbackFromEmail(parsedEmail, formId);
        
        if (newFeedbackId) {
          console.log(`Created new feedback with ID: ${newFeedbackId}`);
          // Now send this feedback to Slack if integration exists
          try {
            console.log(`Attempting to send feedback ${newFeedbackId} to Slack...`);
            
            const slackResponse = await fetch('https://app.userbird.co/.netlify/functions/send-to-slack', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                feedbackId: newFeedbackId,
                formId: formId
              })
            });
            
            if (slackResponse.ok) {
              console.log(`Successfully sent feedback ${newFeedbackId} to Slack (${slackResponse.status})`);
            } else {
              const errorText = await slackResponse.text();
              console.error(`Error response from Slack notification: ${slackResponse.status} - ${errorText}`);
            }
          } catch (error) {
            console.error(`Exception sending feedback to Slack: ${error instanceof Error ? error.message : String(error)}`);
            // Continue processing - Slack notification is non-critical
          }
          // Return success without creating a reply since this is a new feedback
          return { 
            statusCode: 200, 
            body: JSON.stringify({ 
              success: true, 
              feedbackId: newFeedbackId,
              message: 'New feedback created successfully' 
            }) 
          };
        } else {
          console.error('Failed to create new feedback');
          return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Could not create new feedback' }) 
          };
        }
      } else {
        console.error('Could not determine form ID from email recipients');
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: 'Could not determine form ID from email recipients' }) 
        };
      }
    }

    // Step 3: Only proceed with reply creation if we have an existing feedback ID
    console.log(`Using feedback_id: ${feedbackId}`);
    
    // Verify feedback ID exists in the database
    const { data: feedbackExists, error: feedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('id', feedbackId)
      .maybeSingle();
    
    if (feedbackError) {
      console.error('Error checking if feedback exists:', feedbackError);
    } else if (!feedbackExists) {
      console.error(`No feedback found with ID: ${feedbackId}`);
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: 'Feedback ID not found' }) 
      };
    }
    
    // Process any attachments in the email
    const { attachments, cidToUrlMap } = await processAttachments(parsedEmail, feedbackId);
    
    // Store the reply in the database
    try {
      const replyId = await storeReply(
        parsedEmail,
        feedbackId,
        attachments,
        cidToUrlMap
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          replyId,
          messageId: parsedEmail.messageId,
          inReplyTo: parsedEmail.inReplyTo
        })
      };
    } catch (storeError) {
      console.error('Error storing reply:', storeError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Error storing reply',
          message: storeError instanceof Error ? storeError.message : 'Unknown error' 
        })
      };
    }
  } catch (error) {
    console.error('Error processing email reply:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 