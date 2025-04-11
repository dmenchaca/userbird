// Type definitions for jest-dom
// Project: https://github.com/testing-library/jest-dom
// TypeScript Version: 3.8

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeEmpty(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeChecked(): R;
      toBePartiallyChecked(): R;
      toHaveAttribute(attr: string, value?: any): R;
      toHaveClass(...classNames: string[]): R;
      toHaveStyle(css: string | object): R;
      toHaveFocus(): R;
      toHaveFormValues(expectedValues: { [name: string]: any }): R;
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): R;
      toHaveValue(value?: string | string[] | number): R;
      toBeVisible(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toBeInTheDOM(): R;
    }
  }
} 