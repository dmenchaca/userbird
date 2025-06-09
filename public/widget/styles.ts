// Widget styles
export const styles = `
  .usermonk-modal {
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
  .usermonk-modal.open { display: block; }
  .usermonk-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  }
  .usermonk-backdrop.open { display: block; }
  .usermonk-textarea {
    width: 100%;
    min-height: 100px;
    margin: 1rem 0;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    resize: vertical;
  }
  .usermonk-button {
    background: #1f2937;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .usermonk-button:hover { background: #374151; }
  .usermonk-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .usermonk-close {
    background: transparent;
    border: 1px solid #e5e7eb;
    color: #6b7280;
  }
  .usermonk-close:hover { background: #f3f4f6; }
  .usermonk-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .usermonk-error {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    display: none;
  }
`;