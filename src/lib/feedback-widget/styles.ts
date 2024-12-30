export function createStyles(buttonColor: string = '#1f2937') {
  return `
    .ub-modal {
      display: none;
      position: fixed;
      z-index: 10000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      width: 400px;
      max-width: calc(100vw - 2rem);
      padding: 1rem;
    }
    
    .ub-modal.open { display: block; }
    
    .ub-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    }
    
    .ub-backdrop.open { display: block; }
    
    .ub-textarea {
      width: 100%;
      min-height: 100px;
      margin: 1rem 0;
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      resize: vertical;
      font-family: inherit;
      font-size: 14px;
    }
    
    .ub-button {
      background: ${buttonColor};
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    }
    
    .ub-button:hover { 
      background: ${adjustBrightness(buttonColor, -10)}; 
    }
    
    .ub-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .ub-button-secondary {
      background: transparent;
      border: 1px solid #e5e7eb;
      color: #6b7280;
    }
    
    .ub-button-secondary:hover { background: #f3f4f6; }
    
    .ub-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    
    .ub-error {
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 0.5rem;
      display: none;
    }
  `
}

function adjustBrightness(hex: string, percent: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1)
}