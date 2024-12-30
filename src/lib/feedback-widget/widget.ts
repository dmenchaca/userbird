import { createModal } from './modal'
import { createTrigger } from './trigger'
import { submitFeedback } from '../services/feedback'
import { Logger } from './logger'
import { supabase } from '../supabase'

async function getFormStyle(formId: string) {
  try {
    const { data, error } = await supabase
      .from('forms')
      .select('button_color')
      .eq('id', formId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    Logger.error('Error fetching form style:', error)
    return null
  }
}

export async function createWidget(formId: string) {
  const formStyle = await getFormStyle(formId)
  const modal = createModal(formStyle?.button_color)
  const trigger = createTrigger(formId, formStyle?.button_color)

  if (!trigger) {
    Logger.error('Trigger element not found')
    return
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    modal.open(trigger)
  })

  modal.onSubmit(async (message) => {
    if (!message.trim()) return

    modal.setSubmitting(true)
    
    try {
      await submitFeedback({ formId, message })
      modal.close()
    } catch (error) {
      modal.showError('Failed to submit feedback')
      Logger.error('Failed to submit feedback:', error)
    } finally {
      modal.setSubmitting(false)
    }
  })

  modal.onClose(() => modal.close())
}