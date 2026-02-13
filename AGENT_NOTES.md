# Agent Notes - Antistatic Animator

## Project Overview

This is a legacy Electron-based animation editor for fighting game character animations. The tool allows editing of:
- **Hurtbubbles** (character hitboxes that can be hit)
- **Hitbubbles** (attack hitboxes)
- **Animation keyframes** with frame data (duration, interpolation, etc.)

## Recent Modernization (Feb 2026)

### Phase 1: Infrastructure ✅ COMPLETE
- Upgraded Electron v35 → v40 with proper security (context isolation)
- Upgraded React v18 → v19 with new JSX transform
- Updated all dependencies to latest versions (0 vulnerabilities)
- Modernized TypeScript configuration (ES2022, bundler resolution)
- Added ESLint 9 + Prettier with flat config
- Added pre-commit hooks (husky + lint-staged)
- Enhanced CI/CD with type-check and lint steps
- Fixed all linting warnings and enabled stricter TypeScript settings

### Phase 2: Code Splitting 🚧 IN PROGRESS
The main `src/animator.ts` file is 1594 lines and needs to be split into logical modules and ported to React.

## File Structure Analysis

### Current Structure
```
src/
├── animator.ts        (1594 lines - NEEDS SPLITTING)
├── react.tsx          (55 lines - main app entry)
├── electron.ts        (main process)
├── preload.ts         (IPC bridge)
├── easing.ts          (easing functions)
├── utils.ts           (file utilities)
├── types/
│   └── global.d.ts    (Window extensions)
├── runtime/
│   ├── fs.ts          (filesystem abstraction)
│   ├── path.ts        (path utilities)
│   ├── electron-renderer.ts  (legacy, unused)
│   └── require.ts     (legacy, unused)
└── styles.module.css
```

### Proposed New Structure
```
src/
├── main.tsx                    (App entry point)
├── electron.ts
├── preload.ts
├── easing.ts
├── utils.ts
├── animator/
│   ├── index.ts               (Main init and exports)
│   ├── types.ts               (All type definitions)
│   ├── constants.ts           (Config objects, defaults)
│   ├── state/
│   │   ├── EditingState.ts    (editing, dragging state)
│   │   ├── CameraState.ts     (editorCamera)
│   │   └── FileState.ts       (character, parsed, etc.)
│   ├── rendering/
│   │   ├── canvas-utils.ts    (pathCircle, pathCapsule, point)
│   │   ├── bubble-painter.ts  (paintBubbles - PERF CRITICAL)
│   │   └── bubble-finder.ts   (findBubbles - PERF CRITICAL)
│   ├── components/
│   │   ├── PropertyEditor.tsx (makePropDisplay → React)
│   │   ├── StatsDisplay.tsx   (makeStatDisplay → React)
│   │   ├── KeyframeEditor.tsx (makeKeyframeEditor → React)
│   │   ├── BubblePreview.tsx  (bubblePreview → React)
│   │   ├── ManipulationToolbar.tsx (keyframeCopier → React)
│   │   ├── AnimationCanvas.tsx (Editor canvas with events)
│   │   └── FileSelector.tsx   (File/animation dropdowns)
│   ├── hooks/
│   │   ├── useEditorCanvas.ts (Canvas event handlers)
│   │   ├── useKeyboardNav.ts  (WASD navigation)
│   │   └── useAnimationLoader.ts (loadAnimation logic)
│   ├── events/
│   │   ├── mouse-handlers.ts  (downEditor, moveEditor, upEditor)
│   │   └── keyboard-handlers.ts (keydownEditor, keyupEditor, keytick)
│   ├── api/
│   │   └── tools.ts           (Tools API for console)
│   └── operations/
│       ├── file-operations.ts (save, populateSelect)
│       ├── keyframe-ops.ts    (handleInsert*, handleSwap*, etc.)
│       └── animation-playback.ts (renderAnimation - unused)
├── runtime/
│   ├── fs.ts
│   └── path.ts
├── types/
│   └── global.d.ts
└── styles/
    ├── animator.module.css
    └── components/
        ├── property-editor.module.css
        ├── stats-display.module.css
        └── keyframe-editor.module.css
```

## Performance-Critical Sections ⚠️

These functions are called frequently and must remain optimized:

### Highest Priority (Called on Every Frame/Mouse Move)
1. **`paintBubbles()`** (Lines 999-1171)
   - Called on every mouse move, canvas refresh, thumbnail render
   - Uses Canvas2D API directly (DO NOT convert to React/JSX)
   - Keep as pure function with minimal allocations
   
2. **`moveEditor()`** (Lines 694-727)
   - Mouse move handler - called continuously while dragging
   - Minimize work in this handler
   
3. **`keytick()`** (Lines 594-624)
   - 60fps animation loop during keyboard navigation
   - Uses `requestAnimationFrame`
   
4. **`findBubbles()`** (Lines 965-998)
   - Distance calculations on every mouse move
   - Keep as pure function with minimal allocations

### Medium Priority
5. **`refreshEditor()`** - Delegates to paintBubbles
6. **Thumbnail rendering** - Uses paintBubbles for small previews

### Optimization Notes
- The `working` array (Lines 421-425) is a reusable buffer to avoid allocations
- Canvas rendering should stay with direct Canvas2D API calls
- Event handlers should use React synthetic events where possible
- State updates should be batched when multiple values change

## Migration Strategy

### Step 1: Extract Types and Constants ✅
- Create `src/animator/types.ts` with all type definitions
- Create `src/animator/constants.ts` with multichoice, defaultTypes
- Update imports across codebase

### Step 2: Extract Pure Rendering Functions ✅
- Create `src/animator/rendering/` with canvas utilities
- Keep these as pure functions (NOT React components)
- These will be imported by React components but stay vanilla JS

### Step 3: Extract State Management 🔄
- Create state modules with clear exports
- Consider using React Context or Zustand for global state
- `editing`, `dragging`, `editorCamera` should become React state

### Step 4: Convert UI to React Components 🔄
- Start with simplest: StatsDisplay, PropertyEditor
- Use React refs for canvas elements
- Use custom hooks for complex logic (useEditorCanvas, useKeyboardNav)
- Preserve event handler performance

### Step 5: Integration and Testing
- Update `react.tsx` to use new component structure
- Verify all functionality works
- Check performance (especially canvas rendering)
- Test file save/load workflow

## Key Dependencies to Preserve

### Global Window Extensions
The code exposes objects on `window`:
- `window.editing` - Current editing state
- `window.parsed` - Loaded animation data
- `window.Tools` - Console API for batch operations

These should be preserved for backward compatibility but may be refactored to use React Context internally.

### DOM Element IDs (Required)
The HTML provides these element IDs (see `index.html`):
- `#main` - React root container
- `#animator` - Main animator div
- `#selectors` - File/animation dropdowns and save button
- `#files` - File select dropdown
- `#animations` - Animation select dropdown
- `#save_button` - Save button
- `#scrollable` - Scrollable container
- `#keyframes` - Keyframe property displays
- `#bubbles` - Keyframe thumbnails and editors

### File System Operations
Uses custom runtime abstractions:
- `import { readFile, writeFile } from './runtime/fs'`
- `import { join } from './runtime/path'`

These wrap Electron IPC calls through the preload script.

### External Dependencies
- `jsonc-parser` - For parsing JSONC files with comments
- `./easing` - Easing functions (Ease object)
- `./utils` - characterData Map, updateAppDir

## Important Patterns

### JSONC File Parsing
Character and animation files use JSONC (JSON with comments):
```typescript
import { parse as parseJSONC } from 'jsonc-parser';
const content = await readFile(filePath);
const data = parseJSONC(content) as EntityData;
```

### Hurtbubbles Array Format
Hurtbubbles are stored as flat arrays: `[x, y, radius, state, x, y, radius, state, ...]`
- Every 4 elements = one hurtbubble
- Index `i` bubble: `[i*4+0, i*4+1, i*4+2, i*4+3]`

### Hitbubbles Reference
Hitbubbles can be:
- `Hitbubble[]` - Actual hitbox definitions
- `true` - Reference to previous keyframe's hitboxes

The code resolves these references by walking backwards through keyframes.

### Save Format
When saving, hurtbubbles arrays are formatted specially:
```json
"hurtbubbles": [x, y, r, s, x, y, r, s]  // All on one line
```

## Testing Strategy

### Manual Testing Checklist
After refactoring, verify:
- [ ] Load character file from dropdown
- [ ] Load animation from dropdown
- [ ] Click keyframe thumbnail to edit
- [ ] Drag hurtbubbles in editor canvas
- [ ] Use WASD/arrows to nudge bubbles
- [ ] Pan camera with right-click drag
- [ ] Edit properties in text fields
- [ ] Add new property with type selector
- [ ] Insert/remove/swap keyframes
- [ ] Save animation (creates/updates file)
- [ ] Stats display shows correct frame data
- [ ] Hover highlighting works
- [ ] Keyboard navigation smooth (no lag)
- [ ] Canvas rendering smooth (60fps)

### Performance Testing
- Profile `paintBubbles()` - should complete in <5ms
- Profile `findBubbles()` - should complete in <1ms
- Mouse move should feel instant (no lag)
- Keyboard nudging should be smooth 60fps

### Browser DevTools Tips
- Use React DevTools to inspect component tree
- Use Performance tab to profile rendering
- Check Canvas rendering with "Paint flashing"
- Monitor memory for leaks during long sessions

## Common Issues and Solutions

### Issue: Canvas not rendering
**Solution**: Ensure canvas ref is attached and context is obtained:
```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);
useEffect(() => {
  const ctx = canvasRef.current?.getContext('2d');
  if (!ctx) return;
  // ... render
}, [dependencies]);
```

### Issue: State updates cause re-renders during mouse move
**Solution**: Use refs for frequently-changing values that don't need UI updates:
```typescript
const dragStateRef = useRef({ active: -1, x: 0, y: 0 });
// Update ref.current directly in mouse handlers
```

### Issue: Event handlers lose context after refactor
**Solution**: Use `useCallback` with proper dependencies:
```typescript
const handleMouseMove = useCallback((e: MouseEvent) => {
  // handler code
}, [stableDependencies]);
```

### Issue: Performance degradation after React conversion
**Solution**: 
- Memoize expensive computations with `useMemo`
- Memoize components with `React.memo`
- Keep rendering functions pure (no side effects)
- Avoid creating new objects/arrays in render

## Tools API Reference

The `Tools` object is exposed on `window` for console operations:

```typescript
// Iterate all keyframes across all animations
for (const kf of Tools.iterateKeyframes()) { /* ... */ }

// Iterate keyframes of current animation only
for (const kf of Tools.iterateCurrentKeyframes()) { /* ... */ }

// Iterate all animations
for (const anim of Tools.iterateAnimations()) { /* ... */ }

// Insert new bubble at index (default: end)
for (const [kf, slice] of Tools.insertBubble(3)) {
  // Customize slice before insertion
  slice[0] = 10; // x
  slice[1] = 20; // y
  slice[2] = 5;  // radius
  slice[3] = 0;  // state
}

// Delete bubble at index
Tools.deleteBubble(3);

// Save current animation
Tools.save();
```

This API should be preserved for power users.

## Git Workflow

### Branch Strategy
- Main work on `project/v0` branch
- Create feature branches for major refactors
- Use conventional commits:
  - `feat:` - New features
  - `refactor:` - Code restructuring
  - `fix:` - Bug fixes
  - `chore:` - Tooling/config changes
  - `perf:` - Performance improvements

### Pre-commit Hooks
Husky + lint-staged runs automatically:
- ESLint with auto-fix on .ts/.tsx files
- Prettier formatting on all staged files

If you need to bypass (emergency only):
```bash
git commit --no-verify -m "message"
```

## Build and Development

### Commands
```bash
npm run dev          # Start Vite dev server (renderer only)
npm run build        # Build all (main + preload + renderer)
npm run build:main   # Build main process only
npm run build:preload # Build preload script only
npm run build:renderer # Build renderer only
npm start            # Run Electron app
npm run type-check   # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier on all files
npm run dist         # Package Electron app
```

### Development Workflow
1. Make changes to source files
2. Run `npm run build` to compile
3. Run `npm start` to test in Electron
4. Iterate

For renderer-only changes, you can use `npm run dev` for faster iteration with hot reload.

## Architecture Decisions

### Why Keep Canvas Rendering as Vanilla JS?
React's reconciliation overhead would slow down the 60fps rendering loop. Direct Canvas2D API calls are significantly faster and appropriate for performance-critical rendering.

### Why Use React for UI Components?
The UI is mostly static or updates on user interaction (not 60fps). React provides:
- Better component composition
- Easier state management
- Better developer experience
- Easier to test and maintain

### Hybrid Approach
- **React components** manage state and UI structure
- **Vanilla JS functions** handle canvas rendering
- **React refs** bridge the two (pass canvas elements to rendering functions)

## Future Enhancements (Post-Refactor)

### Potential Improvements
1. Add undo/redo system
2. Add copy/paste between animations
3. Add onion skinning (show previous/next frames)
4. Add zoom controls for canvas
5. Add grid snapping
6. Add rulers and guides
7. Add timeline scrubbing
8. Add actual animation playback (currently unused code)
9. Add keyboard shortcuts overlay
10. Add dark mode support

### Testing Infrastructure
1. Add Vitest for unit tests
2. Add React Testing Library for component tests
3. Add Playwright for E2E tests
4. Add visual regression testing for canvas output

### Documentation
1. Add JSDoc comments to all functions
2. Create user manual
3. Create video tutorials
4. Document file format specification

---

## Questions? Issues?

When working on this project, if you encounter:
- **Performance issues** - Profile first, optimize critical paths only
- **Type errors** - Check type definitions in `types.ts` and `types/global.d.ts`
- **Build failures** - Check that all imports are correct after refactoring
- **Runtime errors** - Check browser console and Electron main process logs

Good luck! 🚀
