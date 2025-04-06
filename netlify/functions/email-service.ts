import sgMail from '@sendgrid/mail';
import { Handler } from '@netlify/functions';
import { v4 as uuidv4 } from 'uuid';

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
      
      // Sanitize HTML content to prevent security issues
      html = sanitizeHtml(html);
      
      // Ensure we have a plain text version (fallback)
      let text = params.text || '';
      if (!text && html) {
        // Convert HTML to plain text if only HTML is provided
        text = stripHtml(html);
      }
      
      let messageId: string | undefined;
      let headers = { ...params.headers };
      
      if (params.feedbackId) {
        // Use the standard format for dashboard replies to maintain email threading
        // This format matches what the dashboard was using previously
        messageId = params.inReplyTo ? 
          `<feedback-${params.feedbackId}@userbird.co>` : 
          `<feedback-notification-${params.feedbackId}@userbird.co>`;
        
        headers['Message-ID'] = messageId;
        
        if (params.inReplyTo) {
          headers['In-Reply-To'] = params.inReplyTo;
          headers['References'] = params.inReplyTo;
        }
      }
      
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        text,
        html,
        headers
      };

      console.log('Sending email via SendGrid:', {
        to: params.to,
        from: params.from,
        subject: params.subject,
        hasText: !!text,
        hasHtml: !!html,
        hasHeaders: !!params.headers,
        messageId,
        inReplyTo: params.inReplyTo
      });

      await sgMail.send(msg);
      console.log('Email sent successfully via SendGrid');
      
      return { 
        success: true,
        messageId
      };
    } catch (error) {
      console.error('Error sending email via SendGrid:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        to: params.to,
        from: params.from,
        subject: params.subject
      });
      throw error;
    }
  }

  static async sendFeedbackNotification(params: {
    to: string;
    formUrl: string;
    message?: string;
    url_path?: string;
    user_id?: string;
    user_email?: string;
    user_name?: string;
    operating_system?: string;
    screen_category?: string;
    image_url?: string;
    image_name?: string;
    created_at?: string;
    feedbackId?: string;
    formId?: string;
  }) {
    const {
      to,
      formUrl,
      message,
      url_path,
      user_id,
      user_email,
      user_name,
      operating_system,
      screen_category,
      image_url,
      image_name,
      created_at,
      feedbackId,
      formId
    } = params;

    const showUserInfo = user_id || user_email || user_name || url_path;
    const showSystemInfo = operating_system || screen_category;

    // Create HTML version with proper styling matching the template - don't sanitize this template
    const htmlMessage = `<!DOCTYPE html>
<html>
  <body style="font-family: 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0 auto; padding: 20px; background: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; font-size: 16px; font-weight: 500; margin: 0 0 8px;">
          New feedback received for <strong>${formUrl}</strong>
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
            <img src="${image_url}" alt="Feedback image" style="max-width: 100%; border-radius: 4px;" />
            ${image_name ? `<p style="color: #6b7280; font-size: 12px; margin: 4px 0 0;">${image_name}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${created_at ? `
        <div>
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Date</h4>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0;">${created_at}</p>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center;">
        <a href="https://app.userbird.co/forms/${formId || feedbackId?.split('-')[0] || ''}" 
           style="display: inline-block; background: #1f2937; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
          View All Responses
        </a>
      </div>
    </div>
  </body>
</html>`;

    // Create plain text version
    const textMessage = `
New feedback received for ${formUrl}

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
${image_url}

` : ''}${created_at ? `Received on ${created_at}` : ''}`;

    // Skip the sanitization for this template by sending directly to SendGrid
    const msg = {
      to,
      from: 'notifications@userbird.co',
      subject: `New feedback received for ${formUrl}`,
      text: textMessage,
      html: htmlMessage,
      headers: feedbackId ? {
        'Message-ID': `<feedback-notification-${feedbackId}@userbird.co>`
      } : undefined
    };

    try {
      console.log('Sending feedback notification email directly via SendGrid');
      await sgMail.send(msg);
      console.log('Feedback notification email sent successfully');
      
      return { 
        success: true,
        messageId: feedbackId ? `<feedback-notification-${feedbackId}@userbird.co>` : undefined
      };
    } catch (error) {
      console.error('Error sending feedback notification email:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
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
    isAdminDashboardReply?: boolean;
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
      isAdminDashboardReply = false
    } = params;

    // Format date for original message
    const compactDate = new Date(feedback.created_at).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Create plain text version
    const plainTextMessage = `${replyContent}\n\n\n${isFirstReply ? `--------------- Original Message ---------------
From: [${feedback.user_email}]
Sent: ${compactDate}
To: support@userbird.co
Subject: Feedback submitted by ${feedback.user_email}

${feedback.message}

` : ''}`;

    // Use minimal template for admin dashboard replies
    let htmlMessage;
    
    if (isAdminDashboardReply) {
      // For admin dashboard replies, use minimal styling and preserve HTML exactly as-is
      htmlMessage = htmlReplyContent || `<div style="white-space: pre-wrap;">${replyContent}</div>`;
    } else {
      // For automated replies, use full styling
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
    }

    return this.sendEmail({
      to,
      from: 'support@userbird.co',
      subject: `Re: Feedback submitted by ${feedback.user_email}`,
      text: plainTextMessage,
      html: htmlMessage,
      feedbackId,
      inReplyTo: lastMessageId,
      headers: lastMessageId ? {
        "In-Reply-To": lastMessageId,
        "References": lastMessageId
      } : {
        "In-Reply-To": `<feedback-notification-${feedbackId}@userbird.co>`,
        "References": `<feedback-notification-${feedbackId}@userbird.co>`
      }
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