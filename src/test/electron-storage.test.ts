import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectronStorage } from '../storage/electron';

const originalNodeAPI = window.nodeAPI;

afterEach(() => {
  vi.useRealTimers();
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
        readdirSync: vi.fn((directory: string) =>
          directory.includes('assets/stages')
            ? ['ruins.json', 'notes.txt']
            : ['carbon.json', 'carbon_anim.json', 'notes.txt']
        ),
        readFileSync: vi.fn(),
        writeFileAtomic: vi.fn(),
        watch: vi.fn(),
      },
      path: {
        resolve: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
        dirname: (value: string) => value.slice(0, value.lastIndexOf('/')),
        basename: (value: string) => value.split('/').pop() ?? value,
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

    await expect(storage.list()).resolves.toEqual([
      'carbon.json',
      'carbon_anim.json',
      'stages/ruins.json',
    ]);
  });

  it('routes stage reads and writes to the stage asset directory', async () => {
    installNodeAPI(true);
    const storage = new ElectronStorage('/game');

    await storage.read('stages/ruins.json');
    expect(window.nodeAPI.fs.readFileSync).toHaveBeenCalledWith(
      '/game/app/assets/stages/ruins.json',
      'utf8'
    );

    await storage.write('stages/ruins.json', '{}');
    expect(window.nodeAPI.fs.writeFileAtomic).toHaveBeenCalledWith(
      '/game/app/assets/stages/ruins.json',
      '{}'
    );
  });

  it('watches the containing directory so atomic replacements remain observable', () => {
    installNodeAPI(true);
    vi.useFakeTimers();
    const cleanup = vi.fn();
    const watch = vi.mocked(window.nodeAPI.fs.watch);
    watch.mockReturnValue(cleanup);
    const storage = new ElectronStorage('/game');
    const listener = vi.fn();

    const stop = storage.watch('carbon_anim.json', listener);
    expect(watch).toHaveBeenCalledWith(
      '/game/app/characters/data',
      expect.any(Function),
      expect.any(Function)
    );

    const directoryListener = watch.mock.calls[0][1] as unknown as (
      event: string,
      name: string | null
    ) => void;
    directoryListener('rename', 'carbon_anim.json');
    directoryListener('change', 'other.json');
    directoryListener('rename', null);
    expect(listener).toHaveBeenCalledTimes(2);

    const onError = watch.mock.calls[0][2] as unknown as (error: Error) => void;
    onError(new Error('watch failed'));
    vi.advanceTimersByTime(100);
    expect(watch).toHaveBeenCalledTimes(2);

    stop();
    expect(cleanup).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
