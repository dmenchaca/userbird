import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // Log all incoming request details
  console.log('Test endpoint received request:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? JSON.parse(event.body) : null,
    timestamp: new Date().toISOString()
  });

  // Return success response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Test endpoint received request successfully',
      timestamp: new Date().toISOString()
    })
  };
};