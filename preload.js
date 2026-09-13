const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  read: (name) => ipcRenderer.invoke('data:read', name),
  write: (name, data) => ipcRenderer.invoke('data:write', name, data),
  info: () => ipcRenderer.invoke('data:info'),
  openFolder: () => ipcRenderer.invoke('data:openFolder'),
  backup: () => ipcRenderer.invoke('data:backup'),
  pickDataFolder: () => ipcRenderer.invoke('data:pickDir'),
  changeDataFolder: (p) => ipcRenderer.invoke('data:changeDir', p),
  resetDataFolder: () => ipcRenderer.invoke('data:resetDir'),
  setHotkey: (combo) => ipcRenderer.invoke('hotkey:set', combo),
  getLoginItem: () => ipcRenderer.invoke('app:getLoginItem'),
  setLoginItem: (v) => ipcRenderer.invoke('app:setLoginItem', v),
  onSummon: (cb) => ipcRenderer.on('focus-quick', cb)
});
