'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qingdan', Object.freeze({
  read: () => ipcRenderer.invoke('state:read'),
  action: action => ipcRenderer.invoke('state:action', action),
  command: (name, value) => ipcRenderer.invoke('window:command', name, value),
  onState: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('state:changed', listener); return () => ipcRenderer.removeListener('state:changed', listener); },
  onFocusAdd: callback => { ipcRenderer.on('focus:add', callback); },
  onError: callback => { ipcRenderer.on('app:error', (_event, text) => callback(text)); }
}));
