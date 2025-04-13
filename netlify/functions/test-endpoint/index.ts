import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // Log function invocation
  console.log('Test endpoint function invoked:', {
    timestamp: new Date().toISOString(),
    functionUrl: process.env.URL,
    functionName: 'test-endpoint'
  });

  // Log all incoming request details
  console.log('Test endpoint received request:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? JSON.parse(event.body) : null,
    rawBody: event.body,
    isBase64Encoded: event.isBase64Encoded,
    path: event.path,
    queryStringParameters: event.queryStringParameters
  });

  const response = {
    message: 'Test endpoint received request successfully',
    timestamp: new Date().toISOString(),
    requestDetails: {
      method: event.httpMethod,
      path: event.path,
      headers: event.headers
    }
  };

  console.log('Test endpoint sending response:', response);

  // Return success response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(response)
  };
};