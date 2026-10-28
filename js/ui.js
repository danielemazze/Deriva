'use strict';
/* ==========================================================
   Interfaccia: HUD, inventario/creazione, baule, falò, libro,
   menu, opzioni e input
   ========================================================== */
(function () {
  const G = globalThis.G;
  const $ = (id) => document.getElementById(id);
  const UI = (G.UI = { open: null, cursor: null, craft: [], craftN: 3, toastsArr: [] });
  const P = () => G.Player;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- HUD ---------------- */
  const ICONS = {
    health: '<svg viewBox="0 0 24 24"><path fill="#ec7a5c" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.5.7-1.3 2.2-2.5 4.3-2.5 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
    hunger: '<svg viewBox="0 0 24 24"><path fill="#e0b062" d="M15.5 3.5c2.8 0 5 2.2 5 5 0 3.4-3 6.2-6.5 6.2-.6 0-1.2-.1-1.7-.2l-3.6 3.6.6.6c.6.6.6 1.5 0 2.1s-1.5.6-2.1 0l-.8-.8-.8.8c-.6.6-1.5.6-2.1 0s-.6-1.5 0-2.1l.8-.8-.6-.6c-.6-.6-.6-1.5 0-2.1s1.5-.6 2.1 0l.6.6 3.6-3.6c-.1-.5-.2-1.1-.2-1.7 0-3.5 2.8-6.5 6.2-6.5z"/><path fill="#fff" opacity=".85" d="M5 18.4l.6.6M3.6 17l1.2-1.2"/></svg>',
    thirst: '<svg viewBox="0 0 24 24"><path fill="#7cc6e0" d="M12 2.5S5 10.2 5 14.6C5 18.4 8.1 21.5 12 21.5s7-3.1 7-6.9C19 10.2 12 2.5 12 2.5z"/><path fill="#fff" opacity=".5" d="M9 14.5c0 1.8 1.1 3.2 2.6 3.6-.3.6-1.9-.2-2.4-1.4-.4-.8-.4-1.5-.2-2.2z"/></svg>',
    temp: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#f0e6d6" stroke-width="2" d="M10 4.5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z"/><circle cx="12" cy="17" r="2.2" fill="#e8735a"/><path stroke="#e8735a" stroke-width="2" d="M12 9v7"/></svg>',
    oxygen: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4.5" fill="none" stroke="#e8f6fb" stroke-width="2"/><circle cx="16.5" cy="8.5" r="3" fill="none" stroke="#e8f6fb" stroke-width="2"/><circle cx="17" cy="17.5" r="2" fill="none" stroke="#e8f6fb" stroke-width="1.6"/></svg>',
  };
  const LABEL = { health: 'Salute', hunger: 'Fame', thirst: 'Sete', oxygen: 'Ossigeno', temp: 'Temperatura corporea' };
  UI.init = function () {
    const m = $('meters');
    m.innerHTML = ['health', 'hunger', 'thirst', 'temp', 'oxygen'].map((k) => `<div class="meter" data-k="${k}" title="${LABEL[k]}">${ICONS[k]}<div class="bar" role="meter" aria-label="${LABEL[k]}"><i></i></div></div>`).join('');
    UI.meterEls = {}; for (const el of m.children) UI.meterEls[el.dataset.k] = { el, bar: el.querySelector('i') };
    const hb = $('hotbar');
    hb.innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="slot" data-src="hot" data-i="${i}"><span class="key">${i + 1}</span></div>`).join('');
    // bussola
    let s = '';
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
    for (let d = 0; d <= 1080; d += 15) { const a = d % 360; const nm = names[a]; s += `<span class="${nm ? (a === 0 ? 'n' : '') : 'min'}" style="left:${d * 2}px">${nm || '·'}</span>`; }
    $('compassStrip').innerHTML = s;
    bindInput();
    UI.refreshHotbar();
  };
  UI.slotHTML = function (st, extra) {
    if (!st) return extra || '';
    return `<img src="${G.icon(st.id)}" alt="">${st.n > 1 ? `<b>${st.n}</b>` : ''}${extra || ''}`;
  };
  UI.refreshHotbar = function () {
    const hb = $('hotbar'); if (!hb) return;
    const inv = P().inv;
    [...hb.children].forEach((el, i) => { el.innerHTML = UI.slotHTML(inv[i], `<span class="key">${i + 1}</span>`); el.classList.toggle('sel', i === P().sel); });
    const lh = $('lefthand'); if (lh) { const L = P().equip ? P().equip[0] : null; lh.innerHTML = `<div class="slot">${UI.slotHTML(L)}</div><span class="lhkey">F · sinistra</span>`; lh.style.opacity = L ? 1 : 0.55; const r = hb.getBoundingClientRect(); if (r.width) lh.style.left = Math.max(6, r.left - lh.offsetWidth - 10) + 'px'; }
    const it = inv[P().sel];
    const hn = $('heldname');
    const wi0 = it ? G.weaponInfo(it.id) : null;
    const name = it ? G.ITEMS[it.id].n + (wi0 ? ` · danno ${wi0.dmg}` : '') : '';
    if (name !== UI._lastHeld) { UI._lastHeld = name; hn.textContent = name; hn.classList.add('show'); clearTimeout(UI._hnT); UI._hnT = setTimeout(() => hn.classList.remove('show'), 1800); }
    if (UI.open) UI.renderPanel();
  };
  UI.toast = function (msg, kind) {
    const box = $('toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3600);
  };
  UI.pickup = function (id, n) {
    if (n <= 0) return;
    if (G.Audio) G.Audio.pickup();
    const box = $('toasts'); const now = performance.now();
    const last = UI._lastPick;
    if (last && last.id === id && now - last.t < 1800 && last.el.isConnected) { last.n += n; last.t = now; last.el.querySelector('span').textContent = `+${last.n} ${G.ITEMS[id].n}`; return; }
    const el = document.createElement('div'); el.className = 'toast pick good';
    el.innerHTML = `<img src="${G.icon(id)}" alt=""><span>+${n} ${esc(G.ITEMS[id].n)}</span>`;
    box.appendChild(el); while (box.children.length > 5) box.firstChild.remove();
    UI._lastPick = { id, n, t: now, el };
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3200);
  };
  UI.setBoatHud = (on) => { $('boathud').hidden = !on; };
  UI.fadeSleep = function (cb) {
    const f = $('sleepfade'); f.style.opacity = 1;
    setTimeout(() => { cb(); setTimeout(() => (f.style.opacity = 0), 600); }, 1400);
  };

  const TREE_N = { oak: 'Quercia', birch: 'Betulla', pine: 'Pino', palm: 'Palma', faretra: 'Albero faretra' };
  const PIECE_HINT = { porta: 'apri / chiudi', baule: 'apri', forziere: 'apri', banco: 'crea (griglia 5×5)', falo: 'cucina', letto: 'dormi' };
  function targetHTML(tg) {
    const p = P(), held = p.held();
    if (!tg) return '';
    const k = (s) => `<kbd>${s}</kbd>`;
    if (tg.kind === 'res') {
      const r = tg.res;
      if (r.type === 'tree') {
        const max = r.sub === 'pine' ? 6 : 5;
        return `<div class="tname">${TREE_N[r.sub]}</div><div class="thint">${k('Clic sinistro')} abbatti${held && G.toolClass(held.id) === 'ascia' ? '' : ' · meglio con l’ascia'}</div><div class="thp"><i style="transform:scaleX(${Math.max(0, r.hp / max)})"></i></div>`;
      }
      if (r.type === 'rock' && r.vein) return `<div class="tname">Vena di ${{ carbone: 'carbone', ferro_grezzo: 'ferro', oro_grezzo: 'oro' }[r.ore]}</div><div class="thint">${k('Clic sinistro')} estrai${held && G.toolClass(held.id) === 'piccone' ? '' : ' · serve il piccone'}</div>`;
      if (r.type === 'rock' && r.size > 0.7 && !(held && G.toolClass(held.id) === 'piccone')) return `<div class="tname">Masso</div><div class="thint">serve il piccone</div>`;
      if (r.type === 'rock') return `<div class="tname">Roccia</div><div class="thint">${k('Clic sinistro')} estrai pietra${held && G.toolClass(held.id) === 'piccone' ? '' : ' · meglio col piccone'}</div>`;
      if (r.type === 'bush') return `<div class="tname">${r.berry ? 'Cespuglio di bacche' : 'Cespuglio'}</div><div class="thint">${k(G.useKey())} raccogli fibra, foglie${r.berry ? ' e bacche' : ''}</div>`;
      if (r.type === 'grass') return `<div class="tname">${r.flower ? 'Fiori di campo' : 'Erba alta'}</div><div class="thint">${k(G.useKey())} raccogli fibra</div>`;
      if (r.type === 'cliff') return `<div class="tname">Sperone di roccia</div><div class="thint">Troppo grande da scavare</div>`;
      if (r.type === 'wood') return r.sub === 'drift' ? `<div class="tname">Legno portato dal mare</div><div class="thint">${k(G.useKey())} raccogli bastoni</div>` : `<div class="tname">${r.sub === 'log' ? 'Tronco caduto' : 'Ceppo'}</div><div class="thint">${k('Clic sinistro')} taglia${held && G.toolClass(held.id) === 'ascia' ? '' : ' · meglio con l’ascia'}</div>`;
      if (r.type === 'plant') return `<div class="tname">${{ mush: 'Funghi', reed: 'Canne', fern: 'Felce', trop: 'Pianta tropicale', cactus: 'Cactus' }[r.sub] || 'Pianta'}</div><div class="thint">${k(G.useKey())} raccogli${r.sub === 'mush' ? ' (meglio cotti)' : r.sub === 'cactus' ? ' la polpa · meglio col coltello' : ''}</div>`;
      if (r.type === 'shell') return `<div class="tname">${r.kind === 'starfish' ? 'Stella marina' : 'Conchiglia'}</div><div class="thint">${k(G.useKey())} raccogli</div>`;
    }
    if (tg.kind === 'animal') {
      const a = tg.ent, foods = G.BREED && G.BREED[a.sp], lab = G.Pets ? G.Pets.label(a) : '';
      const feed = foods ? ` · ${k('Tasto destro')} con ${foods.map((f) => G.ITEMS[f].n.toLowerCase()).join(' o ')}: ${a.st.trapped ? 'libera dalla trappola' : 'nutri (cuccioli)'}` : '';
      return `<div class="tname">${a.def.n}${lab ? ` <small>${lab}</small>` : ''}</div><div class="thint">${a.def.peaceful ? 'Lasciala in pace: depone le uova su questa spiaggia' : `${k('Clic sinistro')} caccia${a.def.shear ? ` · ${k(G.useKey())} tosa${a.wool ? '' : ' (lana in ricrescita)'}` : ''}${feed}`}</div>`;
    }
    if (tg.kind === 'piece') {
      const pc = tg.piece; const h = PIECE_HINT[pc.t];
      const nm = G.ITEMS[pc.t] ? G.ITEMS[pc.t].n : pc.t === 'forziere' ? 'Forziere' : pc.t;
      return `<div class="tname">${nm}</div><div class="thint">${h ? `${k(G.useKey())} ${h}` : ''}${pc.gen ? '' : `${h ? ' · ' : ''}${k('Clic sinistro')} smonta`}</div>`;
    }
    if (tg.kind === 'npc') { const n = tg.npc; return `<div class="tname">${esc(n.def.name)}</div><div class="thint">${k(G.useKey())} ${n.def.role === 'mercante' ? 'commercia' : n.def.role === 'capo' ? 'missioni e voci' : n.def.role === 'locandiere' ? 'mangia e riposa' : 'parla'}</div>`; }
    if (tg.kind === 'boat' && tg.boat.free) {
      const b = tg.boat, it = p.held(), piece = it && G.FreeBoat.isPiece(it.id);
      if (b.sunk) return `<div class="tname">Barca affondata</div><div class="thint">${b.inv ? k(G.useKey()) + ' apri il baule' : ''}</div>`;
      if (b.flip) return `<div class="tname">Barca ribaltata</div><div class="thint">${k(G.useKey())} raddrizza</div>`;
      return `<div class="tname">Barca libera</div><div class="thint">${piece ? `${k(G.useKey())} monta ${esc(G.ITEMS[it.id].n.toLowerCase())} · ` : `${k(G.useKey())} sali a bordo · `}${k('Clic sinistro')} togli un pezzo</div>`;
    }
    if (tg.kind === 'boat') {
      const b = tg.boat, miss = G.Boats.missing(b);
      if (miss.length) {
        const ready = miss.filter((i) => p.count(b.parts[i].item) >= b.parts[i].n).length;
        return `<div class="tname">${b.T.n} in costruzione</div><div class="need ${ready ? 'ok' : 'no'}">${b.parts.length - miss.length}/${b.parts.length} parti montate${ready ? ` · ${ready} pronte da montare` : ''}</div><div class="thint">${k('Tasto destro')} o ${k(G.useKey())} elenco delle parti</div>`;
      }
      return `<div class="tname">${b.T.n}</div><div class="thint">${k(G.useKey())} sali a bordo${b.inv ? ` · a bordo ${k('G')} apre la stiva` : ''}</div>`;
    }
    return '';
  }

  /* ---------------- aggiornamento per frame ---------------- */
  UI.update = function (dt, t) {
    const p = P();
    const vals = { health: p.health, hunger: p.hunger, thirst: p.thirst, oxygen: p.oxygen };
    for (const k in vals) {
      const m = UI.meterEls[k]; const v = Math.round(Math.max(0, vals[k]) * 2) / 200;
      if (m._v !== v) { m._v = v; m.bar.style.transform = `scaleX(${v})`; }
      const low = vals[k] < 22; if (m._low !== low) { m._low = low; m.el.classList.toggle('low', low); }
      if (k === 'oxygen') { const h = !(p.under || p.oxygen < 99.5); if (m.el.hidden !== h) m.el.hidden = h; }
    }
    // temperatura: cosa ti scalda e cosa ti raffredda, e se ti stai scaldando o raffreddando
    { const ti = $('tempinfo'), C = G.Climate; if (ti && C && C.factors) { const b0 = p.temp === undefined ? 50 : p.temp, tr = C.trend || 0;
        const show = !G.creative() && (tr !== 0 || b0 < 42 || b0 > 58);
        const html = show ? `<b class="${tr > 0 ? 'up' : tr < 0 ? 'dn' : ''}">${tr > 0 ? '▲ ti stai scaldando' : tr < 0 ? '▼ ti stai raffreddando' : G.Climate.bodyLabel(b0)}</b>${C.factors.slice(0, 4).map(([ic, n, sg]) => `<span class="${sg > 0 ? 'w' : 'c'}">${ic} ${n}</span>`).join('')}<small>aria ${Math.round(C.felt !== undefined ? C.felt : 0)}°C</small>` : '';
        if (html !== UI._ti) { UI._ti = html; ti.innerHTML = html; ti.hidden = !show; } } }
    // temperatura corporea: la barra compare quando hai freddo o caldo (blu = freddo, rosso = caldo)
    { const m = UI.meterEls.temp, b = p.temp === undefined ? 50 : p.temp, show = !G.creative() && (b < 42 || b > 58 || (G.Climate && G.Climate.trend));
      if (m.el.hidden === show) m.el.hidden = !show;
      if (show) { const v = (Math.round(b) / 100); if (m._v !== v) { m._v = v; m.bar.style.transform = `scaleX(${Math.max(0.04, v)})`; m.el.dataset.hot = b > 50 ? 1 : 0; m.el.title = 'Temperatura corporea: ' + G.Climate.bodyLabel(b); } m.el.classList.toggle('low', b < 20 || b > 82); } }
    // bussola e orologio
    const hd = ((-p.yaw * 180) / Math.PI % 360 + 360) % 360;
    $('compassStrip').style.transform = `translateX(${150 - (hd + 360) * 2}px)`;
    // segni sulla bussola: stella della bussola d'oro, obiettivo di missione, tesoro
    if (!UI._cmT || performance.now() - UI._cmT > 250) {
      UI._cmT = performance.now();
      const marks = [];
      const bear = (x, z) => ((Math.atan2(x - p.pos.x, -(z - p.pos.z)) * 180) / Math.PI + 360) % 360;
      const gt = G.Combat.goldenTarget(); if (gt) marks.push(['★', 'gold', bear(gt.x, gt.z)]);
      const qt = G.MapUI.questTargets(); if (qt.length) { qt.sort((a, b) => Math.hypot(a.x - p.pos.x, a.z - p.pos.z) - Math.hypot(b.x - p.pos.x, b.z - p.pos.z)); marks.push(['◆', 'quest', bear(qt[0].x, qt[0].z)]); }
      const tm = p.inv.find((st) => st && st.id === 'mappa_tesoro' && st.d && !G.state.removed.has('dig:' + st.d.id)); if (tm) marks.push(['✕', 'tx', bear(tm.d.x, tm.d.z)]);
      if (G.Net && G.Net.on) for (const r of G.Net.remotes.values()) { const d = Math.hypot(r.pos.x - p.pos.x, r.pos.z - p.pos.z); marks.push(['●', 'pl', bear(r.pos.x, r.pos.z), G.Net.COLOR_CSS[r.slot % 4], `${r.name} ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`]); }
      const el = $('cmarks');
      if (el) el.innerHTML = marks.map(([c, cls, b, colr, lab]) => { let dd = ((b - hd + 540) % 360) - 180; const out = Math.abs(dd) > 72; dd = Math.max(-72, Math.min(72, dd)); if (cls === 'pl') return `<i class="cm pl ${out ? 'edge' : ''}" style="left:${150 + dd * 2}px;color:${colr}">●<b>${esc(lab)}</b></i>`; return `<i class="cm ${cls} ${out ? 'edge' : ''}" style="left:${150 + dd * 2}px">${c}</i>`; }).join('');
    }
    const hours = (G.time % 1) * 24, hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
    const nowB = performance.now(); if (!UI._bioT || nowB - UI._bioT > 500) { UI._bioT = nowB; const gh = G.heightAt(p.pos.x, p.pos.z); UI._bio = gh > 0.6 ? G.BIOME_N[G.biomeAt(p.pos.x, p.pos.z)] : gh > -3 ? 'Costa' : 'Mare aperto'; }
    const Cl = G.Climate;
    if (Cl && (!UI._wT || nowB - UI._wT > 1000)) { UI._wT = nowB; const K = Cl.KINDS[Cl.state.kind], snow = Cl.cur.snow > Cl.cur.rain && Cl.cur.snow > 0.3; UI._wx = ` · ${snow ? '❄ Neve' : K.icon + ' ' + K.n} · ${Math.round(Cl.felt !== undefined ? Cl.felt : Cl.airTemp(p.pos.x, p.pos.z, p.pos.y))}°C${G.sky.night > 0.3 ? ' · ' + Cl.PHASE_ICON[Cl.moonIndex()] + ' ' + Cl.moonName() : ''}`; }
    const ck = `Giorno ${Math.floor(G.time) + 1} · ${String(hh).padStart(2, '0')}:${String(mm - (mm % 5)).padStart(2, '0')} · ${UI._bio}${UI._wx || ''}`;
    if (ck !== UI._ck) { UI._ck = ck; $('clock').textContent = ck; }
    { const cd = $('coordhud'); if (cd) { const show = G.settings.coords !== false; const t = show ? `X ${Math.round(p.pos.x)} · Z ${Math.round(p.pos.z)}` : ''; if (t !== UI._cd) { UI._cd = t; cd.textContent = t; cd.hidden = !show; } } }
    // mirino e bersaglio
    let html = '';
    if (!UI.open && !p.placing && !UI.boatPlacing) html = targetHTML(p.target);
    if (!UI.open && p.boat && !p.helm && p.inHelmZone() && !html) html = `<div class="tname">${esc(p.boat.T.helmTxt)}</div><div class="thint"><kbd>${G.useKey()}</kbd> ${p.boat.T.oars ? 'siediti ai remi' : 'prendi il timone'}</div>`;
    if (html !== UI._tHTML) { UI._tHTML = html; $('target').innerHTML = html; }
    $('cross').classList.toggle('hot', !!p.target && !UI.open);
    // barca
    if (p.boat) {
      const b = p.boat;
      $('bspd').firstChild.nodeValue = (Math.abs(b.speed) * 1.944).toFixed(1);
      drawWind(b);
    }
    // posizionamento
    const pb = $('placebar');
    if (p.placing) {
      const held = p.held();
      if (!held || held.id !== p.placing) { UI.cancelPlace(); }
      else {
        const o = G.camera.position, d = p.lookDir(new THREE.Vector3());
        UI.placeRes = G.Build.updateGhost(p.placing, o, d);
        pb.hidden = false;
        const rot = ['pavimento', 'muro', 'muro_porta', 'muro_finestra', 'recinto', 'porta'].includes(G.pieceKind(p.placing)) ? '' : ' · <kbd>R</kbd> ruota';
        pb.innerHTML = `${esc(G.ITEMS[p.placing].n)} · <kbd>Tasto destro</kbd> posa${rot} · <kbd>Esc</kbd> annulla${UI.placeRes && !UI.placeRes.ok ? `<span class="err">${esc(UI.placeRes.reason)}</span>` : ''}`;
      }
    } else if (UI.boatPlacing) {
      const o = G.camera.position, d = p.lookDir(new THREE.Vector3());
      UI.boatRes = G.Boats.updateGhost(UI.boatPlacing, o, d);
      pb.hidden = false;
      pb.innerHTML = `Sagoma: ${esc(G.BOAT_TPL[UI.boatPlacing].n)} · mira il mare aperto · <kbd>Clic</kbd> traccia · <kbd>Esc</kbd> annulla${UI.boatRes && !UI.boatRes.ok ? '<span class="err">Serve acqua più profonda e libera</span>' : !UI.boatRes ? '<span class="err">Guarda verso il mare</span>' : ''}`;
    } else pb.hidden = true;
    if (UI.open === 'fire') UI.renderFireProgress();
    // FPS e ping
    UI._perfT = (UI._perfT || 0) - dt;
    if (UI._perfT <= 0) {
      UI._perfT = 0.5;
      const S = G.settings, el = $('perf'), mp = G.Net && G.Net.on && !G.Net.isHost;
      const parts = [];
      if (S.showFps) { const f = Math.round(G.fps); parts.push(`<b class="${f >= 50 ? '' : f >= 30 ? 'mid' : 'bad'}">${f}</b> FPS`); }
      if (mp && S.showPing !== false) { const pg = G.Net.ping; parts.push(`<b class="${pg < 80 ? '' : pg < 160 ? 'mid' : 'bad'}">${pg}</b> ms`); }
      el.hidden = !parts.length; el.innerHTML = parts.join(' · ');
      if (G.Net && G.Net.on) UI.refreshPlayers();
    }
    renderHints();
  };
  function hintList() {
    const p = P(), k = [];
    if (UI.boatPlacing) return ['Sagoma', [['Clic', 'traccia la sagoma'], ['Esc', 'annulla']]];
    if (p.placing) return ['Costruzione', [['Tasto destro', 'posa'], ['R', 'ruota'], ['Esc', 'annulla']]];
    if (p.boat) {
      const T = p.boat.T;
      if (!p.helm) return ['A bordo', [['W A S D', 'cammina sul ponte'], ...(p.inHelmZone() ? [[G.useKey(), 'guida (' + T.helmTxt.toLowerCase() + ')']] : []), ['Spazio contro la murata', 'scendi / tuffati'], ...(p.boat.inv ? [['G', 'stiva']] : [])]];
      if (T.oars) return ['Ai remi', [['A', 'remo sinistro'], ['D', 'remo destro'], ['A + D', 'insieme: avanti dritto'], ['S + remi', 'indietro'], [G.useKey(), 'lascia i remi']]];
      return ['Al timone', [['W / S', 'avanti / indietro'], ['A / D', 'timone'], ['V', 'visuale esterna'], ...(p.boat.inv ? [['G', 'stiva']] : []), [G.useKey(), 'lascia il timone']]];
    }
    const held = p.held(), id = held && held.id, d = id && G.ITEMS[id];
    if (id === 'arco') k.push(['Tieni premuto clic sinistro', 'tendi e scocca']);
    else if (id === 'pistola' || id === 'pistola_capitano') k.push(['Clic sinistro', 'spara (servono munizioni)']);
    else if (G.FreeBoat && G.FreeBoat.isPiece(id) && id !== 'torcia' && id !== 'baule') k.push(['Tasto destro', id === 'fasciame' || id === 'ponte_barca' ? 'sul mare: inizia una barca libera · su una barca: monta' : 'su una barca libera: monta']);
    else if (['pala', 'piccone'].includes(G.toolClass(id))) k.push(['Clic sinistro sul terreno', G.toolClass(id) === 'pala' ? 'scava (o scava sulla X)' : 'scava nella roccia']);
    else if (id === 'cannocchiale') { k.push([G.isTouch ? 'Guarda' : 'Tieni premuto tasto destro', 'guarda lontano']); k.push([G.isTouch ? 'Zoom' : 'Rotella', 'ingrandimento ×2–×8']); }
    const use = id === 'mappa_tesoro' ? 'leggi la mappa' : d && d.cat === 'blueprint' ? 'impara il progetto' : id === 'libro' ? 'apri il libro' : id === 'canna' ? (p.fish ? 'tira su la lenza' : 'lancia la lenza') : id === 'ciotola' ? 'raccogli acqua' : d && G.Build.isPlaceable(id) ? 'posiziona' : d && (d.food || d.water) ? 'mangia / bevi' : null;
    if (p.fly) k.push(['W A S D', 'vola'], ['Spazio / C', 'sali / scendi'], ['Spazio ×2', 'atterra']);
    else if (p.swim) k.push(['W A S D', 'nuota'], ['Spazio', 'risali'], ['C', 'immergiti']);
    else k.push(['W A S D', 'muoviti'], ['Spazio', 'salta'], ['Maiusc', 'corri']);
    if (G.creative() && !p.fly) k.push(['Spazio ×2', 'vola']);
    k.push(['Clic sinistro', 'colpisci / raccogli']);
    if (use) k.push(['Tasto destro', use]);
    const L = p.equip && p.equip[0];
    if (L && G.ITEMS[L.id].shield) k.push(['Tieni premuto tasto destro', 'para con lo scudo']);
    k.push(['E', 'inventario'], ['F', L ? 'scambia con la sinistra' : 'mano sinistra'], ['B', 'libro delle barche'], ['M · J', 'mappa · diario'], ...(G.Cmd && G.Cmd.allowed() ? [['T · K', 'comandi · strumenti']] : []), ['H', 'nascondi comandi']);
    return [p.swim ? (p.under ? 'Sott’acqua' : 'In acqua') : 'A piedi', k];
  }
  function renderHints() {
    const el = $('hints');
    const show = G.settings.hints !== false && !UI.open;
    if (!show) { if (UI._hintsH !== '') { el.innerHTML = ''; UI._hintsH = ''; el.hidden = true; } return; }
    const [title, list] = hintList();
    const h = `<div class="ht">${title}</div>` + list.map(([a, b]) => `<kbd>${a}</kbd><span>${b}</span>`).join('');
    if (h !== UI._hintsH) { UI._hintsH = h; el.innerHTML = h; el.hidden = false; }
  }
  UI.placeConfirm = function () {
    const p = P(), r = UI.placeRes;
    if (!r || !r.ok) { if (r && r.reason) UI.toast(r.reason, 'warn'); return; }
    p.take(p.placing, 1);
    const piece = G.Build.add({ t: r.t, x: r.x, y: r.y, z: r.z, rot: r.rot });
    if (G.Net && G.Net.on) G.Net.send({ t: 'badd', p: G.Build.serializeOne(piece) });
    if (r.t === 'letto') p.spawn = { x: r.x, y: r.y + 0.6, z: r.z };
    G.saveSoon();
    if (p.count(p.placing) <= 0 || !p.held() || p.held().id !== p.placing) UI.cancelPlace();
  };
  UI.cancelPlace = function () { P().placing = null; G.Build.updateGhost(null); };
  UI.startBoatPlace = function (tpl) { UI.close(); UI.boatPlacing = tpl; UI.toast('Mira il mare aperto e fai clic per tracciare la sagoma', 'good'); };
  UI.confirmBoatPlace = function () {
    const r = UI.boatRes;
    if (!r || !r.ok) { UI.toast('Qui non c’è abbastanza acqua: allontanati dalla riva', 'warn'); return; }
    const nb = G.Boats.create({ tpl: r.tpl, x: r.x, z: r.z, yaw: r.yaw });
    if (G.creative()) nb.parts.forEach((p, i) => { nb.filled[i] = true; nb.meshes[i].material = G.Boats.matFor(p); nb.meshes[i].castShadow = true; });
    if (G.Net && G.Net.on) G.Net.send({ t: 'bnew', b: G.Boats.serializeOne(nb) });
    UI.boatPlacing = null; G.Boats.updateGhost(null);
    UI.toast(G.creative() ? `${nb.T.n} pronta! Avvicinati e ${G.useHow()} per salire` : `Sagoma tracciata! Guarda la barca e ${G.useHow()}: vedrai l’elenco delle parti da montare`, 'good');
    G.saveSoon();
    if (G.Audio) G.Audio.place();
    G.saveSoon();
  };
  function drawWind(b) {
    const c = $('windc'), x = c.getContext('2d'), S = c.width, R = S / 2 - 8;
    x.clearRect(0, 0, S, S);
    x.save(); x.translate(S / 2, S / 2);
    x.strokeStyle = 'rgba(201,162,94,.5)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
    // efficienza vela attorno (vento locale: può essere diverso da zona a zona)
    const WD = G.Climate ? G.Climate.windDirAt(b.x, b.z) : G.Boats.wind.dir;
    if (b.T.sail) for (let a = 0; a < 360; a += 6) {
      const rel = (a * Math.PI) / 180; const fake = { yaw: G.Boats.wind.dir + Math.PI + rel, T: b.T };
      const f = G.Boats.windFactor({ yaw: WD - rel, x: b.x, z: b.z }) / Math.max(0.05, Math.min(1.35, G.Boats.wind.str * 1.6));
      x.strokeStyle = `rgba(147,196,125,${0.15 + f * 0.7})`; x.lineWidth = 6;
      const aa = rel - Math.PI / 2 + (b.yaw - WD);
      x.beginPath(); x.arc(0, 0, R - 8, aa - 0.05, aa + 0.05); x.stroke();
    }
    // barca (sempre verso l'alto)
    x.fillStyle = '#ecd099'; x.beginPath(); x.moveTo(0, -18); x.quadraticCurveTo(10, 0, 7, 16); x.lineTo(-7, 16); x.quadraticCurveTo(-10, 0, 0, -18); x.fill();
    // vento relativo
    const rel = WD - b.yaw;
    x.rotate(-rel + Math.PI);
    x.strokeStyle = '#7cc6e0'; x.fillStyle = '#7cc6e0'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, -R + 4); x.lineTo(0, -R + 30); x.stroke();
    x.beginPath(); x.moveTo(0, -R + 38); x.lineTo(-8, -R + 24); x.lineTo(8, -R + 24); x.fill();
    x.restore();
    x.fillStyle = '#a9bcb8'; x.font = '600 18px Signika, sans-serif'; x.textAlign = 'center'; x.fillText(b.T.sail ? 'vento' : '', S / 2, S - 4);
  }

  /* ---------------- PANNELLI ---------------- */
  function showPanel(mode) {
    UI.open = mode; $('panelWrap').hidden = false; document.exitPointerLock && document.exitPointerLock();
    UI.cancelPlace(); UI.renderPanel();
  }
  // pannelli personalizzati: dialoghi, mappa, diario, mappa del tesoro
  UI.custom = {
    npc: { render: () => G.Quests.render(), click: (e) => G.Quests.click(e), close: () => G.Quests.close() },
    map: { render: () => G.MapUI.render(), mount: () => G.MapUI.mount(), click: (e) => { if (e.target.closest('[data-act=center]')) { const p = P().pos; G.MapUI.view.x = p.x; G.MapUI.view.z = p.z; G.MapUI.draw(); return true; } return !!e.target.closest('#mapc'); }, close: () => { window.onmousemove = null; window.onmouseup = null; }, wide: true },
    diario: { render: () => G.MapUI.renderJournal(), click: (e) => G.MapUI.clickJournal(e) },
    mappa: { render: () => G.Treasure.render(), mount: () => G.Treasure.draw() },
  };
  UI.openCustom = function (mode) { showPanel(mode); };
  UI.openInventory = function (n) { UI.craftN = n || 3; UI.craft = new Array(UI.craftN * UI.craftN).fill(null); showPanel('inv'); };
  UI.openChest = function (inv, title, owner) { UI.chestInv = inv; UI.chestTitle = title; UI.chestOwner = owner || null; showPanel('chest'); };
  // invia agli altri giocatori lo stato di bauli, stive e falò
  UI.syncShared = function () {
    if (!G.Net || !G.Net.on) return;
    if (UI.open === 'chest' && UI.chestOwner) {
      if (UI.chestOwner.piece && UI.chestOwner.piece.gen) G.Net.send({ t: 'chest', id: UI.chestOwner.piece.id, inv: UI.chestInv });
      else if (UI.chestOwner.piece) G.Net.send({ t: 'bupd', id: UI.chestOwner.piece.id, inv: UI.chestInv });
      else if (UI.chestOwner.boat) G.Net.send({ t: 'binv', id: UI.chestOwner.boat.id, inv: UI.chestInv });
    } else if (UI.open === 'fire' && UI.fire) G.Net.send({ t: 'bupd', id: UI.fire.id, cook: UI.fire.cook });
  };
  UI.openFire = function (piece) { UI.fire = piece; showPanel('fire'); };
  UI.openBoatBuild = function (b) { UI.boat = b; showPanel('boat'); };
  UI.close = function () {
    if (!UI.open) return;
    if (UI.custom[UI.open] && UI.custom[UI.open].close) UI.custom[UI.open].close();
    if (UI.open === 'chest' && UI.chestOwner && UI.chestOwner.piece && UI.chestOwner.piece.gen) G.state.chests[UI.chestOwner.piece.id] = UI.chestInv;
    for (const s of UI.craft) if (s) P().give(s.id, s.n, true);
    UI.craft = [];
    if (UI.cursor) { P().give(UI.cursor.id, UI.cursor.n, true); UI.cursor = null; }
    UI.syncShared();
    $('cursorItem').hidden = true; $('tooltip').hidden = true;
    $('panelWrap').hidden = true; $('bookWrap').hidden = true;
    UI.open = null; UI.refreshHotbar(); G.saveSoon();
    G.requestLock();
  };
  function slot(src, i, st, cls) { return `<div class="slot ${cls || ''}" data-src="${src}" data-i="${i}">${UI.slotHTML(st)}</div>`; }
  function invSection() {
    const inv = P().inv;
    let main = '', hot = '';
    for (let i = 9; i < 36; i++) main += slot('inv', i, inv[i]);
    for (let i = 0; i < 9; i++) hot += slot('inv', i, inv[i], i === P().sel ? 'sel' : '');
    const eq = P().equip || [], hints = ['✋', '🧢', '🧥', '👢'], names = ['Sinistra', 'Testa', 'Corpo', 'Piedi'];
    const eqHTML = eq.map((st, i) => `<div class="eqs"><div class="slot ${st ? '' : 'empty-hint'}" data-src="equip" data-i="${i}" data-hint="${hints[i]}">${UI.slotHTML(st)}</div><label>${names[i]}</label></div>`).join('');
    const T = G.Player.tempInfo ? G.Player.tempInfo() : null;
    return `<div class="invcol"><h3>Inventario</h3><div class="grid" style="grid-template-columns:repeat(9,var(--slot))">${main}</div><div class="grid" style="grid-template-columns:repeat(9,var(--slot));margin-top:6px">${hot}</div>
      <div class="equip">${eqHTML}</div>
      <div class="hint" style="margin-top:20px">${T ? `Calore dei vestiti: <b>${T.warm}</b> · riparo dal sole: <b>${T.cool}</b> · ` : ''}F scambia l’oggetto in mano con la mano sinistra · Maiusc+clic su un vestito: lo indossi</div>
      <div class="hint">Clic: prendi/posa · Tasto destro: metà / uno · Maiusc+clic: sposta rapido · Clic su una ricetta per riempire la griglia</div></div>`;
  }
  UI.renderPanel = function () {
    const pn = $('panel'); if (!UI.open || UI.open === 'book') return;
    let html = '<button class="close-x" data-act="close" aria-label="Chiudi">×</button>';
    const cu = UI.custom[UI.open];
    pn.classList.toggle('wide', !!(cu && cu.wide));
    if (cu) { pn.style.gridTemplateColumns = 'auto'; pn.innerHTML = html + cu.render(); if (cu.mount) cu.mount(); return; }
    if (UI.open === 'inv') {
      const N = UI.craftN;
      const r = G.matchRecipe(UI.craft, N);
      let g = ''; for (let i = 0; i < N * N; i++) g += slot('craft', i, UI.craft[i]);
      const res = r ? { id: r.out, n: r.n } : null;
      html += `<div><h3>${N === 5 ? 'Banco da lavoro' : 'Creazione'}<small>griglia ${N}×${N}</small></h3><div class="craftwrap"><div class="grid" style="grid-template-columns:repeat(${N},var(--slot))">${g}</div><div class="arrow"></div>${slot('res', 0, res, 'result' + (res ? ' slot-ok' : ''))}</div>
        ${N === 3 ? '<div class="hint" style="margin-top:10px">Le parti della barca (albero, vela, remi, timone) richiedono il banco da lavoro 5×5.</div>' : ''}</div>`;
      html += invSection();
      if (G.creative()) {
        html = html.replace('</button>', '</button>' + kitBar());
        let c = ''; UI.catalog().forEach((st, i) => { c += slot('cat', i, st); });
        html += `<div><h3>Catalogo<small>modalità creativa</small></h3><div class="catalog">${c}</div><div class="hint" style="margin-top:8px">Clic: una pila in mano · Tasto destro: uno · Maiusc+clic: dritto nell’inventario</div></div>`;
      } else html += `<div><h3>Ricette</h3><input id="recq" class="recq" type="search" placeholder="Cerca una ricetta o un materiale" value="${esc(UI.recQ || '')}" autocomplete="off" spellcheck="false" aria-label="Cerca nel ricettario"><div class="reccats" id="reccats">${recCats()}</div><div class="reclist" id="reclist">${recipeList(N)}</div></div>`;
    } else if (UI.open === 'chest') {
      let g = ''; for (let i = 0; i < 27; i++) g += slot('chest', i, UI.chestInv[i]);
      html += `<div><h3>${esc(UI.chestTitle)}</h3><div class="grid" style="grid-template-columns:repeat(9,var(--slot))">${g}</div></div>` + invSection();
      pn.style.gridTemplateColumns = 'auto';
    } else if (UI.open === 'fire' && UI.fire.t === 'fornace') {
      const c = UI.fire.cook;
      html += `<div><h3>Fornace<small>fonde ferro e oro grezzi in lingotti</small></h3><div class="craftwrap"><div style="display:grid;gap:8px">${slot('firein', 0, c.in)}${slot('firefuel', 0, c.fuel)}</div><div><div class="cookbar"><i id="cookbar" style="transform:scaleX(${c.prog})"></i></div><div class="hint" style="margin-top:6px">${c.burn > 0 ? 'Brace: ancora ' + c.burn + (c.burn === 1 ? ' pezzo' : ' pezzi') : 'Spenta'}</div></div>${slot('fireout', 0, c.out, 'result')}</div>
        <div class="hint" style="margin-top:10px">In alto il minerale, in basso il combustibile: un carbone fonde 2 pezzi, un tronco 1. Ogni lingotto richiede 6 secondi.</div></div>` + invSection();
    } else if (UI.open === 'fire') {
      const c = UI.fire.cook;
      html += `<div><h3>Falò<small>cuoce carne, pesce, uova e bolle l’acqua salata</small></h3><div class="craftwrap">${slot('firein', 0, c.in)}<div><div class="cookbar"><i id="cookbar" style="transform:scaleX(${c.prog})"></i></div></div>${slot('fireout', 0, c.out, 'result')}</div>
        <div class="hint" style="margin-top:10px">Ogni pezzo richiede 5 secondi. Il falò continua a cuocere anche se chiudi questa finestra.</div></div>` + invSection();
    }
    else if (UI.open === 'boat') {
      const b = UI.boat, miss = G.Boats.missing(b);
      const rows = b.parts.map((pt, i) => {
        const have = P().count(pt.item), done = b.filled[i], ok = have >= pt.n;
        return `<div class="bpart ${done ? 'done' : ok ? 'ok' : 'no'}"><img src="${G.icon(pt.item)}" alt=""><div><b>${esc(pt.name)}</b><small>${pt.n} × ${esc(G.ITEMS[pt.item].n)}${done || G.creative() ? '' : ` · ne hai ${have}`}</small></div>${done ? '<span class="tick">Montata</span>' : `<button class="mini-btn" data-fill="${i}" ${ok ? '' : 'disabled'}>Monta</button>`}</div>`;
      }).join('');
      const can = miss.some((i) => P().count(b.parts[i].item) >= b.parts[i].n);
      html += `<div class="boatpanel"><h3>${esc(b.T.n)}<small>${b.parts.length - miss.length}/${b.parts.length} parti montate</small></h3>
        <div class="bprog"><i style="transform:scaleX(${(b.parts.length - miss.length) / b.parts.length})"></i></div>
        <div class="bparts">${rows}</div>
        <div class="bactions"><button class="mbtn primary" data-fill="all" ${can ? '' : 'disabled'}>Monta tutto il possibile</button>
        ${miss.length ? '' : '<button class="mbtn" data-act="board">Sali a bordo</button>'}</div>
        <div class="hint">Le parti si montano direttamente dall’inventario: non serve mirarle una per una.</div></div>`;
      pn.style.gridTemplateColumns = 'auto';
    }
    if (UI.open !== 'chest' && UI.open !== 'boat') pn.style.gridTemplateColumns = '';
    pn.innerHTML = html;
    renderCursor();
  };
  UI.renderFireProgress = function () { const b = $('cookbar'); if (b) b.style.transform = `scaleX(${UI.fire.cook.prog})`; };
  UI.onCookTick = function (p) { if (UI.open === 'fire' && UI.fire === p) UI.renderPanel(); };
  // categorie del ricettario
  const REC_CATS = [['tutte', 'Tutte'], ['attrezzi', 'Attrezzi'], ['armi', 'Armi'], ['costruzioni', 'Costruzioni'], ['luce', 'Luce e fuoco'], ['barche', 'Barche'], ['cibo', 'Cibo'], ['vestiti', 'Vestiti'], ['materiali', 'Materiali']];
  G.recipeCat = function (id) {
    const d = G.ITEMS[id] || {};
    if (['torcia', 'falo', 'camino', 'lanterna'].includes(id)) return 'luce';
    if (d.cat === 'weapon' || d.shield || id === 'freccia' || id === 'munizioni') return 'armi';
    if (d.cat === 'tool') return 'attrezzi';
    if (d.cat === 'place') return 'costruzioni';
    if (d.cat === 'part' || d.cat === 'hull' || d.free) return 'barche';
    if (d.cat === 'food' || id === 'ciotola') return 'cibo';
    if (d.cat === 'wear') return 'vestiti';
    return 'materiali';
  };
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ');
  function recMatch(r) {
    const cat = UI.recCat || 'tutte';
    if (cat !== 'tutte' && G.recipeCat(r.out) !== cat) return false;
    const q = norm(UI.recQ).trim(); if (!q) return true;
    if (norm(G.ITEMS[r.out].n).includes(q)) return true;
    return Object.keys(G.recipeNeeds(r)).some((id) => norm(G.ITEMS[id].n).includes(q));
  }
  function recCats() {
    const q = norm(UI.recQ).trim(), cnt = {};
    for (const r of G.RECIPES) { if (q && !(norm(G.ITEMS[r.out].n).includes(q) || Object.keys(G.recipeNeeds(r)).some((id) => norm(G.ITEMS[id].n).includes(q)))) continue; const c = G.recipeCat(r.out); cnt[c] = (cnt[c] || 0) + 1; cnt.tutte = (cnt.tutte || 0) + 1; }
    return REC_CATS.map(([k, n]) => `<button class="rcat ${(UI.recCat || 'tutte') === k ? 'on' : ''} ${cnt[k] ? '' : 'none'}" data-rcat="${k}">${n}${cnt[k] ? ` <small>${cnt[k]}</small>` : ''}</button>`).join('');
  }
  UI.refreshRecipes = function () { const l = $('reclist'), c = $('reccats'); if (l) l.innerHTML = recipeList(UI.craftN) || '<p class="hint">Nessuna ricetta trovata.</p>'; if (c) c.innerHTML = recCats(); };
  function recipeList(N) {
    const have = (id) => P().count(id) + UI.craft.reduce((s, x) => s + (x && x.id === id ? x.n : 0), 0);
    const seen = new Set();
    const list = G.RECIPES.map((r, i) => { const need = G.recipeNeeds(r); const can = Object.entries(need).every(([id, n]) => have(id) >= n); return { r, i, can, need }; })
      .filter((x) => { const k = x.r.out + x.r.rows.join(); if (seen.has(k)) return false; seen.add(k); return recMatch(x.r); })
      .sort((a, b) => (b.can && b.r.size <= N) - (a.can && a.r.size <= N) || a.r.size - b.r.size);
    return list.map(({ r, i, can, need }) => {
      const locked = r.size > N;
      const req = Object.entries(need).map(([id, n]) => `${n} ${G.ITEMS[id].n.toLowerCase()}`).join(', ');
      return `<button class="rec ${can && !locked ? 'can' : ''}" data-rec="${i}" title="${esc(req)}"><img src="${G.icon(r.out)}" alt=""><span>${esc(G.ITEMS[r.out].n)}${r.n > 1 ? ` ×${r.n}` : ''}<br><span class="n">${locked ? '<span class="lock">serve il banco 5×5</span>' : esc(req)}</span></span></button>`;
    }).join('');
  }
  function fillRecipe(idx, all) {
    const r = G.RECIPES[idx], N = UI.craftN;
    if (r.size > N) { UI.toast('Questa ricetta richiede il banco da lavoro (griglia 5×5)', 'warn'); return; }
    for (let i = 0; i < UI.craft.length; i++) if (UI.craft[i]) { P().give(UI.craft[i].id, UI.craft[i].n, true); UI.craft[i] = null; }
    const need = G.recipeNeeds(r);
    let k = Infinity; for (const id in need) k = Math.min(k, Math.floor(P().count(id) / need[id]));
    if (k < 1) { const miss = Object.entries(need).filter(([id, n]) => P().count(id) < n).map(([id, n]) => `${n - P().count(id)} ${G.ITEMS[id].n.toLowerCase()}`); UI.toast('Mancano: ' + miss.join(', '), 'warn'); UI.renderPanel(); return; }
    if (!all) k = 1;
    k = Math.min(k, 64);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const id = r.cells[y][x]; if (id) { P().take(id, k); UI.craft[y * N + x] = { id, n: k }; } }
    UI.refreshHotbar();
  }
  function doCraft(toInv) {
    const r = G.matchRecipe(UI.craft, UI.craftN); if (!r) return false;
    const out = { id: r.out, n: r.n };
    if (!toInv) {
      if (UI.cursor && (UI.cursor.id !== out.id || UI.cursor.n + out.n > G.ITEMS[out.id].stack)) return false;
      UI.cursor = UI.cursor ? { id: out.id, n: UI.cursor.n + out.n } : out;
    } else P().give(out.id, out.n, true);
    for (let i = 0; i < UI.craft.length; i++) { const s = UI.craft[i]; if (s) { s.n--; if (s.n <= 0) UI.craft[i] = null; } }
    if (G.Audio) G.Audio.craft();
    return true;
  }

  // creativa: inventario rapido a tema (tasti 1-8 con l'inventario aperto)
  const KITS = [
    ['Barche', 'fasciame', ['fasciame', 'ponte_barca', 'zavorra', 'timone', 'albero_barca', 'vela', 'remo', 'panca', 'cannone', 'progetto_canoa', 'progetto_catamarano', 'progetto_galeone', 'vela_leggendaria', 'corda', 'stoffa', 'assi', 'chiodi', 'munizioni', 'baule', 'torcia', 'cannocchiale', 'bussola_oro']],
    ['Legno', 'muro', ['pavimento', 'muro', 'muro_porta', 'muro_finestra', 'porta', 'tetto', 'scala', 'recinto', 'torcia', 'banco', 'baule', 'letto', 'falo', 'trappola', 'assi', 'tronco', 'bastone', 'chiodi', 'corda', 'ascia_ferro']],
    ['Pietra', 'muro_pietra', ['pavimento_pietra', 'muro_pietra', 'muro_porta_pietra', 'muro_finestra_pietra', 'tetto_pietra', 'scala_pietra', 'pilastro', 'porta', 'torcia', 'camino', 'fornace', 'baule', 'letto', 'banco', 'pietra', 'carbone', 'lingotto_ferro', 'piccone_ferro']],
    ['Attrezzi', 'piccone_ferro', ['piccone_ferro', 'ascia_ferro', 'pala_ferro', 'coltello', 'canna', 'cannocchiale', 'scudo', 'ciotola', 'lanterna', 'bussola_oro', 'pinne', 'mappa_tesoro', 'piccone', 'ascia', 'pala', 'cappello_lana', 'maglione_lana', 'mantello_pelle', 'stivali_pelle', 'cappello_paglia']],
    ['Armi', 'spada_ferro', ['spada_ferro', 'sciabola', 'lancia', 'arco', 'freccia', 'pistola', 'pistola_capitano', 'munizioni', 'coltello_ossidiana', 'scudo', 'cannone', 'trappola']],
    ['Luce', 'torcia', ['torcia', 'lanterna', 'falo', 'camino', 'fornace', 'carbone', 'tronco', 'letto', 'baule', 'banco']],
    ['Cibo', 'pesce_cotto', ['pesce_cotto', 'pollo_cotto', 'manzo_cotto', 'maiale_cotto', 'montone_cotto', 'coniglio_cotto', 'uovo_cotto', 'funghi_cotti', 'bacche', 'cocco', 'polpa_cactus', 'ciotola_acqua', 'canna', 'falo', 'ciotola', 'pesce_crudo', 'uovo']],
    ['Natura', 'tronco', ['tronco', 'assi', 'bastone', 'fibra', 'foglie', 'pietra', 'terra', 'carbone', 'ferro_grezzo', 'oro_grezzo', 'lingotto_ferro', 'lingotto_oro', 'ossidiana', 'lana', 'pelle', 'piume', 'conchiglia', 'perla', 'dente_squalo', 'corda', 'stoffa', 'chiodi', 'doblone']],
  ];
  UI.kit = -1;
  function kitBar() {
    return `<div class="kitbar"><span class="klbl">Inventario rapido</span>${KITS.map(([n, ic], i) => `<button class="kit ${UI.kit === i ? 'on' : ''}" data-kit="${i}" title="Riempie barra e inventario: ${n}"><kbd>${i + 1}</kbd><img src="${G.icon(ic)}" alt="">${n}</button>`).join('')}</div>`;
  }
  UI.applyKit = function (n) {
    const k = KITS[n]; if (!k || !G.creative()) return;
    const P_ = P(), ids = k[2].filter((id) => G.ITEMS[id]);
    for (let i = 0; i < P_.inv.length; i++) P_.inv[i] = null;
    ids.forEach((id, i) => { if (i < P_.inv.length) { const st = G.ITEMS[id].stack || 64; P_.inv[i] = { id, n: st }; } });
    UI.kit = n; P_.sel = 0;
    UI.refreshHotbar(); UI.renderPanel();
    if (G.Audio) G.Audio.click();
    UI.toast(`Inventario rapido: ${k[0]}`, 'good');
  };
  // catalogo della modalità creativa: un esemplare di ogni oggetto
  UI.catalog = () => UI._cat || (UI._cat = Object.keys(G.ITEMS).filter((id) => id !== 'libro').map((id) => ({ id, n: 1 })));
  function getArr(src) { return src === 'inv' || src === 'hot' ? P().inv : src === 'equip' ? P().equip : src === 'craft' ? UI.craft : src === 'chest' ? UI.chestInv : src === 'cat' ? UI.catalog() : null; }
  function slotClick(src, i, button, shift) {
    if (src === 'cat') {
      const id = UI.catalog()[i].id, stack = G.ITEMS[id].stack || 64;
      if (shift) { P().give(id, stack, true); return; }
      if (UI.cursor && UI.cursor.id !== id) { UI.cursor = null; return; } // clic sul catalogo con un oggetto in mano = buttalo
      UI.cursor = { id, n: button === 2 ? 1 : stack };
      return;
    }
    if (src === 'res') {
      if (shift) { let n = 0; while (n < 64 && doCraft(true)) n++; } else doCraft(false);
      UI.refreshHotbar(); return;
    }
    if (src === 'fireout') {
      const c = UI.fire.cook; if (!c.out) return;
      if (shift || !UI.cursor) { if (shift) P().give(c.out.id, c.out.n, true); else UI.cursor = c.out; c.out = null; }
      else if (UI.cursor.id === c.out.id) { UI.cursor.n += c.out.n; c.out = null; }
      UI.refreshHotbar(); return;
    }
    let arr, idx = i;
    if (src === 'firefuel') {
      const c = UI.fire.cook;
      if (UI.cursor && !G.SMELT_FUEL[UI.cursor.id]) { UI.toast('Qui va il combustibile: carbone o tronchi', 'warn'); return; }
      const box = [c.fuel]; handleSwap(box, 0, button, shift, 'firein'); c.fuel = box[0]; UI.refreshHotbar(); return;
    }
    if (src === 'firein') {
      const c = UI.fire.cook, smelt = UI.fire.t === 'fornace';
      if (UI.cursor && !(smelt ? G.SMELT[UI.cursor.id] : G.COOK[UI.cursor.id])) { UI.toast(smelt ? 'Nella fornace vanno ferro o oro grezzi' : 'Questo non si può cuocere', 'warn'); return; }
      arr = { 0: c.in }; const box = [c.in]; arr = box; idx = 0;
      handleSwap(box, 0, button, shift, 'firein');
      c.in = box[0]; UI.refreshHotbar(); return;
    }
    arr = getArr(src);
    // testa, corpo e piedi accettano solo i vestiti adatti
    if (src === 'equip' && idx > 0 && UI.cursor && G.ITEMS[UI.cursor.id].wear !== idx) { UI.toast(`Qui va ${['', 'un cappello', 'un maglione o un mantello', 'un paio di stivali'][idx]}`, 'warn'); return; }
    if (src === 'equip' && idx > 0 && shift) { const st = arr[idx]; if (st) { P().give(st.id, st.n, true); arr[idx] = null; UI.refreshHotbar(); } return; }
    // Maiusc+clic su un vestito nell'inventario: lo indossa
    if (shift && (src === 'inv') && arr[idx] && G.ITEMS[arr[idx].id].wear) { const w = G.ITEMS[arr[idx].id].wear, eq = P().equip; const t = eq[w]; eq[w] = arr[idx]; arr[idx] = t; UI.refreshHotbar(); return; }
    handleSwap(arr, idx, button, shift, src);
    UI.refreshHotbar();
  }
  function handleSwap(arr, i, button, shift, src) {
    const st = arr[i];
    if (shift && st && !UI.cursor) {
      // spostamento rapido
      if (src === 'chest') { const n = P().give(st.id, st.n, true); st.n -= n; if (st.n <= 0) arr[i] = null; }
      else if (src === 'craft' || src === 'firein') { P().give(st.id, st.n, true); arr[i] = null; }
      else if (UI.open === 'chest') { const n = giveTo(UI.chestInv, st.id, st.n); st.n -= n; if (st.n <= 0) arr[i] = null; }
      else if (UI.open === 'fire' && UI.fire.t === 'fornace' && (G.SMELT[st.id] || G.SMELT_FUEL[st.id])) { const c = UI.fire.cook, k = G.SMELT[st.id] ? 'in' : 'fuel'; if (!c[k]) { c[k] = st; arr[i] = null; } else if (c[k].id === st.id) { c[k].n += st.n; arr[i] = null; } }
      else if (UI.open === 'fire' && UI.fire.t !== 'fornace' && G.COOK[st.id]) { const c = UI.fire.cook; if (!c.in) { c.in = st; arr[i] = null; } else if (c.in.id === st.id) { c.in.n += st.n; arr[i] = null; } }
      else { // tra barra rapida e zaino
        const range = i < 9 ? [9, 36] : [0, 9];
        let left = st.n;
        for (let pass = 0; pass < 2 && left; pass++) for (let k = range[0]; k < range[1] && left; k++) { const d = arr[k]; if (pass === 0 && d && d.id === st.id) { const m = Math.min(G.ITEMS[st.id].stack - d.n, left); d.n += m; left -= m; } else if (pass === 1 && !d) { arr[k] = { id: st.id, n: left }; left = 0; } }
        st.n = left; if (st.n <= 0) arr[i] = null;
      }
      return;
    }
    const cur = UI.cursor;
    if (button === 2) {
      if (!cur && st) { const h = Math.ceil(st.n / 2); UI.cursor = { id: st.id, n: h }; st.n -= h; if (st.n <= 0) arr[i] = null; }
      else if (cur && (!st || (st.id === cur.id && st.n < G.ITEMS[st.id].stack))) { if (!st) arr[i] = { id: cur.id, n: 1 }; else st.n++; cur.n--; if (cur.n <= 0) UI.cursor = null; }
      return;
    }
    if (!cur && st) { UI.cursor = st; arr[i] = null; }
    else if (cur && !st) { arr[i] = cur; UI.cursor = null; }
    else if (cur && st && cur.id === st.id) { const m = Math.min(G.ITEMS[st.id].stack - st.n, cur.n); st.n += m; cur.n -= m; if (cur.n <= 0) UI.cursor = null; }
    else if (cur && st) { arr[i] = cur; UI.cursor = st; }
  }
  function giveTo(arr, id, n) {
    let left = n; const max = G.ITEMS[id].stack;
    for (const s of arr) if (s && s.id === id && left) { const m = Math.min(max - s.n, left); s.n += m; left -= m; }
    for (let k = 0; k < arr.length && left; k++) if (!arr[k]) { arr[k] = { id, n: Math.min(max, left) }; left -= arr[k].n; }
    return n - left;
  }
  function renderCursor() {
    const c = $('cursorItem');
    if (UI.cursor) { c.hidden = false; c.innerHTML = UI.slotHTML(UI.cursor); } else c.hidden = true;
  }

  /* ---------------- LIBRO ---------------- */
  UI.bookTab = 'barche'; UI.bookBoat = 'zattera';
  UI.openBook = function () { UI.open = 'book'; $('bookWrap').hidden = false; document.exitPointerLock && document.exitPointerLock(); UI.cancelPlace(); UI.renderBook(); };
  function boatSketch(cv, key) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
    x.strokeStyle = '#3a2714'; x.fillStyle = 'rgba(58,39,20,.08)'; x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round';
    const wl = H * 0.72;
    x.strokeStyle = 'rgba(58,39,20,.35)'; x.beginPath(); for (let i = 0; i <= W; i += 4) x.lineTo(i, wl + Math.sin(i * 0.12) * 2); x.stroke(); x.strokeStyle = '#3a2714';
    if (key === 'zattera') {
      for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(W * 0.5, wl - 6 - i * 0.5, W * 0.34, 5, 0, 0, 7); x.stroke(); }
      x.beginPath(); x.moveTo(W * 0.7, wl - 10); x.lineTo(W * 0.92, wl + 8); x.stroke();
      return;
    }
    if (key === 'canoa') { x.beginPath(); x.moveTo(W * 0.18, wl - 8); x.quadraticCurveTo(W * 0.5, wl + 12, W * 0.82, wl - 8); x.quadraticCurveTo(W * 0.5, wl - 2, W * 0.18, wl - 8); x.fill(); x.stroke(); x.beginPath(); x.moveTo(W * 0.35, wl - 30); x.lineTo(W * 0.62, wl + 12); x.stroke(); return; }
    if (key === 'catamarano') { for (const dy of [0, 8]) { x.beginPath(); x.moveTo(W * 0.15, wl - 4 + dy); x.quadraticCurveTo(W * 0.5, wl + 8 + dy, W * 0.85, wl - 4 + dy); x.stroke(); } x.beginPath(); x.moveTo(W * 0.52, wl - 6); x.lineTo(W * 0.52, wl - H * 0.62); x.lineTo(W * 0.3, wl - 8); x.closePath(); x.fill(); x.stroke(); return; }
    const L = key === 'galeone' ? 0.9 : key === 'veliero' ? 0.8 : key === 'barca_vela' ? 0.66 : 0.5, x0 = W * (0.5 - L / 2), x1 = W * (0.5 + L / 2);
    const hh = key === 'galeone' ? 26 : key === 'veliero' ? 20 : 13;
    x.beginPath(); x.moveTo(x0, wl - hh); x.quadraticCurveTo(W * 0.5, wl - hh + 4, x1 + 6, wl - hh - 5); x.quadraticCurveTo(x1, wl + 6, W * 0.5, wl + 8); x.quadraticCurveTo(x0 + 4, wl + 8, x0, wl - hh); x.fill(); x.stroke();
    for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(x0 + 3, wl - hh + k * hh * 0.33); x.quadraticCurveTo(W * 0.5, wl - hh + 4 + k * hh * 0.33, x1, wl - hh - 2 + k * hh * 0.4); x.stroke(); }
    if (key === 'barca_remi') { x.beginPath(); x.moveTo(W * 0.45, wl - hh); x.lineTo(W * 0.3, wl + 10); x.stroke(); }
    if (key === 'galeone') { for (const [t, sc] of [[0.72, 0.85], [0.5, 1], [0.28, 0.75]]) { const mx = x0 + (x1 - x0) * t, top = wl - hh - H * 0.58 * sc; x.beginPath(); x.moveTo(mx, wl - hh); x.lineTo(mx, top); x.stroke(); for (let k = 0; k < 2; k++) { const y0 = top + 6 + k * 22 * sc; x.fillRect(mx - 16 * sc, y0, 32 * sc, 18 * sc); x.strokeRect(mx - 16 * sc, y0, 32 * sc, 18 * sc); } } x.strokeRect(x0 + 4, wl - hh - 14, 30, 14); for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(x0 + 50 + i * 22, wl - hh + 8, 2.5, 0, 7); x.stroke(); } return; }
    const masts = key === 'veliero' ? [[0.62, 0.9], [0.4, 1]] : key === 'barca_vela' ? [[0.6, 0.9]] : [];
    for (const [t, s] of masts) {
      const mx = x0 + (x1 - x0) * t, top = wl - hh - (H * 0.62) * s;
      x.beginPath(); x.moveTo(mx, wl - hh); x.lineTo(mx, top); x.stroke();
      x.beginPath(); x.moveTo(mx - 2, top + 6); x.quadraticCurveTo(mx - 26 * s, top + 22, mx - 30 * s, wl - hh - 6); x.lineTo(mx - 2, wl - hh - 6); x.closePath(); x.fill(); x.stroke();
    }
    if (key === 'veliero') { x.strokeRect(x0 + 6, wl - hh - 12, 26, 12); }
  }
  UI.renderBook = function () {
    const tab = UI.bookTab;
    let L = `<div class="page l"><button class="close-x" data-act="close" aria-label="Chiudi">×</button><h1>Libro del costruttore</h1><div class="sub">appunti di un naufrago, isola di partenza</div>
      <div class="tabs">${['barche', 'ricette', 'guida'].map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${{ barche: 'Barche', ricette: 'Ricettario', guida: 'Guida' }[t]}</button>`).join('')}</div>`;
    let R = '<div class="page r">';
    if (tab === 'barche') {
      L += `<p><b>Barca libera</b>: niente progetto. Con il fasciame in mano mira il mare e usa il tasto destro: nasce una barca che galleggia subito. Poi aggiungi pezzi dove vuoi (fasciame, ponte, zavorra, timone, albero, vela, remi, baule): ogni pezzo pesa, e la barca si inclina verso dove pesa di più. In alto a destra vedi peso, portata e stabilità.</p><p>Scegli un progetto, poi tracciane la sagoma sul mare. Poi guarda la barca e usa il tasto destro: si apre l’elenco delle parti con i materiali che servono, e le monti con un clic.</p><div class="boatlist">` +
        Object.entries(G.BOAT_TPL).map(([k, T]) => `<button class="bcard ${k === UI.bookBoat ? 'on' : ''} ${G.Boats.unlocked(k) ? '' : 'locked'}" data-boat="${k}"><canvas width="240" height="140" data-sketch="${k}"></canvas><div><strong>${G.Boats.unlocked(k) ? '' : '🔒 '}${T.n}</strong><span>${T.d}</span></div></button>`).join('') + '</div>';
      const T = G.BOAT_TPL[UI.bookBoat], need = G.Boats.needs(UI.bookBoat), parts = G.Boats.parts(UI.bookBoat);
      const all = Object.entries(need).every(([id, n]) => P().count(id) >= n);
      R += `<h2>${T.n}</h2><div class="sub">${T.d}</div>
        <div class="stat"><span>Velocità <b>${(T.speed * 1.944).toFixed(0)} nodi</b></span><span>Lunghezza <b>${T.L.toFixed(1)} m</b></span><span>${T.sail ? 'A vela' : T.canoe ? 'A pagaia' : 'A remi'}</span></div>
        <h2 style="font-size:19px;margin-top:14px">Materiali</h2><div class="mats">` +
        Object.entries(need).map(([id, n]) => { const h = P().count(id); return `<div class="mat ${h >= n ? 'ok' : 'no'}"><img src="${G.icon(id)}" alt=""><span>${G.ITEMS[id].n}</span><em>${h} / ${n}</em></div>`; }).join('') +
        `</div><h2 style="font-size:19px">Parti della sagoma</h2><ul class="partlist">${parts.map((p) => `<li>${esc(p.name)} — ${p.n} ${G.ITEMS[p.item].n.toLowerCase()}</li>`).join('')}</ul>
        ${G.Boats.unlocked(UI.bookBoat) ? '<button class="bigbtn" data-act="placeboat">Traccia la sagoma in mare</button>' : `<p class="lockmsg">Ti manca il progetto. Cercalo nei forzieri, nei relitti, dai mercanti o come ricompensa delle missioni più difficili.</p>`}
        <p class="sub" style="margin-top:10px">${all ? 'Hai già tutto il necessario.' : 'Puoi tracciare la sagoma subito e montare le parti man mano che raccogli i materiali.'}</p>`;
    } else if (tab === 'ricette') {
      L += `<p>Disponi i materiali nella griglia come nei disegni. Le ricette grandi richiedono il <em>banco da lavoro</em>, che apre una griglia 5×5.</p><p>Nell’inventario (<em>I</em> o <em>Tab</em>) puoi anche fare clic su una ricetta per riempire la griglia in automatico.</p>`;
      const small = G.RECIPES.filter((r) => r.size === 3), big = G.RECIPES.filter((r) => r.size === 5);
      L += recCards(small.slice(0, 10));
      R += `<h2>Case e parti navali</h2><div class="sub">le ultime quattro solo al banco da lavoro 5×5</div>` + recCards(small.slice(10).concat(big));
    } else {
      L += `<h2>Sopravvivere</h2><p>Tieni d’occhio <em>fame</em> e <em>sete</em>. Le noci di cocco dissetano; con una ciotola raccogli acqua di mare e la bolli sul falò per renderla potabile.</p>
        <p>Abbatti alberi per i tronchi, trasformali in assi, raccogli fibra dall’erba alta e dai cespugli e intrecciala in corda. Le rocce danno pietra per ascia e piccone.</p>
        <p>Galline, pecore, mucche, maiali e conigli ti sfamano: cuoci la carne sul falò. Le pecore si possono tosare con <em>E</em>.</p>
        <p>Di notte accendi torce e falò, oppure dormi in un letto: salverai anche il punto di rinascita.</p>
        <h2 style="margin-top:14px">La casa</h2><p>Pavimenti, muri, porte, finestre e tetti si agganciano a una griglia di 3 metri. Posa prima il pavimento, poi i muri sui bordi e infine il tetto.</p>`;
      R += `<h2>Comandi</h2><div class="ctrl">${CONTROLS.map(([k, v]) => `<span><kbd>${k}</kbd></span><span>${v}</span>`).join('')}</div>`;
    }
    R += '</div>';
    $('bookWrap').innerHTML = `<div class="book">${L}</div>${R}</div>`;
    document.querySelectorAll('canvas[data-sketch]').forEach((c) => boatSketch(c, c.dataset.sketch));
  };
  function recCards(list) {
    return '<div class="recgrid">' + list.map((r) => {
      const N = r.size === 5 ? Math.max(r.w, r.h) : 3;
      let cells = '';
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const id = r.cells[y] && r.cells[y][x]; cells += `<div>${id ? `<img src="${G.icon(id)}" alt="">` : ''}</div>`; }
      return `<div class="rcard"><div class="mini" style="grid-template-columns:repeat(${N},20px)">${cells}</div><img src="${G.icon(r.out)}" width="32" height="32" alt=""><div class="nm">${esc(G.ITEMS[r.out].n)}${r.n > 1 ? ' ×' + r.n : ''}</div><div class="badge">${r.size === 5 ? 'banco 5×5' : 'a mano 3×3'}</div></div>`;
    }).join('') + '</div>';
  }
  const SV = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const MICO = {
    play: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
    map: SV('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'), plus: SV('<path d="M12 5v14M5 12h14"/>'),
    ppl: SV('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 14c3 0 6 1.5 6 4.5"/>'),
    gear: SV('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    kb: SV('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h1M11 10h1M15 10h1M7 14h10"/>'), exit: SV('<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'),
    eye: SV('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'), snd: SV('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 010 6"/>'),
    mic: SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'), mouse: SV('<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/>'),
    ui: SV('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/>'), globe: SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    swap: SV('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'), tools: SV('<path d="M14 6l4 4-9 9H5v-4z"/><path d="M13 7l4 4"/>'),
  };
  const CONTROLS = [['W A S D', 'muoversi · guidare la barca'], ['Maiusc', 'correre'], ['Spazio', 'saltare · risalire in acqua'], ['C', 'immergersi'], ['Clic sinistro', 'colpire, abbattere, estrarre'], ['Tasto destro', 'interagire (timone, bauli, porte, persone, salire in barca) · usare, mangiare, posare'],
    ['E · I · Tab', 'inventario, vestiti e creazione 3×3'], ['F', 'scambia l’oggetto in mano con la mano sinistra'], ['Tasto destro (scudo a sinistra)', 'parare'], ['B', 'libro del costruttore'], ['M · J', 'mappa · diario'],
    ['Piccone / pala sul terreno', 'scavare (tunnel, cantine, case nella montagna)'], ['Cibo in mano · tasto destro su un animale', 'attirarlo · nutrirlo (cuccioli)'], ['Spazio contro una barca', 'arrampicarsi a bordo'], ['G', 'stiva della barca'],
    ['T · /', 'console dei comandi (/aiuto)'], ['K', 'strumenti: ora, meteo, vento, luna, biomi, villaggi'], ['F4', 'creativa ⇄ sopravvivenza'], ['Q · Ctrl+Q', 'lascia a terra l’oggetto in mano (uno · tutta la pila)'], ['Z (tieni premuto)', 'parla nella chat vocale (se hai scelto “Tieni premuto Z”)'], ['R', 'ruotare la costruzione'], ['V', 'visuale esterna in barca'], ['1–9 · rotella', 'scegliere l’oggetto'], ['Frecce', 'girare la visuale'], ['Esc', 'pausa']];
  UI.CONTROLS = CONTROLS;

  /* ---------------- MENU ---------------- */
  const APP = () => !!window.deriva;
  UI.mpMsg = '';
  UI.showMenu = function (screen) {
    UI.menu = screen || 'main';
    $('menu').hidden = false; $('hud').hidden = true;
    $('menu').classList.toggle('wide', UI.menu === 'worlds');
    document.exitPointerLock && document.exitPointerLock();
    const side = $('menuSide'); const S = G.settings;
    const worlds = G.Worlds.list(), has = worlds.length > 0, last = worlds[0];
    const started = G.started, mp = G.Net && G.Net.on;
    const modal = UI.menu === 'settings' || UI.menu === 'controls';
    $('menu').classList.toggle('modal', modal);
    let h = modal ? '' : `<div class="mhead"><h1 class="logo">${UI.menu === 'main' && started ? 'In pausa' : 'Deriva'}</h1><div class="logo-sub">${UI.menu === 'main' && started && G.worldName ? esc(G.worldName) + ' · ' + (G.creative() ? 'Creativa' : 'Sopravvivenza') : 'sopravvivenza tra le isole'}</div></div>${started ? '' : `<div class="coords" id="coords">${G.coordsText ? G.coordsText() : ''}</div>`}`;
    const row = (m, ic, t, sub, cls) => `<button class="mrow ${cls || ''}" data-m="${m}"><span class="mic">${MICO[ic]}</span><span>${t}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
    const chip = (m, ic, t) => `<button class="mchip" data-m="${m}">${MICO[ic]}${t}</button>`;
    if (UI.menu === 'main') {
      h += '<div class="mlist">';
      if (started) {
        h += `<button class="mcont" data-m="resume"><span class="mplay">${MICO.play}</span><span>Riprendi<small>Esc</small></span></button>`;
        h += '<div class="mcap">Partita</div>';
        if (mp) h += playersHTML();
        else if (APP()) h += row('mp', 'ppl', 'Apri agli amici', 'ospita questo mondo in multigiocatore');
        if (!(G.Net && G.Net.on && !G.Net.isHost)) h += row('togglemode', 'swap', G.creative() ? 'Passa a Sopravvivenza' : 'Passa a Creativa', 'ora: ' + (G.creative() ? 'creativa' : 'sopravvivenza') + ' · F4');
        if (G.Cmd && G.Cmd.allowed()) h += row('tools', 'tools', 'Strumenti', 'orario, meteo, vento, luna, biomi · K');
        h += '<div class="mcap">Opzioni</div>' + row('settings', 'gear', 'Impostazioni', 'grafica, audio, voce, controlli') + row('controls', 'kb', 'Comandi', 'tasti e mouse');
        h += `</div><div class="mfoot">${mp ? chip('leave', 'exit', G.Net.isHost ? 'Chiudi la partita' : 'Esci dalla partita') : chip('savequit', 'exit', 'Salva e torna al titolo')}</div>`;
      } else {
        if (has) h += `<button class="mcont" data-m="continue"><span class="mplay">${MICO.play}</span><span>Continua<small>${esc(last.name)} · ${G.Worlds.MODE_N[last.mode] || 'Sopravvivenza'}</small></span></button>`;
        else h += `<button class="mcont" data-m="newWorld"><span class="mplay">${MICO.play}</span><span>Nuovo mondo<small>un arcipelago infinito</small></span></button>`;
        h += '<div class="mcap">Gioca</div>';
        if (has) h += row('worlds', 'map', 'Mondi', `${worlds.length} ${worlds.length === 1 ? 'mondo salvato' : 'mondi salvati'} · importa, esporta`) + row('newWorld', 'plus', 'Nuovo mondo', 'un arcipelago mai visto');
        h += row('mp', 'ppl', 'Multigiocatore', 'codice partita · fino a 4 giocatori');
        h += `</div><div class="mfoot">${chip('settings', 'gear', 'Impostazioni')}${chip('controls', 'kb', 'Comandi')}${APP() ? chip('quit', 'exit', 'Esci') : ''}</div>`;
      }
      h += `<p class="note mver">versione ${G.VERSION || ''} · il mondo si salva da solo</p>`;
    } else if (UI.menu === 'worlds') {
      const fmt = (t) => t ? new Date(t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const rows = worlds.map((w) => `<div class="wrow"><div class="wmain"><b>${esc(w.name || 'Mondo')}</b><span class="wbadge ${w.mode === 'creativa' ? 'cr' : ''}">${G.Worlds.MODE_N[w.mode] || 'Sopravvivenza'}</span><small>seme ${esc(String(w.seed))} · giocato il ${fmt(w.played)}${w.size ? ' · ' + Math.max(1, Math.round(w.size / 1024)) + ' KB' : ''}</small></div>
        <div class="wbtns"><button class="mini-btn" data-m="play" data-w="${w.id}">Gioca</button><button class="mini-btn" data-m="export" data-w="${w.id}">Esporta</button><button class="mini-btn danger" data-m="askDel" data-w="${w.id}">Elimina</button></div></div>`).join('');
      h += `<div class="mscreen wide"><h2>Mondi</h2>
        <div class="wlist">${rows || '<p class="note">Nessun mondo salvato.</p>'}</div>
        <p class="mperr" id="mp-msg" role="status">${esc(UI.mpMsg)}</p>
        <div class="mbtns row"><button class="mbtn primary" data-m="newWorld">Nuovo mondo</button><button class="mbtn" data-m="import">Importa un mondo<small>file .deriva da un altro PC</small></button>${APP() ? '<button class="mbtn" data-m="folder">Apri la cartella dei mondi</button>' : ''}<button class="mbtn" data-m="main">Indietro</button></div>
        <p class="note">Per continuare su un altro computer: <b>Esporta</b> crea un file .deriva; sull’altro PC usa <b>Importa un mondo</b>.</p></div>`;
    } else if (UI.menu === 'confirmDel') {
      const w = G.Worlds.meta(UI.delId) || {};
      h += `<div class="mscreen"><h2>Eliminare “${esc(w.name || 'mondo')}”?</h2><p class="note">Case, barche e inventario di questo mondo andranno persi per sempre. Se vuoi tenerne una copia, esportalo prima.</p><div class="mbtns"><button class="mbtn danger" data-m="delok">Sì, elimina</button><button class="mbtn" data-m="worlds">Annulla</button></div></div>`;
    } else if (UI.menu === 'newWorld') {
      const nw = UI.nw || (UI.nw = { mode: 'sopravvivenza', lv: 4, en: true });
      h += `<div class="mscreen"><h2>Nuovo mondo</h2>
        <div class="field"><label for="nw-name">Nome del mondo</label><input id="nw-name" maxlength="32" placeholder="Arcipelago ${worlds.length + 1}" value="${esc(nw.name || '')}" autocomplete="off"></div>
        <div class="field"><label for="nw-seed">Seme <small>(vuoto = casuale; lo stesso seme crea lo stesso mondo)</small></label><input id="nw-seed" maxlength="24" placeholder="casuale" value="${esc(nw.seed || '')}" autocomplete="off"></div>
        <div class="field"><label>Modalità</label><div class="seg">${['sopravvivenza', 'creativa'].map((m) => `<button data-nwmode="${m}" class="${nw.mode === m ? 'on' : ''}">${G.Worlds.MODE_N[m]}<small>${m === 'creativa' ? 'tutti gli oggetti, niente fame né danni, volo' : 'raccogli, costruisci, sopravvivi'}</small></button>`).join('')}</div></div>
        <div class="field"><label>Nemici</label><div class="seg">${[[true, 'Pirati e predatori', 'covi da espugnare, lupi, squali…'], [false, 'Mondo tranquillo', 'nessun nemico']].map(([v, l, d]) => `<button data-nwen="${v ? 1 : 0}" class="${nw.en === v ? 'on' : ''}">${l}<small>${d}</small></button>`).join('')}</div></div>
        <div class="opt"><label for="nw-lv">Vento</label><output id="nw-lv-o">${windName(nw.lv)}</output><input type="range" id="nw-lv" min="0" max="10" step="1" value="${nw.lv}"></div>
        <div class="mbtns"><button class="mbtn primary" data-m="create">Crea e salpa</button><button class="mbtn" data-m="${has ? 'worlds' : 'main'}">Indietro</button></div></div>`;
    } else if (UI.menu === 'confirmNew') {
      h += `<div class="mscreen"><h2>Nuovo mondo?</h2><p class="note">Il mondo salvato verrà sostituito da un nuovo arcipelago. Case, barche e inventario andranno persi.</p><div class="mbtns"><button class="mbtn primary" data-m="newok">Sì, salpa verso un nuovo mondo</button><button class="mbtn" data-m="main">Annulla</button></div></div>`;
    } else if (UI.menu === 'mp') {
      const name = esc(S.name || '');
      h += `<div class="mscreen"><h2>Multigiocatore</h2>
        <div class="field"><label for="mp-name">Il tuo nome</label><input id="mp-name" maxlength="16" placeholder="Es. Marinaio" value="${name}" autocomplete="off"></div>
        <div class="mpbox"><h3>Ospita</h3>
          ${APP() ? `<p class="note">${started ? 'Apri questo mondo agli amici' : 'Scegli il mondo da aprire agli amici'}. Massimo 4 giocatori.</p>
          ${started ? '' : `<div class="field"><label for="mp-world">Mondo</label><select id="mp-world">${worlds.map((w) => `<option value="${w.id}">${esc(w.name)} · ${G.Worlds.MODE_N[w.mode] || 'Sopravvivenza'}</option>`).join('')}<option value="__new">Nuovo mondo (sopravvivenza)</option><option value="__newc">Nuovo mondo (creativa)</option></select></div>`}
          <div class="row2"><div class="field"><label for="mp-port">Porta</label><input id="mp-port" inputmode="numeric" value="${S.port || 7777}"></div>
          <label class="check"><input type="checkbox" id="mp-ff" ${S.ff !== false ? 'checked' : ''}> Fuoco amico</label></div>
          <button class="mbtn primary" data-m="host">Ospita la partita<small>riceverai un codice da dare agli amici</small></button>
          ${window.deriva.platform === 'win32' ? `<button class="mbtn" data-m="fw">Sblocca nel firewall di Windows<small>serve solo per giocare sulla stessa rete con l’indirizzo IP</small></button>` : ''}` : `<p class="note">Per ospitare serve la versione per computer (Deriva.exe).</p>`}
        </div>
        ${started ? '' : `<div class="mpbox"><h3>Unisciti</h3>
          <div class="field"><label for="mp-addr">Codice partita <small>(oppure indirizzo IP sulla stessa rete)</small></label><input id="mp-addr" placeholder="ABC-234" value="${esc(S.lastAddr || (G.servedByHost ? location.host : ''))}" autocomplete="off" spellcheck="false"></div>
          <button class="mbtn" data-m="join">Unisciti</button>
          <p class="note">Il codice funziona anche da case diverse, senza aprire porte. Chi ospita lo trova nel menu (Esc).</p></div>`}
        <p class="mperr" id="mp-msg" role="status">${esc(UI.mpMsg)}</p>
        <div class="mbtns"><button class="mbtn" data-m="main">Indietro</button></div></div>`;
    } else if (UI.menu === 'settings' || UI.menu === 'controls') {
      const opt = (id, label, min, max, step, val, fmt) => `<div class="opt"><label for="${id}">${label}</label><output id="${id}-o">${fmt(val)}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
      const chk = (id, label, on, note) => `<div class="opt"><label for="${id}">${label}${note ? `<small>${note}</small>` : ''}</label><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></div>`;
      if (UI.menu === 'controls') UI.stab = 'controlli';
      const TABS = [['grafica', 'eye', 'Grafica'], ['audio', 'snd', 'Audio'], ['voce', 'mic', 'Chat vocale'], ['controlli', 'mouse', 'Controlli'], ['interfaccia', 'ui', 'Interfaccia']].concat(started ? [['mondo', 'globe', 'Questo mondo']] : []);
      let tab = UI.stab || 'grafica'; if (!TABS.some((t) => t[0] === tab)) tab = 'grafica';
      let body = '';
      if (tab === 'grafica') body = `<h5>Qualità</h5>
        <div class="presets">${Object.entries(G.PRESETS).map(([k, p]) => `<button data-preset="${k}" class="${S.preset === k ? 'on' : ''}">${p.label}</button>`).join('')}</div>
        <h5>Notte</h5><div class="sgrid">        <div class="opt"><label>Luna di notte<small>di notte il cielo diventa blu-viola, con nebulose e una grande luna</small></label><div class="seg small">${[['rossa', 'Rossa'], ['argento', 'Argento']].map(([k, n]) => `<button data-gmoon="${k}" class="${(S.moon || 'rossa') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div></div>
        <h5>Dettagli</h5><div class="sgrid">
        ${chk('o-shadow', 'Ombre', S.shadows)}${chk('o-ao', 'Occlusione ambientale', S.ao !== false, 'ombre di contatto più realistiche')}${chk('o-god', 'Raggi di sole', S.godrays)}${chk('o-fx', 'Foglie e particelle', S.fx)}
        ${opt('o-view', 'Distanza visiva', 2, 7, 1, S.view, (v) => `${v * 64 * 2} m`)}
        ${opt('o-grass', 'Densità dell’erba', 0, 1.6, 0.1, S.grass, (v) => `${Math.round(v * 100)}%`)}
        ${opt('o-pixel', 'Risoluzione', 0.5, 1.5, 0.05, S.pixel, (v) => `${Math.round(v * 100)}%`)}
        ${chk('o-dyn', 'Grafica adattiva', S.dynres !== false, 'per tenere gli FPS stabili abbassa risoluzione, ombre, raggi e distanza, e li rialza quando c’è margine: ti avvisa ogni volta')}
        <div class="opt"><label>FPS da mantenere</label><div class="seg small">${[30, 45, 60].map((f) => `<button data-fps="${f}" class="${(S.fpsTarget || 60) === f ? 'on' : ''}">${f}</button>`).join('')}</div></div>
        ${APP() ? chk('o-full', 'Schermo intero', S.fullscreen, 'anche con F11') + chk('o-vsync', 'VSync', S.vsync !== false, 'limita gli FPS alla frequenza dello schermo · vale dal prossimo avvio') : ''}
        </div>        <p class="note">${G.gpuName ? `Scheda video: <b>${esc(G.gpuName)}</b>${G.gpuSoft ? ' — <span class="warnc">il gioco non sta usando la scheda video: aggiorna i driver</span>' : G.gpuWeak ? ' (integrata: consigliate Bassa o Minima)' : ''}. ` : ''}Le texture (Alta e Ultra) e la densità dell’erba si applicano dal prossimo avvio; il resto cambia subito.</p>`;
      else if (tab === 'audio') body = `<h5>Volumi</h5><div class="sgrid">
        ${opt('o-vol', 'Volume generale', 0, 1, 0.05, S.volume, (v) => `${Math.round(v * 100)}%`)}
        ${(G.Audio ? G.Audio.BUSES : []).map(([k, n, d]) => { const v = S.vols && S.vols[k] !== undefined ? S.vols[k] : 1; return `<div class="opt"><label for="o-av-${k}">${n}<small>${d}</small></label><output id="o-av-${k}-o">${Math.round(v * 100)}%</output><input type="range" id="o-av-${k}" min="0" max="1.5" step="0.05" value="${v}"></div>`; }).join('')}
        </div>`;
      else if (tab === 'voce') body = `<h5>Chat vocale</h5><div class="sgrid">
        <div class="opt"><label>Microfono<small>si attiva quando sei in partita con altri giocatori</small></label><div class="seg small">${[['open', 'Sempre aperto'], ['ptt', 'Tieni premuto Z'], ['off', 'Spento']].map(([k, n]) => `<button data-voice="${k}" class="${(S.voice && S.voice.mode || 'open') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        ${opt('o-vvol', 'Volume delle voci', 0, 1.5, 0.05, S.voice ? S.voice.vol : 1, (v) => `${Math.round(v * 100)}%`)}
        ${opt('o-vrange', 'Si sentono fino a', 15, 150, 5, S.voice ? S.voice.range : 60, (v) => `${v} m`)}
        ${opt('o-vsens', 'Sensibilità del microfono', 0, 1, 0.05, S.voice ? S.voice.sens : 0.5, (v) => `${Math.round(v * 100)}%`)}
        </div><p class="note">Sempre aperto: il microfono trasmette solo quando senti parlare (più sensibilità = si apre anche con la voce bassa). Con il collegamento diretto o sulla stessa Wi-Fi la voce è immediata; se la partita passa dal server dei codici la voce potrebbe non arrivare.</p>`;
      else if (tab === 'controlli') body = `<h5>Mouse e visuale</h5><div class="sgrid">
        ${opt('o-sens', 'Sensibilità mouse', 0.3, 2.5, 0.05, S.sens, (v) => `${(+v).toFixed(2)}×`)}
        ${opt('o-fov', 'Campo visivo', 60, 100, 1, S.fov, (v) => `${v}°`)}
        </div><h5>Comandi</h5><div class="ctrl2">${CONTROLS.map(([k, v]) => `<div class="kp"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>`;
      else if (tab === 'interfaccia') body = `<h5>A schermo</h5><div class="sgrid">
        ${chk('o-coord', 'Mostra le coordinate', S.coords !== false, 'sotto la bussola: X e Z, da dare agli amici')}${chk('o-fps', 'Mostra FPS', S.showFps)}${chk('o-ping', 'Mostra ping (multigiocatore)', S.showPing !== false)}${chk('o-hints', 'Comandi a schermo', S.hints !== false, 'tasto H per nasconderli')}
        </div>`;
      else body = `<div class="sgrid">${worldSettingsHTML()}</div>`;
      h += `<div class="swin" role="dialog" aria-label="Impostazioni"><nav class="stabs"><h2>Impostazioni</h2>${TABS.map(([k, ic, n]) => `<button data-stab="${k}" class="${tab === k ? 'on' : ''}">${MICO[ic]}${n}</button>`).join('')}</nav>
        <div class="sbody">${body}</div><div class="sbar"><span>Le modifiche si salvano subito</span><button class="mbtn primary" data-m="main">Fatto</button></div></div>`;
    } else if (UI.menu === 'connecting') {
      h += `<div class="mscreen"><h2>Connessione…</h2><p class="note">${esc(UI.mpMsg)}</p></div>`;
    }
    side.innerHTML = h;
    const first = side.querySelector('.mbtn.primary, .mbtn'); if (first && UI.menu !== 'mp') first.focus({ preventScroll: true });
  };
  const WIND_N = ['Bonaccia', 'Bava di vento', 'Brezza leggera', 'Brezza tesa', 'Vento moderato', 'Vento teso', 'Vento fresco', 'Vento forte', 'Burrasca moderata', 'Burrasca', 'Tempesta'];
  function windName(lv) { return `${lv} · ${WIND_N[lv]}`; }
  UI.windName = windName;
  function worldSettingsHTML() {
    const client = G.Net && G.Net.on && !G.Net.isHost;
    return `<h3 class="sub3">Questo mondo</h3>
      <div class="opt"><label for="o-wind">Vento<small>${client ? 'lo decide chi ospita' : '0 = mare calmo · 10 = tempesta'}</small></label><output id="o-wind-o">${windName(G.WIND.level)}</output><input type="range" id="o-wind" min="0" max="10" step="1" value="${G.WIND.level}" ${client ? 'disabled' : ''}></div>
      <div class="opt"><label>Modalità${client ? '<small>la decide chi ospita</small>' : ''}</label><div class="seg small">${['sopravvivenza', 'creativa'].map((m) => `<button data-setmode="${m}" class="${G.mode === m ? 'on' : ''}" ${client ? 'disabled' : ''}>${G.Worlds.MODE_N[m]}</button>`).join('')}</div></div>
      <div class="opt"><label>Nemici${client ? '<small>li decide chi ospita</small>' : ''}</label><div class="seg small">${[[1, 'Sì'], [0, 'No']].map(([v, l]) => `<button data-seten="${v}" class="${!G.enemiesOff === !!v ? 'on' : ''}" ${client ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
      <div class="opt"><label>Chat vocale${client ? '<small>la decide chi ospita</small>' : '<small>in vicinanza: si sentono solo i giocatori vicini · ovunque: tutti, sempre allo stesso volume</small>'}</label><div class="seg small">${[[0, 'In vicinanza'], [1, 'Ovunque']].map(([v, l]) => `<button data-m="vg" data-v="${v}" class="${(G.voiceGlobal ? 1 : 0) === v ? 'on' : ''}" ${client ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
      ${G.worldId ? `<div class="opt"><label>Copia del mondo<small>file .deriva da aprire su un altro PC</small></label><button class="mini-btn" data-m="exportCur">Esporta</button></div>` : ''}`;
  }
  function playersHTML() {
    const N = G.Net, S = G.settings;
    const me = `<li><i style="background:${N.COLOR_CSS[N.slot % 4]}"></i>${esc(S.name || 'Tu')} <em>(tu${N.isHost ? ', ospiti' : ''})</em><span>${N.isHost ? '' : N.ping + ' ms'}</span></li>`;
    const canTp = G.Cmd && G.Cmd.allowed();
    const others = [...N.remotes.values()].map((r) => `<li><i style="background:${N.COLOR_CSS[r.slot % 4]}"></i>${esc(r.name)}${r.op ? ' <em>operatore</em>' : ''}<span>${r.ping ? r.ping + ' ms' : ''}</span>${canTp ? `<button class="mini-btn" data-m="tpda" data-id="${r.id}">Vai da lui</button>` : ''}${N.isHost ? `<button class="mini-btn ${r.op ? 'on' : ''}" data-m="op" data-id="${r.id}">${r.op ? 'Togli operatore' : 'Rendi operatore'}</button>` : ''}</li>`).join('');
    const hi = UI.hostInfo;
    let ips = '';
    if (hi) {
      const lan = (hi.ips || []).filter((a) => !a.virt);
      const code = hi.code ? `<div class="mpcode"><span>Codice partita</span><b class="sel">${G.Relay.fmt(hi.code)}</b><button class="mini-btn" data-m="copycode">Copia</button></div><p class="note">Dai questo codice agli amici: funziona anche da case diverse.</p>`
        : `<p class="note">${hi.codeErr ? esc(hi.codeErr) + ' <button class="mini-btn" data-m="retrycode">Riprova</button>' : 'Preparo il codice partita…'}</p>`;
      ips = code + `<p class="note">Sulla stessa rete Wi-Fi: ${lan.length ? lan.map((a) => `<b class="sel">${a.ip}:${hi.port}</b>${a.name ? ' <small>(' + esc(a.name) + ')</small>' : ''}`).join(' oppure ') : 'il tuo IP:' + hi.port}${N.ff ? ' · fuoco amico attivo' : ' · fuoco amico disattivato'}</p>`
        + `<p class="note">Da telefono: apri <b class="sel">${G.WEB_URL}</b> e scrivi il codice${lan.length ? `, oppure sulla stessa Wi-Fi apri <b class="sel">http://${lan[0].ip}:${hi.port}</b>` : ''}.</p>`;
    }
    return `<div class="plist"><h3>Giocatori ${N.remotes.size + 1}/4</h3><ul>${me}${others}</ul>${ips}</div>`;
  }
  // numero del danno che sale e svanisce sopra il bersaglio
  const _dn = new THREE.Vector3();
  UI.damageNumber = function (x, y, z, dmg, killed) {
    _dn.set(x, y, z).project(G.camera); if (_dn.z > 1) return;
    const el = document.createElement('div'); el.className = 'dmgnum' + (killed ? ' kill' : '');
    el.textContent = killed ? '✖ ' + dmg : '−' + dmg;
    el.style.left = ((_dn.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30) + 'px'; el.style.top = ((-_dn.y * 0.5 + 0.5) * innerHeight) + 'px';
    $('hud').appendChild(el); setTimeout(() => el.remove(), 900);
  };
  // segno a X sul mirino quando un colpo va a segno
  UI.hitMarker = function (killed) {
    const c = $('cross'); if (!c) return;
    c.classList.remove('hitm', 'hitk'); void c.offsetWidth; c.classList.add(killed ? 'hitk' : 'hitm');
    clearTimeout(UI._hmT); UI._hmT = setTimeout(() => c.classList.remove('hitm', 'hitk'), 220);
  };
  UI.toggleMode = function () {
    if (G.Net && G.Net.on && !G.Net.isHost) { UI.toast('La modalità la decide chi ospita', 'warn'); return; }
    G.setMode(G.creative() ? 'sopravvivenza' : 'creativa'); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0;
  };
  UI.hideMenu = function () { $('menu').hidden = true; $('hud').hidden = false; UI.menu = null; };
  function readName() {
    const n = ($('mp-name') && $('mp-name').value || '').trim().slice(0, 16);
    if (!n) { UI.mpMsg = 'Scegli un nome prima di giocare.'; $('mp-msg').textContent = UI.mpMsg; $('mp-name').focus(); return null; }
    G.settings.name = n; G.store.set('deriva_settings', G.settings);
    return n;
  }
  async function doHost() {
    const name = readName(); if (!name) return;
    const port = Math.max(1024, Math.min(65535, parseInt($('mp-port').value, 10) || 7777));
    const ff = $('mp-ff').checked;
    Object.assign(G.settings, { port, ff }); G.store.set('deriva_settings', G.settings);
    UI.mpMsg = 'Apro la partita sulla porta ' + port + '…'; UI.showMenu('connecting');
    if (!G.started) {
      const wsel = $('mp-world') ? $('mp-world').value : '__new';
      if (wsel.startsWith('__new')) G.startGame(true, true, { mode: wsel === '__newc' ? 'creativa' : 'sopravvivenza' });
      else G.startGame(false, true, { id: wsel });
    }
    const r = await window.deriva.hostStart({ port, ff, worldId: G.worldId, snapshot: G.netSnapshot() });
    if (!r || !r.ok) { UI.mpMsg = (r && r.error) || 'Impossibile aprire la partita.'; UI.showMenu('mp'); return; }
    UI.hostInfo = r;
    const c = await G.Net.connect('ws://127.0.0.1:' + port, name, true);
    if (!c.ok) { window.deriva.hostStop(); UI.mpMsg = c.reason; UI.showMenu('mp'); return; }
    UI.mpMsg = '';
    UI.showMenu('main');
    startCode();
  }
  // codice partita (WebRTC): parte dopo che il server locale è pronto
  async function startCode() {
    const hi = UI.hostInfo; if (!hi || !G.Relay) return;
    hi.code = null; hi.codeErr = null; if (UI.menu === 'main') UI.showMenu('main');
    const r = await G.Relay.host(hi.port);
    if (UI.hostInfo !== hi) { if (r.ok) G.Relay.stopHost(); return; }
    if (r.ok) { hi.code = r.code; G.UI.toast('Codice partita: ' + G.Relay.fmt(r.code) + ' · dallo agli amici', 'good'); }
    else hi.codeErr = r.error;
    if (UI.menu === 'main') UI.showMenu('main');
  }
  async function doJoin() {
    const name = readName(); if (!name) return;
    let addr = ($('mp-addr').value || '').trim().replace(/^ws:\/\//, '');
    if (!addr) { UI.mpMsg = 'Scrivi il codice partita (es. ABC-234) o l’indirizzo di chi ospita.'; $('mp-msg').textContent = UI.mpMsg; return; }
    const isCode = G.Relay && G.Relay.isCode(addr);
    if (!isCode) {
      if (/^[a-z0-9]{3}-?[a-z0-9]{3}$/i.test(addr)) { UI.mpMsg = 'Il codice non sembra giusto: sono 6 caratteri, per esempio ABC-234 (senza 0, O, 1 e I).'; $('mp-msg').textContent = UI.mpMsg; return; }
      if (!/:\d+$/.test(addr)) addr += ':7777';
    }
    G.settings.lastAddr = isCode ? G.Relay.fmt(G.Relay.normCode(addr)) : addr; G.store.set('deriva_settings', G.settings);
    UI.mpMsg = isCode ? 'Cerco la partita ' + G.Relay.fmt(G.Relay.normCode(addr)) + '…' : 'Mi collego a ' + addr + '…'; UI.showMenu('connecting');
    const c = await G.Net.connect(isCode ? G.Relay.join(addr) : 'ws://' + addr, name, false);
    if (!c.ok) { UI.mpMsg = c.reason; UI.showMenu('mp'); return; }
    UI.mpMsg = '';
  }
  UI.refreshPlayers = function () {
    if (UI.menu === 'main' && G.started) UI.showMenu('main');
    const box = $('plist'); if (!box) return;
    const N = G.Net;
    if (!N || !N.on) { box.hidden = true; return; }
    box.hidden = false;
    const spk = '<b class="spk" aria-label="parla">♪</b>';
    box.innerHTML = `<li><i style="background:${N.COLOR_CSS[N.slot % 4]}"></i>${esc(G.settings.name || 'Tu')}${G.Voice && G.Voice.talking ? spk : ''}</li>` + [...N.remotes.values()].map((r) => `<li><i style="background:${N.COLOR_CSS[r.slot % 4]}"></i>${esc(r.name)}${r.speaking ? spk : ''}${G.settings.showPing !== false && r.ping ? `<span>${r.ping} ms</span>` : ''}</li>`).join('');
  };
  function onMenuClick(e) {
    const b = e.target.closest('[data-m],[data-preset],[data-nwmode],[data-setmode],[data-nwen],[data-seten],[data-fps],[data-voice],[data-gmoon],[data-stab]'); if (!b) return;
    if (b.dataset.stab) { UI.stab = b.dataset.stab; UI.showMenu('settings'); if (G.Audio) G.Audio.click(); return; }
    if (b.dataset.gmoon) { G.settings.moon = b.dataset.gmoon; G.store.set('deriva_settings', G.settings); UI.showMenu('settings'); if (G.Audio) G.Audio.click(); return; }
    if (b.dataset.voice) { const vs = G.Voice ? G.Voice.settings() : (G.settings.voice = G.settings.voice || { mode: 'open', vol: 1, range: 60, sens: 0.5 }); vs.mode = b.dataset.voice; G.store.set('deriva_settings', G.settings); UI.showMenu('settings'); if (G.Audio) G.Audio.click(); return; }
    if (b.dataset.fps) { G.settings.fpsTarget = +b.dataset.fps; G.adaptReset(); G.store.set('deriva_settings', G.settings); UI.showMenu('settings'); return; }
    if (G.Audio) G.Audio.click();
    if (b.dataset.preset) { G.applyPreset(b.dataset.preset); UI.showMenu('settings'); return; }
    if (b.dataset.nwmode) { readNW(); UI.nw.mode = b.dataset.nwmode; UI.showMenu('newWorld'); return; }
    if (b.dataset.nwen) { readNW(); UI.nw.en = b.dataset.nwen === '1'; UI.showMenu('newWorld'); return; }
    if (b.dataset.seten) { const on = b.dataset.seten === '1'; if (on === !!G.enemiesOff) { G.setEnemies(on); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; } UI.showMenu('settings'); return; }
    if (b.dataset.setmode) { if (G.mode !== b.dataset.setmode) { G.setMode(b.dataset.setmode); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; } UI.showMenu('settings'); return; }
    const m = b.dataset.m;
    if (m === 'continue') G.startGame(false);
    else if (m === 'play') G.startGame(false, false, { id: b.dataset.w });
    else if (m === 'create') { readNW(); const nw = UI.nw; UI.nw = null; G.startGame(true, false, { name: nw.name, seed: nw.seed, mode: nw.mode, lv: nw.lv, enemies: nw.en !== false }); }
    else if (m === 'export' || m === 'exportCur') {
      if (m === 'exportCur') G.save();
      G.Worlds.exportWorld(m === 'export' ? b.dataset.w : G.worldId).then((r) => {
        UI.mpMsg = r && r.ok ? (r.path ? 'Mondo esportato in ' + r.path : 'Mondo esportato') : r && r.canceled ? '' : (r && r.error) || 'Esportazione non riuscita';
        if (m === 'export') UI.showMenu('worlds'); else G.UI.toast(UI.mpMsg || 'Esportazione annullata', r && r.ok ? 'good' : '');
      });
    }
    else if (m === 'import') G.Worlds.importWorld().then((r) => { UI.mpMsg = r && r.ok ? `Importato: ${r.name}` : r && r.canceled ? '' : (r && r.error) || ''; UI.showMenu('worlds'); });
    else if (m === 'folder') window.deriva.worlds.folder();
    else if (m === 'askDel') { UI.delId = b.dataset.w; UI.showMenu('confirmDel'); }
    else if (m === 'delok') { G.Worlds.remove(UI.delId); UI.mpMsg = ''; UI.showMenu(G.Worlds.list().length ? 'worlds' : 'main'); }
    else if (m === 'worlds' || m === 'newWorld') { UI.mpMsg = ''; UI.showMenu(m); }
    else if (m === 'op') { const r = G.Net.remotes.get(b.dataset.id); if (r) { G.Net.setOp(r.id, !r.op); UI.toast(r.op ? `${r.name} ora è operatore` : `${r.name} non è più operatore`, 'good'); UI.showMenu('main'); } }
    else if (m === 'tpda') { const r = G.Net.remotes.get(b.dataset.id); if (r) { UI.hideMenu(); UI.toast(G.Cmd.tpTo(r.name)); G._lockTry = 0; G.requestLock(); } }
    else if (m === 'vg') { G.voiceGlobal = b.dataset.v === '1'; G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; UI.showMenu('settings'); }
    else if (m === 'resume') { UI.hideMenu(); G._lockTry = 0; G.requestLock(); }
    else if (m === 'savequit') { G.save(); G.toTitle(); }
    else if (m === 'leave') { if (G.Net.isHost) G.save(); UI.hostInfo = null; G.Net.leave(); if (G.started) G.toTitle(); }
    else if (m === 'quit') { G.save(); window.deriva && window.deriva.quit(); }
    else if (m === 'togglemode') { UI.toggleMode(); UI.showMenu('main'); }
    else if (m === 'tools') { UI.hideMenu(); UI.openCustom('strumenti'); }
    else if (m === 'host') doHost();
    else if (m === 'retrycode') startCode();
    else if (m === 'copycode') { if (UI.hostInfo && UI.hostInfo.code) { try { navigator.clipboard.writeText(G.Relay.fmt(UI.hostInfo.code)); G.UI.toast('Codice copiato', 'good'); } catch (e) {} } }
    else if (m === 'fw') { UI.mpMsg = 'Windows ti chiederà il permesso: premi Sì.'; $('mp-msg').textContent = UI.mpMsg; window.deriva.firewall().then((r) => { UI.mpMsg = r && r.ok ? 'Fatto: Deriva è sbloccato nel firewall, anche sulle reti pubbliche.' : (r && r.error) || 'Operazione annullata.'; if (UI.menu === 'mp') $('mp-msg').textContent = UI.mpMsg; }); }
    else if (m === 'join') doJoin();
    else { if (m === 'mp') UI.mpMsg = ''; UI.showMenu(m); }
  }
  function readNW() {
    const nw = UI.nw || (UI.nw = { mode: 'sopravvivenza', lv: 4, en: true });
    if ($('nw-name')) nw.name = $('nw-name').value; if ($('nw-seed')) nw.seed = $('nw-seed').value; if ($('nw-lv')) nw.lv = +$('nw-lv').value;
  }
  function onMenuInput(e) {
    const t = e.target;
    if (t.id === 'nw-lv') { $('nw-lv-o').textContent = windName(+t.value); if (UI.nw) UI.nw.lv = +t.value; return; }
    if (t.id === 'o-wind') { G.setWind(+t.value); $('o-wind-o').textContent = windName(G.WIND.level); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; return; }
    if (!t.id || !t.id.startsWith('o-')) return;
    const S = G.settings; const v = t.type === 'checkbox' ? t.checked : parseFloat(t.value);
    if (t.id === 'o-vvol' || t.id === 'o-vrange' || t.id === 'o-vsens') {
      const vs = G.Voice ? G.Voice.settings() : (S.voice = S.voice || { mode: 'open', vol: 1, range: 60, sens: 0.5 });
      const k = { 'o-vvol': 'vol', 'o-vrange': 'range', 'o-vsens': 'sens' }[t.id]; vs[k] = v;
      $(t.id + '-o').textContent = k === 'range' ? `${v} m` : `${Math.round(v * 100)}%`; G.store.set('deriva_settings', S); return;
    }
    if (t.id.startsWith('o-av-')) {
      const k = t.id.slice(5); S.vols = Object.assign({ amb: 1, room: 1, ani: 1, wx: 1, sfx: 1, ui: 1 }, S.vols); S.vols[k] = v;
      $(t.id + '-o').textContent = `${Math.round(v * 100)}%`; if (G.Audio) G.Audio.setBus(k, v); G.store.set('deriva_settings', S);
      clearTimeout(UI._avT); UI._avT = setTimeout(() => { if (!G.Audio || !G.Audio.ctx) return; const demo = { amb: 'chirp', room: 'drip', ani: 'farAnimal', wx: 'thunder', sfx: 'thud', ui: 'coins' }[k]; if (demo === 'thunder') G.Audio.thunder(300); else G.Audio[demo](); }, 250);
      return;
    }
    const base = G.PRESETS[S.preset] || G.PRESETS.media;
    const map = { 'o-shadow': ['shadows', v ? (base.shadows || 1024) : 0], 'o-god': ['godrays', v], 'o-fx': ['fx', v], 'o-view': ['view', v], 'o-grass': ['grass', v], 'o-pixel': ['pixel', v], 'o-fov': ['fov', v], 'o-sens': ['sens', v], 'o-vol': ['volume', v],
      'o-ao': ['ao', v], 'o-coord': ['coords', v], 'o-dyn': ['dynres', v], 'o-fps': ['showFps', v], 'o-ping': ['showPing', v], 'o-hints': ['hints', v], 'o-full': ['fullscreen', v], 'o-vsync': ['vsync', v] };
    if (!map[t.id]) return;
    const [k, val] = map[t.id];
    if (['shadows', 'godrays', 'ao', 'view', 'pixel'].includes(k) && G.adaptReset) G.adaptReset();
    S[k] = val;
    if (['shadows', 'godrays', 'fx', 'view', 'grass', 'pixel'].includes(k) && S.preset !== 'custom') { S.basePreset = S.preset; S.preset = 'custom'; }
    const o = $(t.id + '-o');
    if (o) o.textContent = { 'o-view': `${v * 128} m`, 'o-grass': `${Math.round(v * 100)}%`, 'o-pixel': `${Math.round(v * 100)}%`, 'o-fov': `${v}°`, 'o-sens': `${(+v).toFixed(2)}×`, 'o-vol': `${Math.round(v * 100)}%` }[t.id] || '';
    G.applySettings(k);
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === S.preset));
  }

  /* ---------------- INPUT ---------------- */
  function bindInput() {
    const canvas = $('c');
    const P_ = P();
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.code;
      if (UI.menu) { if (k === 'Escape' && UI.menu !== 'main') UI.showMenu('main'); else if (k === 'Escape' && G.started) { UI.hideMenu(); G._lockTry = 0; G.requestLock(); } return; }
      if (!G.started) return;
      if (UI.open) {
        if (k === 'Escape' || k === 'Tab' || k === 'KeyI' || (k === 'KeyE' && UI.open !== 'book') || (k === 'KeyB' && UI.open === 'book') || (k === 'KeyM' && UI.open === 'map') || (k === 'KeyJ' && UI.open === 'diario')) { e.preventDefault(); UI.close(); }
        else if (/^Digit[1-8]$/.test(k) && !UI.hoverSlot && UI.open === 'inv' && G.creative()) UI.applyKit(+k.slice(5) - 1);
        else if (/^Digit[1-9]$/.test(k) && UI.hoverSlot && UI.open !== 'book') {
          // tasto numerico sopra uno slot: scambia con la barra rapida
          const n = +k.slice(5) - 1; const { src, i } = UI.hoverSlot; const arr = getArr(src);
          if (arr && src !== 'res') { const t = arr[i]; arr[i] = P_.inv[n]; P_.inv[n] = t; UI.refreshHotbar(); }
        }
        return;
      }
      if (k === 'Tab') e.preventDefault();
      if (k === 'Space' && !e.repeat && G.creative() && !P_.boat) {
        const now = performance.now();
        if (now - (UI._spaceT || 0) < 320) { P_.fly = !P_.fly; P_.vel.set(0, 0, 0); UI.toast(P_.fly ? 'Volo attivo · Spazio sali · C scendi · doppio Spazio per atterrare' : 'Volo disattivato'); UI._spaceT = 0; }
        else UI._spaceT = now;
      }
      P_.keys[k] = true;
      if (/^Digit[1-9]$/.test(k)) { P_.sel = +k.slice(5) - 1; UI.refreshHotbar(); }
      else if (k === 'KeyI' || k === 'Tab') UI.openInventory(3);
      else if (k === 'KeyB') UI.openBook();
      else if (k === 'KeyM') G.MapUI.open();
      else if (k === 'KeyJ') G.MapUI.openJournal();
      else if (k === 'KeyE') { if (P_.placing) UI.cancelPlace(); else UI.openInventory(3); }
      else if (k === 'KeyF') P_.swapHands();
      else if (k === 'KeyG') { if (P_.boat && P_.boat.inv) UI.openChest(P_.boat.inv, 'Stiva', { boat: P_.boat }); else { const tg = P_.target; if (tg && tg.kind === 'boat' && !G.Boats.isComplete(tg.boat)) UI.openBoatBuild(tg.boat); } }
      else if (k === 'F4') { e.preventDefault(); UI.toggleMode(); }
      else if (k === 'KeyT' || k === 'Slash' || k === 'NumpadDivide') { e.preventDefault(); P_.keys = {}; G.Cmd.openConsole(k === 'KeyT' ? '' : '/'); }
      else if (k === 'KeyK') UI.openCustom('strumenti');
      else if (k === 'KeyZ' && G.Voice) G.Voice.setPTT(true);
      else if (k === 'KeyQ' && !e.repeat && G.Drops) G.Drops.throwHeld(e.ctrlKey || e.metaKey);
      else if (k === 'KeyR') G.Build.rotStep = (G.Build.rotStep + 1) % 4;
      else if (k === 'KeyV' && P_.boat) P_.cam3 = !P_.cam3;
      else if (k === 'KeyH') { G.settings.hints = G.settings.hints === false; G.store.set('deriva_settings', G.settings); }
      else if (k === 'F11' && window.deriva) { e.preventDefault(); G.settings.fullscreen = !G.settings.fullscreen; G.applySettings('fullscreen'); }
      else if (k === 'Escape') { if (P_.placing) UI.cancelPlace(); else if (UI.boatPlacing) { UI.boatPlacing = null; G.Boats.updateGhost(null); } }
    });
    document.addEventListener('keyup', (e) => { P().keys[e.code] = false; if (e.code === 'KeyZ' && G.Voice) G.Voice.setPTT(false); });
    window.addEventListener('blur', () => { P().keys = {}; P().mouse.l = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!G.started || UI.open || UI.menu) return;
      if (!G.locked && !G.noLock) { G.requestLock(); return; }
      if (e.button === 0) {
        if (UI.boatPlacing) { UI.confirmBoatPlace(); return; }
        if (P().placing) { UI.cancelPlace(); return; }
        P().mouse.l = true; if (P().actionCd <= 0) P().primary();
      } else if (e.button === 2) {
        P().mouse.r = true;
        if (UI.boatPlacing) { UI.confirmBoatPlace(); return; }
        P().secondary();
      }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) P().mouse.l = false; if (e.button === 2) P().mouse.r = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (G.locked && G.started && !UI.open) {
        // col cannocchiale: più ingrandisce, più la visuale si muove piano
        const s = 0.0022 * G.settings.sens * (G.Combat && G.Combat.zoom > 0.05 ? 1 / (1 + G.Combat.zoom * (G.Combat.mag - 1)) : 1);
        P().yaw -= e.movementX * s; P().pitch = G.clamp(P().pitch - e.movementY * s, -1.5, 1.5);
      }
      if (UI.open) { const c = $('cursorItem'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; const tt = $('tooltip'); tt.style.left = e.clientX + 16 + 'px'; tt.style.top = e.clientY + 14 + 'px'; }
    });
    canvas.addEventListener('wheel', (e) => { if (!G.started || UI.open) return; if (G.Combat && G.Combat._spyOn) { G.Combat.spyZoom(e.deltaY < 0 ? 1 : -1); return; } P().sel = (P().sel + (e.deltaY > 0 ? 1 : 8)) % 9; UI.refreshHotbar(); }, { passive: true });
    // pannelli
    const pw = $('panelWrap');
    pw.addEventListener('input', (e) => { if (e.target.id === 'recq') { UI.recQ = e.target.value; UI.refreshRecipes(); } });
    pw.addEventListener('mousedown', (e) => {
      const cu = UI.custom[UI.open];
      if (cu) { if (e.target.closest('[data-act=close]') || e.target === pw) { UI.close(); return; } if (cu.click && cu.click(e)) return; return; }
      // clic fuori dal pannello con un oggetto preso: lo butti a terra (in creativa lo cancelli)
      if (UI.cursor && e.target === pw && UI.open === 'inv') { const st = UI.cursor; UI.cursor = null; if (!G.creative() && G.Drops) { const n = e.button === 2 ? 1 : st.n; if (n < st.n) UI.cursor = Object.assign({}, st, { n: st.n - n }); G.Drops.throwStack(Object.assign({}, st, { n })); } UI.renderPanel(); e.preventDefault(); return; }
      const s = e.target.closest('.slot[data-src]');
      if (s) { e.preventDefault(); slotClick(s.dataset.src, +s.dataset.i, e.button, e.shiftKey); UI.syncShared(); UI.renderPanel(); return; }
      const r = e.target.closest('[data-rec]'); if (r) { fillRecipe(+r.dataset.rec, e.shiftKey); UI.renderPanel(); return; }
      const kb = e.target.closest('[data-kit]'); if (kb) { e.preventDefault(); UI.applyKit(+kb.dataset.kit); return; }
      const rc = e.target.closest('[data-rcat]'); if (rc) { e.preventDefault(); UI.recCat = rc.dataset.rcat; UI.refreshRecipes(); return; }
      const fb = e.target.closest('[data-fill]');
      if (fb && !fb.disabled && UI.open === 'boat') {
        if (fb.dataset.fill === 'all') { const n = G.Boats.fillAll(UI.boat); if (!n) UI.toast('Non hai i materiali per nessuna parte', 'warn'); }
        else G.Boats.fillPart(UI.boat, +fb.dataset.fill);
        UI.refreshHotbar(); return;
      }
      if (e.target.closest('[data-act=board]') && UI.boat) { const b = UI.boat; UI.close(); P().boardBoat(b); return; }
      if (e.target.closest('[data-act=close]') || e.target === pw) UI.close();
    });
    pw.addEventListener('mouseover', (e) => {
      const s = e.target.closest('.slot[data-src]'); const tt = $('tooltip');
      if (!s) { tt.hidden = true; UI.hoverSlot = null; return; }
      UI.hoverSlot = { src: s.dataset.src, i: +s.dataset.i };
      let st = null;
      const src = s.dataset.src, i = +s.dataset.i;
      if (src === 'res') { const r = G.matchRecipe(UI.craft, UI.craftN); st = r ? { id: r.out } : null; }
      else if (src === 'firein') st = UI.fire.cook.in; else if (src === 'fireout') st = UI.fire.cook.out; else if (src === 'firefuel') st = UI.fire.cook.fuel;
      else { const a = getArr(src); st = a && a[i]; }
      if (!st) { tt.hidden = true; return; }
      const d = G.ITEMS[st.id];
      const f = [d.food ? `+${d.food} fame` : '', d.water ? `+${d.water} sete` : '', G.COOK[st.id] ? 'si cuoce sul falò' : ''].filter(Boolean).join(' · ');
      const wi = G.weaponInfo(st.id);
      tt.innerHTML = `<div class="tn">${esc(d.n)}</div>${d.d ? `<div class="td">${esc(d.d)}</div>` : ''}${wi ? `<div class="tw">⚔ ${wi.text}</div>` : ''}${f ? `<div class="tf">${f}</div>` : ''}`;
      tt.hidden = false;
    });
    $('bookWrap').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-boat],[data-act]');
      if (!t && e.target === $('bookWrap')) { UI.close(); return; }
      if (!t) return;
      if (G.Audio) G.Audio.click();
      if (t.dataset.tab) { UI.bookTab = t.dataset.tab; UI.renderBook(); }
      else if (t.dataset.boat) { UI.bookBoat = t.dataset.boat; UI.renderBook(); }
      else if (t.dataset.act === 'close') UI.close();
      else if (t.dataset.act === 'placeboat' && G.Boats.unlocked(UI.bookBoat)) UI.startBoatPlace(UI.bookBoat);
    });
    $('menuSide').addEventListener('click', onMenuClick);
    $('menuSide').addEventListener('input', onMenuInput);
    $('resume').addEventListener('click', () => { $('resume').hidden = true; G.requestLock(); });
  }
})();
