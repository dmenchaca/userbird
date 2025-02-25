import { FeedbackSubmission, FeedbackResponse, FeedbackState } from './types';
import { supabase } from '../supabase';

type StateTransition = {
  state: FeedbackState;
  submissionStatus: 'idle' | 'pending' | 'completed' | 'failed';
  message?: string;
  error?: string;
};

interface FeedbackServiceState {
  state: FeedbackState;
  submissionStatus: 'idle' | 'pending' | 'completed' | 'failed';
  message: string;
  error?: string;
}

const INITIAL_STATE: FeedbackServiceState = {
  state: 'normal',
  submissionStatus: 'idle',
  message: ''
};

export class FeedbackService {
  private static instance: FeedbackService;
  private state: FeedbackServiceState = INITIAL_STATE;
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

  private transition(transition: StateTransition) {
    const updatedState = {
      ...this.state,
      ...transition,
      message: transition.message ?? this.state.message
    };
    
    console.log('Feedback state transition:', {
      from: this.state.state,
      to: transition.state,
      status: transition.submissionStatus
    });
    
    this.state = updatedState;
    this.listeners.forEach(listener => listener(updatedState));
  }

  async submitFeedback({ formId, message }: FeedbackSubmission): Promise<FeedbackResponse> {
    if (!formId || !message.trim()) {
      this.transition({ 
        state: 'error',
        submissionStatus: 'failed',
        error: 'Form ID and message are required'
      });
      throw new Error('Form ID and message are required');
    }

    this.transition({ 
      state: 'submitting',
      submissionStatus: 'pending',
      message
    });

    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{ form_id: formId, message }]);

      if (error) {
        this.transition({
          state: 'error',
          submissionStatus: 'failed',
          error: error.message
        });
        throw error;
      }

      this.transition({
        state: 'success',
        submissionStatus: 'completed'
      });
      return { success: true };
    } catch (error) {
      this.transition({
        state: 'error',
        submissionStatus: 'failed',
        error: error instanceof Error ? error.message : 'Failed to submit feedback'
      });
      throw new Error('Failed to submit feedback');
    }
  }

  reset() {
    this.state = INITIAL_STATE;
    this.listeners.forEach(listener => listener(this.state));
  }
}