/**
 * Sidebar — left panel: file list + animation list, with quick filters.
 */

import React, { useMemo, useState } from 'react';

export interface SidebarProps {
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  selectedFile,
  onSelectFile,
  animations,
  selectedAnimation,
  onSelectAnimation,
  animationKeyframeCounts,
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [animFilter, setAnimFilter] = useState('');

  const filteredFiles = useMemo(
    () => files.filter((f) => !fileFilter || f.toLowerCase().includes(fileFilter.toLowerCase())),
    [files, fileFilter]
  );
  const filteredAnims = useMemo(
    () =>
      animations.filter((a) => !animFilter || a.toLowerCase().includes(animFilter.toLowerCase())),
    [animations, animFilter]
  );

  return (
    <aside className="sidebar">
      <div className="sidebarSection" style={{ flex: '0 1 35%' }}>
        <div className="sidebarHeading">Characters</div>
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
              className={`listItem ${f === selectedFile ? 'active' : ''}`}
              onClick={() => onSelectFile(f)}
            >
              {f.replace(/\.jsonc?$/, '')}
            </button>
          ))}
        </div>
      </div>
      <div className="sidebarSection">
        <div className="sidebarHeading">Animations</div>
        <input
          className="filterInput"
          placeholder="filter…"
          value={animFilter}
          onChange={(e) => setAnimFilter(e.target.value)}
          disabled={!animations.length}
        />
        <div className="list">
          {animations.length === 0 && (
            <div className="listEmpty">
              {selectedFile ? 'No animations in this file' : 'Select a character first'}
            </div>
          )}
          {filteredAnims.map((a) => (
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
        </div>
      </div>
    </aside>
  );
};
