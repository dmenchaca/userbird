import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

export const handler: Handler = async (event) => {
  console.log('Test email reply function triggered:', {
    method: event.httpMethod,
    path: event.path
  });

  // Allow GET requests to show a test form
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Email Reply</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
            textarea { width: 100%; height: 200px; margin-bottom: 1rem; padding: 0.5rem; }
            input { padding: 0.5rem; margin-bottom: 1rem; width: 100%; }
            button { padding: 0.5rem 1rem; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <h1>Test Email Reply</h1>
          <form id="replyForm">
            <div>
              <label for="feedbackId">Feedback ID:</label>
              <input type="text" id="feedbackId" name="feedbackId" placeholder="Enter feedback ID" required>
            </div>
            <div>
              <label for="emailContent">Email Reply Content:</label>
              <textarea id="emailContent" name="emailContent" placeholder="Enter email content, including any reply text..." required>
This is my reply to your message.

--------------- Original Message ---------------
From: [user@example.com]
Sent: Mar 29, 2025, 5:30 PM
Subject: Feedback submitted by user@example.com

Original feedback message

Please do not modify this line or token as it may impact our ability to properly process your reply: thread::FEEDBACK_ID_GOES_HERE::
              </textarea>
            </div>
            <button type="submit">Send Test Reply</button>
          </form>
          <div id="result" style="margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; display: none;"></div>
          
          <script>
            const form = document.getElementById('replyForm');
            const result = document.getElementById('result');
            const feedbackIdInput = document.getElementById('feedbackId');
            const emailContentInput = document.getElementById('emailContent');
            
            // Replace placeholder with actual ID when entered
            feedbackIdInput.addEventListener('input', function() {
              emailContentInput.value = emailContentInput.value.replace('FEEDBACK_ID_GOES_HERE', this.value);
            });
            
            form.addEventListener('submit', async function(e) {
              e.preventDefault();
              
              const feedbackId = feedbackIdInput.value;
              const emailContent = emailContentInput.value;
              
              result.style.display = 'block';
              result.innerHTML = 'Sending test reply...';
              
              try {
                const response = await fetch('/.netlify/functions/process-email-reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'testuser@example.com',
                    to: 'support@userbird.co',
                    subject: 'Re: Feedback submitted by testuser@example.com',
                    text: emailContent
                  })
                });
                
                const data = await response.json();
                result.innerHTML = '<h3>Result:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
              } catch (error) {
                result.innerHTML = '<h3>Error:</h3><pre>' + error.message + '</pre>';
              }
            });
          </script>
        </body>
        </html>
      `
    };
  }
  
  return {
    statusCode: 405,
    body: 'Method Not Allowed'
  };
}; 