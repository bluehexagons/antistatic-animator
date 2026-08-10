import { contextBridge, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {
  AgentPlayOptions,
  AgentPlayReady,
  AgentPlayRequest,
  AgentPlayResponse,
  AntistaticLaunchResult,
} from './runtime/antistatic-types';

let atomicWriteSequence = 0;

const writeFileAtomic = (filename: fs.PathLike, content: string) => {
  const temporary = `${filename}.antistatic-animator-${Date.now()}-${atomicWriteSequence++}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8' });
    fs.renameSync(temporary, filename);
  } catch (err) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Preserve the original write/rename error.
    }
    throw err;
  }
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

// Expose Node.js APIs that are needed by the renderer
contextBridge.exposeInMainWorld('nodeAPI', {
  fs: {
    existsSync: fs.existsSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
    writeFileAtomic,
    // Wrap fs.watch to return a cleanup function instead of FSWatcher (non-serializable)
    watch: (
      filename: fs.PathLike,
      optionsOrListener?: fs.WatchOptions | BufferEncoding | fs.WatchListener<string>,
      listener?: fs.WatchListener<string> | ((error: Error) => void),
      onError?: (error: Error) => void
    ): (() => void) => {
      let watcher: fs.FSWatcher;
      let errorHandler = onError;
      if (typeof optionsOrListener === 'function') {
        watcher = fs.watch(filename, optionsOrListener);
        if (typeof listener === 'function') errorHandler = listener as (error: Error) => void;
      } else if (typeof optionsOrListener === 'string') {
        watcher = fs.watch(
          filename,
          optionsOrListener as BufferEncoding,
          listener as fs.WatchListener<string>
        );
      } else {
        watcher = fs.watch(
          filename,
          optionsOrListener as fs.WatchOptionsWithStringEncoding,
          listener as fs.WatchListener<string>
        );
      }
      watcher.on('error', errorHandler ?? (() => {}));
      return () => watcher.close();
    },
  },
  path: {
    resolve: path.resolve,
    join: path.join,
    dirname: path.dirname,
    basename: path.basename,
    extname: path.extname,
  },
  process: {
    cwd: () => process.cwd(),
    platform: process.platform,
  },
});
