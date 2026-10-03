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
- Open **Scales** and confirm its blast rectangle renders with no ordering
  issue. This covers positive `scaleY`; Ruins covers negative `scaleY`.
- Select `animation-0` on **Eroded** and **Crossing**. Scrub, play, pause, loop,
  and ping-pong preview while confirming the segment keeps its dimensions.
- For a collision with a linked `model`, preview its animation and confirm the
  visual model follows the segment center instead of remaining stationary.
- Drag collision segments and endpoints. Resize models, fog, particle volumes,
  point-light range, and blast bounds. Pan with middle/right drag and zoom with
  the wheel.
- Drag anchors, entrances, and spawns; edit their exact coordinates, weights,
  and facing in the inspector.
- Rename and delete referenced models/collision. References should update or be
  removed, and deletion must not strand an empty invalid animation.
- Introduce an invalid value and confirm Issues explains it and save is refused.
  Restore it, save, reopen, and confirm JSONC comments and values round-trip.
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

Finish with the game-side checklist at `../antistatic/docs/qa/stage-authoring.md`
to verify runtime collision, effects, and visual parity.
