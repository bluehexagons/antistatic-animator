import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from './animator';
import { characterData, updateAppDir } from './utils';
import { ipcRenderer } from './runtime/electron-renderer';

import styles from './styles.module.css';

const App = () => {
    const [appDir, setAppDir] = useState(localStorage['antistatic-dir'] || process.cwd())

    useEffect(() => {
        localStorage['antistatic-dir'] = appDir;
    }, [appDir])

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
            {/* old animator code */}
            <div id="selectors">
                <button onClick={browseAppDir}>Installation Directory: {appDir}</button>
                <select id="files" />
                <select id="animations" />
                <button id="save_button">Save</button>
            </div>
            <div id="scrollable">
                <div id="keyframes" />
                <div id="bubbles" />
            </div>
        </div>
    )
};

const container = document.getElementById('main');
const root = createRoot(container!);
root.render(<App />);
