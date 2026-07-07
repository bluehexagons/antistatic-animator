/**
 * Animator Context and Reducer
 *
 * Provides global state management for the animator editor.
 * Replaces the previous global mutable singletons with React reducers.
 *
 * Supports undo/redo: the provider wraps dispatch to snapshot state before
 * data-modifying actions, and exposes undo/redo callbacks.
 */

import React, { createContext, useReducer, useRef, useCallback, useState, ReactNode } from 'react';
import type { EntityData, Animation, AnimationMap } from '../types';
import { getLocalStorageItem } from '../../runtime/local-storage';

const MAX_HISTORY = 50;
const BATCH_MS = 300;

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

export interface AppState {
  appDir: string;
  character: EntityData | null;
  parsed: AnimationMap | null;
  animFile: string;
  animation: Animation | null;
  /** Map key of the open animation (the JSON data itself carries no name). */
  animationName: string;
  keyframe: number;
  selectedBubble: number;
  camera: CameraState;
  initialized: boolean;
}

/** Actions that mutate user data and should be tracked for undo. */
const UNDO_TRACKED: ReadonlySet<string> = new Set(['SET_ANIMATION', 'SET_CHARACTER', 'SET_PARSED']);

export type AppAction =
  | { type: 'SET_APP_DIR'; payload: string }
  | { type: 'SET_CHARACTER'; payload: EntityData | null }
  | { type: 'SET_PARSED'; payload: AnimationMap | null }
  | { type: 'SET_ANIM_FILE'; payload: string }
  // `name` present (or `animation === null`) marks a fresh selection: reset
  // the keyframe/selection. Omitting `name` is an in-place re-render after an
  // edit and preserves them.
  // `updateParsed: true` tells the reducer to also update parsed[name] with
  // the new animation (used for in-place edits).
  | {
      type: 'SET_ANIMATION';
      payload: {
        animation: Animation | null;
        name?: string;
        updateParsed?: boolean;
      };
    }
  | { type: 'SET_KEYFRAME'; payload: number }
  | { type: 'SET_SELECTED_BUBBLE'; payload: number }
  | { type: 'SET_CAMERA'; payload: Partial<CameraState> }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'REPLACE_STATE'; payload: AppState }
  | { type: 'RESET' };

const getInitialAppDir = (): string => {
  const stored = getLocalStorageItem('antistatic-dir');
  if (stored) return stored;
  if (typeof window !== 'undefined' && window.nodeAPI?.process?.cwd) {
    return window.nodeAPI.process.cwd();
  }
  return '';
};

const initialState: AppState = {
  appDir: getInitialAppDir(),
  character: null,
  parsed: null,
  animFile: '',
  animation: null,
  animationName: '',
  keyframe: 0,
  selectedBubble: -1,
  camera: {
    x: 0,
    y: 0.1,
    scale: 2,
  },
  initialized: false,
};

export { initialState };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_APP_DIR':
      return { ...state, appDir: action.payload };

    case 'SET_CHARACTER':
      return { ...state, character: action.payload };

    case 'SET_PARSED':
      return { ...state, parsed: action.payload };

    case 'SET_ANIM_FILE':
      // Not in UNDO_TRACKED — implicitly restored via REPLACE_STATE since
      // the snapshot captures the full state. If you add a tracked action
      // that does NOT use REPLACE_STATE, verify animFile is handled.
      return { ...state, animFile: action.payload };

    case 'SET_ANIMATION': {
      const { animation, name, updateParsed } = action.payload;
      // A fresh selection (name given, or clearing) resets the playhead and
      // selection; an in-place edit re-render keeps the user where they are.
      const fresh = name !== undefined || animation === null;
      const result = {
        ...state,
        animation,
        animationName: animation === null ? '' : (name ?? state.animationName),
        ...(fresh ? { keyframe: 0, selectedBubble: -1 } : {}),
      };
      // In-place edits update the parsed map entry so save() sees the change.
      if (updateParsed && animation && result.animationName && result.parsed) {
        result.parsed = { ...result.parsed, [result.animationName]: animation };
      }
      return result;
    }

    case 'SET_KEYFRAME':
      return { ...state, keyframe: action.payload, selectedBubble: -1 };

    case 'SET_SELECTED_BUBBLE':
      return { ...state, selectedBubble: action.payload };

    case 'SET_CAMERA':
      return {
        ...state,
        camera: { ...state.camera, ...action.payload },
      };

    case 'SET_INITIALIZED':
      return { ...state, initialized: action.payload };

    case 'REPLACE_STATE':
      // Trusted — payload comes only from internal undo/redo machinery
      // which snapshots the state via deepCloneState.
      return action.payload;

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export interface AnimatorContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const AnimatorContext = createContext<AnimatorContextType | undefined>(undefined);

interface AnimatorProviderProps {
  children: ReactNode;
}

// Deep-clone the pieces of state that can be mutated in-place between
// renders, so the snapshot is independent of future mutations.
const deepCloneState = (s: AppState, animName: string): AppState => {
  const cloned: AppState = {
    ...s,
    parsed: s.parsed ? { ...s.parsed } : null,
    animation: s.animation ? structuredClone(s.animation) : null,
    character: s.character ? structuredClone(s.character) : null,
  };
  // Alias the parsed entry so both state and the map point to the same
  // deep-cloned animation — the snapshot is never mutated so sharing is safe.
  if (cloned.parsed && animName && cloned.animation) {
    cloned.parsed[animName] = cloned.animation;
  }
  return cloned;
};

// Flush a pending batch snapshot into history.
const flushPending = (
  pendingRef: React.MutableRefObject<AppState | null>,
  batchRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  historyRef: React.MutableRefObject<AppState[]>
) => {
  if (batchRef.current) {
    clearTimeout(batchRef.current);
    batchRef.current = null;
  }
  if (pendingRef.current) {
    historyRef.current.push(pendingRef.current);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    pendingRef.current = null;
  }
};

export const AnimatorProvider: React.FC<AnimatorProviderProps> = ({ children }) => {
  const [state, baseDispatch] = useReducer(appReducer, initialState);
  const historyRef = useRef<AppState[]>([]);
  const futureRef = useRef<AppState[]>([]);
  const pendingRef = useRef<AppState | null>(null);
  const batchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [version, setVersion] = useState(0);

  // Lazy snapshot: only deep-clone state when a tracked action has been
  // consumed (snapshotStale), rather than on every render. Edits mutate the
  // live state arrays in place *before* dispatching, so reading `state` at
  // dispatch time would capture the already-edited values. Because in-place
  // mutations only happen inside event handlers (between renders), this
  // render-time clone always reflects the pre-edit state and is safe for undo.
  const snapshotStale = useRef(true);
  const snapshotRef = useRef<AppState>(initialState);
  if (snapshotStale.current) {
    snapshotRef.current = deepCloneState(state, state.animationName);
    snapshotStale.current = false;
  }

  // Snapshot the prior state before tracked actions so we can undo to it.
  // Rapid successive actions (e.g. keyframe scrubbing) are batched into a
  // single undo step via a debounce timer.
  const dispatch = useCallback((action: AppAction) => {
    if (UNDO_TRACKED.has(action.type)) {
      futureRef.current = [];
      // First action in a batch: snapshot the pre-edit state so undo reverts
      // the in-place mutation that triggered this dispatch.
      if (!pendingRef.current) {
        pendingRef.current = snapshotRef.current;
        snapshotStale.current = true;
      }
      // Reset the debounce timer so the batch extends.
      if (batchRef.current) clearTimeout(batchRef.current);
      batchRef.current = setTimeout(() => {
        batchRef.current = null;
        if (pendingRef.current) {
          historyRef.current.push(pendingRef.current);
          if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
          pendingRef.current = null;
        }
        setVersion((v) => v + 1);
      }, BATCH_MS);
    }
    baseDispatch(action);
  }, []);

  const undo = useCallback(() => {
    flushPending(pendingRef, batchRef, historyRef);
    const prev = historyRef.current.pop();
    if (prev) {
      futureRef.current.push(deepCloneState(state, state.animationName));
      baseDispatch({ type: 'REPLACE_STATE', payload: prev });
    }
    setVersion((v) => v + 1);
  }, [state]);

  const redo = useCallback(() => {
    flushPending(pendingRef, batchRef, historyRef);
    const next = futureRef.current.pop();
    if (next) {
      historyRef.current.push(deepCloneState(state, state.animationName));
      baseDispatch({ type: 'REPLACE_STATE', payload: next });
    }
    setVersion((v) => v + 1);
  }, [state]);

  // Derive canUndo/canRedo from refs + pending state. We bump `version` via
  // setVersion whenever history/future stacks change (incl. inside setTimeout)
  // to force a re-render so consumers see current values.
  // DO NOT remove: this is the only re-render trigger for ref-derived booleans.
  void version;
  const canUndo = historyRef.current.length > 0 || !!pendingRef.current;
  const canRedo = futureRef.current.length > 0;

  return (
    <AnimatorContext.Provider value={{ state, dispatch, undo, redo, canUndo, canRedo }}>
      {children}
    </AnimatorContext.Provider>
  );
};

export function useAnimator() {
  const context = React.useContext(AnimatorContext);
  if (context === undefined) {
    throw new Error('useAnimator must be used within an AnimatorProvider');
  }
  return context;
}
