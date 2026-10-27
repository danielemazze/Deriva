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
    MU.t = (MU.t || 0) - dt; if (MU.t > 0) return; MU.t = 0.5;
    const p = P(), ex = (p.explored = p.explored || new Set());
    const cx = Math.floor(p.pos.x / G.CHUNK), cz = Math.floor(p.pos.z / G.CHUNK), R = p.boat ? 3 : 2;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { if (dx * dx + dz * dz > R * R + 1) continue; const k = (cx + dx) + ',' + (cz + dz); if (!ex.has(k)) { ex.add(k); MU.queue.push(k); } }
    // disegna qualche riquadro nuovo per volta
    for (let i = 0; i < 4 && MU.queue.length; i++) MU.tile(MU.queue.shift());
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
  MU.reset = function () { MU.tiles.clear(); MU.queue = []; };

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
  const ICON = { village: '⌂', faro: '♜', relitto: '⚓', covo: '☠', tesoro: '✕', rovina: '⛫', miniera: '⛏', accampamento: '⛺' };

  /* ---------------- pannello mappa ---------------- */
  MU.open = function () { const p = P().pos; MU.view.x = p.x; MU.view.z = p.z; G.UI.openCustom('map'); };
  MU.render = function () {
    return `<div class="mapwrap"><canvas id="mapc"></canvas>
      <div class="maplegend"><b>Mappa</b><span><i class="lg you"></i>tu</span><span>⌂ villaggio</span><span>♜ faro</span><span>⚓ relitto</span><span>☠ covo dei pirati</span><span>⛫ rovine</span><span>⛏ miniera</span><span>⛺ accampamento</span><span class="x">✕ tesoro</span><span class="qq">◆ missione</span><small>Rotella: zoom · Trascina: sposta · ${(P().explored || new Set()).size} zone esplorate</small><button class="mini-btn" data-act="center">Centra su di me</button></div></div>`;
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
    if (G.Net && G.Net.on) for (const r of G.Net.remotes.values()) { const [sx, sy] = toS(r.pos.x, r.pos.z); x.fillStyle = G.Net.COLOR_CSS[r.slot % 4]; x.beginPath(); x.arc(sx, sy, 5, 0, 7); x.fill(); x.font = '600 11px Signika'; x.fillStyle = '#fff'; x.fillText(r.name, sx, sy - 11); }
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
      body = `<div class="jstats"><span>⌂ Villaggi <b>${cnt('village')}</b></span><span>♜ Fari <b>${cnt('faro')}</b></span><span>⚓ Relitti <b>${cnt('relitto')}</b></span><span>☠ Covi <b>${cnt('covo')}</b></span><span>⛫ Rovine <b>${cnt('rovina')}</b></span><span>⛏ Miniere <b>${cnt('miniera')}</b></span><span>⛺ Accampamenti <b>${cnt('accampamento')}</b></span><span>✕ Tesori <b>${(p.stats || {}).treasures || 0}</b></span></div>
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
