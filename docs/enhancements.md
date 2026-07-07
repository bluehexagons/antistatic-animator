# Animator enhancements

Plan for closing the gap between this editor and what the Antistatic
engine actually consumes. Derived from a read of
`../antistatic/app/src/game/{animation,bubbles}.ts` and the shipped
character JSONC files in `../antistatic/app/characters/data/`.

The headline observation: the editor today can move hurtbubble joints
around, but the schema it edits has substantially more structure —
hitboxes with damage/knockback/flags, hurtbubble armour states,
per-keyframe handler hooks, tweened interpolation between poses, smear
motion-blur sources. That schema is what makes the game's frame data
meaningful, and we should put it directly in the UI.

## Scope

Everything below operates on the same JSONC files the game loads. No
schema changes on the game side; the animator just learns to author
more of what's already there.

## Status (2026-07)

Batches A–G are implemented (G2/G3 added 2026-07). Remaining deliberate gaps:

- **F3** (camera-rotation gizmo) — skipped; no functional 3D camera yet,
  so it would only add inert UI.
- **G1** (audio preview) — skipped; the storage layer reads text, not the
  binary `.ogg` assets it would need. Revisit if storage gains binary reads.

## Batches

Batched so each commit produces a usable improvement. Earlier batches
deliberately unblock authoring tasks that currently require hand-edits
to JSON. Later batches polish what's already authorable.

### Batch A — Hitbox authoring ✅

The biggest blocker. Hitboxes are visible in the viewer (red) but
read-only. The Hitbubble schema (`bubbles.ts:226`) has 14+ authoring
fields; making attacks today means alt-tabbing to a text editor.

- A1. **Hitbubble editor** in the inspector. List of hitbubbles for
      the current keyframe with editable rows: `type`, `follow`,
      `x/y/x2/y2`, `radius`, `damage`, `knockback`, `growth`, `angle`,
      `flags[]`, `start`, `end`, `audio`, `if`, `sakurai`. Add/remove
      buttons. Continuation flag (`hitbubbles: true`) gets a toggle.
- A2. **Knockback gizmo** on selected hitbubble. Arrow at `angle` with
      length ∝ `knockback + growth · k`. Sakurai checkbox renders the
      45°/0° forked indicator.
- A3. **Smear rendering.** Hitbubble `smear: {follow,x,y}` is currently
      invisible. Draw a faded copy at the smear position and a polygon
      trail between source and current to show the swept area.
- A4. **`follow` picker** — dropdown of valid bubble names from the
      character (`headbubble`, named bones, etc.) instead of free-text.

### Batch B — Schema fidelity ✅

Color, dropdowns, and labels driven by the game's enums and registries
so the editor speaks the game's vocabulary.

- B1. **Hurtbubble `state` as dropdown + colour.** Map `HurtbubbleState`
      (`bubbles.ts:39`) to named choices: phased/normal/lightArmor/
      heavyArmor/invincible/intangible/protected/projectileArmor/
      lightProjectileArmor/decoration. Color the capsule by state in
      both the stage viewer and timeline thumbnails.
- B2. **HitbubbleType + HitbubbleFlag enums** — dropdowns/checkbox-set
      backed by the engine enums (`bubbles.ts:24,52`).
- B3. **Animation `type` dropdown** sourced from `AnimationType`
      (`animation.ts:20`) — movement/attack/aerial/special/passive/
      shield/holding/tumble/throw.
- B4. **Handler-name suggestions.** `handlerEvents`
      (`animation.ts:542`) lists the 12 event slots; the
      `defaultHandlers` table lists valid names per slot. Surface
      those as `<datalist>` options on the matching property rows.
- B5. **Validation lint.** Hover indicator (or inspector chip) for:
      unknown handler names, hitbubble `follow` strings not in the
      character's named bubbles, hurtbubble counts that don't match
      the character's bone count, tween names not in `Ease`.

### Batch C — Save fidelity ✅

Currently `save()` does `JSON.stringify` which strips JSONC comments.
The shipped character files contain comments and structural niceties
worth preserving.

- C1. **JSONC-preserving save** using `jsonc-parser`'s `modify()` /
      `applyEdits()` to write surgical edits rather than re-stringify
      the whole document. Falls back to current behaviour if the
      original document text is unavailable.
- C2. **Format preservation for hurtbubble arrays** (one per line,
      four values per line) regardless of code path.
- C3. **Dirty-tracking per animation** — show which animations in the
      sidebar have unsaved edits.

### Batch D — Playback fidelity ✅

The timeline plays in keyframe-discrete steps. The game tweens between
poses when `interpolate: true` is set, using the per-keyframe `tween`
easing function. Without tweened preview the animator can't actually
see what the player will see.

- D1. **Interpolated playback.** During play, if the current keyframe
      has `interpolate: true`, lerp the hurtbubble pose toward the
      next keyframe using the `tween` curve from `src/easing.ts`.
- D2. **Scrubbable playhead.** Click/drag the timeline to scrub
      through the animation at sub-keyframe resolution.
- D3. **Loop / ping-pong controls.** Common authoring need: play the
      same animation in a loop while adjusting a keyframe.

### Batch E — Spatial UX ✅

Pure quality-of-life improvements to the viewer.

- E1. **Onion-skin.** Render previous and next keyframes at 25% alpha
      under the active pose. Toggle in the toolbar.
- E2. **Marquee multi-select** of hurtbubbles + group nudge / group
      drag.
- E3. **Bone-name labels** on hover; permanent labels on the named
      bubbles from `character.headbubble` / `corebubble`.
- E4. **Mirror animation.** Flip-X tool: negates x on hurtbubble
      positions and swaps left/right bone pairs (driven by the `flip`
      bone field already present in character JSON).
- E5. **Shield bubble overlay** using `shieldX/Y/X2/Y2/Size` so
      shield-related animations can be authored visually.

### Batch F — 3D forward-compat ✅ (F1/F2; F3 deferred)

Builds the seams the user named as the future direction without
shipping a 3D viewport yet.

- F1. **Z field in the bubble editor.** Each bone in character JSON
      has a `z` value; expose it. Tint hurtbubbles by z (front of
      character warmer, back cooler) in the 2D viewer.
- F2. **Per-bone model alias display.** `prefab.models[].name` on each
      bone — show the model name in the inspector so the animator
      sees what 3D mesh follows that bone.
- F3. **Camera rotation gizmo** in the viewer (disabled today). UI
      placeholder that later drives a real 3D camera, without breaking
      the 2D pipeline.

### Batch G — Quality-of-life ✅ (G2/G3; G1 deferred)

- G1. **Audio preview.** When playback reaches a keyframe with
      `audio:` set, play the matching .ogg from the loaded source.
- G2. **Copy/paste keyframes** to clipboard for cross-animation reuse.
- G3. **Diff highlight** — mark keyframes modified during the session.

## Order of work

Implementing roughly A → B → C → D → E → F → G. A and B compound: B's
state colouring is immediately useful once hitbubbles are editable in
A. C unblocks comfortable iteration (no more comment loss). D makes
the editor produce a representative preview. E/F/G are polish.

Each batch lands as its own commit so it's easy to revert one without
unwinding the next.
