import { getRuntimeRequire } from './require'

const runtimeRequire = getRuntimeRequire('Electron renderer')
export const { ipcRenderer } = runtimeRequire('electron') as typeof import('electron')
