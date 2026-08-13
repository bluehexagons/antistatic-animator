import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AntistaticProcessManager } from './runtime/antistatic';

const antistatic = new AntistaticProcessManager();

type StorageResponse<T> = { ok: true; value: T } | { ok: false; error: string };
type StorageIpcEvent = Electron.IpcMainEvent | Electron.IpcMainInvokeEvent;

const storageRoots = new Map<number, string>();
const storageWatchers = new Map<string, { sender: Electron.WebContents; watcher: fs.FSWatcher }>();

const assertTrustedRenderer = (event: StorageIpcEvent): void => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (
    !win ||
    win.isDestroyed() ||
    event.senderFrame !== event.sender.mainFrame ||
    !event.sender.getURL().startsWith('file:')
  ) {
    throw new Error('IPC request did not originate from the application renderer');
  }
};

const storagePath = (event: StorageIpcEvent, value: unknown): string => {
  assertTrustedRenderer(event);
  if (typeof value !== 'string' || value.trim() === '') throw new Error('storage path is required');
  const root = storageRoots.get(event.sender.id);
  if (!root) throw new Error('storage root has not been selected');
  const candidate = path.resolve(value);
  const allowedDirectories = [
    path.resolve(root, 'app/characters/data'),
    path.resolve(root, 'app/assets/stages'),
  ];
  if (
    !allowedDirectories.some(
      (directory) => candidate === directory || candidate.startsWith(`${directory}${path.sep}`)
    )
  ) {
    throw new Error('storage path is outside the selected project data directories');
  }
  return candidate;
};

const selectedRoot = (event: StorageIpcEvent, value: unknown): string => {
  assertTrustedRenderer(event);
  const requested = path.resolve(requireString(value, 'rootDir'));
  const selected = storageRoots.get(event.sender.id);
  if (!selected || requested !== selected) {
    throw new Error('game root must match the selected storage project');
  }
  return requested;
};

const response = <T>(operation: () => T): StorageResponse<T> => {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? String(error) };
  }
};

const writeFileAtomic = (filename: string, content: string): void => {
  const temporary = `${filename}.antistatic-animator-${Date.now()}-${process.pid}.tmp`;
  let descriptor: number | undefined;
  try {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(temporary, content, { encoding: 'utf8' });
    descriptor = fs.openSync(temporary, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, filename);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Preserve the original write/rename error.
    }
    throw error;
  }
};

const writeFileAtomicIfUnchanged = (
  filename: string,
  content: string,
  expectedContent: string | undefined
): void => {
  let current: string | undefined;
  try {
    current = fs.readFileSync(filename, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current !== expectedContent) throw new Error('File changed externally');
  writeFileAtomic(filename, content);
};

const watcherKey = (sender: Electron.WebContents, id: string): string => `${sender.id}:${id}`;

const closeStorageWatcher = (sender: Electron.WebContents, id: string): void => {
  const key = watcherKey(sender, id);
  const entry = storageWatchers.get(key);
  if (!entry) return;
  storageWatchers.delete(key);
  entry.watcher.close();
};

const closeStorageWatchers = (sender: Electron.WebContents): void => {
  for (const [key, entry] of storageWatchers) {
    if (entry.sender === sender) {
      storageWatchers.delete(key);
      entry.watcher.close();
    }
  }
};

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${name} must be a non-empty string`);
  return value;
};

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  win.webContents.on('destroyed', () => {
    closeStorageWatchers(win.webContents);
    storageRoots.delete(win.webContents.id);
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('showOpenDialog', (event, config) => {
  assertTrustedRenderer(event);
  return dialog.showOpenDialog(config);
});

ipcMain.handle('launchAntistatic', (event, rootDir: unknown) => {
  return antistatic.launchGame(selectedRoot(event, rootDir));
});

ipcMain.handle('stopAntistatic', (event) => {
  assertTrustedRenderer(event);
  return antistatic.stopGame();
});

ipcMain.handle('startAntistaticAgentPlay', (event, options: unknown) => {
  assertTrustedRenderer(event);
  if (!options || typeof options !== 'object')
    throw new Error('agent-play options must be an object');
  const value = options as Record<string, unknown>;
  const rootDir = selectedRoot(event, value.rootDir);
  const startMode = value.startMode;
  if (!['press-start', 'main', 'versus', 'training', 'blank'].includes(String(startMode))) {
    throw new Error('startMode must be a supported Antistatic start mode');
  }
  return antistatic.startAgentPlay({
    rootDir,
    startMode: String(startMode) as 'press-start' | 'main' | 'versus' | 'training' | 'blank',
    compile: value.compile !== false,
    render: value.render === true,
    softwareGl: value.softwareGl === true,
    resolution:
      typeof value.resolution === 'string' && value.resolution ? value.resolution : '1280x720',
    headlessMenu: typeof value.headlessMenu === 'string' ? value.headlessMenu : undefined,
    stage: typeof value.stage === 'string' ? value.stage : undefined,
    character: typeof value.character === 'string' ? value.character : undefined,
    versusPlayers: Array.isArray(value.versusPlayers)
      ? value.versusPlayers.filter((entry): entry is string => typeof entry === 'string')
      : undefined,
    versusCpus: typeof value.versusCpus === 'number' ? value.versusCpus : undefined,
    versusCpuLevel: typeof value.versusCpuLevel === 'number' ? value.versusCpuLevel : undefined,
    versusCpuCharacter:
      typeof value.versusCpuCharacter === 'string' ? value.versusCpuCharacter : undefined,
    autoStartBattle: value.autoStartBattle === true,
  });
});

ipcMain.handle('requestAntistaticAgentPlay', (event, request: unknown) => {
  assertTrustedRenderer(event);
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('agent-play request must be an object');
  }
  const value = request as Record<string, unknown>;
  if (typeof value.command !== 'string' || value.command.trim() === '') {
    throw new Error('agent-play request.command must be a non-empty string');
  }
  return antistatic.requestAgentPlay(value as { command: string; [key: string]: unknown });
});

ipcMain.handle('stopAntistaticAgentPlay', (event) => {
  assertTrustedRenderer(event);
  return antistatic.stopAgentPlay();
});

ipcMain.on('storage-set-root', (event, rootDir: unknown) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    const root = requireString(rootDir, 'rootDir');
    storageRoots.set(event.sender.id, path.resolve(root));
    return undefined;
  });
});

ipcMain.on('storage-fs-exists', (event, filename: unknown) => {
  event.returnValue = response(() => fs.existsSync(storagePath(event, filename)));
});

ipcMain.on('storage-fs-readdir', (event, directory: unknown) => {
  event.returnValue = response(() => fs.readdirSync(storagePath(event, directory)));
});

ipcMain.on('storage-fs-read', (event, filename: unknown, encoding: unknown) => {
  event.returnValue = response(() => {
    if (encoding !== 'utf8') throw new Error('only utf8 storage reads are supported');
    return fs.readFileSync(storagePath(event, filename), 'utf8');
  });
});

ipcMain.on('storage-fs-write', (event, filename: unknown, content: unknown) => {
  event.returnValue = response(() => {
    if (typeof content !== 'string') throw new Error('storage content must be a string');
    writeFileAtomic(storagePath(event, filename), content);
    return undefined;
  });
});

ipcMain.on(
  'storage-fs-write-if-unchanged',
  (event, filename: unknown, content: unknown, expectedContent: unknown) => {
    event.returnValue = response(() => {
      if (typeof content !== 'string') throw new Error('storage content must be a string');
      if (expectedContent !== undefined && typeof expectedContent !== 'string') {
        throw new Error('expected storage content must be a string');
      }
      writeFileAtomicIfUnchanged(
        storagePath(event, filename),
        content,
        expectedContent as string | undefined
      );
      return undefined;
    });
  }
);

ipcMain.on('storage-watch-start', (event, id: unknown, filename: unknown) => {
  try {
    assertTrustedRenderer(event);
    if (typeof id !== 'string' || id === '') throw new Error('watch id is required');
    const key = watcherKey(event.sender, id);
    closeStorageWatcher(event.sender, id);
    const watcher = fs.watch(storagePath(event, filename), (eventType, changedName) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('storage-watch-event', id, eventType, changedName?.toString() ?? null);
      }
    });
    watcher.on('error', (error) => {
      storageWatchers.delete(key);
      if (!event.sender.isDestroyed()) {
        event.sender.send('storage-watch-error', id, error.message);
      }
    });
    storageWatchers.set(key, { sender: event.sender, watcher });
  } catch (error) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('storage-watch-error', id, (error as Error).message ?? String(error));
    }
  }
});

ipcMain.on('storage-watch-stop', (event, id: unknown) => {
  if (typeof id !== 'string' || id === '') return;
  try {
    assertTrustedRenderer(event);
    closeStorageWatcher(event.sender, id);
  } catch {
    // The renderer is already untrusted or gone; there is nothing to clean up.
  }
});

const pathArguments = (parts: unknown[]): string[] => {
  if (!parts.every((part) => typeof part === 'string'))
    throw new Error('path arguments must be strings');
  return parts as string[];
};

ipcMain.on('path-resolve', (event, ...parts: unknown[]) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return path.resolve(...pathArguments(parts));
  });
});

ipcMain.on('path-join', (event, ...parts: unknown[]) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return path.join(...pathArguments(parts));
  });
});

ipcMain.on('path-dirname', (event, value: unknown) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return path.dirname(requireString(value, 'path'));
  });
});

ipcMain.on('path-basename', (event, value: unknown) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return path.basename(requireString(value, 'path'));
  });
});

ipcMain.on('path-extname', (event, value: unknown) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return path.extname(requireString(value, 'path'));
  });
});

ipcMain.on('process-cwd', (event) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return process.cwd();
  });
});

ipcMain.on('process-platform', (event) => {
  event.returnValue = response(() => {
    assertTrustedRenderer(event);
    return process.platform;
  });
});

app.whenReady().then(async () => {
  createWindow();

  // Extension installation can require network access and is unnecessary for
  // normal source builds. Keep it explicit so manual testers get a quiet,
  // deterministic startup while developers can still opt in.
  if (!app.isPackaged && process.env.ANTISTATIC_ANIMATOR_DEVTOOLS === '1') {
    try {
      const { installExtension, REACT_DEVELOPER_TOOLS } =
        await import('electron-devtools-installer');
      const name = await installExtension(REACT_DEVELOPER_TOOLS);
      console.log(`Added Extension: ${name}`);
    } catch (err) {
      console.log('Failed to install devtools extension:', err);
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let disposing = false;
app.on('before-quit', (event) => {
  if (disposing) return;
  event.preventDefault();
  disposing = true;
  void antistatic.dispose().finally(() => app.quit());
});
