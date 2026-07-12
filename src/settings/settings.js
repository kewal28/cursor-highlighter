const $ = (id) => document.getElementById(id);

const previewRing = $('previewRing');
const previewKeys = $('previewKeys');
const statusText = $('statusText');
const hint = $('hint');
const shortcutBtn = $('shortcutBtn');
const shortcutLabel = $('shortcutLabel');
const isMac = window.bridge.platform === 'darwin';

function readState() {
  return {
    enabled: $('enabled').checked,
    ringColor: $('ringColor').value,
    leftClickColor: $('leftClickColor').value,
    rightClickColor: $('rightClickColor').value,
    size: Number($('size').value),
    width: Number($('width').value),
    opacity: Number($('opacity').value) / 100,
    showKeys: $('showKeys').checked,
    launchAtLogin: $('launchAtLogin').checked,
  };
}

function refreshLabels() {
  $('sizeVal').textContent = $('size').value + 'px';
  $('widthVal').textContent = $('width').value + 'px';
  $('opacityVal').textContent = $('opacity').value + '%';
}

function hexAlpha(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function updatePreview(s) {
  const maxSize = 100;
  const scale = Math.min(1, maxSize / s.size);
  const d = Math.round(s.size * scale);
  const w = Math.max(2, Math.round(s.width * scale));

  previewRing.style.width = d + 'px';
  previewRing.style.height = d + 'px';
  previewRing.style.border = `${w}px solid ${s.ringColor}`;
  previewRing.style.opacity = s.opacity;
  previewRing.style.boxShadow =
    `0 0 ${Math.max(6, w * 2)}px ${hexAlpha(s.ringColor, 0.55)}, ` +
    `inset 0 0 0 ${Math.max(2, Math.round(w * 0.6))}px rgba(0, 0, 0, 0.25)`;

  previewKeys.style.display = s.showKeys ? '' : 'none';
  statusText.textContent = s.enabled ? 'Ring on' : 'Ring off';
}

// -- Shortcut display / recorder ------------------------------------------

const KEY_SYMBOLS = isMac
  ? { CommandOrControl: '⌘', Command: '⌘', Cmd: '⌘', Meta: '⌘', Ctrl: '⌃', Control: '⌃', Alt: '⌥', Option: '⌥', Shift: '⇧' }
  : { CommandOrControl: 'Ctrl', Command: 'Win', Cmd: 'Win', Meta: 'Win', Ctrl: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Option: 'Alt', Shift: 'Shift' };

function formatAccelerator(accelerator) {
  if (!accelerator) return 'None';
  return accelerator
    .split('+')
    .map((part) => KEY_SYMBOLS[part] ?? part)
    .join(isMac ? '' : '+');
}

// Map a KeyboardEvent to an Electron accelerator string, or null if the
// keypress doesn't yield a usable combo.
function eventToAccelerator(e) {
  const mods = [];
  if (e.metaKey) mods.push('CommandOrControl');
  else if (e.ctrlKey) mods.push('CommandOrControl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const IGNORED = new Set([
    'Meta', 'Control', 'Alt', 'Shift', 'CapsLock', 'Dead',
    'Fn', 'FnLock', 'ContextMenu',
  ]);
  if (IGNORED.has(e.key)) return null;

  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.length === 1) key = key.toUpperCase();

  // Require at least one modifier to avoid catching bare letter presses.
  if (mods.length === 0) return null;
  return [...mods, key].join('+');
}

let recording = false;

function startRecording() {
  if (recording) return;
  recording = true;
  shortcutBtn.classList.add('recording');
  shortcutLabel.textContent = 'Press keys…';
}

function stopRecording(newAccelerator) {
  recording = false;
  shortcutBtn.classList.remove('recording');
  if (newAccelerator !== undefined) {
    window.bridge.setSetting('toggleShortcut', newAccelerator);
    shortcutLabel.textContent = formatAccelerator(newAccelerator);
  }
}

shortcutBtn.addEventListener('click', () => {
  if (recording) stopRecording();
  else startRecording();
});

// -- Full-state UI wiring --------------------------------------------------

function applySettingsToUI(s) {
  $('enabled').checked = s.enabled;
  $('ringColor').value = s.ringColor;
  $('leftClickColor').value = s.leftClickColor;
  $('rightClickColor').value = s.rightClickColor;
  $('size').value = s.size;
  $('width').value = s.width;
  $('opacity').value = Math.round(s.opacity * 100);
  $('showKeys').checked = s.showKeys;
  $('launchAtLogin').checked = s.launchAtLogin;
  shortcutLabel.textContent = formatAccelerator(s.toggleShortcut);
  refreshLabels();
  updatePreview(readState());
}

async function init() {
  applySettingsToUI(await window.bridge.getSettings());
  if (!isMac) hint.classList.add('hidden');
}

const bindings = [
  ['enabled', 'change'],
  ['ringColor', 'input'],
  ['leftClickColor', 'input'],
  ['rightClickColor', 'input'],
  ['size', 'input'],
  ['width', 'input'],
  ['opacity', 'input'],
  ['showKeys', 'change'],
  ['launchAtLogin', 'change'],
];

for (const [id, evt] of bindings) {
  $(id).addEventListener(evt, () => {
    const state = readState();
    window.bridge.setSetting(id, state[id]);
    refreshLabels();
    updatePreview(state);
  });
}

$('quit').addEventListener('click', () => window.bridge.quit());
$('reset').addEventListener('click', async () => {
  const s = await window.bridge.resetSettings();
  applySettingsToUI(s);
});
$('openA11y').addEventListener('click', (e) => {
  e.preventDefault();
  window.bridge.openAccessibility();
});

const externalLinks = [
  ['openReadme', 'readme'],
  ['openIssue', 'issues'],
  ['openRepo', 'repo'],
];
for (const [id, key] of externalLinks) {
  $(id).addEventListener('click', (e) => {
    e.preventDefault();
    window.bridge.openExternal(key);
  });
}

document.addEventListener('keydown', (e) => {
  if (recording) {
    e.preventDefault();
    if (e.key === 'Escape') {
      stopRecording();
      return;
    }
    const acc = eventToAccelerator(e);
    if (acc) stopRecording(acc);
    return;
  }
  if (e.key === 'Escape') window.bridge.closePopup();
});

init();
