import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';

function createWindow () {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      webSecurity: false,
      plugins: true,
      spellcheck: false
    }
  });
  win.loadFile('dist/index.html');
}

ipcMain.handle('showOpenDialog', (_event, config) => {
  return dialog.showOpenDialog(config)
})

app.on('ready', createWindow);

app.whenReady().then(() => {
  installExtension(REACT_DEVELOPER_TOOLS)
    .then((name) => console.log(`Added Extension: ${name}`))
    .catch((err) => console.log('An error occurred: ', err));
});
