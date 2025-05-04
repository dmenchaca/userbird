import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { format } from 'date-fns';

// Initialize Supabase client for database access
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Types for Slack Block Kit elements
type SlackBlockText = {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
};

type SlackBlockElement = {
  type: string;
  text?: SlackBlockText;
  url?: string;
  style?: 'primary' | 'danger';
};

type SlackBlock = {
  type: string;
  text?: SlackBlockText;
  fields?: SlackBlockText[];
  elements?: SlackBlockElement[] | SlackBlockText[];
};

// Helper function to sanitize strings for Slack's mrkdwn format
const sanitizeForSlack = (text: string): string => {
  if (!text) return '';
  // Replace HTML with mrkdwn approximations
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')  // Replace &nbsp; with space
    .replace(/&lt;/g, '<')    // Replace &lt; with <
    .replace(/&gt;/g, '>')    // Replace &gt; with >
    .replace(/&amp;/g, '&')   // Replace &amp; with &
    .replace(/&quot;/g, '"')  // Replace &quot; with "
    .replace(/&#39;/g, "'")   // Replace &#39; with '
    .trim();
};

// Format date for Slack message
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    return dateString || 'Unknown date';
  }
};

export const handler: Handler = async (event) => {
  // Only process POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse request body
    const { formId, feedbackId } = JSON.parse(event.body || '{}');

    if (!formId || !feedbackId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Check if Slack integration is enabled for this form
    const { data: slackIntegration, error: slackError } = await supabase
      .from('slack_integrations')
      .select('bot_token, enabled, channel_id')
      .eq('form_id', formId)
      .eq('enabled', true)
      .single();

    if (slackError || !slackIntegration || !slackIntegration.bot_token || !slackIntegration.channel_id) {
      console.log(`Slack integration not available for form ${formId} or missing channel configuration`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Slack integration not configured properly'
        })
      };
    }

    // Get feedback details
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select(`
        id, 
        message, 
        created_at, 
        status, 
        user_id, 
        user_email, 
        user_name, 
        url_path, 
        operating_system, 
        screen_category,
        ticket_number
      `)
      .eq('id', feedbackId)
      .single();

    if (feedbackError || !feedback) {
      console.error('Error fetching feedback details:', feedbackError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Feedback not found' })
      };
    }

    // Get form name for message context
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('name, url')
      .eq('id', formId)
      .single();

    if (formError) {
      console.error('Error fetching form details:', formError);
      // Continue anyway with limited info
    }

    // Format message for Slack
    const formattedMessage = sanitizeForSlack(feedback.message);
    const userInfo = feedback.user_name || feedback.user_email || 'Anonymous';
    const ticketNumber = feedback.ticket_number || 'N/A';
    const formName = form?.name || 'your form';
    const formUrl = form?.url || '';
    const createdDate = formatDate(feedback.created_at);
    
    // Create Slack message
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `New feedback from ${userInfo}`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Ticket:*\n#${ticketNumber}`
          },
          {
            type: "mrkdwn",
            text: `*Received:*\n${createdDate}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Message:*\n${formattedMessage}`
        }
      }
    ];

    // Add user info section if available
    if (feedback.user_email || feedback.url_path) {
      const userFields: SlackBlockText[] = [];
      
      if (feedback.user_email) {
        userFields.push({
          type: "mrkdwn",
          text: `*Email:*\n${feedback.user_email}`
        });
      }
      
      if (feedback.url_path) {
        userFields.push({
          type: "mrkdwn",
          text: `*Page:*\n${feedback.url_path}`
        });
      }
      
      blocks.push({
        type: "section",
        fields: userFields
      });
    }

    // Add system info if available
    if (feedback.operating_system || feedback.screen_category) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*System:* ${feedback.operating_system || 'Unknown'} | *Screen:* ${feedback.screen_category || 'Unknown'}`
          }
        ]
      });
    }

    // Add divider and actions
    blocks.push(
      {
        type: "divider"
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in Userbird",
              emoji: true
            },
            url: `https://app.userbird.co/forms/${formId}/ticket/${ticketNumber}`,
            style: "primary"
          }
        ]
      }
    );

    // Create the complete Slack message payload
    const slackMessage = {
      channel: slackIntegration.channel_id,
      text: `New feedback received for ${formName}`,
      blocks
    };

    // Send message to Slack
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackIntegration.bot_token}`
      },
      body: JSON.stringify(slackMessage)
    });

    const slackResult = await slackResponse.json() as any;

    if (!slackResult.ok) {
      console.error('Error sending message to Slack:', slackResult.error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send message to Slack', details: slackResult.error })
      };
    }

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        channel: slackIntegration.channel_id,
        timestamp: slackResult.ts
      })
    };
  } catch (error) {
    console.error('Error in send-to-slack function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 