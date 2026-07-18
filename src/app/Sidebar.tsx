/**
 * Sidebar — left panel: file list + animation list, with quick filters.
 */

import React, { useMemo, useState } from 'react';
import type { StageSceneItem } from '../stage/document';
import type { StageSelection, StageSelectionKind } from '../stage/types';

export type EditorMode = 'character' | 'stage';

export interface SidebarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  /** Available character files (basenames). */
  files: string[];
  /** Currently selected character file. */
  selectedFile: string | null;
  onSelectFile: (file: string) => void;

  /** Available animations within the selected character. */
  animations: string[];
  selectedAnimation: string | null;
  onSelectAnimation: (name: string) => void;

  /** Counts displayed next to each animation row. */
  animationKeyframeCounts?: Record<string, number>;

  stageFiles: string[];
  selectedStageFile: string | null;
  onSelectStageFile: (file: string) => void;
  onCreateStage: () => void;
  stageItems: StageSceneItem[];
  selectedStageItem: StageSelection;
  onSelectStageItem: (selection: StageSelection) => void;
  onAddStageItem: (kind: Exclude<StageSelectionKind, 'stage'>) => void;
  onDeleteStageItem: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode,
  onModeChange,
  files,
  selectedFile,
  onSelectFile,
  animations,
  selectedAnimation,
  onSelectAnimation,
  animationKeyframeCounts,
  stageFiles,
  selectedStageFile,
  onSelectStageFile,
  onCreateStage,
  stageItems,
  selectedStageItem,
  onSelectStageItem,
  onAddStageItem,
  onDeleteStageItem,
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [animFilter, setAnimFilter] = useState('');
  const [addKind, setAddKind] = useState<Exclude<StageSelectionKind, 'stage'>>('collision');

  const activeFiles = mode === 'stage' ? stageFiles : files;
  const activeFile = mode === 'stage' ? selectedStageFile : selectedFile;

  const filteredFiles = useMemo(
    () =>
      activeFiles.filter((f) => !fileFilter || f.toLowerCase().includes(fileFilter.toLowerCase())),
    [activeFiles, fileFilter]
  );
  const filteredAnims = useMemo(
    () =>
      animations.filter((a) => !animFilter || a.toLowerCase().includes(animFilter.toLowerCase())),
    [animations, animFilter]
  );

  return (
    <aside className="sidebar">
      <div className="editorModeTabs">
        <button
          className={mode === 'character' ? 'active' : ''}
          onClick={() => onModeChange('character')}
        >
          Characters
        </button>
        <button className={mode === 'stage' ? 'active' : ''} onClick={() => onModeChange('stage')}>
          Stages
        </button>
      </div>
      <div className="sidebarSection" style={{ flex: '0 1 35%' }}>
        <div className="sidebarHeading sidebarHeadingRow">
          <span>{mode === 'stage' ? 'Stage files' : 'Characters'}</span>
          {mode === 'stage' && (
            <button className="miniAction" onClick={onCreateStage} title="Create stage">
              +
            </button>
          )}
        </div>
        <input
          className="filterInput"
          placeholder="filter…"
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
        />
        <div className="list">
          {filteredFiles.length === 0 && <div className="listEmpty">No files loaded</div>}
          {filteredFiles.map((f) => (
            <button
              key={f}
              type="button"
              className={`listItem ${f === activeFile ? 'active' : ''}`}
              onClick={() => (mode === 'stage' ? onSelectStageFile(f) : onSelectFile(f))}
            >
              {f.replace(/^stages\//, '').replace(/\.jsonc?$/, '')}
            </button>
          ))}
        </div>
      </div>
      <div className="sidebarSection">
        <div className="sidebarHeading">{mode === 'stage' ? 'Scene objects' : 'Animations'}</div>
        <input
          className="filterInput"
          placeholder="filter…"
          value={animFilter}
          onChange={(e) => setAnimFilter(e.target.value)}
          disabled={mode === 'stage' ? !stageItems.length : !animations.length}
        />
        <div className="list">
          {mode === 'character' && animations.length === 0 && (
            <div className="listEmpty">
              {selectedFile ? 'No animations in this file' : 'Select a character first'}
            </div>
          )}
          {mode === 'character' &&
            filteredAnims.map((a) => (
              <button
                key={a}
                type="button"
                className={`listItem ${a === selectedAnimation ? 'active' : ''}`}
                onClick={() => onSelectAnimation(a)}
              >
                <span>{a}</span>
                {animationKeyframeCounts && (
                  <span className="badge">{animationKeyframeCounts[a] ?? 0}</span>
                )}
              </button>
            ))}
          {mode === 'stage' &&
            stageItems
              .filter(
                (item) => !animFilter || item.label.toLowerCase().includes(animFilter.toLowerCase())
              )
              .map((item) => {
                const active =
                  item.selection.kind === selectedStageItem.kind &&
                  item.selection.id === selectedStageItem.id;
                return (
                  <button
                    key={`${item.selection.kind}:${item.selection.id ?? ''}`}
                    type="button"
                    className={`listItem ${active ? 'active' : ''}`}
                    onClick={() => onSelectStageItem(item.selection)}
                  >
                    <span>{item.label}</span>
                    <span className="badge">{item.badge}</span>
                  </button>
                );
              })}
        </div>
        {mode === 'stage' && selectedStageFile && (
          <div className="stageObjectActions">
            <select
              value={addKind}
              onChange={(event) => setAddKind(event.target.value as typeof addKind)}
            >
              <option value="collision">collision</option>
              <option value="model">model</option>
              <option value="pointLight">point light</option>
              <option value="fogVolume">fog volume</option>
              <option value="particleEmitter">particle emitter</option>
              <option value="animation">animation</option>
            </select>
            <button className="btn" onClick={() => onAddStageItem(addKind)}>
              Add
            </button>
            <button
              className="btn ghost"
              disabled={selectedStageItem.kind === 'stage'}
              onClick={onDeleteStageItem}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
