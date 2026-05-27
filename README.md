# Antistatic Animator

Animation editor for fighting game character hitboxes and hurtboxes. Built with Electron + React.

## Quick Start

```bash
npm install
npm run build
npm start
```

1. Pick a source: open your game directory (Electron), pick a folder (browser
   File System Access), or drag-and-drop your `data` files onto the window
2. Choose a character from the sidebar's file list
3. Choose one of its animations from the sidebar's animation list
4. Edit hurtbubbles by dragging on the stage or nudging with WASD / arrows
   (marquee-drag to multi-select); step keyframes with `,` / `.`; save with
   Ctrl/Cmd+S

## Development

```bash
npm run dev          # Vite dev server (hot reload)
npm run build        # Build all
npm start            # Run Electron app
npm run type-check   # TypeScript validation
npm run lint         # Code quality checks
```

## Features

- Visual stage editor for hurtbubbles (drag, marquee multi-select, group
  nudge) and hitbubbles (full schema: damage/knockback/flags/follow/smear)
- Knockback + smear gizmos, hurtbubble state colouring, z-depth tint
- Onion-skin, bone-name labels, and a shield overlay
- Interpolated playback with loop / ping-pong, scrubbing, keyframe copy/paste,
  and a flip-X mirror tool
- Per-keyframe / per-animation property editing for every engine field,
  including array/object values, with schema-aware dropdowns and lint
- JSONC-preserving save (keeps comments and formatting)
- Console API (`window.Tools`) for batch operations

## Architecture

- **React** for UI components and state management
- **SVG** for the stage and timeline-thumbnail rendering
- **TypeScript** for type safety
- **Electron** (with a browser/File System Access fallback) for file access

## Contributing

- Use conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- Run `npm run lint` before committing
- Pre-commit hooks auto-format code with Prettier

## Releases

Automated via GitHub Actions:
- `CI` workflow runs type-check, lint, tests, and build on `v*` tags
  (and manual dispatch) — not on every commit
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

// Save current animation
window.Tools.save();
```

See `AGENTS.md` for detailed architecture and development guidance.
