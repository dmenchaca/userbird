import PostHog from 'posthog-node'

// Initialize PostHog client
const client = new PostHog(
  process.env.VITE_PUBLIC_POSTHOG_KEY!,
  { host: process.env.VITE_PUBLIC_POSTHOG_HOST }
)

export function trackEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  return client.capture({
    distinctId,
    event,
    properties
  })
}

// Ensure events are sent before the function terminates
export function shutdownPostHog() {
  return client.shutdown()
}