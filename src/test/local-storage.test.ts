import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalStorageItem, setLocalStorageItem } from '../runtime/local-storage';

const originalLocalStorage = window.localStorage;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  });
});

describe('local-storage helpers', () => {
  it('reads and writes values when storage is available', () => {
    setLocalStorageItem('antistatic-test', 'value');
    expect(getLocalStorageItem('antistatic-test')).toBe('value');
    window.localStorage.removeItem('antistatic-test');
  });

  it('ignores storage access failures', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new Error('denied');
        }),
        setItem: vi.fn(() => {
          throw new Error('denied');
        }),
      },
    });

    expect(getLocalStorageItem('antistatic-test')).toBeUndefined();
    expect(() => setLocalStorageItem('antistatic-test', 'value')).not.toThrow();
  });
});
