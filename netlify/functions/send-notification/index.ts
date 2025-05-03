import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '../email-service';

/**
 * DATE HANDLING RULES:
 * 1. IMPORTANT: Always pass raw timestamps to the email service
 * 2. Never pre-format dates before passing to EmailService - let it handle all formatting
 * 3. Always pass created_at as a raw timestamp from the database
 * 4. For cases like timestamp handling in this file, use timestamp directly without pre-formatting
 * 5. Look for the comment "// Pass the raw timestamp, let email-service handle formatting" as a guide
 */

// Log environment variables at startup with more details for debugging
console.log('Notification function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasSendGridKey: !!process.env.SENDGRID_API_KEY,
  sendGridKeyPartial: process.env.SENDGRID_API_KEY ? `${process.env.SENDGRID_API_KEY.substring(0, 4)}...${process.env.SENDGRID_API_KEY.substring(process.env.SENDGRID_API_KEY.length - 4)}` : 'not set',
  netlifyUrl: process.env.URL,
  netlifyContext: process.env.CONTEXT
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  console.log('Notification function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length
  });

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { formId, message, type, feedbackId, assigneeEmail, assigneeName, senderName, senderId, adminOnly } = requestBody;
    
    console.log('Parsed request:', { 
      type,
      hasFormId: !!formId, 
      messageLength: message?.length,
      hasFeedbackId: !!feedbackId,
      hasAssigneeEmail: !!assigneeEmail,
      adminOnly: !!adminOnly
    });
    
    // Handle assignment notifications
    if (type === 'assignment' && feedbackId && assigneeEmail) {
      return await handleAssignmentNotification(requestBody);
    }
    
    // Original feedback notification logic
    if (!formId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing required formId field' }) 
      };
    }
    
    // Get form details
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('url, product_name')
      .eq('id', formId)
      .single();

    if (formError) {
      console.error('Form query error:', formError);
      throw formError;
    }

    if (!form) {
      console.error('Form not found:', formId);
      return { statusCode: 404, body: JSON.stringify({ error: 'Form not found' }) };
    }

    // Only fetch feedback for notification types that require it
    type FeedbackType = {
      id: string;
      url_path?: string;
      message?: string;
      user_id?: string;
      user_email?: string;
      user_name?: string;
      operating_system?: string;
      screen_category?: string;
      image_url?: string;
      image_name?: string;
      created_at?: string;
    };
    let feedback: FeedbackType | null = null;
    if (type !== 'crawl_complete') {
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (feedbackError) {
        console.error('Feedback query error:', feedbackError);
        throw feedbackError;
      }
      feedback = feedbackData as FeedbackType;
    }

    // Query based on whether adminOnly is specified
    let settingsQuery = supabase
      .from('notification_settings')
      .select('email, notification_attributes')
      .eq('form_id', formId)
      .eq('enabled', true);
    
    // If adminOnly flag is set, query only admin users
    if (adminOnly) {
      // Collect admin emails directly from form_collaborators
      const { data: adminCollaborators, error: adminError } = await supabase
        .from('form_collaborators')
        .select('invitation_email')
        .eq('form_id', formId)
        .eq('role', 'admin')
        .eq('invitation_accepted', true);
      
      if (adminError) {
        console.error('Error fetching admin collaborators:', adminError);
        throw adminError;
      }
      
      // Also get notification settings for this form
      const { data: notificationSettings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('email')
        .eq('form_id', formId)
        .eq('enabled', true);
        
      if (settingsError) {
        console.error('Error fetching notification settings:', settingsError);
        throw settingsError;
      }
      
      // Compile all unique emails
      const adminEmails = new Set<string>();
      
      // Add emails from admin collaborators
      if (adminCollaborators?.length) {
        adminCollaborators.forEach(collaborator => {
          if (collaborator.invitation_email) {
            adminEmails.add(collaborator.invitation_email);
          }
        });
      }
      
      // Add emails from notification settings
      if (notificationSettings?.length) {
        notificationSettings.forEach(setting => {
          if (setting.email) {
            adminEmails.add(setting.email);
          }
        });
      }
      
      // Convert Set to Array
      const adminEmailsList = Array.from(adminEmails);
      
      // Log the admin emails
      console.log('Admin emails to notify:', adminEmailsList);
      
      // Ensure we have emails to notify
      if (adminEmailsList.length === 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'No admin emails found for this form',
            success: true
          })
        };
      }
      
      // If this is an admin-only notification for crawl completion, 
      // we'll send directly to these emails without checking other settings
      if (type === 'crawl_complete') {
        console.log('Sending crawl completion notification directly to admins');
        
        // Send emails directly to admins
        const emailPromises = adminEmailsList.map(async (email) => {
          // Create unique ID for this message
          const messageId = `<crawl-notification-${formId}-${Date.now()}@userbird.co>`;
          
          try {
            // Use the EmailService to send the notification
            const crawlSource = form.product_name || form.url;
            const emailResult = await EmailService.sendFeedbackNotification({
              to: email,
              formUrl: crawlSource,
              formId: formId,
              product_name: form.product_name,
              message: message || `Documentation crawling for ${crawlSource} has completed successfully. Your documentation is now ready for AI to use.`,
              feedbackId: formId, // Use formId as a substitute since we don't have a feedbackId
              customSubject: `Userbird: Documentation Crawling Complete - ${crawlSource}`,
              customEmailType: 'crawl_complete'
            });
            
            return {
              email: email,
              messageId: emailResult.messageId || messageId,
              success: true
            };
          } catch (error) {
            console.error(`Error sending to admin ${email}:`, error);
            return {
              email: email,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });
        
        const results = await Promise.all(emailPromises);
        
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true,
            emailResults: results.map(r => ({ 
              success: r.success, 
              hasMessageId: !!r.messageId
            }))
          })
        };
      }
      
      // For regular notifications, continue with existing logic but filter to admin emails
      settingsQuery = settingsQuery.in('email', adminEmailsList);
    }
    
    // Execute the final query
    const { data: settings, error: settingsError } = await settingsQuery;

    if (settingsError) {
      console.error('Settings query error:', settingsError);
      throw settingsError;
    }

    console.log('Notification settings query result:', { 
      found: !!settings, 
      count: settings?.length || 0,
      emails: settings?.map(s => s.email) || [],
      adminOnly: !!adminOnly
    });

    if (!settings?.length) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ 
          message: 'No notification settings found',
          formId,
          settingsCount: settings?.length || 0
        }) 
      };
    }

    // Send emails
    console.log('Sending emails to:', settings.length, 'recipients');
    
    const emailPromises = settings.map(async (setting) => {
      // Prepare email parameters based on selected attributes
      const selectedAttrs = setting.notification_attributes || ['message'];
      
      // Create email parameters object with only selected attributes
      const emailParams: Record<string, any> = {
        formUrl: form.url,
        formId: formId,
        url_path: feedback ? feedback.url_path : undefined,
        feedbackId: feedback ? feedback.id : undefined // Add feedbackId for message ID generation
      };

      // Add selected attributes to email parameters
      if (feedback) {
        selectedAttrs.forEach(attr => {
          if (attr === 'message') {
            emailParams.message = feedback.message;
          } else if (attr === 'user_id') {
            emailParams.user_id = feedback.user_id;
          } else if (attr === 'user_email') {
            emailParams.user_email = feedback.user_email;
          } else if (attr === 'user_name') {
            emailParams.user_name = feedback.user_name;
          } else if (attr === 'operating_system') {
            emailParams.operating_system = feedback.operating_system;
          } else if (attr === 'screen_category') {
            emailParams.screen_category = feedback.screen_category;
          } else if (attr === 'image_url') {
            emailParams.image_url = feedback.image_url;
          } else if (attr === 'image_name') {
            emailParams.image_name = feedback.image_name;
          } else if (attr === 'created_at') {
            if (feedback && feedback.created_at) {
              // Pass the raw timestamp, let email-service handle formatting
              emailParams.created_at = feedback.created_at;
            }
          }
        });
      }

      const emailResult = await EmailService.sendFeedbackNotification({
        to: setting.email,
        formUrl: form.url,
        formId: formId,
        product_name: form.product_name,
        message: feedback && feedback.message ? feedback.message : '',
        feedbackId: feedback && feedback.id ? feedback.id : '',
        ...emailParams
      });
      
      // Return the result for tracking
      return {
        email: setting.email,
        messageId: emailResult.messageId,
        success: emailResult.success
      };
    });

    const results = await Promise.all(emailPromises);
    console.log('All notification emails sent successfully', { 
      results: results.map(r => ({ 
        success: r.success, 
        hasMessageId: !!r.messageId 
      }))
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        emailResults: results.map(r => ({ 
          success: r.success, 
          hasMessageId: !!r.messageId
        }))
      })
    };
  } catch (error) {
    console.error('Error in notification function:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error && error.cause ? JSON.stringify(error.cause) : undefined
    });
    
    if (error instanceof Error && error.message.includes('SendGrid')) {
      console.error('SendGrid error details:', error);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

// Helper function to handle assignment notifications
async function handleAssignmentNotification(params: {
  feedbackId: string;
  formId: string;
  assigneeId: string;
  assigneeEmail: string;
  assigneeName?: string;
  senderId?: string;
  senderName?: string;
  senderEmail?: string;
  timestamp?: string;
  meta?: Record<string, any>;
}) {
  const { 
    feedbackId, 
    formId, 
    assigneeEmail, 
    assigneeName, 
    senderName,
    timestamp 
  } = params;
  
  try {
    console.log('Processing assignment notification:', {
      feedbackId,
      formId,
      assigneeEmail
    });
    
    // Skip if assignee is the same as sender (self-assignment)
    if (params.assigneeId === params.senderId) {
      console.log('Skipping self-assignment notification');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Skipped self-assignment notification'
        })
      };
    }
    
    // Get form details
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('url, product_name')
      .eq('id', formId)
      .single();
    
    if (formError) {
      console.error('Form query error:', formError);
      throw formError;
    }
    
    if (!form) {
      console.error('Form not found:', formId);
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: 'Form not found' }) 
      };
    }
    
    // Get feedback details
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('message, ticket_number')
      .eq('id', feedbackId)
      .single();
    
    if (feedbackError) {
      console.error('Feedback query error:', feedbackError);
      throw feedbackError;
    }
    
    // Build email content
    const formattedDate = timestamp 
      ? new Date(timestamp).toISOString()  // Pass raw timestamp for consistency
      : new Date().toISOString();          // Use ISO format for new timestamps
    
    // Prepare ticket number display
    const ticketReference = feedback?.ticket_number 
      ? `Ticket #${feedback.ticket_number}` 
      : 'a ticket';
      
    // Prepare message content
    const message = feedback?.message || '';
    const messagePreview = message.length > 100 
      ? `${message.substring(0, 100)}...` 
      : message;
    
    // Prepare assignment message
    const assignmentMessage = senderName 
      ? `${senderName} has assigned ${ticketReference} to you.` 
      : `You have been assigned ${ticketReference}.`;
    
    // Get the ticket number for the subject line
    const ticketNumberMatch = message.match(/Ticket #(\d+)/i);
    const extractedTicketNumber = ticketNumberMatch ? ticketNumberMatch[1] : '';
    const displayTicketNumber = feedback?.ticket_number || extractedTicketNumber;
    
    // Send email
    const emailResult = await EmailService.sendFeedbackNotification({
      to: assigneeEmail,
      formUrl: form.url,
      formId: formId,
      product_name: form.product_name,
      message: assignmentMessage,
      feedbackId: feedbackId,
      customSubject: displayTicketNumber 
        ? `Action needed: Ticket #${displayTicketNumber} is now yours` 
        : `Action needed: You've been assigned a ticket`,
      customEmailType: 'assignment'
    });
    
    if (emailResult.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Assignment notification sent successfully'
        })
      };
    } else if ('error' in emailResult && emailResult.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send assignment notification',
          details: emailResult.error
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send assignment notification',
          details: 'Unknown error'
        })
      };
    }
  } catch (error) {
    console.error('Error in assignment notification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error && error.cause ? JSON.stringify(error.cause) : undefined
    });
    
    if (error instanceof Error && error.message.includes('SendGrid')) {
      console.error('SendGrid error details:', error);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}