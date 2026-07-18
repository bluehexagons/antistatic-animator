import { afterEach, describe, expect, it, vi } from 'vitest';
import { FsAccessStorage } from '../storage/fs-access';
import type { FsDirHandle, FsFileHandle, FsWritable } from '../storage/fs-access';

// Build a mock directory handle tree with the given file names.
const mockDirHandle = (files: string[]): FsDirHandle => {
  const entries = files.map((name) => ({
    kind: 'file' as const,
    name,
  }));
  return {
    kind: 'directory',
    name: 'data',
    values() {
      return (async function* () {
        for (const e of entries) yield e;
      })();
    },
    getDirectoryHandle: vi.fn().mockRejectedValue(new Error('not found')),
    getFileHandle: vi.fn(
      async (name: string): Promise<FsFileHandle> => ({
        kind: 'file',
        name,
        getFile: async () => new File([JSON.stringify({ name })], name),
        createWritable: async (): Promise<FsWritable> => ({
          write: vi.fn(),
          close: vi.fn(),
        }),
      })
    ),
  };
};

describe('FsAccessStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.showDirectoryPicker;
  });

  it('ready is false when no directory has been picked', () => {
    const storage = new FsAccessStorage();
    expect(storage.ready).toBe(false);
  });

  it('initially has an empty listing', async () => {
    const storage = new FsAccessStorage();
    await expect(storage.list()).resolves.toEqual([]);
  });

  it('is ready and lists files after picking a directory', async () => {
    const handle = mockDirHandle(['carbon.json', 'carbon_anim.jsonc']);
    window.showDirectoryPicker = vi.fn(async () => handle);
    const storage = new FsAccessStorage();
    const ok = await storage.pickRoot();
    expect(ok).toBe(true);
    expect(storage.ready).toBe(true);
    await expect(storage.list()).resolves.toEqual(['carbon.json', 'carbon_anim.jsonc']);
  });

  it('reads file content from the directory handle', async () => {
    const handle = mockDirHandle(['carbon.json']);
    window.showDirectoryPicker = vi.fn(async () => handle);
    const storage = new FsAccessStorage();
    await storage.pickRoot();
    const content = await storage.read('carbon.json');
    expect(content).toBe(JSON.stringify({ name: 'carbon.json' }));
  });

  it('writes file content through the directory handle', async () => {
    const handle = mockDirHandle([]);
    window.showDirectoryPicker = vi.fn(async () => handle);
    const storage = new FsAccessStorage();
    await storage.pickRoot();
    await expect(storage.write('test.json', '{"a":1}')).resolves.toBeUndefined();
  });

  it('throws on read/write when no directory is selected', async () => {
    const storage = new FsAccessStorage();
    await expect(storage.read('x.json')).rejects.toThrow(/no directory selected/);
    await expect(storage.write('x.json', '{}')).rejects.toThrow(/no directory selected/);
  });

  it('returns false from pickRoot when showDirectoryPicker is unavailable', async () => {
    const storage = new FsAccessStorage();
    const ok = await storage.pickRoot();
    expect(ok).toBe(false);
  });

  it('filters to JSON/JSONC files (notes.txt excluded)', async () => {
    const handle = mockDirHandle(['carbon.json', 'notes.txt', 'readme.md', 'data_anim.jsonc']);
    window.showDirectoryPicker = vi.fn(async () => handle);
    const storage = new FsAccessStorage();
    await storage.pickRoot();
    await expect(storage.list()).resolves.toEqual(['carbon.json', 'data_anim.jsonc']);
  });

  it('provides a label after picking', async () => {
    const handle = mockDirHandle([]);
    window.showDirectoryPicker = vi.fn(async () => handle);
    const storage = new FsAccessStorage();
    expect(storage.label).toBe('(no folder selected)');
    await storage.pickRoot();
    expect(storage.label).toBe('data');
  });

  it('discovers character and stage files from an Antistatic repository root', async () => {
    const characters = mockDirHandle(['carbon.json', 'carbon_anim.json']);
    const stages = mockDirHandle(['ruins.json']);
    const directory = (name: string, children: Record<string, FsDirHandle>): FsDirHandle => ({
      kind: 'directory',
      name,
      values: () =>
        (async function* () {
          for (const child of Object.values(children)) yield child;
        })(),
      getDirectoryHandle: vi.fn(async (child: string) => {
        if (!children[child]) throw new Error('not found');
        return children[child];
      }),
      getFileHandle: vi.fn().mockRejectedValue(new Error('not a file directory')),
    });
    const root = directory('antistatic', {
      app: directory('app', {
        characters: directory('characters', { data: characters }),
        assets: directory('assets', { stages }),
      }),
    });
    window.showDirectoryPicker = vi.fn(async () => root);
    const storage = new FsAccessStorage();

    await storage.pickRoot();
    await expect(storage.list()).resolves.toEqual([
      'carbon.json',
      'carbon_anim.json',
      'stages/ruins.json',
    ]);
    await storage.read('stages/ruins.json');
    expect(stages.getFileHandle).toHaveBeenCalledWith('ruins.json');
  });
});
