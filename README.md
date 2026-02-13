# Antistatic Animator

Animation editor for fighting game character hitboxes and hurtboxes. Built with Electron + React.

## Quick Start

```bash
npm install
npm run build
npm start
```

1. Click "Select Directory" and choose your game's root folder
2. Select a character from the first dropdown
3. Select an animation from the second dropdown
4. Edit hurtbubbles by dragging on canvas or using WASD keys

## Development

```bash
npm run dev          # Vite dev server (hot reload)
npm run build        # Build all
npm start            # Run Electron app
npm run type-check   # TypeScript validation
npm run lint         # Code quality checks
```

## Features

- Visual canvas editor for collision boxes
- Frame-by-frame keyframe editing
- Property editing with type safety
- JSONC format support (JSON with comments)
- Keyboard navigation (WASD) and camera controls
- Console API for batch operations

## Architecture

Hybrid approach optimized for performance:
- **React** for UI components and state management
- **Vanilla JS** for 60fps canvas rendering
- **TypeScript** for type safety
- **Electron** for desktop integration

## Contributing

- Use conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- Run `npm run lint` before committing
- Pre-commit hooks auto-format code with Prettier

## Releases

Automated via GitHub Actions:
- `CI` workflow validates all builds
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

See `.github/agents.md` for detailed architecture and development guide.
