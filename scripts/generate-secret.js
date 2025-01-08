import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');
console.log('Generated NETLIFY_EMAILS_SECRET:');
console.log(secret);