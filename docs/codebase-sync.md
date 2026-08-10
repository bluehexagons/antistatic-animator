# Codebase Sync

## Audit

Last checked: 2026-08-10

- Animator repository: `9ad7ad7` (`main`)
- Antistatic repository: `8b08fccb` (`main`)
- Reference paths: `../antistatic/app/src/game/animation.ts`,
  `../antistatic/app/src/game/bubbles.ts`, `../antistatic/app/src/game/stage.ts`,
  and `../antistatic/docs/schemas/stage.schema.json`

The stage scene schema copy is current with Antistatic's schema v2. Animation
enum names, hurtbubble states, hitbubble types, and hitbubble flag bits also
match the current game code. Recent game changes to rollback, netplay, and
animation caching do not change the authoring format.

## Parity Implemented

- Character playback treats the final keyframe as a terminal destination and
  excludes its duration from the playable timeline.
- Pose preview resolves omitted poses and interpolates across intervening
  keyframes using the runtime sample offset and easing.
- Hitbubble preview converts authored Y coordinates, expands `smear: true`,
  respects active `start` / `end` windows, and previews continuation / `next`
  hitbubbles without changing source data.
- Easing choices are limited to valid tween functions and match the engine's
  `inOut` helper behavior.
- Stage collision tracks move linked visual models with the collision segment.
- Stage animation target IDs are encoded without assuming IDs cannot contain
  colons; negative-speed playback starts from the final frame.
- Failed saves no longer update the in-memory library cache.

## Known Gaps

- The viewport is an SVG authoring proxy, not Antistatic's 3D renderer. Meshes,
  prefab geometry, material response, lighting, fog, particle simulation,
  camera perspective, and angular model motion are not rendered as in-game.
- Audio fields can be edited but audio assets are not discovered or played.
- Runtime handler functions are not executed in the editor. Handler validation
  remains advisory because character-specific handlers are loaded by the game.
- Stage `autoplay`, `randomStart`, stage coordinate scaling, and some runtime
  lighting/material transforms are preserved but not fully simulated.
- JSONC saves preserve untouched document structure; replacing a nested object or
  animation can still rewrite comments inside that replaced value.

## Maintenance

When Antistatic changes animation or stage authoring data:

1. Compare the relevant runtime loader and schema files with this repository.
2. Copy only small, clearly separated MIT/Apache-compatible helpers when needed.
3. Add a focused test for each changed runtime rule and update this document's
   audit commit and date.
4. Run `npm run type-check`, `npm run lint`, `npm run test:run`, and
   `npm run build`.
