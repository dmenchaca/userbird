export type FeedbackState = 'normal' | 'submitting' | 'success' | 'error';

export type SubmissionStatus = 'idle' | 'pending' | 'completed' | 'failed';

export interface FeedbackSubmission {
  formId: string;
  message: string;
}

export interface FeedbackContext {
  state: FeedbackState;
  submissionStatus: SubmissionStatus;
  message: string;
  error?: string;
}

export interface FeedbackError {
  message: string;
  code?: string;
}

export interface FeedbackResponse {
  success: boolean;
  error?: FeedbackError;
}