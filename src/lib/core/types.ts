export type FeedbackState = 'normal' | 'success' | 'error';

export interface FeedbackSubmission {
  formId: string;
  message: string;
}

export interface FeedbackError {
  message: string;
  code?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: FeedbackError;
}