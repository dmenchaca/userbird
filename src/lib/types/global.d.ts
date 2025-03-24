interface Window {
  UserBird?: {
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