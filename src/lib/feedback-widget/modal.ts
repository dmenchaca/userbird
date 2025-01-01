import { Logger } from './logger'
import { FORM_TEMPLATE, SUCCESS_TEMPLATE } from '../constants/html-templates'
import { FEEDBACK_MESSAGES as MSG } from '../constants/messages'

export function createModal() {
  const modal = document.createElement('div')
  const backdrop = document.createElement('div')
  
  modal.className = 'ub-modal'
  backdrop.className = 'ub-backdrop'
  
  modal.innerHTML = `
    <div class="ub-modal-content">
      ${FORM_TEMPLATE}
      ${SUCCESS_TEMPLATE}
    </div>
  `

  const textarea = modal.querySelector('.ub-textarea') as HTMLTextAreaElement
  const submitButton = modal.querySelector('.ub-submit') as HTMLButtonElement
  const errorElement = modal.querySelector('.ub-error') as HTMLDivElement
  const closeButton = modal.querySelector('.ub-close') as HTMLButtonElement

  document.body.appendChild(backdrop)
  document.body.appendChild(modal)

  function position(trigger: HTMLElement) {
    const triggerRect = trigger.getBoundingClientRect()
    const modalRect = modal.getBoundingClientRect()
    
    const spaceBelow = window.innerHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    
    if (spaceBelow >= modalRect.height + 8) {
      modal.style.top = `${triggerRect.bottom + 8}px`
      modal.style.transform = 'none'
    } else if (spaceAbove >= modalRect.height + 8) {
      modal.style.top = `${triggerRect.top - modalRect.height - 8}px`
      modal.style.transform = 'none'
    } else {
      modal.style.top = '50%'
      modal.style.transform = 'translateY(-50%)'
    }
    
    const left = Math.min(
      Math.max(8, triggerRect.left),
      window.innerWidth - modalRect.width - 8
    )
    modal.style.left = `${left}px`
  }

  return {
    open(trigger: HTMLElement) {
      Logger.debug('Opening modal')
      backdrop.classList.add('ub-open')
      modal.classList.add('ub-open')
      position(trigger)
      textarea.focus()
    },

    close() {
      Logger.debug('Closing modal')
      backdrop.classList.remove('ub-open')
      modal.classList.remove('ub-open')
      textarea.value = ''
      submitButton.disabled = false
      submitButton.textContent = MSG.labels.submit
      errorElement.style.display = 'none'
    },

    onSubmit(handler: (message: string) => void) {
      submitButton.addEventListener('click', () => {
        handler(textarea.value)
      })
    },

    onClose(handler: () => void) {
      backdrop.addEventListener('click', handler)
      closeButton.addEventListener('click', handler)
    },

    setSubmitting(isSubmitting: boolean) {
      submitButton.disabled = isSubmitting
      submitButton.textContent = isSubmitting ? MSG.labels.submitting : MSG.labels.submit
    },

    showError(message: string) {
      errorElement.textContent = message
      errorElement.style.display = 'block'
    }
  }
}