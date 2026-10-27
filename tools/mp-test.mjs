// Prova del multiplayer col codice partita sui server pubblici veri.
// Gira su GitHub Actions: un "PC che ospita" (server locale + pagina) e un giocatore che entra da un altro browser.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
const root = new URL('..', import.meta.url).pathname;
const out = [];
const log = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };
const srv = spawn('node', [root + 'tools/server.js', '7777'], { env: { ...process.env, DERIVA_WEB: root, DERIVA_JS: root + 'js' }, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function page(name) {
  const ctx = await browser.newContext({ bypassCSP: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log(`[${name}] errore:`, String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:7777/?touch=0');
  await p.waitForFunction(() => window.G && G.ready, null, { timeout: 180000 });
  await p.evaluate(() => { G.pauseLoop = true; G.Relay.debug = []; });
  return p;
}
const H = await page('host');
const h = await H.evaluate(async () => await G.Relay.host(7777));
log('codice:', JSON.stringify(h), 'broker:', await H.evaluate(() => G.Relay.brokers.map((b) => b.url).join(' ')));
async function round(label, setup, code) {
  const J = await page('entra-' + label);
  if (setup) await J.evaluate(setup);
  const t1 = Date.now();
  const r = await J.evaluate(async (code) => { const s = G.Relay.join(code); const c = await G.Net.connect(s, 'Prova' + Math.floor(Math.random() * 1000), false); return { ok: c.ok, reason: c.reason || null, mode: s.mode }; }, code || h.code);
  log(`[${label}]`, JSON.stringify(r), `${Date.now() - t1} ms`);
  if (r.ok) {
    await J.evaluate(() => new Promise((res) => setTimeout(res, 6000)));
    log(`[${label}] ping:`, await J.evaluate(() => G.Net.ping + ' ms'), 'giocatori sul server:', await H.evaluate(() => G.Relay.peers.size));
  }
  log(`[${label}] traccia: ` + (await J.evaluate(() => G.Relay.debug.join(' | '))));
  await J.close();
}
if (h.ok) {
  await round('diretto');
  await round('ponte', () => { G.Relay.P2P_WAIT = 0; G.Relay.ICE = { iceServers: [] }; });
  await round('codice-sbagliato', null, 'ZZZ-ZZZ');
  log('traccia host: ' + (await H.evaluate(() => G.Relay.debug.join(' | '))));
}
fs.writeFileSync(root + 'tools/risultato.txt', out.join('\n') + '\n');
await browser.close(); srv.kill();
process.exit(0);
