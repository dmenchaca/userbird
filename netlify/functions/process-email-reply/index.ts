import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as multipart from 'parse-multipart-data';

// Log environment variables at startup
console.log('Process email reply function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Extract the thread identifier from the email body
    const threadRegex = /thread::([a-f0-9-]+)::/i;
    const threadMatch = emailData.text.match(threadRegex);
    
    if (!threadMatch || !threadMatch[1]) {
      console.error('No thread identifier found in email');
      return { 
        statusCode: 200, // Return 200 so email services don't retry
        body: JSON.stringify({ 
          warning: 'No thread identifier found in email',
          success: false 
        }) 
      };
    }

    const feedbackId = threadMatch[1];
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
    // This is a simple implementation - production systems would use more sophisticated parsing
    let replyContent = emailData.text;
    
    // If this is a multipart email from SendGrid, extract just the plain text message content
    if (replyContent.includes('Content-Type: text/plain')) {
      // Find the text/plain part
      const plainTextPartIndex = replyContent.indexOf('Content-Type: text/plain');
      if (plainTextPartIndex > -1) {
        // Find the end of headers (blank line after Content-Type)
        const headersEndIndex = replyContent.indexOf('\n\n', plainTextPartIndex);
        if (headersEndIndex > -1) {
          // Find the boundary that starts this part
          const boundaryMatch = replyContent.match(/boundary="([^"]+)"/);
          const boundary = boundaryMatch ? boundaryMatch[1] : '';
          
          if (boundary) {
            // Look for the next boundary or the end of the message
            const nextBoundaryIndex = replyContent.indexOf(`--${boundary}`, headersEndIndex + 2);
            if (nextBoundaryIndex > -1) {
              // Found next boundary, extract content up to it
              replyContent = replyContent.substring(headersEndIndex + 2, nextBoundaryIndex).trim();
            } else {
              // No next boundary found, take everything after headers
              replyContent = replyContent.substring(headersEndIndex + 2).trim();
            }
          } else {
            // No boundary found, take everything after headers
            replyContent = replyContent.substring(headersEndIndex + 2).trim();
          }
        }
      }
    }
    
    // Remove everything after the original message marker if present
    const originalMessageIndex = replyContent.indexOf('--------------- Original Message ---------------');
    if (originalMessageIndex > -1) {
      replyContent = replyContent.substring(0, originalMessageIndex).trim();
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

    console.log('Extracted reply content:', replyContent);

    // Store the reply in the database
    const { data: insertedReply, error: insertError } = await supabase
      .from('feedback_replies')
      .insert([
        {
          feedback_id: feedbackId,
          sender_type: 'user',
          content: replyContent
        }
      ])
      .select();

    if (insertError) {
      console.error('Error inserting reply:', insertError);
      throw insertError;
    }

    console.log('Successfully added user reply to thread', {
      replyId: insertedReply?.[0]?.id,
      feedbackId,
      replyContent: replyContent.substring(0, 50) + (replyContent.length > 50 ? '...' : '')
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        replyId: insertedReply?.[0]?.id
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