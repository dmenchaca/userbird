import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_SENDER = 'notifications@userbird.co';
const DEFAULT_SENDER_NAME = 'Userbird Feedback';

export interface EmailSenderInfo {
  email: string;
  name?: string;
}

/**
 * Get the appropriate sender email for a form
 * If a custom email is verified, use that; otherwise fall back to the default
 */
export async function getSenderEmail(formId: string): Promise<EmailSenderInfo> {
  try {
    // First check for a custom email setting
    const { data: customEmail, error: customEmailError } = await supabase
      .from('custom_email_settings')
      .select('custom_email, verified')
      .eq('form_id', formId)
      .eq('verified', true)
      .single();
    
    if (!customEmailError && customEmail && customEmail.verified) {
      // Found a verified custom email, use it
      return {
        email: customEmail.custom_email
      };
    }

    // If no verified custom email, check for a default sender name
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('default_sender_name, url')
      .eq('id', formId)
      .single();
    
    if (!formError && form) {
      return {
        email: DEFAULT_SENDER,
        name: form.default_sender_name || `${form.url} Feedback`
      };
    }

    // Fall back to system default
    return {
      email: DEFAULT_SENDER,
      name: DEFAULT_SENDER_NAME
    };
  } catch (error) {
    console.error('Error getting sender email:', error);
    // In case of any error, use the default
    return {
      email: DEFAULT_SENDER,
      name: DEFAULT_SENDER_NAME
    };
  }
}

/**
 * Format sender email with name if available
 */
export function formatSender(sender: EmailSenderInfo): string {
  if (sender.name) {
    return `"${sender.name}" <${sender.email}>`;
  }
  return sender.email;
}

/**
 * Check if there are any verified custom email settings
 */
export async function hasVerifiedCustomEmail(formId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('custom_email_settings')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', formId)
      .eq('verified', true);
    
    return !error && count !== null && count > 0;
  } catch (error) {
    console.error('Error checking for verified custom email:', error);
    return false;
  }
} 