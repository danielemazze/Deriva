'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deriva', {
  isApp: true,
  updCheck: () => ipcRenderer.invoke('upd-check'),
  updApply: () => ipcRenderer.invoke('upd-apply'),
  updRestart: () => ipcRenderer.invoke('upd-restart'),
  onUpdProgress: (cb) => ipcRenderer.on('upd-progress', (e, d) => cb(d)),
  platform: process.platform,
  firewall: () => ipcRenderer.invoke('firewall'),
  hostStart: (opts) => ipcRenderer.invoke('host-start', opts),
  hostStop: () => ipcRenderer.invoke('host-stop'),
  setFullscreen: (on) => ipcRenderer.invoke('set-fullscreen', on),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (c) => ipcRenderer.invoke('set-config', c),
  quit: () => ipcRenderer.invoke('quit'),
  // istantanee (F2): PNG in Immagini/Deriva
  saveShot: (dataUrl) => ipcRenderer.invoke('save-shot', dataUrl),
  openShots: () => ipcRenderer.invoke('open-shots'),
  // prova fotografica automatica (solo se avviato con --fototest)
  fotoTest: ipcRenderer.sendSync('ft-info'),
  ftShot: (name, dataUrl) => ipcRenderer.invoke('ft-shot', name, dataUrl),
  ftLog: (text) => ipcRenderer.invoke('ft-log', text),
  ftQuit: () => ipcRenderer.invoke('ft-quit'),
  // mondi salvati come file nella cartella dei dati (sincrono: serve anche alla chiusura)
  worlds: {
    list: () => ipcRenderer.sendSync('w-list'),
    read: (id) => ipcRenderer.sendSync('w-read', id),
    write: (id, json, meta) => ipcRenderer.sendSync('w-write', id, json, meta),
    remove: (id) => ipcRenderer.sendSync('w-del', id),
    exportFile: (name, json) => ipcRenderer.invoke('w-export', name, json),
    importFile: () => ipcRenderer.invoke('w-import'),
    folder: () => ipcRenderer.invoke('w-folder'),
  },
});
