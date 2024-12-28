// Main widget entry point
import { createWidget } from './widget';
import { injectStyles } from './styles';
import { Logger } from './logger';

export function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  injectStyles();
  createWidget(formId);
}

// Expose global initialization
declare global {
  interface Window {
    UserBird?: {
      formId?: string;
      position?: string;
    };
  }
}