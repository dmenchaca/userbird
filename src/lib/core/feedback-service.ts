import { FeedbackSubmission, FeedbackResponse, FeedbackState } from './types';
import { supabase } from '../supabase';

interface FeedbackServiceState {
  state: FeedbackState;
  submissionStatus: 'idle' | 'pending' | 'completed' | 'failed';
  message: string;
  error?: string;
}

export class FeedbackService {
  private static instance: FeedbackService;
  private state: FeedbackServiceState = {
    state: 'normal',
    submissionStatus: 'idle',
    message: ''
  };
  private listeners: Set<(state: FeedbackServiceState) => void> = new Set();

  private constructor() {}

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  getState(): FeedbackServiceState {
    return this.state;
  }

  subscribe(listener: (state: FeedbackServiceState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(newState: Partial<FeedbackServiceState>) {
    const updatedState = { ...this.state, ...newState };
    this.state = updatedState;
    this.listeners.forEach(listener => listener(updatedState));
  }

  async submitFeedback({ formId, message }: FeedbackSubmission): Promise<FeedbackResponse> {
    if (!formId || !message.trim()) {
      this.setState({ 
        state: 'error',
        submissionStatus: 'failed',
        error: 'Form ID and message are required'
      });
      throw new Error('Form ID and message are required');
    }

    this.setState({ 
      state: 'submitting',
      submissionStatus: 'pending',
      message
    });

    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{ form_id: formId, message }]);

      if (error) {
        this.setState({
          state: 'error',
          submissionStatus: 'failed',
          error: error.message
        });
        throw error;
      }

      this.setState({
        state: 'success',
        submissionStatus: 'completed'
      });
      return { success: true };
    } catch (error) {
      this.setState({
        state: 'error',
        submissionStatus: 'failed',
        error: error instanceof Error ? error.message : 'Failed to submit feedback'
      });
      throw new Error('Failed to submit feedback');
    }
  }

  reset() {
    this.setState({
      state: 'normal',
      submissionStatus: 'idle',
      message: '',
      error: undefined
    });
  }
}