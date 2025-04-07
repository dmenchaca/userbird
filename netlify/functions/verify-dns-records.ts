import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns';
import { promisify } from 'util';

// Promisify DNS lookup functions
const resolveTxt = promisify(dns.resolveTxt);
const resolveMx = promisify(dns.resolveMx);
const resolveNs = promisify(dns.resolveNs);

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks if a domain has proper DNS configuration
 */
async function verifyDomainDns(domain: string): Promise<{ 
  spf: boolean, 
  dkim: boolean, 
  mx: boolean,
  details: Record<string, any> 
}> {
  const details: Record<string, any> = {};
  
  try {
    // Check SPF record
    const txtRecords = await resolveTxt(domain);
    const spfRecords = txtRecords.filter(record => 
      record.some(part => part.startsWith('v=spf1'))
    );
    
    const hasSpf = spfRecords.length > 0;
    const includesSendgrid = spfRecords.some(record => 
      record.some(part => part.includes('include:sendgrid.net'))
    );
    
    details.spf = {
      found: hasSpf,
      includesSendgrid,
      records: spfRecords
    };
    
    // Check DKIM record
    const dkimSelector = 's1._domainkey';
    let hasDkim = false;
    try {
      const dkimRecords = await resolveTxt(`${dkimSelector}.${domain}`);
      hasDkim = dkimRecords.some(record => 
        record.some(part => part.startsWith('v=DKIM1'))
      );
      
      details.dkim = {
        found: hasDkim,
        records: dkimRecords
      };
    } catch (error) {
      details.dkim = {
        found: false,
        error: 'DKIM record not found'
      };
    }
    
    // Check MX records
    let hasMxSetup = false;
    try {
      const mxRecords = await resolveMx(domain);
      const sendgridMx = mxRecords.some(mx => 
        mx.exchange.includes('mx.sendgrid.net')
      );
      
      hasMxSetup = sendgridMx;
      details.mx = {
        found: mxRecords.length > 0,
        hasSendgrid: sendgridMx,
        records: mxRecords
      };
    } catch (error) {
      details.mx = {
        found: false,
        error: 'MX records not found'
      };
    }
    
    return {
      spf: hasSpf && includesSendgrid,
      dkim: hasDkim,
      mx: hasMxSetup,
      details
    };
  } catch (error) {
    console.error(`Error verifying DNS for domain ${domain}:`, error);
    return {
      spf: false,
      dkim: false,
      mx: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  try {
    // Parse request body
    const { domain, customEmailSettingId } = JSON.parse(event.body || '{}');
    
    if (!domain) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Domain is required' }) 
      };
    }
    
    console.log(`Verifying DNS records for domain: ${domain}`);
    
    // Verify domain DNS setup
    const verificationResult = await verifyDomainDns(domain);
    
    console.log('DNS verification result:', verificationResult);
    
    // If a customEmailSettingId was provided, update the verification status
    if (customEmailSettingId) {
      const updateData: Record<string, boolean> = {
        spf_verified: verificationResult.spf,
        dkim_verified: verificationResult.dkim,
        mx_verified: verificationResult.mx,
      };
      
      // All verified = domain is fully verified
      const allVerified = verificationResult.spf && verificationResult.dkim && verificationResult.mx;
      
      if (allVerified) {
        updateData.verified = true;
      }
      
      const { error: updateError } = await supabase
        .from('custom_email_settings')
        .update(updateData)
        .eq('id', customEmailSettingId);
      
      if (updateError) {
        console.error('Error updating verification status:', updateError);
      } else {
        console.log(`Updated verification status for custom email setting ${customEmailSettingId}`);
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        domain,
        verified: verificationResult.spf && verificationResult.dkim && verificationResult.mx,
        ...verificationResult
      })
    };
  } catch (error) {
    console.error('Error in verify-dns-records handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Error verifying DNS records',
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
    };
  }
}; 