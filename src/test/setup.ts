/**
 * Test setup file
 * Runs before all tests to configure the test environment
 */

import { vi } from 'vitest';

// Mock canvas context for happy-dom
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: unknown[]) {
    if (contextType === '2d') {
      return {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        arc: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        canvas: this,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      } as any;
    }
    return originalGetContext.call(this, contextType, ...args);
  };
}

// Stub the library backend used by file-operations.save so unit tests can
// observe writes without a real Electron runtime.
vi.mock('../storage/library', async () => {
  const writes: { name: string; content: string }[] = [];
  const backend = {
    kind: 'electron' as const,
    label: '/mock',
    ready: true,
    canSave: true,
    async list() {
      return Array.from(writes.map((w) => w.name));
    },
    async read(n: string) {
      return writes.find((w) => w.name === n)?.content ?? '';
    },
    async write(n: string, c: string) {
      writes.push({ name: n, content: c });
    },
  };
  return {
    Library: class {},
    library: {
      getBackend: () => backend,
      setBackend: vi.fn(),
      label: '/mock',
      kind: 'electron',
      ready: true,
      canSave: true,
      async save(name: string, content: string) {
        await backend.write(name, content);
      },
      files: () => [],
      has: () => false,
      get: () => undefined,
      subscribe: () => () => {},
      refresh: async () => {},
    },
  };
});
