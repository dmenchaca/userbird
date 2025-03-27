export const WIDGET_STYLES = `
  .ub-modal {
    display: none;
    position: fixed;
    z-index: 10000;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    width: 400px;
    max-width: calc(100vw - 2rem);
  }
  
  .ub-modal.ub-open { display: block; }
  
  .ub-modal-content {
    padding: 1rem;
  }
  
  .ub-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  }
  
  .ub-backdrop.ub-open { display: block; }
  
  .ub-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  
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
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    border: none;
    background: #1f2937;
    color: white;
  }
  
  .ub-button:hover { background: #374151; }
  
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
    margin-top: 1rem;
  }
  
  .ub-error {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: 0.5rem;
    display: none;
  }

  .ub-success {
    display: none;
    text-align: center;
    padding: 2rem 1rem;
  }
  .ub-success.ub-open { display: block; }
  .ub-success-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    color: #22c55e;
  }
  .ub-success-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .ub-success-message {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }
  
  .ub-branding {
    text-align: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
  }
  .ub-branding-link {
    color: #9ca3af;
    font-size: 0.75rem;
    text-decoration: none;
  }
  .ub-branding-link:hover {
    text-decoration: underline;
  }
  .ub-branding.ub-hide {
    display: none;
  }
`;