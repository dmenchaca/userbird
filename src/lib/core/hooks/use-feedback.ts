import { useState, useEffect } from 'react';
import { FeedbackService } from '../feedback-service';
import { FeedbackState } from '../types';

export function useFeedback() {
  const [state, setState] = useState<FeedbackState>('normal');
  const feedbackService = FeedbackService.getInstance();

  useEffect(() => {
    const unsubscribe = feedbackService.subscribe(setState);
    return () => unsubscribe();
  }, []);

  return {
    state,
    submitFeedback: feedbackService.submitFeedback.bind(feedbackService),
    reset: feedbackService.reset.bind(feedbackService)
  };
}