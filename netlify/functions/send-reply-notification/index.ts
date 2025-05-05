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
  // Generate a unique trace ID for this request for easier correlation in logs
  const requestId = Math.random().toString(36).substring(2, 15);
  
  console.log(`[${requestId}] REPLY_NOTIFICATION_START`, {
    timestamp: new Date().toISOString(),
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length,
    requestPath: event.path,
    headers: Object.keys(event.headers || {})
  });

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { feedbackId, replyContent, replyId, htmlContent, isAdminDashboardReply, productName } = JSON.parse(event.body || '{}');
    console.log(`[${requestId}] REPLY_NOTIFICATION_REQUEST`, { 
      hasFeedbackId: !!feedbackId, 
      feedbackId,
      replyId,
      replyContentLength: replyContent?.length,
      replyContentPreview: replyContent?.substring(0, 50),
      hasReplyId: !!replyId,
      hasHtmlContent: !!htmlContent,
      htmlContentLength: htmlContent?.length,
      isAdminDashboardReply: !!isAdminDashboardReply,
      productName,
      source: JSON.parse(event.body || '{}')?.source || 'unknown'
    });
    
    if (!feedbackId || !replyContent) {
      console.log(`[${requestId}] REPLY_NOTIFICATION_MISSING_FIELDS`);
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
      console.error(`[${requestId}] REPLY_NOTIFICATION_FEEDBACK_ERROR`, {
        feedbackId,
        error: feedbackError.message,
        code: feedbackError.code
      });
      throw feedbackError;
    }

    if (!feedback) {
      console.error(`[${requestId}] REPLY_NOTIFICATION_FEEDBACK_NOT_FOUND`, { feedbackId });
      return { statusCode: 404, body: JSON.stringify({ error: 'Feedback not found' }) };
    }
    
    // Check if replyId already has an associated message_id, which would indicate 
    // this reply has already been processed
    if (replyId) {
      const { data: existingReply } = await supabase
        .from('feedback_replies')
        .select('message_id, created_at, meta')
        .eq('id', replyId)
        .single();
        
      if (existingReply?.message_id) {
        console.log(`[${requestId}] REPLY_NOTIFICATION_ALREADY_SENT`, {
          replyId,
          existingMessageId: existingReply.message_id,
          createdAt: existingReply.created_at,
          meta: existingReply.meta
        });
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            alreadyProcessed: true,
            messageId: existingReply.message_id
          })
        };
      }
    }
    
    // If replyId is provided, fetch the html_content from the database
    let processedHtmlContent = htmlContent;
    if (replyId) {
      const { data: replyData } = await supabase
        .from('feedback_replies')
        .select('html_content, meta')
        .eq('id', replyId)
        .single();
        
      if (replyData?.html_content) {
        console.log(`[${requestId}] REPLY_NOTIFICATION_USING_HTML_CONTENT`, {
          replyId,
          source: replyData.meta?.source || 'unknown'
        });
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
      .select('id, message_id, in_reply_to, created_at')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: false });

    const isFirstReply = !existingReplies?.length;
    
    // Find the latest message ID from any reply to use for threading
    const lastMessageId = existingReplies?.find(reply => reply.message_id)?.message_id;
    
    // Determine the in_reply_to value - if this is the first reply, use the feedback notification
    // Otherwise use the most recent message ID
    let inReplyTo: string | null = null;
    if (isFirstReply) {
      inReplyTo = `<feedback-notification-${feedbackId}@userbird.co>`;
    } else if (lastMessageId) {
      inReplyTo = lastMessageId;
    }

    console.log(`[${requestId}] REPLY_NOTIFICATION_CONTEXT`, {
      isFirstReply,
      replyCount: existingReplies?.length || 0,
      hasLastMessageId: !!lastMessageId,
      lastMessageId,
      inReplyTo,
      recentReplies: existingReplies?.slice(0, 3).map(reply => ({ 
        id: reply.id, 
        message_id: reply.message_id,
        created_at: reply.created_at
      }))
    });

    if (!feedback.user_email) {
      console.log(`[${requestId}] REPLY_NOTIFICATION_NO_EMAIL`, { feedbackId });
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'No user email available for notification',
          feedbackId 
        }) 
      };
    }

    const userEmail = feedback.user_email;
    
    console.log(`[${requestId}] REPLY_NOTIFICATION_SENDING`, {
      to: userEmail,
      replyId,
      feedbackId
    });

    // EmailService now directly supports custom emails
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
      lastMessageId: inReplyTo || undefined, // Convert null to undefined if needed
      isAdminDashboardReply,
      productName
    });

    console.log(`[${requestId}] REPLY_NOTIFICATION_EMAIL_SENT`, {
      replyId,
      feedbackId,
      messageId: emailResult.messageId,
      inReplyTo: inReplyTo || undefined
    });

    // Store the message ID in the database and update in_reply_to field
    if (emailResult.messageId && replyId) {
      console.log(`[${requestId}] REPLY_NOTIFICATION_UPDATING_REPLY`, { 
        replyId,
        messageId: emailResult.messageId,
        inReplyTo: inReplyTo || undefined
      });
      
      const updateData: any = { message_id: emailResult.messageId };
      
      // Also store the in_reply_to reference for proper threading
      if (inReplyTo) {
        updateData.in_reply_to = inReplyTo;
      }
      
      const { error: updateError } = await supabase
        .from('feedback_replies')
        .update(updateData)
        .eq('id', replyId);
      
      if (updateError) {
        console.error(`[${requestId}] REPLY_NOTIFICATION_UPDATE_ERROR`, {
          replyId,
          error: updateError.message
        });
      } else {
        console.log(`[${requestId}] REPLY_NOTIFICATION_UPDATE_SUCCESS`, {
          replyId,
          messageId: emailResult.messageId,
          inReplyTo: inReplyTo || undefined
        });
      }
    }

    console.log(`[${requestId}] REPLY_NOTIFICATION_COMPLETE`, {
      replyId,
      feedbackId,
      success: true
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        messageId: emailResult.messageId,
        requestId
      })
    };

  } catch (error) {
    console.error(`[${requestId}] REPLY_NOTIFICATION_ERROR`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', requestId })
    };
  }
}; 