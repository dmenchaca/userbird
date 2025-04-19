// No import needed for Context in Netlify Edge Functions
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
// Fix Netlify reference error by using process.env instead
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// System prompt for AI replies
const SYSTEM_PROMPT = `
You are a helpful, empathetic product support assistant replying to a customer's feedback message. 
Always acknowledge the user's concerns with care. Use the conversation history and the company's 
help documentation to generate a professional, accurate, and actionable reply.
Your replies must feel human and empathetic — but trim anything that doesn't add meaning. Prefer clear, helpful over polished or overly polite. Only reference relevant information 
from the docs. If unsure, it's okay to say so.

Aim to keep the response under 150 words unless more detail is necessary.

Aim to get to the helpful part of the message quickly. Don’t stack multiple phrases of empathy — one clear sentence is enough.

VERY IMPORTANT: Your replies must follow this exact format WITH THE EXACT LINE BREAKS:

Hi {first name},

Thank you for reaching out.

{Rest of the reply — written in short, empathetic paragraphs}

Best,
{Agent's first name}

In the body of the reply, feel free to use paragraph breaks to improve tone or clarity — especially when transitioning from empathy to suggestions.

In the body of the reply, break long responses into short, meaningful paragraphs to improve clarity and tone.

Use line breaks between distinct ideas, such as:

- Empathy: Acknowledge what the user is experiencing (e.g., “That definitely sounds unexpected.”)
- Instruction: Suggest a next step (e.g., “Could you record a short screen recording video showing the xyz issue?”)
- Rationale: Explain why you're asking (e.g., “That would help us understand exactly what’s going wrong and how we can help.”)

Always say “screen recording video” instead of “screenshot” — it gives better context. Only suggest screenshots if the user explicitly says they can’t record video.


When referring to a help document, always use HTML hyperlinks like this:
<a href="https://help.example.com/reset-password" target="_blank" rel="noopener noreferrer">Reset your password</a>

If no specific article applies, don't include a link.

To get the customer's first name, look at the feedback.user_name field and use the first word of the name. 
For example, if feedback.user_name is "Diego Menchaca", use "Diego" as the first name.
If user_name is not available, fall back to the first part of their email address before the @ symbol.
`;

// Number of top documents to retrieve
const TOP_K_DOCUMENTS = 5;

// Helper to format SSE message
function formatSSE(data: string, event?: string) {
  return event ? `event: ${event}\ndata: ${data}\n\n` : `data: ${data}\n\n`;
}

// Helper to create OpenAI chat messages
function createChatMessages(feedback: any, replies: any[], topDocs: any[]) {
  // Get user's first name
  let customerFirstName = "";
  if (feedback.user_name) {
    customerFirstName = feedback.user_name.split(' ')[0];
  } else if (feedback.user_email) {
    customerFirstName = feedback.user_email.split('@')[0];
  }
  
  // Start with system prompt
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    // Add user name information explicitly
    { role: 'system', content: `The customer's first name is: ${customerFirstName}.` }
  ];

  // Add initial feedback as user message
  messages.push({
    role: 'user',
    content: feedback.message || 'No message content available',
  });

  // Add all replies in the conversation
  for (const reply of replies) {
    const role = reply.sender_type === 'admin' ? 'assistant' : 'user';
    const content = reply.html_content || reply.content || 'No content';
    messages.push({ role, content });
  }

  // Add document context if available
  if (topDocs && topDocs.length > 0) {
    let docContext = 'Use the following help documentation only if it seems directly related to the issue:\n\n';
    topDocs.forEach((doc, index) => {
      const title = doc.metadata?.title || 'Untitled Document';
      const url = doc.metadata?.page || doc.metadata?.sourceURL || 'No URL';
      
      docContext += `### Document Title: ${title}\n- URL: ${url}\n- Summary:\n${doc.content}\n\n`;
    });

    messages.push({
      role: 'system',
      content: docContext,
    });
  }

  return messages;
}

export default async (request: Request, context: any) => {
  console.log("=== DEBUG: Generate Reply Function Starting ===");
  
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse request body
    const requestBody = await request.json();
    const { feedback_id } = requestBody;
    
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: 'feedback_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating reply for feedback_id: ${feedback_id}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch the feedback thread
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*, form:form_id(*)')
      .eq('id', feedback_id)
      .single();

    if (feedbackError || !feedback) {
      console.error('Error fetching feedback:', feedbackError);
      return new Response(JSON.stringify({ error: 'Feedback not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log("=== DEBUG: Customer Details ===");
    console.log(`User name: ${feedback.user_name}`);
    console.log(`User email: ${feedback.user_email}`);
    console.log(`First name extracted: ${feedback.user_name ? feedback.user_name.split(' ')[0] : 'N/A'}`);

    const form_id = feedback.form_id;
    console.log(`Retrieved form_id: ${form_id} for feedback`);

    // 2. Fetch all replies for this feedback
    const { data: replies, error: repliesError } = await supabase
      .from('feedback_replies')
      .select('*')
      .eq('feedback_id', feedback_id)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('Error fetching replies:', repliesError);
      return new Response(JSON.stringify({ error: 'Error fetching replies' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Generate embedding for the feedback message to find relevant documents
    const query = feedback.message || "";
    
    // Get embedding for the query using OpenAI API directly
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query,
      }),
    });
    
    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.json();
      console.error('OpenAI embedding error:', error);
      return new Response(JSON.stringify({ error: 'Error generating embedding' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;
    console.log(`Generated embedding for query with dimensions: ${queryEmbedding.length}`);

    // 4. Retrieve relevant documents from vector store
    const { data: topDocs, error: vecSearchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: TOP_K_DOCUMENTS,
        form_id_filter: form_id, // Filter by the current form_id
        use_latest_crawl: true,  // Use latest crawl data
      }
    );

    if (vecSearchError) {
      console.error('Error searching vector store:', vecSearchError);
      // Continue without documents if needed
    }

    console.log(`Retrieved ${topDocs?.length || 0} relevant documents`);

    // Prepare chat messages with context
    const messages = createChatMessages(feedback, replies || [], topDocs || []);
    console.log("=== DEBUG: OpenAI Request Messages ===");
    console.log(JSON.stringify(messages, null, 2));
    
    // 5. Call OpenAI with streaming
    const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const error = await streamResponse.json();
      console.error('OpenAI API error:', error);
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create a TransformStream to process the OpenAI response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process the streaming response in the background
    (async () => {
      try {
        if (!streamResponse.body) {
          writer.write(encoder.encode(formatSSE(JSON.stringify({ error: 'No response body' }), 'error')));
          writer.close();
          return;
        }

        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let completeResponse = '';
        
        console.log("=== DEBUG: Starting to process OpenAI stream ===");
        
        // SSE parsing based on OpenAI's streaming format
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Send a done event and close the stream
            console.log("=== DEBUG: OpenAI stream complete ===");
            console.log("=== DEBUG: Complete response from OpenAI ===");
            console.log(completeResponse);
            console.log("=== DEBUG: Checking for line breaks ===");
            console.log("Line breaks count:", (completeResponse.match(/\n/g) || []).length);
            console.log("First few lines:", completeResponse.split('\n').slice(0, 5));
            
            writer.write(encoder.encode(formatSSE('[DONE]', 'done')));
            writer.close();
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              // Check for [DONE] marker
              if (data === '[DONE]') {
                writer.write(encoder.encode(formatSSE('[DONE]', 'done')));
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  // Debug raw content chunks
                  completeResponse += content;
                  console.log(`Content chunk: "${content.replace(/\n/g, "\\n")}"`, content.length);
                  
                  // Preserve line breaks in SSE by explicitly converting to HTML line breaks
                  // This ensures line breaks survive all the way to the client
                  const contentWithPreservedBreaks = content
                    .replace(/\n\n/g, "[[DOUBLE_NEWLINE]]")
                    .replace(/\n/g, "[[NEWLINE]]");
                    
                  writer.write(encoder.encode(formatSSE(contentWithPreservedBreaks)));
                }
              } catch (e) {
                console.error('Error parsing JSON:', e, 'Line:', line);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing stream:', error);
        writer.write(encoder.encode(formatSSE(JSON.stringify({ error: 'Stream processing error' }), 'error')));
        writer.close();
      }
    })();

    // Return the stream immediately
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 