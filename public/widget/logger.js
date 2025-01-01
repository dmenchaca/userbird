// Logger utility for Userbird widget
const Logger = {
  debug: (message, ...args) => {
    console.log(`[Userbird Debug] ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[Userbird Error] ${message}`, ...args);
  }
};

export default Logger;