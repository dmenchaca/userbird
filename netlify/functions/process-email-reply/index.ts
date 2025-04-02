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

// Add interface for attachment structure
interface EmailAttachment {
  filename: string;
  contentType: string;
  contentId?: string;
  data: Buffer;
  isInline: boolean;
}

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
function extractHtmlContent(emailText: string): string {
  if (!emailText) return '';
  
  console.log('Starting HTML content extraction');
  
  // Check if this is a multipart/related email (which often has images)
  const isMultipartRelated = emailText.includes('Content-Type: multipart/related');
  
  if (isMultipartRelated) {
    console.log('Detected multipart/related email structure');
  }
  
  // Find the boundary marker in the email
  const boundaryMatch = emailText.match(/boundary="?([^"\r\n]+)"?/i);
  if (!boundaryMatch || !boundaryMatch[1]) {
    console.log('No boundary found, treating as plain text email');
    return '';
  }
  
  const boundary = boundaryMatch[1];
  console.log(`Found boundary: ${boundary}`);
  
  // Split the email based on the boundary
  const parts = emailText.split(`--${boundary}`);
  console.log(`Email split into ${parts.length} parts`);
  
  // Look for the HTML content in the parts
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log(`Examining part ${i+1}/${parts.length}, length: ${part.length} characters`);
    
    // Check if this part is HTML
    const contentTypeMatch = part.match(/Content-Type:\s*text\/html/i);
    if (!contentTypeMatch) {
      console.log(`Part ${i+1} is not HTML, skipping`);
      continue;
    }
    
    console.log(`Found HTML content in part ${i+1}`);
    
    // Check if it's quoted-printable
    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*quoted-printable/i);
    const isQuotedPrintable = !!encodingMatch;
    
    if (isQuotedPrintable) {
      console.log('Content is quoted-printable encoded, will decode');
    }
    
    // Extract the content after the headers
    const contentStart = part.indexOf('\r\n\r\n');
    if (contentStart === -1) {
      console.log(`No content separator found in part ${i+1}, skipping`);
      continue;
    }
    
    let htmlContent = part.substring(contentStart + 4);
    
    // Log the raw content length
    console.log(`Raw HTML content length: ${htmlContent.length} characters`);
    console.log(`Raw HTML content preview: ${htmlContent.substring(0, 100)}...`);
    
    // Decode if necessary
    if (isQuotedPrintable) {
      htmlContent = decodeQuotedPrintable(htmlContent);
      console.log(`Decoded HTML content length: ${htmlContent.length} characters`);
      console.log(`Decoded HTML content preview: ${htmlContent.substring(0, 100)}...`);
    }
    
    // Check if the content looks like HTML (contains at least one tag)
    if (!htmlContent.includes('<')) {
      console.log('Content doesn\'t appear to be valid HTML (no tags found)');
      continue;
    }
    
    return htmlContent.trim();
  }
  
  console.log('No HTML content found in any part of the email');
  return '';
}

// Create a local copy of the sanitize function since Netlify functions can't import from src folder
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Clean up email artifacts that might have leaked into the HTML
  // Strip any boundary markers that leaked into the content
  html = html.replace(/--[0-9a-f]+(?:--)?\s*$/gm, '');
  html = html.replace(/Content-Type: [^<>\n]+\n/gi, '');
  html = html.replace(/Content-Transfer-Encoding: [^<>\n]+\n/gi, '');
  
  // List of allowed tags - keep this limited for security
  const allowedTags = [
    'a', 'p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 
    'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'span', 'div'
  ];
  
  // Remove potentially harmful tags and patterns
  const blacklistPattern = /<script|<iframe|<object|<embed|<form|<input|<style|<link|javascript:|onclick|onerror|onload|onmouseover/gi;
  let sanitized = html.replace(blacklistPattern, '');
  
  // We no longer replace all embedded image references, we'll handle them based on cidToUrlMap
  // Only replace cid: references that weren't processed earlier
  sanitized = sanitized.replace(/<img[^>]*src=(?:"|')cid:[^"']*(?:"|')[^>]*>/gi, '[Image attachment]');
  
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
      // Extract src, alt, and width/height if they exist
      const srcMatch = attributes.match(/src\s*=\s*['"]([^'"]*)['"]/i);
      const altMatch = attributes.match(/alt\s*=\s*['"]([^'"]*)['"]/i);
      
      // Skip "cid:" references which are embedded images that we haven't processed
      if (srcMatch && srcMatch[1].startsWith('cid:')) {
        return '[Image attachment]';
      }
      
      // Keep URLs that are public (HTTP/HTTPS)
      const src = srcMatch && (srcMatch[1].startsWith('http://') || srcMatch[1].startsWith('https://')) 
        ? ` src="${srcMatch[1]}"` 
        : '';
      
      const alt = altMatch ? ` alt="${altMatch[1]}"` : ' alt="Email attachment"';
      
      // Only return an img tag if we have a valid src
      if (src) {
        return `<img${src}${alt} style="max-width: 100%;">`;
      } else {
        return '[Image]';
      }
    }
    
    // For all other allowed tags, strip all attributes
    return `<${tagName}>`;
  });
  
  // Clean closing tags - remove any that aren't in our allowlist
  const closingTagPattern = /<\/([a-z0-9]+)>/gi;
  sanitized = sanitized.replace(closingTagPattern, (_, tagName) => {
    return allowedTags.includes(tagName.toLowerCase()) ? `</${tagName}>` : '';
  });
  
  // Final cleanup of any remaining email artifacts
  sanitized = sanitized.replace(/--\s*$/gm, '');
  
  return sanitized;
}

// Function to parse and extract attachments from a multipart email
async function parseAttachments(emailText: string, replyId: string): Promise<{ attachments: EmailAttachment[], cidToUrlMap: Record<string, string> }> {
  const attachments: EmailAttachment[] = [];
  const cidToUrlMap: Record<string, string> = {};
  
  // Find the main boundary
  const boundaryMatch = emailText.match(/boundary="([^"]+)"/i);
  if (!boundaryMatch || !boundaryMatch[1]) {
    console.log('No boundary found for attachments');
    return { attachments, cidToUrlMap };
  }
  
  const boundary = boundaryMatch[1];
  const parts = emailText.split(`--${boundary}`);
  
  console.log(`Examining ${parts.length} email parts for potential attachments`);
  
  for (const part of parts) {
    // Check if this part is an image or attachment
    const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
    if (!contentTypeMatch) continue;
    
    const contentType = contentTypeMatch[1].trim();
    
    // Skip text/plain and text/html parts, we're looking for attachments
    if (contentType === 'text/plain' || contentType === 'text/html') continue;
    
    // Parse content ID (for inline images)
    let contentId: string | undefined;
    const contentIdMatch = part.match(/Content-ID:\s*<([^>]+)>/i);
    if (contentIdMatch && contentIdMatch[1]) {
      contentId = contentIdMatch[1];
      console.log(`Found attachment with Content-ID: ${contentId}`);
    }
    
    // Parse filename
    let filename = '';
    const filenameMatch = part.match(/filename="([^"]+)"/i);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
      console.log(`Found attachment with filename: ${filename}`);
    } else {
      // Generate a filename if none is provided
      const extension = contentType.split('/')[1] || 'bin';
      filename = `attachment-${Date.now()}.${extension}`;
      console.log(`Generated filename for attachment: ${filename}`);
    }
    
    // Determine if this is an inline attachment
    const isInline = part.includes('Content-Disposition: inline') || !!contentId;
    
    // Extract the binary data
    const contentStart = part.indexOf('\r\n\r\n');
    if (contentStart === -1) continue;
    
    let data = part.substring(contentStart + 4);
    
    // Determine the encoding
    const transferEncodingMatch = part.match(/Content-Transfer-Encoding:\s*([^\s;]+)/i);
    const encoding = transferEncodingMatch ? transferEncodingMatch[1].toLowerCase() : '';
    
    // Handle different encodings
    if (encoding === 'base64') {
      // Clean up base64 string (remove newlines, etc.)
      data = data.replace(/[\r\n\s]/g, '');
      const buffer = Buffer.from(data, 'base64');
      
      attachments.push({
        filename,
        contentType,
        contentId,
        data: buffer,
        isInline
      });
      
      console.log(`Processed base64 attachment: ${filename}, size: ${buffer.length} bytes`);
    } else {
      console.log(`Unsupported encoding for attachment: ${encoding}`);
    }
  }
  
  console.log(`Found ${attachments.length} attachments in email`);
  
  // Upload attachments to Supabase Storage and create mapping
  for (const attachment of attachments) {
    if (attachment.isInline && attachment.contentId) {
      try {
        const filename = `${replyId}_${attachment.filename}`;
        const storagePath = `feedback-replies/${replyId}/${filename}`;
        
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
          console.log(`Generated public URL for ${attachment.contentId}: ${urlData.publicUrl}`);
          cidToUrlMap[attachment.contentId] = urlData.publicUrl;
          
          // Store attachment metadata in database only if the table exists
          if (feedbackAttachmentsTableExists) {
            try {
              const attachmentId = crypto.randomUUID();
              const { error: insertError } = await supabase
                .from('feedback_attachments')
                .insert({
                  id: attachmentId,
                  reply_id: replyId,
                  filename: attachment.filename,
                  content_id: attachment.contentId,
                  content_type: attachment.contentType,
                  url: urlData.publicUrl,
                  is_inline: true
                });
              
              if (insertError) {
                console.error('Error storing attachment metadata:', insertError);
              } else {
                console.log(`Successfully stored attachment metadata with ID: ${attachmentId}`);
              }
            } catch (insertErr) {
              console.error('Exception while inserting attachment metadata:', insertErr);
              // Even if we can't store the metadata, we still want to replace cid: references
              // so we continue processing
            }
          } else {
            console.log('Skipping attachment metadata storage because the feedback_attachments table does not exist');
          }
        }
      } catch (error) {
        console.error('Error processing attachment:', error);
      }
    }
  }
  
  return { attachments, cidToUrlMap };
}

// Function to replace CID references in HTML with public URLs
function replaceCidWithUrls(html: string, cidToUrlMap: Record<string, string>): string {
  if (!html || Object.keys(cidToUrlMap).length === 0) return html;
  
  // Replace src="cid:xxx" and src=3D"cid:xxx" with public URLs
  return html.replace(
    /<img\s+[^>]*src=(?:"|'|3D")cid:([^"']+)(?:"|'|")[^>]*>/gi,
    (match, cid) => {
      const publicUrl = cidToUrlMap[cid];
      if (publicUrl) {
        console.log(`Replacing cid:${cid} with ${publicUrl}`);
        return match.replace(/src=(?:"|'|3D")cid:[^"']+(?:"|'|")/, `src="${publicUrl}"`);
      }
      // If no matching URL found, replace with a placeholder
      return '[Image attachment]';
    }
  );
}

// Add a global flag for table existence
let feedbackAttachmentsTableExists = true;

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
      console.log('The feedback_attachments table does not exist. Please create it manually in the Supabase dashboard with these columns:');
      console.log('- id: UUID PRIMARY KEY');
      console.log('- reply_id: UUID REFERENCES feedback_replies(id)');
      console.log('- filename: TEXT NOT NULL');
      console.log('- content_id: TEXT');
      console.log('- content_type: TEXT NOT NULL');
      console.log('- url: TEXT NOT NULL');
      console.log('- is_inline: BOOLEAN DEFAULT FALSE');
      console.log('- created_at: TIMESTAMPTZ DEFAULT TIMEZONE(\'utc\', NOW())');
      
      // Store data about attachments in memory for this function execution
      console.log('Creating in-memory storage for attachments for this request');
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
    
    // Extract HTML content and ensure it's properly stored
    let htmlContent = extractHtmlContent(emailData.text);
    
    // For debugging - log the extracted HTML content
    console.log('Extracted HTML content preview:', {
      hasHtmlContent: !!htmlContent,
      previewHtml: htmlContent ? htmlContent.substring(0, 200) + '...' : 'None found',
      contentType: emailData.headers?.['content-type'] || 'Unknown'
    });

    // If no HTML content was found in multipart sections, check for markdown-like syntax or create basic HTML
    if (!htmlContent) {
      console.log('No HTML content extracted, checking for markdown syntax');
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
        
        console.log('Created HTML content from markdown-like syntax');
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
        
        console.log('Created simple HTML content from plain text');
      }
    }

    // Ensure the HTML content is properly sanitized
    if (htmlContent) {
      // Make sure to sanitize the HTML content before storing
      const rawHtmlPreview = htmlContent.substring(0, 100);
      console.log('Raw HTML content before sanitizing:', rawHtmlPreview);
      
      htmlContent = sanitizeHtml(htmlContent);
      console.log('Final sanitized HTML content preview:', htmlContent.substring(0, 100) + '...');
    } else {
      console.error('No HTML content could be extracted or created');
      // Fallback to simple text-to-HTML conversion
      htmlContent = `<div style="white-space: pre-wrap;">${replyContent.replace(/\n/g, '<br>')}</div>`;
      console.log('Created fallback HTML content');
    }

    // Add more detailed logging for the inserted content
    console.log('Content being stored in database:', {
      plainTextLength: replyContent?.length,
      htmlContentLength: htmlContent?.length,
      htmlContentType: typeof htmlContent,
      htmlContentIsNull: htmlContent === null,
      htmlContentIsEmpty: htmlContent === ''
    });

    // Add final validation to make sure we don't store invalid HTML
    if (htmlContent) {
      // Check if the content looks like a multipart boundary or contains only non-HTML content
      if (htmlContent.startsWith('--') || 
          htmlContent.startsWith('Content-Type:') || 
          !htmlContent.includes('<')) {
        console.log('HTML content appears to be invalid or contain boundary data:', htmlContent.substring(0, 100));
        // Fallback to simple text-to-HTML conversion
        htmlContent = `<div style="white-space: pre-wrap;">${replyContent.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</div>`;
        console.log('Replaced with fallback HTML content');
      }
      
      // Final cleanup for any content beyond a certain length (likely not legitimate HTML)
      if (htmlContent.length > 100000) {
        console.log('HTML content is suspiciously large, truncating:', htmlContent.length);
        htmlContent = `<div style="white-space: pre-wrap;">${replyContent.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</div>`;
      }
    }

    // First, insert the reply into the database
    const { data: insertedReply, error: insertError } = await supabase
      .from('feedback_replies')
      .insert([
        {
          id: replyId, // Keep the same ID for consistency
          feedback_id: feedbackId,
          sender_type: 'user',
          content: replyContent,
          html_content: htmlContent,
          message_id: messageId,
          in_reply_to: inReplyTo
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting reply into database:', insertError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error during reply storage' }) };
    }

    console.log('Successfully stored reply with HTML content in database');

    // Now that we have a valid reply ID, process attachments
    // Parse attachments and get URL mapping for inline images
    const { cidToUrlMap } = await parseAttachments(emailData.text, replyId);

    // Replace CIDs with public URLs in HTML content
    if (htmlContent && Object.keys(cidToUrlMap).length > 0) {
      console.log('Replacing CID references with public URLs');
      
      // Update the HTML content with the replaced CID references
      const updatedHtmlContent = replaceCidWithUrls(htmlContent, cidToUrlMap);
      
      // Only update if there were actually changes
      if (updatedHtmlContent !== htmlContent) {
        htmlContent = updatedHtmlContent;
        
        // Update the reply with the new HTML content that includes public URLs
        const { error: updateError } = await supabase
          .from('feedback_replies')
          .update({ html_content: htmlContent })
          .eq('id', replyId);
        
        if (updateError) {
          console.error('Error updating reply with public image URLs:', updateError);
          // Continue anyway - the reply is stored but might have cid: references
        } else {
          console.log('Updated reply with public image URLs');
        }
      }
    }

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