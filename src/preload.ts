import { contextBridge, ipcRenderer } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  showOpenDialog: (config: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('showOpenDialog', config),
});

// Expose Node.js APIs that are needed by the renderer
contextBridge.exposeInMainWorld('nodeAPI', {
  fs: {
    existsSync: fs.existsSync,
    readdirSync: fs.readdirSync,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    watch: fs.watch,
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
