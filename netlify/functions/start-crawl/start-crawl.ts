import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

// Environment variables validation
if (!process.env.FIRECRAWL_API_KEY) {
  console.error('FIRECRAWL_API_KEY environment variable is required');
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/crawl';

interface StartCrawlBody {
  url: string;
  form_id: string;
}

// Define type for Firecrawl request to match their API
interface FirecrawlRequest {
  url: string;
  limit: number;
  webhook: {
    url: string;
    metadata: Record<string, any>;
    events: string[];
  };
  scrapeOptions: {
    formats: string[];
    onlyMainContent: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the request body
    const body: StartCrawlBody = JSON.parse(event.body || '{}');
    const { url, form_id } = body;
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' }),
      };
    }
    
    // Require form_id
    if (!form_id) {
      console.error('Missing required parameter: form_id');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'form_id is required' }),
      };
    }
    
    console.log(`Starting crawl for URL: ${url} with form_id: ${form_id}`);

    // Prepare the webhook URL
    const webhookUrl = new URL('/.netlify/functions/firecrawl-webhook', process.env.URL || 'https://your-site.netlify.app').toString();

    // Prepare request to Firecrawl with updated format
    const firecrawlRequest: FirecrawlRequest = {
      url,
      limit: 100,
      webhook: {
        url: webhookUrl,
        metadata: { form_id },
        events: ["page"]
      },
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true
      }
    };
    
    console.log('Sending request to Firecrawl with metadata:', JSON.stringify(firecrawlRequest.webhook.metadata));

    // Call Firecrawl API
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify(firecrawlRequest),
    });

    // Get the response data
    const data = await response.json();
    
    console.log('Firecrawl response:', JSON.stringify(data));

    // Return Firecrawl response
    return {
      statusCode: response.status,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error in start-crawl function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 