import { createWidget } from './widget';
import { Logger } from './logger';
import { supabase } from '../supabase';
import { cache } from '../cache';

async function getFormSettings(formId: string) {
  Logger.debug('Attempting to fetch form settings from Supabase');
  Logger.debug('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  
  // Check cache first
  const cached = cache.get(`form-settings:${formId}`);
  if (cached) {
    Logger.debug('Using cached settings');
    return cached;
  }

  try {
    const { data, error } = await supabase
      .from('forms')
      .select('button_color, support_text')
      .eq('id', formId)
      .single();

    if (error) {
      Logger.debug('Supabase error:', error);
      throw error;
    }
    Logger.debug(`Retrieved form settings:`, data);
    
    // Cache the result
    cache.set(`form-settings:${formId}`, data);
    
    return data;
  } catch (error) {
    Logger.error('Error fetching form settings:', error);
    Logger.debug('Falling back to default color');
    return { button_color: '#1f2937', support_text: null };
  }
}

export async function initFeedbackWidget(formId: string) {
  if (!formId) {
    Logger.error('No form ID provided');
    return;
  }

  Logger.debug('Initializing widget with formId:', formId);
  
  try {
    // Wait for auth state to be determined
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fetch form settings
    const settings = await getFormSettings(formId);
    Logger.debug('Using settings:', settings);
    
    // Initialize widget with settings
    await createWidget(formId, settings.button_color, settings.support_text);
  } catch (error) {
    Logger.error('Error initializing widget:', error);
    // Initialize with defaults if there's an error
    await createWidget(formId, '#1f2937', null);
  }
}