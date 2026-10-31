import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectronStorage } from '../storage/electron';
import { Library } from '../storage/library';
import { pickElectronSource } from '../storage/switch-electron';
import { isApplicationUrl } from '../runtime/renderer-policy';

vi.unmock('../storage/library');
const originalNode = window.nodeAPI;
const originalElectron = window.electronAPI;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'nodeAPI', { configurable: true, value: originalNode });
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: originalElectron });
});

async function sourceFixture() {
  let root = '';
  const assertRoot = (filename: string) => {
    if (!filename.startsWith(`${root}/`)) throw new Error('unauthorized project');
  };
  Object.defineProperty(window, 'nodeAPI', {
    configurable: true,
    value: {
      fs: {
        setRoot: vi.fn((value: string) => {
          root = value;
        }),
        isDirectory: (filename: string) => {
          assertRoot(filename);
          return true;
        },
        readdirSync: (filename: string) => {
          assertRoot(filename);
          return ['carbon.json'];
        },
        readFileSync: (filename: string) => {
          assertRoot(filename);
          return '{}';
        },
        writeFileAtomic: vi.fn((filename: string) => assertRoot(filename)),
      },
      path: {
        resolve: (...parts: string[]) => parts.join('/'),
        basename: (value: string) => value.split('/').pop(),
      },
    },
  });
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      showOpenDialog: vi.fn(async () => ({ filePaths: ['/project-b'] })),
    },
  });
  const previous = new ElectronStorage('/project-a');
  const library = new Library();
  library.setBackend(previous);
  await library.refresh();
  return { previous, library, root: () => root };
}

describe('Electron source selection', () => {
  it('keeps the old project authorized when discarding edits is declined', async () => {
    const { previous, library, root } = await sourceFixture();
    await expect(pickElectronSource(library, () => false)).resolves.toBeNull();
    expect(root()).toBe('/project-a');
    expect(library.getBackend()).toBe(previous);
    expect(library.get('carbon.json')).toBe('{}');
    await expect(previous.read('carbon.json')).resolves.toBe('{}');
    await expect(previous.write('carbon.json', '{}')).resolves.toBeUndefined();
  });

  it('restores native authorization before refreshing a failed switch', async () => {
    const { previous, library, root } = await sourceFixture();
    const failure = new Error('refresh failed');
    vi.spyOn(library, 'refresh').mockRejectedValueOnce(failure);
    await expect(pickElectronSource(library, () => true)).rejects.toBe(failure);
    expect(root()).toBe('/project-a');
    expect(library.getBackend()).toBe(previous);
    expect(library.get('carbon.json')).toBe('{}');
    await expect(previous.write('carbon.json', '{}')).resolves.toBeUndefined();
  });
});

it('restricts native IPC and navigation to the application document', () => {
  const app = 'file:///opt/animator/dist/index.html';
  expect(isApplicationUrl(app, app)).toBe(true);
  expect(isApplicationUrl(`${app}#stage`, app)).toBe(true);
  for (const url of [
    'file:///tmp/untrusted.html',
    `${app}?other`,
    'https://example.com/',
    'invalid',
  ]) {
    expect(isApplicationUrl(url, app)).toBe(false);
  }
});
