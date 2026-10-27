'use strict';
/* ==========================================================
   Server multigiocatore di Deriva (WebSocket, senza dipendenze)
   - massimo 4 giocatori
   - conserva lo stato condiviso del mondo e lo inoltra a tutti
   ========================================================== */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PROTOCOL = 5;
const path = require('path');

/* logica condivisa col gioco: generazione del mondo e IA degli animali */
let G = null;
function loadShared(dir) {
  if (G) return G;
  for (const f of ['core.js', 'worldgen.js', 'pois.js', 'shared.js']) require(path.join(dir, f));
  G = globalThis.G;
  return G;
}

class Conn {
  constructor(sock, onMsg, onClose) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.frag = null; this.open = true;
    this.onMsg = onMsg; this.onClose = onClose;
    sock.setNoDelay(true);
    sock.on('data', (d) => this.onData(d));
    sock.on('close', () => this.closed());
    sock.on('error', () => this.closed());
  }
  frame(op, payload) {
    const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    let h;
    if (p.length < 126) h = Buffer.from([0x80 | op, p.length]);
    else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(p.length, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
    return Buffer.concat([h, p]);
  }
  send(obj) { if (!this.open) return; try { this.sock.write(this.frame(1, typeof obj === 'string' ? obj : JSON.stringify(obj))); } catch (e) { this.closed(); } }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 32 * 1024 * 1024) { this.close(); return; }
      const mk = masked ? this.buf.subarray(off, off + 4) : null; if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = Buffer.from(this.buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) payload[i] ^= mk[i & 3];
      this.buf = this.buf.subarray(off + len);
      if (op === 0x8) { this.close(); return; }
      if (op === 0x9) { try { this.sock.write(this.frame(0xA, payload)); } catch (e) {} continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2) { if (fin) this.deliver(payload); else this.frag = [payload]; }
      else if (op === 0x0 && this.frag) { this.frag.push(payload); if (fin) { const all = Buffer.concat(this.frag); this.frag = null; this.deliver(all); } }
    }
  }
  deliver(buf) { let m; try { m = JSON.parse(buf.toString('utf8')); } catch (e) { return; } this.onMsg(m); }
  close() { if (!this.open) return; try { this.sock.write(this.frame(0x8, Buffer.alloc(0))); this.sock.end(); } catch (e) {} this.closed(); }
  closed() { if (!this.open) return; this.open = false; this.onClose(); }
}

class DerivaServer {
  constructor(opts) {
    this.port = opts.port || 7777;
    this.webDir = opts.webDir || null;
    this.ff = opts.ff !== false;
    this.max = 4;
    this.dataFile = opts.dataFile || null;
    const snap = opts.snapshot || {};
    this.world = {
      seed: snap.seed, time: snap.time || 0.3, weather: snap.weather || null, digs: snap.digs || [], wind: snap.wind || 0.6, lv: snap.lv !== undefined ? snap.lv : 4, mode: snap.mode || 'sopravvivenza', enemies: snap.enemies !== false, chests: snap.chests || {},
      removed: new Set(snap.removed || []),
      builds: new Map((snap.builds || []).map((b) => [b.id, b])),
      boats: new Map((snap.boats || []).map((b) => [b.id, b])),
    };
    this.saved = {};
    if (this.dataFile) { try { this.saved = JSON.parse(fs.readFileSync(this.dataFile, 'utf8')); } catch (e) {} }
    this.clients = new Map(); this.nextId = 1; this.hostId = null;
    // animali simulati dal server, così tutti vedono gli stessi
    this.killed = new Set(snap.killed || []);
    this.animals = new Map(); this.spawned = new Set();
    if (opts.gameJs && snap.seed !== undefined) { loadShared(opts.gameJs); G.initWorldGen(snap.seed); if (G.POI) G.POI.reset(); G.enemiesOff = snap.enemies === false; this.sim = true; }
    // animali di proprietà (allevamenti): restano sempre attivi
    if (this.sim) for (const o of snap.pets || []) { if (!o || !o.id || !G.SPECIES[o.sp]) continue; this.animals.set(o.id, Object.assign(G.newAnimalState({ id: o.id, sp: o.sp, x: o.x, z: o.z, yaw: o.yaw }), o, { pet: true })); }
    this.rebuildBoxes();
  }
  rebuildBoxes() { this.boxes = G ? [].concat(...[...this.world.builds.values()].map((p) => G.pieceBoxes(p))) : []; }
  blocks(x, y, z) {
    for (const b of this.boxes) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && y > b.y0 - 0.5 && y < b.y1) return true;
    return false;
  }
  tickAnimals(dt) {
    const ready = [...this.clients.values()].filter((c) => c.name && c.state && c.state.p);
    if (!ready.length) return;
    this.tick = (this.tick || 0) + 1;
    if (this.tick % 10 === 1) {
      // attiva i chunk vicini ai giocatori, libera quelli lontani
      const want = new Set();
      for (const c of ready) {
        const pcx = Math.floor(c.state.p[0] / G.CHUNK), pcz = Math.floor(c.state.p[2] / G.CHUNK);
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) want.add((pcx + dx) + ',' + (pcz + dz));
      }
      for (const k of want) if (!this.spawned.has(k)) {
        this.spawned.add(k);
        const [cx, cz] = k.split(',').map(Number);
        for (const s of G.animalSpawns(cx, cz)) if (!this.killed.has(s.id)) this.animals.set(s.id, G.newAnimalState(s));
      }
      for (const k of [...this.spawned]) {
        if (want.has(k)) continue;
        const [cx, cz] = k.split(',').map(Number);
        let near = false;
        for (const c of ready) { const pcx = Math.floor(c.state.p[0] / G.CHUNK), pcz = Math.floor(c.state.p[2] / G.CHUNK); if (Math.abs(pcx - cx) <= 4 && Math.abs(pcz - cz) <= 4) near = true; }
        if (near) continue;
        this.spawned.delete(k);
        for (const id of [...this.animals.keys()]) if (id.startsWith(k + ',') && !this.animals.get(id).pet) this.animals.delete(id);
      }
    }
    const blocks = (x, y, z) => this.blocks(x, y, z);
    // allevamento: chi ha cibo in mano, trappole, nascite
    const traps = [...this.world.builds.values()].filter((b) => b.t === 'trappola').map((b) => ({ id: b.id, x: b.x, z: b.z, full: false }));
    for (const a of this.animals.values()) if (a.trapped) { const t = traps.find((q) => q.id === a.trapped); if (t) t.full = true; }
    G.petCtx = { players: ready.map((c) => ({ x: c.state.p[0], z: c.state.p[2], food: c.state.h || c.state.lh || null })), traps, animals: [...this.animals.values()],
      birth: (o) => { const id = 'p:' + Math.random().toString(36).slice(2, 9); const st = G.newAnimalState({ id, sp: o.sp, x: o.x, z: o.z, scale: 0.5 }); st.age = 0; st.scale0 = 1; st.pet = true; st.breedCd = 300; this.animals.set(id, st); this.broadcast({ t: 'chat', from: 'Allevamento', text: 'È nato un cucciolo di ' + G.SPECIES[o.sp].n.toLowerCase() + '!' }); },
      event: (k, a) => { if (k === 'trap') { this.adopt(a); this.broadcast({ t: 'chat', from: 'Trappola', text: 'Trappola scattata: ' + G.SPECIES[a.sp].n.toLowerCase() + '!' }); } } };
    // predatori e pirati inseguono i giocatori vicini
    const players = ready.map((c) => ({ id: c.id, x: c.state.p[0], y: c.state.p[1], z: c.state.p[2], sw: !!c.state.sm, cr: !!c.state.cr || this.world.mode === 'creativa' }));
    for (const a of this.animals.values()) {
      const atk = G.animalStep(a, dt, blocks, players);
      if (atk) { const t = this.clients.get(atk.pid); if (t) t.conn.send({ t: 'hurt', dmg: atk.dmg, from: G.SPECIES[a.sp].n, fx: atk.dx, fz: atk.dz, enemy: 1 }); }
    }
    // ogni 10 s chi ospita riceve l'elenco degli animali di proprietà (per salvarli nel mondo)
    if (this.tick % 150 === 0 && this.hostId !== null) { const h = this.clients.get(this.hostId); if (h) h.conn.send({ t: 'pets', l: this.petList() }); }
    if (this.tick % 2 === 0) for (const c of ready) {
      const l = [];
      for (const a of this.animals.values()) {
        const dx = a.x - c.state.p[0], dz = a.z - c.state.p[2];
        if (dx * dx + dz * dz < 115 * 115) l.push([a.id, a.sp, +a.x.toFixed(2), +a.z.toFixed(2), +a.yaw.toFixed(2), +a.speed.toFixed(2), a.wool ? 1 : 0, a.hurt > 0 ? 1 : 0, +a.scale.toFixed(2), a.atkT > 0 ? 1 : 0]);
      }
      c.conn.send({ t: 'an', l });
    }
  }
  // un animale selvatico diventa di proprietà: nuovo id, non sparisce più col suo chunk
  adopt(a) {
    if (String(a.id).startsWith('p:')) return a;
    const old = a.id; this.animals.delete(old); this.killed.add(old);
    a.id = 'p:' + Math.random().toString(36).slice(2, 9); a.pet = true; if (!a.scale0) a.scale0 = a.scale;
    this.animals.set(a.id, a); return a;
  }
  petList() { return [...this.animals.values()].filter((a) => a.pet).map((a) => ({ id: a.id, sp: a.sp, x: +a.x.toFixed(2), z: +a.z.toFixed(2), yaw: +a.yaw.toFixed(2), scale: +a.scale.toFixed(2), scale0: a.scale0, age: a.age, breedCd: a.breedCd ? Math.round(a.breedCd) : 0, trapped: a.trapped || undefined, wool: a.wool, hp: a.hp, pet: true })); }
  start() {
    return new Promise((resolve, reject) => {
      this.http = http.createServer((req, res) => this.serveFile(req, res));
      this.http.on('upgrade', (req, sock) => this.upgrade(req, sock));
      this.http.on('error', reject);
      this.http.listen(this.port, '0.0.0.0', () => resolve({ port: this.port, ips: DerivaServer.lanIPs() }));
      this.saveTimer = setInterval(() => this.persist(), 20000);
      let last = Date.now();
      if (this.sim) this.simTimer = setInterval(() => { const now = Date.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now; try { this.tickAnimals(dt); } catch (e) { console.error(e); } }, 1000 / 15);
    });
  }
  // il PC che ospita serve anche il gioco: dal telefono sulla stessa Wi-Fi basta aprire http://indirizzo:porta
  serveFile(req, res) {
    const dir = this.webDir;
    if (!dir) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Deriva server'); return; }
    let u = decodeURIComponent(String(req.url || '/').split('?')[0]);
    if (u === '/' || u === '') u = '/index.html';
    const file = path.normalize(path.join(dir, u));
    if (!file.startsWith(path.normalize(dir + path.sep))) { res.writeHead(403); res.end(); return; }
    const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Non trovato'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    });
  }
  stop() {
    this.persist();
    clearInterval(this.saveTimer); clearInterval(this.simTimer);
    for (const c of this.clients.values()) c.conn.close();
    if (this.http) this.http.close();
  }
  persist() { if (!this.dataFile) return; try { fs.writeFileSync(this.dataFile, JSON.stringify(this.saved)); } catch (e) {} }
  // indirizzi di rete locale, con quelli delle schede virtuali (VirtualBox, WSL…) messi da parte
  static lanIPs() {
    const out = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || /^169\.254\./.test(a.address)) continue;
      const vpn = /tailscale|zerotier|radmin|hamachi|wireguard/i.test(name) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address);
      const virt = !vpn && /vethernet|virtualbox|vmware|hyper-v|wsl|docker|vbox|loopback|bluetooth|npcap|tap-|tun/i.test(name);
      out.push({ ip: a.address, name: vpn ? name + ', VPN' : /wi-?fi|wlan|wireless/i.test(name) ? 'Wi-Fi' : /ethernet|^eth|^en/i.test(name) ? 'cavo' : name, virt, rank: virt ? 3 : vpn ? 2 : /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address) ? 0 : 1 });
    }
    return out.sort((a, b) => a.rank - b.rank);
  }
  upgrade(req, sock) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { sock.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const id = this.nextId++;
    const client = { id, name: null, slot: -1, conn: null, local: /127\.0\.0\.1|::1/.test(sock.remoteAddress || '') };
    client.conn = new Conn(sock, (m) => this.onMessage(client, m), () => this.onClose(client));
  }
  broadcast(obj, except) { const s = JSON.stringify(obj); for (const c of this.clients.values()) if (c !== except && c.name) c.conn.send(s); }
  snapshot() {
    const w = this.world;
    return { seed: w.seed, time: w.time, weather: w.weather, digs: w.digs, pets: this.sim ? this.petList() : [], wind: w.wind, lv: w.lv, mode: w.mode, enemies: w.enemies, chests: w.chests, removed: [...w.removed], killed: [...this.killed], builds: [...w.builds.values()], boats: [...w.boats.values()] };
  }
  onMessage(c, m) {
    if (!m || typeof m.t !== 'string') return;
    if (!c.name) {
      if (m.t !== 'hello') return;
      const name = String(m.name || '').trim().slice(0, 16);
      if (m.v !== PROTOCOL) return c.conn.send({ t: 'reject', reason: 'Versione del gioco diversa da quella di chi ospita.' }), c.conn.close();
      if (!name) return c.conn.send({ t: 'reject', reason: 'Scegli un nome.' }), c.conn.close();
      if (this.clients.size >= this.max) return c.conn.send({ t: 'reject', reason: 'La partita è piena (massimo 4 giocatori).' }), c.conn.close();
      for (const o of this.clients.values()) if (o.name.toLowerCase() === name.toLowerCase()) return c.conn.send({ t: 'reject', reason: 'Il nome "' + name + '" è già in uso in questa partita.' }), c.conn.close();
      const used = new Set([...this.clients.values()].map((o) => o.slot));
      c.slot = [0, 1, 2, 3].find((s) => !used.has(s));
      c.name = name; c.state = null; c.ping = 0;
      if (m.host && c.local && this.hostId === null) this.hostId = c.id;
      this.clients.set(c.id, c);
      c.conn.send({ t: 'welcome', id: c.id, slot: c.slot, host: this.hostId === c.id, ff: this.ff, snap: this.snapshot(), you: this.saved[name.toLowerCase()] || null,
        players: [...this.clients.values()].filter((o) => o !== c).map((o) => ({ id: o.id, name: o.name, slot: o.slot, st: o.state })) });
      this.broadcast({ t: 'join', id: c.id, name: c.name, slot: c.slot }, c);
      return;
    }
    const w = this.world;
    switch (m.t) {
      case 'st': c.state = m; c.ping = m.ping || 0; m.id = c.id; this.broadcast(m, c); break;
      case 'ping': c.conn.send({ t: 'pong', c: m.c }); break;
      case 'rm': if (typeof m.id === 'string') { w.removed.add(m.id); this.broadcast({ t: 'rm', id: m.id, by: c.id }, c); } break;
      case 'badd': if (m.p && m.p.id) { w.builds.set(m.p.id, m.p); this.rebuildBoxes(); this.broadcast({ t: 'badd', p: m.p }, c); } break;
      case 'bdel': w.builds.delete(m.id); this.rebuildBoxes(); this.broadcast({ t: 'bdel', id: m.id }, c); break;
      case 'bupd': { const b = w.builds.get(m.id); if (b) { for (const k of ['open', 'inv', 'cook']) if (k in m) b[k] = m[k]; } this.broadcast(m, c); break; }
      case 'bnew': if (m.b && m.b.id) { w.boats.set(m.b.id, m.b); this.broadcast(m, c); } break;
      case 'bfill': { const b = w.boats.get(m.id); if (b && b.filled) b.filled[m.part] = true; this.broadcast(m, c); break; }
      case 'bst': { const b = w.boats.get(m.id); if (b) { b.x = m.x; b.z = m.z; b.yaw = m.yaw; } m.by = c.id; this.broadcast(m, c); break; }
      case 'bpcs': { const b = w.boats.get(m.id); if (b && Array.isArray(m.pcs) && m.pcs.length <= 400) { b.pcs = m.pcs; b.flip = m.flip || 0; b.sunk = m.sunk ? 1 : 0; } this.broadcast(m, c); break; }
      case 'bdelboat': w.boats.delete(m.id); this.broadcast(m, c); break;
      case 'binv': { const b = w.boats.get(m.id); if (b) b.inv = m.inv; this.broadcast(m, c); break; }
      case 'hit': {
        if (!this.ff) break;
        const target = this.clients.get(m.target);
        if (target) target.conn.send({ t: 'hurt', dmg: Math.max(0, Math.min(40, +m.dmg || 0)), from: c.name, fx: m.fx, fz: m.fz });
        break;
      }
      case 'ahit': {
        const a = this.animals.get(m.id); if (!a || !c.state) break;
        const r = G.animalHit(a, Math.min(25, Math.max(0, +m.dmg || 0)), c.state.p[0], c.state.p[2], c.id);
        if (r.dead) { this.animals.delete(a.id); this.killed.add(a.id); this.broadcast({ t: 'adead', id: a.id, by: c.id, drops: r.drops }); }
        break;
      }
      case 'shear': { const a = this.animals.get(m.id); if (!a) break; const n = G.animalShear(a); if (n) c.conn.send({ t: 'give', items: [['lana', n]] }); break; }
      case 'time': if (c.id === this.hostId) { w.time = m.time; w.wind = m.wind; if (m.wx) w.weather = m.wx; if (m.lv !== undefined) w.lv = m.lv; if (m.mode) w.mode = m.mode; if (m.en !== undefined) { w.enemies = !!m.en; G.enemiesOff = !m.en; } this.broadcast(m, c); } break;
      case 'pdata': this.saved[c.name.toLowerCase()] = m.data; break;
      case 'chest': if (typeof m.id === 'string' && Array.isArray(m.inv)) { w.chests[m.id] = m.inv; this.broadcast(m, c); } break;
      case 'fx': this.broadcast(m, c); break;
      // chat vocale: i messaggi per collegarsi vanno solo al giocatore indicato
      case 'vsig': { for (const o of this.clients.values()) if (o.id === m.to && o !== c) { o.conn.send({ t: 'vsig', from: c.id, d: m.d }); break; } break; }
      case 'dig': if (Array.isArray(m.s) && m.s.length === 4 && m.s.every(isFinite) && w.digs.length < 20000) { w.digs.push(m.s.map(Number)); this.broadcast({ t: 'dig', s: m.s }, c); } break;
      case 'feed': { const a = this.animals.get(m.id); if (!a || !G.BREED[a.sp]) break; const wasTrapped = !!a.trapped; this.adopt(a); const r = G.feedAnimal(a); if (r === 'love') this.broadcast({ t: 'fx', k: 'love', id: a.id }); if (wasTrapped) c.conn.send({ t: 'chat', from: 'Allevamento', text: 'Animale liberato dalla trappola: ora è tuo' }); break; }
      case 'aspawn': {
        // comandi di chi ospita: animali e nemici comparsi accanto a lui
        if (c.id !== this.hostId || !Array.isArray(m.l) || !this.sim) break;
        for (const [sp, x, z] of m.l.slice(0, 12)) {
          if (!G.SPECIES[sp] || !isFinite(x) || !isFinite(z)) continue;
          const cx = Math.floor(x / G.CHUNK), cz = Math.floor(z / G.CHUNK), id = cx + ',' + cz + ',s' + Math.random().toString(36).slice(2, 8);
          this.animals.set(id, G.newAnimalState({ id, sp, x, z, yaw: Math.random() * 6.28 }));
        }
        break;
      }
      case 'chat': this.broadcast({ t: 'chat', from: c.name, text: String(m.text || '').slice(0, 140) }); break;
    }
  }
  onClose(c) {
    if (!this.clients.has(c.id)) return;
    this.clients.delete(c.id);
    if (c.name) this.broadcast({ t: 'leave', id: c.id, name: c.name });
    if (c.id === this.hostId) this.hostId = null;
  }
}

module.exports = { DerivaServer, PROTOCOL };

// avvio da riga di comando: node server.js [porta]
if (require.main === module) {
  const port = +process.argv[2] || 7777;
  const s = new DerivaServer({ port, snapshot: { seed: 12345 }, gameJs: process.env.DERIVA_JS || path.join(__dirname, '..', 'game', 'js'), webDir: process.env.DERIVA_WEB || path.join(__dirname, '..', 'game') });
  s.start().then((r) => console.log('Server Deriva in ascolto su', r.port, r.ips.map((a) => a.ip).join(', ')));
}
