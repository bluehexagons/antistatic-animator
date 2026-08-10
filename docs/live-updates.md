# Live Updates

The intended development loop is now save-to-game rather than a 3D preview.
The animator writes the same character files that Antistatic loads, and the
game can replace live character entities when those files change.

## Setup

1. Run Antistatic from a development checkout.
2. Enable **Live Reload** in Antistatic's main options screen. It is disabled
   by default.
3. Open that Antistatic checkout as the animator's **Local** source.
4. Enable **Live sync** in the animator toolbar.
5. Enter training mode in Antistatic and edit a character animation. Changes
   are saved after a short debounce and the game replaces matching live
   entities.

Live sync is intentionally available only for the Electron local source. The
browser File System Access and upload backends cannot reliably identify the
running game's data directory.

## Safety

- Live sync writes the current animation file after edits; **Save** remains
  available for an explicit write.
- Writes made by another tool are detected by the Electron backend. The
  animator shows **Reload changed** instead of silently replacing the editor's
  in-memory work. Live autosave pauses until the changed source is reloaded.
- Reloading while dirty asks for confirmation because it discards local edits.
- Antistatic's Live Reload setting covers character data. Stage files still
  require a game restart or a separate stage reload path.

## Implementation

- `src/storage/electron.ts` watches source directories through the preload
  bridge, so atomic same-directory replacements remain observable.
- `src/storage/library.ts` debounces backend events and filters out writes that
  already match the library cache.
- `src/app/App.tsx` schedules live saves and guards external replacements.
- Antistatic's `app/src/utils/utils.ts` owns the `WatchedFile` path and
  `app/src/engine.ts` reloads and replaces matching entities when Live Reload
  is enabled.

The live-update contract is filesystem-based and deliberately has no network
protocol. That keeps the editor useful with a normal local checkout and avoids
adding a development-only socket to the shipped game.
