import { FEEDBACK_MESSAGES as MSG } from './messages'

export const SUCCESS_TEMPLATE = `
  <div class="ub-success">
    <svg class="ub-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <h3 class="ub-success-title">${MSG.success.title}</h3>
    <p class="ub-success-message">${MSG.success.description}</p>
    <img src="${MSG.success.gifUrl}" alt="Success GIF" class="ub-success-gif" />
    <button class="ub-button ub-close">${MSG.labels.close}</button>
  </div>
`

export const FORM_TEMPLATE = `
  <h3 class="ub-title">Send Feedback</h3>
  <textarea class="ub-textarea" placeholder="${MSG.placeholders.textarea}"></textarea>
  <div class="ub-error"></div>
  <div class="ub-buttons">
    <button class="ub-button ub-button-secondary ub-close">${MSG.labels.cancel}</button>
    <button class="ub-button ub-submit">${MSG.labels.submit}</button>
  </div>
`