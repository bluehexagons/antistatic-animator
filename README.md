# Antistatic Animator

Animation and stage editor for Antistatic. Built with Electron + React.

## Quick Start

```bash
npm install
npm run build
npm start
```

1. Pick a source: open your game directory (Electron), pick a folder (browser
   File System Access), or drag-and-drop your `data` files onto the window
2. Use the Characters tab to choose a character and animation, or use Stages
   to open/create a stage scene
3. Edit hurtbubbles by dragging on the stage or nudging with WASD / arrows
   (marquee-drag to multi-select); step keyframes with `,` / `.`; save with
   Ctrl/Cmd+S, or enable **Live sync** for a local Antistatic checkout
4. In stage mode, add collision, models, lights, fog, particles, and animations
   from the scene list. Drag positioned objects in the viewport and edit exact
   values in the inspector/timeline.

For the stage editor and game-runtime acceptance pass, see
[`docs/stage-authoring-qa.md`](docs/stage-authoring-qa.md).
For local game hot reload and conflict handling, see
[`docs/live-updates.md`](docs/live-updates.md).

## Development

```bash
npm run dev          # Vite dev server (hot reload)
npm run build        # Build all
npm start            # Run Electron app
npm run type-check   # TypeScript validation
npm run lint         # Code quality checks
npm run test:run     # Run the Vitest suite
```

Set `ANTISTATIC_ANIMATOR_DEVTOOLS=1` when launching Electron to install React
Developer Tools. Normal source builds skip the network-dependent extension
installation.

## Features

- Visual character editor for hurtbubbles (drag, marquee multi-select, group
  nudge) and hitbubbles (full schema: damage/knockback/flags/follow/smear)
- Scene-schema-v2 stage authoring with draggable collision, model/effect
  previews, structured inspection, stable-ID renaming, validation, and
  position-animation tracks
- Knockback + smear gizmos, hurtbubble state colouring, z-depth tint
- Onion-skin, bone-name labels, and a shield overlay
- Engine-compatible terminal-frame playback, omitted-pose interpolation,
  loop / ping-pong, scrubbing, keyframe copy/paste, and a flip-X mirror tool
- Per-keyframe / per-animation property editing for every engine field,
  including array/object values, with schema-aware dropdowns and lint
- JSONC-preserving animation and stage saves (keeps untouched comments and
  formatting; character metadata is read-only)
- Electron live sync with external-change detection and reload protection
- Console API (`window.Tools`) for batch operations

## Architecture

- **React** for UI components and state management
- **SVG** for the stage and timeline-thumbnail rendering
- **TypeScript** for type safety
- **Electron** (with browser/File System Access and upload fallbacks) for file access

The character and stage viewports are 2D authoring proxies. They preview engine
coordinates, hitbox windows, continuations, smears, and stage animation tracks,
but do not render Antistatic's 3D meshes, materials, lighting, particles, or
audio assets. See [`docs/codebase-sync.md`](docs/codebase-sync.md) for the
current parity audit and known gaps.

## Contributing

- Use conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- Run `npm run lint` before committing
- Pre-commit hooks run Oxlint and Oxfmt on staged source files

## Releases

Automated via GitHub Actions:

- `CI` workflow runs type-check, lint, tests, and build on pushes and pull
  requests targeting `main`, version tags, and manual dispatch
- `Release` workflow publishes packages on `v*` tags

## Tools API

Power users can access the console API:

```javascript
// Iterate all keyframes
for (const kf of window.Tools.iterateKeyframes()) { ... }

// Insert bubble at index
for (const [kf, slice] of window.Tools.insertBubble(3)) {
  slice[0] = 10;  // x
  slice[1] = 20;  // y
  slice[2] = 5;   // radius
  slice[3] = 0;   // state
}

// Save current animation; resolves to true on success, false on failure
await window.Tools.save();
```

See `AGENTS.md` for detailed architecture and development guidance.
