import { afterEach, describe, expect, it, vi } from 'vitest';

// setup.ts mocks '../storage/library' globally, so importActual bypasses the
// mock to give us the real Library class.
const getLibrary = async () => {
  const mod = await vi.importActual<typeof import('../storage/library')>('../storage/library');
  return mod.Library;
};

describe('Library', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with no backend', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    expect(lib.ready).toBe(false);
    expect(lib.canSave).toBe(false);
    expect(lib.label).toBe('(no source)');
    expect(lib.kind).toBe('none');
    expect(lib.files()).toEqual([]);
  });

  it('delegates kind/label/ready/canSave to the backend', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => []),
      read: vi.fn(),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    expect(lib.kind).toBe('electron');
    expect(lib.label).toBe('/game');
    expect(lib.ready).toBe(true);
    expect(lib.canSave).toBe(true);
  });

  it('caches files after refresh', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => ['a.json', 'b.jsonc']),
      read: vi.fn(async (name: string) => `content:${name}`),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    await lib.refresh();
    expect(lib.files()).toEqual([
      { name: 'a.json', content: 'content:a.json' },
      { name: 'b.jsonc', content: 'content:b.jsonc' },
    ]);
    expect(lib.has('a.json')).toBe(true);
    expect(lib.get('a.json')).toBe('content:a.json');
    expect(lib.has('missing.txt')).toBe(false);
  });

  it('save updates the in-memory cache', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => []),
      read: vi.fn(),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    await lib.save('test.json', '{"x":1}');
    expect(lib.get('test.json')).toBe('{"x":1}');
    expect(backend.write).toHaveBeenCalledWith('test.json', '{"x":1}');
  });

  it('save skips the backend write when canSave is false', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'upload' as const,
      label: 'Upload',
      ready: true,
      canSave: false,
      list: vi.fn(async () => []),
      read: vi.fn(),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    await lib.save('test.json', '{}');
    expect(backend.write).not.toHaveBeenCalled();
    expect(lib.get('test.json')).toBe('{}');
  });

  it('notifies subscribers on backend/save/refresh changes', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const listener = vi.fn();
    lib.subscribe(listener);

    lib.setBackend({
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => []),
      read: vi.fn(),
      write: vi.fn(),
    });
    expect(listener).toHaveBeenCalledTimes(1);

    await lib.save('x.json', '{}');
    expect(listener).toHaveBeenCalledTimes(2);

    await lib.refresh();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe removes the listener', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const listener = vi.fn();
    const unsub = lib.subscribe(listener);
    unsub();
    lib.setBackend({
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => []),
      read: vi.fn(),
      write: vi.fn(),
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it('handles refresh when no backend is set', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    await expect(lib.refresh()).resolves.toBeUndefined();
    expect(lib.files()).toEqual([]);
  });

  it('handles read errors gracefully during refresh', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => ['good.json', 'bad.json']),
      read: vi.fn(async (name: string) => {
        if (name === 'bad.json') throw new Error('read error');
        return 'ok';
      }),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await lib.refresh();
    expect(lib.has('good.json')).toBe(true);
    expect(lib.has('bad.json')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('clears the cache on setBackend and refresh', async () => {
    const Library = await getLibrary();
    const lib = new Library();
    const backend = {
      kind: 'electron' as const,
      label: '/game',
      ready: true,
      canSave: true,
      list: vi.fn(async () => ['a.json']),
      read: vi.fn(async () => 'content'),
      write: vi.fn(),
    };
    lib.setBackend(backend);
    await lib.refresh();
    expect(lib.files()).toHaveLength(1);

    lib.setBackend(null);
    expect(lib.files()).toHaveLength(0);
  });
});
