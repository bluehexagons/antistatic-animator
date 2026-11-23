# Animator desktop release QA

Test the extracted archive on the intended Windows or macOS desktop. Use the
release candidate's locked dependencies and an interactive session. Record the
Animator revision, Electron version, OS and architecture, archive SHA-256, and
each check's outcome in ignored `local-artifacts/`.

## Prepare the Windows x64 archive

Run from the Animator root in PowerShell with a compatible Node version. For
hosted validation, use an authenticated GitHub CLI and the successful Release
workflow run for the intended revision. To rehearse the hosted build from
`main`, run `gh workflow run release.yml --ref main`.

```powershell
$runId = '<Release workflow run ID>'
$run = "local-artifacts/desktop-qa-$runId"
gh run view $runId --json headSha,conclusion,url
gh run download $runId --name win32-x64-archive --dir "$run/download"
$zip = Get-ChildItem -LiteralPath "$run/download" -File -Filter '*.zip'
Get-FileHash -LiteralPath $zip.FullName -Algorithm SHA256
Expand-Archive -LiteralPath $zip.FullName -DestinationPath "$run/Extracted – Animator"
```

Confirm `headSha` matches the intended revision and `conclusion` is `success`
before downloading. Record the workflow run URL and the hash of the downloaded
ZIP. For a local rehearsal, build the archive in a new output directory:

```powershell
npm.cmd ci
npm.cmd run check
$run = 'local-artifacts/desktop-qa'
npm.cmd run dist -- --platform=win32 --arch=x64 --out=$run/package
npm.cmd run package -- --platform=win32 --arch=x64 --out=$run/package
$zip = Get-ChildItem "$run/package/archives/*.zip"
Get-FileHash -LiteralPath $zip.FullName -Algorithm SHA256
Expand-Archive -LiteralPath $zip.FullName -DestinationPath "$run/Extracted Animator"
```

Use the packaged `version` file to confirm the Electron version. If the shell
was started by Electron and inherited `ELECTRON_RUN_AS_NODE=1`, clear that
variable in the test shell before launching. Start the executable from a
different working directory with a fresh `--user-data-dir=<absolute path>`.
Use a disposable copy of game data for editor changes. Include spaces and
non-ASCII characters in both the extracted and project paths.

## Desktop smoke

- [ ] The packaged window loads the editor and the source picker. Use **Open
      game directory** to select the disposable project in the native folder picker.
      Confirm that character files and their animation lists load.
- [ ] Open the source picker again and cancel the native dialog. Confirm that
      the previously selected project and open file are still available.
- [ ] In **Stages**, open a valid JSONC stage with a comment, edit a field such
      as a blast bound, then try switching to a second disposable project. Cancel
      the discard prompt and confirm the edit and original project are still
      selected. Use **Save** and confirm the new value and comment on disk. On
      reopening the editor with the same profile, confirm the project is restored
      and the stage opens with the saved value.
- [ ] With the stage open, replace its file externally. Wait for **Reload
      changed**, confirm **Save** is disabled, and reload to see the new value.
- [ ] Open the adjacent Antistatic checkout and start a headless session in
      **Game tools**. Run an observation, stop the session, and close Animator.
      Confirm its game process exits. Use the source Node version and native build
      prerequisites for the selected game revision.

Run the same desktop smoke on a macOS target with its candidate app bundle.
The [release workflow](../.github/workflows/release.yml) currently produces
Windows and Linux archives. See [stage authoring QA](stage-authoring-qa.md) for
the broader editing and game parity checks.
