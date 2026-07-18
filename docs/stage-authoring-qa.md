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

## Checklist

- Open **Ruins** and use Reset Camera. Collision and spawn metadata should be
  framed instead of the large shell models, with no validation issues.
- Open **Scales** and confirm its blast rectangle renders with no ordering
  issue. This covers positive `scaleY`; Ruins covers negative `scaleY`.
- Select `animation-0` on **Eroded** and **Crossing**. Scrub, play, pause, loop,
  and ping-pong preview while confirming the segment keeps its dimensions.
- Drag collision segments and endpoints. Resize models, fog, particle volumes,
  point-light range, and blast bounds. Pan with middle/right drag and zoom with
  the wheel.
- Drag anchors, entrances, and spawns; edit their exact coordinates, weights,
  and facing in the inspector.
- Rename and delete referenced models/collision. References should update or be
  removed, and deletion must not strand an empty invalid animation.
- Introduce an invalid value and confirm Issues explains it and save is refused.
  Restore it, save, reopen, and confirm JSONC comments and values round-trip.
- Create a new stage and add every available scene-object type plus an animation
  track. Save it and run `npm run check:stages` in the game repository.

Finish with the game-side checklist at `../antistatic/docs/qa/stage-authoring.md`
to verify runtime collision, effects, and visual parity.
