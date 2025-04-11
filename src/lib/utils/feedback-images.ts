/**
 * Utility for working with feedback images through the secure Edge Function
 */

// Get the Supabase URL from window environment or fallback to a global variable if available
const supabaseUrl = typeof window !== 'undefined' 
  ? window.location.origin 
  : (typeof globalThis !== 'undefined' && (globalThis as any).SUPABASE_URL) || '';

/**
 * Get a secure URL for a feedback image using the Edge Function
 * 
 * @param imagePath The path of the image in the feedback-images bucket
 * @returns A secure URL that routes through the Edge Function
 */
export function getFeedbackImageUrl(imagePath: string): string {
  if (!imagePath) return '';
  
  // Clean up the path to ensure no duplication
  let cleanPath = imagePath;
  
  // If the path already contains the functions prefix, extract just the image path part
  if (cleanPath.includes('/functions/v1/feedback-images/')) {
    const parts = cleanPath.split('/functions/v1/feedback-images/');
    if (parts.length > 1) {
      cleanPath = parts[parts.length - 1];
    }
  }
  
  // If the path contains the bucket name, extract just the path portion after it
  else if (cleanPath.includes('feedback-images/')) {
    const parts = cleanPath.split('feedback-images/');
    if (parts.length > 1) {
      cleanPath = parts[1];
    }
  }
  
  // If the imagePath is already a full URL, return it
  if (imagePath.startsWith('http') && !imagePath.includes('/functions/v1/feedback-images/')) {
    return imagePath;
  }
  
  // Extract the base URL if it's already in the path
  const baseUrl = imagePath.includes('supabase.co') 
    ? imagePath.split('/functions/')[0]
    : supabaseUrl;
    
  return `${baseUrl}/functions/v1/feedback-images/${cleanPath}`;
} 