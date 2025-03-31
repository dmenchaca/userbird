export function isValidOrigin(origin: string, storedUrl: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originHostname = originUrl.hostname;
    const originPort = originUrl.port;

    // Handle localhost and development URLs
    if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
      // For localhost, compare with port if present
      const expectedUrl = originPort 
        ? `${originHostname}:${originPort}`
        : originHostname;
      return storedUrl.toLowerCase() === expectedUrl.toLowerCase();
    }

    // For development URLs (e.g., stackblitz.io)
    if (originHostname.includes('stackblitz.io')) {
      return true; // Allow all stackblitz.io subdomains for development
    }

    // Handle regular domains - compare only the hostname
    const storedDomain = storedUrl.split(':')[0].toLowerCase(); // Remove port if present
    
    // Handle www vs non-www domains
    const normalizedOriginHostname = originHostname.toLowerCase();
    const normalizedStoredDomain = storedDomain.toLowerCase();
    
    // Direct match
    if (normalizedOriginHostname === normalizedStoredDomain) {
      return true;
    }
    
    // www variant: if origin has www but stored doesn't
    if (normalizedOriginHostname.startsWith('www.') && 
        normalizedOriginHostname.substring(4) === normalizedStoredDomain) {
      return true;
    }
    
    // www variant: if stored has www but origin doesn't
    if (normalizedStoredDomain.startsWith('www.') && 
        normalizedStoredDomain.substring(4) === normalizedOriginHostname) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Origin validation error:', error);
    return false;
  }
}