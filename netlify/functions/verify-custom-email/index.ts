import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Helper functions
const validateRequest = (body: any) => {
  if (!body.formId) {
    return { valid: false, error: 'Form ID is required' };
  }
  if (!body.customEmail) {
    return { valid: false, error: 'Custom email address is required' };
  }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(body.customEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
};

const sendVerificationEmail = async (options: {
  to: string;
  token: string;
  formId: string;
  verificationUrl: string;
}) => {
  const { to, token, formId, verificationUrl } = options;
  
  // Create verification URL with token
  const fullVerificationUrl = `${verificationUrl}?token=${token}&formId=${formId}`;
  
  const msg = {
    to,
    from: 'notifications@userbird.co',
    subject: 'Verify Your Custom Email Address for Userbird',
    text: `
Please verify your email address to use it as a custom sender for your Userbird forms.

Verification link: ${fullVerificationUrl}

If you did not request this verification, please ignore this email.

Thanks,
The Userbird Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0; padding: 20px; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
    <h2 style="color: #1f2937; margin-top: 0;">Verify Your Custom Email Address</h2>
    
    <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
      Please verify your email address to use it as a custom sender for your Userbird forms.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${fullVerificationUrl}" 
         style="display: inline-block; background: #1f2937; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
      If you did not request this verification, please ignore this email.
    </p>
    
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Thanks,<br>
        The Userbird Team
      </p>
    </div>
  </div>
</body>
</html>
    `
  };
  
  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error };
  }
};

/**
 * Request handler for custom email verification
 * 
 * POST /.netlify/functions/verify-custom-email
 * - Initiates verification process
 * - Generates token and sends verification email
 * 
 * GET /.netlify/functions/verify-custom-email
 * - Verifies token and activates custom email
 */
export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Handle verification confirmation (GET request with token)
  if (event.httpMethod === 'GET') {
    const token = event.queryStringParameters?.token;
    const formId = event.queryStringParameters?.formId;
    
    if (!token || !formId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Missing token or form ID' 
        })
      };
    }
    
    try {
      // Find the email verification record
      const { data: emailSettings, error } = await supabase
        .from('custom_email_settings')
        .select('id, custom_email, verified')
        .eq('form_id', formId)
        .eq('verification_token', token)
        .single();
      
      if (error || !emailSettings) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Invalid or expired verification token' 
          })
        };
      }
      
      // Mark as verified
      await supabase
        .from('custom_email_settings')
        .update({ 
          verified: true,
          verification_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', emailSettings.id);
      
      // Return success with HTML response
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/html'
        },
        body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verified - Userbird</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
      text-align: center;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
    }
    h1 {
      color: #1f2937;
      margin-bottom: 16px;
    }
    p {
      color: #4b5563;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background: #1f2937;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="card">
    <svg class="success-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#10B981">
      <circle cx="12" cy="12" r="11" stroke-width="2"></circle>
      <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"></path>
    </svg>
    
    <h1>Email Verified Successfully!</h1>
    
    <p>Your email address <strong>${emailSettings.custom_email}</strong> has been verified and is now active as a custom sender for your Userbird forms.</p>
    
    <a href="https://app.userbird.co" class="button">Go to Dashboard</a>
  </div>
</body>
</html>
        `
      };
    } catch (error) {
      console.error('Error verifying email:', error);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'An error occurred during verification' 
        })
      };
    }
  }
  
  // Handle send verification (POST request)
  if (event.httpMethod === 'POST') {
    try {
      // Parse request body
      const body = JSON.parse(event.body || '{}');
      
      // Validate request
      const validation = validateRequest(body);
      if (!validation.valid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, message: validation.error })
        };
      }
      
      const { formId, customEmail, senderName } = body;
      
      // Check if form exists and user has access
      const { data: form, error: formError } = await supabase
        .from('forms')
        .select('id, owner_id')
        .eq('id', formId)
        .single();
      
      if (formError || !form) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, message: 'Form not found' })
        };
      }
      
      // Check if userId is provided and matches form owner
      const userId = event.headers.authorization?.replace('Bearer ', '');
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, message: 'Authentication required' })
        };
      }
      
      // Generate verification token
      const verificationToken = uuidv4();
      
      // Check if custom email setting already exists
      const { data: existingSettings } = await supabase
        .from('custom_email_settings')
        .select('id')
        .eq('form_id', formId)
        .single();
      
      if (existingSettings) {
        // Update existing record
        await supabase
          .from('custom_email_settings')
          .update({ 
            custom_email: customEmail,
            verified: false,
            verification_token: verificationToken,
            verification_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);
      } else {
        // Create new record
        await supabase
          .from('custom_email_settings')
          .insert({ 
            form_id: formId,
            custom_email: customEmail,
            verified: false,
            verification_token: verificationToken,
            verification_sent_at: new Date().toISOString()
          });
      }
      
      // Update sender name if provided
      if (senderName) {
        await supabase
          .from('forms')
          .update({ default_sender_name: senderName })
          .eq('id', formId);
      }
      
      // Send verification email
      const verificationUrl = process.env.SITE_URL 
        ? `${process.env.SITE_URL}/.netlify/functions/verify-custom-email` 
        : 'https://app.userbird.co/.netlify/functions/verify-custom-email';
      
      const emailResult = await sendVerificationEmail({
        to: customEmail,
        token: verificationToken,
        formId,
        verificationUrl
      });
      
      if (!emailResult.success) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Failed to send verification email' 
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Verification email sent successfully' 
        })
      };
    } catch (error) {
      console.error('Error setting up email verification:', error);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'An error occurred' 
        })
      };
    }
  }
  
  // Handle unsupported methods
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, message: 'Method not allowed' })
  };
}; 