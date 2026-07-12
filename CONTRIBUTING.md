# Contributing

Thanks for your interest in improving Cursor HighLighter!

## Getting started

```bash
git clone https://github.com/kewal28/cursor-highlighter.git
cd cursor-highlighter
npm install
npm start
```

The app installs a menu bar / tray icon. Click it to open the settings popup.
`Cmd+Q` (macOS) or right-click → *Quit Cursor HighLighter* to exit.

## Project layout

```
src/
  main.js              Main process — tray, overlay windows, global input hook
  store.js             Tiny JSON persistence for user settings
  keymap.js            uiohook keycode → display label (⌘, ⇧, ⏎, …)
  overlay/             Transparent click-through window (ring + keystroke pill)
  settings/            Menu bar popup with all controls
assets/                Tray icons
build/                 Source files for app icons + electron-builder resources
.github/workflows/     Release workflow
```

## Development notes

- The overlay windows use `setIgnoreMouseEvents(true)` and `screen-saver`
  always-on-top level so they float above every full-screen app without
  swallowing clicks.
- The cursor position is polled via `screen.getCursorScreenPoint()` at ~120 Hz.
  Mouse-button and keyboard events come from `uiohook-napi`, which needs
  Accessibility permission on macOS.
- Settings are stored as JSON in `app.getPath('userData')` and broadcast to
  overlays via IPC. Every renderer reads through a preload script — the
  renderers have `contextIsolation: true` and `sandbox: true`.

## Pull requests

- Keep changes small and focused.
- No new dependencies unless there's a strong reason.
- Follow the existing style (2-space indent, LF, semicolons, single quotes).
- Test on macOS *and* Windows if you can — CI covers both.

## Releasing

Push a tag matching `v*` (e.g. `v1.0.1`) and the release workflow builds
signed / notarized artifacts (if signing secrets are configured) and attaches
them to a GitHub Release.

```bash
npm version patch    # bumps package.json + creates a git tag
git push --follow-tags
```
