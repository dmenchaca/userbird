import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Loader } from 'lucide-react'
import { useWorkspaceSetupCheck } from '@/lib/hooks/useWorkspaceSetupCheck'

// Simple utility function to update Usermonk with user data
function updateUsermonkUserData(user: any) {
  if (!user || typeof window.UserMonk === 'undefined') return;
  
  try {
    // Get user display name from metadata
    const name = user.user_metadata?.full_name || 
                user.user_metadata?.name || 
                user.email;
    
    // Try the setUserInfo method first if available
    if (typeof (window.UserMonk as any).setUserInfo === 'function') {
      (window.UserMonk as any).setUserInfo({
        id: user.id,
        email: user.email,
        name: name
      });
      // console.log('Updated Usermonk widget with user data using setUserInfo');
    } 
    // Fall back to directly setting the properties
    else {
      (window.UserMonk as any).email = user.email;
      (window.UserMonk as any).name = name;
      (window.UserMonk as any).userId = user.id;
              // console.log('Updated Usermonk widget with user data directly');
    }
  } catch (error) {
    console.error('Error updating Usermonk user data:', error);
  }
}

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

  // Update the Usermonk widget with user data when available
  useEffect(() => {
    if (user) {
      updateUsermonkUserData(user);
    }
  }, [user]);

  // --- Onboarding resume logic ---
  useEffect(() => {
    if (!user || !checkCompleted) return;

    // New onboarding completion and step logic
    const completedKey = `usermonk-onboarding-completed-${user.id}`;
    const stepKey = `usermonk-onboarding-step-${user.id}`;
    const completed = localStorage.getItem(completedKey);
    if (completed === 'true') {
      // Onboarding is completed, never show wizard
      if (location.pathname === '/setup-workspace') {
        // If user somehow lands on wizard, redirect to dashboard
        navigate('/', { replace: true });
      }
      return;
    }
    // Check onboarding progress in localStorage
    const saved = localStorage.getItem(stepKey);
    let onboardingInProgress = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.step === 'number' &&
          parsed.step >= 2 &&
          typeof parsed.formId === 'string' &&
          parsed.formId.length > 0
        ) {
          onboardingInProgress = true;
        }
      } catch {}
    }

    // If onboarding is in progress and not already on the wizard, force redirect
    if (onboardingInProgress && location.pathname !== '/setup-workspace') {
      navigate('/setup-workspace', { replace: true });
      return;
    }

    // Case 1: User needs the setup wizard and isn't on it yet
    if (!onboardingInProgress && needsSetupWizard === true && location.pathname !== '/setup-workspace') {
      console.log('Redirecting to workspace setup wizard')
      navigate('/setup-workspace')
    } 
    // Case 2: User is on setup-workspace but doesn't need it anymore
    else if (!onboardingInProgress && needsSetupWizard === false && location.pathname === '/setup-workspace') {
      console.log('User no longer needs setup wizard, redirecting to dashboard')
      // Try to retrieve the last form ID from localStorage
      const lastFormId = user?.id ? localStorage.getItem(`usermonk-last-form-${user.id}`) : null
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
      // console log removed
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