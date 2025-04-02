import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as multipart from 'parse-multipart-data';
import crypto from 'crypto';

// Log environment variables at startup
console.log('Process email reply function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to decode quoted-printable content (like =3D for =)
function decodeQuotedPrintable(str: string): string {
  // Replace soft line breaks (=<CRLF>)
  str = str.replace(/=(\r\n|\n|\r)/g, '');
  
  // Replace hex-encoded characters
  str = str.replace(/=([0-9A-F]{2})/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Handle special Unicode character cases
  str = str.replace(/=C2=A0/g, ' '); // Non-breaking space
  str = str.replace(/=C2=BF/g, '¿'); // Inverted question mark
  str = str.replace(/=C2=A1/g, '¡'); // Inverted exclamation mark
  
  return str;
}

// Function to strip raw email headers and better handle email formats
function stripRawHeaders(emailText: string): string {
  // Try multiple encoding headers
  const encodingHeaders = [
    'Content-Transfer-Encoding: quoted-printable',
    'Content-Type: text/plain',
    'Content-Type: multipart/',
    'Content-Type: text/html'
  ];
  
  let cleanedText = emailText;
  let isQuotedPrintable = emailText.includes('Content-Transfer-Encoding: quoted-printable');
  
  // Look for each header type
  for (const header of encodingHeaders) {
    const splitIndex = cleanedText.indexOf(header);
    if (splitIndex !== -1) {
      // Take everything after that header
      cleanedText = cleanedText.substring(splitIndex + header.length);
      
      // Look for the end of headers (blank line)
      const bodyStart = cleanedText.indexOf('\n\n');
      if (bodyStart !== -1) {
        cleanedText = cleanedText.substring(bodyStart + 2);
        break; // Found the body, exit the loop
      }
    }
  }

  // Handle MIME boundaries
  const boundaryMatch = emailText.match(/boundary="([^"]+)"/);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = cleanedText.split(`--${boundary}`);
    
    // First try to find text/plain part
    let foundTextPart = false;
    for (const part of parts) {
      if (part.includes('Content-Type: text/plain')) {
        const contentStart = part.indexOf('\n\n');
        if (contentStart !== -1) {
          cleanedText = part.substring(contentStart + 2);
          foundTextPart = true;
          isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
          break;
        }
      }
    }
    
    // If no text/plain part, try to find HTML part and extract text from it
    if (!foundTextPart) {
      for (const part of parts) {
        if (part.includes('Content-Type: text/html')) {
          const contentStart = part.indexOf('\n\n');
          if (contentStart !== -1) {
            let htmlContent = part.substring(contentStart + 2);
            isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
            
            // If the content is quoted-printable encoded, decode it
            if (isQuotedPrintable) {
              htmlContent = decodeQuotedPrintable(htmlContent);
            }
            
            // Extract text from HTML by removing tags
            cleanedText = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            break;
          }
        }
      }
    }
  }
  
  // Decode quoted-printable content if needed
  if (isQuotedPrintable) {
    cleanedText = decodeQuotedPrintable(cleanedText);
  }
  
  // Remove charset information
  cleanedText = cleanedText.replace(/; charset="[^"]+"\s*\n?/g, '');
  
  // Remove any remaining headers
  const headerEnd = cleanedText.match(/^\s*(?:\S+:\s*\S+\s*\n)+\s*\n/);
  if (headerEnd) {
    cleanedText = cleanedText.substring(headerEnd[0].length);
  }
  
  // Often there's an empty line between headers and actual body
  return cleanedText.replace(/^\s+/, ''); // trim leading newlines/spaces
}

// Function to extract and sanitize HTML content from email
function extractHtmlContent(emailText: string): string | null {
  // First check for multipart/alternative with text/html part
  const multipartMatch = emailText.match(/Content-Type: multipart\/alternative;\s*boundary="([^"]+)"/i);
  
  if (multipartMatch && multipartMatch[1]) {
    const boundary = multipartMatch[1];
    const parts = emailText.split(`--${boundary}`);
    
    // Find the HTML part
    for (const part of parts) {
      if (part.includes('Content-Type: text/html')) {
        // Extract the HTML content
        const contentStart = part.indexOf('\n\n');
        if (contentStart !== -1) {
          let htmlContent = part.substring(contentStart + 2);
          
          // Check if it's quoted-printable encoded
          const isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
          if (isQuotedPrintable) {
            htmlContent = decodeQuotedPrintable(htmlContent);
          }
          
          // Sanitize and return the HTML
          console.log('Extracted HTML content from multipart/alternative email');
          return sanitizeHtml(htmlContent);
        }
      }
    }
  }
  
  // Fallback to standard Content-Type: text/html search if multipart parsing failed
  const htmlPartMatch = emailText.match(/Content-Type: text\/html[^]*?\n\n([^]*?)(?:--[^\n]*?(?:--)?$|\n*$)/mi);
  
  if (htmlPartMatch && htmlPartMatch[1]) {
    let htmlContent = htmlPartMatch[1];
    
    // Check if it's quoted-printable encoded
    const isQuotedPrintable = emailText.includes('Content-Transfer-Encoding: quoted-printable');
    if (isQuotedPrintable) {
      htmlContent = decodeQuotedPrintable(htmlContent);
    }
    
    // Sanitize the HTML to remove any potentially harmful content
    console.log('Extracted HTML content using regex pattern');
    return sanitizeHtml(htmlContent);
  }
  
  console.log('No HTML content found in email');
  return null;
}

// Create a local copy of the sanitize function since Netlify functions can't import from src folder
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

export const handler: Handler = async (event) => {
  console.log('Process email reply function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length,
    path: event.path,
    headers: event.headers,
    contentType: event.headers['content-type'] || event.headers['Content-Type']
  });

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
    let emailData: any = {};
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    // Handle multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      console.log('Parsing multipart/form-data');
      
      // Extract boundary from content type
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';
      
      if (boundary && event.body) {
        // Convert body to buffer if it's a string
        const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
        const parts = multipart.parse(bodyBuffer, boundary);
        
        // Process parts into emailData
        for (const part of parts) {
          const fieldName = part.name || '';
          const value = part.data.toString();
          emailData[fieldName] = value;
        }
        
        console.log('Parsed form data fields:', Object.keys(emailData));
        
        // Map SendGrid fields to expected fields if needed
        // SendGrid puts the email content in the 'email' field
        if (emailData.email && !emailData.text) {
          console.log('Mapping SendGrid email field to text field');
          emailData.text = emailData.email;
        }
      } else {
        console.log('Missing boundary or body in multipart data');
      }
    } else {
      // Try to parse as JSON if not multipart
      try {
        emailData = JSON.parse(event.body || '{}');
      } catch (e) {
        // If not JSON, use raw body as text
        console.log('Not JSON, using raw body as text');
        emailData = {
          text: event.body,
          from: event.headers['from'] || 'unknown',
          to: event.headers['to'] || 'unknown',
          subject: event.headers['subject'] || 'No Subject'
        };
      }
    }
    
    console.log('Parsed email data:', { 
      hasFrom: !!emailData.from,
      hasTo: !!emailData.to,
      hasSubject: !!emailData.subject,
      hasText: !!emailData.text,
      textLength: emailData.text?.length
    });
    
    // For testing: log the full email content with thread identifier
    console.log('Full email content for debugging:', emailData.text?.substring(0, 500));

    if (!emailData.text) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing required email content' }) 
      };
    }

    // Extract message headers
    let messageId: string | undefined;
    let inReplyTo: string | undefined;
    
    // Extract Message-ID from email headers
    const messageIdMatch = emailData.text.match(/Message-ID:\s*<([^>]+)>/i);
    if (messageIdMatch) {
      messageId = `<${messageIdMatch[1]}>`;
      console.log('Found Message-ID:', messageId);
    }
    
    // Extract In-Reply-To from email headers
    const inReplyToMatch = emailData.text.match(/In-Reply-To:\s*<([^>]+)>/i);
    if (inReplyToMatch) {
      inReplyTo = `<${inReplyToMatch[1]}>`;
      console.log('Found In-Reply-To:', inReplyTo);
    }
    
    // Try to extract feedbackId from In-Reply-To if it matches our format
    let feedbackId: string | undefined;
    
    if (inReplyTo) {
      // Extract feedback ID from our email format: <feedback-UUID@userbird.co>
      const feedbackIdMatch = inReplyTo.match(/<feedback-([a-f0-9-]+)@userbird\.co>/i);
      if (feedbackIdMatch) {
        feedbackId = feedbackIdMatch[1];
        console.log('Found feedback ID in In-Reply-To:', feedbackId);
      }
    }
    
    // If not found via In-Reply-To, try the thread identifier in the body
    if (!feedbackId) {
      const threadRegex = /thread::([a-f0-9-]+)::/i;
      
      // First try to find thread ID in subject
      let threadMatch = emailData.subject?.match(threadRegex);
      feedbackId = threadMatch?.[1];
      
      // If not found in subject, try the body
      if (!feedbackId) {
        threadMatch = emailData.text.match(threadRegex);
        feedbackId = threadMatch?.[1];
      }
    }
    
    // Try to extract from email headers if still not found
    if (!feedbackId && emailData.headers) {
      // Look for References or In-Reply-To headers
      const references = typeof emailData.headers === 'string' 
        ? emailData.headers 
        : JSON.stringify(emailData.headers);

      const refMatch = references.match(/feedback-([a-f0-9-]+)@userbird\.co/i);
      if (refMatch) {
        feedbackId = refMatch[1];
      }
    }

    // Look up the message_id in the database if we have one but no feedback ID
    if (!feedbackId && inReplyTo) {
      const { data: replyData } = await supabase
        .from('feedback_replies')
        .select('feedback_id')
        .eq('in_reply_to', inReplyTo)
        .single();
        
      if (replyData) {
        feedbackId = replyData.feedback_id;
        console.log('Found feedback ID from in_reply_to lookup:', feedbackId);
      }
    }
    
    // If still not found, try to match subject with feedback ID
    if (!feedbackId) {
      // Extract the original feedback ID from the subject
      const subjectMatch = emailData.subject?.match(/Re: Feedback submitted by ([^@]+@[^@]+\.[^@]+)/i);
      if (subjectMatch) {
        const email = subjectMatch[1];
        // Query feedback table to find the most recent feedback from this email
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('feedback')
          .select('id')
          .eq('user_email', email)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (!feedbackError && feedbackData) {
          feedbackId = feedbackData.id;
          console.log('Found feedback ID by email lookup:', feedbackId);
        }
      }
    }
    
    if (!feedbackId) {
      console.error('No thread identifier found in email');
      // For debugging - look for any ID-like patterns
      const possibleIds = emailData.text.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
      console.log('Possible UUID-like strings found:', possibleIds);
      
      return { 
        statusCode: 200, // Return 200 so email services don't retry
        body: JSON.stringify({ 
          warning: 'No thread identifier found in email',
          success: false 
        }) 
      };
    }

    console.log('Extracted feedback ID:', feedbackId);

    // Verify the feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (feedbackError || !feedback) {
      console.error('Feedback not found:', feedbackId, feedbackError);
      return { 
        statusCode: 200, // Return 200 so email services don't retry
        body: JSON.stringify({ 
          warning: 'Feedback not found', 
          feedbackId,
          success: false 
        }) 
      };
    }

    // Extract the email content, removing quoted parts and signatures
    let replyContent = stripRawHeaders(emailData.text);
    
    // Look for and remove boundary markers - handle Gmail's specific boundary format too
    const boundaryRegex = /--[0-9a-f]+(--)?\s*$|--[0-9]{15,}[a-f0-9]{15,}(--)?\s*$/gm;
    replyContent = replyContent.replace(boundaryRegex, '');
    
    // Handle Content-Type headers that might be in the content
    replyContent = replyContent.replace(/Content-Type: text\/plain; charset="[^"]+"\s*\n?/g, '');
    replyContent = replyContent.replace(/Content-Type: text\/html; charset="[^"]+"\s*\n?/g, '');
    replyContent = replyContent.replace(/Content-Type: text\/plain;?\s*\n?/g, '');
    replyContent = replyContent.replace(/Content-Type: text\/html;?\s*\n?/g, '');
    replyContent = replyContent.replace(/; charset="[^"]+"\s*\n?/g, '');
    
    // Remove MIME-Version headers that might be in the content
    replyContent = replyContent.replace(/MIME-Version: 1.0\s*\n?/g, '');
    
    // Check for HTML content and extract text
    if (replyContent.includes('<div') || replyContent.includes('<p') || 
        replyContent.includes('</div>') || replyContent.includes('</p>') || 
        replyContent.includes('<a href')) {
      console.log('Detected HTML content, extracting text and preserving links');
      
      // First, preserve links by converting them to text + URL format
      // Replace <a href="URL">text</a> with text (URL)
      replyContent = replyContent.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, 
        (match, url, text) => {
          // If the text is the same as the URL, just return the URL
          if (text.trim() === url.trim()) {
            return url;
          }
          // Otherwise return text (URL)
          return `${text} (${url})`;
        }
      );
      
      // Then remove remaining HTML tags and decode entities
      replyContent = replyContent
        .replace(/<[^>]*>/g, ' ')  // Replace tags with space
        .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
        .replace(/&amp;/g, '&')    // Replace ampersand
        .replace(/&lt;/g, '<')     // Replace less than
        .replace(/&gt;/g, '>')     // Replace greater than
        .replace(/&quot;/g, '"')   // Replace quotes
        .replace(/&#39;/g, "'")    // Replace apostrophe
        .replace(/\s+/g, ' ')      // Consolidate whitespace
        .trim();
    }
    
    // Remove everything after the original message marker if present
    // Check for multiple variants of "original message" markers
    const originalMessageMarkers = [
      '--------------- Original Message ---------------',
      'Original Message',
      'On .* wrote:',
      '________________________________',
      '‐‐‐‐‐‐‐ Original Message ‐‐‐‐‐‐‐',
      '-----Original Message-----',
      'From:',
      'Reply to this email directly or view it on GitHub',
      'Please do not modify this line or token'
    ];

    // Find the first occurrence of any marker
    let earliestMarkerIndex = replyContent.length;
    for (const marker of originalMessageMarkers) {
      const index = replyContent.indexOf(marker);
      if (index > -1 && index < earliestMarkerIndex) {
        earliestMarkerIndex = index;
      }
      
      // Also check for regex patterns like "On DATE, NAME wrote:"
      if (marker === 'On .* wrote:') {
        const match = replyContent.match(/On [A-Za-z]{3}, [A-Za-z]{3} \d{1,2}, \d{4} at \d{1,2}:\d{2} (?:AM|PM) [A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,} wrote:/);
        if (match && match.index !== undefined && match.index < earliestMarkerIndex) {
          earliestMarkerIndex = match.index;
        }
      }
    }
    
    // Truncate at the earliest marker
    if (earliestMarkerIndex < replyContent.length) {
      replyContent = replyContent.substring(0, earliestMarkerIndex).trim();
    }
    
    // Alternative marker patterns for quoted content
    const quotedMarkers = [
      'On Mon,',
      'On Tue,',
      'On Wed,',
      'On Thu,',
      'On Fri,',
      'On Sat,',
      'On Sun,',
      '> ',
      'wrote:',
      '----- Original Message -----'
    ];
    
    for (const marker of quotedMarkers) {
      const markerIndex = replyContent.indexOf(marker);
      if (markerIndex > 0) { // Only if it's not at the start
        replyContent = replyContent.substring(0, markerIndex).trim();
      }
    }

    // Handle common signature delimiters (but don't truncate if they appear at the very beginning)
    const signatureMarkers = [
      '\n-- \n',
      '\n--\n',
      '\n_______________\n',
      '\n------------\n',
      '\nRegards,\n',
      '\nKind regards,\n',
      '\nBest regards,\n',
      '\nWarm regards,\n',
      '\nThanks,\n',
      '\nThank you,\n',
      '\nCheers,\n',
      '\nSincerely,\n'
    ];
    
    for (const marker of signatureMarkers) {
      const markerIndex = replyContent.indexOf(marker);
      // Make sure we're not at the start and there's actual content before the signature
      if (markerIndex > 20) { 
        // Check if there's meaningful content after signature or just boilerplate 
        const afterSignature = replyContent.substring(markerIndex).toLowerCase();
        
        // Skip trimming if there's a URL or meaningful content after the signature
        if (!afterSignature.includes('http://') && 
            !afterSignature.includes('https://') && 
            !afterSignature.includes('@') && 
            !afterSignature.includes('call') &&
            afterSignature.length < 200) {
          replyContent = replyContent.substring(0, markerIndex).trim();
        }
      }
    }

    console.log('Extracted reply content:', replyContent);

    // Remove excess whitespace
    replyContent = replyContent.trim();
    
    // Add debug logging for final content
    console.log('Final extracted reply content:', {
      length: replyContent.length,
      preview: replyContent.substring(0, 100) + (replyContent.length > 100 ? '...' : '')
    });

    // Save the reply to the database
    const replyId = crypto.randomUUID();
    
    // Extract HTML content if available
    let htmlContent = extractHtmlContent(emailData.text);
    
    // Process potential markdown-like syntax in the reply content
    if (!htmlContent) {
      // First check if we have any markdown-like formatting in the text
      const hasMarkdown = replyContent.match(/\*\*.*?\*\*|\*.*?\*/);
      
      if (hasMarkdown) {
        // Process markdown-like syntax
        htmlContent = replyContent
          // Escape HTML special characters first
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          // Process bold text (**bold**)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          // Process italic text (*italic*)
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          // Convert URLs to links
          .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
          // Convert newlines to <br> tags
          .replace(/\n/g, '<br>');
      } else {
        // Simple conversion for plain text
        htmlContent = replyContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>')
          // Convert URLs to links
          .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      }
    }
    
    // Ensure the HTML content is properly sanitized
    if (htmlContent) {
      htmlContent = sanitizeHtml(htmlContent);
    }
    
    const { error: insertError } = await supabase
      .from('feedback_replies')
      .insert({
        id: replyId,
        feedback_id: feedbackId,
        content: replyContent,
        html_content: htmlContent,
        sender_type: 'user',
        message_id: messageId,
        in_reply_to: inReplyTo
      });

    if (insertError) {
      console.error('Error inserting reply:', insertError);
      throw new Error(`Error inserting reply: ${insertError.message}`);
    }

    console.log('Successfully added user reply to thread', {
      replyId,
      feedbackId,
      replyContentLength: replyContent.length,
      htmlContentLength: htmlContent?.length,
      messageId,
      inReplyTo
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        replyId,
        messageId,
        inReplyTo
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