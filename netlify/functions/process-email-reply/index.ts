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
function decodeQuotedPrintable(input: string): string {
  if (!input) return '';
  
  // Replace = followed by CRLF with nothing (soft line break)
  let output = input.replace(/=\r\n/g, '').replace(/=\n/g, '');
  
  // Replace =XX with the corresponding character
  output = output.replace(/=([0-9A-F]{2})/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return output;
}

// Function to extract content from Apple Mail multipart structure
function extractAppleMailContent(emailText: string): string | null {
  if (!emailText) return null;
  
  // Check if this is Apple Mail
  if (!emailText.includes('Apple-Mail') && !emailText.includes('X-Mailer: iPhone Mail')) {
    return null;
  }
  
  console.log('Detected Apple Mail format, attempting specialized extraction');
  
  // Find the Apple Mail boundary - updated pattern to match Apple-Mail=_XXXXXXX format
  const boundaryMatch = emailText.match(/boundary=(?:"?)(Apple-Mail[=_-][^"\r\n]+)(?:"?)/i);
  if (!boundaryMatch || !boundaryMatch[1]) {
    console.log('Failed to find Apple Mail boundary');
    return null;
  }
  
  const boundary = boundaryMatch[1];
  console.log(`Found Apple Mail boundary: ${boundary}`);
  
  // Split by boundary
  const parts = emailText.split(`--${boundary}`);
  console.log(`Apple Mail email split into ${parts.length} parts`);
  
  // First try to find the HTML part - prioritize HTML over plain text
  let bestHtmlContent: string | null = null;
  
  for (const part of parts) {
    if (part.includes('Content-Type: text/html')) {
      const isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
      
      // Extract content after the header block
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      
      let htmlContent = part.substring(headerEnd + 4);
      
      // Check for quoted-printable encoding
      if (isQuotedPrintable) {
        htmlContent = decodeQuotedPrintable(htmlContent);
      }
      
      // Skip if HTML only contains the signature
      if (htmlContent.includes('Sent from my iPhone') && 
          htmlContent.replace(/Sent from my iPhone/g, '').replace(/<[^>]*>/g, '').trim().length === 0) {
        console.log('Skipping HTML part that only contains signature');
        continue;
      }
      
      // Extract the body content
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        let bodyContent = bodyMatch[1];
        
        // Check if there's meaningful content in the body
        const strippedContent = bodyContent.replace(/<[^>]*>/g, ' ').trim();
        
        if (strippedContent.length > 0) {
          console.log('Successfully extracted complete HTML body content from Apple Mail');
          bestHtmlContent = bodyContent;
          break;
        }
      }
      
      // If we couldn't extract the body specifically, use the full HTML content
      if (htmlContent.trim().length > 0) {
        console.log('Using full HTML content from Apple Mail');
        bestHtmlContent = htmlContent.trim();
        break;
      }
    }
  }
  
  // If no HTML content was found or it was empty, fall back to text/plain
  if (!bestHtmlContent) {
    console.log('No valid HTML content found in Apple Mail, falling back to text/plain');
    
    for (const part of parts) {
      if (part.includes('Content-Type: text/plain')) {
        const isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
        
        // Extract content after the header block
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        
        let content = part.substring(headerEnd + 4);
        
        // Check for quoted-printable encoding
        if (isQuotedPrintable) {
          content = decodeQuotedPrintable(content);
        }
        
        // Preserve full content including signature and quoted replies
        // Just remove email artifacts and clean up formatting
        content = content.replace(/\r/g, '').trim();
        
        // Check if we have meaningful content
        if (content && content.trim().length > 0) {
          console.log('Using text/plain content from Apple Mail (no valid HTML found)');
          return content;
        }
      }
    }
  }
  
  return bestHtmlContent;
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

// Function to extract HTML content from a multipart email
function extractHtmlContent(emailText: string): string | null {
  try {
    // Check for Apple Mail format and attempt specialized extraction
    if (emailText.includes('Apple-Mail') || emailText.includes('X-Mailer: Apple Mail')) {
      console.log('Detected Apple Mail format in extractHtmlContent, attempting specialized extraction');
      return extractAppleMailContent(emailText);
    }
    
    // Look for content-type headers for HTML parts
    const htmlHeaderMatch = emailText.match(/Content-Type: text\/html/gi);
    if (!htmlHeaderMatch) {
      console.log('No HTML content-type headers found');
      return null;
    }
    
    console.log('Starting HTML content extraction');
    
    // Find the boundary that separates the email parts
    const boundaryMatch = emailText.match(/boundary=(?:"?)([^"\r\n]+)(?:"?)/i);
    if (!boundaryMatch || !boundaryMatch[1]) {
      console.log('No boundary found for multipart message');
      return null;
    }
    
    const boundary = boundaryMatch[1];
    console.log(`Found boundary: ${boundary}`);
    
    // Split the email into parts based on the boundary
    const parts = emailText.split(`--${boundary}`);
    console.log(`Email split into ${parts.length} parts`);
    
    // Loop through each part looking for HTML content
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`Examining part ${i + 1}/${parts.length}, length: ${part.length} characters`);
      
      // Check if this part is HTML
      if (part.includes('Content-Type: text/html')) {
        console.log(`Found HTML content in part ${i + 1}`);
        
        // Extract the content after the headers
        const headerEndIndex = part.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) {
          console.log('Could not find end of headers');
          continue;
        }
        
        let rawHtmlContent = part.substring(headerEndIndex + 4);
        console.log(`Raw HTML content length: ${rawHtmlContent.length} characters`);
        console.log(`Raw HTML content preview: ${rawHtmlContent.substring(0, 100)}...`);
        
        // Check for quoted-printable encoding
        const isQuotedPrintable = part.includes('Content-Transfer-Encoding: quoted-printable');
        if (isQuotedPrintable) {
          console.log('Content is quoted-printable encoded, decoding...');
          rawHtmlContent = decodeQuotedPrintable(rawHtmlContent);
        }
        
        // Try to extract content within <html> tags if present
        let htmlContent = rawHtmlContent;
        const htmlTagMatch = rawHtmlContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        if (htmlTagMatch && htmlTagMatch[1]) {
          console.log('Extracted content within HTML tags');
          htmlContent = htmlTagMatch[0]; // Keep the full HTML structure
        }
        
        // For Apple Mail, specifically check for text right after the body tag
        // This is likely the actual message content
        if (emailText.includes('Apple-Mail') || emailText.includes('X-Mailer: Apple Mail')) {
          // First, try to extract text from body opening until the first div
          // This handles cases where the message is directly after the body tag
          const bodyToFirstDivMatch = htmlContent.match(/<body[^>]*>([^<]*)<div/i);
          if (bodyToFirstDivMatch && bodyToFirstDivMatch[1] && bodyToFirstDivMatch[1].trim().length > 0) {
            console.log('Found Apple Mail text content directly after body tag before first div');
            // Keep the extracted text but wrap it in a div for proper HTML structure
            return `<div>${bodyToFirstDivMatch[1].trim()}</div>`;
          }
          
          // Second case: text directly after body tag
          const bodyTextMatch = htmlContent.match(/<body[^>]*>([^<]+)/i);
          if (bodyTextMatch && bodyTextMatch[1] && bodyTextMatch[1].trim().length > 0) {
            console.log('Found Apple Mail text content directly after body tag opening');
            // Keep the extracted text but wrap it in a div for proper HTML structure
            return `<div>${bodyTextMatch[1].trim()}</div>`;
          }
        }
        
        // Try to extract just the body content if available
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
          console.log('Extracted inner HTML content from the email part');
          
          // Check if there's meaningful content
          const strippedBody = bodyMatch[1].replace(/<[^>]*>/g, ' ').trim();
          if (strippedBody.length > 0) {
            // Return the body content - this preserves any formatting, links, etc.
            return bodyMatch[1];
          }
        }
        
        // If we couldn't extract specific content but have HTML, return what we found
        return htmlContent;
      }
    }
    
    console.log('No HTML content found in any part');
    return null;
  } catch (error) {
    console.error('Error extracting HTML content:', error);
    return null;
  }
}

/**
 * Decodes HTML entities and fixes character encoding issues
 * @param html The HTML content that may contain entities or encoding issues
 * @returns Cleaned HTML with properly decoded entities
 */
function decodeHtmlEntities(html: string): string {
  if (!html) return '';
  
  console.log('Decoding HTML entities and fixing character encoding issues');
  
  // Create a temporary div element for decoding entities (would work in browser, but we're in Node)
  // So we'll use string replacement for common entities
  
  // First, deal with UTF-8 character encoding issues that appear as Â followed by a character
  // This is a common issue with non-breaking spaces that get double-encoded
  html = html.replace(/Â /g, ' ');  // Non-breaking space with visual Â
  html = html.replace(/Â\u00A0/g, ' '); // Another variant of the same issue
  
  // Fix other common encoding issues with special characters
  html = html.replace(/â\u0080\u0099/g, "'"); // Fancy single quote
  html = html.replace(/â\u0080\u009C/g, '"'); // Fancy open double quote
  html = html.replace(/â\u0080\u009D/g, '"'); // Fancy close double quote
  html = html.replace(/â\u0080\u0093/g, '–'); // En dash
  html = html.replace(/â\u0080\u0094/g, '—'); // Em dash
  html = html.replace(/â\u0080¦/g, '...'); // Ellipsis
  html = html.replace(/â\u0080¢/g, '•'); // Bullet
  
  // Convert HTML entities to their actual characters
  html = html.replace(/&nbsp;/g, ' ');
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#039;/g, "'");
  html = html.replace(/&#x27;/g, "'");
  html = html.replace(/&#x2F;/g, '/');
  
  // Also handle numeric entities
  html = html.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
  
  return html;
}

// Create a local copy of the sanitize function since Netlify functions can't import from src folder
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // First, decode HTML entities to ensure we're working with proper characters
  html = decodeHtmlEntities(html);
  
  // Check if we have a multipart email artifact rather than HTML
  if (html.includes('Content-Type:') && html.includes('boundary=')) {
    console.log('HTML content appears to contain email headers, cleaning up');
    
    // Extract Gmail-style div content if present
    const divMatch = html.match(/<div[\s\S]*<\/div>/i);
    if (divMatch && divMatch[0]) {
      console.log('Found div content in HTML, extracting');
      html = divMatch[0];
    } else {
      // Try to extract just the email body after headers
      const bodyStart = html.indexOf('\r\n\r\n');
      if (bodyStart !== -1) {
        html = html.substring(bodyStart + 4);
        console.log('Stripped email headers from HTML content');
      }
    }
  }
  
  // Clean up email artifacts that might have leaked into the HTML
  // Strip any boundary markers that leaked into the content
  html = html.replace(/--[0-9a-f]+(?:--)?\s*$/gm, '');
  html = html.replace(/Content-Type: [^<>\n]+\n/gi, '');
  html = html.replace(/Content-Transfer-Encoding: [^<>\n]+\n/gi, '');
  html = html.replace(/--\s*\n/g, ''); // Boundary ending markers
  html = html.replace(/^MIME-Version:[^\n]*\n/gim, '');
  
  // Remove any multipart email headers that might remain
  html = html.replace(/^(From|To|Subject|Date|Content-Type|Content-Transfer-Encoding|Message-ID|References|In-Reply-To):[^\n]*\n/gim, '');
  
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
  
  // If after all this sanitizing, there are no HTML tags left but we have Gmail image references,
  // convert it to a basic HTML structure
  if (!sanitized.includes('<') && gmailImageReferences.length > 0) {
    sanitized = `<div>${sanitized}</div>`;
  }
    
  // Restore Gmail image references
  for (let i = 0; i < gmailImageReferences.length; i++) {
    sanitized = sanitized.replace(`__GMAIL_IMAGE_${i}__`, gmailImageReferences[i]);
  }
  
  return sanitized;
}

// Function to extract HTML content from Apple Mail specifically
function extractAppleMailHtmlSimple(emailText: string): string | null {
  if (!emailText) return null;
  
  // Check if this is Apple Mail format
  if (!emailText.includes('Apple-Mail') && !emailText.includes('X-Mailer: Apple Mail')) {
    return null;
  }
  
  console.log('Attempting simple Apple Mail HTML extraction');
  
  // Look for the HTML content part marker - use regex for more flexibility
  const htmlMarkerRegex = /content-type:\s*text\/html;\s*charset=us-ascii/i;
  const htmlMarkerMatch = emailText.match(htmlMarkerRegex);
  
  if (!htmlMarkerMatch) {
    console.log('Could not find Apple Mail HTML content marker');
    return null;
  }
  
  const htmlMarkerIndex = htmlMarkerMatch.index;
  
  // Find the end of the header section (empty line after the content-type)
  const headerEnd = emailText.indexOf('\r\n\r\n', htmlMarkerIndex);
  if (headerEnd === -1) {
    // Try alternative line endings
    const altHeaderEnd = emailText.indexOf('\n\n', htmlMarkerIndex);
    if (altHeaderEnd === -1) {
      console.log('Could not find end of Apple Mail HTML headers');
      return null;
    }
    console.log('Found header end with alternative line endings');
    
    // Extract all content after the header
    const htmlContent = emailText.substring(altHeaderEnd + 2);
    
    // Look for the boundary to know where to stop - updated pattern to match Apple-Mail=_XXXXXXX format
    const boundaryMatch = emailText.match(/boundary=(?:"?)(Apple-Mail[=_-][^"\r\n]+)(?:"?)/i);
    let htmlPart = htmlContent;
    
    if (boundaryMatch && boundaryMatch[1]) {
      // Find the end boundary marker
      const boundaryEnd = htmlContent.indexOf(`--${boundaryMatch[1]}--`);
      if (boundaryEnd !== -1) {
        // Extract just up to the end boundary
        htmlPart = htmlContent.substring(0, boundaryEnd).trim();
      }
    }
    
    // Check if this appears to be HTML or just plain text in the HTML part
    if (htmlPart.includes('<html') || htmlPart.includes('<body') || 
        htmlPart.includes('<div') || htmlPart.includes('<p')) {
      console.log('Successfully extracted HTML content from Apple Mail');
      return htmlPart;
    } else {
      console.log('Extracted content does not appear to be HTML, might be plain text in HTML part');
      return null;
    }
  }
  
  // Extract all content after the header
  const htmlContent = emailText.substring(headerEnd + 4);
  
  // Look for the boundary to know where to stop - updated pattern to match Apple-Mail=_XXXXXXX format
  const boundaryMatch = emailText.match(/boundary=(?:"?)(Apple-Mail[=_-][^"\r\n]+)(?:"?)/i);
  let htmlPart = htmlContent;
  
  if (boundaryMatch && boundaryMatch[1]) {
    // Find the end boundary marker
    const boundaryEnd = htmlContent.indexOf(`--${boundaryMatch[1]}--`);
    if (boundaryEnd !== -1) {
      // Extract just up to the end boundary
      htmlPart = htmlContent.substring(0, boundaryEnd).trim();
    }
  }
  
  // Check if this appears to be HTML or just plain text in the HTML part
  if (htmlPart.includes('<html') || htmlPart.includes('<body') || 
      htmlPart.includes('<div') || htmlPart.includes('<p')) {
    console.log('Successfully extracted HTML content from Apple Mail');
    return htmlPart;
  } else {
    console.log('Extracted content does not appear to be HTML, might be plain text in HTML part');
    return null;
  }
}

// Function to parse and extract attachments from a multipart email
async function parseAttachments(
  emailText: string, 
  feedbackId: string,
  replyId?: string // Make replyId optional
): Promise<{ attachments: EmailAttachment[], cidToUrlMap: Record<string, string> }> {
  const attachments: EmailAttachment[] = [];
  const cidToUrlMap: Record<string, string> = {};
  
  // Detect Apple Mail format
  const isAppleMail = emailText.includes('Apple-Mail') || emailText.includes('X-Mailer: Apple Mail');
  if (isAppleMail) {
    console.log('Detected Apple Mail format in parseAttachments');
  }
  
  // Find the main boundary
  const boundaryMatch = emailText.match(/boundary="([^"]+)"/i);
  if (!boundaryMatch || !boundaryMatch[1]) {
    // Try alternative boundary patterns for Apple Mail
    const appleBoundaryMatch = emailText.match(/boundary=(?:"?)([^";\r\n]+)(?:"?)/i) || 
                              emailText.match(/Apple-Mail=_([a-zA-Z0-9-]+)/i);
    
    if (appleBoundaryMatch && appleBoundaryMatch[1]) {
      const appleBoundary = appleBoundaryMatch[1];
      console.log(`Found Apple Mail boundary: ${appleBoundary}`);
      
      // Split by both possible boundary formats
      const parts1 = emailText.split(`--${appleBoundary}`);
      const parts2 = emailText.split(`Content-Type: multipart/related`);
      
      // Use whichever split gives us more parts
      const parts = parts1.length >= parts2.length ? parts1 : parts2;
      
      console.log(`Apple Mail email split into ${parts.length} parts`);
      
      // Process each part
      for (const part of parts) {
        // Skip parts that don't look like they contain attachments
        if (!part.includes('Content-Type:')) continue;
        
        // Check if this part is an image or attachment
        const contentTypeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
        if (!contentTypeMatch) continue;
        
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
        } else if (isAppleMail && contentType.startsWith('image/')) {
          // For Apple Mail, generate a content ID if missing for images
          contentId = `apple-mail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          console.log(`Generated Content-ID for Apple Mail image: ${contentId}`);
        }
        
        // Parse filename
        let filename = '';
        const filenameMatch = part.match(/filename="([^"]+)"/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          console.log(`Found attachment with filename: ${filename}`);
        } else if (isAppleMail) {
          // Try alternative patterns for Apple Mail
          const altFilenameMatch = part.match(/name="?([^";\r\n]+)"?/i) || 
                                  part.match(/filename=([^;\r\n\s]+)/i);
          if (altFilenameMatch && altFilenameMatch[1]) {
            filename = altFilenameMatch[1].trim();
            console.log(`Found Apple Mail attachment with alternative filename pattern: ${filename}`);
          } else if (contentType.startsWith('image/')) {
            // Generate a filename for Apple Mail images if missing
            const extension = contentType.split('/')[1] || 'png';
            filename = `apple-mail-image-${Date.now()}.${extension}`;
            console.log(`Generated filename for Apple Mail image: ${filename}`);
          } else {
            // Generate a generic filename if none is provided
            const extension = contentType.split('/')[1] || 'bin';
            filename = `attachment-${Date.now()}.${extension}`;
            console.log(`Generated filename for attachment: ${filename}`);
          }
        } else {
          // Generate a generic filename if none is provided
          const extension = contentType.split('/')[1] || 'bin';
          filename = `attachment-${Date.now()}.${extension}`;
          console.log(`Generated filename for attachment: ${filename}`);
        }
        
        // Determine if this is an inline attachment
        const isInline = part.includes('Content-Disposition: inline') || 
                       !!contentId || 
                       (isAppleMail && contentType.startsWith('image/')); // Treat Apple Mail images as inline
        
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
          try {
            const buffer = Buffer.from(data, 'base64');
            
            attachments.push({
              filename,
              contentType,
              contentId,
              data: buffer,
              isInline
            });
            
            console.log(`Processed base64 attachment: ${filename}, size: ${buffer.length} bytes, isInline: ${isInline}`);
          } catch (error) {
            console.error(`Error processing base64 data for attachment ${filename}:`, error);
          }
        } else if (encoding === '7bit' || encoding === '8bit' || encoding === 'binary' || encoding === '' || isAppleMail) {
          // For Apple Mail, try to process attachments regardless of encoding
          try {
            // Special handling for Apple Mail images with 7bit encoding
            if (isAppleMail && contentType.startsWith('image/')) {
              console.log(`Special processing for Apple Mail image with ${encoding || 'unspecified'} encoding: ${filename}`);
              
              // For Apple Mail with 7bit encoding, the data might need additional processing
              // Try to find more reliable content boundaries
              const headerEndIndex = data.indexOf('\n\n');
              const headerEndIndex2 = data.indexOf('\r\n\r\n');
              
              // Use whichever marker we find, or default to the start
              let contentStartIndex = 0;
              if (headerEndIndex > 0) {
                contentStartIndex = headerEndIndex + 2;
                console.log(`Found content start after headers at position ${contentStartIndex}`);
              } else if (headerEndIndex2 > 0) {
                contentStartIndex = headerEndIndex2 + 4;
                console.log(`Found content start after headers at position ${contentStartIndex}`);
              }
              
              // Extract the data part after headers
              const possibleImageData = data.substring(contentStartIndex);
              
              // Check for common image signatures
              const imageSignatures = [
                { format: 'PNG', sig: [0x89, 0x50, 0x4E, 0x47] },
                { format: 'JPEG', sig: [0xFF, 0xD8, 0xFF] },
                { format: 'GIF', sig: [0x47, 0x49, 0x46, 0x38] }, // 'GIF8'
                { format: 'BMP', sig: [0x42, 0x4D] }              // 'BM'
              ];
              
              let foundBinary = false;
              let binaryData = possibleImageData;
              
              // Look for image signatures in the data
              for (const sig of imageSignatures) {
                const sigBuffer = Buffer.from(sig.sig);
                const sigStr = sigBuffer.toString('binary');
                const sigIndex = binaryData.indexOf(sigStr);
                
                if (sigIndex !== -1) {
                  console.log(`Found ${sig.format} signature at position ${sigIndex} in ${filename}`);
                  binaryData = binaryData.substring(sigIndex);
                  foundBinary = true;
                  break;
                }
              }
              
              // If we didn't find a signature but this is Apple Mail, try using the content anyway
              if (!foundBinary && isAppleMail) {
                console.log(`No image signature found in Apple Mail attachment, using content as-is`);
              }
              
              // Try to convert the data to a buffer
              try {
                const buffer = Buffer.from(binaryData, 'binary');
                
                // Only use the buffer if it has a reasonable size
                if (buffer.length > 100) {
                  attachments.push({
                    filename,
                    contentType,
                    contentId,
                    data: buffer,
                    isInline: true // Force inline for Apple Mail images
                  });
                  
                  console.log(`Processed Apple Mail ${encoding || 'binary'} image: ${filename}, size: ${buffer.length} bytes`);
                  
                  // Skip the rest of the processing for this part
                  continue;
                } else {
                  console.log(`Binary data too small (${buffer.length} bytes) for ${filename}, falling back to standard processing`);
                }
              } catch (bufferError) {
                console.error(`Error creating buffer for Apple Mail image ${filename}:`, bufferError);
              }
            }
            
            // For 7bit/8bit encodings or when no encoding is specified, we need to look for binary data
            // Apple Mail often sends binary data directly, we need to find where it actually starts
            
            // First try searching for common binary image headers (for PNG, JPEG, etc.)
            let binaryStart = -1;
            
            // Check for PNG signature
            const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
            const pngIndex = data.indexOf(pngSignature.toString('binary'));
            if (pngIndex !== -1) {
              binaryStart = pngIndex;
              console.log(`Found PNG signature at position ${pngIndex} in ${filename}`);
            }
            
            // Check for JPEG signature (if PNG not found)
            if (binaryStart === -1) {
              const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
              const jpegIndex = data.indexOf(jpegSignature.toString('binary'));
              if (jpegIndex !== -1) {
                binaryStart = jpegIndex;
                console.log(`Found JPEG signature at position ${jpegIndex} in ${filename}`);
              }
            }
            
            // If we found binary data or this is Apple Mail (try anyway)
            if (binaryStart !== -1 || isAppleMail) {
              // If binary start found, extract only from that point
              const binaryData = binaryStart !== -1 ? data.substring(binaryStart) : data;
              const buffer = Buffer.from(binaryData, 'binary');
              
              // For Apple Mail, we'll try to process it even if we're not sure it's valid
              if (buffer.length > 100 || isAppleMail) { // Ensure it's not just a few bytes
                attachments.push({
                  filename,
                  contentType,
                  contentId,
                  data: buffer,
                  isInline
                });
                
                console.log(`Processed ${encoding || 'binary'} attachment: ${filename}, size: ${buffer.length} bytes, isInline: ${isInline}`);
              } else {
                console.log(`Binary data too small (${buffer.length} bytes) for ${filename}, skipping`);
              }
            } else {
              console.log(`Could not find binary data in ${encoding || 'unknown'} encoded attachment: ${filename}`);
            }
          } catch (error) {
            console.error(`Error processing ${encoding || 'binary'} data for attachment ${filename}:`, error);
          }
        } else {
          console.log(`Unsupported encoding for attachment: ${encoding}`);
        }
      }
      
      console.log(`Found ${attachments.length} attachments in Apple Mail email`);
      return { attachments, cidToUrlMap };
    }
    
    console.log('No boundary found for attachments');
    return { attachments, cidToUrlMap };
  }
  
  console.log(`Found ${attachments.length} attachments in email`);
  
  // Special fallback for Apple Mail when no attachments were detected
  if (attachments.length === 0 && isAppleMail && emailText.includes('[Image attachment]')) {
    console.log('No attachments were detected, but [Image attachment] placeholder exists in Apple Mail email');
    console.log('Attempting fallback attachment detection for Apple Mail');
    
    // Look for content-type sections that might indicate image content
    const imageSections = emailText.match(/Content-Type: image\/[^;\r\n]+/gi);
    if (imageSections && imageSections.length > 0) {
      console.log(`Found ${imageSections.length} image content sections in Apple Mail email`);
      
      // For each image section, try to extract the content
      for (const section of imageSections) {
        // Determine the content type
        const contentTypeMatch = section.match(/Content-Type: (image\/[^;\r\n]+)/i);
        if (!contentTypeMatch) continue;
        
        const contentType = contentTypeMatch[1].trim();
        const extension = contentType.split('/')[1] || 'png';
        const filename = `apple-mail-fallback-${Date.now()}.${extension}`;
        
        console.log(`Attempting to extract ${contentType} content as ${filename}`);
        
        // Find where this section begins in the email
        const sectionIndex = emailText.indexOf(section);
        if (sectionIndex === -1) continue;
        
        // Extract a portion of text after this header that might contain the image data
        const sectionText = emailText.substring(sectionIndex);
        
        // Find where the headers end and content begins
        const contentStart = sectionText.indexOf('\r\n\r\n');
        if (contentStart === -1) continue;
        
        // Extract content (limit to a reasonable size to avoid grabbing too much)
        const maxSize = 500000; // Limit to 500KB to avoid grabbing too much data
        let imageData = sectionText.substring(contentStart + 4, contentStart + 4 + maxSize);
        
        // Try to find where the content ends (at a boundary or next section)
        const boundaryIndex = imageData.indexOf('--');
        if (boundaryIndex > 0) {
          imageData = imageData.substring(0, boundaryIndex);
        }
        
        // Try to find image signatures within this data
        const imageSignatures = [
          { format: 'PNG', sig: [0x89, 0x50, 0x4E, 0x47] },
          { format: 'JPEG', sig: [0xFF, 0xD8, 0xFF] },
          { format: 'GIF', sig: [0x47, 0x49, 0x46, 0x38] },
          { format: 'BMP', sig: [0x42, 0x4D] }
        ];
        
        let foundBinary = false;
        let binaryData = imageData;
        
        // Look for image signatures
        for (const sig of imageSignatures) {
          const sigBuffer = Buffer.from(sig.sig);
          const sigStr = sigBuffer.toString('binary');
          const sigIndex = binaryData.indexOf(sigStr);
          
          if (sigIndex !== -1) {
            console.log(`Found ${sig.format} signature at position ${sigIndex} in fallback section`);
            binaryData = binaryData.substring(sigIndex);
            foundBinary = true;
            break;
          }
        }
        
        // If we found binary content or this is our last resort, try to use it
        if (foundBinary || imageSections.length === 1) {
          try {
            const buffer = Buffer.from(binaryData, 'binary');
            
            // Only use if it has meaningful size
            if (buffer.length > 100) {
              const contentId = `apple-mail-fallback-${Date.now()}`;
              
              attachments.push({
                filename,
                contentType,
                contentId,
                data: buffer,
                isInline: true
              });
              
              console.log(`Created fallback attachment from Apple Mail image section: ${filename}, size: ${buffer.length} bytes`);
            }
          } catch (error) {
            console.error('Error processing fallback Apple Mail attachment:', error);
          }
        }
      }
    }
  }
  
  // Upload attachments to Supabase Storage and create mapping
  for (const attachment of attachments) {
    // For Apple Mail, process all image attachments regardless of contentId
    const shouldProcess = (attachment.isInline && attachment.contentId) || 
                         (isAppleMail && attachment.contentType && attachment.contentType.startsWith('image/'));
    
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
            // For attachments without content ID (especially Apple Mail images)
            // Generate a key for the CID map based on filename
            const cidKey = `generated-${attachment.filename}-${Date.now()}`;
            console.log(`Generated key ${cidKey} for attachment without content ID: ${urlData.publicUrl}`);
            cidToUrlMap[cidKey] = urlData.publicUrl;
          }
          
          // Set URL in the attachment object regardless of content ID
          attachment.url = urlData.publicUrl;
          
          // Only store attachment metadata if we have a valid replyId
          // Otherwise, we'll need to update this later after reply is created
          if (feedbackAttachmentsTableExists && replyId) {
            try {
              const attachmentId = crypto.randomUUID();
              
              // Prepare attachment data without feedback_id
              const attachmentData: any = {
                id: attachmentId,
                reply_id: replyId,
                filename: attachment.filename,
                url: urlData.publicUrl,
                is_inline: true
              };
              
              // Only add content_id and content_type if they exist
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
              // Even if we can't store the metadata, we still want to replace cid: references
              // so we continue processing
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
  
  // Handle [Image] and [Image attachment] placeholders in both Gmail and Apple Mail
  if (result.includes('[Image]') || result.includes('[Image attachment]')) {
    console.log('Found image placeholders in content');
    
    // Check if we have any images to use
    const imageUrls = Object.values(cidToUrlMap);
    if (imageUrls.length > 0) {
      // Replace [Image] and [Image attachment] placeholders with actual images
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        // Extract filename for alt text
        let altText = 'Email attachment';
        const filenameMatch = imageUrl.match(/\/([^\/]+)$/);
        if (filenameMatch && filenameMatch[1]) {
          altText = decodeURIComponent(filenameMatch[1].split('_').pop() || 'Email attachment');
        }
        
        // Replace image placeholders with actual images
        // Handle both Gmail's [Image] and Apple Mail's [Image attachment]
        const placeholders = ['[Image]', '[Image attachment]'];
        
        for (const placeholder of placeholders) {
          if (result.includes(placeholder)) {
            result = result.replace(
              placeholder,
              `<img src="${imageUrl}" alt="${altText}" style="max-width: 100%;">`
            );
            break; // Only replace one placeholder per image URL
          }
        }
      }
    }
  }
  
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
  
  console.log('Content after CID replacement (preview):', result.substring(0, 200));
  
  // After all replacements are done, ensure content is properly decoded
  return decodeHtmlEntities(result);
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
  attachments: EmailAttachment[];
  cidToUrlMap: Record<string, string>;
}> {
  console.log('Extracting email content');
  
  let htmlContent: string | null = null;
  let textContent: string | null = null;
  let hasAttachments = false;
  let parsedAttachments: EmailAttachment[] = [];
  let cidToUrlMap: Record<string, string> = {};
  
  // Check if the email contains attachments
  if (emailData.attachments && Array.isArray(emailData.attachments) && emailData.attachments.length > 0) {
    hasAttachments = true;
    console.log('Email contains attachments');
  }
  
  // For Gmail emails, the HTML content is often inside the text field in multipart/related format
  const isGmailEmail = 
    (emailData.headers && Object.keys(emailData.headers).some(key => key.toLowerCase().includes('google'))) ||
    (emailData.text && emailData.text.includes('gmail_quote')) ||
    (emailData.from && typeof emailData.from === 'string' && emailData.from.includes('gmail'));
    
  // Add special handling for Gmail emails right after detection
  if (isGmailEmail) {
    console.log('Detected Gmail email format, applying special character encoding fixes');
  }
  
  // Check for iPhone email pattern
  const isIPhoneEmail = 
    (emailData.headers && Object.keys(emailData.headers).some(key => 
      emailData.headers[key] && 
      typeof emailData.headers[key] === 'string' && 
      emailData.headers[key].includes('iPhone Mail'))) ||
    (emailData.text && emailData.text.includes('Sent from my iPhone'));
  
  // Check for Apple Mail (macOS) pattern
  const isAppleMail = 
    (emailData.headers && Object.keys(emailData.headers).some(key => 
      emailData.headers[key] && 
      typeof emailData.headers[key] === 'string' && 
      emailData.headers[key].includes('Apple Mail'))) ||
    (emailData.text && (emailData.text.includes('Apple-Mail') || emailData.text.includes('X-Mailer: Apple Mail')));
  
  if (isGmailEmail) {
    console.log('Detected Gmail email format');
  }
  
  if (isIPhoneEmail) {
    console.log('Detected iPhone email format');
  }
  
  if (isAppleMail) {
    console.log('Detected Apple Mail (macOS) format');
    
    // Try our simple Apple Mail extraction first
    if (emailData.text) {
      const simpleHtmlContent = extractAppleMailHtmlSimple(emailData.text);
      if (simpleHtmlContent) {
        console.log('Successfully extracted HTML using simple Apple Mail extraction');
        htmlContent = simpleHtmlContent;
        textContent = null; // Clear text content to avoid duplication
      }
    }
  }
  
  // If we already have content from simple extraction, skip the special handlers
  if (!htmlContent && isIPhoneEmail) {
    // Try specialized Apple Mail content extraction for multipart emails
    if (emailData.text && (
        emailData.text.includes('Apple-Mail') || 
        emailData.text.includes('X-Mailer: iPhone Mail') ||
        emailData.text.includes('multipart/alternative')
    )) {
      const appleContent = extractAppleMailContent(emailData.text);
      if (appleContent) {
        // If the extracted content looks like HTML, use it as HTML content
        if (appleContent.includes('<') && appleContent.includes('>')) {
          htmlContent = appleContent;
          console.log('Using Apple Mail extracted HTML content');
        } else {
          // Otherwise, convert it to HTML and set it as HTML content
          htmlContent = `<div>${appleContent.replace(/\n/g, '<br>')}</div>`;
          console.log('Converted Apple Mail extracted text to HTML');
        }
        // Don't set text content to avoid duplication
        textContent = null;
      }
    }
  }
  
  // For SendGrid's inbound parse webhook, it places the entire email in the 'email' field
  // which we map to 'text' - need to extract HTML from this
  if (emailData.text) {
    // First check for multipart content with images
    if (emailData.text.includes('Content-Type: multipart/related') || 
        emailData.text.includes('Content-Type: multipart/alternative')) {
      console.log('Found multipart content in email text');
      
      // Try to extract HTML content from the multipart structure
      const htmlFromMultipart = extractHtmlContent(emailData.text);
      if (htmlFromMultipart) {
        console.log('Successfully extracted HTML from multipart content');
        // Clean extracted HTML to ensure no email artifacts
        htmlContent = htmlFromMultipart;
        
        // For Gmail emails with both HTML and text, we want to avoid having both versions
        // Don't set textContent if we have HTML content from a Gmail email
        if (isGmailEmail) {
          console.log('Gmail email with HTML content - not setting text content to avoid duplication');
          textContent = null;
        } else {
          // For non-Gmail emails, keep the text version as a fallback
          textContent = emailData.text;
        }
      } else {
        // No HTML found, use text content
        textContent = emailData.text;
      }
    } else {
      // If not multipart, just process as text unless we find HTML
      let foundHtml = false;
      
      // Look for complete HTML document
      const fullHtmlMatch = emailData.text.match(/<html[^>]*>[\s\S]*<\/html>/i);
      if (fullHtmlMatch && fullHtmlMatch[0]) {
        htmlContent = fullHtmlMatch[0];
        foundHtml = true;
        console.log('Found complete HTML document in email text');
      } else {
        // Look for HTML body content
        const bodyContentMatch = emailData.text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyContentMatch && bodyContentMatch[1]) {
          htmlContent = bodyContentMatch[1];
          foundHtml = true;
          console.log('Found HTML body content in email text');
        } else {
          // Look for div-wrapped content which is common in email clients
          const divMatch = emailData.text.match(/<div[\s\S]*<\/div>/i);
          if (divMatch && divMatch[0]) {
            htmlContent = divMatch[0];
            foundHtml = true;
            console.log('Found div-wrapped HTML content in email text');
          }
        }
      }
      
      // Check specifically for Gmail's processed HTML format with [Image] placeholders
      if (!foundHtml && isGmailEmail && 
          (emailData.text.includes('[Image]') || 
           emailData.text.includes('[image:') || 
           emailData.text.includes('[Image:'))) {
        console.log('Found Gmail-specific processed HTML with [Image] placeholders');
        
        // Extract the actual email content from the raw email data
        // This is a common pattern in Gmail emails
        const actualContent = extractActualContent(emailData.text);
        if (actualContent) {
          console.log('Successfully extracted the actual content part from Gmail email');
          // For Gmail, extract just the new content - ignore the quoted reply
          const newContent = extractNewContent(actualContent);
          
          // Apply Gmail-specific character decoding
          const decodedContent = decodeHtmlEntities(newContent);
          
          const formattedContent = `<div>${decodedContent}</div>`;
          htmlContent = formattedContent;
          foundHtml = true;
        } else {
          // Gmail processed HTML with [Image] tags - we'll handle this as HTML
          const gmailTextWithDivs = emailData.text.match(/<div[\s\S]*<\/div>/i);
          if (gmailTextWithDivs && gmailTextWithDivs[0]) {
            // Apply Gmail-specific character decoding
            htmlContent = decodeHtmlEntities(gmailTextWithDivs[0]);
            foundHtml = true;
            console.log('Extracted Gmail HTML content with image placeholders');
          } else {
            // Convert plain text with [Image] tags to basic HTML
            const basicHtml = emailData.text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '<br>')
              .replace(/\[Image\]/g, '[Image]'); // Preserve [Image] tags for replacement
              
            // Apply Gmail-specific character decoding
            htmlContent = decodeHtmlEntities(basicHtml);
            foundHtml = true;
            console.log('Converted Gmail text with [Image] placeholders to HTML');
          }
        }
      }
      
      // For Gmail emails, if we found HTML, don't set textContent to avoid duplication
      if (isGmailEmail && foundHtml) {
        console.log('Gmail email with HTML content - not setting text content to avoid duplication');
        textContent = null;
      } else {
        // For non-Gmail emails or Gmail emails without HTML, use text content
        textContent = emailData.text;
      }
    }
  }
  
  // Standard email format with separate html and text parts
  if (emailData.html && !htmlContent) {
    htmlContent = emailData.html;
    console.log('Found HTML content in email.html field');
    
    // For Gmail emails, clear text content if we have HTML to avoid duplication
    if (isGmailEmail) {
      textContent = null;
      console.log('Gmail email with HTML content - clearing text content to avoid duplication');
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
      
      // For Gmail emails, clear text content if we have HTML to avoid duplication
      if (isGmailEmail) {
        textContent = null;
        console.log('Gmail email with HTML content - clearing text content to avoid duplication');
      }
    }
  }
  
  // For Gmail emails, ensure we're not duplicating content
  // If we have both HTML and text content from a Gmail email, prefer HTML
  if (isGmailEmail && htmlContent && textContent) {
    console.log('Gmail email with both HTML and text content - clearing text content to avoid duplication');
    textContent = null;
  }
  
  // Process any embedded images in multipart emails
  // This is common with SendGrid's inbound parse webhook
  if ((htmlContent || textContent) && (hasAttachments || 
      (emailData.text && emailData.text.includes('Content-Type: multipart/')) || 
      (emailData.text && emailData.text.includes('Content-ID:')) || 
      isGmailEmail || isIPhoneEmail || isAppleMail)) {
    console.log('Processing potential embedded content and images');
    try {
      // Special handling for iPhone emails with quoted content
      if (isIPhoneEmail && htmlContent && 
          (htmlContent.includes('Sent from my iPhone') || 
           htmlContent.includes('blockquote'))) {
        console.log('Processing iPhone email with quoted content');
        
        // Check for extremely simple content like just "Cool"
        const strippedHtml = htmlContent.replace(/<[^>]+>/g, ' ').trim();
        const firstLine = strippedHtml.split(/[\r\n]/)[0].trim();
        
        // If the content starts with a very short text followed by iPhone signature
        // This is common in replies with just a word or two like "Thanks" or "Cool"
        if (firstLine.length < 20 && 
            strippedHtml.includes('Sent from my iPhone') && 
            !firstLine.includes('Sent from my iPhone')) {
          console.log('Found simple iPhone reply with basic content:', firstLine);
          htmlContent = `<div>${firstLine}</div>`;
        } else {
          // Extract the main content from the HTML
          // First try to extract all content before the "Sent from my iPhone" signature
          const iPhoneSignatureIndex = htmlContent.indexOf('Sent from my iPhone');
          if (iPhoneSignatureIndex !== -1) {
            const mainContent = htmlContent.substring(0, iPhoneSignatureIndex).trim();
            if (mainContent && mainContent.replace(/<[^>]*>/g, '').trim().length > 0) {
              console.log('Extracted text before iPhone signature in extracted HTML');
              htmlContent = `<div>${mainContent}</div>`;
            }
          } else if (htmlContent.indexOf('Cool') === 0 || htmlContent.match(/^[\w\s]+<br>/)) {
            // This pattern matches when the content is at the beginning
            // Extract the content before signature or blockquote
            const mainContentMatch = htmlContent.match(/^([\s\S]*?)(?:<br><div>Sent from my iPhone<\/div>|<div[^>]*>Sent from my iPhone<\/div>|<blockquote)/i);
            if (mainContentMatch && mainContentMatch[1] && mainContentMatch[1].trim()) {
              htmlContent = `<div>${mainContentMatch[1].trim()}</div>`;
              console.log('Extracted main content from iPhone email using pattern match');
            }
          } else {
            // Try different split methods if the first approach didn't work
            const iPhoneHtmlParts = htmlContent.split(/<br>(?:\s*<div>)?Sent from my iPhone(?:<\/div>)?/i);
            if (iPhoneHtmlParts.length > 1 && iPhoneHtmlParts[0].trim()) {
              // Main content is before the signature
              htmlContent = `<div>${iPhoneHtmlParts[0].trim()}</div>`;
              console.log('Extracted main content from iPhone email');
            } else if (htmlContent.match(/<div[^>]*>([^<]+)<\/div>/i)) {
              // Try to extract just the first div content which often contains the message
              const firstDivMatch = htmlContent.match(/<div[^>]*>([^<]+)<\/div>/i);
              if (firstDivMatch && firstDivMatch[1] && firstDivMatch[1].trim()) {
                // Check if it's just the signature
                if (firstDivMatch[1].trim() !== 'Sent from my iPhone') {
                  htmlContent = `<div>${firstDivMatch[1].trim()}</div>`;
                  console.log('Extracted content from first div in iPhone email');
                } else {
                  // If the first div is just the signature, check if there's text outside the div
                  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<div/i);
                  if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim()) {
                    const textBeforeDiv = bodyMatch[1].trim();
                    if (textBeforeDiv) {
                      htmlContent = `<div>${textBeforeDiv}</div>`;
                      console.log('Extracted text before signature div in iPhone email');
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Process attachments if there are any indicators of them
      if ((emailData.text && emailData.text.includes('Content-ID:')) || 
          (emailData.text && emailData.text.includes('Content-Disposition: attachment')) || 
          (emailData.text && emailData.text.includes('Content-Disposition: inline')) ||
          (emailData.text && emailData.text.includes('Content-Type: image/')) ||
          (isAppleMail && emailData.text && emailData.text.includes('Content-Type: image/'))) {
        
        // Process the attachments - pass feedbackId instead of replyId
        const result = await parseAttachments(emailData.text || '', feedbackId);
        parsedAttachments = result.attachments;
        cidToUrlMap = result.cidToUrlMap;
        
        console.log(`Found ${Object.keys(cidToUrlMap).length} CID mappings from attachments`);
        
        // Replace CID references in HTML content
        if (htmlContent && Object.keys(cidToUrlMap).length > 0) {
          console.log('Replacing CID references in HTML content');
          htmlContent = replaceCidWithUrls(htmlContent, cidToUrlMap, parsedAttachments, true);
        }
        
        // Special handling for Apple Mail [Image attachment] placeholder
        if (isAppleMail && htmlContent && htmlContent.includes('[Image attachment]') && Object.keys(cidToUrlMap).length > 0) {
          console.log('Found [Image attachment] placeholder in Apple Mail content');
          // Force replacement of [Image attachment] with actual images
          const imageUrls = Object.values(cidToUrlMap);
          if (imageUrls.length > 0) {
            console.log(`Replacing Apple Mail [Image attachment] with ${imageUrls[0]}`);
            htmlContent = htmlContent.replace(
              /\[Image attachment\]/g, 
              `<img src="${imageUrls[0]}" alt="Email attachment" style="max-width: 100%;">`
            );
          }
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
          
          // For Gmail emails, clear text content to avoid duplication
          if (isGmailEmail) {
            textContent = null;
            console.log('Gmail email with generated HTML content - clearing text content to avoid duplication');
          }
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
  return { htmlContent, textContent, hasAttachments, attachments: parsedAttachments, cidToUrlMap };
}

// Helper function to extract the actual content part from raw email text
function extractActualContent(emailText: string): string | null {
  // For Gmail emails, the actual content is usually before the quoted reply
  // Look for common Gmail patterns like "On Thu, Apr 3, 2025..."
  
  // First, try to find the email body after headers
  const bodyStart = emailText.indexOf('\r\n\r\n');
  if (bodyStart === -1) return null;
  
  let emailBody = emailText.substring(bodyStart + 4);
  
  // Look for iPhone signature pattern which often precedes the quoted content
  const iPhoneSignatureIndex = emailBody.indexOf('Sent from my iPhone');
  if (iPhoneSignatureIndex !== -1) {
    // Extract everything before the signature
    const mainContent = emailBody.substring(0, iPhoneSignatureIndex).trim();
    if (mainContent) {
      console.log('Extracted content before iPhone signature');
      return mainContent;
    }
    // If no content before signature, continue with other extraction methods
  }
  
  // Try to find where the new content ends and the quoted reply begins
  const quoteStart = emailBody.match(/On .+, .+ \d+, \d{4}(,| at) \d+:\d+.+(AM|PM|am|pm).+wrote:/);
  if (quoteStart && quoteStart.index) {
    // Return everything before the quote
    return emailBody.substring(0, quoteStart.index).trim();
  }
  
  // Alternative Gmail pattern
  const altQuoteStart = emailBody.match(/On .+ wrote:/);
  if (altQuoteStart && altQuoteStart.index) {
    return emailBody.substring(0, altQuoteStart.index).trim();
  }
  
  // If no quote patterns are found, return the whole body
  return emailBody;
}

// Function to extract just the new content, ignoring quoted replies
function extractNewContent(content: string): string {
  // Check for Apple Mail signature patterns first (expanded to match more variations)
  const appleSigPatterns = [
    'Sent from my iPhone', 
    'Sent from my iPad', 
    'Sent from my Mac',
    'Sent from Mail',
    'Sent from my mobile device',
    'Get Outlook for iOS'
  ];
  
  for (const pattern of appleSigPatterns) {
    const signatureIndex = content.indexOf(pattern);
    if (signatureIndex !== -1) {
      // Return only the content before the signature
      const beforeSig = content.substring(0, signatureIndex).trim();
      if (beforeSig) {
        console.log(`Found signature pattern "${pattern}", extracting content before it`);
        return beforeSig;
      }
    }
  }
  
  // If the content has an image tag or placeholder, capture that part
  if (content.includes('[image:') || content.includes('[Image:') || content.includes('[image ')) {
    // Split by newlines to find the image reference
    const lines = content.split('\n');
    let result = '';
    let foundImage = false;
    
    // Keep only the lines up to and including the image
    for (const line of lines) {
      if (line.includes('[image:') || line.includes('[Image:') || line.includes('[image ')) {
        foundImage = true;
        result += line + '\n';
      } else if (!foundImage) {
        // If we haven't found the image yet, keep adding lines
        result += line + '\n';
      } else if (line.trim() !== '') {
        // After the image, only add non-empty lines that might be part of the message
        // Stop if we hit a line that looks like signature or quote
        if (line.includes('--') || line.includes('On ') || line.includes('wrote:')) {
          break;
        }
        result += line + '\n';
      }
    }
    return result.trim();
  }
  
  // If no image, just return the content with common signatures and quotes removed
  const signatureIndex = content.indexOf('--\n');
  if (signatureIndex !== -1) {
    return content.substring(0, signatureIndex).trim();
  }
  
  return content;
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
    const { htmlContent, textContent, hasAttachments, attachments, cidToUrlMap } = await extractEmailContent(emailData, feedbackId);
    
    // Add debug logging to see the final extracted content
    if (htmlContent) {
      console.log('Final htmlContent preview:', htmlContent.substring(0, 200) + (htmlContent.length > 200 ? '...' : ''));
    }
    if (textContent) {
      console.log('Final textContent preview:', textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
    }
    
    // Process Apple Mail content to extract just the message before any blockquotes
    let finalHtmlContent = htmlContent;
    if (htmlContent && (
        emailData.headers && Object.keys(emailData.headers).some(key => 
          emailData.headers[key] && 
          typeof emailData.headers[key] === 'string' && 
          emailData.headers[key].includes('Apple Mail')
        ) || 
        htmlContent.includes('<blockquote') || 
        emailData.text && emailData.text.includes('Apple-Mail')
    )) {
      console.log('Apple Mail format detected - preserving entire content for frontend processing');
      // No longer removing quoted content from Apple Mail emails
      // This lets the frontend handle the expand/collapse functionality consistently
      finalHtmlContent = htmlContent;
    }
    
    // Extract sender information - will be stored in the log but not in the database
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
    
    // IMPORTANT: Use HTML content when available, and text content only as a fallback
    // This prevents duplicate content from appearing in the database
    const finalContent = htmlContent ? '' : (textContent || '');
    
    // Make sure HTML content is properly decoded before storing
    // This ensures that Â and other encoding artifacts are properly handled
    const decodedHtmlContent = finalHtmlContent ? decodeHtmlEntities(finalHtmlContent) : '';
    
    // Check the database schema to see what fields are available
    const { data: tableInfo, error: schemaError } = await supabase
      .from('feedback_replies')
      .select('id')
      .limit(1);
    
    if (schemaError) {
      console.error('Error checking table schema:', schemaError);
    }
    
    // Create an object with only the fields we know exist in the database
    const replyData: any = {
      id: replyId,
      feedback_id: feedbackId,
      content: finalContent,
      html_content: decodedHtmlContent,
      message_id: messageId,
      in_reply_to: inReplyTo,
      created_at: new Date().toISOString()
    };
    
    // Add sender info if it was extracted cleanly
    if (senderName) {
      replyData.sender_type = 'user';
    }
    
    // Log the data we're about to insert
    console.log('Inserting reply with data:', Object.keys(replyData));
    
    // Insert the reply using the existing schema structure
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
            
            // Check what columns exist in feedback_attachments table
            const attachmentData: any = {
              id: attachmentId,
              reply_id: replyId,
              filename: attachment.filename,
              content_type: attachment.contentType,
              url: attachment.url,
              is_inline: attachment.isInline
            };
            
            // Only add content_id if it exists
            if (attachment.contentId) {
              attachmentData.content_id = attachment.contentId;
            }
            
            // Don't try to insert feedback_id if we got an error about it
            // This is safe since we'll always have reply_id as the foreign key
            
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
    
    // Try to update the feedback record without using 'has_replies' column
    try {
      // First check if updated_at column exists
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