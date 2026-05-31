const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crackedPulse', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),
  chooseGameRoot: () => ipcRenderer.invoke('app:choose-game-root'),
  openGameRoot: () => ipcRenderer.invoke('app:open-game-root'),
  launchGame: (nickname) => ipcRenderer.invoke('game:launch', nickname),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  onGameStopped: (callback) => ipcRenderer.on('game:stopped', callback)
});
