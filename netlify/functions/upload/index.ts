import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import busboy from 'busboy';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Log environment configuration
console.log('Upload function configuration:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseKey,
  maxFileSize: MAX_FILE_SIZE,
  allowedTypes: ALLOWED_TYPES
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

function sanitizeFilename(filename: string): string {
  // Only keep alphanumeric characters, dots, hyphens, underscores and spaces
  // First remove any characters that aren't in our whitelist
  let sanitized = filename.replace(/[^a-zA-Z0-9_\s.-]/g, '');
  
  // Also trim excessive whitespace and ensure we have a non-empty filename
  sanitized = sanitized.trim();
  
  // If after sanitization we have an empty string, provide a default name
  return sanitized || 'file';
}

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

export const handler: Handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  // Handle preflight
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

  if (!event.body) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No file provided' })
    };
  }

  try {
    return new Promise((resolve, reject) => {
      const bb = busboy({ headers: event.headers });
      let formId: string;
      let fileBuffer: Buffer;
      let fileName: string;
      let fileType: string;

      bb.on('field', (name, val) => {
        if (name === 'formId') formId = val;
      });

      bb.on('file', (name, file, info) => {
        const chunks: Buffer[] = [];
        let size = 0;
        
        console.log('Processing file:', {
          filename: info.filename,
          mimeType: info.mimeType,
          encoding: info.encoding
        });

        // Validate file type
        if (!ALLOWED_TYPES.includes(info.mimeType)) {
          console.warn('Invalid file type:', {
            received: info.mimeType,
            allowed: ALLOWED_TYPES
          });
          return reject({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid file type' })
          });
        }

        fileName = info.filename;
        fileType = info.mimeType;

        file.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_FILE_SIZE) {
            console.warn('File size exceeded:', {
              size,
              maxSize: MAX_FILE_SIZE,
              filename: fileName
            });
            return reject({
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'File too large' })
            });
          }
          chunks.push(chunk);
        });

        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      bb.on('finish', async () => {
        if (!formId || !fileBuffer) {
          console.warn('Missing required fields:', {
            hasFormId: !!formId,
            hasFileBuffer: !!fileBuffer
          });
          return resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields' })
          });
        }

        try {
          console.log('Starting upload to Supabase:', {
            formId,
            fileName,
            fileSize: fileBuffer.length
          });

          // Upload to Supabase Storage
          const sanitizedFileName = sanitizeFilename(fileName);
          const { data, error } = await supabase.storage
            .from('feedback-images')
            .upload(
              `${formId}/${Date.now()}-${sanitizedFileName}`,
              fileBuffer,
              {
                contentType: fileType,
                cacheControl: '3600'
              }
            );

          if (error) {
            console.error('Supabase upload error:', {
              error,
              formId,
              fileName
            });
            throw error;
          }

          console.log('Upload successful:', {
            path: data.path,
            formId
          });

          // Use Edge Function URL instead of public URL
          const supabaseUrl = process.env.SUPABASE_URL;
          const imagePath = data.path;
          const secureUrl = `${supabaseUrl}/functions/v1/feedback-images/${imagePath}`;

          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({
              url: secureUrl,
              name: fileName,
              size: fileBuffer.length
            })
          });
        } catch (error) {
          console.error('Upload error:', error);
          console.error('Upload error:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            type: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined
          });
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to upload file' })
          });
        }
      });

      bb.end(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
    });
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};