import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as dns from 'dns/promises';
const { trackEvent, shutdownPostHog } = require('../lib/posthog');

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

export const handler: Handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
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
    const body = JSON.parse(event.body || '{}');
    const { settingsId } = body;
    
    if (!settingsId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Settings ID is required' })
      };
    }

    // Get custom email settings
    const { data: settings, error: settingsError } = await supabase
      .from('custom_email_settings')
      .select('*, forms!inner(owner_id)')
      .eq('id', settingsId)
      .single();

    if (settingsError || !settings) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Custom email settings not found' })
      };
    }

    // Check if user owns the form
    if (settings.forms.owner_id !== user.id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You do not have permission to access these settings' })
      };
    }

    // Get DNS records
    const { data: dnsRecords, error: dnsError } = await supabase
      .from('dns_verification_records')
      .select('*')
      .eq('custom_email_setting_id', settingsId);

    if (dnsError) throw dnsError;
    
    if (!dnsRecords || dnsRecords.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No DNS records found for verification' })
      };
    }

    // Verify each DNS record
    const verificationResults = await Promise.all(
      dnsRecords.map(async record => {
        const isVerified = await verifyDNSRecord(record, settings.domain);
        
        // Update record verification status
        if (isVerified) {
          await supabase
            .from('dns_verification_records')
            .update({ verified: true })
            .eq('id', record.id);
        }

        return {
          ...record,
          verified: isVerified
        };
      })
    );

    // Check if all required records are verified
    const allVerified = verificationResults.every(record => record.verified);
    
    // Update overall verification status
    if (allVerified) {
      const spfVerified = verificationResults.some(
        record => record.record_type === 'TXT' && record.record_name.includes('_domainkey') && record.verified
      );
      
      const dkimVerified = verificationResults.some(
        record => record.record_type === 'CNAME' && record.record_name.includes('domainkey') && record.verified
      );
      
      const dmarcVerified = verificationResults.some(
        record => record.record_type === 'CNAME' && record.record_name === 'mail' && record.verified
      );

      await supabase
        .from('custom_email_settings')
        .update({ 
          verified: allVerified,
          spf_verified: spfVerified,
          dkim_verified: dkimVerified,
          dmarc_verified: dmarcVerified 
        })
        .eq('id', settingsId);

      if (allVerified) {
        trackEvent('custom_email_verified', {
          form_id: settings.form_id,
          domain: settings.domain
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        records: verificationResults,
        allVerified 
      })
    };
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

async function verifyDNSRecord(record: any, domain: string): Promise<boolean> {
  try {
    const fqdn = `${record.record_name}.${domain}`;
    
    if (record.record_type === 'TXT') {
      try {
        const txtRecords = await dns.resolveTxt(fqdn);
        // TXT records are returned as arrays of strings
        return txtRecords.some(txtRecord => {
          const fullTxtRecord = txtRecord.join(''); // Join chunks if split
          return fullTxtRecord.includes(record.record_value);
        });
      } catch (e) {
        console.error(`TXT resolution error for ${fqdn}:`, e);
        return false;
      }
    } 
    else if (record.record_type === 'CNAME') {
      try {
        const cnameRecords = await dns.resolveCname(fqdn);
        const targetValue = record.record_value.toLowerCase();
        
        // Check if any of the CNAME records match
        return cnameRecords.some(cname => 
          cname.toLowerCase() === targetValue
        );
      } catch (e) {
        console.error(`CNAME resolution error for ${fqdn}:`, e);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error verifying DNS record for ${record.record_name}.${domain}:`, error);
    return false;
  }
} 