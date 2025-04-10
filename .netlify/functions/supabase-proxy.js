const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  try {
    // Log the request details (for debugging)
    console.log('Request path:', event.path);
    console.log('Request query:', event.queryStringParameters);
    console.log('Request method:', event.httpMethod);
    
    // Extract the path from the request
    const path = event.path.replace('/.netlify/functions/supabase-proxy', '');
    const queryString = new URLSearchParams(event.queryStringParameters || {}).toString();
    const fullPath = `${path}${queryString ? '?' + queryString : ''}`;
    
    console.log('Proxying to Supabase path:', fullPath);
    
    // Create Supabase client with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Missing Supabase credentials',
          debug: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey
          }
        })
      };
    }
    
    // Check for debug mode
    const isDebugMode = event.queryStringParameters?.debug === 'true' || 
                         event.headers['x-test-mode'] === 'true';
    
    // Extract the image path from the request
    let imagePath = event.queryStringParameters?.path;
    
    // If not in query params, extract from path
    if (!imagePath && path.includes('/feedback-images/')) {
      const pathParts = path.split('/feedback-images/');
      if (pathParts.length > 1 && pathParts[1]) {
        imagePath = decodeURIComponent(pathParts[1]);
      }
    }
    
    if (!imagePath) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Image path not provided' })
      };
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
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
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: signedUrlError.message,
          path: imagePath
        })
      };
    }
    
    if (!signedUrlData?.signedUrl) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'File not found or URL generation failed',
          path: imagePath
        })
      };
    }
    
    // If in debug mode, return JSON with the signed URL
    if (isDebugMode) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify({
          url: signedUrlData.signedUrl,
          path: imagePath,
          status: 'success',
          debug: true,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Otherwise, fetch the image and return it directly
    try {
      const response = await fetch(signedUrlData.signedUrl);
      
      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({
            error: `Error fetching image: ${response.status} ${response.statusText}`,
            path: imagePath
          })
        };
      }
      
      const contentType = response.headers.get('Content-Type') || 
                         getContentTypeFromPath(imagePath);
      const imageBuffer = await response.arrayBuffer();
      
      // Return the image with proper headers
      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        },
        body: Buffer.from(imageBuffer).toString('base64'),
        isBase64Encoded: true
      };
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError);
      
      // Fallback to redirect
      return {
        statusCode: 302,
        headers: {
          'Location': signedUrlData.signedUrl,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// Helper function to determine content type from file path
function getContentTypeFromPath(path) {
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