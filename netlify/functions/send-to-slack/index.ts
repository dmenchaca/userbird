import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { format } from 'date-fns';
import { getSecretFromVault } from '../utils/vault';

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
    return format(date, "MMM d, yyyy h:mm a 'UTC'");
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
      .select('bot_token, bot_token_id, enabled, channel_id')
      .eq('form_id', formId)
      .eq('enabled', true)
      .single();

    // Check if we have a valid integration
    if (slackError || !slackIntegration || !slackIntegration.channel_id) {
      console.log(`Slack integration not available for form ${formId} or missing channel configuration`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Slack integration not configured properly'
        })
      };
    }

    // Get the bot token - either from Vault using bot_token_id or fallback to bot_token
    let botToken: string | null = null;
    
    if (slackIntegration.bot_token_id) {
      // Retrieve from Vault
      botToken = await getSecretFromVault(slackIntegration.bot_token_id);
    } else if (slackIntegration.bot_token) {
      // Fallback to plain text token if available
      botToken = slackIntegration.bot_token;
    }
    
    if (!botToken) {
      console.error(`Could not retrieve bot token for integration (form_id: ${formId})`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Could not retrieve Slack bot token'
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
      .select('product_name, url')
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
    const formName = form?.product_name || 'your form';
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
        text: {
          type: "mrkdwn",
          text: `*Message:*\n${formattedMessage}`
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

    // Remove reply instructions from the initial message - we'll send these as a separate message
    
    // Create the complete Slack message payload
    const slackMessage = {
      channel: slackIntegration.channel_id,
      text: `New feedback received for ${formName}`,
      blocks
    };

    // First, try to join the channel if it's public (using channels:join permission)
    try {
      const joinResponse = await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${botToken}`
        },
        body: JSON.stringify({ channel: slackIntegration.channel_id })
      });
      
      const joinResult = await joinResponse.json() as any;
      
      // If there's an error that's not "already_in_channel", log it but continue
      if (!joinResult.ok && joinResult.error !== 'already_in_channel') {
        console.log(`Note: Could not auto-join channel: ${joinResult.error}`);
      }
    } catch (joinError) {
      // Just log the error but continue - the bot might already be in the channel
      console.log('Error joining channel:', joinError);
    }

    // Send message to Slack
    // Note: If you encounter a "not_in_channel" error, make sure to invite the Slack bot
    // to the selected channel first. In Slack, type: /invite @YourAppName in the channel
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`
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
    
    // Store the thread_ts in a feedback_reply for future correlation
    if (slackResult.ts) {
      try {
        console.log(`Storing Slack thread reference with ts: ${slackResult.ts} for feedback: ${feedbackId}`);
        
        const { data: insertResult, error: insertError } = await supabase.from('feedback_replies').insert({
          feedback_id: feedbackId,
          sender_type: 'system',
          type: 'notification',
          meta: {
            source: 'slack',
            slack_channel_id: slackIntegration.channel_id,
            slack_thread_ts: slackResult.ts,
            slack_ts: slackResult.ts,
            is_slack_reference: true,
            notification_type: 'slack'
          }
        }).select();
        
        if (insertError) {
          console.error('Error storing Slack thread reference:', insertError);
        } else {
          console.log(`Successfully stored Slack thread reference, record ID: ${insertResult?.[0]?.id}`);
        }
      } catch (error) {
        console.error('Exception storing Slack thread reference:', error);
        // Continue anyway as the message was sent successfully
      }
    } else {
      console.warn('No ts value in Slack response, cannot store thread reference');
    }
    
    // Send a follow-up message with reply instructions
    if (slackResult.ts) {
      try {
        // Prepare instructions text based on whether the feedback is anonymous
        let instructionsText;
        if (feedback.user_email) {
          // We have user info, include name and email for clarity
          const userName = feedback.user_name || feedback.user_email;
          instructionsText = `Replies here will be sent to ${userName} (${feedback.user_email}) if you mention @Userbird.`;
        } else {
          // Anonymous feedback - let them know replies aren't possible
          instructionsText = "This feedback was submitted anonymously. Replies via Slack are not possible.";
        }
        
        // Send instructions as a separate message in the thread
        const instructionsResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${botToken}`
          },
          body: JSON.stringify({
            channel: slackIntegration.channel_id,
            thread_ts: slackResult.ts,
            text: instructionsText,
            // Make it appear with the same app branding
            username: "Userbird",
            icon_url: "https://app.userbird.co/Userbird-icon.png"
          })
        });
        
        const instructionsResult = await instructionsResponse.json() as any;
        
        if (!instructionsResult.ok) {
          console.error('Error sending instructions message to Slack:', instructionsResult.error);
        }
      } catch (error) {
        console.error('Error sending instructions message:', error);
        // Continue anyway as the main message was sent successfully
      }
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