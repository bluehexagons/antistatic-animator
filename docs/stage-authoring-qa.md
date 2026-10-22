# Stage authoring manual test

Run this pass against a disposable branch of the sibling Antistatic game
repository so save and delete checks cannot damage production stage data.

## Before opening the window

```bash
npm run type-check
npm run lint
npm run test:run
npm run build
npm start
```

Open the Antistatic repository as the source and select **Stages**.
For the browser upload path, use a disposable standalone stage JSON/JSONC file;
it should appear under Stages without a repository-relative path. Saving
downloads the edited file. Upload that download again for the reopen check.

## Checklist

- Open **Ruins** and use Reset Camera. Collision and spawn metadata should be
  framed instead of the large shell models, with no validation issues.
- Save and reopen Ruins after an unrelated edit. Its rectangle lights and baked
  diffuse probe payload must survive unchanged, including JSONC comments.
  These fields currently use external JSON authoring; the editor neither shades
  them nor rebuilds the bake. The game rejects a stale fingerprint after edits
  to bake inputs; rerun its bake tool before accepting the lighting result.
- Open **Scales** and confirm its blast rectangle renders with no ordering
  issue. This covers positive `scaleY`; Ruins covers negative `scaleY`.
- Select `animation-0` on **Eroded** and **Crossing**. Scrub, play, pause, loop,
  and ping-pong preview while confirming the segment keeps its dimensions.
- For a collision with a linked `model`, preview its animation and confirm the
  visual model follows the segment center instead of remaining stationary.
- Drag collision segments and endpoints. Resize models, fog, particle volumes,
  point-light range, and blast bounds. Pan with middle/right drag and zoom with
  the wheel.
- Select a model and use **Emission** to edit linear RGB and strength on its
  whole material, then select an original source slot and edit only that
  override. `PrimitiveDefault` is the primitive slot; imported mesh names must
  match the original asset, not the replacement finish name. Creating a finish
  requires its existing game material file/name. Confirm the original texture
  references, palette bindings, other finish fields, and other models survive.
- Select a point light and switch **Source mode** to Material emission. Set its
  model, original source slot, local position, intensity, range, and source
  radius using the dedicated fields. World position/color must not be added
  while attached. Drag a static box's attached offset handle, including a
  rotated/scaled box; it must change only localPosition. Imported meshes,
  spinning models, and other unresolved transforms show an attachment proxy
  at the model origin and keep numeric offset editing available.
- Edit emission and source settings and confirm the SVG's emission swatches,
  strength indication, and source markers update. These are authoring aids;
  the viewport does not simulate PBR shading, texture emission, or bloom.
- Under stage settings, author **Bloom** strength/threshold/knee/radius, then
  clear fields to restore defaults 1.35/1.12/0.72/1. Check bounds 0..8,
  0..64, 0..64, and 0.25..4 respectively. Save and reopen.
- Select an animation and choose material RGB or strength in **New track
  target**, using the model's original source slot. Add both alongside a model
  or collision position track. For an imported slot without a static override,
  choose **other imported source slot** and enter its original asset name; this
  must not create a replacement material or change texture references. Edit
  values, add a second keyframe, scrub, and
  play. Check independent interpolation and source-marker feedback without
  modifying the model's base material values. Duplicate target/property/slot
  combinations and keyframe times must be blocked; different properties and
  different source slots may coexist.
- Undo/redo material, source, bloom, and keyframe edits; save and reopen with
  JSONC comments intact. Rename source models and confirm all light and material
  animation references follow. Deleting a model must remove its light and
  material/position tracks while retaining unrelated objects and tracks.
- In game, verify attachment transforms, original textures/palettes, animated
  emission, point-light calibration, bloom, and final shading. The authoring
  schema is additive scene v2 and matches the canonical game schema.
- Drag anchors, entrances, and spawns; edit their exact coordinates, weights,
  and facing in the inspector.
- Rename and delete referenced models/collision. References should update or be
  removed, and deletion must not strand an empty invalid animation.
- Introduce an invalid value and confirm Issues explains it and save is refused.
  Restore it, save, reopen, and confirm JSONC comments and values round-trip.
- Import a material track with descending keyframe times and confirm Issues
  blocks saving until they are ordered. A primitive accepts only the original
  `PrimitiveDefault` slot in material overrides and palette bindings. Enter a
  padded imported slot in the emission inspector, attached-light field, and
  timeline; newly authored references must save without surrounding whitespace.
- Import model and collision declarations with padded IDs and unpadded track
  references, then reverse the padding. Scrubbing must move the correct model,
  attached light and linked platform, and Reset Camera must include the moving
  segment's full extent. Save/reopen preserves existing ID strings; new tracks
  use trimmed references and start at the target's authored position.
- Open **Hazard Lab** and select its collision entries. Set a friction override
  to 0 and 1, then clear it to restore character friction. Enter a value outside
  that range and confirm the previous value is kept with an explanation.
- Edit the damage floor's damage, knockback, angle, and cooldown. Blank optional
  fields should use the displayed runtime defaults; fractional or nonpositive
  cooldowns must be rejected. Meteor launch requires positive knockback.
- Switch a contact hazard between Damage / launch, Instant KO, and None. Instant
  KO must save only `instantKO: true`; None must remove the hazard. Clearing all
  positive damage/knockback values must produce an Issue and block saving.
- Save and reopen the edited stage. Verify nested JSONC comments and unrelated
  collision properties, wind zones, models, and effects remain intact.
- Create a new stage and add every available scene-object type plus an animation
  track. Save it and run `npm run check:stages` in the game repository.

For character parity, open an attack with `smear: true`, a partial `start` /
`end` hitbox window, and a `hitbubbles: true` continuation. Confirm the preview
does not show the hitbox outside its active window and that the smear remains
anchored to the named bubble. The final animation keyframe should be visible as
the terminal pose but should not add to the playable frame count.

Finish with the game-side checklist at `../antistatic/docs/qa/authoring.md`
to verify runtime collision, effects, and visual parity.

## Game preview integration boundary

Stage edits already flow through `App.onStageChange` into `SET_STAGE` history,
validation, and `renderStageFile` for save. `evaluateStageAnimation` exposes
sampled emission by model ID and original source slot in `preview.materials`;
this is a read-only SVG preview result, not a second saved document. The additive
material track stores `target.kind = "material"`, `id`, `materialSlot`, and
`property` (`emissive` or `emissiveStrength`), with `{time, value}` keyframes.
Existing position tracks retain `{time, position}`.

Electron Local sources expose Live Sync for stage documents through the same
validated save boundary. Invalid documents and external conflicts pause live
saves. The game's offline Training preview consumes those files without
replacing gameplay state; see [Live Updates](live-updates.md). Bloom normalization
and final rendering remain game-owned.

With Live Sync enabled, change the current stage's emission and bloom in a
disposable game checkout and confirm the rendered preview updates. Introduce an
Issue and confirm no autosave dialog interrupts editing; resolve it and confirm
the preview resumes. Edit collision and verify gameplay stays unchanged until
restarting the game. Disable Live Reload and leave Training to verify preview
cleanup, then exercise the existing external-file conflict flow.
