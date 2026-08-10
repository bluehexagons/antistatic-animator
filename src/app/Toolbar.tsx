/**
 * Toolbar — top app bar with source picker, save, view toggles, version.
 */

import React from 'react';
import type { EditorMode } from './Sidebar';

export interface ToolbarProps {
  appName: string;
  version: string;
  sourceLabel: string;
  sourceKind: string;
  ready: boolean;
  canSave: boolean;
  saveBlocked: boolean;
  onOpenSource: () => void;
  onSave: () => void;
  saveDirty: boolean;
  liveSync: boolean;
  liveSyncAvailable: boolean;
  onToggleLiveSync: () => void;
  externalChange: boolean;
  onReloadSource: () => void;
  editorMode: EditorMode;

  // undo / redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // view toggles
  showGrid: boolean;
  onToggleGrid: () => void;
  showGround: boolean;
  onToggleGround: () => void;
  showHitboxes: boolean;
  onToggleHitboxes: () => void;
  showOnion: boolean;
  onToggleOnion: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showShield: boolean;
  onToggleShield: () => void;
  onResetCamera: () => void;

  gameAvailable: boolean;
  gameActive: boolean;
  onOpenGameTools: () => void;
}

const labelForKind = (kind: string) => {
  switch (kind) {
    case 'electron':
      return 'Local';
    case 'fs-access':
      return 'Folder';
    case 'upload':
      return 'Uploaded';
    default:
      return 'None';
  }
};

export const Toolbar: React.FC<ToolbarProps> = ({
  appName,
  version,
  sourceLabel,
  sourceKind,
  ready,
  canSave,
  saveBlocked,
  onOpenSource,
  onSave,
  saveDirty,
  liveSync,
  liveSyncAvailable,
  onToggleLiveSync,
  externalChange,
  onReloadSource,
  editorMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showGrid,
  onToggleGrid,
  showGround,
  onToggleGround,
  showHitboxes,
  onToggleHitboxes,
  showOnion,
  onToggleOnion,
  showLabels,
  onToggleLabels,
  showShield,
  onToggleShield,
  onResetCamera,
  gameAvailable,
  gameActive,
  onOpenGameTools,
}) => {
  const toggleStyle = (on: boolean, color = 'var(--accent)') => ({
    background: on ? 'var(--accent-soft)' : undefined,
    color: on ? color : undefined,
  });
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brandMark" />
        <span>
          {appName}
          <span className="brandSub"> / animator</span>
          <span className="versionTag">v{version}</span>
        </span>
      </div>

      <div className="toolbarSpacer" />

      <div className="toolbarGroup">
        <button
          className="iconBtn"
          title="Toggle grid"
          aria-pressed={showGrid}
          onClick={onToggleGrid}
          style={toggleStyle(showGrid)}
        >
          ⊞
        </button>
        {editorMode === 'character' && (
          <>
            <button
              className="iconBtn"
              title="Toggle ground"
              aria-pressed={showGround}
              onClick={onToggleGround}
              style={toggleStyle(showGround)}
            >
              ⎯
            </button>
            <button
              className="iconBtn"
              title="Toggle hitboxes"
              aria-pressed={showHitboxes}
              onClick={onToggleHitboxes}
              style={toggleStyle(showHitboxes, 'var(--hit)')}
            >
              ◉
            </button>
            <button
              className="iconBtn"
              title="Toggle onion-skin (previous / next keyframes)"
              aria-pressed={showOnion}
              onClick={onToggleOnion}
              style={toggleStyle(showOnion)}
            >
              ◍
            </button>
            <button
              className="iconBtn"
              title="Toggle bone-name labels"
              aria-pressed={showLabels}
              onClick={onToggleLabels}
              style={toggleStyle(showLabels)}
            >
              {/* U+FE0E forces monochrome (text) rendering to match the icon set. */}
              {'🏷︎'}
            </button>
            <button
              className="iconBtn"
              title="Toggle shield overlay"
              aria-pressed={showShield}
              onClick={onToggleShield}
              style={toggleStyle(showShield, 'var(--accent-warm)')}
            >
              {'🛡︎'}
            </button>
          </>
        )}
        <button className="iconBtn" title="Reset camera" onClick={onResetCamera}>
          ⌂
        </button>
        <span className="toolbarSep" />
        <button className="iconBtn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          ↩
        </button>
        <button
          className="iconBtn"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↪
        </button>
      </div>

      <div className="toolbarSpacer" />

      <button
        className={`sourceChip ${ready ? '' : 'empty'}`}
        onClick={onOpenSource}
        title={sourceLabel}
      >
        <span className="dot" />
        <span style={{ fontWeight: 600, marginRight: 4 }}>{labelForKind(sourceKind)}</span>
        <span
          style={{
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sourceLabel}
        </span>
      </button>

      {gameAvailable && (
        <button
          className={`btn ghost ${gameActive ? 'primary' : ''}`}
          onClick={onOpenGameTools}
          title="Launch Antistatic or open the headless testing console"
        >
          {gameActive ? 'Game test *' : 'Game tools'}
        </button>
      )}

      <button
        className={`btn ${saveDirty ? 'primary' : ''}`}
        disabled={!canSave || !ready || saveBlocked}
        onClick={onSave}
        title={
          saveBlocked
            ? 'Reload the externally changed source before saving'
            : canSave
              ? 'Save current animation'
              : 'This source is read-only'
        }
      >
        {saveDirty ? 'Save *' : 'Save'}
      </button>
      {liveSyncAvailable && (
        <button
          className={`btn ghost ${liveSync ? 'primary' : ''}`}
          aria-pressed={liveSync}
          onClick={onToggleLiveSync}
          title="Automatically save edits for Antistatic's Live Reload option"
        >
          {liveSync ? 'Live on' : 'Live sync'}
        </button>
      )}
      {externalChange && (
        <button
          className="btn ghost"
          onClick={onReloadSource}
          title="Reload the changed source file"
        >
          Reload changed
        </button>
      )}
    </header>
  );
};
