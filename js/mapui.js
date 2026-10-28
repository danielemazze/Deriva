'use strict';
/* ==========================================================
   Mappa (M) che si disegna mentre esplori e diario (J):
   missioni, scoperte, collezione degli oggetti rari, imprese.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const MU = (G.MapUI = { tiles: new Map(), queue: [], view: { x: 0, z: 0, s: 0.5 } });
  const TP = 32; // pixel per chunk (2 m per pixel)
  const P = () => G.Player;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- esplorazione ---------------- */
  MU.track = function (dt) {
    MU.miniT = (MU.miniT || 0) - dt; if (MU.miniT <= 0) { MU.miniT = 0.12; MU.drawMini(); }
    MU.t = (MU.t || 0) - dt; if (MU.t > 0) return; MU.t = 0.5;
    const p = P(), ex = (p.explored = p.explored || new Set());
    const cx = Math.floor(p.pos.x / G.CHUNK), cz = Math.floor(p.pos.z / G.CHUNK), R = p.boat ? 3 : 2;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { if (dx * dx + dz * dz > R * R + 1) continue; const k = (cx + dx) + ',' + (cz + dz); if (!ex.has(k)) { ex.add(k); MU.queue.push(k); MU.outbox.push(k); } }
    // in multigiocatore la mappa è una sola: quello che scopri lo vedono anche gli altri
    if (G.Net && G.Net.on && (MU.sendT = (MU.sendT || 0) - 0.5) <= 0 && (MU.outbox.length || MU.discOut.length)) { MU.sendT = 2; MU.flush(); }
    // disegna qualche riquadro nuovo per volta
    for (let i = 0, n = MU.queue.length > 200 ? 20 : 4; i < n && MU.queue.length; i++) MU.tile(MU.queue.shift());
  };
  const _bw2 = [0, 0], _bw = [0, 0, 0, 0];
  MU.tile = function (k) {
    let c = MU.tiles.get(k); if (c) return c;
    const [cx, cz] = k.split(',').map(Number);
    c = document.createElement('canvas'); c.width = c.height = TP;
    const x = c.getContext('2d'), img = x.createImageData(TP, TP), d = img.data, step = G.CHUNK / TP;
    for (let j = 0; j < TP; j++) for (let i = 0; i < TP; i++) {
      const wx = cx * G.CHUNK + (i + 0.5) * step, wz = cz * G.CHUNK + (j + 0.5) * step, h = G.heightAt(wx, wz);
      let r, g, b;
      const lk = G.lakeLevelAt ? G.lakeLevelAt(wx, wz) : null;
      if (lk !== null && h < lk) { r = 60; g = 140; b = 170; }
      else if (h < 0 && G.iceAt && G.coldAt(wx, wz) > 0.55 && G.iceAt(wx, wz)) { r = 214; g = 230; b = 240; }
      else if (h < 0) { const t = Math.min(1, -h / 22); r = 70 - 50 * t; g = 170 - 110 * t; b = 180 - 70 * t; if (h > -1.2) { r += 40; g += 30; b += 10; } }
      else {
        G.biomeW(wx, wz, _bw);
        if (h < 1.8) { r = 222; g = 204; b = 156; }
        else { r = 104 - 20 * _bw[1] + 60 * _bw[2]; g = 146 - 10 * _bw[1] + 30 * _bw[2]; b = 72 - 10 * _bw[1]; r = r * (1 - _bw[0]) + 222 * _bw[0]; g = g * (1 - _bw[0]) + 196 * _bw[0]; b = b * (1 - _bw[0]) + 140 * _bw[0]; }
        if (h > 30) { const t = Math.min(1, (h - 30) / 14); r = r * (1 - t) + 140 * t; g = g * (1 - t) + 136 * t; b = b * (1 - t) + 128 * t; }
        if (h > 48) { r = g = b = 238; }
        G.biomeW2(wx, wz, _bw2);
        if (_bw2[0] > 0.3) { const t = Math.min(1, (_bw2[0] - 0.3) * 2); r = r * (1 - t) + 236 * t; g = g * (1 - t) + 240 * t; b = b * (1 - t) + 245 * t; }
        if (_bw2[1] > 0.1) { const t = Math.min(1, _bw2[1] * 1.6); r = r * (1 - t) + 62 * t; g = g * (1 - t) + 52 * t; b = b * (1 - t) + 48 * t; if (G.lavaAt(wx, wz) !== null && G.lavaAt(wx, wz) !== undefined && h < G.lavaAt(wx, wz)) { r = 240; g = 90; b = 20; } }
        const sh = (G.heightAt(wx - step, wz - step) - h) * 0.5; r += sh * 18; g += sh * 18; b += sh * 18;
      }
      const o = (j * TP + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    MU.tiles.set(k, c);
    return c;
  };
  /* ---------------- minimappa (in alto a destra) ---------------- */
  MU.drawMini = function () {
    const on = G.settings.minimap !== false && G.started && !G.UI.menu;
    let c = document.getElementById('minimap');
    if (!c) { c = document.createElement('canvas'); c.id = 'minimap'; c.className = 'minimap'; const h = document.getElementById('hud'); if (!h) return; h.appendChild(c); }
    c.hidden = !on; if (!on) return;
    const css = c.clientWidth || 150, dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(css * dpr);
    if (c.width !== W) { c.width = c.height = W; }
    const x = c.getContext('2d'), p = P(), ex = p.explored || new Set();
    const MPP = 1.6; // metri per pixel (css): la minimappa copre circa 240 m
    const k = dpr / MPP, cx = W / 2, cz = W / 2;
    x.save(); x.clearRect(0, 0, W, W);
    x.beginPath(); x.arc(cx, cz, W / 2 - 1, 0, 7); x.clip();
    x.fillStyle = '#1d3a44'; x.fillRect(0, 0, W, W);
    const R = (W / 2) / k, c0x = Math.floor((p.pos.x - R) / G.CHUNK), c1x = Math.floor((p.pos.x + R) / G.CHUNK), c0z = Math.floor((p.pos.z - R) / G.CHUNK), c1z = Math.floor((p.pos.z + R) / G.CHUNK);
    x.imageSmoothingEnabled = true;
    for (let tz = c0z; tz <= c1z; tz++) for (let tx = c0x; tx <= c1x; tx++) {
      const key = tx + ',' + tz; if (!ex.has(key)) continue;
      const t = MU.tiles.get(key); if (!t) continue;
      x.drawImage(t, cx + (tx * G.CHUNK - p.pos.x) * k, cz + (tz * G.CHUNK - p.pos.z) * k, G.CHUNK * k + 0.6, G.CHUNK * k + 0.6);
    }
    // luoghi scoperti vicini
    x.font = `${Math.round(13 * dpr)}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const q of MU.knownPOIs()) { const sx = cx + (q.poi.x - p.pos.x) * k, sy = cz + (q.poi.z - p.pos.z) * k; if (Math.hypot(sx - cx, sy - cz) > W / 2 - 8 * dpr) continue; x.lineWidth = 3 * dpr; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(ICON[q.poi.type] || '•', sx, sy); x.fillStyle = q.seen ? '#f2e6c8' : '#b9b09a'; x.fillText(ICON[q.poi.type] || '•', sx, sy); }
    // le tue barche
    for (const b of G.Boats.list) { if (b.pirate) continue; const sx = cx + (b.x - p.pos.x) * k, sy = cz + (b.z - p.pos.z) * k; if (Math.hypot(sx - cx, sy - cz) > W / 2 - 6 * dpr) continue; x.fillStyle = '#c99a5a'; x.beginPath(); x.ellipse(sx, sy, 2.2 * dpr, 4.5 * dpr, -b.yaw, 0, 7); x.fill(); }
    // pericoli in mare
    if (G.Sea) for (const e of G.Sea.enc) { if (e.dead) continue; const sx = cx + (e.pos.x - p.pos.x) * k, sy = cz + (e.pos.z - p.pos.z) * k; const d = Math.hypot(sx - cx, sy - cz), m = W / 2 - 7 * dpr; const ux = d > m ? cx + (sx - cx) / d * m : sx, uy = d > m ? cz + (sy - cz) / d * m : sy; x.fillStyle = '#ff4a3a'; x.beginPath(); x.arc(ux, uy, 3.5 * dpr, 0, 7); x.fill(); }
    // gli altri giocatori (sul bordo se sono lontani)
    if (G.Net && G.Net.on) for (const r of G.Net.remotes.values()) {
      let sx = cx + (r.pos.x - p.pos.x) * k, sy = cz + (r.pos.z - p.pos.z) * k; const d = Math.hypot(sx - cx, sy - cz), m = W / 2 - 7 * dpr;
      if (d > m) { sx = cx + (sx - cx) / d * m; sy = cz + (sy - cz) / d * m; }
      x.fillStyle = G.Net.COLOR_CSS[r.slot % 4]; x.strokeStyle = '#000'; x.lineWidth = 1.5 * dpr; x.beginPath(); x.arc(sx, sy, 4.2 * dpr, 0, 7); x.fill(); x.stroke();
    }
    // tu: freccia al centro
    x.translate(cx, cz); x.rotate(-p.yaw);
    x.fillStyle = '#ff4a3a'; x.strokeStyle = '#fff'; x.lineWidth = 1.5 * dpr; x.beginPath(); x.moveTo(0, -8 * dpr); x.lineTo(5.5 * dpr, 6 * dpr); x.lineTo(0, 3 * dpr); x.lineTo(-5.5 * dpr, 6 * dpr); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // N in alto
    x.font = `600 ${Math.round(11 * dpr)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'top'; x.lineWidth = 3 * dpr; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText('N', cx, 3 * dpr); x.fillStyle = '#f2e6c8'; x.fillText('N', cx, 3 * dpr);
  };
  MU.reset = function () { MU.tiles.clear(); MU.queue = []; MU.outbox = []; MU.discOut = []; };
  MU.outbox = []; MU.discOut = [];
  MU.flush = function (all) {
    const p = P();
    const keys = all ? [...(p.explored || [])] : MU.outbox.splice(0);
    const d = {}; for (const id of all ? Object.keys(p.discovered || {}) : MU.discOut.splice(0)) d[id] = (p.discovered || {})[id] || Date.now();
    for (let i = 0; i < Math.max(1, keys.length); i += 1500) G.Net.send({ t: 'mapex', k: keys.slice(i, i + 1500), d: i === 0 ? d : {} });
  };
  // scoperte degli altri giocatori
  MU.merge = function (keys, disc) {
    const p = P(), ex = (p.explored = p.explored || new Set());
    for (const k of keys || []) if (typeof k === 'string' && !ex.has(k)) { ex.add(k); MU.queue.push(k); }
    p.discovered = p.discovered || {};
    for (const [id, t] of Object.entries(disc || {})) if (!p.discovered[id]) p.discovered[id] = t;
  };

  /* ---------------- luoghi noti ---------------- */
  MU.knownPOIs = function () {
    const p = P(), disc = p.discovered || {}, rev = p.revealed || {};
    const out = [];
    for (const id of new Set([...Object.keys(disc), ...Object.keys(rev)])) { const q = G.POI.byId(id); if (q) out.push({ poi: q, seen: !!disc[id] }); }
    return out;
  };
  MU.questTargets = function () {
    const out = [];
    for (const q of P().quests || []) {
      const t = q.to ? G.POI.byId(q.to) : null;
      if (t) out.push({ x: t.x, z: t.z, label: q.title, q });
      const v = G.POI.byId(q.vid); if (v && (q.type === 'raccolta' || q.type === 'caccia' || q.type === 'pirati')) out.push({ x: v.x, z: v.z, label: 'Torna a ' + v.name, q, back: true });
    }
    return out;
  };
  const ICON = { village: '⌂', faro: '♜', relitto: '⚓', covo: '☠', tesoro: '✕', rovina: '⛫', miniera: '⛏', grotta: '◓', accampamento: '⛺', castello: '♚' };

  /* ---------------- pannello mappa ---------------- */
  MU.open = function () { const p = P().pos; MU.view.x = p.x; MU.view.z = p.z; G.UI.openCustom('map'); };
  MU.render = function () {
    return `<div class="mapwrap"><canvas id="mapc"></canvas>
      <div class="maplegend"><b>Mappa</b><span><i class="lg you"></i>tu</span><span>⌂ villaggio</span><span>♜ faro</span><span>⚓ relitto</span><span>☠ covo dei pirati</span><span>⛫ rovine</span><span>⛏ miniera</span><span>◓ grotta</span><span>⛺ accampamento</span><span>♚ castello</span><span class="x">✕ tesoro</span><span class="qq">◆ missione</span><small>Rotella: zoom · Trascina: sposta · ${(P().explored || new Set()).size} zone esplorate</small><button class="mini-btn" data-act="center">Centra su di me</button></div></div>`;
  };
  MU.mount = function () {
    const c = document.getElementById('mapc'); if (!c) return;
    const wrap = c.parentElement; c.width = wrap.clientWidth; c.height = wrap.clientHeight;
    let drag = null;
    c.onmousedown = (e) => { drag = { x: e.clientX, y: e.clientY, vx: MU.view.x, vz: MU.view.z }; };
    window.onmousemove = (e) => { if (!drag) return; MU.view.x = drag.vx - (e.clientX - drag.x) / MU.view.s; MU.view.z = drag.vz - (e.clientY - drag.y) / MU.view.s; MU.draw(); };
    window.onmouseup = () => { drag = null; };
    c.onwheel = (e) => { e.preventDefault(); MU.view.s = Math.max(0.06, Math.min(4, MU.view.s * (e.deltaY < 0 ? 1.25 : 0.8))); MU.draw(); };
    MU.draw();
  };
  MU.draw = function () {
    const c = document.getElementById('mapc'); if (!c) return;
    const x = c.getContext('2d'), W = c.width, H = c.height, v = MU.view, s = v.s;
    x.fillStyle = '#14262c'; x.fillRect(0, 0, W, H);
    const toS = (wx, wz) => [W / 2 + (wx - v.x) * s, H / 2 + (wz - v.z) * s];
    const ex = P().explored || new Set();
    x.imageSmoothingEnabled = s < 0.5;
    const cs = G.CHUNK * s;
    const c0x = Math.floor((v.x - W / 2 / s) / G.CHUNK), c1x = Math.floor((v.x + W / 2 / s) / G.CHUNK), c0z = Math.floor((v.z - H / 2 / s) / G.CHUNK), c1z = Math.floor((v.z + H / 2 / s) / G.CHUNK);
    let drawn = 0;
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const k = cx + ',' + cz; if (!ex.has(k)) continue;
      let t = MU.tiles.get(k); if (!t) { if (drawn++ > 120) continue; t = MU.tile(k); }
      const [sx, sy] = toS(cx * G.CHUNK, cz * G.CHUNK); x.drawImage(t, Math.floor(sx), Math.floor(sy), Math.ceil(cs) + 1, Math.ceil(cs) + 1);
    }
    // griglia leggera ogni 500 m
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1;
    for (let gx = Math.floor((v.x - W / 2 / s) / 500) * 500; gx < v.x + W / 2 / s; gx += 500) { const [sx] = toS(gx, 0); x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx, H); x.stroke(); }
    for (let gz = Math.floor((v.z - H / 2 / s) / 500) * 500; gz < v.z + H / 2 / s; gz += 500) { const [, sy] = toS(0, gz); x.beginPath(); x.moveTo(0, sy); x.lineTo(W, sy); x.stroke(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    // luoghi
    for (const { poi, seen } of MU.knownPOIs()) {
      if (poi.type === 'tesoro') continue;
      const [sx, sy] = toS(poi.x, poi.z);
      x.font = `${poi.type === 'village' ? 22 : 18}px serif`;
      x.fillStyle = seen ? (poi.type === 'covo' ? '#ffb0a0' : '#fff2cc') : 'rgba(255,242,204,0.55)';
      x.strokeStyle = 'rgba(0,0,0,0.75)'; x.lineWidth = 4; x.strokeText(ICON[poi.type], sx, sy); x.fillText(ICON[poi.type], sx, sy);
      if (s > 0.25 || poi.type === 'village') { x.font = '600 12px Signika, sans-serif'; const nm = poi.type === 'village' ? poi.name : poi.type === 'relitto' ? poi.ship : poi.name; x.strokeText(nm + (seen ? '' : ' ?'), sx, sy + 17); x.fillText(nm + (seen ? '' : ' ?'), sx, sy + 17); }
    }
    // mappe del tesoro nell'inventario
    for (const st of P().inv) if (st && st.id === 'mappa_tesoro' && st.d && !G.state.removed.has('dig:' + st.d.id)) {
      const [sx, sy] = toS(st.d.x, st.d.z); x.font = 'bold 22px serif'; x.fillStyle = '#ff5a40'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText('✕', sx, sy); x.fillText('✕', sx, sy);
    }
    // obiettivi delle missioni
    for (const t of MU.questTargets()) { const [sx, sy] = toS(t.x, t.z); x.font = 'bold 16px serif'; x.fillStyle = t.back ? '#9fe0ff' : '#ffd84a'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText('◆', sx + 14, sy - 12); x.fillText('◆', sx + 14, sy - 12); }
    // barche
    for (const b of G.Boats.list) { const [sx, sy] = toS(b.x, b.z); x.save(); x.translate(sx, sy); x.rotate(-b.yaw + Math.PI); x.fillStyle = '#c99558'; x.strokeStyle = '#2a170a'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -7); x.lineTo(4, 5); x.lineTo(-4, 5); x.closePath(); x.fill(); x.stroke(); x.restore(); }
    // altri giocatori
    if (G.Net && G.Net.on) for (const r of G.Net.remotes.values()) {
      // amici ben visibili: alone pulsante, freccia della direzione, nome e distanza su un'etichetta
      const [sx, sy] = toS(r.pos.x, r.pos.z), col = G.Net.COLOR_CSS[r.slot % 4], me = G.Player.pos, d = Math.hypot(r.pos.x - me.x, r.pos.z - me.z);
      const pulse = 14 + Math.sin(performance.now() / 260) * 4;
      x.globalAlpha = 0.35; x.fillStyle = col; x.beginPath(); x.arc(sx, sy, pulse, 0, 7); x.fill(); x.globalAlpha = 1;
      x.save(); x.translate(sx, sy); x.rotate(-(r.yaw || 0)); x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(0, -13); x.lineTo(9, 9); x.lineTo(0, 4); x.lineTo(-9, 9); x.closePath(); x.fill(); x.stroke(); x.restore();
      const lab = `${r.name} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`;
      x.font = '700 13px Signika'; const tw = x.measureText(lab).width;
      x.fillStyle = 'rgba(6,18,23,.85)'; x.fillRect(sx - tw / 2 - 7, sy - 40, tw + 14, 20); x.fillStyle = col; x.fillRect(sx - tw / 2 - 7, sy - 40, 4, 20);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(lab, sx, sy - 25);
    }
    // punto di rinascita
    if (P().spawn) { const [sx, sy] = toS(P().spawn.x, P().spawn.z); x.font = '15px serif'; x.fillStyle = '#c9f0ff'; x.fillText('⛺', sx, sy); }
    // tu
    const [px, py] = toS(P().pos.x, P().pos.z);
    x.save(); x.translate(px, py); x.rotate(-P().yaw); x.fillStyle = '#ff4a3a'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -10); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
    // scala
    const m = s > 1 ? 50 : s > 0.3 ? 200 : 1000;
    x.fillStyle = '#fff'; x.fillRect(20, H - 24, m * s, 3); x.font = '12px Signika'; x.textAlign = 'left'; x.fillText(m + ' m', 24 + m * s, H - 22);
  };

  /* ---------------- diario ---------------- */
  MU.jtab = 'missioni';
  MU.openJournal = function () { G.UI.openCustom('diario'); };
  const RARE_HINT = { bussola_oro: 'nei forzieri dei covi e dei tesori, o dal mercante di montagna', cannocchiale: 'nei relitti, dai mercanti delle cittadine coloniali, o si costruisce al banco (ferro, ossidiana e pelle)', vela_leggendaria: 'nei tesori sepolti', pinne: 'nei relitti, o dal mercante della giungla', lanterna: 'in cima ai fari', pistola_capitano: 'la porta il capitano dei pirati' };
  MU.renderJournal = function () {
    const p = P(), tabs = [['missioni', 'Missioni'], ['scoperte', 'Scoperte'], ['collezione', 'Collezione'], ['imprese', 'Imprese']];
    let body = '';
    if (MU.jtab === 'missioni') {
      const qs = p.quests || [];
      body = qs.length ? qs.map((q) => {
        const t = q.to ? G.POI.byId(q.to) : G.POI.byId(q.vid), d = t ? Math.hypot(t.x - p.pos.x, t.z - p.pos.z) : 0;
        const ready = G.Quests.isReady(q);
        const where = t ? `${Math.round(d / 10) * 10} m verso ${G.Quests.dirName(t.x - p.pos.x, t.z - p.pos.z)}` : '';
        return `<div class="qrow"><div><div class="qt"><span class="stars">${G.Quests.stars(q.stars)}</span> ${esc(q.title)}</div><div class="qd">${esc(q.desc)}</div><div class="qr">Data da ${esc(q.from)} · ${ready && q.type !== 'esplora' ? '<b>pronta: torna da chi te l’ha data</b>' : esc(where)}</div></div></div>`;
      }).join('') : '<p class="note">Nessuna missione attiva. Parla con i capivillaggio: te ne daranno di facili (★) e di difficili (★★★).</p>';
    } else if (MU.jtab === 'scoperte') {
      const known = MU.knownPOIs().filter((k) => k.seen);
      const cnt = (t) => known.filter((k) => k.poi.type === t).length;
      body = `<div class="jstats"><span>⌂ Villaggi <b>${cnt('village')}</b></span><span>♜ Fari <b>${cnt('faro')}</b></span><span>⚓ Relitti <b>${cnt('relitto')}</b></span><span>☠ Covi <b>${cnt('covo')}</b></span><span>⛫ Rovine <b>${cnt('rovina')}</b></span><span>⛏ Miniere <b>${cnt('miniera')}</b></span><span>⛺ Accampamenti <b>${cnt('accampamento')}</b></span><span>♚ Castelli <b>${cnt('castello')}</b></span><span>✕ Tesori <b>${(p.stats || {}).treasures || 0}</b></span></div>
        <div class="jlist">${known.sort((a, b) => (p.discovered[b.poi.id] || 0) - (p.discovered[a.poi.id] || 0)).map((k) => `<div>${ICON[k.poi.type]} <b>${esc(k.poi.type === 'village' ? k.poi.name : k.poi.name)}</b> <small>${k.poi.type === 'village' ? G.POI.STYLE_N[k.poi.style] + (k.poi.inhabited ? '' : ', abbandonato') : ''}</small></div>`).join('') || '<p class="note">Ancora niente. Prendi il mare!</p>'}</div>`;
    } else if (MU.jtab === 'collezione') {
      const rf = p.rareFound || {};
      body = `<p class="note">Oggetti rari trovati: <b>${Object.keys(rf).length}/${G.RARE.length}</b></p><div class="rares">${G.RARE.map((id) => `<div class="rare ${rf[id] ? 'got' : ''}"><img src="${G.icon(id)}" alt=""><div><b>${rf[id] ? esc(G.ITEMS[id].n) : '???'}</b><small>${rf[id] ? esc(G.ITEMS[id].d) : 'Si trova ' + RARE_HINT[id]}</small></div></div>`).join('')}</div>`;
    } else {
      const st = p.stats || {}, k = p.kills || {};
      const kills = Object.entries(k).filter(([sp]) => G.isHostile(sp)).map(([sp, n]) => `<span>${esc(G.SPECIES[sp].n)}: <b>${n}</b></span>`).join('') || '<span>nessuno</span>';
      body = `<div class="jstats"><span>Missioni completate <b>${st.quests || 0}</b></span><span>Tesori scavati <b>${st.treasures || 0}</b></span><span>Salti della fede <b>${st.leaps || 0}</b></span><span>Zone esplorate <b>${(p.explored || new Set()).size}</b></span></div><h4>Nemici sconfitti</h4><div class="jstats">${kills}</div>`;
    }
    return `<div class="journal"><h3>Diario di bordo</h3><div class="tabs">${tabs.map(([k, l]) => `<button data-j="${k}" class="${MU.jtab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="npbody">${body}</div></div>`;
  };
  MU.clickJournal = function (e) { const b = e.target.closest('[data-j]'); if (!b) return false; MU.jtab = b.dataset.j; G.UI.renderPanel(); return true; };
})();
