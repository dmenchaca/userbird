// Add extra test utilities
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock global fetch
global.fetch = jest.fn();

// Mock ResizeObserver (used by some UI components)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver (used by some UI components)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Reset all mocks automatically between tests
beforeEach(() => {
  jest.clearAllMocks();
}); 