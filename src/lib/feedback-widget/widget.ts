import { createModal } from './modal';
import { createTrigger } from './trigger';
import { submitFeedback } from '../services/feedback';
import { Logger } from './logger';
import { createStyles } from './styles';

export async function createWidget(formId: string, buttonColor: string) {
  Logger.debug(`Creating widget with button color: ${buttonColor}`);
  
  // Log the full CSS being injected
  const styleContent = createStyles(buttonColor);
  Logger.debug('Injecting CSS:', styleContent);
  
  const style = document.createElement('style');
  style.textContent = styleContent;
  document.head.appendChild(style);
  
  // Verify style was added
  Logger.debug('Style element added to head:', document.head.contains(style));
  
  const modal = createModal();
  const trigger = createTrigger(formId);

  if (!trigger) {
    Logger.error('Trigger element not found');
    return;
  }

  // Log the computed styles
  const computedStyle = window.getComputedStyle(trigger);
  Logger.debug('Trigger button computed styles:', {
    background: computedStyle.backgroundColor,
    color: computedStyle.color,
    className: trigger.className,
    id: trigger.id
  });

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    Logger.debug('Trigger clicked, current styles:', {
      background: window.getComputedStyle(trigger).backgroundColor,
      color: window.getComputedStyle(trigger).color
    });
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