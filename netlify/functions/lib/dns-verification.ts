import { generateKeyPairSync } from 'crypto';
import * as dns from 'dns/promises';

/**
 * Generates a new DKIM key pair
 * @returns Object containing public and private keys
 */
export function generateDKIMKeyPair() {
  // Generate RSA key pair (2048 bits)
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Format the public key for DNS records
  // Extract the base64 part of the public key and remove line breaks
  const publicKeyBase64 = publicKey
    .toString()
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '')
    .trim();

  return {
    publicKey: publicKeyBase64,
    privateKey: privateKey.toString(),
    dnsPublicKey: `k=rsa; p=${publicKeyBase64}`
  };
}

/**
 * Generates a unique DKIM selector
 */
export function generateDKIMSelector(prefix = 'userbird'): string {
  const timestamp = new Date().getTime().toString().slice(0, 10);
  return `${prefix}${timestamp}`;
}

/**
 * Verifies a TXT DNS record
 * @param domain Domain to check
 * @param recordName Full record name (e.g., "selector._domainkey")
 * @param expectedValueContains Text the TXT record should contain
 */
export async function verifyTXTRecord(
  domain: string,
  recordName: string,
  expectedValueContains: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const fqdn = `${recordName}.${domain}`;
    console.log(`Verifying TXT for ${fqdn}, expecting to contain: ${expectedValueContains}`);
    const txtRecords = await dns.resolveTxt(fqdn);
    
    // Normalize expected value
    const normalizedExpected = expectedValueContains.toLowerCase().replace(/\s+/g, '');
    
    // TXT records are returned as arrays of strings
    const verified = txtRecords.some(txtRecord => {
      const fullTxtRecord = txtRecord.join('').toLowerCase().replace(/\s+/g, ''); // Join chunks if split and normalize
      console.log(`Comparing TXT: DNS returned "${fullTxtRecord.substring(0, 50)}..." vs expected "${normalizedExpected.substring(0, 50)}..."`);
      return fullTxtRecord.includes(normalizedExpected);
    });

    return {
      verified,
      error: verified ? undefined : 'TXT record does not contain expected value'
    };
  } catch (error: any) {
    return {
      verified: false,
      error: `DNS lookup error: ${error.message}`
    };
  }
}

/**
 * Verifies a CNAME DNS record
 * @param domain Domain to check
 * @param recordName Record name (without the domain)
 * @param expectedValue Expected CNAME value
 */
export async function verifyCNAMERecord(
  domain: string,
  recordName: string,
  expectedValue: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const fqdn = `${recordName}.${domain}`;
    console.log(`Verifying CNAME for ${fqdn}, expecting ${expectedValue}`);
    const cnameRecords = await dns.resolveCname(fqdn);
    
    // Normalize expected value (remove trailing dot if present)
    const normalizedExpectedValue = expectedValue.toLowerCase().replace(/\.$/, '');
    
    // Check if any of the CNAME records match (normalize by removing trailing dots)
    const verified = cnameRecords.some(cname => {
      const normalizedCname = cname.toLowerCase().replace(/\.$/, '');
      console.log(`Comparing CNAME: DNS returned "${normalizedCname}" vs expected "${normalizedExpectedValue}"`);
      return normalizedCname === normalizedExpectedValue;
    });

    return {
      verified,
      error: verified ? undefined : 'CNAME record does not point to expected value'
    };
  } catch (error: any) {
    return {
      verified: false,
      error: `DNS lookup error: ${error.message}`
    };
  }
}

/**
 * Generates all DNS records needed for domain verification
 */
export function generateDNSRecords(settings: {
  id: string;
  domain: string;
}) {
  const { id, domain } = settings;
  
  // Generate DKIM keys and selector
  const dkimKeys = generateDKIMKeyPair();
  const dkimSelector = generateDKIMSelector();
  
  return {
    dkimPrivateKey: dkimKeys.privateKey,
    dkimSelector,
    records: [
      {
        custom_email_setting_id: id,
        record_type: 'TXT',
        record_name: `${dkimSelector}._domainkey`,
        record_value: dkimKeys.dnsPublicKey,
        dkim_selector: dkimSelector,
        dkim_private_key: dkimKeys.privateKey
      },
      {
        custom_email_setting_id: id,
        record_type: 'CNAME',
        record_name: `userbird.domainkey`,
        record_value: `userbird.domainkey.userbird-mail.com.`
      },
      {
        custom_email_setting_id: id,
        record_type: 'CNAME',
        record_name: 'mail',
        record_value: 'userbird-mail.com.'
      }
    ]
  };
} 