/* =========================================================
   Oggetti a terra (come in Minecraft): si lasciano con Q,
   cadono da animali, alberi e rocce, galleggiano, si raccolgono
   passandoci sopra. In multigiocatore li vedono e prendono tutti.
   ========================================================= */
(function () {
  const D = (G.Drops = { list: [], tex: new Map() });
  const V3 = THREE.Vector3;
  let geo = null;
  function matFor(id) {
    let m = D.tex.get(id); if (m) return m;
    const t = new THREE.TextureLoader().load(G.icon(id)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 }); D.tex.set(id, m); return m;
  }
  function meshFor(st) {
    if (!geo) geo = new THREE.PlaneGeometry(0.42, 0.42);
    const g = new THREE.Group(), n = Math.min(3, Math.ceil(st.n / 16));
    // una pila mostra fino a tre copie sovrapposte
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, matFor(st.id)); m.position.set(i * 0.05, i * 0.03, i * -0.04); m.castShadow = true; g.add(m); }
    return g;
  }
  const uid = () => (G.Net && G.Net.on ? G.Net.id || 'x' : 'l') + ':' + Math.random().toString(36).slice(2, 9);
  // crea un oggetto a terra; remote = arriva da un altro giocatore
  D.spawn = function (st, x, y, z, vx, vy, vz, opt) {
    opt = opt || {};
    const d = { uid: opt.uid || uid(), st: Object.assign({}, st), pos: new V3(x, y, z), vel: new V3(vx || 0, vy || 0, vz || 0), t: 0, delay: opt.delay === undefined ? 0.35 : opt.delay, mesh: meshFor(st), ph: Math.random() * 6.28, rest: false };
    d.mesh.position.copy(d.pos); G.scene.add(d.mesh); D.list.push(d);
    if (!opt.remote && G.Net && G.Net.on) G.Net.send({ t: 'drop', d: { uid: d.uid, st: d.st, p: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], v: [+(vx || 0).toFixed(2), +(vy || 0).toFixed(2), +(vz || 0).toFixed(2)], dl: d.delay } });
    return d;
  };
  // bottino che "salta fuori" da qualcosa (animale, albero, roccia)
  D.pop = function (id, n, x, y, z) {
    if (!n || !G.ITEMS[id]) return;
    const a = Math.random() * 6.28, s = 1 + Math.random() * 1.5;
    D.spawn({ id, n }, x, y + 0.4, z, Math.cos(a) * s, 3 + Math.random() * 1.5, Math.sin(a) * s, { delay: 0.25 });
  };
  // lancia davanti al giocatore (Q): uno solo, o tutta la pila con Ctrl
  D.throwHeld = function (all) {
    const P = G.Player, it = P.held(); if (!it) return false;
    const n = all ? it.n : 1, st = Object.assign({}, it, { n });
    it.n -= n; if (it.n <= 0) P.inv[P.sel] = null;
    D.throwStack(st);
    G.UI.refreshHotbar(); if (G.Audio) G.Audio.click();
    return true;
  };
  D.throwStack = function (st) {
    const P = G.Player, d = P.lookDir(new V3());
    D.spawn(st, P.eye.x + d.x * 0.5, P.eye.y - 0.25 + d.y * 0.5, P.eye.z + d.z * 0.5, d.x * 5.5 + P.vel.x, d.y * 5 + 2.2, d.z * 5.5 + P.vel.z, { delay: 1.4 });
  };
  D.remove = function (d, net) {
    G.scene.remove(d.mesh); const i = D.list.indexOf(d); if (i >= 0) D.list.splice(i, 1);
    if (net && G.Net && G.Net.on) G.Net.send({ t: 'dpick', uid: d.uid });
  };
  D.onNet = function (m) {
    if (m.t === 'drop') { const q = m.d; if (!q || !q.st || !G.ITEMS[q.st.id] || D.list.some((x) => x.uid === q.uid)) return; D.spawn(q.st, q.p[0], q.p[1], q.p[2], q.v[0], q.v[1], q.v[2], { remote: true, uid: q.uid, delay: q.dl }); }
    else if (m.t === 'dpick') { const d = D.list.find((x) => x.uid === m.uid); if (d) D.remove(d, false); }
  };
  D.clear = function () { for (const d of D.list) G.scene.remove(d.mesh); D.list.length = 0; };
  // quanto ne entra nell'inventario
  function room(P, st) {
    const def = G.ITEMS[st.id], max = def.stack || 64; let r = 0;
    for (const s of P.inv) { if (!s) r += max; else if (s.id === st.id && !s.d && !st.d) r += Math.max(0, max - s.n); }
    return r;
  }
  D.update = function (dt, P) {
    for (let i = D.list.length - 1; i >= 0; i--) {
      const d = D.list[i]; d.t += dt; d.delay -= dt;
      // fisica: gravità, terreno, costruzioni, acqua (galleggia)
      if (!d.rest) {
        d.vel.y -= 18 * dt; d.pos.addScaledVector(d.vel, dt);
        const g = Math.max(G.Dig ? G.Dig.ground(d.pos.x, d.pos.z, d.pos.y + 0.3) : G.World.groundAt(d.pos.x, d.pos.z), G.Build.groundAt(d.pos.x, d.pos.z, d.pos.y + 0.3, 0.05));
        const wy = G.waterLevelAt ? G.waterLevelAt(d.pos.x, d.pos.z, G.clock, d.pos.y) : G.SEA;
        if (d.pos.y < wy - 0.05 && wy > g) { d.vel.multiplyScalar(Math.pow(0.15, dt)); d.vel.y += (wy - 0.05 - d.pos.y) * 30 * dt; d.wet = true; }
        if (d.pos.y < g + 0.18) { d.pos.y = g + 0.18; if (d.vel.y < 0) d.vel.y *= -0.25; d.vel.x *= Math.pow(0.02, dt); d.vel.z *= Math.pow(0.02, dt); if (Math.abs(d.vel.y) < 0.5 && Math.hypot(d.vel.x, d.vel.z) < 0.2) { d.rest = true; d.ground = g; } }
      } else if (d.wet) { d.pos.y = (G.waterLevelAt ? G.waterLevelAt(d.pos.x, d.pos.z, G.clock, d.pos.y) : G.SEA) + 0.05; }
      d.ph += dt * 2;
      d.mesh.position.set(d.pos.x, d.pos.y + (d.rest ? Math.sin(d.ph) * 0.06 + 0.06 : 0), d.pos.z);
      d.mesh.rotation.y += dt * 1.6;
      // raccolta: calamita vicino al giocatore
      if (d.delay <= 0 && P.health > 0) {
        const dx = P.pos.x - d.pos.x, dy = P.pos.y + 0.7 - d.pos.y, dz = P.pos.z - d.pos.z, dist = Math.hypot(dx, dy, dz);
        // in barca il raggio è un po' più ampio, così si ripesca il bottino che galleggia passandoci accanto
        if (dist < (P.boat ? 3.6 : 2.4)) {
          const r = room(P, d.st);
          if (r > 0) {
            if (dist < 0.9) {
              const take = Math.min(r, d.st.n);
              if (d.st.d) { const j = P.inv.indexOf(null); if (j >= 0) P.inv[j] = Object.assign({}, d.st); } else P.give(d.st.id, take, true);
              G.UI.pickup(d.st.id, take); if (G.Audio) G.Audio.pickup ? G.Audio.pickup() : G.Audio.click();
              d.st.n -= take;
              if (d.st.n <= 0 || d.st.d) { D.remove(d, true); continue; }
            } else { d.rest = false; d.wet = false; const k = Math.min(1, dt * 9); d.pos.x += dx * k; d.pos.y += dy * k; d.pos.z += dz * k; d.vel.set(0, 0, 0); }
          }
        }
      }
      if (d.t > 300) D.remove(d, false); // dopo 5 minuti spariscono
    }
  };
})();
