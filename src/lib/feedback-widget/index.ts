import { createWidget } from './widget';
import { Logger } from './logger';

export async function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  // Initialize widget after getting form settings
  createWidget(formId);
}

// Expose global initialization
declare global {
  interface Window {
    UserBird?: {
      formId?: string;
      buttonColor?: string;
    };
  }
}