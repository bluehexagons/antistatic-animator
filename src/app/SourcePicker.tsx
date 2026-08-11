/**
 * Empty-state picker shown when no source has been loaded.
 * Offers the relevant entry points depending on runtime capabilities.
 */

import React from 'react';
import { detectCapabilities } from '../storage/types';
import type { ExampleProject } from '../examples';

export interface SourcePickerProps {
  onElectron: () => void;
  onFsAccess: () => void;
  onUpload: () => void;
  examples: ExampleProject[];
  onExample: (id: string) => void;
}

export const SourcePicker: React.FC<SourcePickerProps> = ({
  onElectron,
  onFsAccess,
  onUpload,
  examples,
  onExample,
}) => {
  const caps = detectCapabilities();
  const [showExamples, setShowExamples] = React.useState(false);

  return (
    <div
      className="sourcePicker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-picker-title"
    >
      <div className="sourceCard">
        <h1 id="source-picker-title">Open a character project</h1>
        <p>
          Antistatic Animator edits the character/animation JSONC files used by the game. Pick where
          your files live and we&apos;ll load them up.
        </p>
        <div className="sourceOptions">
          {caps.hasElectron && (
            <button className="sourceOption" onClick={onElectron} aria-label="Open game directory">
              <span className="icon" aria-hidden="true">
                📁
              </span>
              <span className="text">
                <strong>Open game directory…</strong>
                <small>Browse to your Antistatic installation. Reads & saves directly.</small>
              </span>
            </button>
          )}
          {caps.hasFsAccess && !caps.hasElectron && (
            <button className="sourceOption" onClick={onFsAccess} aria-label="Pick a folder">
              <span className="icon" aria-hidden="true">
                📁
              </span>
              <span className="text">
                <strong>Pick a folder…</strong>
                <small>
                  Uses the browser File System API to read &amp; save your character data folder
                  directly.
                </small>
              </span>
            </button>
          )}
          <button className="sourceOption" onClick={onUpload} aria-label="Upload files">
            <span className="icon" aria-hidden="true">
              📥
            </span>
            <span className="text">
              <strong>Drag &amp; drop files</strong>
              <small>
                Drop your <code>data</code> folder anywhere on the window, or click here to pick
                files. Edits are saved by downloading the updated JSON.
              </small>
            </span>
          </button>
          <button
            type="button"
            className="sourceOption exampleLauncher"
            onClick={() => setShowExamples((visible) => !visible)}
            aria-expanded={showExamples}
            aria-controls="example-options"
          >
            <span className="icon" aria-hidden="true">
              ✨
            </span>
            <span className="text">
              <strong>Try examples — files stay local in your browser</strong>
              <small>Explore the editor without a game checkout. Nothing is uploaded.</small>
            </span>
          </button>
        </div>
        {showExamples && (
          <div className="exampleOptions" id="example-options">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className="exampleOption"
                onClick={() => onExample(example.id)}
              >
                <strong>{example.name}</strong>
                <small>{example.description}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
