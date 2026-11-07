/* =========================================================
   Tutto si smonta: castelli, villaggi, covi e rovine si rompono
   a blocchi di 3 metri (piccone per la pietra, ascia per il legno).
   Ogni blocco tolto sparisce davvero (anche dalle collisioni),
   resta tolto nel salvataggio e ti dà il pezzo di costruzione
   corrispondente (muro o pavimento, di pietra o di legno) da
   ripiazzare dove vuoi.
   ========================================================= */
(function () {
  const D = (G.Demo = {});
  const CELL = 3, MAXU = 48;
  D.U = { uCut: { value: Array.from({ length: MAXU }, () => new THREE.Vector4(0, -9999, 0, 0)) }, uCutN: { value: 0 } };
  D.cells = new Map(); // chiave → [cx, cy, cz] centro
  let seenSize = -1;
  const key = (i, j, k) => `cut:${i},${j},${k}`;
  function sync() {
    const R = G.state && G.state.removed; if (!R) return;
    if (R.size === seenSize) return; seenSize = R.size;
    D.cells.clear();
    for (const id of R) if (id.startsWith('cut:')) { const [i, j, k] = id.slice(4).split(',').map(Number); D.cells.set(id, [(i + 0.5) * CELL, (j + 0.5) * CELL, (k + 0.5) * CELL]); }
  }
  D.sync = () => { seenSize = -1; sync(); };
  // toglie i blocchi rotti dalle collisioni dei luoghi (una scatola meno un cubo = fino a 6 scatole)
  function sub(b, c, h, out) {
    const x0 = c[0] - h, x1 = c[0] + h, y0 = c[1] - h, y1 = c[1] + h, z0 = c[2] - h, z1 = c[2] + h;
    if (b.x1 <= x0 || b.x0 >= x1 || b.y1 <= y0 || b.y0 >= y1 || b.z1 <= z0 || b.z0 >= z1) { out.push(b); return; }
    const mk = (o) => { const n = Object.assign({}, b, o); if (n.x1 - n.x0 > 0.02 && n.y1 - n.y0 > 0.02 && n.z1 - n.z0 > 0.02) out.push(n); };
    if (b.x0 < x0) mk({ x1: x0 }); if (b.x1 > x1) mk({ x0: x1 });
    const cx0 = Math.max(b.x0, x0), cx1 = Math.min(b.x1, x1);
    if (b.y0 < y0) mk({ x0: cx0, x1: cx1, y1: y0 }); if (b.y1 > y1) mk({ x0: cx0, x1: cx1, y0: y1 });
    const cy0 = Math.max(b.y0, y0), cy1 = Math.min(b.y1, y1);
    if (b.z0 < z0) mk({ x0: cx0, x1: cx1, y0: cy0, y1: cy1, z1: z0 }); if (b.z1 > z1) mk({ x0: cx0, x1: cx1, y0: cy0, y1: cy1, z0: z1 });
  }
  D.filter = function (cols) {
    sync(); if (!D.cells.size) return cols;
    let cur = cols;
    for (const c of D.cells.values()) { const nx = []; for (const b of cur) sub(b, c, CELL / 2, nx); cur = nx; }
    return cur;
  };
  D.refresh = function () {
    const S = G.Structures; if (!S || !S.active) return;
    const all = []; for (const a of S.active.values()) if (a.near) all.push(...a.cols);
    G.Build.setExtra(D.filter(all));
  };
  // raggio contro le collisioni dei luoghi (solo quelle generate, non i tuoi pezzi)
  function rayBox(o, d, b) {
    let t0 = 0, t1 = 1e9;
    for (const [oa, da, a0, a1] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
      if (Math.abs(da) < 1e-9) { if (oa < a0 || oa > a1) return -1; continue; }
      let ta = (a0 - oa) / da, tb = (a1 - oa) / da; if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
    }
    return t0;
  }
  D.raycast = function (o, d, max) {
    let bt = max, best = null;
    for (const b of G.Build.extra) { if (b.soft) continue; const t = rayBox(o, d, b); if (t >= 0 && t < bt) { bt = t; best = b; } }
    return best ? { t: bt, box: best } : null;
  };
  // di che cosa è fatto il luogo qui intorno
  function areaAt(x, z) {
    let best = null, bd = 1e9;
    for (const a of G.Structures.active.values()) { if (!a.near) continue; const d = Math.hypot(a.poi.x - x, a.poi.z - z); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  const STONE_T = new Set(['castello', 'covo', 'faro', 'rovine', 'tempio', 'fortino', 'torre']);
  const WOOD_S = new Set(['baite', 'alberi', 'palafitte']);
  function stoneAt(x, z) { const a = areaAt(x, z); if (!a) return true; const p = a.poi; if (p.type === 'village') return !WOOD_S.has(p.style); return STONE_T.has(p.type) || p.type === 'castello'; }
  const hits = new Map();
  // un colpo d'attrezzo su un luogo: dopo abbastanza colpi il blocco si stacca
  D.hit = function (P, tool, pow, o, d, max) {
    const h = D.raycast(o, d, max); if (!h) return false;
    const p = new THREE.Vector3().copy(o).addScaledVector(d, h.t + 0.08);
    const i = Math.floor(p.x / CELL), j = Math.floor(p.y / CELL), k = Math.floor(p.z / CELL), id = key(i, j, k);
    const stone = stoneAt(p.x, p.z);
    if (stone && tool !== 'piccone' && !G.creative()) { if (!D._w || performance.now() - D._w > 3000) { D._w = performance.now(); G.UI.toast('Per smontare la pietra serve il piccone'); } return true; }
    if (!stone && tool !== 'ascia' && tool !== 'piccone' && !G.creative()) { if (!D._w || performance.now() - D._w > 3000) { D._w = performance.now(); G.UI.toast('Per smontare il legno serve l’ascia'); } return true; }
    const need = (stone ? 7 : 4) / Math.max(0.5, pow || 1);
    const n = (hits.get(id) || 0) + (G.creative() ? 99 : 1); hits.set(id, n);
    G.FX.burst(p.x, p.y, p.z, stone ? [0.62, 0.6, 0.56] : [0.6, 0.45, 0.3], 7, 2.2);
    if (G.Audio) G.Audio.hit(stone ? 'stone' : 'wood');
    if (n < need) return true;
    hits.delete(id);
    // cosa c'era nel blocco: pavimento (largo e basso) o muro
    const c = [(i + 0.5) * CELL, (j + 0.5) * CELL, (k + 0.5) * CELL], inCell = [];
    for (const b of G.Build.extra) { const o2 = []; sub(b, c, CELL / 2, o2); if (o2.length !== 1 || o2[0] !== b) inCell.push(b); }
    if (!inCell.length) return true;
    let floor = 0, wall = 0;
    for (const b of inCell) { const hh = Math.min(b.y1, c[1] + 1.5) - Math.max(b.y0, c[1] - 1.5), ww = Math.max(Math.min(b.x1, c[0] + 1.5) - Math.max(b.x0, c[0] - 1.5), Math.min(b.z1, c[2] + 1.5) - Math.max(b.z0, c[2] - 1.5)); if (hh < 0.8 && ww > 1) floor++; else wall++; }
    G.state.removed.add(id);
    if (G.Net && G.Net.on) G.Net.send({ t: 'rm', id });
    D.sync(); D.refresh(); D.uniforms(true);
    P._popPos = { x: p.x, y: p.y, z: p.z };
    const give = (t) => P.give(stone ? t + '_pietra' : t, 1);
    if (wall) give('muro'); if (floor) give('pavimento'); if (!wall && !floor) give('muro');
    if (stone && Math.random() < 0.5) P.give('pietra', 2); else if (!stone && Math.random() < 0.5) P.give('assi', 2);
    P._popPos = null;
    G.FX.burst(c[0], c[1], c[2], stone ? [0.62, 0.6, 0.56] : [0.6, 0.45, 0.3], 22, 4);
    if (G.Audio) G.Audio.hit(stone ? 'stone' : 'wood');
    G.saveSoon && G.saveSoon();
    return true;
  };
  // i blocchi tolti più vicini alla camera vanno allo shader (che li fa sparire)
  let ut = 0;
  D.uniforms = function (force) {
    sync();
    if (!force && (ut -= 1) > 0) return; ut = 30;
    const cam = G.camera ? G.camera.position : { x: 0, y: 0, z: 0 };
    const list = [...D.cells.values()].map((c) => [c, Math.hypot(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z)]).filter((x) => x[1] < 700).sort((a, b) => a[1] - b[1]).slice(0, MAXU);
    list.forEach(([c], i) => D.U.uCut.value[i].set(c[0], c[1], c[2], CELL / 2 + 0.01));
    D.U.uCutN.value = list.length;
  };
})();
