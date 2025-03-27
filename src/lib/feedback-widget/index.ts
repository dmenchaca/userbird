import { createWidget } from './widget';
import { Logger } from './logger';
import { supabase } from '../supabase';

async function getFormSettings(formId: string) {
  Logger.debug('Attempting to fetch form settings from Supabase');
  Logger.debug('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  
  try {
    const { data, error } = await supabase
      .from('forms')
      .select('button_color, remove_branding')
      .eq('id', formId)
      .single();

    if (error) {
      Logger.debug('Supabase error:', error);
      throw error;
    }
    Logger.debug(`Retrieved form settings:`, data);
    return data;
  } catch (error) {
    Logger.error('Error fetching form settings:', error);
    Logger.debug('Falling back to default settings');
    return { button_color: '#1f2937', remove_branding: false };
  }
}

export async function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  Logger.debug('Initializing widget with formId:', formId);
  
  // Fetch form settings first
  const settings = await getFormSettings(formId);
  Logger.debug('Using button color:', settings.button_color);
  Logger.debug('Remove branding:', settings.remove_branding);
  
  // Initialize widget with settings
  await createWidget(formId, settings.button_color, settings.remove_branding);
}