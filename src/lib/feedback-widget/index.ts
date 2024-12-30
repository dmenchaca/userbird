import { createWidget } from './widget';
import { Logger } from './logger';
import { supabase } from '../supabase';

async function getFormSettings(formId: string) {
  Logger.debug('Attempting to fetch form settings from Supabase');
  Logger.debug('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  
  try {
    const { data, error } = await supabase
      .from('forms')
      .select('button_color')
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
    Logger.debug('Falling back to default color');
    return { button_color: '#1f2937' };
  }
}

export async function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  Logger.debug('Initializing widget with formId:', formId);
  Logger.debug('Environment check:', {
    supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
  });
  
  // Fetch form settings first
  const settings = await getFormSettings(formId);
  Logger.debug('Using button color:', settings.button_color);
  
  // Initialize widget with settings
  await createWidget(formId, settings.button_color);
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