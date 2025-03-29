import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

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
    headers: event.headers
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
    // Attempt to parse JSON, but also handle form data or raw text
    let emailData;
    try {
      emailData = JSON.parse(event.body || '{}');
    } catch (e) {
      // If not JSON, try to parse as form data or use raw text
      console.log('Not JSON, using raw body as text');
      emailData = {
        text: event.body,
        from: event.headers['from'] || 'unknown',
        to: event.headers['to'] || 'unknown',
        subject: event.headers['subject'] || 'No Subject'
      };
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
    
    // Remove everything after the original message marker if present
    const originalMessageIndex = replyContent.indexOf('--------------- Original Message ---------------');
    if (originalMessageIndex > -1) {
      replyContent = replyContent.substring(0, originalMessageIndex).trim();
    }

    // Remove common email signatures
    const signatureMarkers = [
      '-- \n',
      'Sent from my iPhone',
      'Sent from my Android',
      'Get Outlook for iOS'
    ];
    
    for (const marker of signatureMarkers) {
      const markerIndex = replyContent.indexOf(marker);
      if (markerIndex > -1) {
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