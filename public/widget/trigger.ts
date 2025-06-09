// Trigger button functionality
export function createTriggerButton(formId: string) {
  const existingTrigger = document.getElementById(`usermonk-trigger-${formId}`);
  if (existingTrigger) return existingTrigger;

  const trigger = document.createElement('button');
  trigger.id = `usermonk-trigger-${formId}`;
  trigger.className = 'usermonk-trigger';
  trigger.textContent = 'Feedback';
  trigger.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9998;
    padding: 8px 16px;
    background: #1f2937;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
  `;

  document.body.appendChild(trigger);
  return trigger;
}