# Feedback Images Edge Function

This Edge Function provides secure access to feedback images stored in a private Supabase bucket.

## Features

- **Secure Access Control**: Only users with admin or agent roles can access images
- **Role-Based Permissions**: Different expiry times based on user role
- **Optional Public Access**: Support for key-based access for public forms
- **Performance Optimized**: Uses signed URLs with redirects for efficiency

## Deployment

Deploy using the Supabase CLI:

```
supabase functions deploy feedback-images --no-verify-jwt
```

## Usage

Access images through the Edge Function URL:

```
https://[YOUR-PROJECT-REF].supabase.co/functions/v1/feedback-images/path/to/image.jpg
```

### Authenticated Requests

Include the Authorization header with a valid JWT:

```javascript
// Client-side example
const { data: imageBlob } = await supabase.functions.invoke('feedback-images', {
  body: { path: 'path/to/image.jpg' },
});

// Or using fetch directly
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/feedback-images/path/to/image.jpg',
  {
    headers: {
      Authorization: `Bearer ${supabase.auth.session()?.access_token}`,
    },
  }
);
```

### Usage in React/Next.js

```jsx
// Server Component example (Next.js App Router)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function FeedbackImageViewer({ imagePath }) {
  const supabase = createServerComponentClient({ cookies });
  
  // Call the Edge Function directly
  const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/feedback-images/${imagePath}`;
  
  // Get user session
  const { data: { session } } = await supabase.auth.getSession();
  
  // This can be used in an img tag src
  return `${functionUrl}?token=${session?.access_token || ''}`;
}
```

## Configuration Options

The function supports two strategies for serving images:

1. **Signed URL Redirect** (default): Generates a short-lived signed URL and redirects
2. **Direct Streaming**: Streams file content directly (uncomment in code to use) 