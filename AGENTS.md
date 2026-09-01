# Repository Guidelines

## Project Structure & Module Organization

This is an Electron + React + TypeScript animator for fighting-game hitboxes and hurtboxes. Source lives in `src/`. Renderer UI components are in `src/app/`, animation domain logic is in `src/animator/`, storage adapters are in `src/storage/`, runtime helpers are in `src/runtime/`, and Electron entry points are `src/electron.ts` and `src/preload.ts`. Tests live in `src/test/` and use `*.test.ts` or `*.test.tsx`. Build output goes to `dist/`; do not edit generated files there.

## Sister Repositories

Development environments commonly have related repositories checked out next to this one:

- `../antistatic`: the main Antistatic game repo. This is private/closed-source, although release downloads include unobfuscated transpiled JavaScript. It is acceptable to copy small pieces into this repo when needed, but keep borrowed code clearly separated for maintenance and check with the maintainer before copying anything large.
- `../antistatic-translations`: translation data and strings from Antistatic. This tool does not support translations directly, but the repo is useful as a reference.
- `../easing`: the `@bluehexagons/easing` package. Check the main Antistatic repo for how it is imported when matching engine behavior.
- `../trace`: the trace language used for in-game color math.

Except for `../antistatic`, the sister repos are MIT and/or Apache licensed.

## Build, Test, and Development Commands

- The standard Linux host is an infra-tools-managed agent VM. Related
  repositories live beside this checkout below `~/repos`. Run
  `infra-tools agent doctor --capability development --json` only when the host
  toolchain is in question; repository checks remain authoritative.
- `npm install`: install dependencies. Requires Node `>=22.22.1`.
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

For loopback browser review, verify the managed browser capability and use
VM-origin Playwright. T3's environment-port target is not a tunnel to VM
loopback; use its collaborative preview only when the connected client can
already reach the application or client-visible access was deliberately
published. Routine browser artifacts stay in infra-tools' private bounded
storage. Store only explicitly requested, shareable screenshots or recordings
under ignored `local-artifacts/`. Use the Electron build for behavior that
depends on native dialogs or filesystem integration.

## Commit & Collaboration Guidelines

Commit history mostly follows conventional prefixes, for example `feat(animator): ...`, `fix(animator): ...`, `test(animator): ...`, and `ci: ...`. Keep commits small and descriptive. This project typically does not use pull requests; coordinate changes directly, include commands run in your handoff, and call out unverified areas. For visual UI changes, include screenshots or a short workflow summary.

## Security & Configuration Tips

Do not commit local game data, generated packages, coverage reports, or secrets. Keep file-system access changes scoped to the existing Electron, browser File System Access, and drag-and-drop storage paths.
