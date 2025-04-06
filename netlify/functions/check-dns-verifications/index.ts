import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import * as dns from 'dns/promises';

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
      .eq('verified', false);
    
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
      const isVerified = await verifyDNSRecord(record, domain);
      
      // Update record verification status
      if (isVerified) {
        await supabase
          .from('dns_verification_records')
          .update({ verified: true })
          .eq('id', record.id);
        
        console.log(`Record ${record.record_type} ${record.record_name}.${domain} verified!`);
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
      .eq('id', settingId);
    
    console.log(`All DNS records verified for domain ${domain}! Setting marked as verified.`);
    
    // TODO: Send notification to the user that their domain is verified
  }
}

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