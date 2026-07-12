const ring = document.getElementById('ring');
const keys = document.getElementById('keys');

let settings = {
  ringColor: '#7be49b',
  leftClickColor: '#7be49b',
  rightClickColor: '#3f5bd9',
  size: 64,
  width: 6,
  opacity: 0.9,
  showKeys: true,
};

let pressedButton = null; // 1 = left, 2 = right
let keyTimer = null;

// --- Helpers ---------------------------------------------------------------

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function currentColor() {
  if (pressedButton === 1) return settings.leftClickColor;
  if (pressedButton === 2) return settings.rightClickColor;
  return settings.ringColor;
}

function applyRingStyle() {
  const color = currentColor();
  ring.style.width = settings.size + 'px';
  ring.style.height = settings.size + 'px';
  ring.style.border = `${settings.width}px solid ${color}`;
  ring.style.opacity = settings.opacity;
  // Soft glow + a faint darker inner edge, like the reference app.
  ring.style.boxShadow =
    `0 0 ${Math.max(6, settings.width * 2)}px ${hexToRgba(color, 0.55)}, ` +
    `inset 0 0 0 ${Math.max(2, Math.round(settings.width * 0.6))}px rgba(0, 0, 0, 0.25)`;
}

// --- Cursor tracking --------------------------------------------------------

window.bridge.onCursor(({ x, y }) => {
  ring.classList.remove('hidden');
  const half = settings.size / 2;
  ring.style.transform = `translate3d(${x - half}px, ${y - half}px, 0)`;
});

window.bridge.onCursorHide(() => {
  ring.classList.add('hidden');
});

// --- Click flash ------------------------------------------------------------

window.bridge.onMouse(({ type, button }) => {
  if (type === 'down' && (button === 1 || button === 2)) {
    pressedButton = button;
  } else if (type === 'up' && button === pressedButton) {
    pressedButton = null;
  }
  applyRingStyle();
});

// --- Keystroke display -------------------------------------------------------

window.bridge.onKey((label) => {
  if (!settings.showKeys) return;
  keys.textContent = label;
  keys.classList.add('visible');
  if (keyTimer) clearTimeout(keyTimer);
  keyTimer = setTimeout(() => keys.classList.remove('visible'), 900);
});

// --- Settings ----------------------------------------------------------------

window.bridge.onSettings((s) => {
  settings = { ...settings, ...s };
  if (!settings.showKeys) keys.classList.remove('visible');
  applyRingStyle();
});

applyRingStyle();
