/**
 * App — top-level shell that wires together the toolbar, sidebar, stage,
 * inspector, timeline, drop zone, and source picker against the storage
 * library and animator context.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as JSONC from 'jsonc-parser';

import { AnimatorProvider, useAnimator } from '../animator/context/AnimatorContext';
import { ErrorBoundary } from './ErrorBoundary';
import type { Animation, AnimationMap, EntityData } from '../animator/types';
import { save as saveFile } from '../animator/operations/file-operations';
import { clearBaselines } from '../animator/operations/diff';
import { createTools } from '../animator/api/tools';
import { library } from '../storage/library';
import { ElectronStorage } from '../storage/electron';
import { FsAccessStorage } from '../storage/fs-access';
import { UploadStorage } from '../storage/upload';
import { detectCapabilities } from '../storage/types';
import { getLocalStorageItem, setLocalStorageItem } from '../runtime/local-storage';

import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Inspector } from './Inspector';
import { Timeline, type LoopMode } from './Timeline';
import { StageViewer } from './StageViewer';
import { SourcePicker } from './SourcePicker';
import { DropZone } from './DropZone';
import { useLibrary } from './hooks';
import { findAnimationFile, isCharacterDataFile } from './file-names';

const VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';
const ELECTRON_SOURCE_KEY = 'antistatic-dir';

const Shell: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useAnimator();
  useLibrary(); // subscribe

  // UI-only state
  const [showGrid, setShowGrid] = useState(true);
  const [showGround, setShowGround] = useState(true);
  const [showHitboxes, setShowHitboxes] = useState(true);
  const [showOnion, setShowOnion] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showShield, setShowShield] = useState(false);
  const [saveDirty, setSaveDirty] = useState(false);
  const [showPicker, setShowPicker] = useState(!library.ready);

  // Active selection (derived from animator context)
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedHitbubble, setSelectedHitbubble] = useState(-1);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>('loop');

  const clearOpenFile = useCallback(() => {
    setSelectedFile(null);
    setSelectedHitbubble(-1);
    setSaveDirty(false);
    setTick(0);
    setPlaying(false);
    dispatch({ type: 'SET_CHARACTER', payload: null });
    dispatch({ type: 'SET_PARSED', payload: null });
    dispatch({ type: 'SET_ANIM_FILE', payload: '' });
    dispatch({ type: 'SET_ANIMATION', payload: { animation: null } });
  }, [dispatch]);

  // Bootstrap: try to restore the previous Electron directory.
  useEffect(() => {
    let cancelled = false;
    const caps = detectCapabilities();
    if (caps.hasElectron && !library.getBackend()) {
      const stored = getLocalStorageItem(ELECTRON_SOURCE_KEY);
      const backend = new ElectronStorage(stored || undefined);
      library.setBackend(backend);
      if (stored && backend.ready) {
        library
          .refresh()
          .then(() => {
            if (!cancelled) setShowPicker(false);
          })
          .catch(() => {
            if (!cancelled) setShowPicker(true);
          });
      }
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive file list (only character files, not _anim).
  const files = useMemo(() => {
    return library
      .files()
      .map((f) => f.name)
      .filter(isCharacterDataFile)
      .sort();
  }, [library.size, library.label]); // re-evaluated when library changes via useLibrary

  // Animation map list for the current file.
  const animationKeyframeCounts = useMemo(() => {
    if (!state.parsed) return {};
    const out: Record<string, number> = {};
    for (const k of Object.keys(state.parsed)) {
      out[k] = state.parsed[k]?.keyframes?.length ?? 0;
    }
    return out;
  }, [state.parsed]);

  const handleSelectFile = useCallback(
    (file: string) => {
      clearOpenFile();
      setSelectedFile(file);
      const content = library.get(file);
      if (!content) return;
      try {
        const character = JSONC.parse(content) as EntityData;
        dispatch({ type: 'SET_CHARACTER', payload: character });
      } catch (err) {
        console.error('failed to parse character', err);
        return;
      }
      const animFile = findAnimationFile(file, (name) => library.has(name));
      dispatch({ type: 'SET_ANIM_FILE', payload: animFile });
      const animContent = library.get(animFile);
      if (animContent) {
        try {
          const parsed = JSONC.parse(animContent) as AnimationMap;
          dispatch({ type: 'SET_PARSED', payload: parsed });
        } catch (err) {
          console.error('failed to parse animations', err);
          dispatch({ type: 'SET_PARSED', payload: null });
        }
      } else {
        dispatch({ type: 'SET_PARSED', payload: null });
      }
    },
    [clearOpenFile, dispatch]
  );

  const animationList = useMemo(
    () => (state.parsed ? Object.getOwnPropertyNames(state.parsed).sort() : []),
    [state.parsed]
  );

  const handleSelectAnimation = useCallback(
    (name: string) => {
      if (!state.parsed || !state.parsed[name]) return;
      const animation = state.parsed[name];
      if (!Array.isArray(animation.keyframes)) {
        console.error(`animation "${name}" has no keyframes array`);
        return;
      }
      dispatch({ type: 'SET_ANIMATION', payload: { animation, name } });
      setSelectedHitbubble(-1);
    },
    [state.parsed, dispatch]
  );

  const onAnimationChange = useCallback(() => {
    if (state.animation) {
      // Re-render with a shallow clone so identity-keyed memos recompute
      // (the keyframes array reference is retained, so keyframe edits stay
      // shared). updateParsed tells the reducer to also repoint the parsed
      // map entry, keeping save() and the editor view consistent.
      // Omitting `name` preserves the current keyframe/selection.
      const clone = { ...state.animation } as Animation;
      dispatch({ type: 'SET_ANIMATION', payload: { animation: clone, updateParsed: true } });
    }
    setSaveDirty(true);
  }, [state.animation, dispatch]);

  const onSelectBubble = useCallback(
    (i: number) => dispatch({ type: 'SET_SELECTED_BUBBLE', payload: i }),
    [dispatch]
  );

  const onKeyframeSelect = useCallback(
    (i: number) => {
      dispatch({ type: 'SET_KEYFRAME', payload: i });
      setSelectedHitbubble(-1);
    },
    [dispatch]
  );

  // Reset playback when a *different* animation is opened. Keyed on the name
  // (not the animation object, which is re-cloned on every in-place edit) so
  // editing doesn't stop playback or snap the playhead to 0.
  useEffect(() => {
    setTick(0);
    setPlaying(false);
  }, [state.animationName]);

  const updateCamera = useCallback(
    (cam: Partial<typeof state.camera>) => dispatch({ type: 'SET_CAMERA', payload: cam }),
    [dispatch]
  );

  const handleSave = useCallback(async () => {
    if (!state.animFile || !state.parsed) return;
    try {
      await saveFile(state.animFile, state.parsed);
      setSaveDirty(false);
      // Everything on disk is now the baseline; clear session-modified marks.
      clearBaselines();
    } catch (err) {
      console.error('save failed', err);
      alert(`Save failed: ${(err as Error).message ?? err}`);
    }
  }, [state.animFile, state.parsed]);

  const openSource = useCallback(async () => {
    setShowPicker(true);
  }, []);

  const handlePickElectron = useCallback(async () => {
    const backend =
      library.getBackend() instanceof ElectronStorage
        ? (library.getBackend() as ElectronStorage)
        : new ElectronStorage();
    const ok = await backend.pickDirectory();
    if (ok) {
      clearOpenFile();
      library.setBackend(backend);
      await library.refresh();
      if (backend.ready) {
        setLocalStorageItem(ELECTRON_SOURCE_KEY, backend.label);
        setShowPicker(false);
      }
    }
  }, [clearOpenFile]);

  const handlePickFsAccess = useCallback(async () => {
    const backend = new FsAccessStorage();
    try {
      const ok = await backend.pickRoot();
      if (ok) {
        clearOpenFile();
        library.setBackend(backend);
        await library.refresh();
        setShowPicker(false);
      }
    } catch (err) {
      console.error(err);
    }
  }, [clearOpenFile]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handlePickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      let backend = library.getBackend();
      if (!(backend instanceof UploadStorage)) {
        backend = new UploadStorage();
        library.setBackend(backend);
      }
      clearOpenFile();
      await (backend as UploadStorage).loadFiles(files);
      await library.refresh();
      setShowPicker(!backend.ready);
    },
    [clearOpenFile]
  );

  const resetCamera = useCallback(() => {
    updateCamera({ x: 0, y: 0.1, scale: 2 });
  }, [updateCamera]);

  // Expose editing state for console power-users (dev-only; use window.Tools
  // for scripting in production).
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.editing = {
        character: state.character,
        animation: state.animation,
        keyframe: state.keyframe,
        bubble: state.selectedBubble,
      };
      window.parsed = state.parsed ?? {};
    }
  }, [state]);

  // Wire the documented window.Tools console API (batch keyframe/bubble ops).
  useEffect(() => {
    window.Tools = createTools(
      () => state.parsed,
      () => state.animation,
      () => state.animFile
    );
  }, [state.parsed, state.animation, state.animFile]);

  // Stale refs keep the keyboard listener stable — the effect mounts once and
  // reads the latest callbacks/state via refs instead of forcing a re-attach
  // on every render.
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redoRef = useRef(redo);
  redoRef.current = redo;
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const onKeyframeSelectRef = useRef(onKeyframeSelect);
  onKeyframeSelectRef.current = onKeyframeSelect;
  const stateRef = useRef(state);
  stateRef.current = state;
  const setTickRef = useRef(setTick);
  setTickRef.current = setTick;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      // Save works everywhere (incl. while editing a field): commit the
      // focused input first by blurring it, then save. Always preventDefault
      // so the browser's "save page" dialog never appears.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        void handleSaveRef.current();
        return;
      }
      // Undo/redo and keyframe navigation skip when the user is typing in a
      // text field — they'd expect browser-native undo, not an animation step.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Undo/redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redoRef.current();
        } else {
          undoRef.current();
        }
        return;
      }
      // Keyframe stepping on , / . (video-style) — arrows are reserved for
      // nudging the selected hurtbubble(s).
      const kfs = s.animation?.keyframes;
      if (kfs && (e.key === ',' || e.key === '.') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const next = s.keyframe + (e.key === '.' ? 1 : -1);
        if (next >= 0 && next < kfs.length) {
          e.preventDefault();
          onKeyframeSelectRef.current(next);
          setTickRef.current(0);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Empty / loading states
  const hasAnimation = !!state.animation && !!state.character;

  return (
    <div className="shell">
      <Toolbar
        appName="Antistatic"
        version={VERSION}
        sourceLabel={library.label}
        sourceKind={library.kind}
        ready={library.ready}
        canSave={library.canSave}
        saveDirty={saveDirty}
        onOpenSource={openSource}
        onSave={handleSave}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showGround={showGround}
        onToggleGround={() => setShowGround((v) => !v)}
        showHitboxes={showHitboxes}
        onToggleHitboxes={() => setShowHitboxes((v) => !v)}
        showOnion={showOnion}
        onToggleOnion={() => setShowOnion((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        showShield={showShield}
        onToggleShield={() => setShowShield((v) => !v)}
        onResetCamera={resetCamera}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <Sidebar
        files={files}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        animations={animationList}
        selectedAnimation={state.animationName || null}
        onSelectAnimation={handleSelectAnimation}
        animationKeyframeCounts={animationKeyframeCounts}
      />

      <main className="stage">
        <div className="stageHeader">
          <div className="crumbs">
            <span>{selectedFile ?? 'No character'}</span>
            <span className="sep">›</span>
            <strong>{state.animationName || '—'}</strong>
          </div>
          <div className="stageStats">
            <span>
              <strong>{state.camera.scale.toFixed(1)}×</strong> zoom
            </span>
            <span>
              <strong>{state.selectedBubble >= 0 ? `#${state.selectedBubble}` : '—'}</strong> bubble
            </span>
          </div>
        </div>
        {hasAnimation ? (
          <ErrorBoundary label="Stage">
            <StageViewer
              character={state.character!}
              animation={state.animation!}
              keyframe={state.keyframe}
              tick={tick}
              camera={state.camera}
              selectedBubble={state.selectedBubble}
              onSelectBubble={onSelectBubble}
              selectedHitbubble={selectedHitbubble}
              onSelectHitbubble={setSelectedHitbubble}
              onCameraChange={updateCamera}
              onBubbleChange={onAnimationChange}
              showGrid={showGrid}
              showGround={showGround}
              showHitboxes={showHitboxes}
              showOnion={showOnion}
              showLabels={showLabels}
              showShield={showShield}
            />
          </ErrorBoundary>
        ) : (
          <div className="stageEmpty">
            <h2>{library.ready ? 'Pick an animation to start' : 'No source loaded'}</h2>
            <p>
              {library.ready
                ? 'Choose a character on the left, then select one of its animations to begin editing.'
                : 'Use the source button up top to open a game directory, pick a folder, or drag files into the window.'}
            </p>
          </div>
        )}
      </main>

      {hasAnimation && state.character && state.animation ? (
        <ErrorBoundary label="Inspector">
          <Inspector
            character={state.character}
            animation={state.animation}
            keyframe={state.keyframe}
            selectedBubble={state.selectedBubble}
            onSelectBubble={onSelectBubble}
            selectedHitbubble={selectedHitbubble}
            onSelectHitbubble={setSelectedHitbubble}
            onAnimationChange={onAnimationChange}
          />
        </ErrorBoundary>
      ) : (
        <aside className="inspector">
          <div className="section">
            <div className="sectionHeader">Inspector</div>
            <div className="sectionBody" style={{ color: 'var(--fg-mute)', fontSize: 12 }}>
              Select an animation to view its properties.
            </div>
          </div>
        </aside>
      )}

      {hasAnimation && state.character && state.animation ? (
        <ErrorBoundary label="Timeline">
          <Timeline
            character={state.character}
            animation={state.animation}
            keyframe={state.keyframe}
            onKeyframeSelect={onKeyframeSelect}
            onAnimationChange={onAnimationChange}
            playing={playing}
            onPlayingChange={setPlaying}
            tick={tick}
            onTickChange={setTick}
            loopMode={loopMode}
            onLoopModeChange={setLoopMode}
          />
        </ErrorBoundary>
      ) : (
        <div
          className="timeline"
          style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--fg-mute)' }}
        >
          <div style={{ padding: 20, fontSize: 12 }}>
            Timeline appears once an animation is open.
          </div>
        </div>
      )}

      <DropZone onFiles={handleUploadFiles} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,.jsonc"
        style={{ display: 'none' }}
        onChange={(e) => {
          const list = e.target.files;
          if (!list) return;
          const arr: File[] = [];
          for (let i = 0; i < list.length; i++) arr.push(list[i]);
          void handleUploadFiles(arr);
          e.target.value = '';
        }}
      />

      {showPicker && !library.ready && (
        <SourcePicker
          onElectron={handlePickElectron}
          onFsAccess={handlePickFsAccess}
          onUpload={handlePickUpload}
        />
      )}
      {showPicker && library.ready && (
        <div
          className="sourcePicker"
          style={{ background: 'rgba(20,23,28,0.85)' }}
          onClick={() => setShowPicker(false)}
        >
          <div className="sourceCard" onClick={(e) => e.stopPropagation()}>
            <h1>Switch source</h1>
            <p>
              Currently loaded: <strong>{library.label}</strong>
            </p>
            <div className="sourceOptions">
              <button
                className="sourceOption"
                onClick={handlePickElectron}
                disabled={!detectCapabilities().hasElectron}
                aria-label="Open game directory (Electron)"
              >
                <span className="icon" aria-hidden="true">
                  📁
                </span>
                <span className="text">
                  <strong>Open game directory…</strong>
                  <small>Native (Electron)</small>
                </span>
              </button>
              <button
                className="sourceOption"
                onClick={handlePickFsAccess}
                disabled={!detectCapabilities().hasFsAccess}
                aria-label="Pick folder (File System Access)"
              >
                <span className="icon" aria-hidden="true">
                  📁
                </span>
                <span className="text">
                  <strong>Pick folder…</strong>
                  <small>File System Access API</small>
                </span>
              </button>
              <button className="sourceOption" onClick={handlePickUpload} aria-label="Upload files">
                <span className="icon" aria-hidden="true">
                  📥
                </span>
                <span className="text">
                  <strong>Drag &amp; drop / upload</strong>
                  <small>Saves via download</small>
                </span>
              </button>
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn ghost" onClick={() => setShowPicker(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <AnimatorProvider>
    <Shell />
  </AnimatorProvider>
);
