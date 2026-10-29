/* =========================================================
   Pericoli del mare aperto:
   - il KRAKEN: raro, in acque profonde; i tentacoli sbattono
     sulla barca per sfasciarla;
   - le NAVI PIRATA: ti inseguono e sparano a cannonate.
   Le barche hanno uno scafo che si rompe (si ripara con assi e
   chiodi); quando cede la barca affonda e il carico galleggia.
   Con il galeone (parte "Cannoni") rispondi al fuoco: clic sinistro
   al timone spara una bordata dal lato verso cui guardi.
   ========================================================= */
(function () {
  const S = (G.Sea = { enc: [], balls: [], t: 0, cdT: 40 });
  const V3 = THREE.Vector3;
  const _a = new V3(), _b = new V3(), _c = new V3();

  /* ---------------- scafo delle barche ---------------- */
  S.hullMax = (b) => b.hullMaxO || (b.free ? 60 + (b.pcs ? b.pcs.length * 6 : 0) : Math.round(b.T.L * b.T.W * 7 + 40));
  S.hullOf = (b) => (b.hull === undefined ? S.hullMax(b) : b.hull);
  S.boatPos = (b, out) => (out || new V3()).set(b.root.position.x, b.root.position.y + (b.T.deck || 1), b.root.position.z);
  S.damageBoat = function (b, n, x, y, z) {
    if (!b || b.sunk) return;
    const max = S.hullMax(b);
    b.hull = Math.max(0, S.hullOf(b) - n);
    if (b.free) b.flood = (b.flood || 0) + n * 18;
    G.FX.burst(x, y, z, [0.55, 0.4, 0.25], 16, 3.5);
    if (G.Audio) G.Audio.hit('wood');
    if (G.Player.boat === b) { G.Player.dmgFlash = Math.max(G.Player.dmgFlash, 0.35); S.shake = 0.5; if (!S._hullTip || performance.now() - S._hullTip > 9000) { S._hullTip = performance.now(); G.UI.toast(`Lo scafo è danneggiato (${Math.round(b.hull / max * 100)}%): riparalo con assi e chiodi`, 'warn'); } }
    if (b.hull <= 0) S.sinkBoat(b);
    else if (G.Net && G.Net.on && !b.pirate) G.Net.send({ t: 'bhull', id: b.id, h: Math.round(b.hull) });
    if (b.pirate && b.enc) S.hpShow = { e: b.enc, t: 4 };
  };
  // riparare: le barche grandi chiedono molto più legno (assi e chiodi per ogni 20% di scafo)
  S.repairCost = (b) => b.free ? { assi: 4, chiodi: 1 } : { assi: Math.max(4, Math.round(b.T.L * b.T.W / 5)), chiodi: Math.max(1, Math.round(b.T.L / 6)) };
  S.repair = function (P, b) {
    const max = S.hullMax(b), cur = S.hullOf(b), c = S.repairCost(b);
    if (cur >= max) { G.UI.toast('Lo scafo è già a posto'); return true; }
    if (!G.creative() && (P.count('assi') < c.assi || P.count('chiodi') < c.chiodi)) { G.UI.toast(`Per riparare servono ${c.assi} assi e ${c.chiodi} ${c.chiodi > 1 ? 'chiodi' : 'chiodo'}`, 'warn'); return true; }
    if (!G.creative()) { P.take('assi', c.assi); P.take('chiodi', c.chiodi); }
    b.hull = Math.min(max, cur + max * 0.2);
    if (G.Audio) { G.Audio.hit('wood'); setTimeout(() => G.Audio.hit('wood'), 180); }
    G.UI.toast(`Scafo riparato: ${Math.round(b.hull / max * 100)}%`, 'good');
    if (G.Net && G.Net.on) G.Net.send({ t: 'bhull', id: b.id, h: Math.round(b.hull) });
    return true;
  };
  S.sinkBoat = function (b) {
    if (String(b.id || '').startsWith('d:')) G.state.removed.add(b.id); // barca di un porticciolo: non torna più
    const P = G.Player, p = b.root.position;
    // il carico della stiva galleggia: si può recuperare
    if (b.inv) for (const st of b.inv) if (st && G.Drops) G.Drops.spawn(st, p.x + (Math.random() - 0.5) * 4, p.y + 1, p.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, { delay: 1 });
    if (b.free) { b.flood = 1e5; return; }
    if (P.boat === b) { P.leaveBoat(true); P.pos.set(p.x + 2, G.SEA - 0.5, p.z); P.vel.set(0, 0, 0); }
    if (b.onSink) b.onSink(b);
    else G.UI.toast('La barca è affondata! Il carico galleggia: recuperalo', 'warn');
    if (G.Net && G.Net.on && !b.pirate) G.Net.send({ t: 'bdelboat', id: b.id });
    // affonda piano, poi sparisce
    S.sinking.push({ root: b.root, t: 0 });
    const i = G.Boats.list.indexOf(b); if (i >= 0) G.Boats.list.splice(i, 1);
    if (!b.pirate) G.saveSoon();
  };
  S.sinking = [];

  /* ---------------- palle di cannone ---------------- */
  let ballGeo = null, ballMat = null;
  S.fireBallV = function (from, v, owner) {
    if (!ballGeo) { ballGeo = new THREE.SphereGeometry(0.16, 10, 8); ballMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.4, metalness: 0.6 }); }
    const m = new THREE.Mesh(ballGeo, ballMat); m.position.copy(from); m.castShadow = true; G.scene.add(m);
    S.balls.push({ m, pos: from.clone(), vel: v.clone(), owner, t: 0 });
    G.FX.burst(from.x, from.y, from.z, [0.75, 0.72, 0.7], 16, 2.8, { size: 1.7 });
    if (G.Audio) { const dist = from.distanceTo(G.Player.pos); G.Audio.cannon ? G.Audio.cannon(dist) : G.Audio.hit('stone'); }
  };
  S.fireBall = function (from, to, owner, spread) {
    if (!ballGeo) { ballGeo = new THREE.SphereGeometry(0.16, 10, 8); ballMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.4, metalness: 0.6 }); }
    const d = _a.subVectors(to, from), hd = Math.hypot(d.x, d.z), T = Math.max(0.6, hd / 42);
    const v = new V3(d.x / T + (Math.random() - 0.5) * spread, (d.y + 0.5 * 9.8 * T * T) / T + (Math.random() - 0.5) * spread * 0.4, d.z / T + (Math.random() - 0.5) * spread);
    const m = new THREE.Mesh(ballGeo, ballMat); m.position.copy(from); m.castShadow = true; G.scene.add(m);
    S.balls.push({ m, pos: from.clone(), vel: v, owner, t: 0 });
    G.FX.burst(from.x, from.y, from.z, [0.75, 0.72, 0.7], 14, 2.5, { size: 1.6 });
    if (G.Audio) { const dist = from.distanceTo(G.Player.pos); G.Audio.cannon ? G.Audio.cannon(dist) : G.Audio.hit('stone'); }
  };
  function updateBalls(dt) {
    const P = G.Player;
    for (let i = S.balls.length - 1; i >= 0; i--) {
      const b = S.balls[i]; b.t += dt;
      b.vel.y -= 9.8 * dt; b.pos.addScaledVector(b.vel, dt); b.m.position.copy(b.pos);
      let hit = false;
      // colpisce le barche dei giocatori (se a sparare è un pirata) o le navi pirata (se spari tu)
      // le palle colpiscono le barche dell'altra parte: i pirati le tue, tu le loro
      for (const bo of G.Boats.list) {
        if (!!bo.pirate === (b.owner === 'pirate') || bo.sunk) continue;
        const bp = S.boatPos(bo, _b), fx = Math.sin(bo.yaw), fz = Math.cos(bo.yaw), dx = b.pos.x - bp.x, dz = b.pos.z - bp.z;
        const along = dx * fx + dz * fz, side = dx * fz - dz * fx;
        if (Math.abs(along) < bo.T.L * 0.5 && Math.abs(side) < Math.max(1.1, bo.T.W * 0.55) && b.pos.y < bp.y + 3 && b.pos.y > bp.y - 2.2) { S.damageBoat(bo, b.owner === 'pirate' ? 14 + Math.random() * 8 : 26 + Math.random() * 10, b.pos.x, b.pos.y, b.pos.z); hit = true; if (b.owner === 'player') G.Skills.add('fuoco', 5); break; }
      }
      if (!hit && b.owner === 'pirate' && Math.hypot(b.pos.x - P.pos.x, b.pos.y - (P.pos.y + 1), b.pos.z - P.pos.z) < 1.3) { P.hurt(26); hit = true; }
      if (!hit && b.owner !== 'pirate') for (const e of S.enc) { if (e.type !== 'kraken' || e.dead) continue; const h = krakenRay(e, b.pos, null, 0); if (h) { S.hitEnc(e, 55, b.pos); hit = true; if (b.owner === 'player') G.Skills.add('fuoco', 5); break; } }
      const wy = G.waveHeight(b.pos.x, b.pos.z, G.clock);
      if (!hit && b.pos.y < wy) { G.FX.burst(b.pos.x, wy + 0.2, b.pos.z, [0.85, 0.93, 0.97], 18, 4, { size: 1.4 }); if (G.Audio) G.Audio.splash(); hit = true; }
      if (!hit && b.pos.y < G.World.groundAt(b.pos.x, b.pos.z)) { G.FX.burst(b.pos.x, b.pos.y + 0.3, b.pos.z, [0.5, 0.45, 0.4], 14, 3); hit = true; }
      if (hit || b.t > 8) { if (hit && b.owner !== 'pirate' && !b._fx) G.FX.burst(b.pos.x, b.pos.y, b.pos.z, [0.9, 0.55, 0.2], 10, 3); G.scene.remove(b.m); S.balls.splice(i, 1); }
    }
  }
  // bordata dal galeone del giocatore: dal lato verso cui guardi
  S.hasCannons = (b) => { if (!b || b.free || !b.parts) return false; const ci = b.parts.findIndex((p) => p.name === 'Cannoni'); return ci >= 0 && b.filled[ci]; };
  // posizioni dei cannoni sul ponte (coordinate locali della barca, come in boats.js)
  S.cannonSpots = function (b) { const T = b.T, out = []; for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) { const z = (0.28 + i * 0.1 - 0.5) * T.L; out.push({ x: sd * (G.Boats.deckHalfW(T, z) - 0.35), z, sd }); } return out; };
  // a piedi sul ponte, vicino a un cannone: clic sinistro spara solo quello
  S.nearCannon = function (P) {
    const b = P.boat; if (!b || P.helm || !S.hasCannons(b)) return null;
    let best = null, bd = 1.7;
    for (const c of S.cannonSpots(b)) { const d = Math.hypot(P.local.x - c.x, P.local.z - c.z); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  S.fireCannonNear = function (P) {
    const b = P.boat, best = S.nearCannon(P);
    if (!best) return false;
    if ((S.gunCd1 || 0) > 0) return true;
    if (!G.creative() && P.count('munizioni') <= 0) { G.UI.toast('Per sparare col cannone serve una munizione', 'warn'); S.gunCd1 = 1; return true; }
    if (!G.creative()) P.take('munizioni', 1);
    S.gunCd1 = 1.6 * G.Skills.less('fuoco', 0.01, 0.5); G.Skills.add('fuoco', 1);
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw), wx = b.root.position.x + best.x * cy + best.z * sy, wz = b.root.position.z - best.x * sy + best.z * cy;
    const ox = best.sd * cy, oz = -best.sd * sy, look = P.lookDir(_c);
    const from = new V3(wx + ox * 0.9, b.root.position.y + (b.T.deck || 1) + 0.55, wz + oz * 0.9);
    const aim = Math.max(25, Math.min(110, 60 + look.y * 120));
    S.fireBall(from, new V3(from.x + ox * aim + look.x * 8, G.SEA, from.z + oz * aim + look.z * 8), 'player', 2.5);
    return true;
  };
  /* ---------------- postazione al cannone ----------------
     Tasto destro vicino a un cannone del galeone: ti metti dietro la canna.
     A D (o il mouse) la girano, W S la alzano e abbassano, clic sinistro spara. */
  const ST_V = 38; // velocità della palla (m/s)
  S.station = null;
  S.stationToggle = function (P) {
    if (S.station) { S.stationLeave(P); return true; }
    const c = S.nearCannon(P); if (!c) return false;
    const b = P.boat, ci = b.parts.findIndex((p) => p.name === 'Cannoni'); if (ci < 0) return false;
    const mesh = b.meshes[ci], geo = mesh.geometry, pos = geo.attributes.position, col = geo.attributes.color;
    // si trovano i vertici della canna (scuri) di questo cannone e si nascondono: al loro posto una canna che si muove
    const idx = []; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < pos.count; i++) {
      if (col && col.getX(i) > 0.12) continue;
      const x = pos.getX(i), z = pos.getZ(i);
      if (Math.abs(z - c.z) < 1.0 && Math.abs(x - c.x) < 1.2 && Math.sign(x || 1) === c.sd) { idx.push(i); cx += x; cy += pos.getY(i); cz += z; }
    }
    if (!idx.length) return false;
    cx /= idx.length; cy /= idx.length; cz /= idx.length;
    const orig = idx.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)]);
    for (const i of idx) pos.setXYZ(i, cx, cy, cz);
    pos.needsUpdate = true;
    const piv = new THREE.Group(); piv.position.set(cx, cy, cz); b.inner.add(piv);
    const bg = new THREE.CylinderGeometry(0.13, 0.17, 1.4, 14).rotateX(Math.PI / 2).translate(0, 0, 0.25);
    const ring = new THREE.TorusGeometry(0.15, 0.035, 6, 14).translate(0, 0, 0.93);
    const barrel = new THREE.Mesh(bg, G.MAT.cannon || mesh.material), lip = new THREE.Mesh(ring, G.MAT.cannon || mesh.material);
    barrel.castShadow = true; piv.add(barrel); piv.add(lip);
    S.station = { b, c, mesh, idx, orig, piv, barrel, yo: 0, pi: 0.12, cd: 0, kick: 0, y0: P.yaw, p0: P.pitch };
    P.local.set(cx - c.sd * 1.25, b.T.deck, cz);
    S.stationAim(P, 0); P._stYaw = P.yaw; P._stPit = P.pitch;
    if (G.UI) G.UI.toast('Al cannone · A D ruota · W S alza · clic sinistro fuoco · tasto destro per lasciarlo');
    document.body.classList.add('atcannon');
    return true;
  };
  S.stationLeave = function (P) {
    const st = S.station; if (!st) return;
    const pos = st.mesh.geometry.attributes.position;
    st.idx.forEach((i, k) => pos.setXYZ(i, st.orig[k][0], st.orig[k][1], st.orig[k][2])); pos.needsUpdate = true;
    st.b.inner.remove(st.piv); st.barrel.geometry.dispose();
    S.station = null; document.body.classList.remove('atcannon');
    const h = document.getElementById('cannhud'); if (h) h.hidden = true;
    if (P) { P.pitch = Math.max(-0.3, Math.min(0.3, P.pitch)); }
  };
  // direzione della canna nella barca e nel mondo
  function stDir(st, out) {
    const sd = st.c.sd, cy = Math.cos(st.yo), sy = Math.sin(st.yo), cp = Math.cos(st.pi), sp = Math.sin(st.pi);
    out.set(sd * cy * cp, sp, sd * sy * cp); // fuori = (sd,0,0), destra = (0,0,sd)
    return out;
  }
  const _sq = new THREE.Quaternion(), _sv = new V3(), _sw = new V3(), _sp = new V3(), _up = new V3(0, 1, 0), _z = new V3(0, 0, 1);
  S.stationAim = function (P, dt) {
    const st = S.station; if (!st) return;
    stDir(st, _sv); st.piv.quaternion.setFromUnitVectors(_z, _sv);
    st.kick = Math.max(0, st.kick - dt * 3); st.barrel.position.z = -st.kick * 0.35;
    st.piv.updateWorldMatrix(true, false);
    st.piv.getWorldPosition(_sp); st.b.inner.getWorldQuaternion(_sq);
    _sw.copy(_sv).applyQuaternion(_sq);
    P.yaw = Math.atan2(-_sw.x, -_sw.z); P.pitch = Math.asin(G.clamp(_sw.y, -1, 1));
    st.world = _sw; st.muzzle = _sp.clone().addScaledVector(_sw, 1.0);
  };
  S.stationUpdate = function (dt, P) {
    const st = S.station; if (!st) return false;
    if (!P.boat || P.boat !== st.b || P.helm || st.b.sunk || P.health <= 0) { S.stationLeave(P); return false; }
    const k = P.keys;
    if (st.byaw !== undefined && P._stYaw !== undefined) P._stYaw += G.angleDiff(st.byaw, st.b.yaw); st.byaw = st.b.yaw;
    // il mouse muove la canna come lo sguardo
    if (P._stYaw !== undefined) { let dy = P._stYaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.yo += dy; st.pi += P.pitch - P._stPit; }
    st.yo += ((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)) * dt * 0.6;
    st.pi += ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)) * dt * 0.35;
    st.yo = G.clamp(st.yo, -0.62, 0.62); st.pi = G.clamp(st.pi, -0.09, 0.44);
    st.cd = Math.max(0, st.cd - dt);
    S.stationAim(P, dt); P._stYaw = P.yaw; P._stPit = P.pitch;
    S.stationHud(P);
    return true;
  };
  // posizione della visuale: dietro e sopra la canna
  S.stationEye = function (P, cam) {
    const st = S.station; if (!st || !st.world) return false;
    const w = st.world, fl = Math.hypot(w.x, w.z) || 1;
    cam.position.set(_sp.x - w.x / fl * 1.45, _sp.y + 0.62, _sp.z - w.z / fl * 1.45);
    cam.rotation.set(P.pitch - 0.05, P.yaw, 0, 'YXZ');
    return true;
  };
  S.stationRange = function () {
    const st = S.station; if (!st || !st.muzzle) return 0;
    const y0 = Math.max(0, st.muzzle.y - G.SEA), vy = Math.sin(st.pi) * ST_V, vh = Math.cos(st.pi) * ST_V, g = 9.8;
    return vh * (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g;
  };
  S.stationFire = function (P) {
    const st = S.station; if (!st) return false;
    if (st.cd > 0) return true;
    if (!G.creative() && P.count('munizioni') <= 0) { G.UI.toast('Per sparare col cannone serve una munizione', 'warn'); st.cd = 0.8; return true; }
    if (!G.creative()) P.take('munizioni', 1);
    st.cd = 3.2 * G.Skills.less('fuoco', 0.012, 0.45); st.kick = 1;
    const spread = 0.9 * G.Skills.less('fuoco', 0.015, 0.25);
    const v = st.world.clone().multiplyScalar(ST_V); v.x += (Math.random() - 0.5) * spread; v.y += (Math.random() - 0.5) * spread * 0.5; v.z += (Math.random() - 0.5) * spread;
    S.fireBallV(st.muzzle.clone(), v, 'player');
    G.Skills.add('fuoco', 2);
    if (P.shake !== undefined) P.shake = 0.25;
    G.UI.refreshHotbar();
    return true;
  };
  // mirino: anello al centro, scale di rotazione e alzo, pannello coi dati
  let cHud = null, cCv = null;
  S.stationHud = function (P) {
    const st = S.station;
    if (!cHud) {
      cHud = document.createElement('div'); cHud.id = 'cannhud';
      cHud.innerHTML = '<canvas></canvas><div class="chkeys"><kbd>A</kbd><kbd>D</kbd> ruota · <kbd>W</kbd><kbd>S</kbd> alza / abbassa · <kbd>Clic sinistro</kbd> fuoco · <kbd>Tasto destro</kbd> lascia il cannone</div><div class="chpanel"><div><small>ALZO</small><b data-k="a"></b></div><div><small>ROTAZIONE</small><b data-k="r"></b></div><div><small>GITTATA</small><b data-k="g"></b></div><div><small>MUNIZIONI</small><b data-k="m"></b></div><div class="chrel"><small data-k="s">PRONTO</small><i><u></u></i></div></div>';
      (document.getElementById('cHud') || document.body).appendChild(cHud); cCv = cHud.querySelector('canvas');
    }
    cHud.hidden = false;
    const W = innerWidth, H = innerHeight; if (cCv.width !== W || cCv.height !== H) { cCv.width = W; cCv.height = H; }
    const x = cCv.getContext('2d'); x.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + Math.tan(0.05) * (H / 2) / Math.tan((G.Player.cam.fov || 75) * Math.PI / 360);
    x.strokeStyle = 'rgba(236,208,153,.95)'; x.fillStyle = '#ecd099'; x.lineWidth = 2; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 3;
    x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.stroke();
    x.beginPath(); for (const [a, b, c, d] of [[-38, 0, -26, 0], [26, 0, 38, 0], [0, -38, 0, -26], [0, 26, 0, 38]]) { x.moveTo(cx + a, cy + b); x.lineTo(cx + c, cy + d); } x.stroke();
    x.beginPath(); x.arc(cx, cy, 2.5, 0, 7); x.fill();
    const el = Math.round(st.pi * 57.3), ro = Math.round(st.yo * 57.3);
    x.font = '13px Signika, sans-serif'; x.textBaseline = 'middle'; x.lineWidth = 1.5;
    const sx = cx + 150;
    for (let e = -5; e <= 25; e += 5) { const yy = cy - (e - el) * 9; if (yy < cy - 150 || yy > cy + 150) continue; x.globalAlpha = 0.75; x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + (e % 10 === 0 ? 16 : 10), yy); x.stroke(); if (e % 10 === 0 || e === -5 || e === 25) x.fillText(e + '°', sx + 22, yy); }
    x.globalAlpha = 1; x.beginPath(); x.moveTo(sx - 4, cy); x.lineTo(sx - 14, cy - 7); x.lineTo(sx - 14, cy + 7); x.closePath(); x.fill();
    const ty = cy - 150; x.textAlign = 'center';
    for (let r = -35; r <= 35; r += 5) { const xx = cx + (r - ro) * 9; if (Math.abs(xx - cx) > 300) continue; x.globalAlpha = r === 0 ? 1 : 0.7; x.beginPath(); x.moveTo(xx, ty); x.lineTo(xx, ty - (r % 15 === 0 ? 14 : 8)); x.stroke(); if (r % 15 === 0) x.fillText((r > 0 ? '+' : '') + r + '°', xx, ty - 24); }
    x.globalAlpha = 1; x.beginPath(); x.moveTo(cx, ty + 4); x.lineTo(cx - 7, ty + 14); x.lineTo(cx + 7, ty + 14); x.closePath(); x.fill(); x.textAlign = 'left';
    const q = (k) => cHud.querySelector(`[data-k=${k}]`);
    q('a').textContent = (el >= 0 ? '+' : '') + el + '°'; q('r').textContent = (ro > 0 ? '+' : '') + ro + '°';
    q('g').textContent = Math.round(S.stationRange()) + ' m'; q('m').textContent = G.creative() ? '∞' : P.count('munizioni');
    const maxCd = 3.2 * G.Skills.less('fuoco', 0.012, 0.45), f = 1 - st.cd / maxCd;
    cHud.querySelector('.chrel u').style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%';
    q('s').textContent = st.cd > 0 ? 'RICARICA' : 'PRONTO';
  };
  S.broadside = function (P) {
    const b = P.boat; if (!b || b.free) return false;
    if (!S.hasCannons(b)) return false;
    if ((S.gunCd || 0) > 0) return true;
    if (!G.creative() && P.count('munizioni') <= 0) { G.UI.toast('Per i cannoni servono munizioni', 'warn'); S.gunCd = 1; return true; }
    if (!G.creative()) P.take('munizioni', 1);
    S.gunCd = 3.5 * G.Skills.less('fuoco', 0.01, 0.5); G.Skills.add('fuoco', 2);
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), look = P.lookDir(_c), side = (look.x * fz - look.z * fx) > 0 ? 1 : -1; // destra = (cos, -sin)
    const rx = Math.cos(b.yaw) * side, rz = -Math.sin(b.yaw) * side;
    for (let k = 0; k < 5; k++) {
      const along = (k - 2) * 1.8, from = new V3(b.root.position.x + fx * along + rx * 2.9, b.root.position.y + (b.T.deck || 2) + 0.4, b.root.position.z + fz * along + rz * 2.9);
      const to = new V3(from.x + rx * 70 + look.x * 10, G.SEA, from.z + rz * 70 + look.z * 10);
      setTimeout(() => S.fireBall(from, to, 'player', 4), k * 120);
    }
    return true;
  };

  /* ---------------- KRAKEN ---------------- */
  const KM = {};
  function kMats() {
    if (KM.skin) return KM;
    KM.skin = new THREE.MeshStandardMaterial({ color: 0x7a2c3a, roughness: 0.42, metalness: 0.05, vertexColors: true });
    KM.eye = new THREE.MeshStandardMaterial({ color: 0xffd34a, emissive: 0xffa020, emissiveIntensity: 1.6, roughness: 0.2 });
    KM.pupil = new THREE.MeshBasicMaterial({ color: 0x050505 });
    return KM;
  }
  const NT = 8, SEG = 22, RAD = 10;
  function tentacleGeo(len, r0) {
    const g = new THREE.CylinderGeometry(1, 1, 1, RAD, SEG, false);
    const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), tt = new Float32Array(n), ang = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i) + 0.5; tt[i] = 1 - y; ang[i] = Math.atan2(pos.getZ(i), pos.getX(i));
      // sotto pallido con le ventose, sopra rosso scuro
      const under = Math.max(0, -Math.cos(ang[i])), suck = under > 0.6 && Math.sin(tt[i] * 70) > 0.55 ? 1 : 0;
      col[i * 3] = 0.85 + under * 0.15 + suck * 0.1; col[i * 3 + 1] = 0.55 + under * 0.35 + suck * 0.2; col[i * 3 + 2] = 0.6 + under * 0.3 + suck * 0.15;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.userData = { tt, ang, len, r0 };
    return g;
  }
  // piega il tentacolo lungo una curva: base → punto alto → punta
  function bendTentacle(m, base, ctrl, tip, side) {
    const g = m.geometry, pos = g.attributes.position, { tt, ang, r0 } = g.userData;
    const P0 = base, P1 = ctrl, P2 = tip;
    for (let i = 0; i < pos.count; i++) {
      const t = tt[i], u = 1 - t;
      // Bézier quadratica e tangente
      const px = u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, py = u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y, pz = u * u * P0.z + 2 * u * t * P1.z + t * t * P2.z;
      let tx = 2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), ty = 2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y), tz = 2 * u * (P1.z - P0.z) + 2 * t * (P2.z - P1.z);
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // vettori normali: "sotto" = verso l'esterno del corpo
      let nx = side.x, ny = side.y, nz = side.z; const d = nx * tx + ny * ty + nz * tz; nx -= d * tx; ny -= d * ty; nz -= d * tz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      const r = r0 * Math.pow(1 - t * 0.93, 1.15) * (1 + Math.sin(t * 40) * 0.03), a = ang[i];
      const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
      pos.setXYZ(i, px - nx * ca + bx * sa, py - ny * ca + by * sa, pz - nz * ca + bz * sa);
    }
    pos.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  S.spawnKraken = function (near) {
    const M = kMats(), P = G.Player, c = near || P.pos;
    const root = new THREE.Group(); G.scene.add(root);
    const a0 = Math.random() * 6.28, pos = new V3(c.x + Math.cos(a0) * 16, G.SEA - 8, c.z + Math.sin(a0) * 16);
    // testa: mantello a goccia, occhi gialli, bocca a becco
    const hg = new THREE.SphereGeometry(4.2, 32, 20); const hp = hg.attributes.position, hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) { let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); const k = y > 0 ? 1 + y / 4.2 * 0.9 : 1; x *= 1 / k * 1.05; z *= 1 / k * 1.05; y *= y > 0 ? 1.7 : 0.8; const bump = 1 + Math.sin(x * 2.1) * Math.sin(y * 1.7) * Math.sin(z * 2.3) * 0.04; hp.setXYZ(i, x * bump, y, z * bump); const sp = Math.max(0, Math.sin(x * 3.3 + y * 2.1) * Math.sin(z * 2.7 - y)) > 0.75 ? 0.75 : 1; hc[i * 3] = 0.95 * sp; hc[i * 3 + 1] = 0.55 * sp; hc[i * 3 + 2] = 0.62 * sp; }
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3)); hg.computeVertexNormals();
    const head = new THREE.Mesh(hg, M.skin); head.castShadow = true; root.add(head);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), M.eye); e.position.set(s * 2.6, -0.6, 2.9); e.scale.set(1, 0.85, 0.6); head.add(e); const pu = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.1), M.pupil); pu.position.set(s * 2.6, -0.6, 3.35); head.add(pu); }
    const tents = [];
    for (let i = 0; i < NT; i++) {
      const len = 15 + Math.random() * 5, m = new THREE.Mesh(tentacleGeo(len, 0.95), M.skin); m.castShadow = true; m.frustumCulled = false; root.add(m);
      tents.push({ m, len, a: (i / NT) * 6.28, phase: Math.random() * 6.28, state: 'idle', t: Math.random() * 3, tip: new V3(), target: new V3(), hp: 1 });
    }
    const e = { type: 'kraken', root, head, tents, pos, hp: 420, max: 420, t: 0, rise: 0, yaw: 0, dead: false, deadT: 0, name: 'Kraken' };
    S.enc.push(e);
    G.UI.toast('Il mare si gonfia… IL KRAKEN! Difendi la barca: frecce, pistole, cannoni, spada sui tentacoli', 'warn');
    if (G.Audio && G.Audio.kraken) { G.Audio.kraken('tonfo', pos); setTimeout(() => G.Audio.kraken('voce', e.head.position), 900); } S.shake = 1;
    return e;
  };
  function krakenTarget(e) { const P = G.Player; return P.boat ? S.boatPos(P.boat, new V3()) : new V3(P.pos.x, P.pos.y + 0.5, P.pos.z); }
  function updateKraken(e, dt) {
    const P = G.Player, tgt = krakenTarget(e);
    e.t += dt;
    // versi: ogni tanto ruggisce; ferito geme più spesso
    if (!e.dead && e.rise > 0.6 && G.Audio && G.Audio.kraken && (e.voiceT = (e.voiceT === undefined ? 4 : e.voiceT) - dt) <= 0) {
      const low = e.hp < e.max * 0.35; e.voiceT = low ? 4 + Math.random() * 4 : 6 + Math.random() * 7;
      G.Audio.kraken(low ? 'ferito' : Math.random() < 0.55 ? 'voce' : 'breve', e.head.position);
    }
    // si avvicina al bersaglio e resta di fianco, mezzo sommerso
    const want = _a.set(tgt.x - e.pos.x, 0, tgt.z - e.pos.z); const dist = want.length();
    if (!e.dead) { if (dist > 11) e.pos.addScaledVector(want.normalize(), Math.min(dist - 11, dt * 5)); e.rise = Math.min(1, e.rise + dt * 0.25); }
    else { e.deadT += dt; e.rise = Math.max(0, 1 - e.deadT * 0.25); }
    const wy = G.waveHeight(e.pos.x, e.pos.z, G.clock);
    e.pos.y = wy - 9 + e.rise * 7.8 + Math.sin(e.t * 0.8) * 0.4;
    e.yaw = Math.atan2(tgt.x - e.pos.x, tgt.z - e.pos.z);
    e.root.position.set(0, 0, 0);
    e.head.position.copy(e.pos); e.head.rotation.set(-0.35 + Math.sin(e.t * 0.6) * 0.05, e.yaw, 0);
    const fwd = _b.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
    for (let i = 0; i < e.tents.length; i++) {
      const T = e.tents[i];
      const ang = e.yaw + T.a, ox = Math.sin(ang), oz = Math.cos(ang);
      const base = new V3(e.pos.x + ox * 2.6, e.pos.y - 2.6, e.pos.z + oz * 2.6);
      T.t -= dt;
      // stati: in attesa (onde), alzata sopra la barca, schianto, ritorno
      if (!e.dead && T.state === 'idle' && T.t <= 0 && e.rise > 0.85 && e.tents.filter((q) => q.state !== 'idle').length < 2) { T.state = 'lift'; T.t = 1.6; if (G.Audio && G.Audio.kraken && (e._movT || 0) < e.t) { e._movT = e.t + 1.2; G.Audio.kraken('movimento', T.base || e.pos); } T.target.set(tgt.x + (Math.random() - 0.5) * (P.boat ? P.boat.T.L * 0.6 : 1.5), tgt.y, tgt.z + (Math.random() - 0.5) * (P.boat ? P.boat.T.L * 0.6 : 1.5)); }
      let tip, ctrl;
      const sway = Math.sin(e.t * 1.3 + T.phase), sway2 = Math.cos(e.t * 0.9 + T.phase * 1.7);
      const idleTip = new V3(base.x + ox * (8 + sway * 2) + fwd.x * 3, wy + 1.5 + sway2 * 1.8, base.z + oz * (8 + sway * 2) + fwd.z * 3);
      if (T.state === 'lift') {
        const k = 1 - T.t / 1.6, up = T.target.clone(); up.y += 9; up.x += ox * 2; up.z += oz * 2;
        tip = idleTip.lerp(up, Math.min(1, k * 1.4));
        if (T.t <= 0) { T.state = 'slam'; T.t = 0.35; }
      } else if (T.state === 'slam') {
        const k = 1 - T.t / 0.35, up = T.target.clone(); up.y += 9;
        tip = up.lerp(T.target, k * k);
        if (T.t <= 0) {
          T.state = 'back'; T.t = 1.4;
          // colpo: barca o giocatore in acqua
          if (P.boat && Math.hypot(T.target.x - tgt.x, T.target.z - tgt.z) < P.boat.T.L) { S.damageBoat(P.boat, 6 + Math.random() * 5, T.target.x, T.target.y, T.target.z); P.boat.speed *= 0.4; P.boat.yawRate = (P.boat.yawRate || 0) + (Math.random() - 0.5) * 1.2; if (P.boat.free) { P.boat.vroll = (P.boat.vroll || 0) + (Math.random() - 0.5) * 2; } }
          else if (!P.boat && Math.hypot(T.target.x - P.pos.x, T.target.z - P.pos.z) < 2.2) P.hurt(18);
          G.FX.burst(T.target.x, T.target.y + 0.3, T.target.z, [0.85, 0.93, 0.97], 22, 5, { size: 1.5 }); if (G.Audio) { if (G.Audio.kraken) G.Audio.kraken('tonfo', T.target); else G.Audio.splash(); } // il tentacolo si abbatte nell'acqua
          S.shake = Math.max(S.shake || 0, 0.7);
        }
      } else if (T.state === 'back') {
        const k = 1 - T.t / 1.4; tip = T.target.clone().lerp(idleTip, k);
        if (T.t <= 0) { T.state = 'idle'; T.t = 2 + Math.random() * 4.5; }
      } else tip = idleTip;
      if (e.dead) tip.y -= e.deadT * 3;
      ctrl = new V3((base.x + tip.x) / 2 + ox * 3, Math.max(base.y, tip.y) + 3.5 + Math.sin(e.t + T.phase) * 1.2, (base.z + tip.z) / 2 + oz * 3);
      T.tip.copy(tip); T.base = base; T.ctrl = ctrl;
      bendTentacle(T.m, base, ctrl, tip, _c.set(ox, 0, oz));
    }
    if (e.dead && e.deadT > 5) return false;
    // se ti allontani molto (o arrivi a terra) se ne torna negli abissi
    if (dist > 160 || (!P.boat && !P.swim && !e.dead)) { e.gone = (e.gone || 0) + dt; if (e.gone > 6) return false; } else e.gone = 0;
    return true;
  }
  function krakenRay(e, o, d, max) {
    // sfere lungo testa e tentacoli
    const test = (c, r) => { if (!d) return o.distanceTo(c) < r ? 0 : -1; const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t >= 0 && t < max ? t : -1; };
    let best = -1;
    const th = test(e.head.position, 4.3); if (th >= 0) best = th;
    for (const T of e.tents) { if (!T.base) continue; for (let k = 0.15; k <= 1; k += 0.12) { const u = 1 - k; const c = _c.set(u * u * T.base.x + 2 * u * k * T.ctrl.x + k * k * T.tip.x, u * u * T.base.y + 2 * u * k * T.ctrl.y + k * k * T.tip.y, u * u * T.base.z + 2 * u * k * T.ctrl.z + k * k * T.tip.z); const t = test(c, 0.95 * (1 - k * 0.8) + 0.25); if (t >= 0 && (best < 0 || t < best)) best = t; } }
    return best >= 0 ? { t: best } : null;
  }

  /* ---------------- NAVI PIRATA ----------------
     Sono galeoni veri (G.Boats): si sale a bordo, ci si sbatte contro, hanno lo scafo
     come le tue barche. Un "capitano" automatico li guida e spara le bordate. */
  function skullFlag() {
    if (KM.flag) return KM.flag;
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 80; const x = fc.getContext('2d');
    x.fillStyle = '#0d0d0d'; x.fillRect(0, 0, 128, 80); x.fillStyle = '#eee'; x.beginPath(); x.arc(64, 32, 15, 0, 7); x.fill(); x.fillRect(55, 42, 18, 9); x.fillStyle = '#0d0d0d'; x.beginPath(); x.arc(58, 31, 4, 0, 7); x.arc(70, 31, 4, 0, 7); x.fill();
    x.strokeStyle = '#eee'; x.lineWidth = 6; x.beginPath(); x.moveTo(38, 56); x.lineTo(90, 72); x.moveTo(90, 56); x.lineTo(38, 72); x.stroke();
    const t = new THREE.CanvasTexture(fc); t.encoding = THREE.sRGBEncoding;
    return (KM.flag = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
  }
  S.spawnPirates = function (near) {
    const P = G.Player, c = near || P.pos, a0 = Math.random() * 6.28;
    const x = c.x + Math.cos(a0) * 170, z = c.z + Math.sin(a0) * 170;
    const parts = G.Boats.parts('galeone');
    const b = G.Boats.create({ tpl: 'galeone', x, z, yaw: Math.atan2(c.x - x, c.z - z), filled: parts.map(() => true) });
    b.pirate = true; b.hullMaxO = 380; b.hull = 380;
    if (!KM.sail) KM.sail = new THREE.MeshStandardMaterial({ map: G.MAT.cloth.map, normalMap: G.MAT.cloth.normalMap, color: 0x0d0b0a, side: THREE.DoubleSide, roughness: 0.95 });
    b.meshes.forEach((m, i) => { const p = parts[i]; m.castShadow = true; m.material = p.name === 'Bandiera' ? skullFlag() : p.mat === 'cloth' ? KM.sail : G.Boats.matFor(p); });
    // bottino nella stiva: quando affonda galleggia
    const loot = [['doblone', 35 + ((Math.random() * 30) | 0)], ['munizioni', 6 + ((Math.random() * 8) | 0)], ['corda', 4], ['assi', 10], ['chiodi', 6]];
    if (Math.random() < 0.4) loot.push(['pistola', 1]); if (Math.random() < 0.3) loot.push(['mappa_tesoro', 1]); if (Math.random() < 0.2) loot.push(['progetto_galeone', 1]);
    b.inv = new Array(54).fill(null); loot.forEach(([id, n], i) => { if (G.ITEMS[id]) b.inv[i] = { id, n }; });
    // equipaggio sul ponte
    const crew = [];
    const T = b.T, spots = [[0, -T.L * 0.3], [-1.2, -3], [1.2, 0.5], [-1.1, 3.5], [1.0, 6]];
    spots.forEach(([lx, lz], i) => { const pp = G.People.build((Math.random() * 1e6) | 0, { pirate: true, captain: i === 0, female: false }); pp.root.position.set(lx, (T.deck || 1) + (i === 0 ? 2.6 : 0), lz); pp.root.rotation.y = Math.random() * 6.28; b.inner.add(pp.root); crew.push(pp); });
    const e = { type: 'pirati', boat: b, crew, pos: b.root.position, yaw: b.yaw, t: 0, gunT: 4, dead: false, deadT: 0, name: 'Nave pirata', side: 1 };
    Object.defineProperty(e, 'hp', { get: () => S.hullOf(b) }); Object.defineProperty(e, 'max', { get: () => S.hullMax(b) });
    b.enc = e;
    b.ai = (bo, dt) => pirateAI(e, bo, dt);
    b.onSink = () => pirateSunk(e);
    S.enc.push(e);
    G.UI.toast('Vela nera all’orizzonte: PIRATI! Scappa col vento o affrontali: cannoni, pistole, frecce… o sali a bordo!', 'warn');
    return e;
  };
  function pirateAI(e, b, dt) {
    const P = G.Player, tgt = P.boat && !P.boat.pirate ? S.boatPos(P.boat, new V3()) : P.pos.clone();
    const dx = tgt.x - b.x, dz = tgt.z - b.z, dist = Math.hypot(dx, dz), toT = Math.atan2(dx, dz);
    // lontano: punta dritto; vicino: si mette di fianco (bordata) a circa 40 m; troppo vicino: si allontana
    let want = toT;
    if (dist < 70) want = toT + (Math.PI / 2) * e.side;
    if (dist < 24) want = toT + Math.PI * 0.75 * e.side;
    if (P.boat === b) want = b.yaw; // qualcuno a bordo: niente manovre strane
    b.yaw += G.clamp(G.angleDiff(b.yaw, want), -dt * 0.32, dt * 0.32);
    b.rudder = G.clamp(G.angleDiff(b.yaw, want), -1, 1) * 0.6;
    const vmax = dist > 70 ? 8.5 : 5;
    b.speed += (vmax - b.speed) * Math.min(1, dt * 0.25);
    // fondale davanti: vira
    if (G.heightAt(b.x + Math.sin(b.yaw) * 16, b.z + Math.cos(b.yaw) * 16) > -3) { b.yaw += dt * 0.7 * e.side; b.speed *= 0.97; }
    e.gunT -= dt;
    if (e.gunT <= 0 && dist < 90 && (P.boat || P.swim) && P.boat !== b) {
      e.gunT = 5 + Math.random() * 3;
      const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw), sd = (dx * rx + dz * rz) > 0 ? 1 : -1;
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      for (let k = 0; k < 4; k++) { const along = (k - 1.5) * 2.2; const from = new V3(b.x + fx * along + rx * sd * 3, b.root.position.y + (b.T.deck || 1) + 0.6, b.z + fz * along + rz * sd * 3); setTimeout(() => { if (!e.dead) S.fireBall(from, tgt, 'pirate', 5 + dist * 0.06); }, k * 180); }
    }
  }
  // naufraghi: i pirati restano a galla e nuotano via, lontano da te
  S.swimmers = [];
  function pirateSunk(e) {
    e.dead = true;
    const b = e.boat, P = G.Player;
    b.inner.updateMatrixWorld(true);
    for (const pp of e.crew) {
      const wp = new V3(); pp.root.getWorldPosition(wp); b.inner.remove(pp.root); G.scene.add(pp.root);
      const away = Math.atan2(wp.x - P.pos.x, wp.z - P.pos.z) + (Math.random() - 0.5) * 0.9;
      S.swimmers.push({ p: pp, pos: new V3(wp.x + (Math.random() - 0.5) * 3, G.SEA, wp.z + (Math.random() - 0.5) * 3), yaw: away, t: 0, speed: 1.1 + Math.random() * 0.5, delay: Math.random() * 1.5 });
    }
    G.UI.toast('La nave pirata affonda! I pirati scappano a nuoto. Il bottino galleggia: recuperalo', 'good');
    if (G.Player.stats) G.Player.stats.pirateShips = (G.Player.stats.pirateShips || 0) + 1;
  }
  function updateSwimmers(dt) {
    for (let i = S.swimmers.length - 1; i >= 0; i--) {
      const s = S.swimmers[i]; s.t += dt; s.delay -= dt;
      if (s.delay <= 0) {
        s.yaw += Math.sin(s.t * 0.4 + i) * dt * 0.15;
        const nx = s.pos.x + Math.sin(s.yaw) * s.speed * dt, nz = s.pos.z + Math.cos(s.yaw) * s.speed * dt;
        if (G.heightAt(nx, nz) < -0.6) { s.pos.x = nx; s.pos.z = nz; } else s.yaw += dt * 1.5;
      }
      s.pos.y = G.waveHeight(s.pos.x, s.pos.z, G.clock) - 0.15;
      if (G.Audio && G.Audio.at && s.t < 25 && Math.random() < dt * 0.12 && s.pos.distanceTo(G.Player.pos) < 60) G.Audio.at(Math.random() < 0.6 ? 'pirata_dolore' : 'pirata', s.pos, { bus: 'ani' });
      s.p.root.position.copy(s.pos); s.p.root.rotation.set(0, s.yaw, 0);
      G.People.animate(s.p, dt, 0, s.delay > 0 ? 'idle' : 'swim', 0);
      if (s.t > 70 || s.pos.distanceTo(G.Player.pos) > 220) { G.scene.remove(s.p.root); S.swimmers.splice(i, 1); }
    }
  }
  function updatePirates(e, dt) {
    const b = e.boat; e.t += dt; e.yaw = b.yaw;
    if (!e.dead) {
      for (const pp of e.crew) G.People.animate(pp, dt, 0, 'idle', 0);
      if (G.Audio && G.Audio.grunt && (e.shoutT = (e.shoutT === undefined ? 3 : e.shoutT) - dt) <= 0) { e.shoutT = 4 + Math.random() * 6; const dd = Math.hypot(G.Player.pos.x - b.x, G.Player.pos.z - b.z); if (dd < 80) G.Audio.grunt(dd, { x: b.x + (Math.random() - 0.5) * 6, y: b.root.position.y + 3, z: b.z + (Math.random() - 0.5) * 10 }); }
      const P = G.Player, d = Math.hypot(P.pos.x - b.x, P.pos.z - b.z);
      if (d > 340) { e.gone = (e.gone || 0) + dt; if (e.gone > 5) { G.Boats.remove(b); return false; } } else e.gone = 0;
      return true;
    }
    e.deadT += dt;
    return e.deadT < 14;
  }

  /* ---------------- colpi agli incontri ---------------- */
  S.raycast = function (o, d, max) {
    let best = null;
    for (const e of S.enc) {
      if (e.dead || (e.boat && G.Player.boat === e.boat)) continue;
      if (e.type === 'kraken') { const h = krakenRay(e, o, d, max); if (h && (!best || h.t < best.t)) best = { t: h.t, enc: e }; }
      else {
        const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
        for (let k = -2; k <= 2; k++) { const c = new V3(e.pos.x + fx * k * 3.6, e.pos.y + 2.4, e.pos.z + fz * k * 3.6); const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, bb = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - 9, h = bb * bb - cc; if (h < 0) continue; const t = -bb - Math.sqrt(h); if (t >= 0 && t < max && (!best || t < best.t)) best = { t, enc: e }; }
      }
    }
    return best;
  };
  S.hitEnc = function (e, dmg, at) {
    if (e.dead) return;
    if (e.type === 'pirati') { S.damageBoat(e.boat, dmg * 0.7, at ? at.x : e.pos.x, at ? at.y : e.pos.y + 2, at ? at.z : e.pos.z); return; }
    e.hp -= dmg;
    if (at) G.FX.burst(at.x, at.y, at.z, e.type === 'kraken' ? [0.3, 0.08, 0.35] : [0.55, 0.4, 0.25], 12, 3);
    if (G.Audio) G.Audio.hit(e.type === 'kraken' ? 'soft' : 'wood');
    if (e.type === 'kraken' && e.hp > 0 && G.Audio && G.Audio.kraken && performance.now() - (e._hurtS || 0) > 1600) { e._hurtS = performance.now(); G.Audio.kraken(e.hp < e.max * 0.35 ? 'ferito' : 'breve', e.head.position); }
    S.hpShow = { e, t: 4 };
    if (e.hp <= 0) {
      e.dead = true;
      if (e.type === 'kraken' && G.Audio && G.Audio.kraken) { const hp = e.head.position.clone(); G.Audio.kraken('morte', hp); setTimeout(() => G.Audio.kraken('tonfo', hp), 1800); }
      const c = e.type === 'kraken' ? e.head.position : e.pos;
      // bottino che galleggia
      const loot = e.type === 'kraken'
        ? [['doblone', 70 + ((Math.random() * 40) | 0)], ['perla', 4 + ((Math.random() * 5) | 0)], ['tentacolo_crudo', 3 + ((Math.random() * 3) | 0)], ['mappa_tesoro', 1]].concat(Math.random() < 0.35 ? [['vela_leggendaria', 1]] : [])
        : [['doblone', 35 + ((Math.random() * 30) | 0)], ['munizioni', 6 + ((Math.random() * 8) | 0)], ['corda', 4], ['assi', 8]].concat(Math.random() < 0.4 ? [['pistola', 1]] : []).concat(Math.random() < 0.3 ? [['mappa_tesoro', 1]] : []).concat(Math.random() < 0.2 ? [['progetto_galeone', 1]] : []);
      for (const [id, n] of loot) if (G.ITEMS[id] && G.Drops) G.Drops.spawn({ id, n }, c.x + (Math.random() - 0.5) * 6, G.SEA + 1.5, c.z + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, { delay: 1 });
      G.UI.toast(e.type === 'kraken' ? 'Il Kraken sprofonda negli abissi! Il bottino galleggia attorno a te' : 'La nave pirata affonda! Recupera il bottino che galleggia', 'good');
      if (G.Player.stats) G.Player.stats[e.type === 'kraken' ? 'kraken' : 'pirateShips'] = (G.Player.stats[e.type === 'kraken' ? 'kraken' : 'pirateShips'] || 0) + 1;
    }
  };

  /* ---------------- incontri casuali in mare aperto ---------------- */
  S.update = function (dt) {
    const P = G.Player;
    S.gunCd = Math.max(0, (S.gunCd || 0) - dt); S.gunCd1 = Math.max(0, (S.gunCd1 || 0) - dt);
    S.shake = Math.max(0, (S.shake || 0) - dt * 1.5);
    if (S.hpShow) { S.hpShow.t -= dt; if (S.hpShow.t <= 0) S.hpShow = null; }
    for (let i = S.enc.length - 1; i >= 0; i--) { const e = S.enc[i]; const keep = e.type === 'kraken' ? updateKraken(e, dt) : updatePirates(e, dt); if (!keep) { if (e.root) G.scene.remove(e.root); if (e.head) G.scene.remove(e.head); S.enc.splice(i, 1); } }
    updateSwimmers(dt);
    for (let i = S.sinking.length - 1; i >= 0; i--) { const s = S.sinking[i]; s.t += dt; s.root.position.y -= dt * 0.8; s.root.rotation.z += dt * 0.08; if (s.t > 14) { G.scene.remove(s.root); S.sinking.splice(i, 1); } }
    updateBalls(dt);
    hud();
    // incontri: solo al largo, in acque profonde, se i nemici sono attivi
    S.cdT -= dt;
    if (S.cdT > 0 || S.enc.length || G.enemiesOff || !G.started) return;
    S.cdT = 30;
    const atSea = P.boat || P.swim, deep = G.heightAt(P.pos.x, P.pos.z), far = Math.hypot(P.pos.x, P.pos.z);
    if (!atSea || deep > -16 || far < 700) return;
    let land = false; for (let k = 0; k < 8 && !land; k++) { const a = k * 0.785; if (G.heightAt(P.pos.x + Math.cos(a) * 110, P.pos.z + Math.sin(a) * 110) > 0) land = true; }
    if (land) return;
    const night = G.sky ? G.sky.night : 0, storm = G.Climate ? G.Climate.cur.storm : 0;
    const r = Math.random();
    if (deep < -28 && far > 1100 && r < 0.018 + night * 0.012 + storm * 0.02) S.spawnKraken();
    else if (r < 0.06 && P.boat) S.spawnPirates();
  };
  // barre: vita del Kraken / nave pirata in alto, scafo della tua barca
  function hud() {
    let el = document.getElementById('seahud');
    if (!el) { el = document.createElement('div'); el.id = 'seahud'; el.innerHTML = '<div class="sb boss"><b></b><i><u></u></i></div><div class="sb hull"><b>Scafo</b><i><u></u></i></div>'; document.getElementById('game').appendChild(el); S._el = el; }
    const e = S.enc.find((x) => !x.dead && x.pos.distanceTo(G.Player.pos) < 140), boss = el.children[0], hl = el.children[1];
    boss.style.display = e ? '' : 'none';
    if (e) { boss.children[0].textContent = e.name; boss.querySelector('u').style.width = (Math.max(0, e.hp / e.max) * 100).toFixed(1) + '%'; }
    const b = G.Player.boat, show = b && !b.free && b.hull !== undefined && (e || b.hull < S.hullMax(b));
    hl.style.display = show ? '' : 'none';
    if (show) { const k = b.hull / S.hullMax(b); hl.querySelector('u').style.width = (k * 100).toFixed(1) + '%'; hl.children[0].textContent = 'Scafo ' + Math.round(k * 100) + '%' + (k < 1 && !e ? ` · assi in mano + tasto destro per riparare (${S.repairCost(b).assi} assi, ${S.repairCost(b).chiodi} chiodi)` : ''); hl.classList.toggle('low', k < 0.3); }
  }
  S.clear = function () { for (const e of S.enc) { if (e.root) G.scene.remove(e.root); if (e.head) G.scene.remove(e.head); if (e.boat && G.Boats.list.includes(e.boat)) G.Boats.remove(e.boat); } for (const w of S.swimmers) G.scene.remove(w.p.root); S.swimmers.length = 0; S.enc.length = 0; for (const b of S.balls) G.scene.remove(b.m); S.balls.length = 0; };
})();
