/**
 * Empty-state picker shown when no source has been loaded.
 * Offers the relevant entry points depending on runtime capabilities.
 */

import React from 'react';
import { detectCapabilities } from '../storage/types';

export interface SourcePickerProps {
  onElectron: () => void;
  onFsAccess: () => void;
  onUpload: () => void;
}

export const SourcePicker: React.FC<SourcePickerProps> = ({ onElectron, onFsAccess, onUpload }) => {
  const caps = detectCapabilities();

  return (
    <div className="sourcePicker">
      <div className="sourceCard">
        <h1>Open a character project</h1>
        <p>
          Antistatic Animator edits the character/animation JSONC files used by the game. Pick where
          your files live and we&apos;ll load them up.
        </p>
        <div className="sourceOptions">
          {caps.hasElectron && (
            <button className="sourceOption" onClick={onElectron}>
              <span className="icon">📁</span>
              <span className="text">
                <strong>Open game directory…</strong>
                <small>Browse to your Antistatic installation. Reads & saves directly.</small>
              </span>
            </button>
          )}
          {caps.hasFsAccess && !caps.hasElectron && (
            <button className="sourceOption" onClick={onFsAccess}>
              <span className="icon">📁</span>
              <span className="text">
                <strong>Pick a folder…</strong>
                <small>
                  Uses the browser File System API to read &amp; save your character data folder
                  directly.
                </small>
              </span>
            </button>
          )}
          <button className="sourceOption" onClick={onUpload}>
            <span className="icon">📥</span>
            <span className="text">
              <strong>Drag &amp; drop files</strong>
              <small>
                Drop your <code>data</code> folder anywhere on the window, or click here to pick
                files. Edits are saved by downloading the updated JSON.
              </small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
