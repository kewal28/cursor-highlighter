const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  screen,
  ipcMain,
  nativeImage,
  systemPreferences,
  shell,
  globalShortcut,
} = require('electron');
const path = require('path');
const store = require('./store');
const { eventToLabel } = require('./keymap');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const REPO_URL = 'https://github.com/kewal28/cursor-highlighter';
const ISSUES_URL = `${REPO_URL}/issues`;

let tray = null;
let settingsWindow = null;
const overlays = new Map(); // display.id -> BrowserWindow
let cursorTimer = null;
let lastDisplayId = null;
let uiohook = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Overlay windows — one transparent, click-through window per display
// ---------------------------------------------------------------------------
function createOverlayForDisplay(display) {
  // Use full display bounds so the ring can draw across the menu bar / notch
  // and taskbar. enableLargerThanScreen lets the window stretch beyond the
  // reported work area on macOS.
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    show: false,
    type: isWin ? 'toolbar' : 'panel',
    webPreferences: {
      preload: path.join(__dirname, 'overlay', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  // Above every full-screen app AND the menu bar.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: false });

  // Force the window to cover the full display, in case macOS constrained it
  // to the work area during creation.
  win.setBounds({ x, y, width, height });

  // Cache the window's actual on-screen origin so the cursor loop can convert
  // absolute coords into window-local coords without calling into native code
  // 120 times per second.
  const b = win.getBounds();
  win.__originX = b.x;
  win.__originY = b.y;
  const refreshOrigin = () => {
    const nb = win.getBounds();
    win.__originX = nb.x;
    win.__originY = nb.y;
  };
  win.on('move', refreshOrigin);
  win.on('resize', refreshOrigin);

  win.loadFile(path.join(__dirname, 'overlay', 'overlay.html'));
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('settings', store.all);
    if (store.get('enabled')) win.showInactive();
  });

  overlays.set(display.id, win);
  return win;
}

function rebuildOverlays() {
  for (const win of overlays.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  overlays.clear();
  lastDisplayId = null;
  for (const display of screen.getAllDisplays()) createOverlayForDisplay(display);
}

function broadcast(channel, payload) {
  for (const win of overlays.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

// ---------------------------------------------------------------------------
// Cursor tracking loop (~120 Hz)
// ---------------------------------------------------------------------------
function startCursorLoop() {
  if (cursorTimer) return;
  cursorTimer = setInterval(() => {
    if (!store.get('enabled')) return;
    const pt = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(pt);
    const win = overlays.get(display.id);
    if (!win || win.isDestroyed()) return;

    if (lastDisplayId !== null && lastDisplayId !== display.id) {
      const prev = overlays.get(lastDisplayId);
      if (prev && !prev.isDestroyed()) prev.webContents.send('cursor-hide');
    }
    lastDisplayId = display.id;

    // Use the window's real on-screen origin, not display.bounds — that way if
    // macOS pinned the overlay to workArea (below the menu bar), we still
    // translate correctly.
    win.webContents.send('cursor', {
      x: pt.x - win.__originX,
      y: pt.y - win.__originY,
    });
  }, 8);
}

function stopCursorLoop() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Global mouse + keyboard hook (uiohook-napi)
// macOS requires Accessibility permission.
// ---------------------------------------------------------------------------
function startHook() {
  if (uiohook) return;
  try {
    const mod = require('uiohook-napi');
    uiohook = mod.uIOhook;

    uiohook.on('mousedown', (e) => {
      if (!store.get('enabled')) return;
      broadcast('mouse', { type: 'down', button: e.button });
    });

    uiohook.on('mouseup', (e) => {
      if (!store.get('enabled')) return;
      broadcast('mouse', { type: 'up', button: e.button });
    });

    uiohook.on('keydown', (e) => {
      if (!store.get('enabled') || !store.get('showKeys')) return;
      const label = eventToLabel(e);
      if (label) broadcast('key', label);
    });

    uiohook.start();
    console.log('[cursor-highlighter] uiohook started — global mouse/key events active');
  } catch (err) {
    console.error(
      '[cursor-highlighter] failed to start global input hook:',
      err.message,
    );
    console.error(
      '  On macOS this usually means Accessibility or Input Monitoring',
      'permission has not been granted to Electron.',
    );
    uiohook = null;
  }
}

function stopHook() {
  if (!uiohook) return;
  try {
    uiohook.stop();
  } catch {}
  uiohook = null;
}

function ensureAccessibilityPermission() {
  if (!isMac) return true;
  return systemPreferences.isTrustedAccessibilityClient(true);
}

// ---------------------------------------------------------------------------
// Global shortcut for toggling the ring
// ---------------------------------------------------------------------------
let registeredShortcut = null;

function registerToggleShortcut(accelerator) {
  if (registeredShortcut) {
    globalShortcut.unregister(registeredShortcut);
    registeredShortcut = null;
  }
  if (!accelerator) return true;
  try {
    const ok = globalShortcut.register(accelerator, () => {
      applySetting('enabled', !store.get('enabled'));
    });
    if (ok) {
      registeredShortcut = accelerator;
      return true;
    }
    console.error(
      '[cursor-highlighter] shortcut already in use by another app:',
      accelerator,
    );
    return false;
  } catch (err) {
    console.error(
      '[cursor-highlighter] invalid shortcut accelerator:',
      accelerator,
      err.message,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings popup
// ---------------------------------------------------------------------------
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 340,
    height: 680,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'settings', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings', 'settings.html'));
  settingsWindow.on('blur', () => {
    if (settingsWindow && settingsWindow.isVisible()) settingsWindow.hide();
  });
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function positionSettingsWindow() {
  if (!tray) return;
  const trayBounds = tray.getBounds();
  const winBounds = settingsWindow.getBounds();
  const displayBounds = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  }).workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 6);

  if (isWin) {
    // On Windows the tray sits at the bottom right — open above the tray.
    y = Math.round(trayBounds.y - winBounds.height - 6);
  }

  // Clamp inside the display work area.
  x = Math.min(
    Math.max(x, displayBounds.x + 6),
    displayBounds.x + displayBounds.width - winBounds.width - 6,
  );
  y = Math.min(
    Math.max(y, displayBounds.y + 6),
    displayBounds.y + displayBounds.height - winBounds.height - 6,
  );

  settingsWindow.setPosition(x, y, false);
}

function toggleSettingsWindow() {
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  if (settingsWindow.isVisible()) {
    settingsWindow.hide();
    return;
  }
  positionSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

// ---------------------------------------------------------------------------
// Apply setting changes
// ---------------------------------------------------------------------------
function applySetting(key, value) {
  if (!(key in store.defaults)) return;
  store.set(key, value);

  if (key === 'enabled') {
    if (value) {
      for (const win of overlays.values()) if (!win.isDestroyed()) win.showInactive();
      startCursorLoop();
    } else {
      for (const win of overlays.values()) if (!win.isDestroyed()) win.hide();
      stopCursorLoop();
    }
    updateTrayMenu();
  }

  if (key === 'launchAtLogin') {
    app.setLoginItemSettings({ openAtLogin: !!value });
  }

  if (key === 'toggleShortcut') {
    registerToggleShortcut(value);
  }

  broadcast('settings', store.all);
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: store.get('enabled') ? 'Disable Highlight' : 'Enable Highlight',
      click: () => applySetting('enabled', !store.get('enabled')),
    },
    { label: 'Settings…', click: () => toggleSettingsWindow() },
    { type: 'separator' },
    {
      label: 'About Cursor HighLighter',
      click: () => shell.openExternal(REPO_URL),
    },
    {
      label: 'Report an Issue',
      click: () => shell.openExternal(ISSUES_URL),
    },
    { type: 'separator' },
    { label: 'Quit Cursor HighLighter', click: () => quitApp() },
  ]);
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setToolTip(
    store.get('enabled') ? 'Cursor HighLighter — on' : 'Cursor HighLighter — off',
  );
}

function trayIconPath() {
  if (isWin) {
    return path.join(__dirname, '..', 'assets', 'trayTemplate.png');
  }
  return path.join(__dirname, '..', 'assets', 'trayTemplate.png');
}

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath());
  if (isMac) icon.setTemplateImage(true);
  tray = new Tray(icon);
  updateTrayMenu();

  tray.on('click', () => toggleSettingsWindow());
  tray.on('right-click', () => tray.popUpContextMenu(buildContextMenu()));
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.handle('get-settings', () => store.all);
ipcMain.on('set-setting', (_e, { key, value }) => applySetting(key, value));
ipcMain.handle('reset-settings', () => {
  store.reset();
  const s = store.all;

  // Re-apply side-effects for state that lives outside the store.
  app.setLoginItemSettings({ openAtLogin: !!s.launchAtLogin });
  registerToggleShortcut(s.toggleShortcut);
  if (s.enabled) {
    for (const win of overlays.values()) if (!win.isDestroyed()) win.showInactive();
    startCursorLoop();
  } else {
    for (const win of overlays.values()) if (!win.isDestroyed()) win.hide();
    stopCursorLoop();
  }
  updateTrayMenu();
  broadcast('settings', s);
  return s;
});
function quitApp() {
  if (isQuitting) return;
  isQuitting = true;
  setImmediate(() => {
    stopCursorLoop();
    stopHook();
    for (const win of overlays.values()) if (!win.isDestroyed()) win.destroy();
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.destroy();
    if (tray) tray.destroy();
    app.quit();
    // Belt & braces: if any listener stalls quit, force-exit.
    setTimeout(() => app.exit(0), 400);
  });
}

ipcMain.on('quit-app', () => quitApp());
ipcMain.on('close-popup', () => {
  if (settingsWindow && settingsWindow.isVisible()) settingsWindow.hide();
});
ipcMain.on('open-accessibility-settings', () => {
  if (isMac) {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    );
  }
});
ipcMain.on('open-external', (_e, which) => {
  const map = {
    repo: REPO_URL,
    readme: `${REPO_URL}#readme`,
    issues: ISSUES_URL,
  };
  const url = map[which];
  if (url) shell.openExternal(url);
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (isMac && app.dock) app.dock.hide();

    createTray();
    rebuildOverlays();
    createSettingsWindow();
    startCursorLoop();

    ensureAccessibilityPermission();
    startHook();
    registerToggleShortcut(store.get('toggleShortcut'));

    app.setLoginItemSettings({ openAtLogin: !!store.get('launchAtLogin') });

    screen.on('display-added', rebuildOverlays);
    screen.on('display-removed', rebuildOverlays);
    screen.on('display-metrics-changed', rebuildOverlays);
  });

  app.on('window-all-closed', (e) => {
    if (!isQuitting) e.preventDefault();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    stopCursorLoop();
    stopHook();
    globalShortcut.unregisterAll();
  });
}
