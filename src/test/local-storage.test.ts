import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalStorageItem, setLocalStorageItem } from '../runtime/local-storage';

// happy-dom in Node doesn't provide localStorage; mock it.
const fakeStorage = new Map<string, string>();
const mockStorage = {
  getItem: vi.fn((key: string) => fakeStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    fakeStorage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    fakeStorage.delete(key);
  }),
  clear: vi.fn(() => {
    fakeStorage.clear();
  }),
};

beforeEach(() => {
  fakeStorage.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: mockStorage,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local-storage helpers', () => {
  it('reads and writes values when storage is available', () => {
    setLocalStorageItem('antistatic-test', 'value');
    expect(getLocalStorageItem('antistatic-test')).toBe('value');
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
