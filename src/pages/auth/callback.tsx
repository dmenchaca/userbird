import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useWorkspaceSetupCheck } from '@/lib/hooks/useWorkspaceSetupCheck'

export function CallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { needsSetupWizard } = useWorkspaceSetupCheck()

  // Log the workspace setup check result when it changes
  useEffect(() => {
    if (needsSetupWizard !== null) {
      console.log('Auth callback: Workspace setup wizard needed:', needsSetupWizard)
    }
  }, [needsSetupWizard])

  useEffect(() => {
    // Process the hash fragment first to extract the session
    const handleHashFragment = async () => {
      try {
        // This explicitly processes the URL hash for OAuth responses
        const { data, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }
        
        if (data?.session) {
          // Successfully got the session, now we can navigate
          navigate('/', { replace: true })
        } else {
          // Listen for auth state changes as a fallback
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              // If we get here, navigate and replace the history entry
              navigate('/', { replace: true })
            }
          })
          
          return () => subscription.unsubscribe()
        }
      } catch (err) {
        console.error('Error processing auth callback:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    }
    
    handleHashFragment()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <p className="text-destructive">Error: {error}</p>
        ) : (
          <p className="text-muted-foreground">Completing sign in...</p>
        )}
      </div>
    </div>
  )
}