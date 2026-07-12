const { UiohookKey } = require('uiohook-napi');

// Names that are modifiers — they are rendered as symbols from the event
// flags instead of as a "main" key.
const MODIFIER_NAMES = new Set([
  'Shift',
  'ShiftRight',
  'Ctrl',
  'CtrlRight',
  'Alt',
  'AltRight',
  'Meta',
  'MetaRight',
]);

// Prettier labels for special keys (macOS-style symbols).
const OVERRIDES = {
  Space: 'Space',
  Enter: '⏎',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Escape: '⎋',
  CapsLock: '⇪',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Home: '↖',
  End: '↘',
  PageUp: '⇞',
  PageDown: '⇟',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  NumpadMultiply: 'Num *',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadDecimal: 'Num .',
  NumpadDivide: 'Num /',
};

// Build reverse map: keycode -> label
const CODE_TO_LABEL = {};
const CODE_IS_MODIFIER = new Set();

for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code !== 'number') continue;
  if (MODIFIER_NAMES.has(name)) {
    CODE_IS_MODIFIER.add(code);
    continue;
  }
  let label;
  if (OVERRIDES[name] !== undefined) label = OVERRIDES[name];
  else if (/^Numpad\d$/.test(name)) label = 'Num ' + name.slice(-1);
  else label = name; // A–Z, 0–9, F1–F24, Insert, etc.
  CODE_TO_LABEL[code] = label;
}

/**
 * Convert a uiohook keydown event into a display label like "⇧⌘4".
 * Returns modifier-only strings (e.g. "⌘") for bare modifier presses,
 * and null when nothing sensible can be shown.
 */
function eventToLabel(e) {
  const mods =
    (e.ctrlKey ? '⌃' : '') +
    (e.altKey ? '⌥' : '') +
    (e.shiftKey ? '⇧' : '') +
    (e.metaKey ? '⌘' : '');

  if (CODE_IS_MODIFIER.has(e.keycode)) {
    return mods || null; // e.g. holding just ⌘ shows "⌘"
  }

  const main = CODE_TO_LABEL[e.keycode];
  if (!main) return mods || null;
  return mods + main;
}

module.exports = { eventToLabel };
