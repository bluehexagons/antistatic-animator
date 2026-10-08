# Codebase Sync

## Current baseline

Checked 2026-10-08 against:

- Animator repository: `9ec430c` (`main`, package `0.2.0`)
- Antistatic repository: `687ba112` (`main`, package `0.10.17`)
- Easing dependency: `v0.5.1` (the immutable version used by both packages)
- Reference paths: `../antistatic/app/src/game/animation.ts`,
  `../antistatic/app/src/game/bubbles.ts`, `../antistatic/app/src/game/stage.ts`,
  and `../antistatic/docs/schemas/stage.schema.json`

The Animator's stage schema copy parses identically to Antistatic's schema v2.
Animation enum names, hurtbubble states, hitbubble types, and hitbubble flag
bits match the current game sources. Recent animation lifecycle and stage
runtime changes do not change these authoring contracts.

## Parity Implemented

- Character playback treats the final keyframe as a terminal destination and
  excludes its duration from the playable timeline.
- Pose preview resolves omitted poses and interpolates across intervening
  keyframes using the runtime sample offset and easing.
- Hitbubble preview converts authored Y coordinates, expands `smear: true`,
  respects active `start` / `end` windows, and previews continuation / `next`
  hitbubbles without changing source data.
- Easing choices come from the same named-curve registry as the engine.
- Stage collision tracks move linked visual models with the collision segment.
- Stage animation target IDs are encoded without assuming IDs cannot contain
  colons; negative-speed playback starts from the final frame.
- Failed saves no longer update the in-memory library cache.
- Electron source files can be watched for external edits, and live sync can
  debounce-save animator edits for Antistatic's existing debug watcher.
- Collision inspection supports friction overrides and damage/launch or
  instant-KO hazards using the game's existing schema and simulation units.
- Stage saves patch changed nested fields without rewriting the entire scene,
  preserving comments on unrelated fields and stable-ID entries.

## Known Gaps

- The viewport is intentionally an SVG authoring proxy. A 3D renderer is not on
  the project roadmap; in-game feedback should come from live updates instead.
- Audio fields can be edited but audio assets are not discovered or played.
- Runtime handler functions are not executed in the editor. Handler validation
  remains advisory because character-specific handlers are loaded by the game.
- Modified keyframes are marked in the timeline, but the sidebar has no
  per-animation dirty badges.
- Antistatic's current debug watcher reloads character data, not stage files;
  stage live reload remains a game-side follow-up.
- Stage `autoplay`, `randomStart`, stage coordinate scaling, and some runtime
  lighting/material transforms are preserved but not fully simulated.
- Stage wind zones remain JSON-authored and preserved; dedicated inspector and
  viewport controls remain future work.
- JSONC saves preserve untouched document structure. Adding, removing, or
  reordering array entries can still rewrite comments inside that array;
  character saves can rewrite comments inside a changed animation.

## Maintenance

When Antistatic changes animation or stage authoring data:

1. Compare the relevant runtime loader and schema files with this repository.
2. Copy only small, clearly separated MIT/Apache-compatible helpers when needed.
3. Add a focused test for each changed runtime rule and update this document's
   baseline and date.
4. Run `npm run type-check`, `npm run lint`, `npm run test:run`, and
   `npm run build`.
