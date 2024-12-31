import { TEMPLATES } from './constants';

export function createModal() {
  const modal = document.createElement('div');
  const backdrop = document.createElement('div');
  
  modal.className = 'userbird-modal';
  backdrop.className = 'userbird-backdrop';
  
  modal.innerHTML = TEMPLATES.MODAL;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  return {
    modal,
    backdrop,
    textarea: modal.querySelector('.userbird-textarea'),
    submitButton: modal.querySelector('.userbird-submit'),
    closeButton: modal.querySelector('.userbird-close'),
    errorElement: modal.querySelector('.userbird-error'),
    successElement: modal.querySelector('.userbird-success')
  };
}