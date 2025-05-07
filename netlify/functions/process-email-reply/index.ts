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
    
    return reply.id;
  } catch (error) {
    console.error('Error in storeReply:', error);
    throw error;
  }
}

// Helper function to convert Slack formatting to HTML
function convertSlackToHtml(text: string): string {
  if (!text) return '';
  
  // Convert Slack-style links <https://example.com|text> to HTML links
  text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
  
  // Convert regular URLs that aren't already in the Slack format
  text = text.replace(/(?<!["|'])(https?:\/\/[^\s<]+)(?![^<]*>)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Convert bold (*text*) - ensure it doesn't match within URLs
  text = text.replace(/(?<!\w)\*([^\*\n]+)\*(?!\w)/g, '<strong>$1</strong>');
  
  // Convert italic (_text_) - ensure it doesn't match within URLs
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  
  // Convert strikethrough (~text~)
  text = text.replace(/(?<!\w)~([^~\n]+)~(?!\w)/g, '<del>$1</del>');
  
  // Convert backticks (`code`) for code styling
  text = text.replace(/(?<!\\)`([^`\n]+)`/g, '<code>$1</code>');
  
  // Convert line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
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
    console.log('Trying to determine if this is a reply or a new feedback');

    // Step 2: Store the reply
    const { attachments, cidToUrlMap } = await processAttachments(parsedEmail, "unused");

    // Extract content from the parsed email
    let htmlContent = parsedEmail.html || null;
    let textContent = parsedEmail.text || null;
    
    console.log(`Content extraction from parser: hasHTML=${!!htmlContent}, hasText=${!!textContent}`);
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Email processed successfully',
        email_id: parsedEmail.messageId
      })
    };
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