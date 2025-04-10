import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Final version with enhanced error checking and binary validation
serve(async (req) => {
  // Parse URL first thing
  const url = new URL(req.url)
  
  // Set up CORS headers - Force JSON for certain paths
  let forceJsonOutput = false
  
  // Check for debug indicators across multiple places
  const debugParam = url.searchParams.get('debug')
  const hasDebugParam = debugParam === 'true' || debugParam === ''
  const hasTestHeader = req.headers.get('x-test-mode') === 'true'
  const pathContainsDebug = url.pathname.includes('/debug/') || url.pathname.endsWith('/debug')
  
  // Consolidated debug check
  forceJsonOutput = hasDebugParam || hasTestHeader || pathContainsDebug
  
  // Set Content-Type based on debug mode
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': forceJsonOutput ? 'application/json' : 'application/octet-stream' // Default to binary
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'text/plain'
    }})
  }

  // Log request details
  console.log('------- REQUEST INFO -------')
  console.log('Full URL:', req.url)
  console.log('Path:', url.pathname)
  console.log('Search params:', url.search)
  console.log('Debug param:', debugParam)
  console.log('Force JSON:', forceJsonOutput)
  console.log('Headers:', JSON.stringify(Object.fromEntries([...req.headers.entries()])))
  
  try {
    // First try to get from path parameter
    let imagePath = url.searchParams.get('path')
    console.log('Path parameter:', imagePath)
    
    // If not found in query params, extract from URL path
    if (!imagePath) {
      // Assuming format: /feedback-images/[path-to-image]
      const pathParts = url.pathname.split('/feedback-images/')
      
      if (pathParts.length > 1 && pathParts[1]) {
        // Remove any query parameters if present in the path
        let extractedPath = pathParts[1]
        if (extractedPath.includes('?')) {
          extractedPath = extractedPath.split('?')[0]
        }
        
        // Remove any debug indicators from the path
        if (extractedPath.includes('/debug')) {
          extractedPath = extractedPath.replace('/debug', '')
        }
        
        imagePath = decodeURIComponent(extractedPath)
        console.log('Extracted path from URL:', imagePath)
      } else {
        // For direct test URL only - use the correct full path
        const testPath = '4hNUB7DVhf/1744271467946-Screenshot 2025-04-09 at 19.42.18.png'
        console.log('Using test path for direct testing')
        imagePath = testPath
      }
    } else {
      // Make sure the path is properly decoded
      imagePath = decodeURIComponent(imagePath)
    }
    
    console.log('Final image path:', imagePath)
    
    // If no path found, return error
    if (!imagePath) {
      return new Response(JSON.stringify({
        error: 'Image path not provided',
        status: 'error',
        debug: forceJsonOutput
      }), { 
        status: 400,
        headers 
      })
    }
    
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    // First check if the file exists
    console.log('Checking if file exists:', imagePath)
    try {
      const { data: fileData, error: fileError } = await supabase.storage
        .from('feedback-images')
        .list(imagePath.split('/').slice(0, -1).join('/'), {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        })
      
      const fileName = imagePath.split('/').pop()
      const fileExists = fileData?.some(file => file.name === fileName)
      
      console.log('File check result:', { fileExists, fileName, filesInFolder: fileData?.map(f => f.name) })
      
      if (!fileExists) {
        return new Response(JSON.stringify({
          error: 'File not found in bucket',
          path: imagePath,
          fileName,
          availableFiles: fileData?.map(f => f.name) || [],
          status: 'error'
        }), { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
          }
        })
      }
    } catch (listErr) {
      console.warn('Error listing files, continuing anyway:', listErr)
    }
    
    // Generate signed URL for debugging
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('feedback-images')
      .createSignedUrl(imagePath, 3600)
    
    if (signedUrlError) {
      console.error('Error generating signed URL:', signedUrlError)
      return new Response(JSON.stringify({
        error: signedUrlError.message,
        path: imagePath,
        details: signedUrlError,
        status: 'error',
        debug: true
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        }
      })
    }
    
    // For JSON output mode, return URL info
    if (forceJsonOutput) {
      console.log('DEBUG MODE: Returning JSON response with URL info')
      
      return new Response(JSON.stringify({
        url: signedUrlData?.signedUrl,
        path: imagePath,
        status: 'success',
        debug: true,
        message: 'Debug mode active, returning JSON instead of binary data',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        }
      })
    }
    
    // Use the signed URL directly instead of binary fetch and validate it
    console.log('Using direct signed URL for image:', signedUrlData?.signedUrl)
    
    try {
      // Fetch the image directly to validate it
      const imageResponse = await fetch(signedUrlData?.signedUrl || '')
      
      if (!imageResponse.ok) {
        console.error('Error fetching image:', imageResponse.status, imageResponse.statusText)
        return new Response(JSON.stringify({
          error: `Error fetching image: ${imageResponse.status} ${imageResponse.statusText}`,
          path: imagePath,
          status: 'error'
        }), { 
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // Get the image data as an ArrayBuffer
      const imageData = await imageResponse.arrayBuffer()
      
      // Validate the first bytes of the image to ensure it's actually a PNG
      const fileExt = imagePath.split('.').pop()?.toLowerCase()
      const imageBytes = new Uint8Array(imageData.slice(0, 8))
      
      // Validate image file signature
      let isValid = false
      let contentType = 'application/octet-stream'
      
      if (fileExt === 'png') {
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        isValid = imageBytes.every((byte, i) => byte === pngSignature[i])
        contentType = 'image/png'
      } else if (fileExt === 'jpg' || fileExt === 'jpeg') {
        // JPEG signature: FF D8 FF
        isValid = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8 && imageBytes[2] === 0xFF
        contentType = 'image/jpeg'
      } else if (fileExt === 'gif') {
        // GIF signature: 47 49 46 38
        isValid = imageBytes[0] === 0x47 && imageBytes[1] === 0x49 && 
                 imageBytes[2] === 0x46 && imageBytes[3] === 0x38
        contentType = 'image/gif'
      } else if (fileExt === 'webp') {
        // Simplified WEBP check
        contentType = 'image/webp'
        isValid = true // For WEBP we'll just assume it's valid
      }
      
      console.log('Image validation:', { 
        isValid, 
        fileExt,
        bytesHex: Array.from(imageBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
      })
      
      // If the file isn't a valid image, return diagnostic info
      if (!isValid) {
        // Get the first 100 bytes as hex for debugging
        const firstBytes = new Uint8Array(imageData.slice(0, 100))
        const bytesHex = Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
        const bytesText = new TextDecoder().decode(firstBytes).replace(/[^\x20-\x7E]/g, '.')
        
        return new Response(JSON.stringify({
          error: 'Invalid image file format',
          path: imagePath,
          bytesHex,
          bytesText,
          contentType: imageResponse.headers.get('content-type'),
          status: 'error'
        }), { 
          status: 415,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      // Return the validated image with proper content type
      return new Response(imageData, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (imageError) {
      console.error('Error processing image:', imageError)
      
      // Fallback to redirect using the signed URL
      return new Response(null, {
        status: 302,
        headers: {
          'Location': signedUrlData?.signedUrl || '',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack,
      status: 'error'
    }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json'
      }
    })
  }
}) 