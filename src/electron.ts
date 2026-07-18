import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';

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
