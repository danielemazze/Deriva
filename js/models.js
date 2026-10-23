'use strict';
/* ==========================================================
   Modelli procedurali: alberi, cespugli, rocce, coralli, alghe
   ========================================================== */
(function () {
  const G = globalThis.G;
  const M = (G.MODELS = {});
  const V3 = THREE.Vector3;

  /* ---------- unione di geometrie (non indicizzate) ---------- */
  M.merge = function (list) {
    const geos = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (!g.attributes.normal) g.computeVertexNormals();
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3);
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  };
  M.colorize = function (g, r, gg, b, jitter, rnd) {
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const j = jitter ? 1 + (rnd() - 0.5) * jitter : 1; c[i * 3] = r * j; c[i * 3 + 1] = gg * j; c[i * 3 + 2] = b * j; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };

  /* tronco curvo lungo una curva (tubo rastremato) */
  M.trunk = function (pts, r0, r1, radial, vRepeat, color, segN) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = segN || Math.max(4, pts.length * 3);
    const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
    const p = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
    const frames = curve.computeFrenetFrames(seg, false);
    const tmp = new V3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, r = r0 + (r1 - r0) * Math.pow(t, 0.8);
      const c = curve.getPointAt(t);
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        tmp.set(nrm.getX(k), nrm.getY(k), nrm.getZ(k));
        const bump = 1 + Math.sin(j * 2.1 + i * 0.7) * 0.04;
        p.setXYZ(k, c.x + tmp.x * r * bump, c.y + tmp.y * r * bump, c.z + tmp.z * r * bump);
        uv.setXY(k, j / radial, t * vRepeat);
      }
    }
    geo.computeVertexNormals();
    if (color) M.colorize(geo, color[0], color[1], color[2]);
    return geo;
  };
  /* card incrociate di fogliame con normali "sferiche" (illuminazione morbida) */
  M.leafCluster = function (cx, cy, cz, size, rnd, center, planes = 3, tint) {
    const geos = [];
    for (let i = 0; i < planes; i++) {
      const g = new THREE.PlaneGeometry(size, size);
      g.rotateX(rnd() * Math.PI); g.rotateY(rnd() * Math.PI * 2); g.rotateZ((rnd() - 0.5) * 0.8);
      g.translate(cx, cy, cz);
      const p = g.attributes.position, n = g.attributes.normal;
      for (let k = 0; k < p.count; k++) {
        const dx = p.getX(k) - center.x, dy = (p.getY(k) - center.y) * 1.2 + 0.3, dz = p.getZ(k) - center.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        n.setXYZ(k, dx / l, dy / l, dz / l);
      }
      const t = tint || [1, 1, 1], j = 0.85 + rnd() * 0.3;
      M.colorize(g, t[0] * j, t[1] * j, t[2] * j);
      geos.push(g);
    }
    return geos;
  };

  /* ---------------- ALBERI ---------------- */
  M.oak = function (seed, birch) {
    const rnd = G.mulberry32(seed);
    // forma: 0 = equilibrata, 1 = alta e stretta, 2 = bassa e larga
    const shape = seed % 3;
    const H = (birch ? 7 + rnd() * 3 : 5.5 + rnd() * 2.5) * (shape === 1 ? 1.3 : shape === 2 ? 0.82 : 1);
    const spread = shape === 1 ? 0.7 : shape === 2 ? 1.45 : 1;
    const lean = new V3((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8);
    const pts = [new V3(0, -0.4, 0), new V3(lean.x * 0.2, H * 0.35, lean.z * 0.2), new V3(lean.x * 0.6, H * 0.7, lean.z * 0.6), new V3(lean.x, H, lean.z)];
    const bc = birch ? [1.55, 1.52, 1.45] : [1, 1, 1];
    const trunkG = [M.trunk(pts, birch ? 0.22 : 0.38, 0.12, 9, 3, bc)];
    const lodG = [M.trunk(pts, birch ? 0.22 : 0.38, 0.12, 5, 3, bc, 5)];
    const tips = [pts[3].clone()];
    const nb = birch ? 4 : 5 + ((rnd() * 3) | 0);
    for (let i = 0; i < nb; i++) {
      const t = 0.45 + rnd() * 0.45, a = rnd() * Math.PI * 2, len = ((birch ? 1.6 : 2.4) + rnd() * 1.4) * spread;
      const s = new V3(lean.x * t, H * t, lean.z * t);
      const e = s.clone().add(new V3(Math.cos(a) * len, len * (0.45 + rnd() * 0.4) / spread, Math.sin(a) * len));
      const m = s.clone().lerp(e, 0.5).add(new V3(0, 0.25, 0));
      trunkG.push(M.trunk([s, m, e], birch ? 0.1 : 0.16, 0.05, 6, 1.5, bc, 4));
      lodG.push(M.trunk([s, m, e], birch ? 0.1 : 0.16, 0.05, 3, 1.5, bc, 2));
      tips.push(e);
    }
    const center = new V3(lean.x, H * 0.82, lean.z);
    const leaves = [];
    const tint = birch ? [1.05, 1.0, 0.75] : [1, 1, 1];
    for (const tp of tips) for (let k = 0; k < (birch ? 4 : 6); k++) {
      leaves.push(...M.leafCluster(tp.x + (rnd() - 0.5) * 1.6, tp.y + (rnd() - 0.3) * 1.2, tp.z + (rnd() - 0.5) * 1.6, (birch ? 2.4 : 3.1) + rnd() * 1.0, rnd, center, 2, tint));
    }
    for (let k = 0; k < (birch ? 9 : 16); k++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 2.2 * spread, y = H * 0.7 + rnd() * 2.2;
      leaves.push(...M.leafCluster(lean.x + Math.cos(a) * r, y, lean.z + Math.sin(a) * r, 3.0 + rnd(), rnd, center, 2, tint));
    }
    const leavesG = M.merge(leaves);
    return { trunk: M.merge(trunkG), leaves: leavesG, trunkLod: M.merge(lodG), leavesLod: M.decimateCards(leavesG, 6, 3, 1.5), height: H + 2.5, radius: birch ? 0.3 : 0.45, leafTex: birch ? 'leavesBirch' : 'leavesOak' };
  };

  M.pine = function (seed) {
    const rnd = G.mulberry32(seed);
    const H = (9 + rnd() * 5) * (seed % 2 ? 1.25 : 1);
    const tp = [new V3(0, -0.4, 0), new V3(0, H * 0.5, 0), new V3((rnd() - 0.5) * 0.3, H, 0)];
    const trunk = M.trunk(tp, 0.34, 0.06, 8, 5, [0.85, 0.8, 0.78]);
    const trunkLod = M.trunk(tp, 0.34, 0.06, 4, 5, [0.85, 0.8, 0.78], 3);
    const center = new V3(0, H * 0.55, 0);
    const cards = [];
    const rings = 9;
    for (let r = 0; r < rings; r++) {
      const t = r / rings, y = H * (0.22 + t * 0.78);
      const rad = (1 - t) * 3.1 + 0.5;
      const n = 7 - Math.floor(t * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r * 0.7 + rnd() * 0.4;
        const g = new THREE.PlaneGeometry(rad * 1.25, rad * 0.9);
        g.translate(rad * 0.62, 0, 0);
        g.rotateX(Math.PI / 2 + (rnd() - 0.5) * 0.3);
        g.rotateZ(-0.35 - rnd() * 0.25);
        g.rotateY(a);
        g.translate(0, y, 0);
        const p = g.attributes.position, nn = g.attributes.normal;
        for (let k = 0; k < p.count; k++) { const dx = p.getX(k), dy = p.getY(k) - center.y + 2, dz = p.getZ(k); const l = Math.hypot(dx, dy, dz); nn.setXYZ(k, dx / l, dy / l, dz / l); }
        M.colorize(g, 0.85 + rnd() * 0.3, 0.9 + rnd() * 0.2, 0.85);
        cards.push(g);
      }
    }
    // punta
    for (let i = 0; i < 3; i++) { const g = new THREE.PlaneGeometry(0.9, 1.6); g.rotateY(i * Math.PI / 3); g.translate(0, H + 0.4, 0); M.colorize(g, 1, 1, 1); cards.push(g); }
    const lv = M.merge(cards);
    return { trunk, leaves: lv, trunkLod, leavesLod: M.decimateCards(lv, 6, 2, 1.25), height: H + 1, radius: 0.38, leafTex: 'pine' };
  };

  M.palm = function (seed) {
    const rnd = G.mulberry32(seed);
    const H = 6.5 + rnd() * 3.5;
    const bend = 1.5 + rnd() * 2.2, a = rnd() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const pts = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(new V3(dx * bend * t * t, H * t - 0.3, dz * bend * t * t)); }
    const trunk = M.trunk(pts, 0.3, 0.19, 9, 8);
    const trunkLod = M.trunk(pts, 0.3, 0.19, 4, 8, null, 5);
    const top = pts[5];
    const fronds = [];
    const nf = 9 + ((rnd() * 4) | 0);
    for (let f = 0; f < nf; f++) {
      const ang = (f / nf) * Math.PI * 2 + rnd() * 0.3, L = 3.2 + rnd() * 1.4, W = 1.5;
      const segs = 7, g = new THREE.PlaneGeometry(L, W, segs, 1);
      const p = g.attributes.position, uvA = g.attributes.uv;
      const lift = 0.5 + rnd() * 0.5, droop = 0.9 + rnd() * 0.6;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k) + L / 2, z = p.getY(k); const t = x / L;
        const y = Math.sin(t * Math.PI * 0.85) * lift * L * 0.35 - t * t * droop * L * 0.55;
        p.setXYZ(k, x, y + Math.abs(z) * 0.25 * t, z * (0.5 + 0.5 * Math.sin(t * Math.PI)));
        uvA.setXY(k, t, uvA.getY(k));
      }
      g.rotateY(ang); g.translate(top.x, top.y, top.z);
      g.computeVertexNormals();
      const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) { nn.setY(k, Math.abs(nn.getY(k)) * 0.7 + 0.5); }
      M.colorize(g, 0.95 + rnd() * 0.15, 1, 0.9);
      fronds.push(g);
    }
    // noci di cocco (vertex color, nel tronco)
    const nuts = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.IcosahedronGeometry(0.17, 1); const aa = i * 1.6 + rnd();
      s.translate(top.x + Math.cos(aa) * 0.28, top.y - 0.35 - rnd() * 0.15, top.z + Math.sin(aa) * 0.28);
      M.colorize(s, 0.55, 0.4, 0.22); nuts.push(s);
    }
    return { trunk: M.merge([trunk, ...nuts]), leaves: M.merge(fronds), trunkLod: M.merge([trunkLod]), height: H + 1, radius: 0.32, leafTex: 'frond', top: top.clone() };
  };

  M.bush = function (seed, berries) {
    const rnd = G.mulberry32(seed);
    const center = new V3(0, 0.6, 0);
    const leaves = [];
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.6;
      leaves.push(...M.leafCluster(Math.cos(a) * r, 0.5 + rnd() * 0.5, Math.sin(a) * r, 1.3 + rnd() * 0.5, rnd, center, 2, [0.85, 1.0, 0.8]));
    }
    let props = null;
    if (berries) {
      const bs = [];
      for (let i = 0; i < 16; i++) {
        const s = new THREE.IcosahedronGeometry(0.045, 0); const a = rnd() * Math.PI * 2, r = 0.45 + rnd() * 0.35;
        s.translate(Math.cos(a) * r, 0.35 + rnd() * 0.75, Math.sin(a) * r);
        M.colorize(s, 0.75, 0.05, 0.14); bs.push(s);
      }
      props = M.merge(bs);
    }
    return { leaves: M.merge(leaves), props };
  };

  /* ---------------- ROCCE ---------------- */
  M.rock = function (seed, flat, detail) {
    const rnd = G.mulberry32(seed);
    const g = new THREE.IcosahedronGeometry(1, detail === undefined ? 2 : detail);
    const p = g.attributes.position;
    const f1 = 1.5 + rnd() * 2, f2 = 3 + rnd() * 3, ph = rnd() * 10;
    const sx = 0.8 + rnd() * 0.6, sy = (flat ? 0.4 : 0.6) + rnd() * 0.4, sz = 0.8 + rnd() * 0.6;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = Math.sin(x * f1 + ph) * Math.sin(y * f1 * 1.3 + ph) * Math.sin(z * f1 * 0.9) * 0.22 + Math.sin(x * f2 + y * f2) * 0.06;
      const k = 1 + n;
      x *= sx * k; y *= sy * k; z *= sz * k;
      // sfaccettature: quantizza leggermente
      if (y < -0.15) y = -0.15 + (y + 0.15) * 0.3;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
    // UV box
    const pp = ng.attributes.position, nn = ng.attributes.normal, uv = new Float32Array(pp.count * 2);
    for (let i = 0; i < pp.count; i++) {
      const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)), az = Math.abs(nn.getZ(i));
      let u, v; if (ay > ax && ay > az) { u = pp.getX(i); v = pp.getZ(i); } else if (ax > az) { u = pp.getZ(i); v = pp.getY(i); } else { u = pp.getX(i); v = pp.getY(i); }
      uv[i * 2] = u * 0.5; uv[i * 2 + 1] = v * 0.5;
    }
    ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    M.colorize(ng, 1, 1, 1, 0.12, rnd);
    return ng;
  };

  /* ---------------- CORALLI ---------------- */
  M.coralBranch = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    function branch(o, dir, len, r, depth) {
      const e = o.clone().add(dir.clone().multiplyScalar(len));
      const m = o.clone().lerp(e, 0.5).add(new V3((rnd() - 0.5) * 0.1, 0, (rnd() - 0.5) * 0.1));
      const g = M.trunk([o, m, e], r, r * 0.7, 4, 1, null, 2);
      const lit = 0.75 + depth * 0.12;
      M.colorize(g, lit, lit, lit);
      parts.push(g);
      if (depth < 2) {
        const n = 2 + (depth === 0 && rnd() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const d = dir.clone().add(new V3((rnd() - 0.5) * 1.3, 0.2 + rnd() * 0.4, (rnd() - 0.5) * 1.3)).normalize();
          branch(e, d, len * (0.6 + rnd() * 0.2), r * 0.72, depth + 1);
        }
      } else {
        const s = new THREE.IcosahedronGeometry(r * 1.25, 0); s.translate(e.x, e.y, e.z); M.colorize(s, 1.15, 1.15, 1.15); parts.push(s);
      }
    }
    for (let i = 0; i < 2; i++) branch(new V3((rnd() - 0.5) * 0.3, -0.1, (rnd() - 0.5) * 0.3), new V3((rnd() - 0.5) * 0.6, 1, (rnd() - 0.5) * 0.6).normalize(), 0.45 + rnd() * 0.2, 0.07, 0);
    return M.merge(parts);
  };
  M.coralBrain = function (seed) {
    const rnd = G.mulberry32(seed);
    const g = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const p = g.attributes.position, ph = rnd() * 10;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ridge = Math.abs(Math.sin(x * 9 + Math.sin(z * 7 + ph) * 1.8 + ph)) * 0.06;
      const k = 1 + ridge;
      p.setXYZ(i, x * k, (y * 0.75 - 0.15) * k, z * k);
    }
    g.computeVertexNormals();
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const pp = ng.attributes.position, cc = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const ridge = Math.abs(Math.sin(pp.getX(i) * 9 + Math.sin(pp.getZ(i) * 7 + ph) * 1.8 + ph)); const l = 0.7 + ridge * 0.4; cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = l; }
    ng.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    return ng;
  };
  M.coralTube = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    const n = 5 + ((rnd() * 6) | 0);
    for (let i = 0; i < n; i++) {
      const h = 0.4 + rnd() * 0.9, r = 0.06 + rnd() * 0.07;
      const g = new THREE.CylinderGeometry(r * 1.25, r, h, 7, 1, true);
      g.translate((rnd() - 0.5) * 0.6, h / 2 - 0.05, (rnd() - 0.5) * 0.6);
      g.rotateZ((rnd() - 0.5) * 0.4); g.rotateX((rnd() - 0.5) * 0.4);
      M.colorize(g, 0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2);
      parts.push(g);
    }
    return M.merge(parts);
  };
  M.coralFan = function (seed) {
    const rnd = G.mulberry32(seed);
    const g = new THREE.CircleGeometry(0.8, 16, 0, Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.5 + seed) * 0.12);
    g.computeVertexNormals();
    g.translate(0, -0.05, 0);
    M.colorize(g, 1, 1, 1);
    return g;
  };
  M.anemone = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    const base = new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10); base.translate(0, 0.05, 0); M.colorize(base, 0.7, 0.7, 0.7); parts.push(base);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = 0.08 + (i % 2) * 0.05;
      const t = new THREE.CylinderGeometry(0.014, 0.026, 0.32, 3); t.translate(0, 0.16, 0);
      t.rotateZ(0.4 + rnd() * 0.3); t.rotateY(a); t.translate(Math.cos(a) * r, 0.13, Math.sin(a) * r);
      M.colorize(t, 1.15, 1.15, 1.15); parts.push(t);
    }
    return M.merge(parts);
  };
  M.starfish = function () {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 0.07 : 0.2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0);
    return M.colorize(g, 1, 1, 1);
  };
  M.seashell = function () {
    const g = new THREE.ConeGeometry(0.09, 0.2, 10, 3); g.rotateZ(Math.PI / 2.2); g.translate(0, 0.05, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 + Math.sin(p.getX(i) * 40) * 0.08));
    g.computeVertexNormals();
    return M.colorize(g, 1, 1, 1);
  };
  /* card verticali incrociate (erba, fiori, alghe) */
  M.cards = function (w, h, n, upNormals) {
    const gs = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); g.rotateY((i / n) * Math.PI);
      if (upNormals) { const nn = g.attributes.normal; for (let k = 0; k < nn.count; k++) nn.setXYZ(k, nn.getX(k) * 0.3, 0.95, nn.getZ(k) * 0.3); }
      gs.push(g);
    }
    return M.merge(gs);
  };
  M.kelp = function (h) {
    const gs = [];
    for (let i = 0; i < 3; i++) { const g = new THREE.PlaneGeometry(1.6, h, 1, 8); g.translate(0, h / 2, 0); g.rotateY((i / 3) * Math.PI); gs.push(g); }
    return M.merge(gs);
  };

  /* ---------- texture per i ventagli di gorgonia ---------- */
  M.fanTexture = function () {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
    const rnd = G.mulberry32(9);
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    function br(x, y, a, len, w, d) {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (d < 6) { br(x2, y2, a - 0.3 - rnd() * 0.3, len * 0.78, w * 0.75, d + 1); br(x2, y2, a + 0.3 + rnd() * 0.3, len * 0.78, w * 0.75, d + 1); }
    }
    br(S / 2, S / 2, -Math.PI / 2, S * 0.1, 5, 0);
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const r = S * (0.2 + i * 0.008); ctx.beginPath(); ctx.arc(S / 2, S / 2, r * 0.45, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  };

  /* ---------- versioni semplificate per la distanza (LOD) ---------- */
  // tiene una card ogni "every" e la ingrandisce per coprire lo stesso volume
  M.decimateCards = function (geo, vertsPerCard, every, grow) {
    const n = geo.attributes.position.count / vertsPerCard;
    const keep = [];
    for (let c = 0; c < n; c++) if (c % every === 0) keep.push(c);
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const a = geo.attributes[name]; if (!a) continue;
      const arr = new Float32Array(keep.length * vertsPerCard * a.itemSize);
      keep.forEach((c, i) => arr.set(a.array.subarray(c * vertsPerCard * a.itemSize, (c + 1) * vertsPerCard * a.itemSize), i * vertsPerCard * a.itemSize));
      out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    const p = out.attributes.position;
    for (let i = 0; i < keep.length; i++) {
      let cx = 0, cy = 0, cz = 0;
      for (let v = 0; v < vertsPerCard; v++) { const k = i * vertsPerCard + v; cx += p.getX(k); cy += p.getY(k); cz += p.getZ(k); }
      cx /= vertsPerCard; cy /= vertsPerCard; cz /= vertsPerCard;
      for (let v = 0; v < vertsPerCard; v++) { const k = i * vertsPerCard + v; p.setXYZ(k, cx + (p.getX(k) - cx) * grow, cy + (p.getY(k) - cy) * grow, cz + (p.getZ(k) - cz) * grow); }
    }
    out.computeBoundingSphere();
    return out;
  };

  /* ---------- nuova vegetazione e dettagli ---------- */
  // normali piegate verso l'alto: luce morbida sulle foglie sottili, niente lati neri
  M.softUp = function (g) {
    const nn = g.attributes.normal;
    for (let k = 0; k < nn.count; k++) { const x = nn.getX(k) * 0.35, y = Math.abs(nn.getY(k)) * 0.35 + 0.8, z = nn.getZ(k) * 0.35, l = Math.hypot(x, y, z); nn.setXYZ(k, x / l, y / l, z / l); }
  };
  // felce: fronde ad arco con card a forma di foglia pennata
  M.fern = function (seed) {
    const rnd = G.mulberry32(seed);
    const fr = [];
    const n = 9 + ((rnd() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const L = 0.7 + rnd() * 0.5, Wd = 0.34, seg = 5;
      const g = new THREE.PlaneGeometry(L, Wd, seg, 1);
      const p = g.attributes.position, uv = g.attributes.uv;
      const lift = 0.55 + rnd() * 0.35;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k) + L / 2, z = p.getY(k), t = x / L;
        p.setXYZ(k, x, Math.sin(t * Math.PI * 0.8) * lift * L * 0.7 - t * t * 0.25, z);
        uv.setXY(k, t, uv.getY(k));
      }
      g.rotateY((i / n) * Math.PI * 2 + rnd() * 0.4);
      g.computeVertexNormals();
      M.softUp(g);
      M.colorize(g, 0.85 + rnd() * 0.25, 0.9 + rnd() * 0.2, 0.85);
      fr.push(g);
    }
    return M.merge(fr);
  };
  // pianta tropicale a foglie larghe (tipo banano/monstera)
  M.tropical = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    const n = 6 + ((rnd() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const L = 1.2 + rnd() * 0.8, Wd = 0.7 + rnd() * 0.3, seg = 6;
      const g = new THREE.PlaneGeometry(L, Wd, seg, 2);
      const p = g.attributes.position, uv = g.attributes.uv;
      const stem = 0.5 + rnd() * 0.6, droop = 0.3 + rnd() * 0.4;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k) + L / 2, z = p.getY(k), t = x / L;
        p.setXYZ(k, x * 0.95, stem + Math.sin(t * Math.PI * 0.7) * 0.35 - t * t * droop + Math.abs(z) * 0.15, z);
        uv.setXY(k, t, uv.getY(k));
      }
      g.rotateY((i / n) * Math.PI * 2 + rnd() * 0.5);
      g.computeVertexNormals();
      M.softUp(g);
      M.colorize(g, 1.1 + rnd() * 0.2, 1.15 + rnd() * 0.1, 1.0);
      parts.push(g);
      // picciolo dalla base alla foglia
      const st = new THREE.CylinderGeometry(0.018, 0.03, stem + 0.05, 5); st.translate(0, (stem + 0.05) / 2 - 0.05, 0);
      const ang = (i / n) * Math.PI * 2; st.rotateZ(0.12); st.rotateY(ang); M.colorize(st, 0.55, 0.7, 0.3);
      parts.push(st);
    }
    return M.merge(parts);
  };
  // funghi: gambi chiari e cappelli di colori diversi
  M.mushrooms = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    const caps = [[0.72, 0.42, 0.22], [0.86, 0.78, 0.62], [0.72, 0.12, 0.08], [0.5, 0.32, 0.18]];
    const cap = caps[seed % caps.length];
    for (let i = 0; i < 3 + ((rnd() * 4) | 0); i++) {
      const h = 0.06 + rnd() * 0.12, r = 0.03 + rnd() * 0.05, x = (rnd() - 0.5) * 0.35, z = (rnd() - 0.5) * 0.35;
      const st = new THREE.CylinderGeometry(r * 0.32, r * 0.42, h, 8); st.translate(x, h / 2, z); M.colorize(st, 0.92, 0.88, 0.8); parts.push(st);
      const cp = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); cp.scale(1, 0.6 + rnd() * 0.3, 1); cp.translate(x, h, z);
      const j = 0.85 + rnd() * 0.3; M.colorize(cp, cap[0] * j, cap[1] * j, cap[2] * j); parts.push(cp);
      if (cap === caps[2]) for (let d = 0; d < 6; d++) { const dot = new THREE.SphereGeometry(r * 0.12, 4, 3); const a = rnd() * 6.28, rr = rnd() * r * 0.75; dot.translate(x + Math.cos(a) * rr, h + r * 0.45, z + Math.sin(a) * rr); M.colorize(dot, 0.95, 0.94, 0.9); parts.push(dot); }
    }
    return M.merge(parts);
  };
  // tronco caduto con radici spezzate
  M.log = function (seed) {
    const rnd = G.mulberry32(seed);
    const L = 3.5 + rnd() * 3, r = 0.28 + rnd() * 0.16;
    const pts = [new V3(-L / 2, r * 0.85, 0), new V3(0, r * 0.9, (rnd() - 0.5) * 0.3), new V3(L / 2, r * 0.8, (rnd() - 0.5) * 0.4)];
    const body = M.trunk(pts, r, r * 0.85, 14, L / 2.5, [0.9, 0.85, 0.8], 10);
    const ends = [];
    for (const [x, rr] of [[-L / 2, r], [L / 2, r * 0.85]]) { const c = new THREE.CircleGeometry(rr * 0.98, 14); c.rotateY(x < 0 ? -Math.PI / 2 : Math.PI / 2); c.translate(x, r * 0.85, 0); M.colorize(c, 0.85, 0.68, 0.48); ends.push(c); }
    for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; const b = M.trunk([new V3(-L / 2 + 0.1, r, 0), new V3(-L / 2 - 0.4, r + Math.sin(a) * 0.5, Math.cos(a) * 0.5)], r * 0.35, r * 0.12, 6, 1, [0.8, 0.75, 0.7], 3); ends.push(b); }
    return { geo: M.merge([body, ...ends]), L, r };
  };
  M.stump = function (seed) {
    const rnd = G.mulberry32(seed);
    const r = 0.35 + rnd() * 0.15, h = 0.4 + rnd() * 0.35;
    const body = M.trunk([new V3(0, -0.2, 0), new V3(0, h * 0.5, 0), new V3(0, h, 0)], r * 1.15, r, 14, 0.6, [0.9, 0.85, 0.8], 4);
    const top = new THREE.CircleGeometry(r, 14); top.rotateX(-Math.PI / 2); top.translate(0, h, 0); M.colorize(top, 0.82, 0.66, 0.46);
    const roots = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28 + rnd(); roots.push(M.trunk([new V3(0, 0.05, 0), new V3(Math.cos(a) * r * 1.6, -0.05, Math.sin(a) * r * 1.6), new V3(Math.cos(a) * r * 2.4, -0.25, Math.sin(a) * r * 2.4)], r * 0.32, r * 0.08, 6, 1, [0.85, 0.8, 0.75], 4)); }
    return M.merge([body, top, ...roots]);
  };
  // legno sbiancato dal mare
  M.driftwood = function (seed) {
    const rnd = G.mulberry32(seed);
    const L = 1.5 + rnd() * 2.5;
    const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(new V3((t - 0.5) * L, 0.1 + Math.sin(t * 3 + seed) * 0.08, Math.sin(t * 5 + seed) * 0.25)); }
    const main = M.trunk(pts, 0.11 + rnd() * 0.06, 0.04, 8, L / 2, [1.5, 1.45, 1.38], 10);
    const br = M.trunk([pts[2].clone(), pts[2].clone().add(new V3(0.3, 0.05, 0.6 + rnd() * 0.4))], 0.05, 0.02, 6, 0.5, [1.5, 1.45, 1.38], 3);
    return M.merge([main, br]);
  };
  // ciottoli sparsi
  M.pebbles = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    for (let i = 0; i < 7 + ((rnd() * 6) | 0); i++) {
      const g = new THREE.IcosahedronGeometry(0.04 + rnd() * 0.07, 1);
      g.scale(1, 0.45 + rnd() * 0.3, 0.7 + rnd() * 0.5); g.rotateY(rnd() * 6.28);
      g.translate((rnd() - 0.5) * 0.9, 0.01, (rnd() - 0.5) * 0.9);
      const l = 0.6 + rnd() * 0.5; M.colorize(g, l, l * 0.97, l * 0.92); parts.push(g);
    }
    return M.merge(parts);
  };

  /* ---------- cactus: saguaro con costole, e cactus a botte ---------- */
  function ribbed(h, r0, r1, ribs, seg, cap) {
    const g = new THREE.CylinderGeometry(r1, r0, h, ribs * 2, seg, !cap);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const k = 1 + Math.cos(a * ribs) * 0.07;
      // cima arrotondata
      const t = (y + h / 2) / h, round = t > 0.86 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.86) / 0.14, 2))) : 1;
      p.setXYZ(i, Math.cos(a) * r * k * round, y, Math.sin(a) * r * k * round);
    }
    g.computeVertexNormals();
    return g;
  }
  M.cactus = function (seed) {
    const rnd = G.mulberry32(seed);
    const parts = [];
    const green = () => { const j = 0.85 + rnd() * 0.25; return [0.55 * j, 0.78 * j, 0.42 * j]; };
    if (seed % 3 === 2) {
      // cactus a botte: basso e tondo
      for (let i = 0; i < 1 + ((rnd() * 3) | 0); i++) {
        const r = 0.22 + rnd() * 0.18, h = r * (1.3 + rnd() * 0.6);
        const g = ribbed(h, r, r * 0.92, 14, 6, true); g.translate((rnd() - 0.5) * 0.7, h / 2, (rnd() - 0.5) * 0.7);
        const c = green(); M.colorize(g, c[0], c[1], c[2]); parts.push(g);
      }
      return M.merge(parts);
    }
    const H = 2.6 + rnd() * 2.2, R = 0.2 + rnd() * 0.06;
    const trunk = ribbed(H, R, R * 0.86, 12, 10, true); trunk.translate(0, H / 2 - 0.05, 0);
    let c = green(); M.colorize(trunk, c[0], c[1], c[2]); parts.push(trunk);
    const na = 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < na; i++) {
      const a = (i / na) * Math.PI * 2 + rnd() * 0.8, y0 = H * (0.35 + rnd() * 0.3), out = 0.38 + rnd() * 0.25, up = 0.6 + rnd() * 1.1, r = R * 0.68;
      const elbow = ribbed(out, r, r, 10, 2, false); elbow.rotateZ(Math.PI / 2); elbow.translate(out / 2 + R * 0.6, 0, 0);
      const arm = ribbed(up, r, r * 0.9, 10, 6, true); arm.translate(out + R * 0.6, up / 2, 0);
      const knee = new THREE.SphereGeometry(r * 1.02, 10, 6); knee.translate(out + R * 0.6, 0, 0);
      for (const g of [elbow, arm, knee]) { g.rotateY(a); g.translate(0, y0, 0); c = green(); M.colorize(g, c[0], c[1], c[2]); parts.push(g); }
    }
    // fiori sulla cima, a volte
    if (rnd() < 0.5) for (let i = 0; i < 4; i++) { const f = new THREE.SphereGeometry(0.05, 6, 4); const a = i * 1.6; f.translate(Math.cos(a) * R * 0.6, H - 0.02, Math.sin(a) * R * 0.6); M.colorize(f, 1.0, 0.85, 0.7); parts.push(f); }
    return M.merge(parts);
  };
})();
