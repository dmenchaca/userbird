import { createWidget } from './widget';
import { createStyles } from './styles';
import { Logger } from './logger';

export function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  // Inject styles with default color - will be updated when form data is fetched
  const style = document.createElement('style');
  style.textContent = createStyles();
  document.head.appendChild(style);
  
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