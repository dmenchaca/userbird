import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Loader } from 'lucide-react'
import { useWorkspaceSetupCheck } from '@/lib/hooks/useWorkspaceSetupCheck'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, initialized } = useAuth()
  const { needsSetupWizard } = useWorkspaceSetupCheck()
  const navigate = useNavigate()

  useEffect(() => {
    if (initialized && !loading && !user) {
      navigate('/login')
    }
  }, [user, loading, initialized, navigate])

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