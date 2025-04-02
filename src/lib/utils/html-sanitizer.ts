/**
 * HTML sanitizer and formatter utilities for Userbird
 * These functions help safely handle HTML content in emails and dashboard
 */

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param html The raw HTML input
 * @returns Sanitized HTML with only allowed tags and attributes
 */
export function sanitizeHtml(html: string): string {
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
 * Converts plain text to simple HTML with links and line breaks
 * @param text Plain text input
 * @returns Basic HTML with links and formatting
 */
export function textToHtml(text: string): string {
  if (!text) return '';
  
  return text
    // Escape HTML special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    // Convert URLs to links
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    // Convert newlines to <br> tags
    .replace(/\n/g, '<br>');
}

/**
 * Removes HTML tags from content to create plain text version
 * @param html HTML content
 * @returns Plain text with links preserved
 */
export function stripHtml(html: string): string {
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