import '@testing-library/jest-dom';
import type { MockedFunction } from 'vitest';
import { vi } from 'vitest';

// Extend global types for test environment
declare global {
  var __TEST_ENV__: boolean;

  interface Window {
    __TEST_ENV__: boolean;
  }
}

// Set test environment flag
globalThis.__TEST_ENV__ = true;
if (typeof window !== 'undefined') {
  window.__TEST_ENV__ = true;
}

// Mock IntersectionObserver with proper typing
global.IntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    private callback: IntersectionObserverCallback,
    private options?: IntersectionObserverInit
  ) {}

  disconnect(): void {}
  observe(target: Element): void {}
  unobserve(target: Element): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock ResizeObserver with proper typing
global.ResizeObserver = class MockResizeObserver implements ResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}

  disconnect(): void {}
  observe(target: Element, options?: ResizeObserverOptions): void {}
  unobserve(target: Element): void {}
};

// Mock matchMedia with proper typing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(
    (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
  ) as MockedFunction<(query: string) => MediaQueryList>,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn((key: string): string | null => null),
  setItem: vi.fn((key: string, value: string): void => {}),
  removeItem: vi.fn((key: string): void => {}),
  clear: vi.fn((): void => {}),
  length: 0,
  key: vi.fn((index: number): string | null => null),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn((key: string): string | null => null),
  setItem: vi.fn((key: string, value: string): void => {}),
  removeItem: vi.fn((key: string): void => {}),
  clear: vi.fn((): void => {}),
  length: 0,
  key: vi.fn((index: number): string | null => null),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn((object: any): string => 'mock-object-url'),
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn((url: string): void => {}),
});

// Mock fetch if not available
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn() as MockedFunction<typeof fetch>;
}

// Mock console methods for cleaner test output (but keep errors visible)
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: originalConsole.warn, // Keep warnings visible
  error: originalConsole.error, // Keep errors visible for debugging
};

// Restore console in afterEach if needed
export const restoreConsole = () => {
  global.console = originalConsole;
};

// Add unhandled rejection handler for better test debugging
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}
