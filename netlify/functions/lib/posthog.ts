import PostHogNode from 'posthog-node'

// Initialize PostHog client
const client = new PostHogNode(
  process.env.VITE_PUBLIC_POSTHOG_KEY || '',
  { 
    host: process.env.VITE_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    flushAt: 1, // Flush immediately since we're in a serverless function
    flushInterval: 0 // Disable automatic flushing
  }
)

export async function trackEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  try {
    await client.capture({
      distinctId,
      event,
      properties
    })
  } catch (error) {
    console.error('PostHog tracking error:', error)
  }
}

// Ensure events are sent before the function terminates
export async function shutdownPostHog() {
  try {
    await client.flush()
    await client.shutdown()
  } catch (error) {
    console.error('PostHog shutdown error:', error)
  }
}