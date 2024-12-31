// Styles management
export function createStyles(buttonColor) {
  return `
    .userbird-button {
      background-color: ${buttonColor} !important;
      color: white !important;
      border: none !important;
      padding: 8px 16px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-family: inherit !important;
      font-size: 14px !important;
      transition: opacity 0.2s !important;
    }
    .userbird-button:hover {
      opacity: 0.9 !important;
    }
    .userbird-button-secondary {
      background: transparent !important;
      border: 1px solid #e5e7eb !important;
      color: #6b7280 !important;
    }
    .userbird-button-secondary:hover {
      background: #f3f4f6 !important;
      opacity: 1 !important;
    }
    .userbird-modal {
      display: none;
      position: fixed;
      z-index: 10000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      width: 400px;
      max-width: calc(100vw - 2rem);
    }
    .userbird-modal.open { display: block; }
    .userbird-modal-content {
      padding: 1.5rem;
    }
    .userbird-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #111827;
    }
    .userbird-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    }
    .userbird-backdrop.open { display: block; }
    .userbird-textarea {
      width: 100%;
      min-height: 100px;
      margin: 1rem 0;
      padding: 0.75rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      resize: vertical;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      transition: border-color 0.2s;
    }
    .userbird-textarea:focus {
      outline: none;
      border-color: ${buttonColor};
      box-shadow: 0 0 0 2px ${buttonColor}33;
    }
    .userbird-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .userbird-error {
      display: none;
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
    .userbird-success {
      display: none;
      text-align: center;
      padding: 2rem 1rem;
    }
    .userbird-success.open { display: block; }
    .userbird-success-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      color: #22c55e;
    }
    .userbird-success-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #111827;
    }
    .userbird-success-message {
      color: #6b7280;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
    }
  `;
}