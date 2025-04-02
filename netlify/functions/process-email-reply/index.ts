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

// Function to strip raw email headers and better handle email formats
function stripRawHeaders(emailText: string): string {
  // Try multiple encoding headers
  const encodingHeaders = [
    'Content-Transfer-Encoding: quoted-printable',
    'Content-Type: text/plain',
    'Content-Type: multipart/'
  ];
  
  let cleanedText = emailText;
  
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
    
    // Look for text/plain part
    for (const part of parts) {
      if (part.includes('Content-Type: text/plain')) {
        const contentStart = part.indexOf('\n\n');
        if (contentStart !== -1) {
          cleanedText = part.substring(contentStart + 2);
          break;
        }
      }
    }
  }
  
  // Remove any remaining headers
  const headerEnd = cleanedText.match(/^\s*(?:\S+:\s*\S+\s*\n)+\s*\n/);
  if (headerEnd) {
    cleanedText = cleanedText.substring(headerEnd[0].length);
  }
  
  // Often there's an empty line between headers and actual body
  return cleanedText.replace(/^\s+/, ''); // trim leading newlines/spaces
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

    // Extract the thread identifier from the email body with more patterns
    // First try the standard thread identifier format
    const threadRegex = /thread::([a-f0-9-]+)::/i;
    
    // First try to find thread ID in subject
    let threadMatch = emailData.subject?.match(threadRegex);
    let feedbackId = threadMatch?.[1];
    
    // If not found in subject, try the body
    if (!feedbackId) {
      threadMatch = emailData.text.match(threadRegex);
      feedbackId = threadMatch?.[1];
    }
    
    // Try to extract from email headers 
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

    // Try to extract from Message-ID in the email body
    if (!feedbackId) {
      const messageIdMatch = emailData.text.match(/Message-ID: <reply-[^-]+-([a-f0-9-]+)@userbird\.co>/i);
      if (messageIdMatch) {
        feedbackId = messageIdMatch[1];
      }
    }
    
    // Try to extract from References or In-Reply-To in the email body
    if (!feedbackId) {
      const referencesMatch = emailData.text.match(/References: .*feedback-([a-f0-9-]+)@userbird\.co/i) || 
                            emailData.text.match(/In-Reply-To: .*feedback-([a-f0-9-]+)@userbird\.co/i);
      if (referencesMatch) {
        feedbackId = referencesMatch[1];
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
    
    // Handle multipart/alternative emails
    if (replyContent.includes('Content-Type: multipart/alternative')) {
      // Find the text/plain part
      const textPartStart = replyContent.indexOf('Content-Type: text/plain');
      if (textPartStart > -1) {
        // Find the end of headers (blank line after Content-Type)
        const textContentStart = replyContent.indexOf('\n\n', textPartStart);
        if (textContentStart > -1) {
          // Find the boundary that ends this part
          const boundaryMatch = replyContent.match(/boundary="([^"]+)"/);
          const boundary = boundaryMatch ? boundaryMatch[1] : '';
          
          if (boundary) {
            // Look for the next boundary or the end of the message
            const nextBoundaryIndex = replyContent.indexOf(`--${boundary}`, textContentStart + 2);
            if (nextBoundaryIndex > -1) {
              // Found next boundary, extract content up to it
              replyContent = replyContent.substring(textContentStart + 2, nextBoundaryIndex).trim();
            } else {
              // No next boundary found, take everything after headers
              replyContent = replyContent.substring(textContentStart + 2).trim();
            }
          } else {
            // No boundary found, take everything after headers
            replyContent = replyContent.substring(textContentStart + 2).trim();
          }
        }
      }
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

    // Remove any remaining email headers
    const headerEndIndex = replyContent.indexOf('\n\n');
    if (headerEndIndex > -1) {
      replyContent = replyContent.substring(headerEndIndex + 2).trim();
    }

    // Remove any remaining email headers that might be at the start
    const emailHeaderRegex = /^(Received|From|To|Subject|Date|Message-ID|In-Reply-To|References|MIME-Version|Content-Type|Content-Transfer-Encoding|X-|DKIM-Signature|X-Google-DKIM-Signature|X-Gm-Message-State|X-Gm-Gg|X-Google-Smtp-Source|X-Received):/m;
    replyContent = replyContent.replace(emailHeaderRegex, '').trim();

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
    
    const { error: insertError } = await supabase
      .from('feedback_replies')
      .insert({
        id: replyId,
        feedback_id: feedbackId,
        content: replyContent,
        sender_type: 'user',
      });

    if (insertError) {
      console.error('Error inserting reply:', insertError);
      throw insertError;
    }

    console.log('Successfully added user reply to thread', {
      replyId,
      feedbackId,
      replyContent: replyContent.substring(0, 50) + (replyContent.length > 50 ? '...' : '')
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        replyId
      })
    };
  } catch (error) {
    console.error('Error processing email reply:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 200, // Return 200 so email services don't retry
      body: JSON.stringify({ 
        error: 'Error processing email reply',
        success: false
      })
    };
  }
}; 