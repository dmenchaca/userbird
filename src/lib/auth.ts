import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { trackEvent, shutdownPostHog, identifyUser } from './posthog'
import { linkPendingInvitations } from './utils/invitations'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Add additional scopes if needed
        scopes: 'email profile',
      }
    })
    if (error) throw error
  }

  useEffect(() => {
    // This variable tracks if the component is mounted
    let isMounted = true;
    
    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (isMounted) {
          setUser(session?.user ?? null)
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('Error initializing auth session:', error)
        if (isMounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }
    
    initSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      // Only update user if there's a change to avoid unnecessary re-renders
      if (
        (!user && session?.user) || 
        (user && !session?.user) || 
        (user && session?.user && user.id !== session.user.id)
      ) {
        setUser(session?.user ?? null)
      }
      
      // Identify user in PostHog when they sign in
      if (session?.user) {
        identifyUser(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
          provider: session.user.app_metadata?.provider
        });
        
        // Link any pending invitations to this user
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          try {
            await linkPendingInvitations();
          } catch (err) {
            console.error('Error linking invitations:', err);
            // Don't break auth flow if invitation linking fails
          }
        }
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

    // Cleanup function
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    }
  }, [user])

  return {
    user,
    loading,
    initialized,
    signInWithGoogle,
    signOut: () => supabase.auth.signOut(),
  }
}