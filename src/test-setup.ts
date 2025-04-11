// This file sets up the jest-dom matchers for TypeScript
import '@testing-library/jest-dom';

// Extend expect
import { expect } from '@jest/globals';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare global {
  namespace jest {
    interface Matchers<R = void> extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
  }
} 