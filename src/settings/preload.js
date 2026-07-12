const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, data) => cb(data)),
  quit: () => ipcRenderer.send('quit-app'),
  closePopup: () => ipcRenderer.send('close-popup'),
  openAccessibility: () => ipcRenderer.send('open-accessibility-settings'),
  openExternal: (which) => ipcRenderer.send('open-external', which),
  platform: process.platform,
});
