import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from './animator'

// import styles from 'styles.module.css'

const App = () => {
    console.log('running')
    useLayoutEffect(() => {
        console.log('lets go')
        init();
    }, [])
    return (
        <div id="animator">
            hi there
            <div id="main"></div>
            <div id="selectors">
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
