'use strict';
/* ==========================================================
   Deriva — processo principale (Electron)
   ========================================================== */
const { app, BrowserWindow, ipcMain, Menu, shell, protocol, net, dialog } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const { DerivaServer } = require('./server');

// prova fotografica automatica: Deriva.exe --fototest="cartella" --preset=alta --shaders=1 --tag=nome
// (usa una cartella dati sua: non tocca i mondi né le impostazioni di chi gioca)
const argOf = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3).replace(/^"|"$/g, '') : null; };
const FT = argOf('fototest') ? { dir: argOf('fototest'), preset: argOf('preset') || 'media', shaders: argOf('shaders') === '1', tag: argOf('tag') || 'prova' } : null;
if (FT) { try { fs.mkdirSync(FT.dir, { recursive: true }); } catch (e) {} app.setPath('userData', path.join(FT.dir, '_dati_prova')); }
const userDir = app.getPath('userData');
const configFile = path.join(userDir, 'config.json');
function readConfig() { try { return JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch (e) { return {}; } }
function writeConfig(c) { try { fs.mkdirSync(userDir, { recursive: true }); fs.writeFileSync(configFile, JSON.stringify(c, null, 2)); } catch (e) {} }
const config = readConfig();

// massime prestazioni grafiche
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-gpu-rasterization');
// il tema del menu parte subito, senza aspettare un clic
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// codice partita (WebRTC): indirizzi locali veri invece dei nomi .local, così sulla stessa rete il collegamento è diretto
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
if (config.vsync === false) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

// il gioco viene servito da un protocollo interno (app://deriva/…): così le texture
// fotografiche si caricano senza i blocchi di sicurezza di file://
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const gameDir = path.join(__dirname, '..', 'game');
// aggiornamenti del gioco scaricati da «Controlla aggiornamento»: hanno la precedenza sui file originali
const updDir = path.join(app.getPath('userData'), 'aggiornamento');
const SITE = 'https://danielemazze.github.io/Deriva/';
const vnum = (v) => String(v || '0').split('.').map((n) => +n || 0).reduce((a, n, i) => a + n * Math.pow(1000, 2 - i), 0);
const readJ = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function localManifest() { const u = readJ(path.join(updDir, 'manifest.json')), b = readJ(path.join(gameDir, 'manifest.json')); return u && (!b || vnum(u.v) > vnum(b.v)) ? { m: u, upd: true } : { m: b, upd: false }; }
const useUpd = () => localManifest().upd;
function gameFile(rel) {
  if (useUpd()) { const f = path.normalize(path.join(updDir, rel)); if (f.startsWith(updDir) && fs.existsSync(f)) return f; }
  const f = path.normalize(path.join(gameDir, rel)); return f.startsWith(gameDir) ? f : null;
}
function serveGame() {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const file = gameFile(decodeURIComponent(u.pathname));
    if (!file) return new Response('no', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}
ipcMain.handle('upd-check', async () => {
  try {
    const r = await net.fetch(SITE + 'version.json?t=' + Date.now()); const v = await r.json();
    const cur = (localManifest().m || {}).v || app.getVersion();
    return { ok: true, cur, v: v.v, name: v.name, newer: vnum(v.v) > vnum(cur), exe: vnum(v.exe) > vnum(app.getVersion()) };
  } catch (e) { return { ok: false, err: String(e) }; }
});
ipcMain.handle('upd-apply', async (ev) => {
  try {
    const rm = await (await net.fetch(SITE + 'manifest.json?t=' + Date.now())).json();
    const lm = localManifest(), have = new Map(((lm.m && lm.m.files) || []).map((f) => [f[0], f[2]]));
    const crypto = require('crypto');
    const sha = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); } catch (e) { return null; } };
    // da scaricare: i file diversi; la cartella js/ viene tenuta completa (serve al server delle partite)
    const todo = rm.files.filter((f) => have.get(f[0]) !== f[2] || (f[0].startsWith('js/') && !fs.existsSync(path.join(updDir, f[0])) && sha(path.join(gameDir, f[0])) !== f[2]));
    const total = todo.reduce((a, f) => a + f[1], 0) || 1; let done = 0;
    const tmp = updDir + '_nuovo'; fs.rmSync(tmp, { recursive: true, force: true });
    // si parte dall'aggiornamento precedente (se c'era), poi si aggiungono i file nuovi
    if (lm.upd && fs.existsSync(updDir)) fs.cpSync(updDir, tmp, { recursive: true }); else fs.mkdirSync(tmp, { recursive: true });
    for (const f of rm.files) if (f[0].startsWith('js/') && !todo.includes(f) && !fs.existsSync(path.join(tmp, f[0]))) { fs.mkdirSync(path.dirname(path.join(tmp, f[0])), { recursive: true }); fs.copyFileSync(path.join(gameDir, f[0]), path.join(tmp, f[0])); }
    for (const f of todo) {
      const r = await net.fetch(SITE + f[0].split('/').map(encodeURIComponent).join('/') + '?v=' + f[2]); if (!r.ok) throw new Error(f[0] + ': ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer()), out = path.join(tmp, f[0]);
      fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, buf);
      done += f[1]; ev.sender.send('upd-progress', { done, total, file: f[0] });
    }
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(rm));
    fs.rmSync(updDir, { recursive: true, force: true }); fs.renameSync(tmp, updDir);
    return { ok: true, v: rm.v, n: todo.length };
  } catch (e) { return { ok: false, err: String(e) }; }
});
ipcMain.handle('upd-restart', () => { if (win) win.reload(); return true; });

let win = null;
let server = null;

function createWindow() {
  win = new BrowserWindow({
    width: config.width || 1600, height: config.height || 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#0b1f27', title: 'Deriva', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'icon.png'),
    fullscreen: !!config.fullscreen,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://deriva/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('resize', () => { if (!win.isFullScreen()) { const [w, h] = win.getSize(); config.width = w; config.height = h; } });
  win.on('close', () => { config.fullscreen = win.isFullScreen(); writeConfig(config); });
  // F12 apre gli strumenti di sviluppo (utile per segnalare errori)
  win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools(); });
}

ipcMain.handle('host-start', async (e, opts) => {
  try {
    if (server) { server.stop(); server = null; }
    server = new DerivaServer({ port: opts.port, ff: opts.ff, webDir: gameDir, snapshot: opts.snapshot, gameJs: useUpd() && fs.existsSync(path.join(updDir, 'js', 'shared.js')) ? path.join(updDir, 'js') : path.join(__dirname, '..', 'game', 'js'), dataFile: path.join(worldsDir, (String(opts.worldId || 'mondo').replace(/[^a-z0-9]/gi, '') || 'mondo') + '-giocatori.json') });
    const r = await server.start();
    return { ok: true, port: r.port, ips: r.ips };
  } catch (err) {
    server = null;
    const msg = err && err.code === 'EADDRINUSE' ? 'La porta ' + opts.port + ' è già in uso: scegline un’altra.' : 'Impossibile aprire la partita: ' + (err && err.message);
    return { ok: false, error: msg };
  }
});
ipcMain.handle('host-stop', () => { if (server) { server.stop(); server = null; } return true; });
ipcMain.handle('set-fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); config.fullscreen = !!on; writeConfig(config); return true; });
ipcMain.handle('get-config', () => config);
ipcMain.handle('set-config', (e, c) => { Object.assign(config, c || {}); writeConfig(config); return config; });
ipcMain.handle('quit', () => app.quit());
// istantanee: Immagini\Deriva\Deriva_AAAA-MM-GG_hh-mm-ss.png
const shotsDir = () => path.join(app.getPath('pictures'), 'Deriva');
ipcMain.handle('save-shot', (e, dataUrl) => {
  try {
    const m = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || '')); if (!m) return { ok: false };
    fs.mkdirSync(shotsDir(), { recursive: true });
    const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
    let name = `Deriva_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`, file = path.join(shotsDir(), name + '.png');
    for (let i = 2; fs.existsSync(file); i++) file = path.join(shotsDir(), `${name}_${i}.png`);
    fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
    return { ok: true, file, dir: shotsDir() };
  } catch (err) { return { ok: false, error: String(err) }; }
});
ipcMain.on('ft-info', (e) => { e.returnValue = FT; });
ipcMain.handle('ft-shot', (e, name, dataUrl) => { try { const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(String(dataUrl || '')); if (!FT || !m) return false; fs.writeFileSync(path.join(FT.dir, String(name).replace(/[^\w.-]/g, '_') + (m[1] === 'png' ? '.png' : '.jpg')), Buffer.from(m[2], 'base64')); return true; } catch (err) { return false; } });
ipcMain.handle('ft-log', (e, text) => { try { if (FT) fs.appendFileSync(path.join(FT.dir, 'risultati.txt'), String(text) + '\r\n'); return true; } catch (err) { return false; } });
ipcMain.handle('ft-quit', () => { setTimeout(() => app.quit(), 300); return true; });
ipcMain.handle('open-shots', () => { fs.mkdirSync(shotsDir(), { recursive: true }); shell.openPath(shotsDir()); return true; });
// sblocca Deriva nel firewall di Windows (anche sulle reti "pubbliche"); chiede il permesso con UAC.
// Toglie prima le regole di blocco che Windows crea se al primo avviso si è premuto "Annulla".
ipcMain.handle('firewall', () => new Promise((resolve) => {
  if (process.platform !== 'win32') return resolve({ ok: false, error: 'Serve solo su Windows.' });
  const exe = process.execPath;
  const os = require('os');
  const bat = path.join(os.tmpdir(), 'deriva-firewall.cmd');
  const lines = ['@echo off',
    `netsh advfirewall firewall delete rule name=all program="${exe}"`,
    `netsh advfirewall firewall add rule name="Deriva" dir=in action=allow program="${exe}" enable=yes profile=any protocol=TCP`,
    `netsh advfirewall firewall add rule name="Deriva" dir=in action=allow program="${exe}" enable=yes profile=any protocol=UDP`,
    `netsh advfirewall firewall add rule name="Deriva" dir=out action=allow program="${exe}" enable=yes profile=any`,
    'exit /b 0'];
  try { fs.writeFileSync(bat, lines.join('\r\n')); } catch (e) { return resolve({ ok: false, error: 'Impossibile preparare la regola del firewall.' }); }
  const { execFile } = require('child_process');
  const ps = `try { $p = Start-Process -FilePath '${bat.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode } catch { exit 5 }`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, timeout: 120000 }, (err) => {
    try { fs.unlinkSync(bat); } catch (e) {}
    if (err) return resolve({ ok: false, error: err.code === 5 ? 'Permesso negato: premi Sì quando Windows lo chiede.' : 'Operazione annullata.' });
    config.firewall = true; writeConfig(config);
    resolve({ ok: true });
  });
}));

/* ---------- mondi ---------- */
const worldsDir = path.join(userDir, 'mondi');
const indexFile = path.join(worldsDir, 'indice.json');
const safeId = (id) => String(id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
function readIndex() { try { return JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch (e) { return []; } }
function writeIndex(l) { fs.mkdirSync(worldsDir, { recursive: true }); const tmp = indexFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(l, null, 1)); fs.renameSync(tmp, indexFile); }
ipcMain.on('w-list', (e) => { e.returnValue = readIndex(); });
ipcMain.on('w-read', (e, id) => { try { e.returnValue = fs.readFileSync(path.join(worldsDir, safeId(id) + '.json'), 'utf8'); } catch (err) { e.returnValue = null; } });
ipcMain.on('w-write', (e, id, json, meta) => {
  try {
    id = safeId(id); fs.mkdirSync(worldsDir, { recursive: true });
    const f = path.join(worldsDir, id + '.json'), tmp = f + '.tmp';
    fs.writeFileSync(tmp, json); fs.renameSync(tmp, f);
    const l = readIndex().filter((x) => x.id !== id); l.push(Object.assign({}, meta, { id })); writeIndex(l);
    e.returnValue = true;
  } catch (err) { e.returnValue = false; }
});
ipcMain.on('w-del', (e, id) => {
  id = safeId(id);
  try { fs.unlinkSync(path.join(worldsDir, id + '.json')); } catch (err) {}
  try { writeIndex(readIndex().filter((x) => x.id !== id)); } catch (err) {}
  e.returnValue = true;
});
ipcMain.handle('w-export', async (e, name, json) => {
  const r = await dialog.showSaveDialog(win, { title: 'Esporta il mondo', defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'Mondo di Deriva', extensions: ['deriva'] }] });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(r.filePath, json); return { ok: true, path: r.filePath }; } catch (err) { return { ok: false, error: 'Impossibile scrivere il file: ' + err.message }; }
});
ipcMain.handle('w-import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Importa un mondo', properties: ['openFile'], filters: [{ name: 'Mondo di Deriva', extensions: ['deriva', 'json'] }] });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, canceled: true };
  try { return { ok: true, text: fs.readFileSync(r.filePaths[0], 'utf8') }; } catch (err) { return { ok: false, error: 'Impossibile leggere il file: ' + err.message }; }
});
ipcMain.handle('w-folder', () => { fs.mkdirSync(worldsDir, { recursive: true }); shell.openPath(worldsDir); return worldsDir; });

app.whenReady().then(() => { serveGame(); createWindow(); });
app.on('window-all-closed', () => { if (server) server.stop(); app.quit(); });
