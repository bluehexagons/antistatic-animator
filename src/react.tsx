import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as JSONC from 'jsonc-parser';
import { AnimatorProvider, useAnimator } from './animator/context/AnimatorContext';
import { BubbleViewer } from './animator/components/BubbleViewer';
import { HurtbubbleEditor } from './animator/components/HurtbubbleEditor';
import { KeyframeList } from './animator/components/KeyframeList';
import { save as saveFile } from './animator/operations/file-operations';
import { characterData, watchCharacters, updateAppDir } from './utils';
import type { EntityData } from './animator/types';

import styles from './styles.module.css';

const AppContent = () => {
  const { state, dispatch } = useAnimator();
  const [fileList, setFileList] = useState<string[]>(['[File]']);
  const [animationList, setAnimationList] = useState<string[]>([]);

  // Load file list when app dir changes
  useEffect(() => {
    localStorage['antistatic-dir'] = state.appDir;
    updateAppDir(state.appDir);

    if (characterData && characterData.size > 0) {
      const files = ['[File]'].concat(
        Array.from(characterData.keys())
          .filter((file: string) => !file.includes('_'))
          .sort()
      );
      setFileList(files);
    }
  }, [state.appDir]);

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const file = e.target.value;
      if (file === '[File]' || !characterData.has(file)) return;

      const character = JSONC.parse(characterData.get(file).content) as EntityData;
      dispatch({ type: 'SET_CHARACTER', payload: character });

      const animFile = `${file.split('.')[0]}_anim.json`;
      dispatch({ type: 'SET_ANIM_FILE', payload: animFile });

      if (characterData.has(animFile)) {
        const parsed = JSONC.parse(characterData.get(animFile).content);
        dispatch({ type: 'SET_PARSED', payload: parsed });

        const anims = Object.getOwnPropertyNames(parsed).sort();
        setAnimationList(anims);
      } else {
        setAnimationList([]);
        dispatch({ type: 'SET_PARSED', payload: null });
      }
    },
    [dispatch]
  );

  // Handle animation selection
  const handleAnimationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const animName = e.target.value;
      if (!state.parsed || !state.parsed[animName]) return;

      dispatch({ type: 'SET_ANIMATION', payload: state.parsed[animName] });
      dispatch({ type: 'SET_KEYFRAME', payload: 0 });
    },
    [state.parsed, dispatch]
  );

  // Handle directory selection
  const browseAppDir = useCallback(async () => {
    const dir = await window.electronAPI.showOpenDialog({
      title: 'Select Antistatic installation directory',
      defaultPath: state.appDir,
      properties: ['openDirectory'],
    });
    if (dir.filePaths.length === 1) {
      dispatch({ type: 'SET_APP_DIR', payload: dir.filePaths[0] });
    }
  }, [state.appDir, dispatch]);

  // Handle save
  const handleSave = useCallback(() => {
    if (state.animFile && state.parsed) {
      saveFile(state.animFile, state.parsed);
    }
  }, [state.animFile, state.parsed]);

  // Watch for character file changes
  useEffect(() => {
    watchCharacters((name: string) => {
      console.log('animator reloading', name);
      // Reload character data
      if (state.character && characterData.has(state.animFile)) {
        const parsed = JSONC.parse(characterData.get(state.animFile).content);
        dispatch({ type: 'SET_PARSED', payload: parsed });

        if (parsed[state.animation?.name || '']) {
          dispatch({
            type: 'SET_ANIMATION',
            payload: parsed[state.animation.name],
          });
        }
      }
    });
  }, [state.character, state.animFile, state.animation, dispatch]);

  // Expose editing state globally for console access
  useEffect(() => {
    window.editing = {
      character: state.character,
      animation: state.animation,
      keyframe: state.keyframe,
      bubble: state.selectedBubble,
    };
    window.parsed = state.parsed || {};
  }, [state]);

  return (
    <div id="animator" className={styles.animator}>
      <div id="selectors">
        <button onClick={browseAppDir}>Installation Directory: {state.appDir}</button>
        <select value={''} onChange={handleFileChange}>
          {fileList.map((file) => (
            <option key={file} value={file === '[File]' ? '' : file}>
              {file}
            </option>
          ))}
        </select>
        <select value={state.animation?.name || ''} onChange={handleAnimationChange}>
          <option value="">Select animation</option>
          {animationList.map((anim) => (
            <option key={anim} value={anim}>
              {anim}
            </option>
          ))}
        </select>
        <button id="save_button" onClick={handleSave}>
          Save
        </button>
      </div>

      <div id="scrollable">
        {state.animation && state.character ? (
          <>
            {/* Main editor */}
            <div className="editor">
              <HurtbubbleEditor
                animation={state.animation}
                keyframe={state.keyframe}
                selectedBubble={state.selectedBubble}
                onSelectedBubbleChange={(idx) =>
                  dispatch({ type: 'SET_SELECTED_BUBBLE', payload: idx })
                }
                onHurtbubbleChange={() => {
                  dispatch({ type: 'SET_ANIMATION', payload: { ...state.animation } });
                }}
              />
              <BubbleViewer
                character={state.character}
                animation={state.animation}
                keyframe={state.keyframe}
                camera={state.camera}
                highlightBubble={state.selectedBubble}
                onBubbleHover={(idx) => dispatch({ type: 'SET_SELECTED_BUBBLE', payload: idx })}
                onBubbleClick={(idx) => dispatch({ type: 'SET_SELECTED_BUBBLE', payload: idx })}
              />
            </div>

            {/* Keyframe list */}
            <div id="keyframes">
              <KeyframeList
                character={state.character}
                animation={state.animation}
                keyframeIndex={state.keyframe}
                camera={state.camera}
                onKeyframeSelect={(idx) => dispatch({ type: 'SET_KEYFRAME', payload: idx })}
                onAnimationChange={(anim) => dispatch({ type: 'SET_ANIMATION', payload: anim })}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              color: '#666',
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: '12pt',
              fontWeight: 'normal',
            }}
          >
            <div style={{ maxWidth: '300px' }}>
              <div style={{ fontSize: '24pt', marginBottom: '10px', opacity: 0.5 }}>📋</div>
              <div>Select a file and animation to start editing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AnimatorProvider>
      <AppContent />
    </AnimatorProvider>
  );
};

const container = document.getElementById('main');
const root = createRoot(container!);
root.render(<App />);
