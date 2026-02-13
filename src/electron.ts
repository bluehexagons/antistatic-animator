import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';

function createWindow() {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile('dist/index.html');
}

ipcMain.handle('showOpenDialog', (_event, config) => {
  return dialog.showOpenDialog(config);
});

app.on('ready', createWindow);

app.whenReady().then(async () => {
  // Only install devtools in development (not in packaged app)
  if (!app.isPackaged) {
    try {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } =
        await import('electron-devtools-installer');
      const name = await installExtension(REACT_DEVELOPER_TOOLS);
      console.log(`Added Extension: ${name}`);
    } catch (err) {
      console.log('Failed to install devtools extension:', err);
    }
  }
});
