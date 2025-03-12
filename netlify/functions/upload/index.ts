import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import busboy from 'busboy';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

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

        // Validate file type
        if (!ALLOWED_TYPES.includes(info.mimeType)) {
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
          return resolve({
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields' })
          });
        }

        try {
          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from('feedback-images')
            .upload(
              `${formId}/${Date.now()}-${fileName}`,
              fileBuffer,
              {
                contentType: fileType,
                cacheControl: '3600'
              }
            );

          if (error) throw error;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('feedback-images')
            .getPublicUrl(data.path);

          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({
              url: publicUrl,
              name: fileName,
              size: fileBuffer.length
            })
          });
        } catch (error) {
          console.error('Upload error:', error);
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