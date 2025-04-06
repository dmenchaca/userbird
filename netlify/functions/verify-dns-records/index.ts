import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyTXTRecord, verifyCNAMERecord } from '../lib/dns-verification';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role key
const supabase = createClient(supabaseUrl, supabaseKey);

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

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
    // Get settingsId and formId from query parameters or body
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const settingsId = body.settingsId || event.queryStringParameters?.settingsId;
    const formId = body.formId || event.queryStringParameters?.formId;
    
    if (!settingsId && !formId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Either settingsId or formId is required' })
      };
    }

    // If formId is provided, get settingsId from it
    let customEmailSettingId = settingsId;
    if (!customEmailSettingId && formId) {
      const { data: settings, error: settingsError } = await supabase
        .from('custom_email_settings')
        .select('id')
        .eq('form_id', formId)
        .single();
      
      if (settingsError || !settings) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Custom email settings not found for this form' })
        };
      }
      
      customEmailSettingId = settings.id;
    }

    // Check if user owns the email settings
    const { data: emailSettings, error: emailError } = await supabase
      .from('custom_email_settings')
      .select('*, forms!inner(owner_id)')
      .eq('id', customEmailSettingId)
      .single();
    
    if (emailError || !emailSettings || emailSettings.forms.owner_id !== user.id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You do not have permission to verify these settings' })
      };
    }

    // Set status to pending
    await supabase
      .from('custom_email_settings')
      .update({
        verification_status: 'pending',
        last_verification_attempt: new Date().toISOString()
      })
      .eq('id', customEmailSettingId);

    // Get DNS records
    const { data: dnsRecords, error: dnsError } = await supabase
      .from('dns_verification_records')
      .select('*')
      .eq('custom_email_setting_id', customEmailSettingId);
    
    if (dnsError || !dnsRecords || dnsRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'DNS records not found' })
      };
    }

    // Verify each DNS record
    const verificationResults = await Promise.all(
      dnsRecords.map(async record => {
        const result = await verifyDNSRecord(record, emailSettings.domain);
        
        // Update record verification status
        await supabase
          .from('dns_verification_records')
          .update({ 
            verified: result.verified,
            last_check_time: new Date().toISOString(),
            failure_reason: result.error || null
          })
          .eq('id', record.id);
        
        return {
          ...record,
          verified: result.verified,
          error: result.error
        };
      })
    );
    
    // Check if all required records are verified
    const allVerified = verificationResults.every(record => record.verified);
    
    // Update overall verification status
    const spfVerified = verificationResults.some(
      record => record.record_type === 'TXT' && record.record_name.includes('_domainkey') && record.verified
    );
    
    const dkimVerified = verificationResults.some(
      record => record.record_type === 'CNAME' && record.record_name.includes('domainkey') && record.verified
    );
    
    const dmarcVerified = verificationResults.some(
      record => record.record_type === 'CNAME' && record.record_name === 'mail' && record.verified
    );
    
    // Collect error messages
    const errorMessages = verificationResults
      .filter(record => !record.verified && record.error)
      .map(record => `${record.record_type} ${record.record_name}: ${record.error}`);
    
    const verificationStatus = allVerified ? 'verified' : 'failed';
    
    // Update custom email settings
    await supabase
      .from('custom_email_settings')
      .update({ 
        verified: allVerified,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        dmarc_verified: dmarcVerified,
        verification_status: verificationStatus,
        verification_messages: errorMessages.length > 0 ? errorMessages : null
      })
      .eq('id', customEmailSettingId);
    
    // Get updated records for response
    const { data: updatedRecords } = await supabase
      .from('dns_verification_records')
      .select('*')
      .eq('custom_email_setting_id', customEmailSettingId);
    
    // Get updated settings for response
    const { data: updatedSettings } = await supabase
      .from('custom_email_settings')
      .select('*')
      .eq('id', customEmailSettingId)
      .single();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        verified: allVerified,
        status: verificationStatus,
        settings: updatedSettings,
        dnsRecords: updatedRecords
      })
    };
  } catch (error: any) {
    console.error('Error verifying DNS records:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to verify DNS records', details: error.message })
    };
  }
};

async function verifyDNSRecord(record: any, domain: string): Promise<{ verified: boolean; error?: string }> {
  try {
    if (record.record_type === 'TXT') {
      return await verifyTXTRecord(
        domain,
        record.record_name,
        record.record_value
      );
    } 
    else if (record.record_type === 'CNAME') {
      const normalizedExpectedValue = record.record_value.toLowerCase().replace(/\.$/, '');
      
      return await verifyCNAMERecord(
        domain,
        record.record_name,
        normalizedExpectedValue
      );
    }
    
    return {
      verified: false,
      error: `Unsupported record type: ${record.record_type}`
    };
  } catch (error: any) {
    console.error(`Error verifying DNS record for ${record.record_name}.${domain}:`, error);
    return {
      verified: false,
      error: `Verification error: ${error.message}`
    };
  }
} 