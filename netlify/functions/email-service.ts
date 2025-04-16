import sgMail from '@sendgrid/mail';
import { Handler } from '@netlify/functions';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database access
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Default sender email to fall back to
const DEFAULT_SENDER = 'notifications@userbird.co';
const DEFAULT_SENDER_NAME = 'Userbird';

// Create local copies of the utility functions since Netlify functions can't import from src folder
/**
 * Sanitizes HTML to prevent XSS attacks
 * @param html The raw HTML input
 * @returns Sanitized HTML with only allowed tags and attributes
 */
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // List of allowed tags - keep this limited for security
  const allowedTags = [
    'a', 'p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 
    'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'span', 'div'
  ];
  
  // Remove potentially harmful tags and patterns
  const blacklistPattern = /<script|<iframe|<object|<embed|<form|<input|<style|<link|javascript:|onclick|onerror|onload|onmouseover/gi;
  let sanitized = html.replace(blacklistPattern, '');
  
  // Clean all attributes except for allowed ones on specific elements
  const attrPattern = /<([a-z0-9]+)([^>]*?)>/gi;
  
  sanitized = sanitized.replace(attrPattern, (_, tagName, attributes) => {
    if (!allowedTags.includes(tagName.toLowerCase())) {
      // For non-allowed tags, just remove them completely
      return '';
    }
    
    // Handle specific tags that can have attributes
    if (tagName.toLowerCase() === 'a') {
      // Extract href and target if they exist
      const hrefMatch = attributes.match(/href\s*=\s*['"]([^'"]*)['"]/i);
      const href = hrefMatch ? ` href="${hrefMatch[1]}" target="_blank" rel="noopener noreferrer"` : '';
      return `<a${href}>`;
    }
    
    if (tagName.toLowerCase() === 'img') {
      // Extract src and alt if they exist
      const srcMatch = attributes.match(/src\s*=\s*['"]([^'"]*)['"]/i);
      const altMatch = attributes.match(/alt\s*=\s*['"]([^'"]*)['"]/i);
      const src = srcMatch ? ` src="${srcMatch[1]}"` : '';
      const alt = altMatch ? ` alt="${altMatch[1]}"` : '';
      // Add width style to prevent oversized images
      return `<img${src}${alt} style="max-width: 100%;">`;
    }
    
    // For all other allowed tags, strip all attributes
    return `<${tagName}>`;
  });
  
  // Clean closing tags - remove any that aren't in our allowlist
  const closingTagPattern = /<\/([a-z0-9]+)>/gi;
  sanitized = sanitized.replace(closingTagPattern, (_, tagName) => {
    return allowedTags.includes(tagName.toLowerCase()) ? `</${tagName}>` : '';
  });
  
  return sanitized;
}

/**
 * Removes HTML tags from content to create plain text version
 * @param html HTML content
 * @returns Plain text with links preserved
 */
function stripHtml(html: string): string {
  if (!html) return '';
  
  // First, preserve links by converting them to text + URL format
  // Replace <a href="URL">text</a> with text (URL)
  let text = html.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, 
    (_, url, linkText) => {
      // If the text is the same as the URL, just return the URL
      if (linkText.trim() === url.trim()) {
        return url;
      }
      // Otherwise return text (URL)
      return `${linkText} (${url})`;
    }
  );
  
  // Then remove remaining HTML tags and decode entities
  return text
    .replace(/<[^>]*>/g, ' ')  // Replace tags with space
    .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
    .replace(/&amp;/g, '&')    // Replace ampersand
    .replace(/&lt;/g, '<')     // Replace less than
    .replace(/&gt;/g, '>')     // Replace greater than
    .replace(/&quot;/g, '"')   // Replace quotes
    .replace(/&#039;/g, "'")   // Replace apostrophe
    .replace(/\s+/g, ' ')      // Consolidate whitespace
    .trim();
}

// Initialize SendGrid with API key
const apiKey = process.env.SENDGRID_API_KEY || '';
sgMail.setApiKey(apiKey);

// Log if API key is set
console.log('Email service initialized:', {
  hasApiKey: !!apiKey,
  apiKeyLength: apiKey.length,
  apiKeyPartial: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'not set'
});

export interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  feedbackId?: string;
  inReplyTo?: string;
}

/**
 * Processes Markdown-like syntax from user input
 * @param content Input potentially containing markdown elements
 * @returns HTML content with formatted elements
 */
function processMarkdownSyntax(content: string): string {
  if (!content) return '';
  
  // Process bold text (**bold**)
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Process italic text (*italic*)
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Process line breaks
  content = content.replace(/\n/g, '<br>');
  
  // Process URLs
  content = content.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  return content;
}

/**
 * Get the appropriate sender email for a form
 * @returns Object with email, name, and optionally product_name, user_first_name
 */
async function getSenderEmail(formId: string): Promise<{ 
  email: string; 
  name?: string;
  product_name?: string;
  user_first_name?: string;
}> {
  try {
    // Try to use database function first (better performance)
    const { data, error } = await supabase.rpc('get_form_sender_email', { form_id: formId });
    
    if (!error && data) {
      return { email: data };
    }
    
    // First check for a verified custom email setting
    const { data: customEmail, error: customEmailError } = await supabase
      .from('custom_email_settings')
      .select('custom_email, verified')
      .eq('form_id', formId)
      .eq('verified', true)
      .single();
    
    if (!customEmailError && customEmail && customEmail.verified) {
      // Found a verified custom email, use it
      return {
        email: customEmail.custom_email
      };
    }

    // If no verified custom email, check for a default email
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('default_email, default_sender_name, url, product_name')
      .eq('id', formId)
      .single();
    
    if (!formError && form && form.default_email) {
      return {
        email: form.default_email,
        name: form.default_sender_name || `${form.url} Feedback`,
        product_name: form.product_name
      };
    }

    // Fall back to system default
    return {
      email: DEFAULT_SENDER,
      name: DEFAULT_SENDER_NAME
    };
  } catch (error) {
    console.error('Error getting sender email:', error);
    // In case of any error, use the default
    return {
      email: DEFAULT_SENDER,
      name: DEFAULT_SENDER_NAME
    };
  }
}

/**
 * Extract first name from a display name
 * @param displayName Full display name (could be "John Doe" or an email address)
 * @returns The first name or first part of the email address before @ symbol
 */
function getFirstName(displayName: string): string {
  if (!displayName) return '';
  
  // If the name contains an @ symbol, it's likely an email address
  if (displayName.includes('@')) {
    return displayName.split('@')[0]; // Return part before @
  }
  
  // Otherwise, take the first word as the first name
  return displayName.split(' ')[0];
}

/**
 * Format sender email with name if available
 */
function formatSender(sender: { email: string, name?: string, product_name?: string, user_first_name?: string }) {
  // If we have a user's first name and a product name, use the "{First name} at {product_name}" format
  if (sender.user_first_name && sender.product_name) {
    return `${sender.user_first_name} at ${sender.product_name} <${sender.email}>`;
  }
  
  // If only product name is available
  if (sender.product_name) {
    return `${sender.product_name} <${sender.email}>`;
  }
  
  // Fall back to the original format
  if (sender.name) {
    return `${sender.name} <${sender.email}>`;
  }
  
  return sender.email;
}

export class EmailService {
  static async sendEmail(params: EmailParams) {
    try {
      // Process and sanitize HTML content if it exists
      let html = params.html || '';
      
      // Convert plain text to HTML if no HTML is provided but text is
      if (!html && params.text) {
        // Process any markdown-like syntax in the text
        html = processMarkdownSyntax(params.text);
      }
      
      // Skip sanitization for notifications@userbird.co emails to preserve styling
      if (params.from !== 'notifications@userbird.co' && !params.from?.includes('notifications@userbird.co')) {
        // Sanitize HTML content to prevent security issues
        html = sanitizeHtml(html);
      }
      
      // Ensure we have a plain text version (fallback)
      let text = params.text || '';
      if (!text && html) {
        // Convert HTML to plain text if only HTML is provided
        text = stripHtml(html);
      }
      
      // Add branded footer IF it's an admin dashboard reply
      // We need a way to know if it IS an admin reply here.
      // Let's assume replies NOT from notifications@userbird.co might need branding
      // and rely on the calling function (sendReplyNotification) to format the content correctly before calling sendEmail.
      // The footer logic needs to be applied *before* calling sendEmail if we remove isAdminDashboardReply.
      // Let's move the footer logic to sendReplyNotification instead.
      
      // USE HEADERS DIRECTLY FROM PARAMS
      const headers = params.headers || {};
      
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        text,
        html,
        headers // Use headers passed directly
      };

      console.log('Sending email via SendGrid:', {
        to: params.to,
        from: params.from,
        subject: params.subject,
        hasText: !!text,
        hasHtml: !!html,
        headers: headers,
        messageId: headers['Message-ID'], // Log the message ID being used
        inReplyTo: headers['In-Reply-To'], // Log the in-reply-to being used
        references: headers['References'] // Log the references being used
      });

      const result = await sgMail.send(msg);
      
      // Extract the actual Message-ID returned by SendGrid if possible
      const sentMessageId = result[0]?.headers?.['message-id'];
      
      return {
        success: true,
        messageId: sentMessageId || headers['Message-ID'], // Return the actual or intended ID
        statusCode: result[0]?.statusCode
      };
    } catch (error) {
      console.error('Error sending email via SendGrid:', error);
      // If error has response body, log it
      if (error.response) {
        console.error(error.response.body)
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async sendFeedbackNotification(params: {
    to: string;
    formUrl: string;
    formId: string;
    message: string;
    user_id?: string;
    user_email?: string;
    user_name?: string;
    operating_system?: string;
    screen_category?: string;
    image_url?: string;
    image_name?: string;
    created_at?: string;
    url_path?: string;
    feedbackId: string;
    ticket_number?: number;
    isAssignment?: boolean;
  }) {
    const { to, formUrl, formId, message, user_id, user_email, user_name, operating_system, screen_category, image_url, image_name, created_at, url_path, feedbackId, ticket_number, isAssignment } = params;

    // Get formated date
    const formatedDate = created_at || new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Check what info is available
    const showUserInfo = user_id || user_email || user_name || url_path;
    const showSystemInfo = operating_system || screen_category;

    // Always use notifications@userbird.co for new feedback notifications and assignment notifications
    const from = formatSender({ email: 'notifications@userbird.co', name: DEFAULT_SENDER_NAME });
    const isNotificationsEmail = true;

    // Generate secure URL for image
    let secureImageUrl = image_url;
    if (image_url && image_url.includes('feedback-images')) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const parts = image_url.split('feedback-images/');
      if (parts.length > 1) {
        const imagePath = parts[1];
        secureImageUrl = `${supabaseUrl}/functions/v1/feedback-images/${imagePath}`;
      }
    }
    
    // Determine the primary action URL and label based on notification type
    let primaryActionUrl = `https://app.userbird.co/forms/${formId}`;
    let primaryActionLabel = 'View All Responses';
    let emailSubject = `New Feedback for ${formUrl}`;
    
    if (isAssignment) {
      // Extract ticket number from the message
      // Message format is: "AssignerName has assigned Ticket #123 to you." or "You have been assigned Ticket #123."
      const ticketNumberMatch = message.match(/Ticket #(\d+)/i);
      const extractedTicketNumber = ticketNumberMatch ? ticketNumberMatch[1] : '';
      
      console.log('Extracted ticket number for email subject:', {
        message: message.substring(0, 50),
        ticketNumberMatch,
        extractedTicketNumber,
        ticket_number
      });
      
      // For assignment notifications, link directly to the ticket
      // Use the ticket_number from the database if available, otherwise use extracted value from message
      primaryActionUrl = `https://app.userbird.co/forms/${formId}/ticket/${ticket_number || extractedTicketNumber}`;
      primaryActionLabel = 'View Ticket';
      
      // Use ticket number in subject if available, otherwise use generic subject
      const displayTicketNumber = ticket_number || extractedTicketNumber;
      emailSubject = displayTicketNumber 
        ? `Action needed: Ticket #${displayTicketNumber} is now yours` 
        : `Action needed: You've been assigned a ticket`;
    }

    // Create HTML version with proper styling matching the template - don't sanitize this template
    const htmlMessage = `<!DOCTYPE html>
<html>
  <body style="font-family: 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0 auto; padding: 20px; background: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; font-size: 16px; font-weight: 500; margin: 0 0 8px;">
          ${isAssignment ? 'Ticket Assignment' : 'New feedback received'} for <strong>${formUrl}</strong>
        </h3>
      </div>

      <div style="margin-bottom: 24px;">
        ${message ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Message</h4>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        ` : ''}

        ${showUserInfo ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">User Information</h4>
          <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
            ${url_path ? `<p style="margin: 0;">Page URL: ${url_path}</p>` : ''}
            ${user_id ? `<p style="margin: 0;">ID: ${user_id}</p>` : ''}
            ${user_email ? `<p style="margin: 0;">Email: ${user_email}</p>` : ''}
            ${user_name ? `<p style="margin: 0;">Name: ${user_name}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${showSystemInfo ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">System Information</h4>
          <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
            ${operating_system ? `<p style="margin: 0;">OS: ${operating_system}</p>` : ''}
            ${screen_category ? `<p style="margin: 0;">Device: ${screen_category}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${image_url ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Image</h4>
          <div style="margin-top: 8px;">
            <img src="${secureImageUrl}" alt="Feedback image" style="max-width: 100%; border-radius: 4px;" />
            ${image_name ? `<p style="color: #6b7280; font-size: 12px; margin: 4px 0 0;">${image_name}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${formatedDate ? `
        <div>
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Date</h4>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0;">${formatedDate}</p>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center;">
        <a href="${primaryActionUrl}" 
           style="display: inline-block; background: #1f2937; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
          ${primaryActionLabel}
        </a>
      </div>
    </div>
  </body>
</html>`;

    // Create plain text version
    const textMessage = `
${isAssignment ? 'Ticket Assignment' : 'New feedback received'} for ${formUrl}

${message ? `Message:
${message}

` : ''}${showUserInfo ? `User Information:
${url_path ? `Page URL: ${url_path}` : ''}
${user_id ? `ID: ${user_id}` : ''}
${user_email ? `Email: ${user_email}` : ''}
${user_name ? `Name: ${user_name}` : ''}

` : ''}${showSystemInfo ? `System Information:
${operating_system ? `Operating System: ${operating_system}` : ''}
${screen_category ? `Screen Category: ${screen_category}` : ''}

` : ''}${image_url ? `Screenshot:
${secureImageUrl}

` : ''}${formatedDate ? `Received on ${formatedDate}` : ''}

View Online: ${primaryActionUrl}`;

    // For notifications@userbird.co, send directly to avoid any potential sanitization
    if (isNotificationsEmail) {
      const messageId = `<feedback-notification-${feedbackId}@userbird.co>`;
      try {
        await sgMail.send({
          to,
          from,
          subject: emailSubject,
          text: textMessage,
          html: htmlMessage,
          headers: {
            'Message-ID': messageId
          }
        });
        
        return {
          success: true,
          messageId
        };
      } catch (error) {
        console.error('Error sending notification email directly:', error);
        throw error;
      }
    } else {
      // For other sender emails, use the standard flow
      return this.sendEmail({
        to,
        from,
        subject: emailSubject,
        text: textMessage,
        html: htmlMessage,
        feedbackId
      });
    }
  }

  static async sendReplyNotification(params: {
    to: string;
    replyContent: string;
    htmlReplyContent?: string;
    feedback: {
      message: string;
      created_at: string;
      user_email: string;
      id: string;
    };
    isFirstReply: boolean;
    feedbackId: string;
    replyId: string;
    lastMessageId?: string;
    lastMessageHtmlContent?: string;
    isAdminDashboardReply?: boolean;
    productName?: string;
  }) {
    const {
      to,
      replyContent,
      htmlReplyContent,
      feedback,
      isFirstReply,
      feedbackId,
      replyId,
      lastMessageId,
      lastMessageHtmlContent,
      isAdminDashboardReply = false,
      productName
    } = params;

    // Get the form ID from the feedback
    const { data: feedbackData } = await supabase
      .from('feedback')
      .select('form_id')
      .eq('id', feedbackId)
      .single();
    
    const formId = feedbackData?.form_id;

    // Determine sender info (fetches default/custom email, product name etc.)
    const senderInfo = formId ? await getSenderEmail(formId) : { email: DEFAULT_SENDER, name: DEFAULT_SENDER_NAME };
    let senderWithUserInfo = { ...senderInfo };

    if (isAdminDashboardReply) {
      // Add product name from form data or passed param
      senderWithUserInfo.product_name = senderInfo.product_name || productName;
      // Get sender's first name for display
      try {
        const { data: replyData } = await supabase.from('feedback_replies').select('sender_id').eq('id', replyId).single();
        if (replyData?.sender_id) {
          const { data: userData } = await supabase.rpc('get_user_profile_by_id', { user_id_param: replyData.sender_id });
          if (userData && userData.length > 0) {
            senderWithUserInfo.user_first_name = getFirstName(userData[0].username);
          }
        }
      } catch (error) { console.error('Error getting user details for sender:', error); }
    }
    
    const from = formatSender(senderWithUserInfo);
    
    // Format date for quoting
    const compactDate = new Date(feedback.created_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    });
    const previousMessageDate = new Date().toLocaleString('en-US', { // Placeholder date for last reply
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }); 

    // 1. Prepare the main content (new reply)
    let plainTextMessage = replyContent; // Start with the new reply text
    let htmlMessage = htmlReplyContent || `<div style="white-space: pre-wrap;">${replyContent}</div>`; // Start with new reply HTML

    // 2. Add Branded Footer (if applicable)
    let brandingFooterHtml = '';
    let brandingFooterText = '';
    if (isAdminDashboardReply && formId) {
      const { data: formData } = await supabase.from('forms').select('remove_branding, product_name').eq('id', formId).single();
      const finalProductName = formData?.product_name || senderWithUserInfo.product_name || 'this service';
      if (formData && !formData.remove_branding) {
        brandingFooterHtml = `
          <div style="font-family: 'system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Oxygen-Sans','Ubuntu','Cantarell','Helvetica Neue','Arial','sans-serif'; font-size: 12px; line-height: 1.5; color: #49545c; margin: 10px 0 14px 0; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            This email is a service from ${finalProductName}. Delivered by <a href="https://app.userbird.co/?ref=email&domain=${encodeURIComponent(finalProductName)}" style="color:black;" target="_blank" rel="noopener noreferrer">Userbird</a>
          </div>
        `;
        brandingFooterText = `

This email is a service from ${finalProductName}. Delivered by Userbird (https://app.userbird.co)
`;
        
        // Append footer directly to the new reply content
        htmlMessage += brandingFooterHtml;
        plainTextMessage += brandingFooterText;
      }
    }

    // 3. Add Quoted Content
    const originalMessageSender = feedback.user_email; // Email of the person who sent the original feedback
    const previousReplySender = lastMessageId ? (lastMessageId.includes('reply') ? from : originalMessageSender) : from; // Guess sender of previous msg
    
    // Construct Plain Text Quote
    let plainTextQuotedContent = '';
    if (isFirstReply) {
      plainTextQuotedContent = `


--------------- Original Message ---------------
From: [${originalMessageSender}]
Sent: ${compactDate}
To: ${senderInfo.email}
Subject: Feedback submitted by ${originalMessageSender}

${feedback.message}

`;
    } else if (lastMessageId) {
        // Simple text quote attempt
        const previousReplyText = stripHtml(lastMessageHtmlContent || ''); // Convert previous HTML to text
        plainTextQuotedContent = `


On ${previousMessageDate}, ${previousReplySender} wrote:

${previousReplyText.split('\n').map(line => `> ${line}`).join('\n')}

`;
    }
    plainTextMessage += plainTextQuotedContent; // Append quote to the full plain text message

    // Construct HTML Quote
    if (isAdminDashboardReply) {
      // For admin replies, add the Gmail-style quote block
      if (isFirstReply) {
        // Quote the original feedback message
        htmlMessage += `
          <br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On ${compactDate}, &lt;${originalMessageSender}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
            <div style="white-space: pre-wrap;">${feedback.message}</div>
          </blockquote></div>
        `;
      } else if (lastMessageId && lastMessageHtmlContent) {
        // Quote the previous reply using its HTML content
         htmlMessage += `
          <br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On ${previousMessageDate}, &lt;${previousReplySender}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
            ${lastMessageHtmlContent} 
          </blockquote></div>
        `;
      }
    } else {
      // For automated replies, use the full template (restoring previous logic)
      htmlMessage = `
        <div style="font-family: 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0 auto; padding: 20px; background: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
            <div style="margin-bottom: 24px;">
              <h3 style="color: #1f2937; font-size: 16px; font-weight: 500; margin: 0 0 8px;">
                You received a reply to your feedback
              </h3>
            </div>
            <div style="margin-bottom: 24px;">
              ${isFirstReply ? `
              <div style="margin-bottom: 16px;">
                <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Your original message</h4>
                <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap; background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 8px;">${feedback.message}</p>
              </div>
              ` : ''}
              <div style="margin-top: 24px; margin-bottom: 16px;">
                <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Reply from admin</h4>
                <div style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; background: #e6f7ff; padding: 12px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #0284c7;">${htmlReplyContent || replyContent}</div>
              </div>
            </div>
            <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px; text-align: center;">You can reply to this email to continue the conversation.</p>
            </div>
          </div>
        </div>
      `;
      // NOTE: Branding footer is NOT added to automated replies currently.
    }

    // 4. Construct Headers
    const messageId = `<reply-${replyId}@userbird.co>`;
    const originalNotificationId = `<feedback-notification-${feedbackId}@userbird.co>`;
    let inReplyToId = originalNotificationId;
    let referencesId = originalNotificationId;

    if (lastMessageId) {
      inReplyToId = lastMessageId;
      referencesId = `${originalNotificationId} ${lastMessageId}`; // Simple reference chain
      // TODO: A more robust approach would involve fetching the previous email's References header.
    } else if (isFirstReply) {
      inReplyToId = originalNotificationId;
      referencesId = originalNotificationId;
    }

    const headers = {
      "Message-ID": messageId,
      "In-Reply-To": inReplyToId,
      "References": referencesId
    };

    // 5. Send Email
    return this.sendEmail({
      to,
      from,
      subject: `Re: Feedback submitted by ${feedback.user_email}`,
      text: plainTextMessage, // Full text: reply + footer + quote
      html: htmlMessage, // Full HTML: reply + footer + quote
      headers
    });
  }
}

// Add a handler to make this function respond to direct HTTP requests
export const handler: Handler = async (event) => {
  console.log('Email service function directly invoked', {
    method: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters
  });
  
  // Check if the test email parameter is provided
  const testEmailAddress = event.queryStringParameters?.test;
  
  if (testEmailAddress && event.httpMethod === 'GET') {
    try {
      console.log('Attempting to send test email to:', testEmailAddress);
      
      const testFeedbackId = uuidv4();
      const result = await EmailService.sendEmail({
        to: testEmailAddress,
        from: 'support@userbird.co',
        subject: 'Userbird Email Test',
        text: 'This is a test email from Userbird to verify SendGrid integration is working properly.',
        html: '<p>This is a test email from Userbird to verify SendGrid integration is working properly.</p>',
        feedbackId: testFeedbackId
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Test email sent successfully',
          recipient: testEmailAddress,
          messageId: result.messageId,
          timestamp: new Date().toISOString()
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Failed to send test email',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        })
      };
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: 'Email service is running',
      usage: 'Add ?test=your@email.com to the URL to send a test email',
      timestamp: new Date().toISOString()
    })
  };
}; 