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
  
  // If the path is already a full URL, extract just the path portion after the bucket name
  if (imagePath.includes('feedback-images')) {
    const parts = imagePath.split('feedback-images/');
    if (parts.length > 1) {
      imagePath = parts[1];
    }
  }
  
  // If the imagePath is already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Extract the base URL if it's already in the path
  if (imagePath.includes('functions/v1/feedback-images')) {
    return imagePath;
  }
  
  // Return the Edge Function URL
  const baseUrl = imagePath.includes('supabase.co') 
    ? imagePath.split('/functions/')[0]
    : supabaseUrl;
    
  return `${baseUrl}/functions/v1/feedback-images/${imagePath}`;
} 