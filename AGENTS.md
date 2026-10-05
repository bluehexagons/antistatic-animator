# Repository Guidelines

## Project Structure & Module Organization

This is an Electron + React + TypeScript animator for fighting-game hitboxes and hurtboxes. Source lives in `src/`. Renderer UI components are in `src/app/`, animation domain logic is in `src/animator/`, storage adapters are in `src/storage/`, runtime helpers are in `src/runtime/`, and Electron entry points are `src/electron.ts` and `src/preload.ts`. Tests live in `src/test/` and use `*.test.ts` or `*.test.tsx`. Build output goes to `dist/`; do not edit generated files there.

## Sister Repositories

Development environments commonly have related repositories checked out next to this one:

- `../antistatic`: the main Antistatic game repo. This is private/closed-source, although release downloads include unobfuscated transpiled JavaScript. It is acceptable to copy small pieces into this repo when needed, but keep borrowed code clearly separated for maintenance and check with the maintainer before copying anything large.
- `../antistatic-translations`: translation data and strings from Antistatic. This tool does not support translations directly, but the repo is useful as a reference.
- `../easing`: the `@bluehexagons/easing` package. Check the main Antistatic repo for how it is imported when matching engine behavior.
- `../trace`: the trace language used for in-game color math.

Check each sister repository's license before borrowing code or data.
Translations use CC-BY-SA-4.0; the listed easing and Trace packages use
Apache-2.0 and MIT respectively.

## Build, Test, and Development Commands

- Linux development uses Basaltwater-managed CachyOS workstations and Debian
  hosts. CachyOS covers interactive game/Animator/asset work; Debian also covers
  game development, validation, builds, and services. Primary checkouts live
  beside one another under `~/repos` or the configured `--agent-workspace` root.
  Locate the actual primary checkouts with `git worktree list` when working in
  an isolated worktree. See Antistatic's
  [workspace guide](https://github.com/bluehexagons/antistatic/blob/main/docs/sister-repositories.md).
  Diagnose CachyOS with `basaltw local cachyos-doctor --json`, or Debian with
  `basaltw agent doctor --capability development --json`, when host tooling is
  suspect. Repository checks remain authoritative and work without Basaltwater.
- `npm install`: install dependencies. Requires Node `>=22.22.1`.
- Select `.nvmrc` with `nvm use` before npm commands. On Basaltwater,
  `basaltw node exec -- npm run check` selects the project runtime without
  changing the host default; `basaltw node install` installs a missing pin and
  prepares NVM on demand on CachyOS. Use ordinary NVM or compatible system Node
  when Basaltwater is absent; each worktree needs its own `npm ci`.
- `npm run check`: run the complete local and CI validation gate.
- `npm run dev`: start the Vite dev server for browser development.
- `npm run dev:electron`: build all targets, then launch Electron.
- `npm run build`: build Electron main, preload, and renderer bundles.
- `npm start`: run Electron from the current `dist/` output.
- `npm run type-check`: run TypeScript validation without emitting files.
- `npm run lint`: run Oxlint over `src/` with warnings denied.
- `npm run test:run`: run the Vitest suite once.
- `npm run format:check`: verify Oxfmt formatting.
- `npm run dist`: package the Electron app with `@electron/packager`.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep domain operations in `src/animator/operations/` and UI behavior in `src/app/` unless shared by design. Follow existing file naming: components use `PascalCase.tsx`, hooks use `hooks.ts`, and tests mirror feature names such as `keyframe-ops.test.ts`. Formatting and linting use Oxfmt and Oxlint. Prefix intentionally unused parameters with `_`. Avoid `any`; it warns and should have a clear reason.

## Testing Guidelines

Vitest is configured with `happy-dom` and `src/test/setup.ts`. Add tests under
`src/test/` for reducer changes, animator operations, storage behavior,
rendering smoke coverage, and schema/lint logic. Prefer focused tests for public
helpers or user-visible behavior. Run `npm run check` before publishing changes.

For browser review, prefer T3 Code's collaborative preview when its automation
tools are available; inspect preview status and open it before navigating. Keep
Vite on loopback and verify that the connected client can reach the URL. T3's
environment-port target does not tunnel to a remote host's loopback. On Debian,
managed Playwright is another option when T3 preview is unavailable and
`basaltw agent doctor --capability browser --json` succeeds. CachyOS does not
provide that managed browser bundle. Routine managed-browser artifacts stay in
Basaltwater's private bounded storage. Store only explicitly requested,
shareable screenshots or recordings
under ignored `local-artifacts/`. Use the Electron build for behavior that
depends on native dialogs or filesystem integration.

## Commit & Collaboration Guidelines

Commit history mostly follows conventional prefixes, for example `feat(animator): ...`, `fix(animator): ...`, `test(animator): ...`, and `ci: ...`. Keep commits small and descriptive. This project typically does not use pull requests; coordinate changes directly, include commands run in your handoff, and call out unverified areas. For visual UI changes, include screenshots or a short workflow summary.

## Security & Configuration Tips

Do not commit local game data, generated packages, coverage reports, or secrets. Keep file-system access changes scoped to the existing Electron, browser File System Access, and drag-and-drop storage paths.
