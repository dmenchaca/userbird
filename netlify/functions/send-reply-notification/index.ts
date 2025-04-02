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

    // Check if this is the first reply
    const { data: existingReplies } = await supabase
      .from('feedback_replies')
      .select('id')
      .eq('feedback_id', feedbackId)
      .limit(1);

    const isFirstReply = !existingReplies?.length;

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
    const plainTextMessage = `${replyContent}\n\n\n${isFirstReply ? `--------------- Original Message ---------------
From: [${userEmail}]
Sent: ${compactDate}
To: notifications@userbird.co
Subject: Feedback submitted by ${userEmail}

${feedback.message}

` : ''}Please do not modify this line or token as it may impact our ability to properly process your reply: ${threadIdentifier}`;

    // Create HTML version with the thread ID
    const htmlMessage = `
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
              <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap; background: #e6f7ff; padding: 12px; border-radius: 6px; margin-top: 8px; border-left: 4px solid #0284c7;">${replyContent}</p>
            </div>

            <div style="margin-top: 16px;">
              <p style="color: #6b7280; font-size: 12px; font-style: italic; margin: 0;">Reply sent on ${formattedDate}</p>
            </div>
          </div>

          <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px; text-align: center;">You can reply to this email to continue the conversation.</p>
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">Please do not modify this line or token as it may impact our ability to properly process your reply: ${threadIdentifier}</p>
          </div>
        </div>
      </div>
    `;
    
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
          message: plainTextMessage,
          html: htmlMessage
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