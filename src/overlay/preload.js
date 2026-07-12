const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, data) => cb(data)),
  onCursorHide: (cb) => ipcRenderer.on('cursor-hide', () => cb()),
  onMouse: (cb) => ipcRenderer.on('mouse', (_e, data) => cb(data)),
  onKey: (cb) => ipcRenderer.on('key', (_e, data) => cb(data)),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, data) => cb(data)),
});
