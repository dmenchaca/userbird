// Styles management
export function createStyles(buttonColor) {
  return `
    .userbird-button {
      background-color: ${buttonColor} !important;
      color: white !important;
      border: none !important;
      padding: 12px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-family: inherit !important;
      font-size: 14px !important;
      transition: opacity 0.2s !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      min-width: 120px !important;
      font-weight: 500 !important;
    }
    .userbird-button:hover {
      opacity: 0.9 !important;
    }
    .userbird-button:disabled {
      opacity: 0.7 !important;
      cursor: not-allowed !important;
    }
    .userbird-button-secondary {
      background: transparent !important;
      border: 1px solid #e5e7eb !important;
      color: #6b7280 !important;
      padding: 11px 19px !important;
    }
    .userbird-button-secondary:hover {
      background: #f3f4f6 !important;
      opacity: 1 !important;
    }
    .userbird-spinner {
      display: none;
      width: 16px !important;
      height: 16px !important;
      animation: userbird-spin 1s linear infinite !important;
    }
    .userbird-spinner-circle {
      opacity: 0.25;
    }
    .userbird-spinner-circle:nth-child(1) {
      opacity: 1;
      stroke-dasharray: 60;
      stroke-dashoffset: 60;
      animation: userbird-circle 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    .userbird-submit[disabled] .userbird-spinner {
      display: block !important;
    }
    .userbird-submit[disabled] .userbird-submit-text {
      opacity: 0.8 !important;
    }
    @keyframes userbird-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes userbird-circle {
      100% { stroke-dashoffset: 0; }
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
      position: relative;
    }
    .userbird-form {
      transition: opacity 0.2s;
    }
    .userbird-form.hidden {
      display: none;
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
    .userbird-success.open {
      display: block;
    }
    .userbird-success.open ~ .userbird-form {
      display: none;
    }
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