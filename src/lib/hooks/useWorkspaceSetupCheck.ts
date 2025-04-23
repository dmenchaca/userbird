import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function useWorkspaceSetupCheck() {
  const { user } = useAuth()
  const [needsSetupWizard, setNeedsSetupWizard] = useState<boolean | null>(null)
  const [checkCompleted, setCheckCompleted] = useState(false)

  useEffect(() => {
    // Only check once we have a user
    if (!user?.id) return

    const checkForSetupWizard = async () => {
      try {
        // Check if the user owns any forms
        const { count: formCount, error: formError } = await supabase
          .from('forms')
          .select('*', { count: 'exact' })
          .eq('owner_id', user.id)
        
        if (formError) {
          console.error('Error checking user forms:', formError)
          return
        }

        // Check if the user has any form collaborators
        const { count: collaboratorCount, error: collaboratorError } = await supabase
          .from('form_collaborators')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
        
        if (collaboratorError) {
          console.error('Error checking form collaborators:', collaboratorError)
          return
        }
        
        // User needs the setup wizard if they have no forms and no collaborations
        const showWizard = (!formCount || formCount === 0) && (!collaboratorCount || collaboratorCount === 0)
        
        // Log the result for debugging
        console.log('Workspace setup wizard check:', { 
          showWizard,
          formCount: formCount || 0,
          collaboratorCount: collaboratorCount || 0
        })
        
        setNeedsSetupWizard(showWizard)
        setCheckCompleted(true)
      } catch (error) {
        console.error('Error in workspace setup check:', error)
      }
    }

    checkForSetupWizard()
  }, [user?.id])

  return { needsSetupWizard, checkCompleted }
} 