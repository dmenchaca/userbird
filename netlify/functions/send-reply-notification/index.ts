import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Log environment variables at startup
console.log('Reply notification function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasEmailsSecret: !!process.env.NETLIFY_EMAILS_SECRET,
  netlifyUrl: process.env.URL
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  console.log('Reply notification function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length
  });

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { feedbackId, replyContent, replyId } = JSON.parse(event.body || '{}');
    console.log('Parsed request:', { 
      hasFeedbackId: !!feedbackId, 
      replyContentLength: replyContent?.length,
      hasReplyId: !!replyId
    });
    
    if (!feedbackId || !replyContent) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing required fields' }) 
      };
    }

    // Get feedback details and form info
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*, forms:form_id(*)')
      .eq('id', feedbackId)
      .single();

    if (feedbackError) {
      console.error('Feedback query error:', feedbackError);
      throw feedbackError;
    }

    if (!feedback) {
      console.error('Feedback not found:', feedbackId);
      return { statusCode: 404, body: JSON.stringify({ error: 'Feedback not found' }) };
    }

    if (!feedback.user_email) {
      console.log('No user email to send notification to', { feedbackId });
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'No user email available for notification',
          feedbackId 
        }) 
      };
    }

    const userEmail = feedback.user_email;
    
    console.log('Sending reply notification email to:', userEmail);
    
    // Format date for email
    const formattedDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Format date in a compact way similar to the example
    const compactDate = new Date(feedback.created_at).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Create a thread identifier using the feedback ID
    const threadIdentifier = `thread::${feedbackId}::`;

    // Create a plain text email format following the Stripe example format
    const plainTextMessage = `${replyContent}\n\n\n--------------- Original Message ---------------
From: [${userEmail}]
Sent: ${compactDate}
To: notifications@userbird.co
Subject: Feedback submitted by ${userEmail}

${feedback.message}

Please do not modify this line or token as it may impact our ability to properly process your reply: ${threadIdentifier}`;
    
    // Use the minimal template
    const emailUrl = `${process.env.URL}/.netlify/functions/emails/feedback-reply-minimal`;
    
    const response = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'netlify-emails-secret': process.env.NETLIFY_EMAILS_SECRET as string,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'notifications@userbird.co',
        to: userEmail,
        subject: `Re: Feedback submitted by ${userEmail}`,
        parameters: {
          message: plainTextMessage
        },
        // Add a unique message ID with the feedback ID embedded to track the thread
        headers: {
          "In-Reply-To": `feedback-${feedbackId}@userbird.co`,
          "References": `feedback-${feedbackId}@userbird.co`,
          "Message-ID": `<reply-${replyId}-${feedbackId}@userbird.co>`
        }
      })
    });

    const text = await response.text();
    console.log('Email API response:', {
      status: response.status,
      ok: response.ok,
      text: text.slice(0, 200)
    });

    if (!response.ok) {
      throw new Error(`Email API failed: ${response.status} ${text}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in reply notification function:', {
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