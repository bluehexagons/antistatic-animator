/**
 * Toolbar — top app bar with source picker, save, view toggles, version.
 */

import React from 'react';

export interface ToolbarProps {
  appName: string;
  version: string;
  sourceLabel: string;
  sourceKind: string;
  ready: boolean;
  canSave: boolean;
  onOpenSource: () => void;
  onSave: () => void;
  saveDirty: boolean;

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
  onOpenSource,
  onSave,
  saveDirty,
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
          onClick={onToggleGrid}
          style={{
            background: showGrid ? 'var(--accent-soft)' : undefined,
            color: showGrid ? 'var(--accent)' : undefined,
          }}
        >
          ⊞
        </button>
        <button
          className="iconBtn"
          title="Toggle ground"
          onClick={onToggleGround}
          style={{
            background: showGround ? 'var(--accent-soft)' : undefined,
            color: showGround ? 'var(--accent)' : undefined,
          }}
        >
          ⎯
        </button>
        <button
          className="iconBtn"
          title="Toggle hitboxes"
          onClick={onToggleHitboxes}
          style={toggleStyle(showHitboxes, 'var(--hit)')}
        >
          ◉
        </button>
        <button
          className="iconBtn"
          title="Toggle onion-skin (previous / next keyframes)"
          onClick={onToggleOnion}
          style={toggleStyle(showOnion)}
        >
          ◍
        </button>
        <button
          className="iconBtn"
          title="Toggle bone-name labels"
          onClick={onToggleLabels}
          style={toggleStyle(showLabels)}
        >
          {/* U+FE0E forces monochrome (text) rendering to match the icon set. */}
          {'🏷︎'}
        </button>
        <button
          className="iconBtn"
          title="Toggle shield overlay"
          onClick={onToggleShield}
          style={toggleStyle(showShield, '#6aa9ff')}
        >
          {'🛡︎'}
        </button>
        <button className="iconBtn" title="Reset camera" onClick={onResetCamera}>
          ⌂
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

      <button
        className={`btn ${saveDirty ? 'primary' : ''}`}
        disabled={!canSave || !ready}
        onClick={onSave}
        title={canSave ? 'Save current animation' : 'This source is read-only'}
      >
        {saveDirty ? 'Save *' : 'Save'}
      </button>
    </header>
  );
};
