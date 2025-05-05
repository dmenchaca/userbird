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
    
    // Add detailed logging of the full payload structure
    console.log('SLACK_EVENT_RECEIVED', {
      timestamp: new Date().toISOString(),
      event_id: payload.event_id,
      payload_type: payload.type,
      team_id: payload.team_id,
      api_app_id: payload.api_app_id,
      event_context: payload.event_context,
      event_time: payload.event_time,
      event_type: payload.event?.type,
      event_subtype: payload.event?.subtype,
      channel_type: payload.event?.channel_type,
      has_thread_ts: !!payload.event?.thread_ts,
      thread_ts: payload.event?.thread_ts,
      message_ts: payload.event?.ts,
      has_bot_id: !!payload.event?.bot_id,
      user_id: payload.event?.user,
      authorization_identity: payload.authorizations?.[0]?.user_id
    });
    
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
      
      // Log detailed event information
      console.log('SLACK_EVENT_TYPE_CHECK', {
        event_id: payload.event_id,
        event_type: slackEvent.type,
        ts: slackEvent.ts,
        thread_ts: slackEvent.thread_ts,
        text_preview: slackEvent.text?.substring(0, 30)
      });
      
      // IMPORTANT: Only process app_mention events, ignore regular message events to prevent duplication
      // This is because Slack sends both message and app_mention events for the same message when a user mentions @Userbird
      if (slackEvent.type === 'app_mention' && slackEvent.thread_ts) {
        // Log detailed message event information
        console.log('SLACK_THREAD_APP_MENTION', {
          event_id: payload.event_id,
          ts: slackEvent.ts,
          thread_ts: slackEvent.thread_ts,
          channel: slackEvent.channel,
          user: slackEvent.user,
          has_bot_id: !!slackEvent.bot_id,
          subtype: slackEvent.subtype,
          text_length: slackEvent.text?.length,
          text_preview: slackEvent.text?.substring(0, 30)
        });
        
        // Skip messages from bots
        if (slackEvent.bot_id) {
          console.log('SLACK_SKIPPING_BOT', {
            event_id: payload.event_id,
            is_bot: true,
            ts: slackEvent.ts
          });
          return {
            statusCode: 200,
            body: JSON.stringify({ status: 'ignored bot message' })
          };
        }
        
        console.log('SLACK_PROCESSING_APP_MENTION', {
          event_id: payload.event_id,
          ts: slackEvent.ts,
          thread_ts: slackEvent.thread_ts,
          text_length: slackEvent.text?.length
        });
        
        try {
          await processSlackReply(slackEvent, payload.team_id);
          
          console.log('SLACK_REPLY_PROCESSED', {
            event_id: payload.event_id,
            ts: slackEvent.ts,
            thread_ts: slackEvent.thread_ts,
            process_time: new Date().toISOString()
          });
          
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              status: 'reply processed',
              event_id: payload.event_id,
              ts: slackEvent.ts
            })
          };
        } catch (error) {
          console.error('SLACK_PROCESSING_ERROR', {
            event_id: payload.event_id,
            ts: slackEvent.ts,
            error: error instanceof Error ? error.message : String(error)
          });
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process reply' })
          };
        }
      } 
      // Handle regular message events in threads - we'll ignore these for now to prevent duplication
      else if (slackEvent.type === 'message' && slackEvent.thread_ts) {
        // Log that we're skipping this message event
        console.log('SLACK_SKIPPING_MESSAGE_EVENT', {
          event_id: payload.event_id,
          ts: slackEvent.ts,
          thread_ts: slackEvent.thread_ts,
          text_preview: slackEvent.text?.substring(0, 30),
          reason: 'Only processing app_mention events to prevent duplication'
        });
        
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            status: 'event skipped - only processing app_mention events',
            event_id: payload.event_id,
            event_type: slackEvent.type
          })
        };
      }
    }
    
    // Default response for other events
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        status: 'event received',
        event_id: payload.event_id
      })
    };
  } catch (error) {
    console.error('SLACK_PARSE_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      body_preview: body.substring(0, 100)
    });
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

// Helper function to convert Slack formatting to HTML
function convertSlackToHtml(text: string): string {
  if (!text) return '';
  
  // Convert Slack-style links <https://example.com|text> to HTML links
  text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
  
  // Convert regular URLs that aren't already in the Slack format
  text = text.replace(/(?<!["|'])(https?:\/\/[^\s<]+)(?![^<]*>)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Convert bold (*text*) - ensure it doesn't match within URLs
  text = text.replace(/(?<!\w)\*([^\*\n]+)\*(?!\w)/g, '<strong>$1</strong>');
  
  // Convert italic (_text_) - ensure it doesn't match within URLs
  text = text.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');
  
  // Convert strikethrough (~text~)
  text = text.replace(/(?<!\w)~([^~\n]+)~(?!\w)/g, '<del>$1</del>');
  
  // Convert backticks (`code`) for code styling
  text = text.replace(/(?<!\\)`([^`\n]+)`/g, '<code>$1</code>');
  
  // Convert line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

// Process a reply from Slack
async function processSlackReply(slackEvent: any, teamId: string) {
  // 1. First, try to find the original message in the thread to extract the ticket number
  console.log('SLACK_PROCESS_REPLY_START', {
    ts: slackEvent.ts,
    thread_ts: slackEvent.thread_ts,
    channel: slackEvent.channel,
    user: slackEvent.user
  });
  
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
      .select('id, form_id, user_email, user_name')
      .eq('form_id', slackIntegration.form_id)
      .eq('ticket_number', ticketNumber)
      .single();
    
    if (!feedback) {
      throw new Error(`Could not find feedback with ticket number ${ticketNumber} for form ${slackIntegration.form_id}`);
    }
    
    // Check if the feedback was submitted anonymously
    if (!feedback.user_email) {
      // Send a message to the thread explaining that replies aren't possible for anonymous feedback
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackIntegration.bot_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: slackEvent.channel,
          thread_ts: slackEvent.thread_ts,
          text: "❌ This feedback was submitted anonymously. Replies via Slack are not possible."
        })
      });
      
      throw new Error('Cannot reply to anonymous feedback');
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
      
      // Add detailed debugging logs
      console.log('DEBUG_USER_LOOKUP', {
        email: slackUserEmail,
        lookup_table: 'users'
      });
      
      // Find a Userbird user with matching email
      const { data: matchingUsers, error: userLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('email', slackUserEmail)
        .maybeSingle();
      
      // Log the results of the query
      console.log('DEBUG_USER_LOOKUP_RESULT', {
        found: !!matchingUsers?.id,
        user_id: matchingUsers?.id,
        error: userLookupError?.message
      });
      
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
        
        // Try direct auth lookup
        console.log('DEBUG_AUTH_LOOKUP', { email: slackUserEmail });
        
        try {
          // Try direct SQL query to auth.users table to see if it works
          console.log('DEBUG_DIRECT_AUTH_QUERY_ATTEMPT', { 
            message: 'Attempting direct query to auth.users table',
            email: slackUserEmail
          });
          
          const { data: directAuthUser, error: directAuthError } = await supabase
            .from('auth.users')
            .select('id, email')
            .eq('email', slackUserEmail)
            .maybeSingle();
          
          console.log('DEBUG_DIRECT_AUTH_QUERY_RESULT', {
            success: !directAuthError,
            found: !!directAuthUser?.id,
            error: directAuthError ? directAuthError.message : null,
            user_id: directAuthUser?.id,
            error_details: directAuthError ? JSON.stringify(directAuthError) : null
          });
          
          // Try with the auth admin API
          console.log('DEBUG_AUTH_ADMIN_API_ATTEMPT', { 
            message: 'Attempting to use auth.admin API',
            email: slackUserEmail
          });
          
          // Try to list all users with the admin API
          const { data: adminData, error: adminError } = await supabase.auth.admin.listUsers();
          
          // Look for the user with matching email
          const matchingAuthUser = adminData?.users?.find(user => 
            user.email?.toLowerCase() === slackUserEmail.toLowerCase()
          );
          
          console.log('DEBUG_AUTH_ADMIN_RESULT', {
            found: !!matchingAuthUser?.id,
            user_id: matchingAuthUser?.id,
            error: adminError?.message,
            total_users: adminData?.users?.length || 0,
            email_lowercase: slackUserEmail.toLowerCase(),
            // Log a sample of the first user's structure if available
            sample_user: adminData?.users && adminData.users.length > 0 
              ? JSON.stringify({id: adminData.users[0].id, email: adminData.users[0].email})
              : 'no users found'
          });
          
          // Attempt to directly query auth.users with RPC - another approach
          console.log('DEBUG_RPC_ATTEMPT', {
            message: 'Attempting to query auth.users via RPC',
            email: slackUserEmail
          });
          
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_by_email', {
            p_email: slackUserEmail
          });
          
          console.log('DEBUG_RPC_RESULT', {
            success: !rpcError,
            found: !!rpcData,
            error: rpcError ? rpcError.message : null,
            data: rpcData ? JSON.stringify(rpcData) : null
          });
          
          // Check if the RPC returned successful data
          if (!rpcError && rpcData) {
            try {
              // Parse the RPC result (which is a JSON string array)
              let parsedData = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
              
              // If it's not an array already, try to parse it
              if (!Array.isArray(parsedData) && typeof parsedData === 'string') {
                parsedData = JSON.parse(parsedData);
              }
              
              // Check if we have valid user data
              if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].id) {
                const authUser = parsedData[0];
                
                console.log('DEBUG_RPC_USER_FOUND', {
                  id: authUser.id,
                  email: authUser.email
                });
                
                // Use the user from RPC result
                userbirdUserId = authUser.id;
                console.log(`Using auth user from RPC: ${userbirdUserId}`);
                
                // Create the mapping for future use
                await supabase.from('slack_user_mappings').insert({
                  user_id: userbirdUserId,
                  slack_workspace_id: teamId,
                  slack_user_id: slackEvent.user,
                  slack_user_name: slackUserData.user.real_name || slackUserData.user.name
                });
                
                console.log('Created mapping using auth user from RPC');
                return;
              }
            } catch (parseError) {
              console.error('DEBUG_RPC_PARSE_ERROR', {
                error: parseError instanceof Error ? parseError.message : String(parseError),
                rpcData
              });
            }
          }
          
          if (matchingAuthUser?.id) {
            console.log('DEBUG_AUTH_FOUND_USER', {
              id: matchingAuthUser.id,
              email: matchingAuthUser.email
            });
            
            // Use the auth user as the sender
            userbirdUserId = matchingAuthUser.id;
            console.log(`Using auth user as sender: ${userbirdUserId}`);
            
            // Create the mapping for future use
            await supabase.from('slack_user_mappings').insert({
              user_id: userbirdUserId,
              slack_workspace_id: teamId,
              slack_user_id: slackEvent.user,
              slack_user_name: slackUserData.user.real_name || slackUserData.user.name
            });
            
            console.log('Created mapping using auth user');
          } else {
            // No user found with matching email - throw an error instead of falling back to form owner
            throw new Error(`No Userbird user found with matching email: ${slackUserEmail}`);
          }
        } catch (authError) {
          console.error('DEBUG_AUTH_LOOKUP_ERROR', {
            message: authError instanceof Error ? authError.message : String(authError)
          });
          
          // Don't fall back to form owner, propagate the error
          throw new Error(`Failed to find user for Slack email: ${slackUserEmail}`);
        }
      }
    }
    
    // 4. Clean up the message text (remove @Userbird mention)
    const cleanText = slackEvent.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // Create HTML version of the content with Slack formatting converted to HTML
    let htmlContent = `<div>${convertSlackToHtml(cleanText)}</div>`;
    let plainTextContent = cleanText;
    
    // Check if we should add threading information
    let lastReplyMessageId: string | null = null;
    
    // If this is a reply to another message, check for previous message ID for email threading
    const { data: lastReplies } = await supabase
      .from('feedback_replies')
      .select('message_id, created_at, content, html_content, sender_type, meta')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Get user email for quoting
    const { data: feedbackDetails } = await supabase
      .from('feedback')
      .select('user_email')
      .eq('id', feedbackId)
      .single();
      
    const userEmail = feedbackDetails?.user_email || 'user@example.com';
    
    if (lastReplies && lastReplies.length > 0) {
      const lastReply = lastReplies[0];
      // Store the message ID of the last reply (for email threading)
      lastReplyMessageId = lastReply.message_id || null;
      
      // Add quoted content if there's a previous reply
      if (lastReply.content || lastReply.html_content) {
        // Format date in email client style
        const replyDate = new Date(lastReply.created_at).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        // Determine quoted content based on what's available
        const quotedContent = lastReply.html_content || lastReply.content || '';
        
        // Determine sender email for attribution
        const senderEmail = lastReply.sender_type === 'user' ? 
          userEmail : 'support@userbird.co';
        
        // Also append to plain text content
        const quotedPlainText = lastReply.content || '';
        
        // For HTML quoted content, apply our Slack formatting converter if it's a Slack-sourced reply
        let formattedQuotedContent = quotedContent;
        if (lastReply.meta && typeof lastReply.meta === 'object' && lastReply.meta.source === 'slack') {
          // If this is quoting a Slack message that might have formatting, convert it now
          formattedQuotedContent = convertSlackToHtml(quotedContent);
        }
        
        // Add the attribution line and blockquote formatting with Gmail's structure
        htmlContent += `
          <div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">On ${replyDate}, &lt;${senderEmail}&gt; wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
            ${formattedQuotedContent}
          </blockquote></div>
        `;
        
        // Also append to plain text content
        plainTextContent += `\n\nOn ${replyDate}, ${senderEmail} wrote:\n\n${quotedPlainText.split('\n').map(line => `> ${line}`).join('\n')}`;
      }
    }
    
    // 5. Create the feedback reply with complete information
    const replyData: any = {
      feedback_id: feedbackId,
      sender_id: userbirdUserId,
      sender_type: 'admin',
      type: 'reply',
      content: plainTextContent,
      html_content: htmlContent,
      meta: {
        source: 'slack',
        slack_user_id: slackEvent.user,
        slack_channel_id: slackEvent.channel,
        slack_thread_ts: slackEvent.thread_ts,
        slack_ts: slackEvent.ts
      }
    };
    
    // Add in_reply_to if we have a last reply message ID
    if (lastReplyMessageId) {
      replyData.in_reply_to = lastReplyMessageId;
    }
    
    console.log('SLACK_CREATING_REPLY', {
      ts: slackEvent.ts,
      feedback_id: feedbackId,
      user_id: userbirdUserId,
      has_in_reply_to: !!lastReplyMessageId,
      content_length: plainTextContent.length
    });
    
    const { data: newReply, error: replyError } = await supabase
      .from('feedback_replies')
      .insert(replyData)
      .select()
      .single();
    
    if (replyError) {
      console.error('SLACK_DB_INSERT_ERROR', {
        ts: slackEvent.ts,
        feedback_id: feedbackId,
        error: replyError.message
      });
      throw new Error(`Failed to create feedback reply: ${replyError.message}`);
    }
    
    console.log('SLACK_REPLY_CREATED', {
      ts: slackEvent.ts,
      feedback_id: feedbackId,
      reply_id: newReply.id,
      created_at: newReply.created_at
    });
    
    // 6. Trigger email notification to the end user
    try {
      console.log('Triggering reply notification email');
      
      // Get the form's product name for the email
      const { data: formData } = await supabase
        .from('forms')
        .select('product_name')
        .eq('id', formId)
        .single();
        
      const productName = formData?.product_name || 'Userbird';
      
      const notificationResponse = await fetch('https://app.userbird.co/.netlify/functions/send-reply-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackId: feedbackId,
          replyId: newReply.id,
          replyContent: plainTextContent,
          htmlContent: htmlContent,
          isAdminDashboardReply: true,
          productName: productName
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
    console.error('SLACK_PROCESS_REPLY_ERROR', {
      ts: slackEvent.ts,
      thread_ts: slackEvent.thread_ts,
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined
    });
    
    // Only send error message to the thread if it's not a duplicate message error
    if (!(error instanceof Error) || !error.message.includes('Duplicate slack_ts value')) {
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