import { ipcRenderer } from 'electron';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from './animator'

import styles from './styles.module.css'
import { characterData, updateAppDir } from './utils';


const App = () => {
    const [appDir, setAppDir] = useState(process.cwd())

    const browseAppDir = useCallback(async () => {
        const dir = await ipcRenderer.invoke('showOpenDialog', {
            title: 'Select Antistatic installation directory',
            defaultPath: appDir,
            properties: ['openDirectory']
        })
        if (dir.filePaths.length === 1) {
            setAppDir(dir.filePaths[0])
        }
    }, [])

    useLayoutEffect(() => {
        updateAppDir(appDir)
        if (characterData) {
            init();
        }
    }, [appDir])

    return (
        <div id="animator" className={styles.animator}>
            <div id="selectors">
                <button onClick={browseAppDir}>Installation Directory: {appDir}</button>
                <select id="files"></select>
                <select id="animations"></select>
                <button id="save_button">Save</button>
            </div>
            <div id="scrollable">
                <div id="keyframes">
                </div>
                <div id="bubbles">
                </div>
            </div>
        </div>
    )
};

const container = document.getElementById('main');
const root = createRoot(container!);
root.render(<App />);
