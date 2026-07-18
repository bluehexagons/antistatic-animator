/**
 * App — top-level shell that wires together the toolbar, sidebar, stage,
 * inspector, timeline, drop zone, and source picker against the storage
 * library and animator context.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as JSONC from 'jsonc-parser';

import { AnimatorProvider, useAnimator } from '../animator/context/AnimatorContext';
import { ErrorBoundary } from './ErrorBoundary';
import type { AnimationMap, EntityData } from '../animator/types';
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
import { StageSceneViewer } from './StageSceneViewer';
import { StageInspector } from './StageInspector';
import { StageTimeline } from './StageTimeline';
import { SourcePicker } from './SourcePicker';
import { DropZone } from './DropZone';
import { useLibrary, useLatest } from './hooks';
import { findAnimationFile, isCharacterDataFile, isStageDataFile } from './file-names';
import type { EditorMode } from './Sidebar';
import {
  addStageSceneItem,
  createStageDocument,
  parseStageDocument,
  removeStageSceneItem,
  renderStageFile,
  stageSceneItems,
  validateStageDocument,
} from '../stage/document';
import type { StageSelectionKind } from '../stage/types';

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
  const [mode, setMode] = useState<EditorMode>('character');

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
    dispatch({ type: 'SET_STAGE', payload: null });
    dispatch({ type: 'SET_STAGE_FILE', payload: '' });
    dispatch({ type: 'SET_STAGE_SELECTION', payload: { kind: 'stage' } });
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

  const stageFiles = useMemo(
    () =>
      library
        .files()
        .map((file) => file.name)
        .filter(isStageDataFile)
        .sort(),
    [library.size, library.label]
  );

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
      setMode('character');
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

  const handleSelectStageFile = useCallback(
    (file: string) => {
      clearOpenFile();
      setMode('stage');
      const content = library.get(file);
      if (!content) return;
      const parsed = parseStageDocument(content);
      if (!parsed.document) {
        alert(`Unable to parse stage:\n${parsed.issues.map((issue) => issue.message).join('\n')}`);
        return;
      }
      dispatch({ type: 'SET_STAGE_FILE', payload: file });
      dispatch({ type: 'SET_STAGE', payload: parsed.document });
      dispatch({ type: 'SET_STAGE_SELECTION', payload: { kind: 'stage' } });
      dispatch({ type: 'SET_CAMERA', payload: { x: 0, y: 0, scale: 0.75 } });
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
      const clone = { ...state.animation };
      dispatch({ type: 'SET_ANIMATION', payload: { animation: clone, updateParsed: true } });
    }
    setSaveDirty(true);
  }, [state.animation, dispatch]);

  const onStageChange = useCallback(() => {
    if (state.stage) dispatch({ type: 'SET_STAGE', payload: structuredClone(state.stage) });
    setSaveDirty(true);
  }, [state.stage, dispatch]);

  const stageItems = useMemo(
    () => (state.stage ? stageSceneItems(state.stage) : []),
    [state.stage]
  );
  const stageIssues = useMemo(
    () => (state.stage ? validateStageDocument(state.stage) : []),
    [state.stage]
  );

  const handleAddStageItem = useCallback(
    (kind: Exclude<StageSelectionKind, 'stage'>) => {
      if (!state.stage) return;
      const selection = addStageSceneItem(state.stage, kind);
      dispatch({ type: 'SET_STAGE_SELECTION', payload: selection });
      onStageChange();
    },
    [state.stage, dispatch, onStageChange]
  );

  const handleDeleteStageItem = useCallback(() => {
    if (!state.stage || !removeStageSceneItem(state.stage, state.stageSelection)) return;
    dispatch({ type: 'SET_STAGE_SELECTION', payload: { kind: 'stage' } });
    onStageChange();
  }, [state.stage, state.stageSelection, dispatch, onStageChange]);

  const handleCreateStage = useCallback(async () => {
    const name = prompt('Stage name', 'New Stage')?.trim();
    if (!name) return;
    const suggested = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'stage'}.json`;
    const fileName = prompt('Stage file name', suggested)?.trim();
    if (!fileName) return;
    const safeFileName = fileName
      .replace(/^stages\//, '')
      .replace(/\.jsonc?$/i, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-');
    const path = `stages/${safeFileName || 'stage'}.json`;
    if (library.has(path) && !confirm(`${path} already exists. Replace it?`)) return;
    const document = createStageDocument(name);
    await library.save(path, renderStageFile(undefined, document));
    clearOpenFile();
    setMode('stage');
    dispatch({ type: 'SET_STAGE_FILE', payload: path });
    dispatch({ type: 'SET_STAGE', payload: document });
    dispatch({ type: 'SET_STAGE_SELECTION', payload: { kind: 'stage' } });
    setSaveDirty(false);
  }, [clearOpenFile, dispatch]);

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
    try {
      if (mode === 'stage') {
        if (!state.stageFile || !state.stage) return;
        const issues = validateStageDocument(state.stage);
        if (issues.length > 0) {
          throw new Error(
            `Stage has ${issues.length} schema or reference issue${issues.length === 1 ? '' : 's'}`
          );
        }
        await library.save(
          state.stageFile,
          renderStageFile(library.get(state.stageFile), state.stage)
        );
      } else {
        if (!state.animFile || !state.parsed) return;
        await saveFile(state.animFile, state.parsed);
        clearBaselines();
      }
      setSaveDirty(false);
    } catch (err) {
      console.error('save failed', err);
      alert(`Save failed: ${(err as Error).message ?? err}`);
    }
  }, [mode, state.animFile, state.parsed, state.stageFile, state.stage]);

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
    updateCamera(mode === 'stage' ? { x: 0, y: 0, scale: 0.75 } : { x: 0, y: 0.1, scale: 2 });
  }, [mode, updateCamera]);

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
  const undoRef = useLatest(undo);
  const redoRef = useLatest(redo);
  const handleSaveRef = useLatest(handleSave);
  const onKeyframeSelectRef = useLatest(onKeyframeSelect);
  const stateRef = useLatest(state);
  const setTickRef = useLatest(setTick);

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
      const kfs = mode === 'character' ? s.animation?.keyframes : undefined;
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
  }, [mode]);

  // Empty / loading states
  const hasAnimation = !!state.animation && !!state.character;
  const hasStage = !!state.stage && !!state.stageFile;

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
        editorMode={mode}
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
        mode={mode}
        onModeChange={setMode}
        files={files}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
        animations={animationList}
        selectedAnimation={state.animationName || null}
        onSelectAnimation={handleSelectAnimation}
        animationKeyframeCounts={animationKeyframeCounts}
        stageFiles={stageFiles}
        selectedStageFile={state.stageFile || null}
        onSelectStageFile={handleSelectStageFile}
        onCreateStage={() => void handleCreateStage()}
        stageItems={stageItems}
        selectedStageItem={state.stageSelection}
        onSelectStageItem={(selection) =>
          dispatch({ type: 'SET_STAGE_SELECTION', payload: selection })
        }
        onAddStageItem={handleAddStageItem}
        onDeleteStageItem={handleDeleteStageItem}
      />

      <main className="stage">
        <div className="stageHeader">
          <div className="crumbs">
            <span>
              {mode === 'stage'
                ? state.stageFile.replace(/^stages\//, '') || 'No stage'
                : (selectedFile ?? 'No character')}
            </span>
            <span className="sep">›</span>
            <strong>
              {mode === 'stage'
                ? (state.stageSelection.id ?? state.stageSelection.kind)
                : state.animationName || '—'}
            </strong>
          </div>
          <div className="stageStats">
            <span>
              <strong>{state.camera.scale.toFixed(1)}×</strong> zoom
            </span>
            {mode === 'character' && (
              <span>
                <strong>{state.selectedBubble >= 0 ? `#${state.selectedBubble}` : '—'}</strong>{' '}
                bubble
              </span>
            )}
            {mode === 'stage' && (
              <span>
                <strong>{stageIssues.length}</strong> issues
              </span>
            )}
          </div>
        </div>
        {mode === 'stage' && hasStage ? (
          <ErrorBoundary label="Stage scene">
            <StageSceneViewer
              stage={state.stage!}
              selection={state.stageSelection}
              camera={state.camera}
              onSelect={(selection) =>
                dispatch({ type: 'SET_STAGE_SELECTION', payload: selection })
              }
              onCameraChange={updateCamera}
              onChange={onStageChange}
              showGrid={showGrid}
            />
          </ErrorBoundary>
        ) : mode === 'character' && hasAnimation ? (
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
            <h2>
              {library.ready
                ? `Pick ${mode === 'stage' ? 'a stage' : 'an animation'} to start`
                : 'No source loaded'}
            </h2>
            <p>
              {library.ready
                ? mode === 'stage'
                  ? 'Choose a stage on the left, or create a new scene document.'
                  : 'Choose a character on the left, then select one of its animations to begin editing.'
                : 'Use the source button up top to open a game directory, pick a folder, or drag files into the window.'}
            </p>
          </div>
        )}
      </main>

      {mode === 'stage' && hasStage ? (
        <ErrorBoundary label="Stage inspector">
          <StageInspector
            stage={state.stage!}
            selection={state.stageSelection}
            issues={stageIssues}
            onSelectionChange={(selection) =>
              dispatch({ type: 'SET_STAGE_SELECTION', payload: selection })
            }
            onChange={onStageChange}
          />
        </ErrorBoundary>
      ) : mode === 'character' && hasAnimation && state.character && state.animation ? (
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
              Select {mode === 'stage' ? 'a stage' : 'an animation'} to view its properties.
            </div>
          </div>
        </aside>
      )}

      {mode === 'stage' && hasStage ? (
        <ErrorBoundary label="Stage timeline">
          <StageTimeline
            stage={state.stage!}
            selection={state.stageSelection}
            onChange={onStageChange}
          />
        </ErrorBoundary>
      ) : mode === 'character' && hasAnimation && state.character && state.animation ? (
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
            {mode === 'stage'
              ? 'Stage animation tracks appear here.'
              : 'Timeline appears once an animation is open.'}
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
