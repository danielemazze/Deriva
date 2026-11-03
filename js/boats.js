'use strict';
/* ==========================================================
   Barche: progetti, sagome olografiche, riempimento, guida
   ========================================================== */
(function () {
  const G = globalThis.G;
  const BT = (G.Boats = { list: [], wind: { dir: 0.6, str: 0.8 } });
  const M = G.MODELS;
  const V3 = THREE.Vector3;

  /* ---------- scafo procedurale ---------- */
  function hullShape(L, W, D, sheer) {
    const hw = (t) => (t >= 0.42 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.58, 2))) : 0.7 + 0.3 * Math.sqrt(Math.max(0, 1 - Math.pow((0.42 - t) / 0.42, 2)))) * W / 2;
    const kd = (t) => D * 0.62 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.05)));
    const gw = (t) => D * 0.38 + sheer * Math.pow(t - 0.45, 2) * 4;
    return { hw, kd, gw };
  }
  function hullSide(L, W, D, sheer, side, rows) {
    const H = hullShape(L, W, D, sheer), NS = 56, NV = 18;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, z = (t - 0.5) * L;
      for (let j = 0; j <= NV; j++) {
        const s = j / NV;
        const x = side * H.hw(t) * Math.pow(Math.sin((s * Math.PI) / 2), 0.55);
        const y = G.lerp(-H.kd(t), H.gw(t), Math.pow(s, 1.25));
        pos.push(x, y, z); uv.push(t * L / 2.5, s * rows / 4);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    // fascia scura sotto la linea di galleggiamento
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = p.getY(i) < -0.05 ? 0.55 : 1.0; c[i * 3] = k; c[i * 3 + 1] = k * 0.95; c[i * 3 + 2] = k * 0.9; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const bord = new THREE.BoxGeometry(0.12, 0.12, 1); // capodibanda
    const rail = [];
    for (let i = 0; i < NS; i++) {
      const t0 = i / NS, t1 = (i + 1) / NS;
      const a = new V3(side * H.hw(t0), H.gw(t0), (t0 - 0.5) * L), b = new V3(side * H.hw(t1), H.gw(t1), (t1 - 0.5) * L);
      const len = a.distanceTo(b); if (len < 0.01) continue;
      const r = bord.clone(); r.scale(1, 1, len);
      const m = new THREE.Matrix4().lookAt(b, a, new V3(0, 1, 0)); m.setPosition(a.clone().lerp(b, 0.5));
      r.applyMatrix4(m); M.colorize(r, 0.7, 0.62, 0.55); rail.push(r);
    }
    return M.merge([g, ...rail]);
  }
  function deckGeo(L, W, D, sheer, yOff, hole) {
    const H = hullShape(L, W, D, sheer), NS = 48, pos = [], uv = [], idx = [];
    const y = D * 0.38 - (yOff || 0.25);
    if (hole) {
      // ponte con il boccaporto: le fasce che toccano l'apertura si dividono in due
      const zs = []; for (let i = 0; i <= NS; i++) zs.push((i / NS - 0.5) * L);
      zs.push(hole.z - hole.hz, hole.z + hole.hz); zs.sort((a, b) => a - b);
      const quad = (x0, x1, z0, z1) => { const n = pos.length / 3; const w0 = (x) => x; pos.push(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1); uv.push(x0 / 2, (z0 / L + 0.5) * L / 2, x1 / 2, (z0 / L + 0.5) * L / 2, x0 / 2, (z1 / L + 0.5) * L / 2, x1 / 2, (z1 / L + 0.5) * L / 2); idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
      for (let i = 0; i < zs.length - 1; i++) {
        const z0 = zs[i], z1 = zs[i + 1]; if (z1 - z0 < 1e-4) continue;
        const w0 = H.hw(z0 / L + 0.5) * 0.96, w1 = H.hw(z1 / L + 0.5) * 0.96, w = Math.min(w0, w1);
        const zm = (z0 + z1) / 2;
        if (zm > hole.z - hole.hz && zm < hole.z + hole.hz) { quad(-w, -hole.hx, z0, z1); quad(hole.hx, w, z0, z1); }
        else quad(-w, w, z0, z1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // bordo rialzato attorno all'apertura
      const fr = [box(hole.hx * 2 + 0.3, 0.16, 0.15, 0, y + 0.08, hole.z - hole.hz - 0.07), box(hole.hx * 2 + 0.3, 0.16, 0.15, 0, y + 0.08, hole.z + hole.hz + 0.07), box(0.15, 0.16, hole.hz * 2, -hole.hx - 0.07, y + 0.08, hole.z), box(0.15, 0.16, hole.hz * 2, hole.hx + 0.07, y + 0.08, hole.z)];
      return M.merge([M.colorize(g, 1, 1, 1), ...fr.map((b) => M.colorize(b, 0.6, 0.45, 0.32))]);
    }
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, z = (t - 0.5) * L, w = H.hw(t) * 0.96;
      pos.push(-w, y, z, w, y, z); uv.push(-w / 2, t * L / 2, w / 2, t * L / 2);
      if (i < NS) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return M.colorize(g, 1, 1, 1);
  }
  // mezza larghezza interna dello scafo a una certa altezza (per il ponte di sotto)
  function hullXAt(H, t, y) { const kd = H.kd(t), gw = H.gw(t); const f = G.clamp((y + kd) / (gw + kd), 0, 1); const s = Math.pow(f, 0.8); return H.hw(t) * Math.pow(Math.sin((s * Math.PI) / 2), 0.55); }
  // un segmento di corda (cilindro sottile) da a a b
  function seg(a, b, r) { const d = new V3().subVectors(b, a), len = d.length(); const g = new THREE.CylinderGeometry(r, r, len, 8); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); return g; }
  // altezza della coffa (piattaforma) su un albero
  function rigTop(T, t, h) { return T.D && (T === TPL.galeone || T === TPL.vascello) ? T.D * 0.38 - 0.18 + (h - 3) * 0.5 + 2 : T.D * 0.38 - 0.18 + (h - 2.4) * 0.55 + 1.75; }
  // sartie con le griselle (la scala di corda) su un lato
  function ratlines(r, sd) {
    const out = [], n = 5, bot = [], top = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1) - 0.5; bot.push(new V3(sd * r.bx, r.by, r.bz + f * 1.6)); top.push(new V3(sd * 0.55, r.top, r.tz + f * 0.3)); out.push(seg(bot[i], top[i], 0.03)); }
    for (let y = r.by + 0.42; y < r.top - 0.2; y += 0.42) { const k = (y - r.by) / (r.top - r.by); out.push(seg(bot[0].clone().lerp(top[0], k), bot[n - 1].clone().lerp(top[n - 1], k), 0.018)); }
    return M.colorize(M.merge(out), 0.42, 0.34, 0.24);
  }
  // ponte di sotto del vascello: pavimento, paratie, scala al boccaporto, cannoni, barili, tavolo
  function lowerDeckGeo(T) {
    const H = T.H, L = T.L, y = T.lowerY, [z0, z1] = T.lowerZ, out = [];
    const NS = 16, fl = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) { const z = z0 + (z1 - z0) * i / NS, t = z / L + 0.5, w = hullXAt(H, t, y) * 0.97; fl.push(-w, y, z, w, y, z); uv.push(-w / 2, z / 2, w / 2, z / 2); if (i < NS) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fl, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); out.push(M.colorize(g, 0.55, 0.45, 0.36));
    for (const z of [z0, z1]) { const t = z / L + 0.5, w = hullXAt(H, t, T.deck) * 0.98, hgt = T.deck - y; out.push(M.colorize(box(w * 2, hgt, 0.12, 0, y + hgt / 2, z), 0.42, 0.33, 0.25)); }
    // travi del soffitto
    for (let z = z0 + 1; z < z1; z += 1.8) { const t = z / L + 0.5, w = hullXAt(H, t, T.deck - 0.3); out.push(M.colorize(box(w * 2, 0.2, 0.2, 0, T.deck - 0.28, z), 0.3, 0.22, 0.15)); }
    // scala verso il boccaporto
    const [hx, hz] = T.hatch, hgt = T.deck - y;
    { const run = 1.7, a = Math.atan2(hgt, run), len = Math.hypot(hgt, run);
      for (const sx of [-0.34, 0.34]) { const r = box(0.08, 0.22, len + 0.2, 0, 0, 0); r.rotateX(-a); r.translate(hx + sx, y + hgt / 2 - 0.05, hz); out.push(M.colorize(r, 0.45, 0.33, 0.2)); }
      for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9; out.push(M.colorize(box(0.62, 0.05, 0.24, hx, y + k * hgt - 0.03, hz - run / 2 + k * run), 0.6, 0.45, 0.3)); }
      // corrimano
      for (const sx of [-0.4, 0.4]) { const r = cyl(0.025, 0.025, len, 0, 0, 0, Math.PI / 2 - a, 0); r.translate(hx + sx, y + hgt / 2 + 0.85, hz); out.push(M.colorize(r, 0.4, 0.3, 0.2)); } }
    // cannoni ai portelli (lato sinistro e destro) e portelli chiusi
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) {
      const z = z0 + 1.2 + i * (z1 - z0 - 2.4) / 5, t = z / L + 0.5, w = hullXAt(H, t, y + 0.9);
      out.push(M.colorize(box(0.6, 0.35, 0.6, sd * (w - 0.95), y + 0.22, z), 0.32, 0.2, 0.11));
      out.push(M.colorize(box(0.06, 0.55, 0.6, sd * (w - 0.04), y + 1.0, z), 0.12, 0.08, 0.05));
    }
    // barili, casse e un tavolo
    for (const [bx, bz] of [[-1.4, z1 - 0.7], [-0.6, z1 - 0.6], [1.3, z0 + 0.7], [0.6, z0 + 0.6]]) { out.push(M.colorize(cyl(0.34, 0.38, 0.85, bx, y + 0.43, bz), 0.42, 0.26, 0.13)); out.push(M.colorize(cyl(0.37, 0.37, 0.06, bx, y + 0.62, bz), 0.12, 0.12, 0.12)); }
    for (const [cx, cy, cz] of [[1.4, 0.35, z1 - 0.8], [2.0, 0.35, z1 - 0.8], [1.7, 0.95, z1 - 0.8]]) out.push(M.colorize(box(0.6, 0.6, 0.6, cx, y + cy, cz), 0.55, 0.4, 0.26));
    out.push(M.colorize(box(1.6, 0.08, 0.9, 0, y + 0.8, z0 + 2.4), 0.55, 0.4, 0.26)); for (const [lx, lz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) out.push(M.colorize(box(0.08, 0.8, 0.08, lx, y + 0.4, z0 + 2.4 + lz), 0.3, 0.22, 0.15));
    return M.merge(out);
  }

  /* ---------- cassero e castello: muri che seguono lo scafo, ponte rialzato, paratia con la porta ---------- */
  // muro spesso lungo un percorso [[x,z],...] da yb(i) a yt(i)
  function wallPath(path, yb, yt, th) {
    const pos = [], uv = [], idx = []; let acc = 0;
    const n = path.length, nrm = path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; });
    const quad = (a, b, c, d) => { const o = pos.length / 3; idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); };
    for (let side = 0; side < 2; side++) {
      acc = 0;
      for (let i = 0; i < n; i++) {
        if (i) acc += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        const off = side ? -th : 0, x = path[i][0] + nrm[i][0] * off, z = path[i][1] + nrm[i][1] * off;
        pos.push(x, yb(i), z, x, yt(i), z); uv.push(acc / 2.2, yb(i) / 2.2, acc / 2.2, yt(i) / 2.2);
      }
      const o = side * n * 2;
      for (let i = 0; i < n - 1; i++) { const a = o + i * 2; if (side) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    // bordo superiore
    const o2 = pos.length / 3;
    for (let i = 0; i < n; i++) { const x = path[i][0], z = path[i][1]; pos.push(x, yt(i), z, x + nrm[i][0] * -th, yt(i), z + nrm[i][1] * -th); uv.push(i * 0.3, 0, i * 0.3, 0.1); }
    for (let i = 0; i < n - 1; i++) { const a = o2 + i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return M.colorize(g, 1, 1, 1);
  }
  // lastra orizzontale tra z0 e z1 con mezza larghezza w(z)
  function slab(z0, z1, w, y, th, N) {
    const pos = [], uv = [], idx = [];
    for (const [yy, up] of [[y, 1], [y - th, 0]]) {
      const o = pos.length / 3;
      for (let i = 0; i <= N; i++) { const z = z0 + (z1 - z0) * i / N, ww = w(z); pos.push(-ww, yy, z, ww, yy, z); uv.push(-ww / 2, z / 2, ww / 2, z / 2); }
      for (let i = 0; i < N; i++) { const a = o + i * 2; if (up) idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return M.colorize(g, 1, 1, 1);
  }
  // ringhiera con colonnine tra x0 e x1 a quota y, lungo z
  function railing(x0, x1, y, z, out, gaps) {
    const inGap = (x) => (gaps || []).some(([a, b]) => Math.abs(x) > a - 0.02 && Math.abs(x) < b + 0.02);
    for (let x = x0; x <= x1 + 1e-3; x += 0.24) if (!inGap(x)) out.push(M.colorize(cyl(0.035, 0.045, 0.8, x, y + 0.4, z), 0.62, 0.5, 0.38));
    const segs = [[x0, x1]]; for (const [a, b] of gaps || []) for (const sd of [-1, 1]) { const s0 = sd < 0 ? -b : a, s1 = sd < 0 ? -a : b; for (let i = segs.length - 1; i >= 0; i--) { const [p, q] = segs[i]; if (s1 <= p || s0 >= q) continue; segs.splice(i, 1, ...[[p, s0], [s1, q]].filter(([u, v]) => v - u > 0.05)); } }
    for (const [a, b] of segs) { out.push(M.colorize(box(b - a, 0.08, 0.12, (a + b) / 2, y + 0.84, z), 0.5, 0.38, 0.26)); out.push(M.colorize(box(b - a, 0.06, 0.08, (a + b) / 2, y + 0.06, z), 0.5, 0.38, 0.26)); }
  }
  function stairs(x, zTop, run, y0, y1, out, dir) {
    const n = Math.max(6, Math.round((y1 - y0) / 0.24)), w = 0.68;
    for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, z = zTop + dir * run * (1 - k); out.push(M.colorize(box(w, 0.06, run / n + 0.06, x, y0 + k * (y1 - y0) - 0.03, z), 0.66, 0.52, 0.38)); out.push(M.colorize(box(w, (y1 - y0) / n, 0.04, x, y0 + (i + 0.5) / n * (y1 - y0) - (y1 - y0) / n / 2, z + dir * (run / n) / 2), 0.5, 0.38, 0.27)); }
    const len = Math.hypot(run, y1 - y0), a = Math.atan2(y1 - y0, run);
    for (const sx of [-w / 2 - 0.04, w / 2 + 0.04]) { const r = box(0.08, 0.26, len, 0, 0, 0); r.rotateX(dir * a); r.translate(x + sx, (y0 + y1) / 2 - 0.08, zTop + dir * run / 2); out.push(M.colorize(r, 0.42, 0.31, 0.21)); }
  }
  function castleGeo(T, which) {
    const H = T.H, L = T.L, C = T.castles[which], deck = T.deck, out = [], aft = which === 'q';
    const zb = C.z1, zEnd = aft ? -L / 2 + 0.02 : L / 2 - 0.35, y = C.y;
    const hwAt = (z) => H.hw(z / L + 0.5) * 0.985;
    // muri laterali (sopra la murata, fino al parapetto)
    const N = 22, path = (sd) => { const p = []; for (let i = 0; i <= N; i++) { const z = zb + (zEnd - zb) * i / N; p.push([sd * hwAt(z), z]); } return aft === (sd > 0) ? p.reverse() : p; };
    for (const sd of [-1, 1]) { const p = path(sd); out.push(wallPath(p, (i) => H.gw(p[i][1] / L + 0.5) - 0.12, () => y + 0.95, 0.12)); }
    // specchio di poppa con le finestre della galleria
    if (aft) {
      const w = hwAt(zEnd);
      out.push(wallPath([[w, zEnd], [-w, zEnd]], () => H.gw(0) - 0.3, () => y + 1.25, 0.14));
      for (let i = 0; i < 4; i++) { const x = -w * 0.62 + i * (w * 1.24 / 3);
        out.push(M.colorize(box(0.56, 0.78, 0.06, x, deck + 1.25, zEnd - 0.04), 0.86, 0.72, 0.5)); out.push(M.colorize(box(0.44, 0.66, 0.07, x, deck + 1.25, zEnd - 0.045), 0.08, 0.1, 0.12)); out.push(M.colorize(box(0.04, 0.66, 0.08, x, deck + 1.25, zEnd - 0.05), 0.86, 0.72, 0.5)); }
      out.push(M.colorize(box(w * 2 + 0.2, 0.12, 0.5, 0, deck + 0.75, zEnd - 0.22), 0.5, 0.38, 0.26)); // balconata
      for (let x = -w; x <= w + 1e-3; x += 0.3) out.push(M.colorize(cyl(0.03, 0.03, 0.55, x, deck + 1.05, zEnd - 0.42), 0.62, 0.5, 0.38));
      out.push(M.colorize(box(w * 2 + 0.2, 0.07, 0.08, 0, deck + 1.33, zEnd - 0.42), 0.5, 0.38, 0.26));
      for (const x of [-w + 0.2, 0, w - 0.2]) { out.push(M.colorize(box(0.24, 0.34, 0.24, x, y + 1.6, zEnd + 0.1), 0.95, 0.8, 0.45)); out.push(M.colorize(cyl(0.03, 0.03, 0.4, x, y + 1.25, zEnd + 0.1), 0.2, 0.2, 0.2)); }
    } else {
      // punta del castello: parapetto a V verso il bompresso
      const w = hwAt(zEnd); out.push(wallPath([[w, zEnd], [0, zEnd + 0.3], [-w, zEnd]], () => y - 0.1, () => y + 0.95, 0.12));
    }
    // ponte rialzato
    out.push(slab(Math.min(zb, zEnd), Math.max(zb, zEnd), (z) => hwAt(z) - 0.05, y, 0.16, 20));
    // travi sotto il ponte (si vedono dalla cabina)
    for (let k = 1; k < 5; k++) { const z = zb + (zEnd - zb) * k / 5; out.push(M.colorize(box(hwAt(z) * 2 - 0.2, 0.18, 0.16, 0, y - 0.25, z), 0.36, 0.27, 0.18)); }
    // paratia con la porta e due finestrelle
    const wb = hwAt(zb) - 0.06, D = T.castles.door, dz = aft ? 0.06 : -0.06;
    out.push(wallPath([[-wb, zb], [-D, zb]], () => deck - 0.05, () => y, 0.12), wallPath([[D, zb], [wb, zb]], () => deck - 0.05, () => y, 0.12), wallPath([[-D, zb], [D, zb]], () => deck + 2.0, () => y, 0.12));
    for (const sd of [-1, 1]) { out.push(M.colorize(box(0.12, 2.05, 0.2, sd * (D + 0.06), deck + 1.0, zb + dz), 0.42, 0.3, 0.2)); out.push(M.colorize(box(0.5, 0.42, 0.05, sd * (wb * 0.62), deck + 1.45, zb + dz * 2.2), 0.08, 0.1, 0.12)); out.push(M.colorize(box(0.6, 0.06, 0.1, sd * (wb * 0.62), deck + 1.2, zb + dz * 2.2), 0.6, 0.48, 0.34)); }
    out.push(M.colorize(box(D * 2 + 0.24, 0.14, 0.2, 0, deck + 2.07, zb + dz), 0.42, 0.3, 0.2));
    // porta aperta verso l'interno
    { const d = box(D * 2 - 0.04, 1.96, 0.06, 0, 0, 0); d.translate(D - 0.02, 0, 0); d.rotateY(aft ? 1.75 : -1.75); d.translate(-D, deck + 0.99, zb - dz * 1.2); out.push(M.colorize(d, 0.55, 0.38, 0.24)); }
    // ringhiera davanti, con i varchi delle scale
    railing(-wb, wb, y, zb + dz * 0.4, out, [C.sx]);
    // scale che salgono dal ponte di coperta
    for (const sd of [-1, 1]) stairs(sd * (C.sx[0] + C.sx[1]) / 2, zb + (aft ? 0.02 : -0.02), C.run, deck, y, out, aft ? 1 : -1);
    // arredo della cabina: tavolo, panca, lanterna
    { const zc = (zb + zEnd) / 2 + (aft ? 0.4 : -0.3);
      out.push(M.colorize(box(1.3, 0.07, 0.8, 0, deck + 0.78, zc), 0.5, 0.34, 0.2)); for (const [lx, lz] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) out.push(M.colorize(box(0.07, 0.76, 0.07, lx, deck + 0.38, zc + lz), 0.34, 0.24, 0.15));
      out.push(M.colorize(box(1.2, 0.07, 0.34, 0, deck + 0.45, zc + (aft ? 0.75 : -0.75)), 0.46, 0.32, 0.2));
      out.push(M.colorize(box(0.18, 0.24, 0.18, 0, y - 0.55, zc), 0.95, 0.8, 0.45)); }
    return M.merge(out);
  }
  function lowerCannonsGeo(T) {
    const H = T.H, L = T.L, y = T.lowerY, [z0, z1] = T.lowerZ, out = [];
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) { const z = z0 + 1.2 + i * (z1 - z0 - 2.4) / 5, w = hullXAt(H, z / L + 0.5, y + 0.9); out.push(M.colorize(cyl(0.13, 0.17, 1.4, sd * (w - 0.75), y + 0.62, z, 0, -sd * Math.PI / 2), 0.07, 0.07, 0.075)); }
    return M.merge(out);
  }
  function lanternsGeo(T) { const out = []; for (const z of [T.lowerZ[0] + 2.2, T.hatch[1] - 2.2, T.lowerZ[1] - 2.2]) { out.push(M.colorize(box(0.2, 0.28, 0.2, 1.1, T.deck - 0.6, z), 1, 1, 1)); out.push(M.colorize(cyl(0.015, 0.015, 0.3, 1.1, T.deck - 0.32, z), 0.2, 0.2, 0.2)); } return M.merge(out); }
  function keelGeo(L, W, D, sheer) {
    const H = hullShape(L, W, D, sheer), parts = [];
    for (let i = 0; i < 32; i++) {
      const t0 = i / 32, t1 = (i + 1) / 32;
      const a = new V3(0, -H.kd(t0) - 0.06, (t0 - 0.5) * L), b = new V3(0, -H.kd(t1) - 0.06, (t1 - 0.5) * L);
      const g = new THREE.BoxGeometry(0.16, 0.18, a.distanceTo(b) + 0.02);
      const m = new THREE.Matrix4().lookAt(b, a, new V3(0, 1, 0)); m.setPosition(a.clone().lerp(b, 0.5)); g.applyMatrix4(m); parts.push(g);
    }
    // ruota di prua e specchio di poppa
    const stem = new THREE.CylinderGeometry(0.09, 0.1, H.gw(1) + H.kd(1) + 0.4, 6); stem.rotateX(-0.25); stem.translate(0, (H.gw(1) - H.kd(1)) / 2 + 0.15, L / 2 + 0.05); parts.push(stem);
    const tw = H.hw(0) * 2, tr = new THREE.BoxGeometry(tw * 0.98, H.gw(0) + H.kd(0), 0.1); tr.translate(0, (H.gw(0) - H.kd(0)) / 2, -L / 2); parts.push(tr);
    return M.merge(parts);
  }
  function cyl(r0, r1, h, x, y, z, rx, rz, c) { const g = new THREE.CylinderGeometry(r0, r1, h, 20); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return c ? M.colorize(g, c[0], c[1], c[2]) : g; }
  function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2, uv.getY(i) * Math.max(h, d) / 2); g.translate(x, y, z); return M.colorize(g, 1, 1, 1); }
  function oar(x, y, z, side, len) {
    const shaft = cyl(0.035, 0.035, len, 0, 0, 0, 0, Math.PI / 2, [1.1, 1.1, 1.1]);
    const blade = box(0.5, 0.03, 0.2, -len / 2 - 0.2, 0, 0);
    const g = M.merge([shaft, blade]);
    g.rotateZ(side < 0 ? 0.35 : Math.PI - 0.35); g.translate(x, y, z); return g;
  }
  function sailGeo(w, h, billow, x, y, z) {
    const g = new THREE.PlaneGeometry(w, h, 10, 10); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = p.getY(i) / h + 0.5; p.setZ(i, Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.9 + 0.1) * billow); }
    g.computeVertexNormals(); g.rotateY(Math.PI / 2); g.translate(x, y, z);
    return M.colorize(g, 1, 1, 1);
  }
  function rope(a, b) { const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(0.018, 0.018, len, 6); g.rotateX(Math.PI / 2); const m = new THREE.Matrix4().lookAt(b, a, new V3(0, 1, 0)); m.setPosition(a.clone().lerp(b, 0.5)); g.applyMatrix4(m); return M.colorize(g, 1, 1, 1); }

  /* ---------- progetti ---------- */
  const TPL = (G.BOAT_TPL = {
    zattera: { n: 'Zattera', d: 'Tronchi legati con la corda. Lenta ma facile da costruire.', L: 4.4, W: 3.0, draft: 0.35, lift: 0.18, speed: 3.4, turn: 0.95, sail: false, seat: [0, 0.55, -0.9], cam3: 7 },
    barca_remi: { n: 'Barca a remi', d: 'Scafo in fasciame con due remi. Agile e veloce sotto costa.', L: 5.2, W: 1.75, D: 0.95, sheer: 0.18, draft: 0.45, lift: 0.3, speed: 5.4, turn: 1.15, sail: false, seat: [0, 0.35, -0.4], cam3: 8 },
    barca_vela: { n: 'Barca a vela', d: 'Una vela al vento: veloce in mare aperto.', L: 7.2, W: 2.5, D: 1.25, sheer: 0.25, draft: 0.65, lift: 0.45, speed: 9.0, turn: 0.75, sail: true, seat: [0, 0.6, -2.4], cam3: 11 },
    veliero: { n: 'Piccolo veliero', d: 'Due alberi, cassero e una stiva da 27 posti. Per le grandi traversate.', L: 12.5, W: 3.9, D: 2.1, sheer: 0.4, draft: 1.1, lift: 0.8, speed: 12.0, turn: 0.55, sail: true, seat: [0, 1.7, -4.2], cam3: 17, hold: true },
    // si sbloccano con i progetti trovati esplorando
    canoa: { n: 'Canoa', d: 'Leggera e velocissima: si pagaia con A e D. Progetto da trovare.', L: 4.6, W: 0.95, D: 0.55, sheer: 0.22, draft: 0.25, lift: 0.14, speed: 6.6, turn: 1.5, sail: false, seat: [0, 0.2, -0.3], cam3: 7, locked: true, canoe: true },
    catamarano: { n: 'Catamarano', d: 'Due scafi e una grande vela: il più veloce col vento. Progetto da trovare.', L: 8.4, W: 4.6, D: 0.9, sheer: 0.2, draft: 0.45, lift: 0.4, speed: 13.5, turn: 0.9, sail: true, seat: [0, 0.8, -3.2], cam3: 12, locked: true, cat: true },
    galeone: { n: 'Galeone', d: 'Tre alberi, cannoni e una stiva da 54 posti: la nave dei pirati. Progetto da trovare.', L: 19, W: 5.6, D: 3.0, sheer: 0.55, draft: 1.6, lift: 1.25, speed: 14.5, turn: 0.42, sail: true, seat: [0, 2.4, -6.5], cam3: 26, hold: true, holdN: 54, locked: true },
    vascello: { n: 'Vascello', d: 'La nave più grande: tre alberi alti, cannoni e un ponte di sotto dove ripararsi e stivare (boccaporto al centro). Progetto da trovare.', L: 25, W: 7.2, D: 5.6, sheer: 0.6, draft: 2.1, lift: 1.6, speed: 13.5, turn: 0.32, sail: true, seat: [0, 2.6, -8.8], cam3: 36, hold: true, holdN: 81, locked: true, lower: true },
  });
  BT.unlocked = (k) => !TPL[k].locked || (G.creative && G.creative()) || !!(G.Player.known && G.Player.known[k]);
  // ponte calpestabile: altezza locale, timone (zona guida) e ostacoli
  (function () {
    const z = TPL.zattera, r = TPL.barca_remi, v = TPL.barca_vela, w = TPL.veliero;
    z.deck = 0.33; z.helm = [0, -1.55]; z.helmTxt = 'Remo';
    r.deck = r.D * 0.38 - 0.6; r.helm = [0, -0.25 + 0.55 * 0.0]; r.helmTxt = 'Banco dei remi'; r.sit = r.D * 0.15 + 0.04; r.oars = true;
    v.deck = v.D * 0.38 - 0.18; v.helm = [0, -v.L / 2 + 0.95]; v.helmTxt = 'Timone';
    w.deck = w.D * 0.38 - 0.18; w.helm = [0, -2.25]; w.helmTxt = 'Timone';
    v.obst = [{ c: [0, (0.62 - 0.5) * v.L], r: 0.32 }];
    const c = TPL.canoa, k = TPL.catamarano, g = TPL.galeone, vs = TPL.vascello;
    c.deck = -0.12; c.helm = [0, -0.2]; c.helmTxt = 'Sedile'; c.sit = 0.08; c.oars = true;
    k.deck = 0.55; k.helm = [0, -k.L / 2 + 1.1]; k.helmTxt = 'Timone'; k.obst = [{ c: [0, 0.6], r: 0.3 }];
    g.deck = g.D * 0.38 - 0.18; g.helm = [0, -g.L * 0.3]; g.helmTxt = 'Timone';
    g.obst = [{ c: [0, (0.7 - 0.5) * g.L], r: 0.4 }, { c: [0, (0.5 - 0.5) * g.L], r: 0.45 }, { c: [0, (0.3 - 0.5) * g.L], r: 0.4 }, { box: [-0.6, g.L * 0.08 - 0.4, 0.6, g.L * 0.08 + 0.4] }];
    vs.deck = vs.D * 0.38 - 0.18; vs.helm = [0, -vs.L * 0.31]; vs.helmTxt = 'Timone';
    vs.hatch = [0, -vs.L * 0.1]; vs.lowerY = vs.deck - 2.3; vs.lowerZ = [-vs.L * 0.3, vs.L * 0.3];
    vs.obst = [{ c: [0, (0.72 - 0.5) * vs.L], r: 0.45 }, { c: [0, 0], r: 0.5 }, { c: [0, (0.28 - 0.5) * vs.L], r: 0.42 }, { box: [-0.6, vs.L * 0.12 - 0.4, 0.6, vs.L * 0.12 + 0.4] }];
    // cassero di poppa e castello di prua: ponti rialzati con le scale, e sotto una cabina con la porta
    for (const T of [g, vs]) T.castles = { q: { z1: -T.L * 0.34, y: T.deck + 2.3, sx: [0.8, 1.5], run: 2.4, part: 'Cassero di poppa' }, f: { z1: T.L * 0.34, y: T.deck + 2.15, sx: [0.55, 1.2], run: 2.2, part: 'Castello di prua' }, door: 0.48 };
    w.obst = [{ c: [0, (0.62 - 0.5) * w.L], r: 0.32 }, { c: [0, (0.36 - 0.5) * w.L], r: 0.34 }, { box: [-w.W * 0.39, -w.L * 0.33 - 1.65, w.W * 0.39, -w.L * 0.33 + 1.65] }, { box: [-0.55, w.L * 0.05 - 0.38, 0.55, w.L * 0.05 + 0.38] }];
    for (const T of Object.values(TPL)) if (T.D) T.H = hullShape(T.L, T.W, T.D, T.sheer);
    // sartie scalabili: dove partono sulla murata e dove arrivano (la coffa)
    const MASTS = { veliero: [[0.62, 9.5], [0.36, 11]], galeone: [[0.7, 13], [0.5, 15.5], [0.3, 11]], vascello: [[0.72, 16], [0.5, 19], [0.28, 13.5]] };
    for (const [key, ms] of Object.entries(MASTS)) {
      const T = TPL[key], aft = key !== 'veliero' ? -1 : 1;
      T.rigs = ms.map(([t, h]) => { const z = (t - 0.5) * T.L; return { t, z, h, top: rigTop(T, t, h), R: key === 'veliero' ? 0.7 : 0.9, bx: T.H.hw(t) * 0.98, by: T.H.gw(t) + 0.08, bz: z + aft * 1.9, tz: z + aft * 0.7 }; });
    }
  })();
  // mezza larghezza calpestabile alla coordinata z (locale, prua = +z)
  BT.deckHalfW = function (T, z) {
    if (T.cat) return Math.abs(z) < T.L / 2 - 1.2 ? T.W / 2 - 0.3 : 0;
    if (!T.H) return Math.abs(z) < T.L / 2 - 0.25 ? T.W / 2 - 0.3 : 0;
    const t = z / T.L + 0.5; if (t < 0.03 || t > 0.95) return 0;
    return Math.max(0, T.H.hw(t) * 0.86 - 0.3);
  };
  // riporta un punto locale sul ponte (dentro le murate, fuori dagli ostacoli); dice se ha toccato la murata
  BT.clampDeck = function (T, v) {
    let side = 0;
    const zmax = T.L / 2 - (T.H ? 0.7 : 0.3), zmin = -T.L / 2 + (T.H ? 0.45 : 0.3);
    if (v.z > zmax) v.z = zmax; if (v.z < zmin) v.z = zmin;
    let hw = BT.deckHalfW(T, v.z);
    while (hw < 0.12 && Math.abs(v.z) > 0.1) { v.z *= 0.97; hw = BT.deckHalfW(T, v.z); }
    if (v.x > hw) { v.x = hw; side = 1; } else if (v.x < -hw) { v.x = -hw; side = -1; }
    for (const o of T.obst || []) {
      if (o.r) { const dx = v.x - o.c[0], dz = v.z - o.c[1], d = Math.hypot(dx, dz), R = o.r + 0.3; if (d < R && d > 1e-4) { v.x = o.c[0] + dx / d * R; v.z = o.c[1] + dz / d * R; } }
      else { const [x0, z0, x1, z1] = o.box; const X0 = x0 - 0.3, X1 = x1 + 0.3, Z0 = z0 - 0.3, Z1 = z1 + 0.3;
        if (v.x > X0 && v.x < X1 && v.z > Z0 && v.z < Z1) { const m = [v.x - X0, X1 - v.x, v.z - Z0, Z1 - v.z], i = m.indexOf(Math.min(...m)); if (i === 0) v.x = X0; else if (i === 1) v.x = X1; else if (i === 2) v.z = Z0; else v.z = Z1; } }
    }
    return side;
  };
  /* ---------- sartie, coffa e ponte di sotto ----------
     Contro la murata accanto a un albero, W (o Spazio) per arrampicarsi sulle griselle;
     in cima si sta sulla coffa (Maiusc per riscendere). Nel vascello il boccaporto porta
     al ponte di sotto (tasto destro). Restituisce true se ha mosso lui il giocatore. */
  BT.rigMove = function (b, P, dt, k, lx, lz, l, sp) {
    const T = b.T, H = T.H;
    if (P.rig && T.rigs) {
      const r = T.rigs[P.rig.i], sd = P.rig.sd;
      const up = (k.KeyW || k.Space) ? 1 : 0, dn = (k.KeyS || k.ShiftLeft || k.ShiftRight) ? 1 : 0;
      const len = Math.hypot(r.top - T.deck, r.bx - 0.55, r.bz - r.tz);
      const k0 = P.rig.k; P.rig.k += (up - dn) * dt * 1.7 / len;
      if (Math.floor(k0 * len / 0.42) !== Math.floor(P.rig.k * len / 0.42) && G.Audio) G.Audio.step('wood');
      if (P.rig.k >= 1) { P.top = { i: P.rig.i }; P.rig = null; P.local.set(sd * 0.45, r.top + 0.08, r.z - 0.2); return true; }
      if (P.rig.k <= 0) { P.rig = null; P.local.set(sd * (BT.deckHalfW(T, r.bz) - 0.4), T.deck, r.bz); return true; }
      const q = P.rig.k;
      P.local.set(G.lerp(sd * (BT.deckHalfW(T, r.bz) - 0.15), sd * 0.3, q), G.lerp(T.deck, r.top + 0.08, q), G.lerp(r.bz, r.tz - 0.1, q));
      return true;
    }
    if (P.top && T.rigs) {
      const r = T.rigs[P.top.i];
      if (k.ShiftLeft || k.ShiftRight) { const sd = Math.sign(P.local.x) || 1, i = P.top.i; P.top = null; P.rig = { i, sd, k: 0.97 }; return true; }
      P.local.x += lx * sp * 0.5 * dt; P.local.z += lz * sp * 0.5 * dt;
      const dx = P.local.x, dz = P.local.z - r.z, d = Math.hypot(dx, dz), RM = r.R - 0.22, Rin = 0.42;
      if (d > RM) { P.local.x = dx / d * RM; P.local.z = r.z + dz / d * RM; } else if (d < Rin && d > 1e-4) { P.local.x = dx / d * Rin; P.local.z = r.z + dz / d * Rin; }
      P.local.y = r.top + 0.08; P.lvy = 0;
      return true;
    }
    if (P.lower && T.lower && !T.castles) {
      P.local.x += lx * sp * dt; P.local.z += lz * sp * dt;
      const [z0, z1] = T.lowerZ; P.local.z = G.clamp(P.local.z, z0 + 0.35, z1 - 0.35);
      const w = Math.max(0.5, hullXAt(H, P.local.z / T.L + 0.5, T.lowerY + 0.8) - 1.3); P.local.x = G.clamp(P.local.x, -w, w);
      // la scala del boccaporto
      const [hx, hz] = T.hatch, X0 = hx - 0.5, X1 = hx + 0.5, Z0 = hz - 1.15, Z1 = hz + 0.25;
      if (P.local.x > X0 && P.local.x < X1 && P.local.z > Z0 && P.local.z < Z1) { const m = [P.local.x - X0, X1 - P.local.x, P.local.z - Z0, Z1 - P.local.z], i = m.indexOf(Math.min(...m)); if (i === 0) P.local.x = X0; else if (i === 1) P.local.x = X1; else if (i === 2) P.local.z = Z0; else P.local.z = Z1; }
      P.local.y = T.lowerY; P.lvy = 0;
      if (l > 0) { P.bob += dt * 8; if (Math.floor(P.bob / Math.PI) !== Math.floor((P.bob - dt * 8) / Math.PI) && G.Audio) G.Audio.step('wood'); }
      return true;
    }
    // inizio dell'arrampicata: contro la murata, accanto alle sartie
    if (T.rigs && l > 0 && P.local.y <= T.deck + 0.05 && hasRig(b)) {
      for (let i = 0; i < T.rigs.length; i++) { const r = T.rigs[i]; for (const sd of [-1, 1]) {
        if (Math.abs(P.local.z - r.bz) < 0.9 && sd * P.local.x > BT.deckHalfW(T, P.local.z) - 0.4 && lx * sd > 0.45 && (k.KeyW || P.ax.f > 0.3)) { P.rig = { i, sd, k: 0.02 }; return true; }
      } }
    }
    return false;
  };
  /* ---------- camminare su galeone e vascello: cassero e castello (sopra e dentro la cabina), scale, boccaporto ---------- */
  const built = (b, name) => { const i = b.parts.findIndex((p) => p.name === name); return i >= 0 && !!b.filled[i]; };
  // parti rialzate costruite su questa barca
  function castlesOf(b) {
    const C = b.T.castles; if (!C) return null;
    return { q: built(b, C.q.part) ? C.q : null, f: built(b, C.f.part) ? C.f : null, door: C.door, low: b.T.lower && built(b, 'Ponte di sotto') };
  }
  // dentro la zona del castello? (poppa: z < z1, prua: z > z1)
  const inC = (c, w, z) => c && (w === 'q' ? z < c.z1 : z > c.z1);
  // altezza del pavimento in (x, z) per chi sta a quota y (null = muro)
  BT.floorAt = function (b, x, z, y) {
    const T = b.T, K = castlesOf(b); if (!K) return T.deck;
    for (const w of ['q', 'f']) {
      const c = K[w]; if (!c) continue;
      if (inC(c, w, z)) return y > c.y - 0.9 ? c.y : T.deck; // sopra il ponte rialzato o dentro la cabina
      // scale: salgono verso la paratia
      const ax = Math.abs(x), d = w === 'q' ? z - c.z1 : c.z1 - z;
      if (ax > c.sx[0] && ax < c.sx[1] && d >= 0 && d < c.run) { const h = T.deck + (c.y - T.deck) * (1 - d / c.run); if (y > h - 0.7 || h - T.deck < 0.7) return h; }
    }
    if (K.low) {
      const [hx, hz] = T.hatch, hl = 0.85;
      if (Math.abs(x - hx) < 0.7 && Math.abs(z - hz) < hl) {
        const k = (z - (hz - hl)) / (2 * hl), h = T.lowerY + (T.deck - T.lowerY) * G.clamp(k, 0, 1);
        if (Math.abs(x - hx) < 0.3 && y > h - 0.7) return h; // sui gradini
        return T.lowerY; // nel buco del boccaporto si cade di sotto
      }
      if (y < T.deck - 1.0) return T.lowerY;
    }
    return T.deck;
  };
  // muri: paratie (si passa solo dalla porta), ringhiere davanti ai ponti rialzati, scafo del ponte di sotto
  function blocked(b, K, x0, z0, x, z, y) {
    const T = b.T;
    for (const w of ['q', 'f']) {
      const c = K[w]; if (!c) continue;
      const was = inC(c, w, z0), now = inC(c, w, z);
      if (was !== now) {
        if (y < c.y - 0.9) { if (Math.abs(x) > K.door - 0.12) return true; } // paratia: solo dalla porta
        else if (Math.abs(y - c.y) < 0.5 && !(Math.abs(x) > c.sx[0] + 0.05 && Math.abs(x) < c.sx[1] - 0.05)) return true; // ringhiera, varchi solo alle scale
      }
      // fianchi delle scale: non si sale di lato
      const ax = Math.abs(x), d = w === 'q' ? z - c.z1 : c.z1 - z;
      if (d >= 0 && d < c.run && y < T.deck + 0.3) { const h = T.deck + (c.y - T.deck) * (1 - d / c.run), ax0 = Math.abs(x0); if (h - T.deck > 0.5 && (ax0 <= c.sx[0]) !== (ax <= c.sx[0]) || h - T.deck > 0.5 && (ax0 >= c.sx[1]) !== (ax >= c.sx[1])) return true; }
    }
    if (K.low && y < T.deck - 1.0) {
      const [z0l, z1l] = T.lowerZ; if (z < z0l + 0.35 || z > z1l - 0.35) return true;
      const wl = Math.max(0.5, hullXAt(T.H, z / T.L + 0.5, T.lowerY + 0.8) - 1.3); if (Math.abs(x) > wl) return true;
      // sotto il ponte si esce solo dal buco del boccaporto (lungo la scala)
    }
    return false;
  }
  BT.walk = function (b, P, dt, k, lx, lz, l, sp) {
    const T = b.T, K = castlesOf(b); if (!K) return false;
    const y = P.local.y, x0 = P.local.x, z0 = P.local.z;
    const tryMove = (ax, az) => {
      const nx = x0 + ax * sp * dt, nz = z0 + az * sp * dt;
      if (blocked(b, K, x0, z0, nx, nz, y)) return false;
      const f = BT.floorAt(b, nx, nz, y); if (f > y + 0.62) return false;
      P.local.x = nx; P.local.z = nz; return true;
    };
    if (l > 0) { if (!tryMove(lx, lz)) if (!tryMove(lx, 0)) tryMove(0, lz); }
    const fy = BT.floorAt(b, P.local.x, P.local.z, P.local.y);
    if (k.Space && P.local.y <= fy + 0.001) P.lvy = 5.2;
    P.lvy -= 20 * dt; P.local.y += P.lvy * dt;
    if (P.local.y < fy) { P.local.y = fy; P.lvy = 0; }
    // soffitto della cabina e del ponte di sotto
    for (const w of ['q', 'f']) { const c = K[w]; if (c && inC(c, w, P.local.z) && fy < c.y - 0.9 && P.local.y > c.y - 1.85) { P.local.y = c.y - 1.85; P.lvy = Math.min(0, P.lvy); } }
    P.lower = !!(K.low && P.local.y < T.deck - 1.0);
    // dentro una cabina: la lanterna appesa si accende
    let cab = null; for (const w of ['q', 'f']) { const c = K[w]; if (c && inC(c, w, P.local.z) && P.local.y < c.y - 0.9) cab = w; }
    if (cab && !b._cabL) { b._cabL = new THREE.PointLight(0xffb060, 1.5, 8, 1.6); b.inner.add(b._cabL); }
    if (b._cabL) { b._cabL.visible = !!cab; if (cab) { const c = K[cab], zEnd = cab === 'q' ? -T.L / 2 : T.L / 2 - 0.35; b._cabL.position.set(0, c.y - 0.6, (c.z1 + zEnd) / 2 + (cab === 'q' ? 0.4 : -0.3)); } }
    if (P.lower) { const [hx, hz] = T.hatch; const under = Math.abs(P.local.x - hx) < 0.7 && Math.abs(P.local.z - hz) < 0.85; if (!under && P.local.y > T.lowerY + 0.3 && fy === T.lowerY && P.local.y > T.deck - 1.85) { P.local.y = T.deck - 1.85; P.lvy = Math.min(0, P.lvy); } }
    // sul ponte (e sui ponti rialzati) valgono murate e ostacoli; sotto, lo scafo
    let side = 0;
    if (!P.lower) { const v = P.local.clone(); side = BT.clampDeck(T, v); if (Math.abs(P.local.y - T.deck) < 0.4) { P.local.x = v.x; P.local.z = v.z; } else { const hw = BT.deckHalfW(T, P.local.z); P.local.x = G.clamp(P.local.x, -hw, hw); P.local.z = v.z; } }
    if (side && k.Space && Math.sign(lx) === side && Math.abs(P.local.y - fy) < 0.3) { P.jumpOverboard(side); return true; }
    if (l > 0 && P.local.y <= fy + 0.01) { P.bob += dt * 8; if (Math.floor(P.bob / Math.PI) !== Math.floor((P.bob - dt * 8) / Math.PI) && G.Audio) G.Audio.step('wood'); }
    return true;
  };
  // salendo a bordo dentro la zona di un castello si finisce sul ponte rialzato
  BT.boardY = function (b, v) { const K = castlesOf(b); if (!K) return b.T.deck; for (const w of ['q', 'f']) if (inC(K[w], w, v.z)) return K[w].y; return b.T.deck; };
  const hasRig = (b) => { const i = b.parts.findIndex((p) => p.name === 'Sartie'); return i >= 0 && b.filled[i]; };
  BT.rigReset = function (P) { P.rig = null; P.top = null; P.lower = false; };
  // boccaporto: scendi o sali
  BT.hatchUse = function (P) {
    const b = P.boat; if (!b || !b.T.lower || b.T.castles || P.helm || !BT.isComplete(b)) return false;
    const T = b.T, [hx, hz] = T.hatch;
    if (P.lower) { if (Math.hypot(P.local.x - hx, P.local.z - (hz - 0.4)) < 1.8) { P.lower = false; P.local.set(hx + 1.25, T.deck, hz); if (G.Audio) G.Audio.step('wood'); return true; } return false; }
    if (!P.rig && !P.top && Math.hypot(P.local.x - hx, P.local.z - hz) < 1.9) { P.lower = true; P.local.set(hx, T.lowerY, hz - 1.6); P.yaw = b.yaw; if (G.Audio) G.Audio.step('wood'); return true; }
    return false;
  };
  // cosa suggerire (sartie, coffa, boccaporto)
  BT.rigHint = function (P) {
    const b = P.boat; if (!b || P.helm) return null; const T = b.T;
    if (P.rig) return ['Sartie', '<kbd>W</kbd> sali · <kbd>S</kbd> scendi'];
    if (P.top) return ['Coffa', '<kbd>Maiusc</kbd> riscendi dalle sartie'];
    if (T.lower && T.castles && BT.isComplete(b)) { const [hx, hz] = T.hatch; if (Math.hypot(P.local.x - hx, P.local.z - hz) < 2.2) return P.lower ? ['Scala del boccaporto', 'sali i gradini per tornare in coperta'] : ['Boccaporto', 'scendi la scala per andare sottocoperta']; }
    else if (T.lower && BT.isComplete(b)) { const [hx, hz] = T.hatch;
      if (P.lower && Math.hypot(P.local.x - hx, P.local.z - (hz - 0.4)) < 1.8) return ['Scala del boccaporto', `<kbd>${G.useKey()}</kbd> sali sul ponte`];
      if (!P.lower && Math.hypot(P.local.x - hx, P.local.z - hz) < 1.9) return ['Boccaporto', `<kbd>${G.useKey()}</kbd> scendi sottocoperta`]; }
    if (T.rigs && !P.lower && hasRig(b)) for (const r of T.rigs) if (Math.abs(P.local.z - r.bz) < 1.1 && Math.abs(P.local.x) > BT.deckHalfW(T, P.local.z) - 0.8) return ['Sartie', 'cammina contro la murata con <kbd>W</kbd> per arrampicarti'];
    return null;
  };
  // luci delle lanterne quando sei sotto
  BT.lowerLights = function (b, on) {
    if (!b.T.lower) return;
    if (on && !b._ll) { b._ll = []; const T = b.T; for (const z of [T.lowerZ[0] + 2.2, T.hatch[1] - 2.2, T.lowerZ[1] - 2.2]) { const l = new THREE.PointLight(0xffa850, 1.4, 9, 1.6); l.position.set(1.1, T.deck - 0.8, z); b.inner.add(l); b._ll.push(l); } }
    if (b._ll) for (const l of b._ll) l.visible = !!on;
  };
  BT.inHelmZone = (b, v) => Math.hypot(v.x - b.T.helm[0], v.z - b.T.helm[1]) < 1.0;
  // locale (scafo) -> mondo
  BT.localToWorld = function (b, v, out) { b.root.updateMatrixWorld(true); return (out || new V3()).copy(v).applyMatrix4(b.inner.matrixWorld); };
  BT.worldToLocal = function (b, p, out) { b.root.updateMatrixWorld(true); _wl.copy(b.inner.matrixWorld).invert(); return (out || new V3()).copy(p).applyMatrix4(_wl); };
  const _wl = new THREE.Matrix4();

  function partsFor(key) {
    const T = TPL[key], P = [];
    const add = (name, item, n, geo, mat) => P.push({ name, item, n, geo, mat });
    if (key === 'zattera') {
      for (let i = 0; i < 5; i++) { const x = -1.1 + i * 0.55; const g = cyl(0.26, 0.26, T.L, x, 0.05, 0, Math.PI / 2, 0, [1, 1, 1]); add(`Tronco ${i + 1}`, 'tronco', 2, g, 'logs'); }
      for (const z of [-1.4, 1.4]) add(z < 0 ? 'Traversa di poppa' : 'Traversa di prua', 'assi', 3, box(2.9, 0.1, 0.32, 0, 0.36, z), 'planks');
      for (const z of [-1.4, 1.4]) { const rr = []; for (let i = 0; i < 5; i++) { const t = new THREE.TorusGeometry(0.29, 0.03, 8, 22); t.rotateY(Math.PI / 2); t.translate(-1.1 + i * 0.55, 0.06, z); rr.push(M.colorize(t, 1, 1, 1)); } add(z < 0 ? 'Legature di poppa' : 'Legature di prua', 'corda', 2, M.merge(rr), 'rope'); }
      add('Remo', 'remo', 1, oar(1.35, 0.55, -0.6, 1, 2.4), 'planks');
    } else if (key === 'canoa' || key === 'catamarano') {
      // scafi affusolati a prua e a poppa (canoa scavata nel tronco)
      const hull = (side, off, L, W, D) => {
        const NS = 48, NV = 14, pos = [], idx = [];
        for (let i = 0; i <= NS; i++) { const t = i / NS, z = (t - 0.5) * L, hw = Math.pow(Math.sin(Math.PI * t), 0.75) * W / 2, kd = D * 0.6 * Math.pow(Math.sin(Math.PI * t), 0.5), gw = D * 0.4 + Math.pow(t - 0.5, 2) * 1.2;
          for (let j = 0; j <= NV; j++) { const s2 = j / NV; pos.push(off + side * hw * Math.pow(Math.sin((s2 * Math.PI) / 2), 0.6), G.lerp(-kd, gw, Math.pow(s2, 1.2)), z); } }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1; if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        const uvs = new Float32Array((pos.length / 3) * 2); for (let i = 0; i < pos.length / 3; i++) { uvs[i * 2] = pos[i * 3 + 2] / 2.5; uvs[i * 2 + 1] = pos[i * 3 + 1] * 2; } g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return M.colorize(g, 1, 1, 1);
      };
      if (key === 'canoa') {
        add('Scafo scavato', 'tronco', 3, M.merge([hull(-1, 0, T.L, T.W, T.D), hull(1, 0, T.L, T.W, T.D)]), 'logs');
        add('Panca', 'assi', 2, M.merge([box(T.W * 0.8, 0.06, 0.35, 0, 0.0, -0.2), box(T.W * 0.7, 0.06, 0.3, 0, 0.0, 1.0)]), 'planks');
        add('Pagaia sinistra', 'remo', 1, oar(-T.W / 2 - 0.7, 0.15, -0.2, -1, 1.7), 'planks');
        P[P.length - 1].oar = -1; P[P.length - 1].pivot = new V3(-T.W / 2, 0.35, -0.2);
        add('Pagaia destra', 'remo', 1, oar(T.W / 2 + 0.7, 0.15, -0.2, 1, 1.7), 'planks');
        P[P.length - 1].oar = 1; P[P.length - 1].pivot = new V3(T.W / 2, 0.35, -0.2);
      } else {
        const off = T.W / 2 - 0.45;
        add('Scafo sinistro', 'assi', 10, M.merge([hull(-1, -off, T.L, 0.9, T.D), hull(1, -off, T.L, 0.9, T.D)]), 'planks');
        add('Scafo destro', 'assi', 10, M.merge([hull(-1, off, T.L, 0.9, T.D), hull(1, off, T.L, 0.9, T.D)]), 'planks');
        const deck = []; for (let z = -T.L / 2 + 1.3; z < T.L / 2 - 1.2; z += 0.45) deck.push(box(T.W - 0.4, 0.07, 0.4, 0, T.deck - 0.03, z));
        for (const z of [-T.L * 0.3, 0, T.L * 0.3]) deck.push(box(T.W, 0.16, 0.2, 0, T.deck - 0.15, z));
        add('Ponte e traverse', 'assi', 10, M.merge(deck), 'planks');
        const h = 9;
        add('Albero', 'albero_barca', 1, M.merge([cyl(0.1, 0.14, h, 0, T.deck + h / 2, 0.6), cyl(0.05, 0.05, 3.8, 0, T.deck + 1.4, 0.6 - 1.8, Math.PI / 2, 0)].map((g) => M.colorize(g, 1, 1, 1))), 'spar');
        const sh = new THREE.BufferGeometry(); sh.setAttribute('position', new THREE.Float32BufferAttribute([0, T.deck + 1.5, 0.45, 0, T.deck + h - 0.3, 0.45, 0, T.deck + 1.5, 0.6 - 3.7], 3)); sh.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2)); sh.computeVertexNormals();
        add('Vela latina', 'vela', 2, M.colorize(sh, 1, 1, 1), 'cloth');
        add('Timoni', 'timone', 1, M.merge([box(0.08, 0.9, 0.5, -off, -0.1, -T.L / 2 - 0.1), box(0.08, 0.9, 0.5, off, -0.1, -T.L / 2 - 0.1), box(T.W * 0.9, 0.06, 0.06, 0, T.deck + 0.4, -T.L / 2 + 0.4)]), 'planks');
        const top = new V3(0, T.deck + h - 0.2, 0.6);
        add('Sartiame', 'corda', 4, M.merge([rope(top, new V3(0, T.deck, T.L / 2 - 1.2)), rope(top, new V3(-T.W / 2 + 0.3, T.deck, -0.6)), rope(top, new V3(T.W / 2 - 0.3, T.deck, -0.6)), rope(top, new V3(0, T.deck, -T.L / 2 + 1.3))]), 'rope');
      }
    } else {
      const { L, W, D, sheer } = T;
      const GAL = key === 'galeone' || key === 'vascello', VAS = key === 'vascello';
      add('Chiglia', 'tronco', VAS ? 20 : key === 'galeone' ? 14 : key === 'veliero' ? 8 : key === 'barca_vela' ? 4 : 3, keelGeo(L, W, D, sheer), 'logs');
      const rows = VAS ? 18 : key === 'galeone' ? 14 : key === 'veliero' ? 10 : 6;
      const per = VAS ? 52 : key === 'galeone' ? 36 : key === 'veliero' ? 20 : key === 'barca_vela' ? 12 : 8;
      add('Fasciame sinistro', 'assi', per, hullSide(L, W, D, sheer, -1, rows), 'planks');
      add('Fasciame destro', 'assi', per, hullSide(L, W, D, sheer, 1, rows), 'planks');
      const H = hullShape(L, W, D, sheer);
      if (key === 'barca_remi') {
        const th = []; for (const t of [0.3, 0.55, 0.75]) th.push(box(H.hw(t) * 1.9, 0.08, 0.32, 0, D * 0.15, (t - 0.5) * L));
        th.push(deckGeo(L, W, D, sheer, 0.6));
        add('Panche e pagliolato', 'assi', 4, M.merge(th), 'planks');
        add('Remo sinistro', 'remo', 1, oar(-H.hw(0.45) - 0.9, D * 0.4, -0.25, -1, 2.6), 'planks');
        P[P.length - 1].oar = -1; P[P.length - 1].pivot = new V3(-H.hw(0.45), D * 0.4 + 0.3, -0.25);
        add('Remo destro', 'remo', 1, oar(H.hw(0.45) + 0.9, D * 0.4, -0.25, 1, 2.6), 'planks');
        P[P.length - 1].oar = 1; P[P.length - 1].pivot = new V3(H.hw(0.45), D * 0.4 + 0.3, -0.25);
      } else {
        add('Ponte', 'assi', VAS ? 40 : key === 'galeone' ? 28 : key === 'veliero' ? 16 : 8, VAS ? deckGeo(L, W, D, sheer, 0.18, { z: T.hatch[1], hz: 0.85, hx: 0.7 }) : deckGeo(L, W, D, sheer, 0.18), 'planks');
        const deckY = D * 0.38 - 0.18;
        const masts = VAS ? [[0.72, 16, 'Albero di trinchetto', 'Vele di trinchetto', 6.6], [0.5, 19, 'Albero maestro', 'Vele maestre', 7.8], [0.28, 13.5, 'Albero di mezzana', 'Vela di mezzana', 5.6]] : key === 'galeone' ? [[0.7, 13, 'Albero di trinchetto', 'Vele di trinchetto', 5.2], [0.5, 15.5, 'Albero maestro', 'Vele maestre', 6.2], [0.3, 11, 'Albero di mezzana', 'Vela di mezzana', 4.4]] : key === 'veliero' ? [[0.62, 9.5, 'Albero di trinchetto', 'Vela di trinchetto', 3.6], [0.36, 11, 'Albero maestro', 'Vela maestra', 4.4]] : [[0.62, 7.2, 'Albero', 'Vela', 3.2]];
        for (const [t, h, mn, vn, sw] of masts) {
          const z = (t - 0.5) * L;
          if (GAL) {
            // vele quadre su pennoni trasversali, con coffa
            const yards = [0.35, 0.62, 0.86].map((f) => deckY + 2 + (h - 3) * f);
            add(mn, 'albero_barca', VAS ? 3 : 2, M.merge([cyl(0.2, 0.3, h, 0, deckY + h / 2, z), ...yards.map((y, i) => cyl(0.07, 0.07, sw * (1.15 - i * 0.22), 0, y, z, 0, Math.PI / 2)), cyl(0.9, 0.9, 0.15, 0, deckY + (h - 3) * 0.5 + 2, z)].map((g) => M.colorize(g, 1, 1, 1))), 'spar');
            const sails = yards.slice(0, 2).map((y, i) => { const g = new THREE.PlaneGeometry(sw * (1.1 - i * 0.25), (yards[i + 1] - y) * 0.95, 8, 6); const pp = g.attributes.position; for (let k = 0; k < pp.count; k++) { const u = pp.getX(k) / (sw * 1.1) + 0.5, v = pp.getY(k) / ((yards[i + 1] - y)) + 0.5; pp.setZ(k, Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.6); } g.computeVertexNormals(); g.translate(0, (yards[i + 1] + y) / 2, z + 0.25); return M.colorize(g, 1, 1, 1); });
            const low = new THREE.PlaneGeometry(sw * 1.15, yards[0] - deckY - 2.45, 8, 4); low.translate(0, (yards[0] + deckY + 2.45) / 2, z + 0.25); sails.push(M.colorize(low, 1, 1, 1)); // la vela bassa parte sopra la testa di chi cammina sul ponte
            add(vn, 'vela', 3, M.merge(sails), 'cloth');
          } else {
          add(mn, 'albero_barca', 1, M.merge([cyl(0.12, 0.17, h, 0, deckY + h / 2, z), ...(key === 'veliero' ? [cyl(0.7, 0.7, 0.12, 0, rigTop(T, t, h), z)] : []), cyl(0.06, 0.06, sw * 0.95, 0, deckY + 1.6, z - sw * 0.45, Math.PI / 2, 0), cyl(0.05, 0.05, sw * 0.8, 0, deckY + h - 0.6, z - sw * 0.38, Math.PI / 2, 0)].map((g) => M.colorize(g, 1, 1, 1))), 'spar');
          add(vn, 'vela', 1, sailGeo(sw * 0.92, h - 2.4, 0.45, 0, deckY + 1.75 + (h - 2.4) / 2, z - sw * 0.46), 'cloth');
          }
        }
        if (GAL) {
          add('Cassero di poppa', 'assi', VAS ? 30 : 20, castleGeo(T, 'q'), 'planks');
          add('Castello di prua', 'assi', VAS ? 18 : 12, castleGeo(T, 'f'), 'planks');
          const cannons = []; for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) { const t = 0.28 + i * 0.1, z = (t - 0.5) * L, x = sd * (H.hw(t) - 0.35); const c = cyl(0.13, 0.17, 1.4, x, deckY + 0.55, z, 0, -sd * Math.PI / 2); c.translate(0, 0, 0); cannons.push(M.colorize(c, 0.07, 0.07, 0.075)); cannons.push(M.colorize(new THREE.BoxGeometry(0.5, 0.35, 0.6).translate(x - sd * 0.4, deckY + 0.2, z), 0.32, 0.2, 0.11)); }
          add('Cannoni', 'cannone', 6, M.merge(cannons), 'cannon');
          const fl = new THREE.PlaneGeometry(2.2, 1.4); fl.translate(1.1, deckY + (VAS ? 19 : 15.5) + 0.6, (0.5 - 0.5) * L); add('Bandiera', 'stoffa', 2, M.colorize(fl, 0.12, 0.12, 0.12), 'cloth');
        }
        if (key === 'veliero') add('Cassero', 'assi', 12, M.merge([box(W * 0.75, 1.9, 3.2, 0, deckY + 0.95, -L * 0.33), box(W * 0.85, 0.14, 3.5, 0, deckY + 1.95, -L * 0.33), box(0.7, 1.4, 0.06, 0, deckY + 0.7, -L * 0.33 + 1.62)]), 'planks');
        add('Timone', 'timone', 1, M.merge([box(0.1, D * 1.1, 0.7, 0, -D * 0.1, -L / 2 - 0.35), ...(GAL ? [] : [cyl(0.04, 0.04, 1.4, 0, D * 0.55, -L / 2 + 0.3, Math.PI / 2 - 0.25, 0, [1, 1, 1])])]), 'planks');
        const rp = [];
        for (const [t, h] of masts) {
          const z = (t - 0.5) * L, top = new V3(0, deckY + h - 0.2, z);
          rp.push(rope(top, new V3(0, D * 0.38 + 0.1, L / 2 - 0.1)), rope(top, new V3(-H.hw(t) * 0.95, H.gw(t), z - 0.6)), rope(top, new V3(H.hw(t) * 0.95, H.gw(t), z - 0.6)), rope(top, new V3(0, H.gw(0.05) + 0.2, -L / 2 + 0.4)));
        }
        add('Sartiame', 'corda', VAS ? 22 : key === 'galeone' ? 16 : key === 'veliero' ? 8 : 4, M.merge(rp), 'rope');
        // sartie con griselle: scale di corda dalla murata alla coffa (dietro le vele quadre, davanti a quelle auriche)
        if (T.rigs) { const rg = []; for (const r of T.rigs) for (const sd of [-1, 1]) rg.push(ratlines(r, sd)); add('Sartie', 'corda', VAS ? 14 : key === 'galeone' ? 10 : 6, M.merge(rg), 'rope'); }
        if (key === 'veliero' || GAL) add('Stiva', 'baule', VAS ? 3 : key === 'galeone' ? 2 : 1, box(GAL ? 1.2 : 1.0, 0.6, 0.65, 0, deckY + 0.3, L * (VAS ? 0.12 : key === 'galeone' ? 0.08 : 0.05)), 'planks');
        if (VAS) { add('Ponte di sotto', 'assi', 30, lowerDeckGeo(T), 'planks'); add('Cannoni di sotto', 'cannone', 4, lowerCannonsGeo(T), 'cannon'); add('Lanterne', 'torcia', 3, lanternsGeo(T), 'lantern'); }
      }
    }
    for (const p of P) { p.geo.computeBoundingBox(); }
    return P;
  }
  BT.partsCache = {};
  BT.parts = (k) => BT.partsCache[k] || (BT.partsCache[k] = partsFor(k));
  BT.needs = function (k) { const need = {}; for (const p of BT.parts(k)) need[p.item] = (need[p.item] || 0) + p.n; return need; };

  /* ---------- istanze ---------- */
  function matFor(p) { return G.MAT[p.mat + 'B'] || G.MAT[p.mat] || G.MAT.planks; }
  BT.matFor = matFor;
  BT.create = function (data) {
    if (data.tpl === 'libera') return createFree(data);
    const T = TPL[data.tpl], parts = BT.parts(data.tpl);
    const b = Object.assign({ yaw: 0, speed: 0, rudder: 0, yawRate: 0, filled: parts.map(() => false), y: 0, pitch: 0, roll: 0, vy: 0, oarL: { ph: 0, on: false }, oarR: { ph: 0, on: false } }, data);
    if (!b.id) b.id = Math.random().toString(36).slice(2, 10);
    b.filled = b.filled.slice();
    if (T.hold && !b.inv) b.inv = new Array(T.holdN || 27).fill(null);
    b.T = T; b.parts = parts;
    b.root = new THREE.Group(); b.inner = new THREE.Group(); b.root.add(b.inner);
    b.meshes = parts.map((p, i) => {
      const m = new THREE.Mesh(p.geo, b.filled[i] ? matFor(p) : G.Boats.holo);
      m.castShadow = b.filled[i]; m.receiveShadow = true; m.userData.part = i;
      b.inner.add(m); return m;
    });
    b.root.position.set(b.x, G.SEA, b.z); b.root.rotation.y = b.yaw;
    // segno della zona guida: cerchio dorato sul ponte e icona del timone che fluttua
    b.helmMark = helmMarker(T); b.inner.add(b.helmMark);
    G.scene.add(b.root);
    BT.list.push(b);
    return b;
  };
  // barca libera: niente progetto, i pezzi li mette il giocatore (vedi freeboat.js)
  function createFree(data) {
    const T = { n: 'Barca libera', free: true, L: 2, W: 1, D: 1, draft: 0.4, lift: 0, speed: 0, turn: 0.9, sail: false, deck: 0.5, helm: [1e6, 1e6], helmTxt: 'Timone', seat: [0, 1.6, -3], cam3: 9 };
    const b = Object.assign({ yaw: 0, speed: 0, rudder: 0, yawRate: 0, y: G.SEA - 0.2, pitch: 0, roll: 0, vy: 0, vroll: 0, vpitch: 0, flood: 0, flip: 0, sunk: false, oarL: { ph: 0, on: false }, oarR: { ph: 0, on: false } }, data);
    if (!b.id) b.id = Math.random().toString(36).slice(2, 10);
    b.free = true; b.T = T; b.parts = []; b.filled = []; b.meshes = []; b.pcs = (b.pcs || []).map((c) => ({ t: c.t, x: c.x, y: c.y, z: c.z }));
    b.root = new THREE.Group(); b.inner = new THREE.Group(); b.root.add(b.inner);
    b.root.position.set(b.x, b.y, b.z); b.root.rotation.y = b.yaw;
    G.FreeBoat.rebuild(b);
    if (b.pcs.some((c) => c.t === 'baule') && !b.inv) b.inv = new Array(27).fill(null);
    G.scene.add(b.root);
    BT.list.push(b);
    return b;
  }
  BT.remove = function (b) { G.scene.remove(b.root); const i = BT.list.indexOf(b); if (i >= 0) BT.list.splice(i, 1); if (G.Player.boat === b) G.Player.leaveBoat(true); };
  let helmTex = null;
  function helmMarker(T) {
    if (!helmTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.translate(64, 64); x.strokeStyle = '#ffd27a'; x.lineWidth = 7; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 6;
      x.beginPath(); x.arc(0, 0, 30, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, 9, 0, 7); x.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); x.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); x.stroke(); x.beginPath(); x.arc(Math.cos(a) * 50, Math.sin(a) * 50, 5, 0, 7); x.fillStyle = '#ffd27a'; x.fill(); }
      helmTex = new THREE.CanvasTexture(c); helmTex.encoding = THREE.sRGBEncoding;
    }
    const g = new THREE.Group(); g.position.set(T.helm[0], T.deck + 0.03, T.helm[1]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.renderOrder = 6; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.16, depthWrite: false }));
    disc.renderOrder = 6; g.add(disc);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: helmTex, transparent: true, depthWrite: false, depthTest: false }));
    icon.scale.set(0.55, 0.55, 1); icon.position.y = 1.9; icon.renderOrder = 21; g.add(icon);
    g.userData = { ring, disc, icon }; g.visible = false;
    return g;
  }
  // il segno si vede quando sei a bordo e non stai guidando, o quando ti avvicini alla barca
  BT.helmMarker = (T) => helmMarker(T);
  BT.updateHelmMarks = function (t) {
    const P = G.Player;
    for (const b of BT.list) {
      const m = b.helmMark; if (!m) continue;
      const near = Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 14 && !(b.free && (b.flip || b.sunk || b.T.helm[0] > 1e5));
      const on = BT.isComplete(b) && ((P.boat === b && !P.helm) || (!P.boat && near));
      m.visible = on; if (!on) continue;
      const k = 0.5 + 0.5 * Math.sin(t * 3.2);
      m.userData.ring.material.opacity = 0.45 + 0.4 * k; m.userData.ring.scale.setScalar(1 + k * 0.08);
      m.userData.icon.position.y = 1.8 + Math.sin(t * 2) * 0.12;
      const inZone = P.boat === b && P.inHelmZone && P.inHelmZone();
      m.userData.disc.material.opacity = inZone ? 0.42 : 0.14;
    }
  };
  BT.toggleAnchor = function (b) {
    if (!b) return;
    b.anchored = !b.anchored;
    G.UI.toast(b.anchored ? 'Ancora gettata: la barca resta qui' : 'Ancora salpata: senza nessuno al timone la barca va dove la porta il vento', b.anchored ? 'good' : '');
    if (G.Audio) { G.Audio.splash(); if (G.Audio.chest) setTimeout(() => G.Audio.chest(), 150); }
    if (G.Net && G.Net.on) G.Net.send({ t: 'banchor', id: b.id, on: b.anchored ? 1 : 0 });
    G.saveSoon && G.saveSoon();
  };
  BT.isComplete = (b) => b.filled.every(Boolean);
  BT.byId = (id) => BT.list.find((b) => b.id === id);
  BT.serializeOne = (b) => Object.assign({ id: b.id, tpl: b.tpl, x: +b.x.toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(3), filled: b.filled, inv: b.inv || undefined, hull: b.hull !== undefined ? Math.round(b.hull) : undefined, anchored: b.anchored ? 1 : 0 },
    b.free ? { pcs: b.pcs.map(({ t, x, y, z }) => ({ t, x, y, z })), flip: b.flip || 0, sunk: b.sunk ? 1 : 0, flood: Math.round(b.flood || 0), y: +b.y.toFixed(2) } : {});
  BT.fillPart = function (b, i, remote) {
    const p = b.parts[i];
    if (b.filled[i]) return false;
    if (!remote) {
      if (G.Player.count(p.item) < p.n) { G.UI.toast(`Servono ${p.n} × ${G.ITEMS[p.item].n} (ne hai ${G.Player.count(p.item)})`, 'warn'); return false; }
      G.Player.take(p.item, p.n);
      if (G.Net && G.Net.on) G.Net.send({ t: 'bfill', id: b.id, part: i });
    }
    b.filled[i] = true;
    const m = b.meshes[i]; m.material = matFor(p); m.castShadow = true;
    const wp = new V3(); m.geometry.boundingBox.getCenter(wp); m.localToWorld(wp);
    G.FX.burst(wp.x, wp.y, wp.z, [0.8, 0.6, 0.35], 16, 2.5);
    if (G.Audio) G.Audio.place();
    if (!remote) {
      if (BT.isComplete(b)) G.UI.toast(`${b.T.n} completata! Avvicinati e ${G.useHow()} per salire.`, 'good');
      else G.UI.toast(`${p.name} montato`, 'good');
    }
    G.saveSoon && G.saveSoon();
    return true;
  };
  BT.serialize = () => BT.list.filter((b) => !b.pirate).map((b) => BT.serializeOne(b));
  BT.load = function (arr) {
    for (const b of BT.list) G.scene.remove(b.root); BT.list = [];
    // salvataggi di prima della deriva: le barche che c'erano restano ancorate dove le avevi lasciate
    const old = (arr || []).length && !(arr || []).some((d) => 'anchored' in d || d.v2);
    for (const d of arr || []) { const b = BT.create(d); if (old) b.anchored = true; }
  };
  BT.init = function () {
    BT.holo = G.holoMaterial(0x6fd8ff);
    BT.holoHi = G.holoMaterial(0xffe28a); BT.holoHi.uniforms.uAlpha.value = 0.6;
    BT.ghostOk = G.holoMaterial(0x7fe0ff); BT.ghostBad = G.holoMaterial(0xff5a4a);
  };

  /* ---------- piazzamento della sagoma ---------- */
  BT.ghost = null; BT.ghostTpl = null;
  BT.checkWater = function (tpl, x, z, yaw) {
    const T = TPL[tpl];
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const pts = [[0, 0], [T.L / 2, 0], [-T.L / 2, 0], [0, T.W / 2], [0, -T.W / 2]];
    for (const [a, s] of pts) {
      const px = x + fx * a + fz * s, pz = z + fz * a - fx * s;
      if (G.heightAt(px, pz) > -(T.draft + 0.6)) return false;
    }
    for (const b of BT.list) if (Math.hypot(b.x - x, b.z - z) < (T.L + b.T.L) / 2) return false;
    return true;
  };
  BT.updateGhost = function (tpl, o, d) {
    if (!tpl) { if (BT.ghost) { G.scene.remove(BT.ghost); BT.ghost = null; BT.ghostTpl = null; } return null; }
    if (BT.ghostTpl !== tpl) {
      if (BT.ghost) G.scene.remove(BT.ghost);
      BT.ghost = new THREE.Group();
      for (const p of BT.parts(tpl)) BT.ghost.add(new THREE.Mesh(p.geo, BT.ghostOk));
      G.scene.add(BT.ghost); BT.ghostTpl = tpl;
    }
    // intersezione col piano del mare
    if (d.y > -0.02) { BT.ghost.visible = false; return null; }
    const t = (G.SEA - o.y) / d.y;
    if (t > 40) { BT.ghost.visible = false; return null; }
    const x = o.x + d.x * t, z = o.z + d.z * t, yaw = G.Player.yaw + Math.PI;
    const ok = BT.checkWater(tpl, x, z, yaw) && G.World.groundAt(o.x + d.x * Math.min(t, 1), o.z) < 50;
    BT.ghost.visible = true; BT.ghost.position.set(x, G.waveHeight(x, z, G.time) , z); BT.ghost.rotation.y = yaw;
    BT.ghost.children.forEach((m) => (m.material = ok ? BT.ghostOk : BT.ghostBad));
    return { tpl, x, z, yaw, ok };
  };

  /* ---------- selezione di una parte col mirino ---------- */
  const _inv = new THREE.Matrix4(), _o = new V3(), _d = new V3(), _ray = new THREE.Ray(), _hit = new V3();
  // basta mirare la barca intera (scatola che contiene tutte le parti)
  BT.raycast = function (o, d, max) {
    let best = null, bt = max;
    for (const bo of BT.list) {
      if (bo.root.position.distanceTo(o) > bo.T.L + max) continue;
      if (!bo.bbox) { bo.bbox = new THREE.Box3(); for (const p of bo.parts) bo.bbox.union(p.geo.boundingBox); bo.bbox.expandByScalar(0.35); }
      bo.inner.updateMatrixWorld(true);
      _inv.copy(bo.inner.matrixWorld).invert();
      _o.copy(o).applyMatrix4(_inv); _d.copy(d).transformDirection(_inv);
      _ray.set(_o, _d);
      if (_ray.intersectBox(bo.bbox, _hit)) {
        const dist = _hit.applyMatrix4(bo.inner.matrixWorld).distanceTo(o);
        if (dist < bt) { bt = dist; const free = bo.filled.indexOf(false); best = { boat: bo, part: free >= 0 ? free : 0, t: dist }; }
      }
    }
    return best;
  };
  BT.missing = (b) => b.parts.map((p, i) => i).filter((i) => !b.filled[i]);
  // monta tutte le parti per cui ci sono i materiali
  BT.fillAll = function (b) {
    let n = 0;
    for (const i of BT.missing(b)) { const p = b.parts[i]; if (G.Player.count(p.item) >= p.n && BT.fillPart(b, i)) n++; }
    return n;
  };

  /* ---------- fisica di galleggiamento e guida ---------- */
  BT.windFactor = function (b) {
    const hx = Math.sin(b.yaw), hz = Math.cos(b.yaw);
    const wd = G.Climate ? G.Climate.windDirAt(b.x || 0, b.z || 0) : BT.wind.dir;
    const wx = Math.sin(wd), wz = Math.cos(wd);
    const c = hx * wx + hz * wz; // 1 = vento in poppa, -1 = controvento
    const a = Math.acos(G.clamp(c, -1, 1)); // 0..PI
    let f;
    if (a < Math.PI * 0.35) f = 0.78 + 0.1 * (a / (Math.PI * 0.35));
    else if (a < Math.PI * 0.62) f = 1.0;
    else if (a < Math.PI * 0.8) f = G.lerp(1.0, 0.45, (a - Math.PI * 0.62) / (Math.PI * 0.18));
    else f = G.lerp(0.45, 0.12, (a - Math.PI * 0.8) / (Math.PI * 0.2));
    // senza vento le vele non portano; con vento forte la barca corre di più
    return f * Math.min(1.35, BT.wind.str * 1.6);
  };
  BT.update = function (dt, t, input) {
    // la direzione la gestisce il clima (cambia col tempo e da zona a zona); la forza è quella del mondo più il meteo
    if (!G.Climate) BT.wind.dir += Math.sin(t * 0.013) * dt * 0.01;
    BT.wind.str = (G.Climate ? G.Climate.windLevel() : G.WIND.level) / 10 * (0.85 + 0.15 * Math.sin(t * 0.05 + 1.3));
    G.updateWind(dt);
    BT.updateHelmMarks(t);
    for (const b of BT.list) {
      const T = b.T;
      const driving = G.Player.boat === b && G.Player.helm;
      const remoteDrive = b.net && performance.now() - b.net.t < 1500 && !driving;
      if (b.free) { freeStep(b, dt, t, input, driving, remoteDrive); continue; }
      if (driving && BT.isComplete(b) && T.oars) {
        row(b, dt, input);
      } else if (driving && BT.isComplete(b)) {
        let target = 0;
        const fwd = input.f, turn = input.t;
        const max = T.speed * (T.sail ? BT.windFactor(b) * (G.Combat && G.Combat.has('vela_leggendaria') ? 1.3 : 1) : 1);
        if (fwd > 0) target = max; else if (fwd < 0) target = -max * 0.3;
        b.speed += (target - b.speed) * Math.min(1, dt * (T.sail ? 0.35 : 0.9));
        b.rudder += (turn - b.rudder) * Math.min(1, dt * 3);
        b.yaw += b.rudder * T.turn * dt * (0.25 + Math.min(Math.abs(b.speed) / T.speed, 1) * 0.9) * Math.sign(b.speed || 1);
      } else if (b.ai && BT.isComplete(b)) {
        b.ai(b, dt); // nave guidata dal gioco (pirati)
      } else if (remoteDrive) {
        // un altro giocatore la sta guidando: insegui lo stato ricevuto
        const k = Math.min(1, dt * 6);
        b.speed = b.net.speed;
        const px = b.net.x + Math.sin(b.net.yaw) * b.net.speed * (performance.now() - b.net.t) / 1000, pz = b.net.z + Math.cos(b.net.yaw) * b.net.speed * (performance.now() - b.net.t) / 1000;
        b.x += (px - b.x) * k; b.z += (pz - b.z) * k; b.yaw += G.angleDiff(b.yaw, b.net.yaw) * k;
      } else { b.speed *= Math.pow(0.4, dt); b.rudder *= 0.9; b.yawRate *= Math.pow(0.1, dt); b.yaw += b.yawRate * dt; drift(b, dt); if (!b.net || performance.now() - b.net.t > 1500) { b.oarL.on = b.oarR.on = false; b.oarL.ph = b.oarR.ph = 0; } }
      if (T.oars) animOars(b, dt, t);
      // movimento + collisione col fondale
      const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      if (Math.abs(b.speed) > 0.01 && !remoteDrive) {
        const nx = b.x + fx * b.speed * dt, nz = b.z + fz * b.speed * dt;
        const bow = Math.sign(b.speed) * T.L * 0.5;
        const g1 = G.heightAt(nx + fx * bow, nz + fz * bow), g2 = G.heightAt(nx, nz);
        const iced = G.iceAt && G.coldAt(nx, nz) > 0.55 && G.iceAt(nx + fx * bow, nz + fz * bow);
        if (g1 > -T.draft * 0.7 || g2 > -T.draft * 0.7 || iced) {
          if (Math.abs(b.speed) > 2.5 && driving) { G.UI.toast(iced ? 'Il mare è ghiacciato: cerca un canale d’acqua libera' : 'Incagliato! Fai retromarcia (S)', 'warn'); if (G.Audio) G.Audio.hit('wood'); }
          b.speed = -b.speed * 0.25;
        } else { b.x = nx; b.z = nz; }
        // spruzzi a prua
        if (Math.abs(b.speed) > 2 && Math.random() < dt * Math.abs(b.speed) * 1.5 && BT.isComplete(b)) {
          const px = b.x + fx * T.L * 0.5, pz = b.z + fz * T.L * 0.5;
          G.FX.splash(px + (Math.random() - 0.5) * T.W * 0.5, G.waveHeight(px, pz, t), pz + (Math.random() - 0.5) * T.W * 0.5, 3);
        }
      }
      // gorghi: la corrente trascina la barca in cerchio e quasi annulla vele e remi
      if (G.Climate && BT.isComplete(b) && !remoteDrive) {
        const [cx, cz, k] = G.Climate.current(b.x, b.z);
        if (k > 0.02) {
          b.x += cx * dt; b.z += cz * dt;
          b.speed *= Math.pow(1 - Math.min(0.95, k * 0.9), dt * 2.2);
          b.yaw += (b.yawSpin = (b.yawSpin || 0) + (Math.sign(cx * Math.cos(b.yaw) - cz * Math.sin(b.yaw)) * k * 0.5 - (b.yawSpin || 0)) * Math.min(1, dt)) * dt;
        }
        const was = G.Climate.trapped.has(b.id), now = k > 0.35;
        if (now !== was) {
          if (now) { G.Climate.trapped.add(b.id); if (G.Player.boat === b) G.UI.toast('Sei finito in un gorgo! La barca è bloccata: aspetta che il vento cambi o cali', 'warn'); }
          else { G.Climate.trapped.delete(b.id); if (G.Player.boat === b) G.UI.toast('Il vento è cambiato: il gorgo si placa, la barca è libera', 'good'); }
        }
      }
      // galleggiamento: campiona le onde a prua, poppa e fianchi
      const hb = G.waveHeight(b.x + fx * T.L * 0.4, b.z + fz * T.L * 0.4, t), hs = G.waveHeight(b.x - fx * T.L * 0.4, b.z - fz * T.L * 0.4, t);
      const hl = G.waveHeight(b.x - fz * T.W * 0.45, b.z + fx * T.W * 0.45, t), hr = G.waveHeight(b.x + fz * T.W * 0.45, b.z - fx * T.W * 0.45, t);
      const hc = (hb + hs + hl + hr) / 4 + (T.lift || 0);
      const damp = Math.min(1, dt * 3.5);
      b.y += (hc - b.y) * damp;
      b.pitch += (-Math.atan2(hb - hs, T.L * 0.8) * 0.85 - b.pitch) * damp;
      b.roll += (Math.atan2(hl - hr, T.W * 0.9) * 0.8 + b.rudder * Math.min(Math.abs(b.speed), 6) * 0.012 - b.roll) * damp;
      b.root.position.set(b.x, b.y, b.z);
      b.root.rotation.set(0, b.yaw, 0);
      b.inner.rotation.set(b.pitch, 0, b.roll);
    }
  };
  // barca libera: fisica pezzo per pezzo (freeboat.js), poi movimento, fondale e gorghi come le altre
  // deriva: una barca senza ancora (e senza nessuno al timone) si lascia portare dal vento, piano.
  // Più vento = più deriva; le barche a vela (tela esposta) vanno un po' di più. Si ferma sulla riva.
  function drift(b, dt) {
    if (b.anchored || b.sunk || b.ai || b.pirate) return;
    if (G.Net && G.Net.on && !G.Net.isHost) return; // la muove chi ospita
    if (b.free ? !(b.pcs && b.pcs.length) : !BT.isComplete(b)) return;
    const wd = G.Climate ? G.Climate.windDirAt(b.x, b.z) : BT.wind.dir, str = BT.wind.str || 0;
    if (str < 0.02) return;
    const v = (0.04 + str * 0.3) * (b.T.sail ? 1.35 : 1) * (G.Player.boat === b ? 0.8 : 1);
    const nx = b.x + Math.sin(wd) * v * dt, nz = b.z + Math.cos(wd) * v * dt;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), L = b.T.L * 0.5, lim = -b.T.draft * 0.8;
    if (G.heightAt(nx, nz) > lim || G.heightAt(nx + fx * L, nz + fz * L) > lim || G.heightAt(nx - fx * L, nz - fz * L) > lim) return; // incagliata: resta lì
    b.x = nx; b.z = nz;
    // la barca si gira lentamente di fianco al vento, come fanno le barche alla deriva
    const side = wd + Math.PI / 2 * (G.angleDiff(b.yaw, wd + Math.PI / 2) > Math.PI / 2 || G.angleDiff(b.yaw, wd + Math.PI / 2) < -Math.PI / 2 ? -1 : 1);
    b.yaw += G.clamp(G.angleDiff(b.yaw, side), -1, 1) * dt * 0.03 * (0.4 + str);
    // ogni tanto chi ospita manda la posizione agli altri
    if (G.Net && G.Net.on && (b._dsend = (b._dsend || 0) - dt) <= 0) { b._dsend = 2; G.Net.send({ t: 'bst', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(3), speed: 0 }); }
    if ((b._dsave = (b._dsave || 0) - dt) <= 0) { b._dsave = 20; G.saveSoon && G.saveSoon(); }
  }
  BT.drift = drift;
  function freeStep(b, dt, t, input, driving, remoteDrive) {
    const T = b.T;
    if (remoteDrive) {
      const k = Math.min(1, dt * 6); b.speed = b.net.speed;
      const el = (performance.now() - b.net.t) / 1000, px = b.net.x + Math.sin(b.net.yaw) * b.net.speed * el, pz = b.net.z + Math.cos(b.net.yaw) * b.net.speed * el;
      b.x += (px - b.x) * k; b.z += (pz - b.z) * k; b.yaw += G.angleDiff(b.yaw, b.net.yaw) * k;
    }
    G.FreeBoat.step(b, dt, t, input, driving && !remoteDrive);
    if (!driving && !remoteDrive) drift(b, dt);
    if (b.sunk) { b.root.rotation.set(0, b.yaw, 0); b.inner.rotation.set(b.pitch, 0, b.roll); return; }
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    if (Math.abs(b.speed) > 0.01 && !remoteDrive) {
      const nx = b.x + fx * b.speed * dt, nz = b.z + fz * b.speed * dt, bow = Math.sign(b.speed) * T.L * 0.5;
      const g1 = G.heightAt(nx + fx * bow, nz + fz * bow), g2 = G.heightAt(nx, nz);
      const iced = G.iceAt && G.coldAt(nx, nz) > 0.55 && G.iceAt(nx + fx * bow, nz + fz * bow);
      if (g1 > -T.draft * 0.8 || g2 > -T.draft * 0.8 || iced) { if (Math.abs(b.speed) > 2.5 && driving) { G.UI.toast(iced ? 'Il mare è ghiacciato' : 'Incagliato! Fai retromarcia (S)', 'warn'); if (G.Audio) G.Audio.hit('wood'); } b.speed = -b.speed * 0.25; }
      else { b.x = nx; b.z = nz; }
      if (Math.abs(b.speed) > 2 && Math.random() < dt * Math.abs(b.speed) * 1.2) { const px = b.x + fx * T.L * 0.5, pz = b.z + fz * T.L * 0.5; G.FX.splash(px, G.waveHeight(px, pz, t), pz, 3); }
    }
    if (G.Climate && !remoteDrive) {
      const [cx, cz, k] = G.Climate.current(b.x, b.z);
      if (k > 0.02) { b.x += cx * dt; b.z += cz * dt; b.speed *= Math.pow(1 - Math.min(0.95, k * 0.9), dt * 2.2); }
    }
    b.root.position.set(b.x, b.y, b.z);
    b.root.rotation.set(0, b.yaw, 0);
    b.inner.rotation.set(b.pitch, 0, b.roll);
  }
  /* ---------- voga: A = remo sinistro, D = remo destro ----------
     Ogni remo compie un ciclo: passata in acqua (spinta) e ritorno in aria.
     Due remi a tempo = dritto; uno solo = la barca gira dall'altra parte.
     Con S tenuto premuto si scia all'indietro. */
  const STROKE = 1.15, DRIVE = 0.55;
  function oarStep(o, held, dt) {
    if (held) { o.on = true; o.ph = (o.ph + dt / STROKE) % 1; }
    else if (o.ph > 0) { o.on = false; const np = o.ph + dt / STROKE; o.ph = np >= 1 ? 0 : np < DRIVE ? DRIVE : np; }
    // spinta solo durante la passata con il tasto premuto
    if (!held || o.ph >= DRIVE) return 0;
    return Math.sin((o.ph / DRIVE) * Math.PI);
  }
  function row(b, dt, input) {
    const back = input.f < 0 ? -0.6 : 1;
    const pl0 = b.oarL.ph, pr0 = b.oarR.ph;
    const fl = oarStep(b.oarL, input.l, dt) * back, fr = oarStep(b.oarR, input.r, dt) * back;
    // spruzzo quando la pala entra in acqua
    for (const [o, p0, side] of [[b.oarL, pl0, -1], [b.oarR, pr0, 1]]) if (o.on && p0 > 0.9 && o.ph < 0.1) {
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw), d = b.T.W / 2 + 1.6;
      G.FX.splash(b.x + c * d * side, G.SEA, b.z - s * d * side, 5); if (G.Audio && G.Player.boat === b) G.Audio.splash();
    }
    const K = 4.6, drag = 0.62;
    b.speed += (K * (fl + fr) * (b.T.speed / 5.4) - drag * b.speed) * dt;
    // il remo sinistro spinge il lato sinistro: la prua va a destra (yaw diminuisce)
    b.yawRate += ((fr - fl) * 2.4 * b.T.turn - b.yawRate * 2.0) * dt;
    b.yaw += b.yawRate * dt;
    b.rudder = G.clamp(b.yawRate * 0.8, -1, 1);
  }
  BT.row = row;
  // posizione dei remi: passata (pala in acqua, da prua a poppa) e ritorno (pala sollevata)
  const _pm = new THREE.Matrix4(), _pr = new THREE.Matrix4(), _pt = new THREE.Matrix4();
  function oarPose(o) {
    if (!o.on && o.ph === 0) return [0.15, 0.22];
    if (o.ph < DRIVE) { const u = o.ph / DRIVE; return [0.6 - 1.2 * u, -0.04]; }
    const u = (o.ph - DRIVE) / (1 - DRIVE); return [-0.6 + 1.2 * (0.5 - 0.5 * Math.cos(u * Math.PI)), 0.28 * Math.sin(u * Math.PI) + 0.05];
  }
  function animOars(b, dt) {
    for (let i = 0; i < b.parts.length; i++) {
      const p = b.parts[i]; if (!p.oar) continue;
      const m = b.meshes[i], o = p.oar < 0 ? b.oarL : b.oarR;
      const [sweep, lift] = oarPose(o);
      m.matrixAutoUpdate = false;
      const ry = p.oar < 0 ? sweep : -sweep, rz = p.oar < 0 ? -lift : lift;
      _pt.makeTranslation(-p.pivot.x, -p.pivot.y, -p.pivot.z);
      _pr.makeRotationFromEuler(new THREE.Euler(0, ry, rz, 'YZX'));
      _pm.makeTranslation(p.pivot.x, p.pivot.y, p.pivot.z).multiply(_pr).multiply(_pt);
      m.matrix.copy(_pm); m.matrixWorldNeedsUpdate = true;
    }
  }
  // posizione del sedile in coordinate mondo
  const _s = new V3();
  BT.seatWorld = function (b, out) {
    b.root.updateMatrixWorld(true);
    _s.set(b.T.seat[0], b.T.seat[1], b.T.seat[2]);
    return (out || new V3()).copy(_s).applyMatrix4(b.inner.matrixWorld);
  };
  BT.nearest = function (p, maxD) {
    let best = null, bd = maxD;
    for (const b of BT.list) { const d = Math.hypot(b.x - p.x, b.z - p.z) - Math.max(b.T.L, b.T.W) * 0.45; if (d < bd) { bd = d; best = b; } }
    return best;
  };
})();
