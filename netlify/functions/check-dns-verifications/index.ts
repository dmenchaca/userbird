import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyTXTRecord, verifyCNAMERecord } from '../lib/dns-verification';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!; // Use service role key for background tasks
const supabase = createClient(supabaseUrl, supabaseKey);

// Run this function every 6 hours to check for DNS verification status
// The handler is triggered by a scheduled event
export const handler: Handler = schedule('0 */6 * * *', async () => {
  console.log('Starting scheduled DNS verification checks...');
  
  try {
    // Get all unverified custom email settings
    const { data: unverifiedSettings, error: settingsError } = await supabase
      .from('custom_email_settings')
      .select('id, domain')
      .in('verification_status', ['unverified', 'pending', 'failed'])
      .order('last_verification_attempt', { ascending: true })
      .limit(50); // Process in batches
    
    if (settingsError) throw settingsError;
    
    if (!unverifiedSettings || unverifiedSettings.length === 0) {
      console.log('No unverified email settings found.');
      return { statusCode: 200 };
    }
    
    console.log(`Found ${unverifiedSettings.length} unverified email settings to check.`);
    
    // Check each unverified setting
    for (const setting of unverifiedSettings) {
      try {
        await checkAndUpdateVerification(setting.id, setting.domain);
      } catch (error) {
        console.error(`Error checking verification for setting ${setting.id}:`, error);
        // Continue with next setting
      }
    }
    
    return { statusCode: 200 };
  } catch (error) {
    console.error('Error during DNS verification checks:', error);
    return { statusCode: 500 };
  }
});

async function checkAndUpdateVerification(settingId: string, domain: string) {
  console.log(`Checking verification for domain: ${domain}`);
  
  // Update verification attempt time
  await supabase
    .from('custom_email_settings')
    .update({ 
      verification_status: 'pending',
      last_verification_attempt: new Date().toISOString()
    })
    .eq('id', settingId);
  
  // Get DNS records for this setting
  const { data: dnsRecords, error: dnsError } = await supabase
    .from('dns_verification_records')
    .select('*')
    .eq('custom_email_setting_id', settingId);
  
  if (dnsError) throw dnsError;
  
  if (!dnsRecords || dnsRecords.length === 0) {
    console.log(`No DNS records found for setting ${settingId}`);
    return;
  }
  
  // Verify each DNS record
  const verificationResults = await Promise.all(
    dnsRecords.map(async record => {
      const result = await verifyDNSRecord(record, domain);
      
      // Update record verification status
      await supabase
        .from('dns_verification_records')
        .update({ 
          verified: result.verified,
          last_check_time: new Date().toISOString(),
          failure_reason: result.error || null
        })
        .eq('id', record.id);
      
      if (result.verified) {
        console.log(`Record ${record.record_type} ${record.record_name}.${domain} verified!`);
      } else {
        console.log(`Record ${record.record_type} ${record.record_name}.${domain} not verified: ${result.error}`);
      }
      
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
    .eq('id', settingId);
  
  if (allVerified) {
    console.log(`All DNS records verified for domain ${domain}! Setting marked as verified.`);
    
    // TODO: Send notification to the user that their domain is verified
  } else {
    console.log(`Some DNS records not verified for domain ${domain}. Status set to failed.`);
  }
}

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
      return await verifyCNAMERecord(
        domain,
        record.record_name,
        record.record_value
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