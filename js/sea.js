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
  S.hullMax = (b) => (b.free ? 60 + (b.pcs ? b.pcs.length * 6 : 0) : Math.round(b.T.L * b.T.W * 7 + 40));
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
    else if (G.Net && G.Net.on) G.Net.send({ t: 'bhull', id: b.id, h: Math.round(b.hull) });
  };
  S.repair = function (P, b) {
    const max = S.hullMax(b), cur = S.hullOf(b);
    if (cur >= max) { G.UI.toast('Lo scafo è già a posto'); return true; }
    if (!G.creative() && (P.count('assi') < 2 || P.count('chiodi') < 1)) { G.UI.toast('Per riparare servono 2 assi e 1 chiodo', 'warn'); return true; }
    if (!G.creative()) { P.take('assi', 2); P.take('chiodi', 1); }
    b.hull = Math.min(max, cur + max * 0.25);
    if (G.Audio) G.Audio.hit('wood');
    G.UI.toast(`Scafo riparato: ${Math.round(b.hull / max * 100)}%`, 'good');
    if (G.Net && G.Net.on) G.Net.send({ t: 'bhull', id: b.id, h: Math.round(b.hull) });
    return true;
  };
  S.sinkBoat = function (b) {
    const P = G.Player, p = b.root.position;
    // il carico della stiva galleggia: si può recuperare
    if (b.inv) for (const st of b.inv) if (st && G.Drops) G.Drops.spawn(st, p.x + (Math.random() - 0.5) * 4, p.y + 1, p.z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, { delay: 1 });
    if (b.free) { b.flood = 1e5; return; }
    if (P.boat === b) { P.leaveBoat(true); P.pos.set(p.x + 2, G.SEA - 0.5, p.z); P.vel.set(0, 0, 0); }
    G.UI.toast('La barca è affondata! Il carico galleggia: recuperalo', 'warn');
    if (G.Net && G.Net.on) G.Net.send({ t: 'bdelboat', id: b.id });
    // affonda piano, poi sparisce
    S.sinking.push({ root: b.root, t: 0 });
    const i = G.Boats.list.indexOf(b); if (i >= 0) G.Boats.list.splice(i, 1);
    G.saveSoon();
  };
  S.sinking = [];

  /* ---------------- palle di cannone ---------------- */
  let ballGeo = null, ballMat = null;
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
      if (b.owner === 'pirate') {
        for (const bo of G.Boats.list) { const bp = S.boatPos(bo, _b); const r = Math.max(1.6, bo.T.L * 0.45); if (Math.hypot(b.pos.x - bp.x, b.pos.z - bp.z) < r && b.pos.y < bp.y + 2.5 && b.pos.y > bp.y - 2) { S.damageBoat(bo, 14 + Math.random() * 8, b.pos.x, b.pos.y, b.pos.z); hit = true; break; } }
        if (!hit && Math.hypot(b.pos.x - P.pos.x, b.pos.y - (P.pos.y + 1), b.pos.z - P.pos.z) < 1.3) { P.hurt(26); hit = true; }
      } else {
        for (const e of S.enc) { if (e.type !== 'pirati' || e.dead) continue; if (Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < 10 && Math.abs(_c.set(b.pos.x - e.pos.x, 0, b.pos.z - e.pos.z).dot(_a.set(Math.cos(e.yaw), 0, -Math.sin(e.yaw)))) < 3.2 && b.pos.y < e.pos.y + 6) { S.hitEnc(e, 60, b.pos); hit = true; break; } }
        if (!hit) for (const e of S.enc) { if (e.type !== 'kraken' || e.dead) continue; const h = krakenRay(e, b.pos, null, 0); if (h) { S.hitEnc(e, 55, b.pos); hit = true; break; } }
      }
      const wy = G.waveHeight(b.pos.x, b.pos.z, G.clock);
      if (!hit && b.pos.y < wy) { G.FX.burst(b.pos.x, wy + 0.2, b.pos.z, [0.85, 0.93, 0.97], 18, 4, { size: 1.4 }); if (G.Audio) G.Audio.splash(); hit = true; }
      if (!hit && b.pos.y < G.World.groundAt(b.pos.x, b.pos.z)) { G.FX.burst(b.pos.x, b.pos.y + 0.3, b.pos.z, [0.5, 0.45, 0.4], 14, 3); hit = true; }
      if (hit || b.t > 8) { if (hit && b.owner !== 'pirate' && !b._fx) G.FX.burst(b.pos.x, b.pos.y, b.pos.z, [0.9, 0.55, 0.2], 10, 3); G.scene.remove(b.m); S.balls.splice(i, 1); }
    }
  }
  // bordata dal galeone del giocatore: dal lato verso cui guardi
  S.broadside = function (P) {
    const b = P.boat; if (!b || b.free) return false;
    const ci = b.parts.findIndex((p) => p.name === 'Cannoni'); if (ci < 0 || !b.filled[ci]) return false;
    if ((S.gunCd || 0) > 0) return true;
    if (!G.creative() && P.count('munizioni') <= 0) { G.UI.toast('Per i cannoni servono munizioni', 'warn'); S.gunCd = 1; return true; }
    if (!G.creative()) P.take('munizioni', 1);
    S.gunCd = 3.5;
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
    if (G.Audio && G.Audio.roar) G.Audio.roar(); S.shake = 1;
    return e;
  };
  function krakenTarget(e) { const P = G.Player; return P.boat ? S.boatPos(P.boat, new V3()) : new V3(P.pos.x, P.pos.y + 0.5, P.pos.z); }
  function updateKraken(e, dt) {
    const P = G.Player, tgt = krakenTarget(e);
    e.t += dt;
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
      if (!e.dead && T.state === 'idle' && T.t <= 0 && e.rise > 0.85 && e.tents.filter((q) => q.state !== 'idle').length < 2) { T.state = 'lift'; T.t = 1.6; T.target.set(tgt.x + (Math.random() - 0.5) * (P.boat ? P.boat.T.L * 0.6 : 1.5), tgt.y, tgt.z + (Math.random() - 0.5) * (P.boat ? P.boat.T.L * 0.6 : 1.5)); }
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
          G.FX.burst(T.target.x, T.target.y + 0.3, T.target.z, [0.85, 0.93, 0.97], 22, 5, { size: 1.5 }); if (G.Audio) G.Audio.splash();
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

  /* ---------------- NAVI PIRATA ---------------- */
  S.spawnPirates = function (near) {
    const P = G.Player, c = near || P.pos, a0 = Math.random() * 6.28;
    const parts = G.Boats.parts('galeone'), T = G.BOAT_TPL.galeone;
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); G.scene.add(root);
    for (const p of parts) {
      let geo = p.geo;
      // vele nere e lacere: la geometria clonata viene scurita nei colori dei vertici
      if (p.mat === 'cloth') { geo = p.geo.clone(); const c = geo.attributes.color, n = geo.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const k = 0.13 + Math.random() * 0.05; col[i * 3] = k * 1.05; col[i * 3 + 1] = k; col[i * 3 + 2] = k * 0.95; } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
      if (p.mat === 'cloth' && !KM.sail) KM.sail = new THREE.MeshStandardMaterial({ map: G.MAT.cloth.map, normalMap: G.MAT.cloth.normalMap, color: 0x0d0b0a, vertexColors: false, side: THREE.DoubleSide, roughness: 0.95 });
      const m = new THREE.Mesh(geo, p.mat === 'cloth' ? KM.sail : G.Boats.matFor(p)); m.castShadow = true; inner.add(m);
    }
    // bandiera col teschio
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 80; const x = fc.getContext('2d');
    x.fillStyle = '#111'; x.fillRect(0, 0, 128, 80); x.fillStyle = '#eee'; x.beginPath(); x.arc(64, 34, 16, 0, 7); x.fill(); x.fillRect(54, 44, 20, 10); x.fillStyle = '#111'; x.beginPath(); x.arc(58, 32, 4, 0, 7); x.arc(70, 32, 4, 0, 7); x.fill();
    x.strokeStyle = '#eee'; x.lineWidth = 6; x.beginPath(); x.moveTo(36, 56); x.lineTo(92, 72); x.moveTo(92, 56); x.lineTo(36, 72); x.stroke();
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(1.2, 18.5, 0); inner.add(flag);
    // equipaggio sul ponte
    const crew = [];
    for (let i = 0; i < 5; i++) { const pp = G.People.build((Math.random() * 1e6) | 0, { pirate: true, captain: i === 0 }); pp.root.position.set((Math.random() - 0.5) * 3, (T && T.deck) || 2.4, -6 + i * 3); pp.root.rotation.y = Math.random() * 6.28; inner.add(pp.root); crew.push(pp); }
    const pos = new V3(c.x + Math.cos(a0) * 170, G.SEA, c.z + Math.sin(a0) * 170);
    const e = { type: 'pirati', root, inner, crew, pos, yaw: Math.atan2(c.x - pos.x, c.z - pos.z), speed: 0, hp: 360, max: 360, t: 0, gunT: 4, dead: false, deadT: 0, name: 'Nave pirata', flag, L: (T && T.L) || 19 };
    S.enc.push(e);
    G.UI.toast('Vela nera all’orizzonte: PIRATI! Scappa col vento o affrontali (cannoni del galeone, pistole, frecce)', 'warn');
    return e;
  };
  function updatePirates(e, dt) {
    const P = G.Player, tgt = P.boat ? S.boatPos(P.boat, new V3()) : P.pos.clone();
    e.t += dt;
    if (!e.dead) {
      // si porta di fianco al bersaglio, a una quarantina di metri, e spara di bordata
      const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z, dist = Math.hypot(dx, dz);
      const toT = Math.atan2(dx, dz);
      let want = dist > 60 ? toT : toT + Math.PI / 2 * (G.angleDiff(e.yaw, toT + Math.PI / 2) < 0 ? 1 : 1);
      if (dist < 25) want = toT + Math.PI * 0.6;
      e.yaw += G.clamp(G.angleDiff(e.yaw, want), -dt * 0.35, dt * 0.35);
      const vmax = dist > 60 ? 9 : 5.5; e.speed += (vmax - e.speed) * Math.min(1, dt * 0.3);
      e.pos.x += Math.sin(e.yaw) * e.speed * dt; e.pos.z += Math.cos(e.yaw) * e.speed * dt;
      // a terra non ci va
      if (G.heightAt(e.pos.x + Math.sin(e.yaw) * 14, e.pos.z + Math.cos(e.yaw) * 14) > -3) e.yaw += dt * 0.8;
      e.gunT -= dt;
      if (e.gunT <= 0 && dist < 85 && (P.boat || P.swim)) {
        e.gunT = 5 + Math.random() * 3;
        const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw), side = (dx * rx + dz * rz) > 0 ? 1 : -1;
        for (let k = 0; k < 4; k++) { const along = (k - 1.5) * 2.2; const from = new V3(e.pos.x + Math.sin(e.yaw) * along + rx * side * 3, e.pos.y + 2.6, e.pos.z + Math.cos(e.yaw) * along + rz * side * 3); setTimeout(() => !e.dead && S.fireBall(from, tgt, 'pirate', 5 + dist * 0.06), k * 180); }
      }
      if (dist > 320) { e.gone = (e.gone || 0) + dt; if (e.gone > 5) return false; } else e.gone = 0;
    } else {
      e.deadT += dt; e.speed *= Math.pow(0.5, dt);
      if (e.deadT > 12) return false;
    }
    const wy = G.waveHeight(e.pos.x, e.pos.z, G.clock);
    const sinkK = e.dead ? Math.min(1, e.deadT / 11) : 0;
    e.pos.y = wy - 0.9 - sinkK * 16;
    e.root.position.copy(e.pos); e.root.rotation.y = e.yaw;
    const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw);
    const hF = G.waveHeight(e.pos.x + fx * 7, e.pos.z + fz * 7, G.clock), hB = G.waveHeight(e.pos.x - fx * 7, e.pos.z - fz * 7, G.clock);
    e.inner.rotation.x = Math.atan2(hB - hF, 14) + sinkK * 0.5; e.inner.rotation.z = Math.sin(e.t * 0.7) * 0.05 + sinkK * 0.4;
    for (const pp of e.crew) G.People.animate(pp, dt, 0, 'idle', 0);
    e.flag.rotation.y = Math.sin(e.t * 3) * 0.3;
    return true;
  }

  /* ---------------- colpi agli incontri ---------------- */
  S.raycast = function (o, d, max) {
    let best = null;
    for (const e of S.enc) {
      if (e.dead) continue;
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
    e.hp -= dmg;
    if (at) G.FX.burst(at.x, at.y, at.z, e.type === 'kraken' ? [0.3, 0.08, 0.35] : [0.55, 0.4, 0.25], 12, 3);
    if (G.Audio) G.Audio.hit(e.type === 'kraken' ? 'soft' : 'wood');
    S.hpShow = { e, t: 4 };
    if (e.hp <= 0) {
      e.dead = true;
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
    S.gunCd = Math.max(0, (S.gunCd || 0) - dt);
    S.shake = Math.max(0, (S.shake || 0) - dt * 1.5);
    if (S.hpShow) { S.hpShow.t -= dt; if (S.hpShow.t <= 0) S.hpShow = null; }
    for (let i = S.enc.length - 1; i >= 0; i--) { const e = S.enc[i]; const keep = e.type === 'kraken' ? updateKraken(e, dt) : updatePirates(e, dt); if (!keep) { G.scene.remove(e.root); if (e.head) G.scene.remove(e.head); S.enc.splice(i, 1); } }
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
    if (show) { const k = b.hull / S.hullMax(b); hl.querySelector('u').style.width = (k * 100).toFixed(1) + '%'; hl.children[0].textContent = 'Scafo ' + Math.round(k * 100) + '%' + (k < 1 && !e ? ' · assi in mano + clic destro per riparare' : ''); hl.classList.toggle('low', k < 0.3); }
  }
  S.clear = function () { for (const e of S.enc) { G.scene.remove(e.root); if (e.head) G.scene.remove(e.head); } S.enc.length = 0; for (const b of S.balls) G.scene.remove(b.m); S.balls.length = 0; };
})();
