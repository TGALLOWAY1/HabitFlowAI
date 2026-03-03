/**
 * Test Setup
 * 
 * Global test configuration and mocks.
 */

import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// Safety: set NODE_ENV=test so the mongoClient guard fires if any test
// accidentally connects to a non-test database.
process.env.NODE_ENV = 'test';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

