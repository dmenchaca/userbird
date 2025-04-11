import posthog from 'posthog-js'

// Check if we're in a test environment
const isTesting = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

// Initialize PostHog client (skip if in test environment)
if (!isTesting) {
  posthog.init(
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
    { 
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST
    }
  )
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (isTesting) return;
  posthog.identify(userId, properties);
}

export function trackEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  if (isTesting) return Promise.resolve();
  return posthog.capture(event, {
    distinct_id: distinctId,
    ...properties
  })
}

// Client-side shutdown is a no-op since browser events are sent immediately
export function shutdownPostHog() {
  return Promise.resolve()
}