import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '../email-service';

// Log environment variables at startup with more details for debugging
console.log('Reply notification function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasSendGridKey: !!process.env.SENDGRID_API_KEY,
  sendGridKeyPartial: process.env.SENDGRID_API_KEY ? `${process.env.SENDGRID_API_KEY.substring(0, 4)}...${process.env.SENDGRID_API_KEY.substring(process.env.SENDGRID_API_KEY.length - 4)}` : 'not set',
  netlifyUrl: process.env.URL
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Convert plain text to HTML (for fallback when no HTML content is provided)
function plainTextToHtml(content: string): string {
  if (!content) return '';
  
  // Escape HTML special characters
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
    
  // Process line breaks
  html = html.replace(/\n/g, '<br>');
  
  // Process URLs
  html = html.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  return html;
}

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
    const { feedbackId, replyContent, replyId, htmlContent, isAdminDashboardReply } = JSON.parse(event.body || '{}');
    console.log('Parsed request:', { 
      hasFeedbackId: !!feedbackId, 
      replyContentLength: replyContent?.length,
      hasReplyId: !!replyId,
      hasHtmlContent: !!htmlContent,
      isAdminDashboardReply: !!isAdminDashboardReply
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
    
    // If replyId is provided, fetch the html_content from the database
    let processedHtmlContent = htmlContent;
    if (replyId) {
      const { data: replyData } = await supabase
        .from('feedback_replies')
        .select('html_content')
        .eq('id', replyId)
        .single();
        
      if (replyData?.html_content) {
        console.log('Using html_content from database');
        processedHtmlContent = replyData.html_content;
      }
    }
    
    // If still no HTML content, convert the plain text to simple HTML
    if (!processedHtmlContent) {
      console.log('No HTML content found, converting plain text to HTML');
      processedHtmlContent = plainTextToHtml(replyContent);
    }

    // Check if this is the first reply and find the last message ID for threading
    const { data: existingReplies } = await supabase
      .from('feedback_replies')
      .select('id, message_id')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: false });

    const isFirstReply = !existingReplies?.length;
    
    // Find the latest message ID from a user reply to use for threading
    const lastMessageId = existingReplies?.find(reply => reply.message_id)?.message_id;
    
    console.log('Reply context:', {
      isFirstReply,
      replyCount: existingReplies?.length || 0,
      hasLastMessageId: !!lastMessageId,
      lastMessageId
    });

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

    const emailResult = await EmailService.sendReplyNotification({
      to: userEmail,
      replyContent,
      htmlReplyContent: processedHtmlContent,
      feedback: {
        message: feedback.message,
        created_at: feedback.created_at,
        user_email: feedback.user_email,
        id: feedbackId
      },
      isFirstReply,
      feedbackId,
      replyId,
      lastMessageId,
      isAdminDashboardReply
    });

    // Store the message ID in the database
    if (emailResult.messageId && replyId) {
      console.log('Updating reply with message ID:', emailResult.messageId);
      
      const { error: updateError } = await supabase
        .from('feedback_replies')
        .update({ message_id: emailResult.messageId })
        .eq('id', replyId);
      
      if (updateError) {
        console.error('Error updating reply with message ID:', updateError);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        messageId: emailResult.messageId 
      })
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