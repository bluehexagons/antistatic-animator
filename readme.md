The Antistatic Animator is the tool used to animate characters in Antistatic. It's buggy and a huge mess.

Run `npm install` to install, then:
- `npm run build` for a one-time build (esbuild + Vite)
- `npm run watch` while iterating on renderer builds
- `npm start` to open the Electron app

Click on the installation directory selector and choose the root folder.

Select a character with the first dropdown, and an animation with the second.

## Releases

Releases are now automated through GitHub Actions:
- `CI` validates builds on pull requests and pushes to `main`.
- `Release` packages Linux, Windows, and macOS artifacts and publishes them when pushing a `v*` tag.
