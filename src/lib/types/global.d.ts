interface Window {
  UserMonk?: {
    formId?: string;
    open?: (trigger?: HTMLElement) => void;
    user?: {
      id?: string;
      email?: string;
      name?: string;
    };
    showGifOnSuccess?: boolean;
  }
}