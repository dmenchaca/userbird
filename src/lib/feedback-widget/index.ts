import { createWidget } from './widget';
import { createStyles } from './styles';
import { Logger } from './logger';

export function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  createWidget(formId).catch(error => {
    Logger.error('Failed to initialize widget:', error);
  });
}

declare global {
  interface Window {
    UserBird?: {
      formId?: string;
      buttonColor?: string;
    };
  }
}