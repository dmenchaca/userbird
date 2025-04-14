import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Dashboard } from './dashboard'

export function FormView() {
  const { formId, ticketNumber } = useParams()
  const navigate = useNavigate()
  
  console.log('FormView params:', { formId, ticketNumber, ticketNumberType: typeof ticketNumber });

  // Handle old format redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryFormId = params.get('formId')
    if (queryFormId) {
      navigate(`/forms/${queryFormId}`, { replace: true })
    }
  }, [navigate])

  return <Dashboard initialFormId={formId} initialTicketNumber={ticketNumber} />
}