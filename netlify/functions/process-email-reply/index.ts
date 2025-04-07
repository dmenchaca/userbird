import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as multipart from 'parse-multipart-data';
import crypto from 'crypto';
import { simpleParser, ParsedMail, Attachment as MailAttachment } from 'mailparser';

// Log environment variables at startup
console.log('Process email reply function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    
    // Get sender email and name
    const fromAddress = parsedEmail.from?.value?.[0]?.address || '';
    const fromName = parsedEmail.from?.value?.[0]?.name || '';
    
    if (!fromAddress) {
      console.error('Cannot create feedback: No sender email address found');
      return undefined;
    }
    
    // Extract message content - prefer HTML content for new feedback
    const content = parsedEmail.html || parsedEmail.text || '';
    
    // Call the feedback endpoint to create new feedback
    const response = await fetch(`${process.env.URL}/.netlify/functions/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        formId,
        message: content,
        user_email: fromAddress,
        user_name: fromName || undefined,
        operating_system: 'Unknown',
        screen_category: 'Unknown'
      })
    });

    if (!response.ok) {
      console.error('Error creating feedback from email:', await response.text());
      return undefined;
    }

    const data = await response.json();
    console.log('Feedback endpoint response:', data);

    // Get the feedback ID from the response
    if (data.success) {
      // Query the most recent feedback for this form to get the ID
      const { data: feedbackData, error } = await supabase
        .from('feedback')
        .select('id')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error getting feedback ID:', error);
        return undefined;
      }

      console.log(`Created new feedback with ID: ${feedbackData.id}`);
      return feedbackData.id;
    }

    return undefined;
  } catch (error) {
    console.error('Error in createFeedbackFromEmail:', error);
    return undefined;
  }
}

// Function to extract the feedback ID from an email
async function extractFeedbackId(parsedEmail: ParsedMail): Promise<string | undefined> {
  console.log('Extracting feedback ID from email');
  
  // First check In-Reply-To header
  let feedbackId: string | undefined;
  
  // Try to extract from In-Reply-To or References headers
  const inReplyTo = parsedEmail.inReplyTo;
  const references = parsedEmail.references;
  
  // Extract feedback ID from our email format: <feedback-UUID@userbird.co>
  if (inReplyTo) {
    const feedbackIdMatch = inReplyTo.match(/<feedback-([a-f0-9-]+)@userbird\.co>/i);
    if (feedbackIdMatch) {
      feedbackId = feedbackIdMatch[1];
      console.log('Found feedback ID in In-Reply-To:', feedbackId);
      return feedbackId;
    }
  }
  
  // Try References field if In-Reply-To didn't work
  if (references && references.length > 0) {
    for (const reference of references) {
      const feedbackIdMatch = reference.match(/<feedback-([a-f0-9-]+)@userbird\.co>/i);
      if (feedbackIdMatch) {
        feedbackId = feedbackIdMatch[1];
        console.log('Found feedback ID in References:', feedbackId);
        return feedbackId;
      }
    }
  }

  // Extract form ID from recipient email addresses
  // Check both To and Cc fields for form-specific emails
  const toAddresses = parsedEmail.to?.value || [];
  const ccAddresses = parsedEmail.cc?.value || [];
  const allRecipients = [...toAddresses, ...ccAddresses];
  
  let foundFormId: string | undefined;
  
  for (const recipient of allRecipients) {
    if (!recipient.address) continue;
    
    const recipientEmail = recipient.address.toLowerCase();
    console.log('Checking recipient:', recipientEmail);
    
    // Check for direct form email pattern: {formId}@userbird-mail.com
    const formEmailMatch = recipientEmail.match(/^([a-zA-Z0-9]+)@userbird-mail\.com$/i);
    if (formEmailMatch) {
      const formId = formEmailMatch[1];
      console.log('Found potential form ID from recipient:', formId);
      foundFormId = formId;
      break;
    }
    
    // Check for domain-specific forwarded emails: {localPart}@{custom-domain}
    // Look up in custom_email_settings table
    const { data: customEmailSettings } = await supabase
      .from('custom_email_settings')
      .select('form_id, domain, local_part')
      .eq('custom_email', recipientEmail)
      .eq('verified', true)
      .single();
    
    if (customEmailSettings) {
      console.log('Found matching custom email setting:', customEmailSettings);
      foundFormId = customEmailSettings.form_id;
      break;
    }
    
    // Check for forwarding address pattern: {localPart}@{domain}.userbird-mail.com
    const forwardingMatch = recipientEmail.match(/^([^@]+)@([^.]+)\.userbird-mail\.com$/i);
    if (forwardingMatch) {
      const localPart = forwardingMatch[1];
      const domain = forwardingMatch[2];
      console.log('Found potential forwarding address:', { localPart, domain });
      
      // Look up in custom_email_settings table
      const { data: forwardingSettings } = await supabase
        .from('custom_email_settings')
        .select('form_id')
        .eq('local_part', localPart)
        .eq('domain', domain)
        .single();
      
      if (forwardingSettings) {
        foundFormId = forwardingSettings.form_id;
        break;
      }
    }
  }
  
  // Try to extract from email raw content
  const emailText = parsedEmail.text || '';
  const emailHtml = parsedEmail.html || '';
  const subject = parsedEmail.subject || '';
  
  // Try custom thread identifier format: thread::UUID::
  const threadRegex = /thread::([a-f0-9-]+)::/i;
  
  // First try to find thread ID in subject
  let threadMatch = subject.match(threadRegex);
  if (threadMatch) {
    feedbackId = threadMatch[1];
    console.log('Found feedback ID in subject thread identifier:', feedbackId);
    return feedbackId;
  }
  
  // If not found in subject, try the body
  threadMatch = emailText.match(threadRegex);
  if (threadMatch) {
    feedbackId = threadMatch[1];
    console.log('Found feedback ID in body thread identifier:', feedbackId);
    return feedbackId;
  }
  
  // Try to find any UUID-like pattern
  const uuidMatches = emailText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g) || 
                     emailHtml?.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
  if (uuidMatches) {
    // Check if any of these UUIDs exist in our feedback table
    for (const possibleId of uuidMatches) {
      const { data } = await supabase
        .from('feedback')
        .select('id')
        .eq('id', possibleId)
        .single();
        
      if (data) {
        feedbackId = possibleId;
        console.log('Found feedback ID by matching UUID pattern:', feedbackId);
        return feedbackId;
      }
    }
  }
  
  // Try to match by subject and sender email
  if (subject && parsedEmail.from?.value?.length) {
    // Extract the original feedback submitter's email from the subject
    const subjectMatch = subject.match(/Re: Feedback submitted by ([^@]+@[^@]+\.[^@]+)/i);
    if (subjectMatch) {
      const email = subjectMatch[1];
      // Query feedback table to find the most recent feedback from this email
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('id')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (feedbackData) {
        feedbackId = feedbackData.id;
        console.log('Found feedback ID by email lookup from subject:', feedbackId);
        return feedbackId;
      }
    }
  }
  
  // Look up by Message-ID in our replies table
  if (parsedEmail.messageId) {
    const { data: replyData } = await supabase
      .from('feedback_replies')
      .select('feedback_id')
      .eq('message_id', parsedEmail.messageId)
      .single();
      
    if (replyData) {
      feedbackId = replyData.feedback_id;
      console.log('Found feedback ID from message_id lookup:', feedbackId);
      return feedbackId;
    }
  }
  
  // If we found a form ID but no feedback ID through any other method, check for existing feedback
  if (foundFormId) {
    // Get sender email
    const fromAddress = parsedEmail.from?.value?.[0]?.address;
    if (fromAddress) {
      // Check for existing feedback from this sender for this form
      const { data: existingFeedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('form_id', foundFormId)
        .eq('user_email', fromAddress)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (existingFeedback) {
        console.log(`Found existing feedback with ID: ${existingFeedback.id}`);
        return existingFeedback.id;
      }
    }
    
    console.log(`No existing feedback found, creating new feedback for form ${foundFormId}`);
    return await createFeedbackFromEmail(parsedEmail, foundFormId);
  }
  
  console.log('No feedback ID found after all extraction attempts');
  return undefined;
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
    const inReplyTo = parsedEmail.inReplyTo || null;
    
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
    
    // Use mailparser to parse the email
    console.log('Parsing email with mailparser');
    
    // Create a ParsedMail object from the raw email text
    const parsedEmail = await simpleParser(emailText);
    
    // Helper function to safely get address from parsedMail address fields
    const getEmailAddress = (addressObj: any): string => {
      if (!addressObj) return '';
      
      // Handle array of addresses
      if (Array.isArray(addressObj.value)) {
        return addressObj.value[0]?.address || '';
      }
      
      // Handle single address
      return addressObj.value?.address || '';
    };

    // Helper function to extract all email addresses from an address field
    const getAllEmailAddresses = (addressObj: any): string[] => {
      if (!addressObj || !addressObj.value) return [];
      
      if (Array.isArray(addressObj.value)) {
        return addressObj.value.map(addr => addr.address).filter(Boolean);
      }
      
      return addressObj.value.address ? [addressObj.value.address] : [];
    };

    // Log email details including all recipients
    const toAddresses = getAllEmailAddresses(parsedEmail.to);
    const ccAddresses = getAllEmailAddresses(parsedEmail.cc);
    
    console.log('Email parsed successfully:', {
      from: getEmailAddress(parsedEmail.from),
      to: toAddresses,
      cc: ccAddresses,
      subject: parsedEmail.subject,
      hasText: !!parsedEmail.text,
      hasHtml: !!parsedEmail.html,
      hasAttachments: parsedEmail.attachments?.length > 0,
      messageId: parsedEmail.messageId,
      inReplyTo: parsedEmail.inReplyTo,
      references: parsedEmail.references
    });
    
    // Check for domain not found issues in headers or envelope
    const spfHeader = parsedEmail.headers.get('authentication-results') || '';
    const dkimHeader = parsedEmail.headers.get('dkim-signature') || '';
    const returnPath = parsedEmail.headers.get('return-path') || '';
    
    // Check for domain issues - common SendGrid errors include "Domain not found"
    if (rawEmailData.spam_report && typeof rawEmailData.spam_report === 'string' && 
        rawEmailData.spam_report.includes('Domain not found')) {
      console.error('Domain not found error detected in spam report');
      
      // Check for custom domains in the recipients
      for (const recipient of toAddresses.concat(ccAddresses)) {
        const domain = recipient.split('@')[1];
        if (domain && !domain.includes('userbird-mail.com') && !domain.includes('userbird.co')) {
          // Look up custom domain in our settings
          const { data: domainSettings } = await supabase
            .from('custom_email_settings')
            .select('form_id, domain, verified')
            .eq('domain', domain)
            .maybeSingle();
            
          if (domainSettings) {
            // Domain is in our system but having DNS issues
            const verificationStatus = domainSettings.verified ? 'verified' : 'not verified';
            console.error(`Custom domain ${domain} is ${verificationStatus} but having DNS issues.`);
            
            return {
              statusCode: 400,
              body: JSON.stringify({
                error: 'Domain configuration issue',
                message: `The custom domain ${domain} is configured in our system but appears to have DNS configuration issues. Please verify your DNS settings.`,
                details: {
                  domain,
                  formId: domainSettings.form_id,
                  verified: domainSettings.verified
                }
              })
            };
          }
        }
      }
    }
    
    // Extract feedback ID from the parsed email
    let feedbackId = await extractFeedbackId(parsedEmail);
    
    if (!feedbackId) {
      console.log('No feedback ID found, checking if we can create a new feedback');
      
      // Get form ID from recipient email
      const toAddresses = parsedEmail.to?.value || [];
      const ccAddresses = parsedEmail.cc?.value || [];
      const allRecipients = [...toAddresses, ...ccAddresses];
      
      let formId: string | undefined;
      
      for (const recipient of allRecipients) {
        if (!recipient.address) continue;
        
        const recipientEmail = recipient.address.toLowerCase();
        
        // Check for direct form email pattern
        const formEmailMatch = recipientEmail.match(/^([a-zA-Z0-9]+)@userbird-mail\.com$/i);
        if (formEmailMatch) {
          formId = formEmailMatch[1];
          break;
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
          // For new feedback, we don't create a reply - just return success
          return { 
            statusCode: 200, 
            body: JSON.stringify({ 
              success: true,
              feedbackId: newFeedbackId
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
    
    // If we have a feedback ID, process as a reply
    console.log('Using feedback_id:', feedbackId);
    
    // Verify feedback ID exists in the database
    const { data: feedbackExists, error: feedbackError } = await supabase
      .from('feedback')
      .select('id')
      .eq('id', feedbackId)
      .maybeSingle();
    
    if (feedbackError) {
      console.error('Error checking if feedback exists:', feedbackError);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Error checking feedback existence' }) 
      };
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