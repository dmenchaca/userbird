import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify that the request is coming from Slack
const verifySlackRequest = (headers: Record<string, string | undefined>, body: string): boolean => {
  try {
    const slackSignature = headers['x-slack-signature'];
    const timestamp = headers['x-slack-request-timestamp'];
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

    if (!slackSignature || !timestamp || !slackSigningSecret) {
      console.error('Missing required headers or environment variables for Slack verification');
      return false;
    }

    // Prevent replay attacks - reject requests older than 5 minutes
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - parseInt(timestamp)) > 300) {
      console.error('Request timestamp is too old');
      return false;
    }

    // Create the signature base string
    const signatureBaseString = `v0:${timestamp}:${body}`;
    
    // Generate the expected signature
    const mySignature = 'v0=' + createHmac('sha256', slackSigningSecret)
      .update(signatureBaseString)
      .digest('hex');
    
    // Compare signatures using a constant-time comparison function to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    );
  } catch (error) {
    console.error('Error verifying Slack request:', error);
    return false;
  }
};

// Main handler function for Slack events
const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    // Special handling for OPTIONS requests (for CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Slack-Signature,X-Slack-Request-Timestamp',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: ''
      };
    }
    
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  const body = event.body || '';
  
  // Verify that the request is coming from Slack
  if (!verifySlackRequest(event.headers, body)) {
    console.error('Failed to verify Slack request');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' })
    };
  }

  try {
    const payload = JSON.parse(body);
    
    // Handle Slack URL verification challenge
    if (payload.type === 'url_verification') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge: payload.challenge })
      };
    }
    
    // Process actual events
    if (payload.type === 'event_callback') {
      const slackEvent = payload.event;
      
      // Only process message events that are in threads
      if (slackEvent.type === 'message' && slackEvent.thread_ts) {
        // Skip messages from bots or message_changed events (edits)
        if (slackEvent.bot_id || slackEvent.subtype === 'message_changed') {
          return {
            statusCode: 200,
            body: JSON.stringify({ status: 'ignored bot message or edit' })
          };
        }
        
        // Check if message mentions @Userbird
        const mentionsUserbird = await checkIfMentionsUserbird(slackEvent.text, payload.team_id, slackEvent.thread_ts);
        
        if (mentionsUserbird) {
          console.log('Message mentions @Userbird, processing as reply');
          
          try {
            await processSlackReply(slackEvent, payload.team_id);
            return {
              statusCode: 200,
              body: JSON.stringify({ status: 'reply processed' })
            };
          } catch (error) {
            console.error('Error processing reply:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to process reply' })
            };
          }
        }
      }
    }
    
    // Default response for other events
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'event received' })
    };
  } catch (error) {
    console.error('Error processing Slack event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Check if a message mentions @Userbird
async function checkIfMentionsUserbird(text: string, teamId: string, threadTs?: string): Promise<boolean> {
  // First, check for the basic mention format
  const hasMention = text.includes('<@') && text.includes('>');
  
  if (!hasMention) {
    return false;
  }
  
  try {
    // If we have a thread_ts, try to get the form_id for more specific lookup
    let formId: string | null = null;
    
    if (threadTs) {
      // Get feedback information from thread_ts
      const { data: feedbackReplies } = await supabase
        .from('feedback_replies')
        .select('feedback_id')
        .eq('meta->slack_thread_ts', threadTs)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (feedbackReplies && feedbackReplies.length > 0) {
        // Get the form_id from the feedback
        const { data: feedback } = await supabase
          .from('feedback')
          .select('form_id')
          .eq('id', feedbackReplies[0].feedback_id)
          .single();
        
        if (feedback?.form_id) {
          formId = feedback.form_id;
        }
      }
    }
    
    // Get the bot user ID for this workspace
    let query = supabase
      .from('slack_integrations')
      .select('bot_user_id, workspace_id');
    
    // Apply workspace filter
    query = query.eq('workspace_id', teamId);
    
    // If we have a form_id, add it to the query for more specific lookup
    if (formId) {
      query = query.eq('form_id', formId);
    }
    
    const { data: integration } = await query.maybeSingle();
    
    if (!integration?.bot_user_id) {
      // If we don't have the bot user ID stored, try to fetch it from Slack
      const botUserId = await fetchBotUserIdFromSlack(teamId);
      
      if (botUserId) {
        // Store the bot user ID for future use
        let updateQuery = supabase
          .from('slack_integrations')
          .update({ bot_user_id: botUserId, metadata: { last_updated: new Date().toISOString() } })
          .eq('workspace_id', teamId);
        
        // If we have a form_id, add it to the update query
        if (formId) {
          updateQuery = updateQuery.eq('form_id', formId);
        }
        
        await updateQuery;
        
        return text.includes(`<@${botUserId}>`);
      }
      
      return false;
    }
    
    // Check if the message mentions our specific bot ID
    return text.includes(`<@${integration.bot_user_id}>`);
  } catch (error) {
    console.error('Error checking for @Userbird mention:', error);
    // Default to checking for the word "userbird" if we can't verify the exact ID
    return text.toLowerCase().includes('userbird');
  }
}

// Fetch the bot user ID from Slack if we don't have it stored
async function fetchBotUserIdFromSlack(teamId: string): Promise<string | null> {
  try {
    // First, we need to find the form_id associated with this workspace through thread_ts
    // However, since we don't have thread_ts available in this function context,
    // we'll just get the bot token for the workspace
    const { data: integration } = await supabase
      .from('slack_integrations')
      .select('bot_token')
      .eq('workspace_id', teamId)
      .maybeSingle();
    
    if (!integration?.bot_token) {
      console.error('No bot token found for workspace:', teamId);
      return null;
    }
    
    // Call the Slack API to get the bot's user ID
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.bot_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Error fetching bot user ID from Slack:', data.error);
      return null;
    }
    
    return data.user_id;
  } catch (error) {
    console.error('Error in fetchBotUserIdFromSlack:', error);
    return null;
  }
}

// Process a reply from Slack
async function processSlackReply(slackEvent: any, teamId: string) {
  // 1. First, try to find the original message in the thread to extract the ticket number
  console.log(`Processing reply in thread: ${slackEvent.thread_ts}`);
  
  try {
    // Get the form_id associated with this workspace
    const { data: slackIntegration } = await supabase
      .from('slack_integrations')
      .select('bot_token, form_id')
      .eq('workspace_id', teamId)
      .limit(1)
      .maybeSingle();
    
    if (!slackIntegration?.bot_token || !slackIntegration?.form_id) {
      throw new Error(`Could not find Slack integration for workspace: ${teamId}`);
    }
    
    // Fetch the thread's parent message to extract the ticket number
    const threadResponse = await fetch(
      `https://slack.com/api/conversations.replies?channel=${slackEvent.channel}&ts=${slackEvent.thread_ts}&limit=1`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${slackIntegration.bot_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const threadData = await threadResponse.json();
    
    if (!threadData.ok || !threadData.messages || threadData.messages.length === 0) {
      throw new Error(`Could not fetch thread messages: ${threadData.error || 'No messages found'}`);
    }
    
    // Get the parent message (first message in the thread)
    const parentMessage = threadData.messages[0];
    const parentMessageText = parentMessage.text || '';
    
    // Extract ticket number from parent message using regex
    // The format in our messages is *Ticket:*\n#123
    const ticketRegex = /\*Ticket:\*\s*\n\s*#(\d+)/;
    const ticketMatch = parentMessageText.match(ticketRegex);
    
    let ticketNumber: string | null = null;
    
    if (!ticketMatch || !ticketMatch[1]) {
      // Try with blocks - sometimes the text is in the blocks
      if (parentMessage.blocks) {
        for (const block of parentMessage.blocks) {
          if (block.type === 'section' && block.fields) {
            for (const field of block.fields) {
              if (field.text && field.text.includes('*Ticket:*')) {
                const fieldMatch = field.text.match(/\*Ticket:\*\s*\n\s*#(\d+)/);
                if (fieldMatch && fieldMatch[1]) {
                  ticketNumber = fieldMatch[1];
                  break;
                }
              }
            }
          }
        }
      }
      
      if (!ticketNumber) {
        throw new Error('Could not extract ticket number from thread parent message');
      }
    } else {
      ticketNumber = ticketMatch[1];
    }
    
    console.log(`Extracted ticket number: ${ticketNumber}`);
    
    // Find the feedback by ticket number and form_id
    const { data: feedback } = await supabase
      .from('feedback')
      .select('id, form_id')
      .eq('form_id', slackIntegration.form_id)
      .eq('ticket_number', ticketNumber)
      .single();
    
    if (!feedback) {
      throw new Error(`Could not find feedback with ticket number ${ticketNumber} for form ${slackIntegration.form_id}`);
    }
    
    const feedbackId = feedback.id;
    const formId = feedback.form_id;
    
    console.log(`Found feedback ID: ${feedbackId} for ticket #${ticketNumber}`);
    
    // 3. Try to map the Slack user to a Userbird user
    let userbirdUserId: string | null = null;
    
    // First check if there's already a mapping
    const { data: existingMapping } = await supabase
      .from('slack_user_mappings')
      .select('user_id')
      .eq('slack_workspace_id', teamId)
      .eq('slack_user_id', slackEvent.user)
      .maybeSingle();
    
    if (existingMapping?.user_id) {
      userbirdUserId = existingMapping.user_id;
      console.log(`Found existing user mapping for Slack user ${slackEvent.user}: ${userbirdUserId}`);
    } else {
      // No mapping exists, try to match by email
      console.log('No existing mapping found, attempting to match by email');
      
      // Call Slack API to get user's email
      const slackUserResponse = await fetch(`https://slack.com/api/users.info?user=${slackEvent.user}`, {
        headers: {
          'Authorization': `Bearer ${slackIntegration.bot_token}`
        }
      });
      
      const slackUserData = await slackUserResponse.json();
      
      if (!slackUserData.ok || !slackUserData.user?.profile?.email) {
        console.log('Could not get email for Slack user:', slackUserData.error || 'No email in profile');
        throw new Error('Could not get email for Slack user');
      }
      
      const slackUserEmail = slackUserData.user.profile.email;
      console.log(`Found email for Slack user: ${slackUserEmail}`);
      
      // Find a Userbird user with matching email
      const { data: matchingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email', slackUserEmail)
        .maybeSingle();
      
      if (matchingUsers?.id) {
        userbirdUserId = matchingUsers.id;
        console.log(`Found matching Userbird user by email: ${userbirdUserId}`);
        
        // Create the mapping for future use
        await supabase.from('slack_user_mappings').insert({
          user_id: userbirdUserId,
          slack_workspace_id: teamId,
          slack_user_id: slackEvent.user,
          slack_user_name: slackUserData.user.real_name || slackUserData.user.name
        });
        
        console.log('Created new user mapping');
      } else {
        console.log('No matching Userbird user found by email');
        
        // Fall back to form owner
        const { data: form } = await supabase
          .from('forms')
          .select('owner_id')
          .eq('id', formId)
          .single();
        
        if (!form?.owner_id) {
          throw new Error(`Could not find owner for form: ${formId}`);
        }
        
        userbirdUserId = form.owner_id;
        console.log(`Using form owner as fallback: ${userbirdUserId}`);
        
        // Let's also store this information for the confirmation message
        await supabase.from('slack_integrations')
          .update({
            metadata: {
              last_unmapped_slack_user: {
                slack_user_id: slackEvent.user,
                slack_user_email: slackUserEmail,
                slack_user_name: slackUserData.user.real_name || slackUserData.user.name,
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('workspace_id', teamId)
          .eq('form_id', formId);
      }
    }
    
    // 4. Clean up the message text (remove @Userbird mention)
    const cleanText = slackEvent.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // 5. Create the feedback reply
    const { data: newReply, error: replyError } = await supabase
      .from('feedback_replies')
      .insert({
        feedback_id: feedbackId,
        sender_id: userbirdUserId,
        sender_type: 'admin',
        type: 'reply',
        content: cleanText,
        meta: {
          source: 'slack',
          slack_user_id: slackEvent.user,
          slack_channel_id: slackEvent.channel,
          slack_thread_ts: slackEvent.thread_ts,
          slack_ts: slackEvent.ts
        }
      })
      .select()
      .single();
    
    if (replyError) {
      console.error('Error creating feedback reply:', replyError);
      throw new Error(`Failed to create feedback reply: ${replyError.message}`);
    }
    
    console.log(`Created feedback reply with ID: ${newReply.id}`);
    
    // 6. Trigger email notification to the end user
    try {
      console.log('Triggering reply notification email');
      const notificationResponse = await fetch('https://app.userbird.co/.netlify/functions/send-reply-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackId: feedbackId,
          replyId: newReply.id,
          replyContent: cleanText,
          isAdminDashboardReply: true
        })
      });
      
      if (!notificationResponse.ok) {
        console.error('Failed to send reply notification email:', await notificationResponse.text());
      } else {
        console.log('Reply notification email sent successfully');
      }
    } catch (emailError) {
      console.error('Error sending reply notification email:', emailError);
      // Continue anyway as the reply was saved successfully
    }
    
    // 7. Send confirmation back to Slack
    await sendSlackConfirmation(
      slackEvent.channel, 
      slackEvent.thread_ts, 
      teamId, 
      newReply.id,
      !!existingMapping?.user_id // indicate if we used an existing mapping
    );
    
    return newReply.id;
  } catch (error) {
    console.error('Error in processSlackReply:', error);
    
    // Send a message to the thread to inform the user
    try {
      // Find any integration for this workspace to get a token
      const { data: integration } = await supabase
        .from('slack_integrations')
        .select('bot_token')
        .eq('workspace_id', teamId)
        .limit(1)
        .maybeSingle();
      
      if (integration?.bot_token) {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.bot_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: slackEvent.channel,
            thread_ts: slackEvent.thread_ts,
            text: "❌ Sorry, I couldn't process your reply. Please make sure you're replying to a feedback notification thread."
          })
        });
      }
    } catch (msgError) {
      console.error('Error sending error message to Slack:', msgError);
    }
    
    throw error;
  }
}

// Send a confirmation message back to Slack
async function sendSlackConfirmation(
  channelId: string, 
  threadTs: string, 
  teamId: string, 
  replyId: string,
  usedExistingMapping: boolean
) {
  try {
    // Get the slack integration details
    const { data: integration } = await supabase
      .from('slack_integrations')
      .select('bot_token')
      .eq('workspace_id', teamId)
      .limit(1)
      .maybeSingle();
    
    if (!integration?.bot_token) {
      throw new Error(`No bot token found for workspace: ${teamId}`);
    }
    
    // Prepare the message text
    let messageText = "✅ Reply sent to user";
    
    if (!usedExistingMapping) {
      messageText += " (Note: Used email matching to link your account)";
    }
    
    // Send the message
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.bot_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadTs,
        text: messageText
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('Error sending confirmation to Slack:', result.error);
      throw new Error(`Failed to send confirmation to Slack: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error in sendSlackConfirmation:', error);
    throw error;
  }
}

export { handler }; 