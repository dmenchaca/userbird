import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
const { trackEvent, shutdownPostHog } = require('../lib/posthog');
import { generateDNSRecords } from '../lib/dns-verification';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
}

type CustomEmailSettingsResponse = {
  id: string;
  form_id: string;
  custom_email: string;
  verified: boolean;
  domain: string;
  local_part: string;
  forwarding_address: string;
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'failed';
  last_verification_attempt?: string;
  verification_messages?: string[];
  created_at: string;
  updated_at: string;
};

type DNSRecordResponse = {
  id: string;
  custom_email_setting_id: string;
  record_type: string;
  record_name: string;
  record_value: string;
  verified: boolean;
  dkim_selector?: string;
  last_check_time?: string;
  failure_reason?: string;
};

export const handler: Handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Get the user from the JWT token
  const authHeader = event.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const formId = event.queryStringParameters?.formId;
    
    if (!formId?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Form ID is required' })
      };
    }

    // Check if user owns the form
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('id')
      .eq('id', formId.trim())
      .eq('owner_id', user.id)
      .single();

    if (formError || !formData) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You do not have permission to access this form' })
      };
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET':
        return await getCustomEmailSettings(formId, headers);
      case 'POST':
        return await createCustomEmailSettings(event, formId, headers);
      case 'PUT':
        return await updateCustomEmailSettings(event, formId, headers);
      case 'DELETE':
        return await deleteCustomEmailSettings(event, formId, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  } finally {
    await shutdownPostHog();
  }
};

async function getCustomEmailSettings(formId: string, headers: Record<string, string>) {
  // Get custom email settings for the form
  const { data: settings, error: settingsError } = await supabase
    .from('custom_email_settings')
    .select('*')
    .eq('form_id', formId)
    .single();

  if (settingsError && settingsError.code !== 'PGRST116') { // Skip not found error
    throw settingsError;
  }

  if (!settings) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ settings: null, dnsRecords: [] })
    };
  }

  // Get DNS records if settings exist
  const { data: dnsRecords, error: dnsError } = await supabase
    .from('dns_verification_records')
    .select('*')
    .eq('custom_email_setting_id', settings.id);

  if (dnsError) throw dnsError;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      settings: settings,
      dnsRecords: dnsRecords || []
    })
  };
}

async function createCustomEmailSettings(event: any, formId: string, headers: Record<string, string>) {
  const body = JSON.parse(event.body || '{}');
  const { custom_email } = body;

  if (!custom_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Custom email is required' })
    };
  }

  // Check if custom email already exists for this form
  const { data: existingSettings } = await supabase
    .from('custom_email_settings')
    .select('id')
    .eq('form_id', formId)
    .single();

  if (existingSettings) {
    return {
      statusCode: 409,
      headers,
      body: JSON.stringify({ error: 'Custom email settings already exist for this form' })
    };
  }

  // Extract domain and local part from custom_email
  const [localPart, domain] = custom_email.split('@');
  // Use the standard forwarding format: localpart@userbird-mail.com
  const forwardingAddress = `${localPart}@userbird-mail.com`;

  // Create new custom email settings
  const { data: newSettings, error: settingsError } = await supabase
    .from('custom_email_settings')
    .insert([{ 
      form_id: formId, 
      custom_email,
      forwarding_address: forwardingAddress,
      verification_status: 'unverified',
      last_verification_attempt: new Date().toISOString()
    }])
    .select()
    .single();

  if (settingsError) throw settingsError;

  // Generate DNS verification records using the new utility
  const { records } = generateDNSRecords(newSettings);
  
  // Insert DNS records
  const { data: insertedRecords, error: dnsError } = await supabase
    .from('dns_verification_records')
    .insert(records)
    .select();

  if (dnsError) throw dnsError;

  trackEvent('custom_email_created', {
    form_id: formId,
    domain: newSettings.domain
  });

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({ 
      settings: newSettings,
      dnsRecords: insertedRecords
    })
  };
}

async function updateCustomEmailSettings(event: any, formId: string, headers: Record<string, string>) {
  const body = JSON.parse(event.body || '{}');
  const { id, custom_email } = body;

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Settings ID is required' })
    };
  }

  // Check if custom email settings exist and belong to this form
  const { data: existingSettings, error: checkError } = await supabase
    .from('custom_email_settings')
    .select('id')
    .eq('id', id)
    .eq('form_id', formId)
    .single();

  if (checkError || !existingSettings) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Custom email settings not found' })
    };
  }

  const updateData: any = {};
  
  // Only update custom_email if provided
  if (custom_email) {
    // Extract domain and local part from custom_email
    const [localPart, domain] = custom_email.split('@');
    // Use the standard forwarding format: localpart@userbird-mail.com
    const forwardingAddress = `${localPart}@userbird-mail.com`;
    
    updateData.custom_email = custom_email;
    updateData.forwarding_address = forwardingAddress;
    // Reset verification when email changes
    updateData.verified = false;
    updateData.spf_verified = false;
    updateData.dkim_verified = false;
    updateData.dmarc_verified = false;
    updateData.verification_status = 'unverified';
    updateData.last_verification_attempt = new Date().toISOString();
    updateData.verification_messages = [];
  }

  // Update custom email settings
  const { data: updatedSettings, error: updateError } = await supabase
    .from('custom_email_settings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  // If email changed, regenerate DNS records
  if (custom_email) {
    // Delete old DNS records
    await supabase
      .from('dns_verification_records')
      .delete()
      .eq('custom_email_setting_id', id);

    // Generate new DNS records using the utility
    const { records } = generateDNSRecords(updatedSettings);
    
    // Insert new DNS records
    const { data: insertedRecords, error: dnsError } = await supabase
      .from('dns_verification_records')
      .insert(records)
      .select();

    if (dnsError) throw dnsError;

    trackEvent('custom_email_updated', {
      form_id: formId,
      domain: updatedSettings.domain
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        settings: updatedSettings,
        dnsRecords: insertedRecords
      })
    };
  }

  // Get current DNS records if email didn't change
  const { data: dnsRecords, error: dnsError } = await supabase
    .from('dns_verification_records')
    .select('*')
    .eq('custom_email_setting_id', id);

  if (dnsError) throw dnsError;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      settings: updatedSettings,
      dnsRecords: dnsRecords || []
    })
  };
}

async function deleteCustomEmailSettings(event: any, formId: string, headers: Record<string, string>) {
  const settingsId = event.queryStringParameters?.id;

  if (!settingsId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Settings ID is required' })
    };
  }

  // Check if custom email settings exist and belong to this form
  const { data: existingSettings, error: checkError } = await supabase
    .from('custom_email_settings')
    .select('domain')
    .eq('id', settingsId)
    .eq('form_id', formId)
    .single();

  if (checkError || !existingSettings) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Custom email settings not found' })
    };
  }

  // DNS records will be deleted automatically due to CASCADE delete
  const { error: deleteError } = await supabase
    .from('custom_email_settings')
    .delete()
    .eq('id', settingsId);

  if (deleteError) throw deleteError;

  trackEvent('custom_email_deleted', {
    form_id: formId,
    domain: existingSettings.domain
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
} 