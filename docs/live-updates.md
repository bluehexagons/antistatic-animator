# Live Updates

The intended development loop is now save-to-game rather than a 3D preview.
The animator writes the same character and stage files that Antistatic loads.
The game can replace live character entities or preview stage visuals when
those files change.

## Setup

1. Run Antistatic from a development checkout.
2. Enable **Live Reload** in Antistatic's main options screen. It is disabled
   by default.
3. Open that Antistatic checkout as the animator's **Local** source.
4. Enable **Live sync** in the animator toolbar.
5. Enter training mode in Antistatic. Character animation changes replace
   matching live entities. Stage changes preview the current stage's visuals;
   keep the stage name and order unchanged. Changes are saved after a short debounce.

Live sync is intentionally available only for the Electron local source. The
browser File System Access and upload backends cannot reliably identify the
running game's data directory.

## Safety

- Live sync writes the current character or stage file after edits; **Save** remains
  available for an explicit write.
- Invalid stage documents remain in the editor until their Issues are resolved.
- Writes made by another tool are detected by the Electron backend. The
  animator shows **Reload changed** instead of silently replacing the editor's
  in-memory work. Live autosave pauses until the changed source is reloaded.
- Reloading while dirty asks for confirmation because it discards local edits.
- Stage preview runs only in offline Training with Live Reload enabled. It
  replaces visual models, emission animation and lighting; collision, hazards,
  wind and gameplay state keep their loaded values. Restart the game to load
  gameplay edits. Disabling Live Reload or leaving Training restores the loaded
  visuals. Malformed or oversized saves keep the last valid preview.

## Implementation

- `src/storage/electron.ts` watches source directories through the preload
  bridge, so atomic same-directory replacements remain observable.
- `src/storage/library.ts` debounces backend events and filters out writes that
  already match the library cache.
- `src/app/App.tsx` schedules live saves and guards external replacements.
- Antistatic's `app/src/utils/utils.ts` owns the `WatchedFile` path and
  `app/src/engine.ts` reloads and replaces matching entities when Live Reload
  is enabled. `app/src/game/stage-visual-preview.ts` watches and validates the
  current stage file, then publishes an isolated visual projection.

The live-update contract is filesystem-based and deliberately has no network
protocol. That keeps the editor useful with a normal local checkout and avoids
adding a development-only socket to the shipped game.
