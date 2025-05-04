import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SlackNotificationOptions {
  formId: string;
  feedbackId: string;
}

export function useSlackNotification() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendToSlack = async ({ formId, feedbackId }: SlackNotificationOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if Slack integration is enabled
      const { data: slackIntegration, error: slackError } = await supabase
        .from('slack_integrations')
        .select('enabled')
        .eq('form_id', formId)
        .eq('enabled', true)
        .single();

      // If Slack integration is not enabled or there's an error, skip sending
      if (slackError || !slackIntegration) {
        console.log('Slack integration not enabled for form', formId);
        setIsLoading(false);
        return { success: false, reason: 'not_enabled' };
      }

      // Call the Netlify function to send the message to Slack
      const response = await fetch('/.netlify/functions/send-to-slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId,
          feedbackId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification to Slack');
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('Error sending to Slack:', error);
      setError(error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendToSlack,
    isLoading,
    error,
  };
} 