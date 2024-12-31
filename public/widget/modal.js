// Modal functionality
export function createModal() {
  const modal = document.createElement('div');
  const backdrop = document.createElement('div');
  
  modal.className = 'userbird-modal';
  backdrop.className = 'userbird-backdrop';
  
  modal.innerHTML = `
    <h3>Send Feedback</h3>
    <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
    <div class="userbird-buttons">
      <button class="userbird-close">Cancel</button>
      <button class="userbird-submit">Send</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  return {
    modal,
    backdrop,
    textarea: modal.querySelector('.userbird-textarea'),
    submitButton: modal.querySelector('.userbird-submit'),
    closeButton: modal.querySelector('.userbird-close')
  };
}