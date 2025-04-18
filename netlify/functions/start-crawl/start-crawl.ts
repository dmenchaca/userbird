import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

// Environment variables validation
if (!process.env.FIRECRAWL_API_KEY) {
  console.error('FIRECRAWL_API_KEY environment variable is required');
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/crawl';

interface StartCrawlBody {
  url: string;
  form_id?: string;
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

    // Prepare the webhook URL
    const webhookUrl = new URL('/.netlify/functions/firecrawl-webhook', process.env.URL || 'https://your-site.netlify.app').toString();

    // Prepare request to Firecrawl
    const firecrawlRequest = {
      url,
      limit: 100,
      outputFormat: 'markdown',
      webhook: webhookUrl,
      metadata: form_id ? { form_id } : undefined,
    };

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