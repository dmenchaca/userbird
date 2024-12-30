import { createModal } from './modal';
import { createTrigger } from './trigger';
import { submitFeedback } from '../services/feedback';
import { Logger } from './logger';
import { createStyles } from './styles';

export async function createWidget(formId: string, buttonColor: string) {
  Logger.debug(`Creating widget with button color: ${buttonColor}`);
  
  // Inject styles with the correct button color
  const style = document.createElement('style');
  style.textContent = createStyles(buttonColor);
  document.head.appendChild(style);
  
  Logger.debug(`Injected custom styles for button with color: ${buttonColor}`);
  
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