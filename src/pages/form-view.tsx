import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Dashboard } from './dashboard'

export function FormView() {
  const { formId } = useParams()
  const navigate = useNavigate()
  const [showInstructions, setShowInstructions] = useState(true)

  // Handle old format redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryFormId = params.get('formId')
    if (queryFormId) {
      navigate(`/forms/${queryFormId}`, { replace: true })
    }
  }, [navigate])

  return <Dashboard 
    initialFormId={formId} 
    showInstallInstructions={showInstructions}
    onInstructionsClose={() => setShowInstructions(false)}
  />
}