// Logging utility
export const Logger = {
  debug: (message: string, ...args: any[]) => {
    console.log(`[Userbird Debug] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[Userbird Error] ${message}`, ...args);
  }
};