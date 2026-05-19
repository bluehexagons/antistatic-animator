/**
 * Whole-window drag-and-drop overlay used to load files in the browser.
 */

import React, { useEffect, useState } from 'react';
import { collectFilesFromDrop } from '../storage/upload';

export interface DropZoneProps {
  onFiles: (files: File[]) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFiles }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      depth++;
      setActive(true);
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
    };
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = await collectFilesFromDrop(e.dataTransfer.items);
      onFiles(files);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles]);

  return (
    <div className={`dropZone ${active ? 'active' : ''}`}>
      <div className="dropCard">
        <h2>Drop character files</h2>
        <p>JSONC files inside will be loaded into the editor.</p>
      </div>
    </div>
  );
};
