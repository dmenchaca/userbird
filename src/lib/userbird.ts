// Widget manager singleton
class WidgetManager {
  private static instance: WidgetManager;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  private constructor() {}

  static getInstance(): WidgetManager {
    if (!this.instance) {
      this.instance = new WidgetManager();
    }
    return this.instance;
  }

  async init(formId: string): Promise<boolean> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.initialized) {
      return Promise.resolve(true);
    }

    // Create new initialization promise
    this.initPromise = new Promise((resolve, reject) => {
      try {
        window.UserMonk = window.UserMonk || {};
        window.UserMonk.formId = formId;
        
        const script = document.createElement('script');
        script.src = 'https://usermonk.netlify.app/widget.js';
        
        script.onload = () => {
          this.initialized = true;
          resolve(true);
        };
        
        script.onerror = () => {
          this.initPromise = null;
          reject(new Error('Failed to load Usermonk widget'));
        };
        
        document.head.appendChild(script);
      } catch (error) {
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }
}

// Export initialization function that uses the singleton
export function initUsermonk(formId: string): Promise<boolean> {
  return WidgetManager.getInstance().init(formId);
}