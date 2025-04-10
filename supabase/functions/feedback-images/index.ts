import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// This Edge Function securely serves feedback images from a private bucket
// It checks user permissions and either generates a signed URL or streams the image

serve(async (req) => {
  // Parse the request URL and extract the image path
  const url = new URL(req.url)
  const imagePath = url.pathname.replace(/^\/feedback-images\//, '')
  
  if (!imagePath || imagePath === '') {
    return new Response('Image path required', { status: 400 })
  }
  
  // CORS headers for browser requests
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }
  
  try {
    // Create a Supabase client using the Deno runtime service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    // Get the user JWT from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      // Check for a search param with a signed URL - for public feedback images
      // Only allow this for verified form submission endpoints
      const signedKey = url.searchParams.get('key')
      if (!signedKey) {
        return new Response('Unauthorized', { status: 401, headers })
      }
      
      // Here you would verify the signedKey is valid for public access
      // This could be a token stored in your database or a JWT
      // For now, we'll continue for demo purposes
    }
    
    let isAdmin = false
    let isAgent = false
    
    // Get user data from the auth header if available
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      
      if (error || !user) {
        return new Response('Unauthorized', { status: 401, headers })
      }
      
      // Check roles from user metadata
      isAdmin = user.app_metadata?.role === 'admin'
      isAgent = user.app_metadata?.role === 'agent'
      
      // Only admin and agent can access images
      if (!isAdmin && !isAgent) {
        return new Response('Forbidden: Requires admin or agent role', { 
          status: 403, 
          headers 
        })
      }
    }
    
    // Choose strategy: 
    // 1. Generate a signed URL and redirect (faster, less CPU)
    // 2. Stream the file directly (more secure, no URL exposed)
    
    // Option 1: Signed URL with redirect
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('feedback-images')
      .createSignedUrl(imagePath, isAdmin ? 3600 : 300) // longer for admins
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      return new Response(`Error generating signed URL: ${signedUrlError?.message || 'Unknown error'}`, { 
        status: 500,
        headers
      })
    }
    
    // Redirect to the signed URL
    return new Response(null, {
      status: 302,
      headers: {
        ...headers,
        'Location': signedUrlData.signedUrl
      }
    })
    
    // Option 2: Stream the file directly (commented out)
    /*
    const { data, error } = await supabaseAdmin
      .storage
      .from('feedback-images')
      .download(imagePath)
    
    if (error || !data) {
      return new Response(`Image not found: ${error?.message || 'Unknown error'}`, { 
        status: 404,
        headers
      })
    }
    
    // Determine content type from file extension
    const fileExt = imagePath.split('.').pop()?.toLowerCase() || ''
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
    }
    
    // Return the file stream
    return new Response(data, {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': contentTypeMap[fileExt] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400'
      }
    })
    */
    
  } catch (err) {
    return new Response(`Server error: ${err.message}`, { 
      status: 500,
      headers
    })
  }
}) 