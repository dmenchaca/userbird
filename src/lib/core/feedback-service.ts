import { FeedbackSubmission, FeedbackResponse, FeedbackState } from './types';
import { supabase } from '../supabase';

export class FeedbackService {
  private static instance: FeedbackService;
  private state: FeedbackState = 'normal';
  private listeners: Set<(state: FeedbackState) => void> = new Set();

  private constructor() {}

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }

  getState(): FeedbackState {
    return this.state;
  }

  subscribe(listener: (state: FeedbackState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(newState: FeedbackState) {
    this.state = newState;
    this.listeners.forEach(listener => listener(newState));
  }

  async submitFeedback({ formId, message }: FeedbackSubmission): Promise<FeedbackResponse> {
    if (!formId || !message.trim()) {
      throw new Error('Form ID and message are required');
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{ form_id: formId, message }]);

      if (error) throw error;

      this.setState('success');
      return { success: true };
    } catch (error) {
      this.setState('error');
      throw new Error('Failed to submit feedback');
    }
  }

  reset() {
    this.setState('normal');
  }
}