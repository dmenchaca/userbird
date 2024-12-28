// Widget styles
export const styles = `
  .userbird-modal {
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
  .userbird-button {
    background: #1f2937;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .userbird-button:hover { background: #374151; }
  .userbird-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .userbird-close {
    background: transparent;
    border: 1px solid #e5e7eb;
    color: #6b7280;
  }
  .userbird-close:hover { background: #f3f4f6; }
  .userbird-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .userbird-error {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    display: none;
  }
`;