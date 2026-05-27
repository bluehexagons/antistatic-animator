import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectronStorage } from '../storage/electron';

const originalNodeAPI = window.nodeAPI;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'nodeAPI', {
    configurable: true,
    value: originalNodeAPI,
  });
});

const installNodeAPI = (exists: boolean) => {
  Object.defineProperty(window, 'nodeAPI', {
    configurable: true,
    value: {
      fs: {
        existsSync: vi.fn(() => exists),
        readdirSync: vi.fn(() => ['carbon.json', 'carbon_anim.json', 'notes.txt']),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        watch: vi.fn(),
      },
      path: {
        resolve: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
      },
      process: {
        cwd: () => '/game',
        platform: 'linux',
      },
    },
  });
};

describe('ElectronStorage', () => {
  it('is ready only when the character data directory exists', () => {
    installNodeAPI(true);
    expect(new ElectronStorage('/game').ready).toBe(true);

    installNodeAPI(false);
    expect(new ElectronStorage('/missing-game').ready).toBe(false);
  });

  it('returns an empty listing for a stale saved directory', async () => {
    installNodeAPI(false);
    const storage = new ElectronStorage('/missing-game');

    await expect(storage.list()).resolves.toEqual([]);
    expect(window.nodeAPI.fs.readdirSync).not.toHaveBeenCalled();
  });

  it('lists only json and jsonc files', async () => {
    installNodeAPI(true);
    const storage = new ElectronStorage('/game');

    await expect(storage.list()).resolves.toEqual(['carbon.json', 'carbon_anim.json']);
  });
});
