import { createModal } from './modal';
import { createTrigger } from './trigger';
import { submitFeedback } from '../services/feedback';
import { Logger } from './logger';

export function createWidget(formId: string) {
  const modal = createModal();
  const trigger = createTrigger(formId);

  if (!trigger) {
    Logger.error('Trigger element not found');
    return;
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modal.open(trigger);
  });

  modal.onSubmit(async (message) => {
    if (!message.trim()) return;

    modal.setSubmitting(true);
    
    try {
      await submitFeedback({ formId, message });
      modal.close();
    } catch (error) {
      modal.showError('Failed to submit feedback');
      Logger.error('Failed to submit feedback:', error);
    } finally {
      modal.setSubmitting(false);
    }
  });

  modal.onClose(() => modal.close());
}