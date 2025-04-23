import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Loader } from 'lucide-react'
import { useWorkspaceSetupCheck } from '@/lib/hooks/useWorkspaceSetupCheck'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, initialized } = useAuth()
  const { needsSetupWizard, checkCompleted } = useWorkspaceSetupCheck()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (initialized && !loading && !user) {
      navigate('/login')
    }
  }, [user, loading, initialized, navigate])

  // Redirect to setup wizard when needed
  useEffect(() => {
    if (!user || !checkCompleted) return;

    // Case 1: User needs the setup wizard and isn't on it yet
    if (needsSetupWizard === true && location.pathname !== '/setup-workspace') {
      console.log('Redirecting to workspace setup wizard')
      navigate('/setup-workspace')
    } 
    // Case 2: User is on setup-workspace but doesn't need it anymore
    else if (needsSetupWizard === false && location.pathname === '/setup-workspace') {
      console.log('User no longer needs setup wizard, redirecting to dashboard')
      
      // Try to retrieve the last form ID from localStorage
      const lastFormId = user?.id ? localStorage.getItem(`userbird-last-form-${user.id}`) : null
      
      if (lastFormId) {
        // Redirect to the last viewed form if available
        navigate(`/forms/${lastFormId}`)
      } else {
        // Otherwise go to the dashboard
        navigate('/')
      }
    }
  }, [needsSetupWizard, user, navigate, location.pathname, checkCompleted])

  // Log the workspace setup check result when it changes
  useEffect(() => {
    if (needsSetupWizard !== null && user) {
      console.log('AuthGuard: Workspace setup wizard needed:', needsSetupWizard)
    }
  }, [needsSetupWizard, user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}