import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentPlayOptions,
  AgentPlayReady,
  AgentPlayRequest,
  AgentPlayResponse,
  AntistaticLaunchResult,
} from './runtime/antistatic-types';

type StorageResponse<T> = { ok: true; value: T } | { ok: false; error: string };
type WatchListener = (event: string, filename: string | null) => void;

const callSync = <T>(channel: string, ...args: unknown[]): T => {
  const result = ipcRenderer.sendSync(channel, ...args) as StorageResponse<T>;
  if (!result.ok) throw new Error((result as { error: string }).error);
  return result.value;
};

const watchCallbacks = new Map<
  string,
  { listener: WatchListener; onError: (error: Error) => void }
>();
let watchSequence = 0;

ipcRenderer.on(
  'storage-watch-event',
  (_event, id: string, eventName: string, filename: string | null) => {
    watchCallbacks.get(id)?.listener(eventName, filename);
  }
);
ipcRenderer.on('storage-watch-error', (_event, id: string, message: string) => {
  const callback = watchCallbacks.get(id);
  if (callback) callback.onError(new Error(message));
});

const watch = (
  filename: string,
  optionsOrListener?: BufferEncoding | WatchListener,
  listener?: WatchListener | ((error: Error) => void),
  onError?: (error: Error) => void
): (() => void) => {
  const id = `${Date.now()}-${watchSequence++}`;
  const callback: WatchListener =
    typeof optionsOrListener === 'function'
      ? optionsOrListener
      : typeof listener === 'function'
        ? (listener as WatchListener)
        : () => {};
  const errorHandler =
    typeof optionsOrListener === 'function' && typeof listener === 'function'
      ? (listener as (error: Error) => void)
      : (onError ?? (() => {}));
  watchCallbacks.set(id, { listener: callback, onError: errorHandler });
  ipcRenderer.send('storage-watch-start', id, filename);
  return () => {
    watchCallbacks.delete(id);
    ipcRenderer.send('storage-watch-stop', id);
  };
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  showOpenDialog: (config: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('showOpenDialog', config),
  launchAntistatic: (rootDir: string): Promise<AntistaticLaunchResult> =>
    ipcRenderer.invoke('launchAntistatic', rootDir),
  stopAntistatic: (): Promise<void> => ipcRenderer.invoke('stopAntistatic'),
  startAntistaticAgentPlay: (options: AgentPlayOptions): Promise<AgentPlayReady> =>
    ipcRenderer.invoke('startAntistaticAgentPlay', options),
  requestAntistaticAgentPlay: (request: AgentPlayRequest): Promise<AgentPlayResponse> =>
    ipcRenderer.invoke('requestAntistaticAgentPlay', request),
  stopAntistaticAgentPlay: (): Promise<void> => ipcRenderer.invoke('stopAntistaticAgentPlay'),
});

// Expose only scoped storage operations. The actual filesystem remains in the
// main process, where every path is checked against the selected project root.
contextBridge.exposeInMainWorld('nodeAPI', {
  fs: {
    setRoot: (rootDir: string): void => callSync<void>('storage-set-root', rootDir),
    existsSync: (filename: string): boolean => callSync('storage-fs-exists', filename),
    readdirSync: (directory: string): string[] => callSync('storage-fs-readdir', directory),
    isDirectory: (directory: string): boolean => callSync('storage-fs-is-directory', directory),
    readFileSync: (filename: string, encoding: BufferEncoding): string =>
      callSync('storage-fs-read', filename, encoding),
    writeFileAtomic: (filename: string, content: string): void => {
      callSync<void>('storage-fs-write', filename, content);
    },
    writeFileAtomicIfUnchanged: (
      filename: string,
      content: string,
      expectedContent?: string
    ): void => {
      callSync<void>('storage-fs-write-if-unchanged', filename, content, expectedContent);
    },
    watch,
  },
  path: {
    resolve: (...parts: string[]): string => callSync('path-resolve', ...parts),
    join: (...parts: string[]): string => callSync('path-join', ...parts),
    dirname: (value: string): string => callSync('path-dirname', value),
    basename: (value: string): string => callSync('path-basename', value),
    extname: (value: string): string => callSync('path-extname', value),
  },
  process: {
    cwd: (): string => callSync('process-cwd'),
    platform: callSync<NodeJS.Platform>('process-platform'),
  },
});
