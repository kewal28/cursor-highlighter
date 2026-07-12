const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = Object.freeze({
  enabled: true,
  ringColor: '#7be49b',
  leftClickColor: '#7be49b',
  rightClickColor: '#3f5bd9',
  size: 64,
  width: 6,
  opacity: 0.9,
  showKeys: true,
  launchAtLogin: false,
  toggleShortcut: 'CommandOrControl+Shift+H',
});

const file = path.join(app.getPath('userData'), 'settings.json');

function readFromDisk() {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

let state = { ...DEFAULTS, ...readFromDisk() };
let writeTimer = null;

function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  }, 100);
}

module.exports = {
  defaults: DEFAULTS,
  get all() {
    return { ...state };
  },
  get(key) {
    return state[key];
  },
  set(key, value) {
    if (state[key] === value) return;
    state = { ...state, [key]: value };
    persist();
  },
  reset() {
    state = { ...DEFAULTS };
    persist();
  },
};
