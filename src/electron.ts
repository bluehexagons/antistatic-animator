import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { AntistaticProcessManager } from './runtime/antistatic';

const antistatic = new AntistaticProcessManager();

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
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('showOpenDialog', (_event, config) => {
  return dialog.showOpenDialog(config);
});

ipcMain.handle('launchAntistatic', (_event, rootDir: unknown) =>
  antistatic.launchGame(requireString(rootDir, 'rootDir'))
);

ipcMain.handle('stopAntistatic', () => antistatic.stopGame());

ipcMain.handle('startAntistaticAgentPlay', (_event, options: unknown) => {
  if (!options || typeof options !== 'object')
    throw new Error('agent-play options must be an object');
  const value = options as Record<string, unknown>;
  const rootDir = requireString(value.rootDir, 'rootDir');
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
  });
});

ipcMain.handle('requestAntistaticAgentPlay', (_event, request: unknown) => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('agent-play request must be an object');
  }
  const value = request as Record<string, unknown>;
  if (typeof value.command !== 'string' || value.command.trim() === '') {
    throw new Error('agent-play request.command must be a non-empty string');
  }
  return antistatic.requestAgentPlay(value as { command: string; [key: string]: unknown });
});

ipcMain.handle('stopAntistaticAgentPlay', () => antistatic.stopAgentPlay());

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
