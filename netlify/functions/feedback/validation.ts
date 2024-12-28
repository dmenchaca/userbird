export function isValidOrigin(origin: string, storedUrl: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originDomain = originUrl.hostname;
    const originPort = originUrl.port;

    // Handle localhost
    if (originDomain === 'localhost') {
      const expectedUrl = originPort ? `localhost:${originPort}` : 'localhost';
      return storedUrl.toLowerCase() === expectedUrl;
    }

    // Handle regular domains
    return originDomain === storedUrl.toLowerCase();
  } catch {
    return false;
  }
}