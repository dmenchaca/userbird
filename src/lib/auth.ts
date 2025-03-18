import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { trackEvent, shutdownPostHog, identifyUser } from './posthog'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) throw error
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      setInitialized(true)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      
      // Identify user in PostHog when they sign in
      if (session?.user) {
        identifyUser(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
          provider: session.user.app_metadata?.provider
        });
      }
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await trackEvent('user_login', session?.user?.id || 'anonymous', {
          provider: session?.user?.app_metadata?.provider || 'email'
        })
      } else if (event === 'INITIAL_SESSION') {
        await trackEvent('account_create', session?.user?.id || 'anonymous', {
          provider: session?.user?.app_metadata?.provider || 'email'
        })
      }
      
      await shutdownPostHog()
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    loading,
    initialized,
    signInWithGoogle,
    signOut: () => supabase.auth.signOut(),
  }
}