// Prova del multiplayer col codice partita, sui server pubblici veri (PeerJS + TURN).
// Gira su GitHub Actions: un "PC che ospita" e un "giocatore che entra", due browser separati.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
const root = new URL('..', import.meta.url).pathname;
const out = [];
const log = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };
const srv = spawn('node', [root + 'tools/server.js', '7777'], { env: { ...process.env, DERIVA_WEB: root, DERIVA_JS: root + 'js' }, stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
async function page(name) {
  const ctx = await browser.newContext({ bypassCSP: true });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') log(`[${name}] console:`, m.text().slice(0, 200)); });
  p.on('pageerror', (e) => log(`[${name}] errore:`, String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:7777/?touch=0');
  await p.waitForFunction(() => window.G && G.ready, null, { timeout: 180000 });
  await p.evaluate(() => { G.pauseLoop = true; });
  return p;
}
// 1. quali candidati si ottengono dai server STUN/TURN
const H = await page('host');
const ICE = await H.evaluate(async () => {
  const test = async (cfg, ms = 9000) => {
    const pc = new RTCPeerConnection(cfg); pc.createDataChannel('x'); const types = new Set(); const errs = [];
    pc.onicecandidate = (e) => { if (e.candidate) types.add(e.candidate.type || (e.candidate.candidate.match(/typ (\w+)/) || [])[1]); };
    pc.onicecandidateerror = (e) => errs.push(`${e.url} ${e.errorCode} ${e.errorText}`);
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((r) => { pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && r(); setTimeout(r, ms); });
    pc.close(); return { types: [...types], errs: errs.slice(0, 4) };
  };
  const r = {};
  r.google_stun = await test({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  r.peerjs_turn = await test({ iceServers: [{ urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }], iceTransportPolicy: 'relay' });
  r.openrelay_turn = await test({ iceServers: [{ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }], iceTransportPolicy: 'relay' });
  r.freestun_turn = await test({ iceServers: [{ urls: ['turn:freestun.net:3478', 'turns:freestun.net:5350'], username: 'free', credential: 'free' }], iceTransportPolicy: 'relay' });
  r.expressturn = await test({ iceServers: [{ urls: ['turn:relay1.expressturn.com:3478'], username: 'efPU52K4SLOQ34W2QY', credential: '1TJPNFxHKXrZfelz' }], iceTransportPolicy: 'relay' });
  // broker MQTT pubblici via WebSocket (per un ripiego senza TURN)
  const mq = async (url) => new Promise((res) => { const t0 = performance.now(); let w; try { w = new WebSocket(url, ['mqtt']); } catch (e) { return res('errore ' + e.message); } const to = setTimeout(() => { res('timeout'); try { w.close(); } catch (e) {} }, 8000); w.onopen = () => { clearTimeout(to); res('aperto in ' + Math.round(performance.now() - t0) + ' ms'); w.close(); }; w.onerror = () => { clearTimeout(to); res('errore'); }; });
  r.mqtt = {};
  for (const u of ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081', 'wss://mqtt.eclipseprojects.io/mqtt', 'wss://public.mqtthq.com:8084/mqtt']) r.mqtt[u] = await mq(u);
  return r;
});
log('ICE:', JSON.stringify(ICE));
// 2. server dei codici + collegamento diretto + partita vera
async function round(label, relayOnly) {
  const J = await page('entra-' + label);
  const setIce = (ro) => { if (ro) G.Relay.ICE = Object.assign({}, G.Relay.ICE, { iceTransportPolicy: 'relay' }); };
  await H.evaluate(setIce, relayOnly); await J.evaluate(setIce, relayOnly);
  const t0 = Date.now();
  const h = await H.evaluate(async () => G.Relay.code ? { ok: true, code: G.Relay.code } : await G.Relay.host(7777));
  log(`[${label}] codice:`, JSON.stringify(h), `${Date.now() - t0} ms`);
  if (!h.ok) return;
  const t1 = Date.now();
  const r = await J.evaluate(async (code) => { const c = await G.Net.connect(G.Relay.join(code), 'Prova', false); return { ok: c.ok, reason: c.reason || null, remotes: G.Net.on ? G.Net.remotes.size : -1 }; }, h.code);
  log(`[${label}] entra:`, JSON.stringify(r), `${Date.now() - t1} ms`);
  await J.close();
}
await round('diretto', false);
await round('solo-TURN', true);
fs.writeFileSync(root + 'tools/risultato.txt', out.join('\n') + '\n');
await browser.close(); srv.kill();
process.exit(0);
