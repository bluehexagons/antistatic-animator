/**
 * useEditorCanvas Hook
 *
 * React hook that manages canvas event handlers for the animation editor.
 * Wires up mouse and keyboard events to the vanilla JS event handlers.
 */

import { useEffect, useRef } from 'react';
import {
  initCanvasEvents,
  downEditor,
  moveEditor,
  upEditor,
  keydownEditor,
  keyupEditor,
  refreshEditor,
} from '../events/canvas-events';

interface UseEditorCanvasOptions {
  /** Enable event handlers (disable when not focused) */
  enabled?: boolean;
}

/**
 * Hook to manage editor canvas events
 */
export function useEditorCanvas(options: UseEditorCanvasOptions = {}) {
  const { enabled = true } = options;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas and context
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctxRef.current = ctx;
    initCanvasEvents(canvasRef.current, ctx);
  }, []);

  // Attach mouse event handlers
  useEffect(() => {
    if (!enabled || !canvasRef.current) return;

    const canvas = canvasRef.current;

    canvas.addEventListener('mousedown', downEditor);
    canvas.addEventListener('mousemove', moveEditor);
    canvas.addEventListener('mouseup', upEditor);

    return () => {
      canvas.removeEventListener('mousedown', downEditor);
      canvas.removeEventListener('mousemove', moveEditor);
      canvas.removeEventListener('mouseup', upEditor);
    };
  }, [enabled]);

  // Attach keyboard event handlers (global)
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', keydownEditor);
    document.addEventListener('keyup', keyupEditor);

    return () => {
      document.removeEventListener('keydown', keydownEditor);
      document.removeEventListener('keyup', keyupEditor);
    };
  }, [enabled]);

  return {
    canvasRef,
    refreshEditor,
  };
}
