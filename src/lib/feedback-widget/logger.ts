export const Logger = {
  debug: (message: string, ...args: any[]) => {
    console.log(`[Usermonk Debug] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[Usermonk Error] ${message}`, ...args);
  }
};