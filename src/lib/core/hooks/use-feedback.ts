import { useState, useEffect, useCallback } from 'react';
import { FeedbackService } from '../feedback-service';
import { FeedbackState, SubmissionStatus } from '../types';

export function useFeedback() {
  const [state, setState] = useState<FeedbackState>('normal');
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();
  
  const feedbackService = FeedbackService.getInstance();

  useEffect(() => {
    const unsubscribe = feedbackService.subscribe((serviceState) => {
      setState(serviceState.state);
      setSubmissionStatus(serviceState.submissionStatus);
      setMessage(serviceState.message);
      setError(serviceState.error);
    });
    return () => unsubscribe();
  }, []);

  const submit = useCallback(async (params) => {
    try {
      await feedbackService.submitFeedback(params);
      return true;
    } catch (error) {
      console.error('Feedback submission failed:', error);
      return false;
    }
  }, []);

  return {
    state,
    submissionStatus,
    message,
    error,
    submitFeedback: submit,
    reset: feedbackService.reset.bind(feedbackService)
  };
}