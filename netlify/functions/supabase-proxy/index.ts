import { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Types for function responses
interface ErrorResponse {
  error: string;
  path?: string;
  requestUrl?: string;
  details?: any;
  status?: string;
  stack?: string;
  debug?: {
    hasUrl?: boolean;
    hasKey?: boolean;
    envVars?: string;
  };
}

interface DebugResponse {
  url: string;
  path: string;
  status: string;
  debug: boolean;
  requestUrl?: string;
  timestamp: string;
}

// Helper function to determine content type from file path
function getContentTypeFromPath(path: string): string {
  const fileExt = path.split('.').pop()?.toLowerCase();
  
  switch (fileExt) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// Create type-safe headers
type HeadersType = {
  [key: string]: string | number | boolean;
}

// The handler function
const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  try {
    // Log the request details (for debugging)
    console.log('Request path:', event.path);
    console.log('Request query:', event.queryStringParameters);
    console.log('Request method:', event.httpMethod);
    
    // Get the full path including query params for debugging
    const fullUrl = event.rawUrl || `${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
    console.log('Full request URL:', fullUrl);
    
    // Create Supabase client with service role key
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Missing Supabase credentials',
          debug: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            envVars: Object.keys(process.env).filter(key => key.includes('SUPABASE') || key.includes('VITE')).join(', ')
          }
        } as ErrorResponse)
      };
    }
    
    // Check for debug mode
    const isDebugMode = event.queryStringParameters?.debug === 'true' || 
                       (event.headers['x-test-mode'] === 'true');
    
    // Extract image path from the URL
    // Format will be like: /.netlify/functions/supabase-proxy/feedback-images/user-id/file-name.jpg
    // OR: /.netlify/functions/supabase-proxy (with path in query param)
    let imagePath = event.queryStringParameters?.path;
    
    // If not in query params, extract from path
    if (!imagePath) {
      const pathPattern = /\/functions\/v1\/feedback-images\/(.*)/;
      const match = event.path.match(pathPattern) || fullUrl.match(pathPattern);
      
      if (match && match[1]) {
        imagePath = decodeURIComponent(match[1]);
      }
    }
    
    console.log('Extracted image path:', imagePath);
    
    if (!imagePath) {
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Image path not provided',
          requestPath: event.path,
          fullUrl: fullUrl
        } as ErrorResponse)
      };
    }
    
    // Initialize Supabase client
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // First generate a signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('feedback-images')
      .createSignedUrl(imagePath, 3600);
    
    if (signedUrlError) {
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: signedUrlError.message,
          path: imagePath,
          requestUrl: fullUrl,
          details: signedUrlError
        } as ErrorResponse)
      };
    }
    
    if (!signedUrlData?.signedUrl) {
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'File not found or URL generation failed',
          path: imagePath
        } as ErrorResponse)
      };
    }
    
    // If in debug mode, return JSON with the signed URL
    if (isDebugMode) {
      const headers: HeadersType = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          url: signedUrlData.signedUrl,
          path: imagePath,
          status: 'success',
          debug: true,
          requestUrl: fullUrl,
          timestamp: new Date().toISOString()
        } as DebugResponse)
      };
    }
    
    // Otherwise, fetch the image and return it directly
    try {
      console.log('Fetching image from:', signedUrlData.signedUrl);
      const response = await fetch(signedUrlData.signedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*'
        }
      });
      
      if (!response.ok) {
        const headers: HeadersType = {
          'Content-Type': 'application/json'
        };
        
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({
            error: `Error fetching image: ${response.status} ${response.statusText}`,
            path: imagePath
          } as ErrorResponse)
        };
      }
      
      const contentType = response.headers.get('Content-Type') || 
                         getContentTypeFromPath(imagePath);
      const imageBuffer = await response.arrayBuffer();
      
      console.log('Successfully fetched image, content-type:', contentType);
      
      // Return the image with proper headers
      const headers: HeadersType = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      };
      
      return {
        statusCode: 200,
        headers,
        body: Buffer.from(imageBuffer).toString('base64'),
        isBase64Encoded: true
      };
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError);
      
      // Fallback to redirect
      const headers: HeadersType = {
        'Location': signedUrlData.signedUrl,
        'Cache-Control': 'no-cache'
      };
      
      return {
        statusCode: 302,
        headers,
        body: ''
      };
    }
  } catch (error: any) {
    console.error('Function error:', error);
    
    const headers: HeadersType = {
      'Content-Type': 'application/json'
    };
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } as ErrorResponse)
    };
  }
};

export { handler }; 