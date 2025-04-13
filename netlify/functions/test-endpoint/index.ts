import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  console.log('Test endpoint function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length,
    body: event.body ? JSON.parse(event.body) : null,
    headers: event.headers
  });

  // Return a success response with details about the request
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      method: event.httpMethod,
      bodyReceived: !!event.body,
      payload: event.body ? JSON.parse(event.body) : null,
      timestamp: new Date().toISOString()
    })
  };
};