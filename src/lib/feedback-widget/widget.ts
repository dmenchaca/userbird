import { createModal } from './modal';
import { createTrigger } from './trigger';
import { submitFeedback } from '../services/feedback';
import { Logger } from './logger';
import { supabase } from '../supabase';
import { createStyles } from './styles';

async function getFormStyle(formId: string) {
  try {
    const { data, error } = await supabase
      .from('forms')
      .select('button_color')
      .eq('id', formId)
      .single();

    if (error) throw error;
    const color = data?.button_color || '#1f2937';
    Logger.debug(`Retrieved button color from database: ${color} for form ID: ${formId}`);
    return color;
  } catch (error) {
    Logger.error('Error fetching form style:', error);
    return '#1f2937';
  }
}

export async function createWidget(formId: string) {
  const buttonColor = await getFormStyle(formId);
  
  // Update styles with correct button color
  const style = document.createElement('style');
  style.textContent = createStyles(buttonColor);
  document.head.appendChild(style);
  
  Logger.debug(`Injected custom styles for .ub-button with color: ${buttonColor}`);
  Logger.debug(`CSS Rule: .ub-button { background: ${buttonColor}; }`);
  
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