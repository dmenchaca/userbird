import posthog from 'posthog-js'

// Initialize PostHog client
const client = posthog.init(
  import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
  { 
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST
  }
)

export function trackEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  return client.capture(event, {
    distinct_id: distinctId,
    ...properties
  })
}

// Client-side shutdown is a no-op since browser events are sent immediately
export function shutdownPostHog() {
  return Promise.resolve()
}