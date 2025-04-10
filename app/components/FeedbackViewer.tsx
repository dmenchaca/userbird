import React from 'react';
import { FeedbackImage } from './FeedbackImage';

interface FeedbackViewerProps {
  formId: string;
  feedbackId: string;
  images: {
    id: string;
    path: string;
    createdAt: string;
  }[];
}

export const FeedbackViewer: React.FC<FeedbackViewerProps> = ({
  formId,
  feedbackId,
  images
}) => {
  if (!images || images.length === 0) {
    return <div className="text-gray-500 text-sm italic">No screenshots attached</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Screenshots</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {images.map((image) => (
          <div key={image.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Use our secure authenticated image component */}
            <FeedbackImage 
              imagePath={`${formId}/${image.path}`} 
              alt={`Screenshot taken on ${new Date(image.createdAt).toLocaleString()}`}
              className="w-full h-auto object-contain"
            />
            <div className="p-2 text-xs text-gray-500">
              {new Date(image.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackViewer; 