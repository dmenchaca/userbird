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
    }
    .userbird-button:hover {
      opacity: 0.9 !important;
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
      padding: 1rem;
    }
    .userbird-modal.open { display: block; }
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
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      resize: vertical;
    }
  `;
}