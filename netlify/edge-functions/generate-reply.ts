// No import needed for Context in Netlify Edge Functions
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
// Fix Netlify reference error by using process.env instead
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// System prompt for AI replies - optimized for token efficiency
const SYSTEM_PROMPT = `
You are a helpful, empathetic product support assistant. Generate a professional, accurate reply using the conversation history and documentation provided.
Be concise yet friendly. Reference docs only when relevant. Keep responses under 150 words.

IMPORTANT: Follow this exact format WITH EXACT LINE BREAKS:
Hi {first name},

Thank you for reaching out.

{Reply in short paragraphs}

Best,
{admin_first_name}

Break responses into short paragraphs for clarity.
For hyperlinks use: <a href="URL" target="_blank" rel="noopener noreferrer">Link text</a>
`;

// Number of top documents to retrieve - reduced to focus on most relevant
const TOP_K_DOCUMENTS = 5;
// Maximum conversation history to include
const MAX_CONVERSATION_HISTORY = 3;
// Token limit per document to save tokens
const MAX_TOKENS_PER_DOC = 500;
// Total token budget for documents
const MAX_DOC_TOKENS = 4000;

// Helper to format SSE message
function formatSSE(data: string, event?: string) {
  return event ? `event: ${event}\ndata: ${data}\n\n` : `data: ${data}\n\n`;
}

// Helper to create OpenAI chat messages
function createChatMessages(feedback: any, replies: any[], topDocs: any[], adminFirstName: string) {
  // Get user's first name
  let customerFirstName = "";
  if (feedback.user_name) {
    customerFirstName = feedback.user_name.split(' ')[0];
  } else if (feedback.user_email) {
    customerFirstName = feedback.user_email.split('@')[0];
  }
  
  // Start with system prompt
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT.replace('{admin_first_name}', adminFirstName) },
    // Add user name information explicitly
    { role: 'system', content: `The customer's first name is: ${customerFirstName}.` }
  ];

  // Add initial feedback as user message
  messages.push({
    role: 'user',
    content: feedback.message || 'No message content available',
  });

  // Only add the most recent conversation history to save tokens
  let filteredReplies = [...replies];
  if (replies.length > MAX_CONVERSATION_HISTORY) {
    // Keep the most recent MAX_CONVERSATION_HISTORY replies
    filteredReplies = replies.slice(-MAX_CONVERSATION_HISTORY);
    // Add a note about truncated history
    messages.push({
      role: 'system',
      content: `Note: There are ${replies.length} total messages in this conversation, but only showing the ${MAX_CONVERSATION_HISTORY} most recent for brevity.`
    });
  }

  // Add filtered replies to the conversation
  for (const reply of filteredReplies) {
    const role = reply.sender_type === 'admin' ? 'assistant' : 'user';
    const content = reply.html_content || reply.content || 'No content';
    messages.push({ role, content });
  }

  // Add document context if available - optimized for token efficiency
  if (topDocs && topDocs.length > 0) {
    // Sort docs by similarity to prioritize most relevant
    const sortedDocs = [...topDocs].sort((a, b) => b.similarity - a.similarity);
    
    let docContext = 'Use this documentation if directly relevant to the query:\n\n';
    let currentDocTokens = 0;
    let docCount = 0;
    
    for (const doc of sortedDocs) {
      // Only include docs with good similarity
      if (doc.similarity < 0.78) {
        console.log(`Skipping lower-similarity document: ${doc.metadata?.title || 'Untitled'} (${doc.similarity.toFixed(2)})`);
        continue;
      }
      
      const title = doc.metadata?.title || 'Untitled Document';
      const url = doc.metadata?.page || doc.metadata?.sourceURL || 'No URL';
      
      // Estimate token count - approximately 4 chars per token
      const estimatedTokens = Math.min(doc.content.length / 4, MAX_TOKENS_PER_DOC);
      
      // Skip if adding would exceed our token budget
      if (currentDocTokens + estimatedTokens > MAX_DOC_TOKENS) {
        console.log(`Skipping document ${title} to avoid token limit`);
        continue;
      }
      
      // Truncate content to save tokens
      let truncatedContent = doc.content;
      if (truncatedContent.length / 4 > MAX_TOKENS_PER_DOC) {
        console.log(`Truncating document: ${title}`);
        truncatedContent = truncatedContent.substring(0, MAX_TOKENS_PER_DOC * 4) + '... [truncated]';
      }
      
      docContext += `### ${title}\n- URL: ${url}\n${truncatedContent}\n\n`;
      currentDocTokens += (title.length + url.length + truncatedContent.length) / 4;
      docCount++;
      
      // Limit document count to save tokens
      if (docCount >= TOP_K_DOCUMENTS || currentDocTokens >= MAX_DOC_TOKENS) {
        console.log(`Limiting context to ${docCount} documents (${currentDocTokens.toFixed(0)} estimated tokens)`);
        break;
      }
    }

    messages.push({
      role: 'system',
      content: docContext,
    });
    
    console.log(`Estimated doc context tokens: ${currentDocTokens.toFixed(0)}`);
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
    const { feedback_id, admin_first_name } = requestBody;
    
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: 'feedback_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating reply for feedback_id: ${feedback_id}`);
    console.log(`Admin first name: ${admin_first_name || 'Not provided'}`);

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
    const originalQuery = feedback.message || "";
    
    // Clean and enhance the query to focus on key terms
    let query = originalQuery;
    
    // Extract the core question if it exists (often comes after greetings, before signatures)
    const questionMatch = originalQuery.match(/how\s+do\s+i\s+(.+?)\??(\s|$)/i);
    if (questionMatch) {
      // If there's a direct question like "How do I..."
      query = questionMatch[0];
    }
    
    // Look for specific keywords that should be emphasized
    const keyTerms = ['calendly', 'integration', 'integrate', 'connect'];
    const foundTerms = keyTerms.filter(term => originalQuery.toLowerCase().includes(term));
    
    if (foundTerms.length > 0) {
      // If specific terms are found, use them as the query to increase relevance
      query = foundTerms.join(' ');
    }
    
    console.log(`Original query: "${originalQuery}"`);
    console.log(`Enhanced query: "${query}"`);
    
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

    // Before vector search
    console.log(`Searching for documents matching: "${query}"`);
    console.log(`Using form_id_filter: ${form_id}`);

    // 4. Retrieve relevant documents from vector store with latest crawl first
    const { data: topDocs, error: vecSearchError } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: TOP_K_DOCUMENTS,
        form_id_filter: form_id,
        use_latest_crawl: true,  // Use latest crawl data
        similarity_threshold: 0.75  // Only include documents with at least 75% similarity
      }
    );

    if (vecSearchError) {
      console.error('Error searching vector store:', vecSearchError);
      // Continue without documents if needed
    }

    console.log(`Retrieved ${topDocs?.length || 0} relevant documents from latest crawl`);

    // Fallback: If no docs found or not enough, try again without the latest crawl restriction
    let finalDocs = topDocs || [];
    if (!finalDocs || finalDocs.length < 2) {
      console.log("Few or no documents found with latest crawl, trying with all crawls...");
      
      const { data: allCrawlDocs, error: allCrawlError } = await supabase.rpc(
        'match_documents',
        {
          query_embedding: queryEmbedding,
          match_count: TOP_K_DOCUMENTS,
          form_id_filter: form_id,
          use_latest_crawl: false,  // Use all crawls
          similarity_threshold: 0.7  // Slightly lower threshold for fallback
        }
      );
      
      if (allCrawlError) {
        console.error('Error searching all crawls:', allCrawlError);
      } else {
        finalDocs = allCrawlDocs || [];
        console.log(`Retrieved ${finalDocs.length || 0} relevant documents from all crawls`);
      }
    }

    // Last resort: If we're looking for specific terms like 'calendly' but didn't find them,
    // try a direct SQL lookup for documents with those terms in the title
    if (foundTerms.length > 0 && 
        (!finalDocs || 
         finalDocs.length === 0 || 
         !finalDocs.some(doc => 
           doc.metadata?.title?.toLowerCase().includes(foundTerms[0].toLowerCase())))) {
      
      console.log(`No documents found with '${foundTerms[0]}' in title, attempting direct lookup...`);
      
      try {
        // Direct query for documents with the term in the title
        const { data: directDocs, error: directError } = await supabase
          .from('documents')
          .select('*')
          .eq('form_id', form_id)
          .ilike('metadata->>title', `%${foundTerms[0]}%`)
          .limit(5);
        
        if (directError) {
          console.error('Error in direct document lookup:', directError);
        } else if (directDocs && directDocs.length > 0) {
          console.log(`Found ${directDocs.length} documents with '${foundTerms[0]}' in title via direct lookup`);
          
          // Format these docs to match the structure expected by the rest of the code
          const formattedDirectDocs = directDocs.map(doc => ({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata,
            similarity: 0.8, // Assign a reasonable similarity score
            form_id: doc.form_id,
            crawl_timestamp: doc.crawl_timestamp
          }));
          
          // Add these to our final docs, potentially replacing less relevant ones
          finalDocs = [...formattedDirectDocs, ...finalDocs].slice(0, TOP_K_DOCUMENTS);
        }
      } catch (directQueryError) {
        console.error('Exception in direct document lookup:', directQueryError);
      }
    }

    // After vector search
    if (finalDocs && finalDocs.length > 0) {
      console.log("=== Vector Search Results Details ===");
      finalDocs.forEach((doc, i) => {
        console.log(`Result ${i+1}:`);
        console.log(`- Title: ${doc.metadata?.title || 'No title'}`);
        console.log(`- URL: ${doc.metadata?.page || 'No URL'}`);
        console.log(`- Similarity: ${doc.similarity.toFixed(4)}`);
        console.log(`- Crawl timestamp: ${doc.crawl_timestamp}`);
        console.log(`- Content preview: ${doc.content.substring(0, 100)}...`);
      });
    }

    // Use a default name if none provided
    const finalAdminFirstName = admin_first_name || 'Support';

    // Prepare chat messages with context
    const messages = createChatMessages(feedback, replies || [], finalDocs || [], finalAdminFirstName);
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
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        stream: true,
        max_tokens: 500, // Set maximum response length
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