# Antistatic Animator - Agent Guide

## Project Purpose

Electron-based animation editor for fighting game character hitboxes and hurtboxes. Allows frame-by-frame editing of collision data with visual canvas interface.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build all (main + preload + renderer)
npm start            # Run Electron app
npm run type-check   # TypeScript validation
npm run lint         # ESLint validation
```

**Development workflow:** Edit source → `npm run build` → `npm start` → test  
**Renderer-only changes:** Use `npm run dev` for hot reload

## Architecture

**Hybrid approach:** React for UI, vanilla JS for performance-critical canvas rendering (60fps)

```
src/
├── electron.ts          # Main process
├── preload.ts           # IPC bridge
├── react.tsx            # React app entry
├── animator/            # Core animator module
│   ├── types.ts         # TypeScript definitions
│   ├── constants.ts     # Configuration
│   ├── state/           # Global state modules
│   ├── rendering/       # Canvas rendering (vanilla JS - PERF CRITICAL)
│   ├── components/      # React UI components
│   ├── hooks/           # React hooks
│   ├── events/          # Event handlers
│   ├── operations/      # Pure business logic
│   └── api/             # Console Tools API
├── runtime/             # Electron IPC wrappers (fs, path)
└── utils.ts             # File utilities
```

**Key files:**
- `src/animator/rendering/bubble-painter.ts` - Main canvas renderer (DO NOT convert to React)
- `src/animator/events/canvas-events.ts` - Mouse/keyboard handlers (60fps keyboard loop)
- `src/animator/init.ts` - Initialization and wiring

## Code Standards

- **TypeScript:** ES2022, strict mode, bundler resolution
- **Linting:** ESLint 9 flat config + Prettier
- **Commits:** Conventional commits (feat/fix/refactor/chore/perf)
- **Pre-commit:** Husky runs ESLint + Prettier on staged files

## Data Model

**Hurtbubbles:** Flat array `[x, y, radius, state, ...]` (4 values per bubble)  
**Hitbubbles:** Either `Hitbubble[]` or `true` (references previous keyframe)  
**Files:** JSONC format (JSON with comments) using `jsonc-parser`

## Performance

**Critical paths (keep as vanilla JS):**
- `paintBubbles()` - Called on every mouse move/refresh (<5ms target)
- `findBubbles()` - Distance calculations (<1ms target)
- `keytick()` - 60fps keyboard navigation loop
- `moveEditor()` - Mouse move handler

**Optimization patterns:**
- Reusable buffers to avoid allocations
- Direct Canvas2D API (no React reconciliation)
- React refs for high-frequency state
- Memoization for expensive React computations

## Common Tasks

**Adding a new property type:**
1. Add to `defaultTypes` in `src/animator/constants.ts`
2. Optional: Add multichoice config if dropdown needed
3. PropertyEditor handles rendering automatically

**Adding canvas rendering:**
1. Add pure function to `src/animator/rendering/`
2. Call from `paintBubbles()` or create new renderer
3. Keep as vanilla JS (not React component)

**Adding UI component:**
1. Create in `src/animator/components/`
2. Use React hooks from `src/animator/hooks/`
3. Access state from `src/animator/state/`
4. Export from `src/animator/index.ts`

## Known Constraints

- Canvas rendering must stay vanilla JS (performance)
- Global `window.editing` and `window.Tools` must remain (backward compat)
- JSONC file format required (comments in animation files)
- Electron IPC through runtime wrappers only
- Pre-commit hooks enforce code quality (bypass only for emergencies)

## Recent Changes

**Refactoring (Feb 2026):**
- Extracted 1594-line monolith into modular structure
- Upgraded Electron v35→v40, React v18→v19
- Added modern tooling (ESLint 9, Prettier, pre-commit hooks)
- Migrated to hybrid React + vanilla JS architecture
- 0 vulnerabilities, 0 lint warnings

## Testing

**Manual checklist:**
- Load character/animation from dropdowns
- Drag hurtbubbles on canvas (smooth, no lag)
- WASD/arrow key nudging (60fps, no stutter)
- Right-click pan camera
- Edit properties, add/remove keyframes
- Save animation (file updates correctly)
- Hover highlighting responsive

**Performance metrics:**
- `paintBubbles()` < 5ms
- `findBubbles()` < 1ms
- Keyboard navigation at stable 60fps
- No memory leaks during long sessions

## Troubleshooting

**Canvas not rendering:** Check canvas ref attached and 2D context obtained  
**Performance degradation:** Profile with DevTools, check for unnecessary re-renders  
**Type errors:** Verify imports from `src/animator/types.ts`  
**Build failures:** Check import paths after refactoring  

## Future Improvements

- Undo/redo system
- Animation playback/timeline
- Onion skinning
- Grid/snapping/guides
- Keyboard shortcuts overlay
- Unit/E2E tests (Vitest, Playwright)
