/**
 * Animator Context and Reducer
 *
 * Provides global state management for the animator editor.
 * Replaces the previous global mutable singletons with React reducers.
 */

import React, { createContext, useReducer, ReactNode } from 'react';
import type { EntityData, Animation, AnimationMap } from '../types';

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

export type AppAction =
  | { type: 'SET_APP_DIR'; payload: string }
  | { type: 'SET_CHARACTER'; payload: EntityData | null }
  | { type: 'SET_PARSED'; payload: AnimationMap | null }
  | { type: 'SET_ANIM_FILE'; payload: string }
  // `name` present (or `animation === null`) marks a fresh selection: reset
  // the keyframe/selection. Omitting `name` is an in-place re-render after an
  // edit and preserves them.
  | { type: 'SET_ANIMATION'; payload: { animation: Animation | null; name?: string } }
  | { type: 'SET_KEYFRAME'; payload: number }
  | { type: 'SET_SELECTED_BUBBLE'; payload: number }
  | { type: 'SET_CAMERA'; payload: Partial<CameraState> }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'RESET' };

const getInitialAppDir = (): string => {
  if (typeof localStorage !== 'undefined' && localStorage['antistatic-dir']) {
    return localStorage['antistatic-dir'];
  }
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
      return { ...state, animFile: action.payload };

    case 'SET_ANIMATION': {
      const { animation, name } = action.payload;
      // A fresh selection (name given, or clearing) resets the playhead and
      // selection; an in-place edit re-render keeps the user where they are.
      const fresh = name !== undefined || animation === null;
      return {
        ...state,
        animation,
        animationName: animation === null ? '' : (name ?? state.animationName),
        ...(fresh ? { keyframe: 0, selectedBubble: -1 } : {}),
      };
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

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface AnimatorContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AnimatorContext = createContext<AnimatorContextType | undefined>(undefined);

interface AnimatorProviderProps {
  children: ReactNode;
}

export const AnimatorProvider: React.FC<AnimatorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AnimatorContext.Provider value={{ state, dispatch }}>{children}</AnimatorContext.Provider>
  );
};

export function useAnimator() {
  const context = React.useContext(AnimatorContext);
  if (context === undefined) {
    throw new Error('useAnimator must be used within an AnimatorProvider');
  }
  return context;
}
