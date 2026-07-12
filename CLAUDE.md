# CLAUDE.md

Guidance for future Claude Code sessions working in this repo. Read this
before touching anything.

---

## What this project is

**Cursor HighLighter** — a menu-bar / tray Electron app that draws a colored
ring around the mouse cursor and shows keystrokes on screen, aimed at screen
recordings, demos, and tutorials.

- Cross-platform: macOS (arm64 + x64) and Windows (x64 + arm64).
- Menu-bar only on macOS (`LSUIElement: true` — no Dock icon).
- Distributed via GitHub Releases + a Homebrew tap.

Repo: <https://github.com/kewal28/cursor-highlighter>
Tap: <https://github.com/kewal28/homebrew-cursor-highlighter>

---

## Architecture at a glance

Three renderer surfaces coordinated by one main process:

```
┌─────────────── main process (src/main.js) ──────────────────┐
│                                                              │
│  • Tray + right-click menu                                   │
│  • One transparent, click-through BrowserWindow per display  │
│  • 120 Hz cursor loop → sends coords to overlay via IPC      │
│  • uiohook-napi listener → mouse-down / mouse-up / key-down  │
│  • globalShortcut for the toggle hotkey                      │
│  • electron-store-free JSON persistence (src/store.js)       │
│                                                              │
└─┬────────────────────┬────────────────────┬─────────────────┘
  │ IPC                │ IPC                │ globalShortcut
  ▼                    ▼                    ▼
overlay.html      settings.html         Ring toggles on/off
(per display)     (menu bar popup)      without opening popup
  • ring div        • color pickers
  • keystroke pill  • sliders, toggles
                    • record shortcut UI
                    • Reset / Quit
                    • README / Issues links
```

### Two important nuances

1. **Overlay windows cover full `display.bounds`, not `workArea`.**
   `enableLargerThanScreen: true` + `type: 'panel'` + `setBounds()` after
   creation lets the ring draw through the macOS menu bar / notch. If macOS
   still constrains the window to workArea despite the request, the cursor
   loop reads `win.getBounds()` (cached and refreshed on `move`/`resize`)
   and translates coordinates from the window's *actual* on-screen origin —
   so the ring stays centered on the cursor either way.

2. **Broadcasts to `settings` also hit the settings window.**
   The `broadcast('settings', …)` helper pushes to every overlay AND, when
   the channel is `'settings'`, to the settings window as well. This is what
   makes the popup's toggle switch update in real time when the global
   shortcut fires or the tray "Enable/Disable" is clicked. If you're mid
   shortcut-recording in the popup, the incoming push is suppressed so it
   doesn't clobber the recording UI.

---

## File map

```
src/
  main.js              Main process — tray, overlay windows, cursor loop,
                       input hook, global shortcut, IPC handlers
  store.js             Tiny synchronous JSON persistence in
                       app.getPath('userData')/settings.json — hand-rolled
                       so we have zero renderer deps
  keymap.js            uiohook keycode → display label (⌘ ⇧ ⏎ ⌫ …)
                       Modifier-aware (⇧⌘4 etc.)
  overlay/
    overlay.html       Transparent frame — the ring + keystroke pill
    overlay.js         Ring positioning, click flash, keystroke fade
    preload.js         Exposes bridge for cursor/mouse/key/settings events
  settings/
    settings.html      Menu-bar popup markup
    settings.css       Styling (dark card, sliders, toggles, chip button)
    settings.js        Wiring: sliders → main, shortcut recorder, previews
    preload.js         Exposes bridge (getSettings/setSetting/resetSettings/
                       onSettings/openExternal/quit/…)

assets/
  trayTemplate.png     Menu bar tray icon (macOS template — monochrome,
                       adapts to light/dark)
  trayTemplate@2x.png

build/                  electron-builder resources
  icon.png             1024×1024 source (cursor + green ring)
  icon.icns            Generated from icon.png via iconutil
  icon.ico             Windows multi-res icon

docs/
  screenshots/         README screenshots

homebrew/               Cask template (not the actual tap — the tap is a
                        separate repo, see below)
  cursor-highlighter.rb
  README.md

.github/workflows/
  release.yml          Tag-triggered CI: builds macOS + Windows in parallel,
                       attaches artifacts to a GitHub Release
```

---

## Commands you'll actually use

```bash
# Dev — hot-reload not set up, just re-launch
npm start

# Rebuild native modules against the current Electron ABI
npm run rebuild

# Build distributables locally
npm run dist:mac      # arm64 + x64 dmg + zip
npm run dist:win      # x64 + arm64 nsis + portable
npm run dist          # current platform

# Fast .app iteration (skip dmg assembly)
npx electron-builder --mac dir

# Syntax-check every JS file (there are no tests)
node --check src/main.js && node --check src/store.js && \
  node --check src/keymap.js && node --check src/overlay/*.js && \
  node --check src/settings/*.js && node --check src/settings/preload.js && \
  node --check src/overlay/preload.js
```

---

## Runtime dependencies

Only two, both intentional:

| Package | Why |
|---|---|
| `electron` (33.x) | Runtime. Pinned to 33 — later majors haven't been tested against uiohook-napi's prebuilds. |
| `uiohook-napi` (1.5.x) | Global mouse + keyboard events. Only native dep. Ships prebuilt binaries — no rebuild needed if npm respects them. |

`electron-store` was intentionally dropped in favor of `src/store.js` to keep the tree at one native dep.

The renderer has **zero** third-party runtime deps. Everything in `overlay/`
and `settings/` is vanilla HTML/CSS/JS with tight CSP.

---

## Release flow

Two-repo model:

1. **`kewal28/cursor-highlighter`** — this repo — hosts source and Releases.
2. **`kewal28/homebrew-cursor-highlighter`** — the Homebrew tap (separate repo,
   populated locally at `/tmp/homebrew-cursor-highlighter` when we work on it
   here). Contains just `Casks/cursor-highlighter.rb`, `README.md`, `LICENSE`.

### Every release

1. Bump version and tag:
   ```bash
   npm version patch          # 1.0.0 → 1.0.1, commits + tags
   git push --follow-tags
   ```
2. Either let the release workflow at `.github/workflows/release.yml` handle
   it, OR publish manually:
   ```bash
   npm run dist:mac
   gh release create v1.0.1 \
     --title "v1.0.1" --notes "..." \
     dist/cursor-highlighter-1.0.1-mac-arm64.dmg \
     dist/cursor-highlighter-1.0.1-mac-x64.dmg \
     dist/cursor-highlighter-1.0.1-mac-arm64.zip \
     dist/cursor-highlighter-1.0.1-mac-x64.zip
   ```
3. Update the Homebrew tap:
   ```bash
   shasum -a 256 dist/cursor-highlighter-*-mac-arm64.dmg
   shasum -a 256 dist/cursor-highlighter-*-mac-x64.dmg
   ```
   Edit the tap's `Casks/cursor-highlighter.rb`: bump `version` and both
   `sha256` lines. Commit + push.

### CI vs. manual publish

The CI workflow rebuilds from scratch, so its DMG SHAs will differ from any
locally-built ones (build timestamps and code signing change bytes). If you
plan to update the Homebrew tap from local SHAs, publish local artifacts.
If you plan to grab SHAs from the CI-built release, publish via CI.

---

## Gotchas / things that bit us

### 1. macOS Accessibility + Input Monitoring both required

`uiohook-napi` needs **both** privacy grants on macOS:
- Accessibility → for clicks
- Input Monitoring → for keystrokes

The permissions are per-app-identity, so:
- In dev (`npm start`), grant to `Electron.app`
- In prod (installed .app), grant to `Cursor HighLighter.app` (separate identity)

Startup logs `[cursor-highlighter] uiohook started` on success or an error
with a hint about the two permissions on failure.

### 2. macOS notch / menu bar coordinate math

Do not use `display.workArea` for overlay window bounds — that clips the ring
at the menu bar. Use `display.bounds` + `enableLargerThanScreen` + read
`win.getBounds()` for cursor-coord translation. This is documented inline in
`createOverlayForDisplay` in `main.js`.

### 3. Native rebuild + Python 3.12

`electron-builder install-app-deps` (the ex-`postinstall` script — now
renamed to `rebuild`) can fail if Python 3.12+ is default and
`setuptools` isn't installed (distutils removed from stdlib). Fix:

```bash
python3 -m pip install --user setuptools --break-system-packages
```

We removed the `postinstall` hook so `npm install` succeeds without this.
Only run `npm run rebuild` if you upgrade Electron and see an ABI mismatch.

### 4. Root-owned node_modules

If someone runs `sudo npm install` even once, `node_modules/` gets
root-owned and future non-sudo installs fail with EACCES. Fix:

```bash
sudo chown -R $(id -u):$(id -g) . ~/.npm ~/Library/Caches/electron
```

Never `sudo npm` anything in this repo.

### 5. Homebrew tap requires `brew trust`

Since Homebrew 4.6, third-party taps need explicit trust:

```bash
brew tap kewal28/cursor-highlighter
brew trust kewal28/cursor-highlighter        # ← new requirement
brew install --cask cursor-highlighter
```

Documented in both READMEs.

### 6. Global shortcut vs. settings popup sync

If you add a new setting that can be changed from outside the popup (tray
menu, shortcut, IPC handler), make sure `applySetting()` broadcasts, and
`applySettingsToUI()` in `settings.js` reflects the new key. The
`onSettings` subscription in the popup's `init()` will then keep it in sync.

### 7. Quit reliability

`app.quit()` alone was unreliable — overlay windows are `closable: false`
which can stall it, and `window-all-closed` had a `preventDefault()` that
fought quit. Current `quitApp()`:

- Sets `isQuitting = true` so `window-all-closed` stops fighting
- Explicitly `.destroy()`s all overlays, settings window, and tray
- Calls `app.quit()` then `setTimeout(() => app.exit(0), 400)` as a hard
  fallback

Don't revert to plain `app.quit()`.

---

## Coding conventions

- 2-space indent, LF, single quotes, trailing semicolons.
- No frontend framework, no bundler. Vanilla HTML/CSS/JS.
- Preload scripts use `contextIsolation: true` + `sandbox: true`. The main
  world's `window.bridge` object is the *only* channel between renderer and
  main.
- CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'`
  on both HTML files. Don't loosen without cause.
- Comments only for non-obvious *why* — hidden constraints, subtle
  invariants, workarounds. Don't narrate the code.
- No TypeScript. No tests. `node --check` is the only gate.

---

## What's intentionally NOT here

Don't add these without a strong reason:

- Auto-updater (electron-updater). `latest*.yml` files already ship, so
  wiring it later is easy — but v1 is manual DMG downloads / brew.
- Code signing / notarization. Cert is expired. Users get the "right-click →
  Open" Gatekeeper prompt on first launch. Documented in README.
- Analytics / telemetry. Deliberate.
- Frontend framework. The UI is 3 small windows — vanilla is enough.
- Tests. Add if the app grows a real state machine, otherwise `node --check`
  + manual QA is fine.

---

## First-run checklist for a new contributor

```bash
git clone https://github.com/kewal28/cursor-highlighter.git
cd cursor-highlighter
npm install
npm start
```

Then grant Electron.app **Accessibility** and **Input Monitoring** in
System Settings, quit, `npm start` again. Ring should follow the cursor and
keystrokes should show as pills at the bottom of the screen.

If keystrokes don't show: it's Input Monitoring, always. See gotcha #1.

---

## Contact / attribution

Built with [Claude Code](https://claude.com/claude-code) in collaboration
with [Kewal Kanojia](https://github.com/kewal28). MIT-licensed.
