import React, { useState, useEffect } from 'react';
import { useSupabase } from '@/hooks/useSupabase';

interface FeedbackImageProps {
  imagePath: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}

export const FeedbackImage: React.FC<FeedbackImageProps> = ({
  imagePath,
  alt = 'Feedback image',
  className = '',
  width,
  height
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { supabase } = useSupabase();

  useEffect(() => {
    const loadImage = async () => {
      if (!imagePath) {
        setError('No image path provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Authentication required');
          setLoading(false);
          return;
        }

        // Create the authenticated image URL
        const imageUrl = `/functions/v1/feedback-images/${imagePath}`;
        
        // For debugging: test the URL first
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || `Failed to load image: ${response.status}`);
        }

        // Set the image URL with a cache-busting parameter to prevent browser caching
        // This ensures the auth header is always sent
        setImageUrl(`${imageUrl}?t=${Date.now()}`);
        setError(null);
      } catch (err) {
        console.error('Error loading feedback image:', err);
        setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imagePath, supabase.auth]);

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded" style={{ width: width || 200, height: height || 150 }} />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-2 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt}
          className={className}
          width={width}
          height={height}
          loading="lazy"
          fetchPriority="auto"
        />
      )}
    </>
  );
};

export default FeedbackImage; 