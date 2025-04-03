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
  url?: string; // Add URL property for public access
}

// Function to decode quoted-printable content (like =3D for =)
function decodeQuotedPrintable(str: string): string {
  // Replace soft line breaks (=<CRLF>)
  str = str.replace(/=(\r\n|\n|\r)/g, '');
  
  // First, let's process multi-byte UTF-8 sequences (2 or more bytes)
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    // Check if we have a sequence of =XX=XX pattern (potential UTF-8 multi-byte sequence)
    if (str[i] === '=' && i + 2 < str.length) {
      const hexBytes: number[] = [];
      let currentIndex = i;
      let isValidSequence = true;
      
      // Collect all consecutive =XX patterns
      while (currentIndex < str.length && str[currentIndex] === '=' && currentIndex + 2 < str.length) {
        const hex = str.substring(currentIndex + 1, currentIndex + 3);
        if (/^[0-9A-F]{2}$/i.test(hex)) {
          hexBytes.push(parseInt(hex, 16));
          currentIndex += 3; // Move past the =XX
        } else {
          isValidSequence = false;
          break;
        }
      }
      
      // Check if this is likely a multi-byte UTF-8 sequence (2+ bytes)
      if (hexBytes.length >= 2 && isValidSequence) {
        try {
          // Try to decode as UTF-8
          const buffer = Buffer.from(hexBytes);
          const decoded = buffer.toString('utf8');
          result += decoded;
          i = currentIndex; // Move past the entire sequence
        } catch (e) {
          // If decoding fails, handle as individual bytes
          result += '=';
          i++; // Move past the = and process one by one
        }
      } else {
        // Single byte or invalid sequence
        if (i + 2 < str.length && /^[0-9A-F]{2}$/i.test(str.substring(i + 1, i + 3))) {
          // Valid =XX pattern (single byte)
          const hex = str.substring(i + 1, i + 3);
          result += String.fromCharCode(parseInt(hex, 16));
          i += 3;
        } else {
          // Regular character
          result += str[i];
          i++;
        }
      }
    } else {
      // Regular character
      result += str[i];
      i++;
    }
  }
  
  return result;
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
  
  // Preserve Gmail's image format for later processing
  // This will be handled by replaceCidWithUrls function
  const gmailImageReferences: string[] = [];
  html = html.replace(/\[image:?\s*(.*?)\]/gi, (match) => {
    gmailImageReferences.push(match);
    return `__GMAIL_IMAGE_${gmailImageReferences.length - 1}__`;
  });
  
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
      // Extract src, alt, style, width/height if they exist
      const srcMatch = attributes.match(/src\s*=\s*['"]([^'"]*)['"]/i);
      const altMatch = attributes.match(/alt\s*=\s*['"]([^'"]*)['"]/i);
      const styleMatch = attributes.match(/style\s*=\s*['"]([^'"]*)['"]/i);
      const widthMatch = attributes.match(/width\s*=\s*['"]([^'"]*)['"]/i);
      const heightMatch = attributes.match(/height\s*=\s*['"]([^'"]*)['"]/i);
      
      // Skip "cid:" references which are embedded images that we haven't processed
      if (srcMatch && srcMatch[1].startsWith('cid:')) {
        return '[Image attachment]';
      }
      
      // Keep URLs that are public (HTTP/HTTPS)
      const src = srcMatch && (srcMatch[1].startsWith('http://') || srcMatch[1].startsWith('https://')) 
        ? ` src="${srcMatch[1]}"` 
        : '';
      
      const alt = altMatch ? ` alt="${altMatch[1]}"` : ' alt="Email attachment"';
      
      // Preserve styles, focusing only on max-width and other safe properties
      let style = ' style="max-width: 100%;"';
      if (styleMatch) {
        const safeStyle = styleMatch[1]
          .replace(/expression\s*\(/gi, '') // Remove JS expressions
          .replace(/url\s*\(/gi, '') // Remove url() references
          .replace(/position\s*:/gi, '') // Remove positioning
          .replace(/z-index\s*:/gi, '') // Remove z-index
          .trim();
        
        // If after sanitizing we still have style content, use it
        if (safeStyle && !safeStyle.includes('javascript:')) {
          // Ensure max-width is included for responsive display
          style = safeStyle.includes('max-width') 
            ? ` style="${safeStyle}"` 
            : ` style="${safeStyle}; max-width: 100%;"`;
        }
      }
      
      // Preserve dimensions if specified
      const width = widthMatch ? ` width="${widthMatch[1]}"` : '';
      const height = heightMatch ? ` height="${heightMatch[1]}"` : '';
      
      // Only return an img tag if we have a valid src
      if (src) {
        return `<img${src}${alt}${style}${width}${height}>`;
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
  
  // Restore Gmail image references
  for (let i = 0; i < gmailImageReferences.length; i++) {
    sanitized = sanitized.replace(`__GMAIL_IMAGE_${i}__`, gmailImageReferences[i]);
  }
  
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
    if (!contentTypeMatch) {
      console.log('No Content-Type header found in this part, skipping');
      continue;
    }
    
    const contentType = contentTypeMatch[1].trim();
    console.log(`Found part with Content-Type: ${contentType}`);
    
    // Skip text/plain and text/html parts, we're looking for attachments
    if (contentType === 'text/plain' || contentType === 'text/html') {
      console.log('Skipping text/plain or text/html part');
      continue;
    }
    
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
  
  console.log(`Found ${Object.keys(cidToUrlMap).length} CID mappings from attachments`);
  
  return { attachments, cidToUrlMap };
}

// Function to replace CID references in HTML with public URLs
function replaceCidWithUrls(
  content: string, 
  cidToUrlMap: Record<string, string>, 
  attachments: EmailAttachment[] = [], 
  isHtml: boolean = true
): string {
  if (!content || (Object.keys(cidToUrlMap).length === 0 && attachments.length === 0)) return content;
  
  console.log('CID to URL mappings:', JSON.stringify(cidToUrlMap));
  console.log('Content before CID replacement (preview):', content.substring(0, 200));

  // Convert text to HTML if needed
  let html = isHtml ? content : content.replace(/\n/g, '<br>');
  
  // First, replace standard <img src="cid:xxx"> format
  let result = html.replace(
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
  
  // Next, handle Gmail's [image: filename.png] format
  // Get all the content IDs that we have URLs for
  const allContentIds = Object.keys(cidToUrlMap);
  
  // For each content ID, try to find a corresponding image reference
  for (const cid of allContentIds) {
    // Extract the filename from Supabase URL or content ID
    let filename = '';
    
    // Try to extract from URL
    const filenameFromUrl = cidToUrlMap[cid].match(/\/([^\/]+)$/);
    if (filenameFromUrl && filenameFromUrl[1]) {
      filename = decodeURIComponent(filenameFromUrl[1].split('_').pop() || '');
    }
    
    // If no filename from URL, try the content ID itself
    if (!filename && cid) {
      filename = cid;
    }
    
    if (filename) {
      console.log(`Looking for image reference to ${filename} to replace with ${cidToUrlMap[cid]}`);
      
      // Match [image: filename.png] pattern - use non-greedy match with .*? to avoid over-matching
      const gmailImagePattern = new RegExp(`\\[image:?\\s*(.*?${filename.replace(/\./g, '\\.')}.*?)\\]`, 'gi');
      
      result = result.replace(gmailImagePattern, (match, capturedFilename) => {
        console.log(`Found matching image reference: ${match}, replacing with <img> tag`);
        return `<img src="${cidToUrlMap[cid]}" alt="${capturedFilename || 'Email attachment'}" style="max-width: 100%;">`;
      });
      
      // Also look for plaintext image attachments like [cid:image001.png@01D9C77F.C0D1A240]
      const plainTextCidPattern = new RegExp(`\\[cid:${cid}\\]`, 'gi');
      result = result.replace(plainTextCidPattern, (match) => {
        console.log(`Found plaintext CID reference: ${match}, replacing with <img> tag`);
        return `<img src="${cidToUrlMap[cid]}" alt="Email attachment" style="max-width: 100%;">`;
      });
      
      // Also replace [Image attachment] text with actual image
      result = result.replace(/\[Image attachment\]/gi, (match) => {
        console.log('Replacing [Image attachment] with <img> tag');
        return `<img src="${cidToUrlMap[cid]}" alt="Email attachment" style="max-width: 100%;">`;
      });
    }
  }
  
  // Add all attachments that weren't explicitly referenced
  const imgTagCount = (result.match(/<img[^>]+>/g) || []).length;
  
  // Handle the case where we have images but no corresponding image tags in the content
  if (Object.keys(cidToUrlMap).length > 0 && imgTagCount === 0) {
    console.log('No image tags found in content, appending all attachments');
    
    // If any content exists, add a separator
    if (result.trim().length > 0) {
      result += '<br><br>';
    }
    
    // Append all images
    for (const cid of Object.keys(cidToUrlMap)) {
      const publicUrl = cidToUrlMap[cid];
      
      // Try to extract filename for alt text
      let altText = 'Email attachment';
      const filenameMatch = publicUrl.match(/\/([^\/]+)$/);
      if (filenameMatch && filenameMatch[1]) {
        altText = decodeURIComponent(filenameMatch[1].split('_').pop() || 'Email attachment');
      }
      
      result += `<img src="${publicUrl}" alt="${altText}" style="max-width: 100%;"><br>`;
    }
  }
  
  // Add any remaining attachments that aren't inline images but should be shown
  // We can directly use the url property now
  const nonInlineAttachments = attachments.filter(
    attachment => !attachment.isInline && attachment.url && 
    !Object.values(cidToUrlMap).some(url => url === attachment.url)
  );
  
  if (nonInlineAttachments.length > 0) {
    console.log(`Adding ${nonInlineAttachments.length} non-inline attachments`);
    
    // If any content exists, add a separator
    if (result.trim().length > 0) {
      result += '<br><br><div class="attachments-section">';
    }
    
    // Add each attachment
    for (const attachment of nonInlineAttachments) {
      // We can now safely use attachment.url directly
      if (attachment.url) {
        // For images, display them
        if (attachment.contentType?.startsWith('image/')) {
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
      } else {
        // Fallback for attachments without URLs
        result += `<div class="attachment">[Attachment: ${attachment.filename}]</div>`;
      }
    }
    
    if (result.trim().length > 0) {
      result += '</div>';
    }
  }
  
  return result;
}

// Add a global flag for table existence
let feedbackAttachmentsTableExists = true;

// Function to extract HTML or text content based on priority
async function extractEmailContent(
  emailData: any, 
  feedbackId: string
): Promise<{ 
  htmlContent: string | null; 
  textContent: string | null; 
  hasAttachments: boolean;
}> {
  console.log('Extracting email content');
  
  let htmlContent: string | null = null;
  let textContent: string | null = null;
  let hasAttachments = false;
  
  // Check if the email contains attachments
  if (emailData.attachments && Array.isArray(emailData.attachments) && emailData.attachments.length > 0) {
    hasAttachments = true;
    console.log('Email contains attachments');
  }
  
  // For SendGrid's inbound parse webhook, it places the entire email in the 'email' field
  // which we map to 'text' - need to extract HTML from this
  if (emailData.text && !emailData.html) {
    // First, try to extract HTML directly if the text field contains HTML content
    // This handles Gmail and many other email clients that send HTML content
    
    // Look for complete HTML document
    const fullHtmlMatch = emailData.text.match(/<html[^>]*>[\s\S]*<\/html>/i);
    if (fullHtmlMatch && fullHtmlMatch[0]) {
      htmlContent = fullHtmlMatch[0];
      console.log('Found complete HTML document in email text');
    } else {
      // Look for HTML body content
      const bodyContentMatch = emailData.text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyContentMatch && bodyContentMatch[1]) {
        htmlContent = bodyContentMatch[1];
        console.log('Found HTML body content in email text');
      } else {
        // Look for div-wrapped content which is common in email clients
        const divMatch = emailData.text.match(/<div[\s\S]*<\/div>/i);
        if (divMatch && divMatch[0]) {
          htmlContent = divMatch[0];
          console.log('Found div-wrapped HTML content in email text');
        }
      }
    }
    
    // Always keep the raw text as a fallback
    textContent = emailData.text;
  } else {
    // Standard email format with separate html and text parts
    if (emailData.html) {
      htmlContent = emailData.html;
      console.log('Found HTML content in email');
    }
    
    if (emailData.text) {
      textContent = emailData.text;
      console.log('Found text content in email');
    }
  }
  
  // If we still don't have HTML content but have text, check for markdown-like formatting
  // which suggests the text might actually contain HTML elements
  if (!htmlContent && textContent) {
    // Check for HTML tags or markdown-like characters
    const hasHtmlOrMarkdown = /<[a-z][^>]*>/i.test(textContent) || 
                             /[*_~][\w\s]+[*_~]/.test(textContent) ||
                             textContent.includes('<div') ||
                             textContent.includes('<img') ||
                             textContent.includes('<p') ||
                             textContent.includes('<br');
    
    if (hasHtmlOrMarkdown) {
      console.log('Text content contains HTML or markdown markers, treating as HTML');
      htmlContent = textContent;
    }
  }
  
  // Process any embedded images in multipart emails
  // This is common with SendGrid's inbound parse webhook
  if (textContent && (hasAttachments || textContent.includes('Content-Type: multipart/'))) {
    console.log('Processing potential embedded content and images');
    try {
      // Look for HTML content in multipart sections
      if (!htmlContent) {
        htmlContent = extractHtmlContent(textContent);
        if (htmlContent) {
          console.log('Extracted HTML content from multipart email');
        }
      }
      
      // Process attachments if there are any indicators of them
      if (textContent.includes('Content-ID:') || 
          textContent.includes('Content-Disposition: attachment') || 
          textContent.includes('Content-Disposition: inline')) {
        
        // Process the attachments
        const { cidToUrlMap } = await parseAttachments(textContent, feedbackId);
        console.log(`Found ${Object.keys(cidToUrlMap).length} CID mappings from attachments`);
        
        // Get any parsed attachments
        let parsedAttachments: EmailAttachment[] = [];
        try {
          if (emailData.attachments) {
            parsedAttachments = Array.isArray(emailData.attachments) ? emailData.attachments : [];
          }
        } catch (error) {
          console.log('Error getting attachments:', error);
        }
        
        // Replace CID references in HTML content
        if (htmlContent && Object.keys(cidToUrlMap).length > 0) {
          console.log('Replacing CID references in HTML content');
          htmlContent = replaceCidWithUrls(htmlContent, cidToUrlMap, parsedAttachments, true);
        }
        
        // If we don't have HTML but have text and CID mappings, convert text to HTML
        if (!htmlContent && textContent && Object.keys(cidToUrlMap).length > 0) {
          console.log('Converting text content to HTML for attachment display');
          const basicHtml = textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
          
          htmlContent = replaceCidWithUrls(basicHtml, cidToUrlMap, parsedAttachments, true);
        }
      }
    } catch (error) {
      console.error('Error processing embedded content:', error);
      // Continue with content as-is
    }
  }
  
  // Final cleanup - make sure HTML content doesn't have raw email artifacts
  if (htmlContent) {
    // Remove any boundary markers or headers that leaked into the content
    htmlContent = sanitizeHtml(htmlContent);
  }
  
  console.log(`Content extraction complete: hasHTML=${!!htmlContent}, hasText=${!!textContent}`);
  return { htmlContent, textContent, hasAttachments };
}

// Function to extract the feedback ID from an email
async function extractFeedbackId(emailData: any): Promise<string | undefined> {
  console.log('Extracting feedback ID from email');
  
  // First check In-Reply-To header
  let feedbackId: string | undefined;
  
  if (emailData.headers) {
    // Try to extract from In-Reply-To or References headers
    const headers = emailData.headers;
    let inReplyTo = '';
    let references = '';
    
    for (const key in headers) {
      if (key.toLowerCase() === 'in-reply-to') {
        inReplyTo = headers[key];
      } else if (key.toLowerCase() === 'references') {
        references = headers[key];
      }
    }
    
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
    if (references) {
      const feedbackIdMatch = references.match(/<feedback-([a-f0-9-]+)@userbird\.co>/i);
      if (feedbackIdMatch) {
        feedbackId = feedbackIdMatch[1];
        console.log('Found feedback ID in References:', feedbackId);
        return feedbackId;
      }
    }
  }
  
  // Try to extract from email raw content
  if (emailData.text) {
    // Try custom thread identifier format: thread::UUID::
    const threadRegex = /thread::([a-f0-9-]+)::/i;
    
    // First try to find thread ID in subject
    let threadMatch = emailData.subject?.match(threadRegex);
    if (threadMatch) {
      feedbackId = threadMatch[1];
      console.log('Found feedback ID in subject thread identifier:', feedbackId);
      return feedbackId;
    }
    
    // If not found in subject, try the body
    threadMatch = emailData.text.match(threadRegex);
    if (threadMatch) {
      feedbackId = threadMatch[1];
      console.log('Found feedback ID in body thread identifier:', feedbackId);
      return feedbackId;
    }
    
    // Try to find feedback ID in raw header format
    const rawHeaderMatch = emailData.text.match(/In-Reply-To:\s*<feedback-([a-f0-9-]+)@userbird\.co>/i);
    if (rawHeaderMatch) {
      feedbackId = rawHeaderMatch[1];
      console.log('Found feedback ID in raw In-Reply-To header:', feedbackId);
      return feedbackId;
    }
    
    // Try to find any UUID-like pattern
    const uuidMatches = emailData.text.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
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
  }
  
  // Try to match by subject and sender email
  if (emailData.subject && (emailData.from || emailData.sender)) {
    // Extract the original feedback submitter's email from the subject
    const subjectMatch = emailData.subject.match(/Re: Feedback submitted by ([^@]+@[^@]+\.[^@]+)/i);
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
  if (emailData.headers) {
    let messageId = '';
    for (const key in emailData.headers) {
      if (key.toLowerCase() === 'message-id') {
        messageId = emailData.headers[key];
        break;
      }
    }
    
    if (messageId) {
      const { data: replyData } = await supabase
        .from('feedback_replies')
        .select('feedback_id')
        .eq('message_id', messageId)
        .single();
        
      if (replyData) {
        feedbackId = replyData.feedback_id;
        console.log('Found feedback ID from message_id lookup:', feedbackId);
        return feedbackId;
      }
    }
  }
  
  console.log('No feedback ID found after all extraction attempts');
  return undefined;
}

// Update storeReply to use the async extractEmailContent
async function storeReply(
  emailData: any, 
  feedbackId: string, 
  messageId: string,
  inReplyTo: string | null
): Promise<string> {
  try {
    // Extract content from the email - this is now async
    const { htmlContent, textContent, hasAttachments } = await extractEmailContent(emailData, feedbackId);
    
    // Extract sender information
    let senderEmail = '';
    let senderName = '';
    
    if (emailData.from) {
      if (typeof emailData.from === 'string') {
        // Try to extract name and email from string format
        const matches = emailData.from.match(/([^<]+)<([^>]+)>/);
        if (matches) {
          senderName = matches[1].trim();
          senderEmail = matches[2].trim();
        } else {
          senderEmail = emailData.from.trim();
        }
      } else if (typeof emailData.from === 'object') {
        // Handle object format
        senderEmail = emailData.from.address || '';
        senderName = emailData.from.name || '';
      }
    }
    
    if (!senderEmail && emailData.sender) {
      senderEmail = typeof emailData.sender === 'string' 
        ? emailData.sender 
        : (emailData.sender.address || '');
    }
    
    console.log(`Storing reply from ${senderName} <${senderEmail}>`);
    
    // Generate a UUID for the reply
    const replyId = crypto.randomUUID();
    
    // Always prioritize HTML content
    const finalContent = textContent || '';
    const htmlContentForDb = htmlContent || '';
    
    // Insert the reply using the existing schema structure (content and html_content)
    const { data: reply, error } = await supabase
      .from('feedback_replies')
      .insert({
        id: replyId,
        feedback_id: feedbackId,
        sender_name: senderName,
        sender_email: senderEmail,
        content: finalContent,
        html_content: htmlContentForDb, // Use html_content field instead of content_type
        message_id: messageId,
        in_reply_to: inReplyTo,
        created_at: new Date().toISOString()
      })
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
    
    // Update the feedback record to show it has replies
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ 
        has_replies: true,
        updated_at: new Date().toISOString() 
      })
      .eq('id', feedbackId);
    
    if (updateError) {
      console.error('Error updating feedback record:', updateError);
      // Continue anyway, the reply is stored
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
      console.log('The feedback_attachments table does not exist. Please create it manually in the Supabase dashboard if needed');
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
        try {
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
        } catch (parseError) {
          console.error('Error parsing multipart data:', parseError);
          // Continue with partial data
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
    
    // For SendGrid's inbound parse webhook, extract attachments
    if (emailData.attachments) {
      try {
        // SendGrid stores attachments as a JSON string
        if (typeof emailData.attachments === 'string') {
          emailData.attachments = JSON.parse(emailData.attachments);
        }
      } catch (error) {
        console.error('Error parsing attachments:', error);
        emailData.attachments = [];
      }
    }
    
    // Create headers object if not present
    if (!emailData.headers) {
      emailData.headers = {};
      
      // Copy headers from the event
      for (const key in event.headers) {
        emailData.headers[key] = event.headers[key];
      }
    }
    
    console.log('Parsed email data:', {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      hasText: !!emailData.text,
      hasHtml: !!emailData.html,
      hasAttachments: !!(emailData.attachments && emailData.attachments.length),
      headers: emailData.headers ? Object.keys(emailData.headers) : 'No headers'
    });
    
    // Preview the email text
    if (emailData.text) {
      console.log('Email text preview:', emailData.text.substring(0, 200) + '...');
    }
    
    // Extract feedback ID from the email - this is an async operation
    const feedbackId = await extractFeedbackId(emailData);
    
    if (!feedbackId) {
      console.error('Could not extract feedback_id from email');
      return { statusCode: 400, body: JSON.stringify({ error: 'Could not extract feedback_id from email' }) };
    }
    
    console.log('Extracted feedback_id:', feedbackId);
    
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
    
    // Extract Message-ID and In-Reply-To headers for threading
    let messageId = '';
    let inReplyTo = '';
    
    if (emailData.headers) {
      // Access the headers in a case-insensitive way
      const headers = emailData.headers;
      for (const key in headers) {
        if (key.toLowerCase() === 'message-id') {
          messageId = headers[key];
        } else if (key.toLowerCase() === 'in-reply-to') {
          inReplyTo = headers[key];
        }
      }
    }
    
    console.log('Email headers for threading:', {
      messageId,
      inReplyTo
    });
    
    // Store the reply using our consolidated function
    try {
      const replyId = await storeReply(
        emailData, 
        feedbackId, 
        messageId || `reply-${crypto.randomUUID()}`, // Provide a fallback value
        inReplyTo || null // Ensure it's string | null
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          replyId,
          messageId,
          inReplyTo
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