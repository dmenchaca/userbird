import { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
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

// Extract auth token from request headers
function getAuthToken(event: HandlerEvent): string | null {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return null;
  
  // Handle different auth header formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  return authHeader;
}

// Create type-safe headers
type HeadersType = {
  [key: string]: string | number | boolean;
}

// The handler function
const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  try {
    // Log the request details (for debugging)
    console.log('=================== REQUEST STARTED ===================');
    console.log('Request path:', event.path);
    console.log('Request query:', event.queryStringParameters);
    console.log('Request method:', event.httpMethod);
    console.log('Request headers:', {
      authorization: event.headers.authorization ? 'Present (not shown)' : 'Missing',
      referer: event.headers.referer,
      origin: event.headers.origin,
      'user-agent': event.headers['user-agent']
    });
    
    // Get the full path including query params for debugging
    const fullUrl = event.rawUrl || `${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
    console.log('Full request URL:', fullUrl);
    
    // Create Supabase client with service role key
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        envVars: Object.keys(process.env).filter(key => key.includes('SUPABASE') || key.includes('VITE')).join(', ')
      });
      
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
    
    // Check for path issues
    if (imagePath?.includes('/functions/v1/feedback-images/')) {
      console.warn('WARNING: Path contains duplicate prefix. Original path:', imagePath);
      // Try to fix duplicate paths
      const parts = imagePath.split('/functions/v1/feedback-images/');
      if (parts.length > 1) {
        const cleanedPath = parts[parts.length - 1];
        console.log('Cleaned duplicate path:', cleanedPath);
        imagePath = cleanedPath;
      }
    }
    
    if (!imagePath) {
      console.error('No image path could be extracted from the request');
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
    
    // AUTH CHECK: Get user authentication token
    const authToken = getAuthToken(event);
    console.log('Auth token present:', !!authToken);
    
    if (!authToken) {
      console.error('Authentication token missing from request');
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Authentication required',
          status: 'unauthorized'
        } as ErrorResponse)
      };
    }
    
    // Verify the auth token and get user
    console.log('Verifying auth token...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError || !user) {
      console.error('Auth token verification failed:', authError);
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: authError?.message || 'Invalid authentication token',
          details: authError,
          status: 'unauthorized'
        } as ErrorResponse)
      };
    }
    
    console.log('User authenticated:', { id: user.id, email: user.email });
    
    // Check permissions in form_collaborators table
    // Extract form ID from the image path (first part of the path)
    const formId = imagePath.split('/')[0];
    console.log('Form ID extracted from path:', formId);
    
    // If formId can't be extracted, reject the request
    if (!formId) {
      console.error('Could not extract form ID from path:', imagePath);
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid image path format, cannot determine form ID',
          status: 'error',
          imagePath
        } as ErrorResponse)
      };
    }
    
    // Query form_collaborators table to check permissions
    console.log('Checking user permissions for form:', formId);
    const { data: collaboration, error: permError } = await supabase
      .from('form_collaborators')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', user.id)
      .in('role', ['admin', 'agent'])
      .single();
    
    // If no collaboration found, also check if the user is the form owner
    if (permError || !collaboration) {
      console.log('No collaboration record found, checking if user is form owner...');
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('owner_id')
        .eq('id', formId)
        .single();
      
      if (formError || !formData || formData.owner_id !== user.id) {
        console.error('Permission check failed:', { 
          userId: user.id, 
          formId, 
          isOwner: formData ? formData.owner_id === user.id : false,
          permError,
          formError
        });
        
        const headers: HeadersType = {
          'Content-Type': 'application/json'
        };
        
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'You do not have permission to access this image',
            formId: formId,
            userId: user.id,
            details: permError || formError,
            status: 'forbidden'
          } as ErrorResponse)
        };
      }
      
      console.log('User is the form owner, access granted:', { userId: user.id, formId });
    } else {
      console.log('User authorized via collaboration record:', { userId: user.id, formId, role: collaboration.role });
    }
    
    // User is authenticated and authorized - generate a short-lived signed URL
    console.log('Generating signed URL for:', imagePath);
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('feedback-images')
      .createSignedUrl(imagePath, 60); // 60 seconds expiration
    
    if (signedUrlError) {
      console.error('Failed to generate signed URL:', signedUrlError);
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
      console.error('No signed URL was generated, file might not exist:', imagePath);
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
    
    console.log('Signed URL generated successfully');
    
    // If in debug mode, return JSON with the signed URL
    if (isDebugMode) {
      console.log('Debug mode enabled, returning URL info');
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
          user: {
            id: user.id,
            email: user.email,
            role: collaboration?.role || 'owner'
          },
          timestamp: new Date().toISOString()
        } as DebugResponse)
      };
    }
    
    // Otherwise, fetch the image and return it directly
    try {
      console.log('Fetching image from signed URL');
      const response = await fetch(signedUrlData.signedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*'
        }
      });
      
      if (!response.ok) {
        console.error('Error fetching image from Supabase:', { 
          status: response.status, 
          statusText: response.statusText 
        });
        
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
      
      console.log('Successfully fetched image, content-type:', contentType, 'size:', imageBuffer.byteLength);
      console.log('=================== REQUEST COMPLETED ===================');
      
      // Return the image with proper headers
      const headers: HeadersType = {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300', // shorter cache time for authenticated content
        'Vary': 'Authorization' // varies based on auth header to avoid cache leakage
      };
      
      return {
        statusCode: 200,
        headers,
        body: Buffer.from(imageBuffer).toString('base64'),
        isBase64Encoded: true
      };
    } catch (fetchError) {
      console.error('Error fetching image:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      // Fallback to redirect is not secure for authenticated content - don't use
      const headers: HeadersType = {
        'Content-Type': 'application/json'
      };
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to fetch image',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        } as ErrorResponse)
      };
    }
  } catch (error: any) {
    console.error('Function error:', error.message, error.stack);
    console.log('=================== REQUEST FAILED ===================');
    
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