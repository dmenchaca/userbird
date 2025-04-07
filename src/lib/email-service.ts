import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

export class EmailService {
  static async sendEmail(params: EmailParams) {
    try {
      // Ensure we have at least text or html content
      const text = params.text || '';
      const html = params.html || '';
      
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        text,
        html,
        headers: params.headers
      };

      await sgMail.send(msg);
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  static async sendFeedbackNotification(params: {
    to: string;
    formUrl: string;
    message?: string;
    url_path?: string;
    user_id?: string;
    user_email?: string;
    user_name?: string;
    operating_system?: string;
    screen_category?: string;
    image_url?: string;
    image_name?: string;
    created_at?: string;
    formId?: string;
  }) {
    const {
      to,
      formUrl,
      message,
      url_path,
      user_id,
      user_email,
      user_name,
      operating_system,
      screen_category,
      image_url,
      image_name,
      created_at,
      formId
    } = params;

    const showUserInfo = user_id || user_email || user_name || url_path;
    const showSystemInfo = operating_system || screen_category;

    // Always use notifications@userbird.co for new feedback notifications
    const from = 'notifications@userbird.co';

    // Create HTML version with proper styling matching the template - don't sanitize this template
    const htmlMessage = `<!DOCTYPE html>
<html>
  <body style="font-family: 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0 auto; padding: 20px; background: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1f2937; font-size: 16px; font-weight: 500; margin: 0 0 8px;">
          New feedback received for <strong>${formUrl}</strong>
        </h3>
      </div>

      <div style="margin-bottom: 24px;">
        ${message ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Message</h4>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        ` : ''}

        ${showUserInfo ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">User Information</h4>
          <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
            ${url_path ? `<p style="margin: 0;">Page URL: ${url_path}</p>` : ''}
            ${user_id ? `<p style="margin: 0;">ID: ${user_id}</p>` : ''}
            ${user_email ? `<p style="margin: 0;">Email: ${user_email}</p>` : ''}
            ${user_name ? `<p style="margin: 0;">Name: ${user_name}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${showSystemInfo ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">System Information</h4>
          <div style="color: #1f2937; font-size: 14px; line-height: 1.6;">
            ${operating_system ? `<p style="margin: 0;">OS: ${operating_system}</p>` : ''}
            ${screen_category ? `<p style="margin: 0;">Device: ${screen_category}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${image_url ? `
        <div style="margin-bottom: 16px;">
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Image</h4>
          <div style="margin-top: 8px;">
            <img src="${image_url}" alt="Feedback image" style="max-width: 100%; border-radius: 4px;" />
            ${image_name ? `<p style="color: #6b7280; font-size: 12px; margin: 4px 0 0;">${image_name}</p>` : ''}
          </div>
        </div>
        ` : ''}

        ${created_at ? `
        <div>
          <h4 style="color: #6b7280; font-size: 14px; font-weight: 500; margin: 0;">Date</h4>
          <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0;">${created_at}</p>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center;">
        <a href="https://app.userbird.co/forms/${formId || ''}" 
           style="display: inline-block; background: #1f2937; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
          View All Responses
        </a>
      </div>
    </div>
  </body>
</html>`;

  // Create plain text version
  const textMessage = `
New feedback received for ${formUrl}

${message ? `Message:
${message}

` : ''}${showUserInfo ? `User Information:
${url_path ? `Page URL: ${url_path}` : ''}
${user_id ? `ID: ${user_id}` : ''}
${user_email ? `Email: ${user_email}` : ''}
${user_name ? `Name: ${user_name}` : ''}

` : ''}${showSystemInfo ? `System Information:
${operating_system ? `Operating System: ${operating_system}` : ''}
${screen_category ? `Screen Category: ${screen_category}` : ''}

` : ''}${image_url ? `Screenshot:
${image_url}

` : ''}${created_at ? `Received on ${created_at}` : ''}`;

  // Send email directly without sanitizing the HTML content
  try {
    const msg = {
      to,
      from,
      subject: `New feedback received for ${formUrl}`,
      text: textMessage,
      html: htmlMessage,
      headers: formId ? {
        'Message-ID': `<feedback-notification-${formId}@userbird.co>`
      } : undefined
    };

    await sgMail.send(msg);
    return { 
      success: true,
      messageId: formId ? `<feedback-notification-${formId}@userbird.co>` : undefined
    };
  } catch (error) {
    console.error('Error sending feedback notification email:', error);
    throw error;
  }
}

  static async sendReplyNotification(params: {
    to: string;
    replyContent: string;
    feedback: {
      message: string;
      created_at: string;
      user_email: string;
      form_id?: string;
    };
    isFirstReply: boolean;
    feedbackId: string;
    replyId: string;
    isAdminDashboardReply?: boolean;
  }) {
    const {
      to,
      replyContent,
      feedback,
      isFirstReply,
      feedbackId,
      replyId,
      isAdminDashboardReply = false
    } = params;
    
    // Get form's default email address if we have form_id
    let from = 'support@userbird.co';
    
    if (feedback.form_id) {
      try {
        // Attempt to get the form's default email
        const response = await fetch(`/api/forms/${feedback.form_id}`);
        if (response.ok) {
          const formData = await response.json();
          if (formData.default_email) {
            from = formData.default_email;
          }
        }
      } catch (error) {
        console.error('Error fetching form email:', error);
        // Continue with default email
      }
    }

    // Format date for original message
    const compactDate = new Date(feedback.created_at).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Create plain text version
    const plainTextMessage = `${replyContent}\n\n\n${isFirstReply ? `--------------- Original Message ---------------
From: [${feedback.user_email}]
Sent: ${compactDate}
To: ${from}
Subject: Feedback submitted by ${feedback.user_email}

${feedback.message}

` : ''}`;

    // Use minimal template for admin dashboard replies
    let htmlMessage;
    
    if (isAdminDashboardReply) {
      // For admin dashboard replies, use minimal styling
      htmlMessage = `<div style="white-space: pre-wrap;">${replyContent}</div>`;
    } else {
      // For automated replies, use full styling
      htmlMessage = `
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
            </div>

            <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px; text-align: center;">You can reply to this email to continue the conversation.</p>
            </div>
          </div>
        </div>
      `;
    }

    return this.sendEmail({
      to,
      from,
      subject: `Re: Feedback submitted by ${feedback.user_email}`,
      text: plainTextMessage,
      html: htmlMessage,
      headers: {
        "In-Reply-To": `<feedback-notification-${feedbackId}@userbird.co>`,
        "References": `<feedback-notification-${feedbackId}@userbird.co>`,
        "Message-ID": `<reply-${replyId}-${feedbackId}@userbird.co>`
      }
    });
  }
} 