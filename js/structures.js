'use strict';
/* ==========================================================
   Strutture dei luoghi: villaggi (per stile), fari, relitti,
   covi dei pirati, tesori scavati. Geometria unita per
   materiale, collisioni per Build, casse e letti come pezzi
   "generati" (non salvati), abitanti animati.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const S = (G.Structures = { active: new Map(), timer: 0, npcs: [], lights: [] });
  const V3 = THREE.Vector3;
  const M = () => G.MODELS;

  /* ---------------- materiali ---------------- */
  let MT = null;
  S.mats = function () {
    if (MT) return MT;
    const T = G.TEX, std = (o) => new THREE.MeshStandardMaterial(o);
    const P = (key, o, extra) => G.patch(std(o), Object.assign({ key: 's_' + key }, extra || {}));
    const rep = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    for (const k of ['stuccoT', 'tilesT', 'thatchT', 'shinglesT', 'stonewallT', 'slateT', 'planksT']) { rep(T[k].map); rep(T[k].normal); }
    MT = {
      stucco: P('stucco', { map: T.stuccoT.map, normalMap: T.stuccoT.normal, vertexColors: true, roughness: 0.92 }),
      tiles: P('tiles', { map: T.tilesT.map, normalMap: T.tilesT.normal, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
      thatch: P('thatch', { map: T.thatchT.map, normalMap: T.thatchT.normal, vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
      shingle: P('shingle', { map: T.shinglesT.map, normalMap: T.shinglesT.normal, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
      stone: P('stone', { map: T.stonewallT.map, normalMap: T.stonewallT.normal, vertexColors: true, roughness: 0.9 }),
      slate: P('slate', { map: T.slateT.map, normalMap: T.slateT.normal, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
      wood: P('wood', { map: T.planksT.map, normalMap: T.planksT.normal, vertexColors: true, roughness: 0.85 }),
      logs: G.MAT.logs,
      bark: G.MAT.bark,
      cloth: P('cloth', { map: T.clothT.map, normalMap: T.clothT.normal, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }, { wind: { amp: 0.004, freq: 2.0, mode: 'tip' } }),
      iron: P('iron', { color: 0x2c2e31, roughness: 0.5, metalness: 0.75, vertexColors: true }),
      dark: new THREE.MeshBasicMaterial({ color: 0x0b0806 }),
      glow: new THREE.MeshStandardMaterial({ color: 0x2a1e12, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0xfff0b0, emissiveIntensity: 0, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2 }),
      water: new THREE.MeshStandardMaterial({ color: 0x2d7c8a, roughness: 0.08, metalness: 0.2 }),
      leaves: G.MAT.leaves.leavesOak,
      beam: new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      sign: null,
    };
    return MT;
  };

  /* ---------------- geometria ---------------- */
  // coordinate UV dal mondo (dopo le trasformazioni): niente stiramenti, texture continue tra i pezzi
  function worldUV(g, scale) {
    const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      let u, v; if (ay > ax && ay > az) { u = p.getX(i); v = p.getZ(i); } else if (ax > az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }
  class Bucket {
    constructor() { this.g = {}; this.uvs = {}; }
    add(key, geo, color, uvScale) {
      const gg = geo.index ? geo.toNonIndexed() : geo;
      if (!gg.attributes.normal) gg.computeVertexNormals();
      M().colorize(gg, ...(color || [1, 1, 1]));
      (this.g[key] = this.g[key] || []).push({ geo: gg, uv: uvScale });
      return gg;
    }
    build(parent) {
      const m = S.mats();
      for (const k in this.g) {
        const list = this.g[k].map(({ geo, uv }) => { if (uv !== false) worldUV(geo, uv || (k === 'tiles' || k === 'slate' || k === 'shingle' ? 2.2 : k === 'thatch' ? 2.6 : k === 'stucco' ? 4.5 : 2.5)); return geo; });
        const mesh = new THREE.Mesh(M().merge(list), m[k]);
        mesh.castShadow = k !== 'beam' && k !== 'glass'; mesh.receiveShadow = true;
        if (k === 'beam' || k === 'glass') mesh.renderOrder = 5;
        if (m[k] && m[k].userData && m[k].userData.depth) mesh.customDepthMaterial = m[k].userData.depth;
        parent.add(mesh);
      }
    }
  }
  S.Bucket = Bucket;
  // trasformazione locale dell'edificio (origine al centro, pavimento a y=0, fronte verso +z)
  const _m4 = new THREE.Matrix4();
  function placer(b, y) { const m = new THREE.Matrix4().makeRotationY(b.rot); m.setPosition(b.x, y === undefined ? b.y : y, b.z); return m; }
  const BOX = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const CYL = (r0, r1, h, x, y, z, seg) => new THREE.CylinderGeometry(r1, r0, h, seg || 10).translate(x, y + h / 2, z);
  function put(bk, key, geo, mtx, color, uv) { geo.applyMatrix4(mtx); return bk.add(key, geo, color, uv); }
  // box di collisione dal sistema locale dell'edificio
  function wbox(b, y0, lx0, ly0, lz0, lx1, ly1, lz1, flags) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx0, lz1], [lx1, lz1]]) { const wx = b.x + lx * c + lz * s, wz = b.z - lx * s + lz * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
    return Object.assign({ x0, x1, y0: y0 + ly0, y1: y0 + ly1, z0, z1 }, flags || {});
  }
  // rampa locale lungo z: sale da yLow (in lzLow) a yHigh (in lzHigh)
  function wslope(b, lx0, lx1, lzLow, lzHigh, yLow, yHigh) {
    const bx = wbox(b, 0, lx0, yLow, Math.min(lzLow, lzHigh), lx1, yHigh, Math.max(lzLow, lzHigh));
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const q = Math.round(b.rot / (Math.PI / 2)) & 3;
    const ax = q & 1 ? 'x' : 'z';
    const conv = (lz) => (ax === 'z' ? b.z + lz * c : b.x + lz * s);
    bx.y0 = yLow; bx.y1 = yHigh; bx.slope = { ax, a0: conv(lzLow), a1: conv(lzHigh) };
    return bx;
  }
  // tetto a capanna: colmo lungo l'asse più lungo
  function gableRoof(bk, key, b, mtx, W, D, H, pitch, ov, color, wallKey, wallColor) {
    const alongX = W >= D, span = alongX ? D : W, len = (alongX ? W : D) + ov * 2;
    const rise = (span / 2) * Math.tan(pitch), slope = Math.hypot(span / 2 + ov, rise + ov * Math.tan(pitch));
    for (const sd of [-1, 1]) {
      const g = new THREE.BoxGeometry(alongX ? len : 0.14, 0.14, alongX ? 0.14 : len);
      if (alongX) { g.scale(1, 1, slope / 0.14); g.rotateX(sd * pitch); g.translate(0, H + rise / 2 - 0.05, sd * (span / 4 + ov / 2) * 1.0); }
      else { g.scale(slope / 0.14, 1, 1); g.rotateZ(-sd * pitch); g.translate(sd * (span / 4 + ov / 2), H + rise / 2 - 0.05, 0); }
      put(bk, key, g, mtx, color);
    }
    // timpani
    for (const sd of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-span / 2, 0); sh.lineTo(span / 2, 0); sh.lineTo(0, rise); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false });
      g.translate(0, H, -0.11);
      if (alongX) { g.rotateY(Math.PI / 2); g.translate(sd * (W / 2 - 0.11), 0, 0); } else g.translate(0, 0, sd * (D / 2 - 0.11));
      put(bk, wallKey, g, mtx, wallColor);
    }
    // colmo
    const ridge = BOX(alongX ? len : 0.22, 0.2, alongX ? 0.22 : len, 0, H + rise + 0.02, 0);
    put(bk, key, ridge, mtx, color.map((v) => v * 0.8));
    return rise;
  }

  /* ---------------- edificio generico ---------------- */
  const PASTEL = [[1, 0.98, 0.93], [0.98, 0.86, 0.66], [0.94, 0.75, 0.66], [0.78, 0.88, 0.92], [0.96, 0.93, 0.76], [0.92, 0.8, 0.82]];
  const SHUT = [[0.25, 0.45, 0.32], [0.24, 0.38, 0.55], [0.55, 0.28, 0.2], [0.35, 0.25, 0.18]];
  function house(bk, cols, b, v, rnd) {
    const st = v.style, W = b.w, D = b.d, H = b.wallH, T = 0.24, y0 = b.y;
    const mtx = placer(b);
    const wallKey = st === 'pietra' ? 'stone' : st === 'baite' ? 'logs' : st === 'palafitte' || st === 'alberi' || b.roof === 'fienile' ? 'wood' : 'stucco';
    let wc = st === 'coloniale' ? PASTEL[(rnd() * PASTEL.length) | 0] : st === 'fattoria' ? [0.98, 0.96, 0.9] : b.roof === 'fienile' ? [0.72, 0.34, 0.26] : [1, 1, 1];
    if (b.ruin) wc = wc.map((x) => x * 0.8);
    const shut = SHUT[(rnd() * SHUT.length) | 0];
    const ruin = b.ruin || 0;
    const wallH = (i) => (ruin ? H * (1 - ruin * (0.3 + rnd() * 0.7)) : H);
    // fondazione o palafitte
    const fy = b.ground - 0.4;
    if (b.stilts) {
      for (const [px, pz] of [[-W / 2 + 0.3, -D / 2 + 0.3], [W / 2 - 0.3, -D / 2 + 0.3], [-W / 2 + 0.3, D / 2 - 0.3], [W / 2 - 0.3, D / 2 - 0.3], [0, 0]]) put(bk, 'logs', CYL(0.16, 0.14, y0 - fy, px, fy - y0, pz, 8), mtx, [0.8, 0.75, 0.7], false);
      cols.push(wbox(b, y0, -W / 2, -0.25, -D / 2, W / 2, 0, D / 2, { walk: true }));
    } else {
      put(bk, st === 'coloniale' ? 'stucco' : 'stone', BOX(W + 0.3, y0 - fy, D + 0.3, 0, (fy - y0) / 2, 0), mtx, st === 'coloniale' ? wc.map((x) => x * 0.72) : [0.85, 0.82, 0.78]);
      cols.push(wbox(b, y0, -W / 2 - 0.15, fy - y0, -D / 2 - 0.15, W / 2 + 0.15, 0, D / 2 + 0.15, { walk: true }));
    }
    put(bk, 'wood', BOX(W - 0.1, 0.08, D - 0.1, 0, 0.04, 0), mtx, [0.85, 0.75, 0.62]);
    // ingresso: gradini o rampa fino al terreno davanti alla porta
    const frontGround = G.heightAt(b.x + Math.sin(b.rot) * (D / 2 + 1.5), b.z + Math.cos(b.rot) * (D / 2 + 1.5));
    const dy = y0 - frontGround;
    if (dy > 0.35) {
      const L = Math.max(1.2, dy * (b.stilts ? 1.6 : 1.3));
      for (let i = 0; i < Math.ceil(L / 0.35); i++) { const t = i / Math.ceil(L / 0.35); put(bk, 'wood', BOX(1.6, 0.1, 0.38, 0, -dy * t - 0.05, D / 2 + 0.2 + t * L), mtx, [0.8, 0.7, 0.58]); }
      if (b.stilts) for (const sx of [-0.8, 0.8]) put(bk, 'logs', BOX(0.1, 0.1, L + 0.3, sx, -dy / 2, D / 2 + L / 2 + 0.2).applyMatrix4(new THREE.Matrix4().makeRotationX(Math.atan2(dy, L)).setPosition(0, 0, 0)), mtx, [0.7, 0.65, 0.6], false);
      cols.push(wslope(b, -0.85, 0.85, D / 2 + L + 0.2, D / 2, y0 - dy, y0));
    }
    // muri (la porta è al centro del fronte +z)
    const dw = b.kind === 'fienile' ? 2.6 : 1.3, dh = b.kind === 'fienile' ? 3.2 : 2.3;
    const walls = [];
    const wall = (lx0, lz0, lx1, lz1, h, front) => {
      const w = Math.abs(lx1 - lx0) || T, d = Math.abs(lz1 - lz0) || T;
      if (wallKey === 'logs') {
        const n = Math.ceil(h / 0.3), alongX = w > d;
        for (let i = 0; i < n; i++) { const g = CYL(0.16, 0.16, (alongX ? w : d) + 0.3, 0, 0, 0, 8); g.translate(0, -(alongX ? w : d) / 2 - 0.15, 0); g.rotateZ(alongX ? Math.PI / 2 : 0); if (!alongX) g.rotateX(Math.PI / 2); g.translate((lx0 + lx1) / 2, 0.16 + i * 0.3, (lz0 + lz1) / 2); put(bk, 'logs', g, mtx, [0.95, 0.9, 0.85], false); }
      } else put(bk, wallKey, BOX(w, h, d, (lx0 + lx1) / 2, h / 2, (lz0 + lz1) / 2), mtx, wc);
      cols.push(wbox(b, y0, Math.min(lx0, lx1) - (w === T ? T / 2 : 0), 0, Math.min(lz0, lz1) - (d === T ? T / 2 : 0), Math.max(lx0, lx1) + (w === T ? T / 2 : 0), h, Math.max(lz0, lz1) + (d === T ? T / 2 : 0), { walk: true, climb: true }));
      walls.push(h);
    };
    const hb = wallH(), hl = wallH(), hr = wallH(), hf = wallH();
    wall(-W / 2, -D / 2, W / 2, -D / 2, hb);
    wall(-W / 2, -D / 2, -W / 2, D / 2, hl);
    wall(W / 2, -D / 2, W / 2, D / 2, hr);
    wall(-W / 2, D / 2, -dw / 2, D / 2, hf, true);
    wall(dw / 2, D / 2, W / 2, D / 2, hf, true);
    if (hf > dh + 0.2) { put(bk, wallKey === 'logs' ? 'wood' : wallKey, BOX(dw, hf - dh, T, 0, dh + (hf - dh) / 2, D / 2), mtx, wc); cols.push(wbox(b, y0, -dw / 2, dh, D / 2 - T / 2, dw / 2, hf, D / 2 + T / 2, { walk: true })); }
    // cornici e travi a vista
    put(bk, 'wood', BOX(dw + 0.24, 0.16, T + 0.1, 0, dh + 0.08, D / 2), mtx, [0.5, 0.36, 0.24]);
    for (const sx of [-1, 1]) put(bk, 'wood', BOX(0.12, dh, T + 0.1, sx * (dw / 2 + 0.06), dh / 2, D / 2), mtx, [0.5, 0.36, 0.24]);
    if (st === 'fattoria' && b.roof !== 'fienile') for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 3) for (const zz of [-D / 2 - 0.13, D / 2 + 0.13]) if (Math.abs(x) > dw / 2 + 0.1 || zz < 0) put(bk, 'wood', BOX(0.16, Math.min(hb, hf), 0.04, x, Math.min(hb, hf) / 2, zz), mtx, [0.28, 0.2, 0.14]);
    if (st === 'fattoria' && b.roof !== 'fienile') for (const zz of [-D / 2 - 0.13, D / 2 + 0.13]) put(bk, 'wood', BOX(W, 0.16, 0.04, 0, Math.min(hb, hf) * 0.55, zz), mtx, [0.28, 0.2, 0.14]);
    // finestre con imposte sui fianchi (vetro che si accende di notte)
    const winY = Math.min(1.5, H * 0.45);
    if (!ruin) for (const sx of [-1, 1]) for (const zz of D > 5.5 ? [-D / 4, D / 4] : [0]) {
      put(bk, v.inhabited ? 'glow' : 'dark', BOX(0.06, 0.95, 0.8, sx * (W / 2 + 0.13), winY + 0.47, zz), mtx, [1, 1, 1], false);
      for (const oz of [-0.62, 0.62]) put(bk, 'wood', BOX(0.05, 1.05, 0.45, sx * (W / 2 + 0.16), winY + 0.47, zz + oz), mtx, shut);
      put(bk, 'wood', BOX(0.2, 0.08, 1.0, sx * (W / 2 + 0.16), winY - 0.04, zz), mtx, [0.55, 0.42, 0.3]);
    }
    // finestre anche sul fronte (ai lati della porta) e sul retro
    if (!ruin) for (const [fz, xs] of [[D / 2, W > 4.5 ? [-W / 4 - 0.3, W / 4 + 0.3] : []], [-D / 2, W > 4.5 ? [-W / 4, W / 4] : [0]]]) for (const wx of xs) {
      const sg = Math.sign(fz);
      put(bk, v.inhabited ? 'glow' : 'dark', BOX(0.8, 0.95, 0.06, wx, winY + 0.47, fz + sg * 0.13), mtx, [1, 1, 1], false);
      for (const ox of [-0.62, 0.62]) put(bk, 'wood', BOX(0.45, 1.05, 0.05, wx + ox, winY + 0.47, fz + sg * 0.16), mtx, shut);
      put(bk, 'wood', BOX(1.0, 0.08, 0.2, wx, winY - 0.04, fz + sg * 0.16), mtx, [0.55, 0.42, 0.3]);
      if (st === 'coloniale' && rnd() < 0.5) for (let i = 0; i < 3; i++) put(bk, 'cloth', new THREE.SphereGeometry(0.12, 6, 5).translate(wx - 0.3 + i * 0.3, winY + 0.05, fz + sg * 0.3), mtx, [[0.85, 0.2, 0.25], [0.95, 0.7, 0.2], [0.3, 0.6, 0.25]][i], false);
    }
    // case coloniali alte: balcone di legno sul fronte
    if (!ruin && st === 'coloniale' && H > 5) {
      put(bk, 'wood', BOX(W * 0.6, 0.1, 1.0, 0, H * 0.5, D / 2 + 0.55), mtx, [0.5, 0.35, 0.22]);
      for (let i = 0; i <= 8; i++) put(bk, 'wood', BOX(0.05, 0.9, 0.05, -W * 0.3 + (i / 8) * W * 0.6, H * 0.5 + 0.45, D / 2 + 1.0), mtx, [0.45, 0.3, 0.2]);
      put(bk, 'wood', BOX(W * 0.6, 0.06, 0.08, 0, H * 0.5 + 0.92, D / 2 + 1.0), mtx, [0.45, 0.3, 0.2]);
      put(bk, 'dark', BOX(1.0, 2.0, 0.06, 0, H * 0.5 + 1.0, D / 2 + 0.13), mtx, [1, 1, 1], false);
    }
    // cornicione in cima alle case coloniali e di pietra
    if (!ruin && (st === 'coloniale' || st === 'pietra')) put(bk, st === 'coloniale' ? 'stucco' : 'stone', BOX(W + 0.5, 0.22, D + 0.5, 0, H - 0.11, 0), mtx, wc.map((x) => x * 0.88));
    if (!ruin && H > 5) for (const zz of [-D / 4, D / 4]) for (const sx of [-1, 1]) {
      put(bk, v.inhabited ? 'glow' : 'dark', BOX(0.06, 1.0, 0.7, sx * (W / 2 + 0.13), H - 1.8, zz), mtx, [1, 1, 1], false);
      for (const oz of [-0.55, 0.55]) put(bk, 'wood', BOX(0.05, 1.1, 0.4, sx * (W / 2 + 0.16), H - 1.8, zz + oz), mtx, shut);
    }
    // tetto
    const R = b.roof;
    if (ruin) {
      // travi crollate
      for (let i = 0; i < 3; i++) { const g = BOX(0.18, 0.18, W * 0.9, (rnd() - 0.5) * W * 0.6, 0.3 + rnd() * 1.5, (rnd() - 0.5) * D * 0.6); g.rotateX(rnd() - 0.5); g.rotateY(rnd() * 3); put(bk, 'wood', g, mtx, [0.45, 0.38, 0.3]); }
    } else if (R === 'piatto') {
      put(bk, st === 'coloniale' ? 'stucco' : 'stone', BOX(W + 0.3, 0.22, D + 0.3, 0, H + 0.11, 0), mtx, wc.map((x) => x * 0.95));
      for (const [px, pz, pw, pd] of [[0, -D / 2, W + 0.3, 0.2], [-W / 2, 0, 0.2, D + 0.3], [0, D / 2, W + 0.3, 0.2]]) { put(bk, 'stucco', BOX(pw, 0.6, pd, px, H + 0.52, pz), mtx, wc); cols.push(wbox(b, y0, px - pw / 2, H + 0.2, pz - pd / 2, px + pw / 2, H + 0.82, pz + pd / 2, { walk: true, climb: true })); }
      put(bk, 'stucco', BOX(0.2, 0.6, D * 0.5, W / 2, H + 0.52, -D / 4), mtx, wc);
      cols.push(wbox(b, y0, W / 2 - 0.1, H + 0.2, -D / 2, W / 2 + 0.1, H + 0.82, 0, { walk: true }));
      cols.push(wbox(b, y0, -W / 2 - 0.15, H, -D / 2 - 0.15, W / 2 + 0.15, H + 0.22, D / 2 + 0.15, { walk: true }));
      // scala esterna sul fianco destro fino alla terrazza
      const sl = D, sx = W / 2 + 0.75, gy = G.heightAt(b.x + Math.cos(b.rot) * sx + Math.sin(b.rot) * (D / 2), b.z - Math.sin(b.rot) * sx + Math.cos(b.rot) * (D / 2)) - y0;
      const steps = Math.ceil((H + 0.22 - gy) / 0.3);
      for (let i = 0; i < steps; i++) { const t = (i + 0.5) / steps; put(bk, 'stucco', BOX(1.2, (H + 0.22 - gy) * t + 0.05, sl / steps, sx, gy + ((H + 0.22 - gy) * t) / 2, D / 2 - t * sl), mtx, wc.map((x) => x * 0.9)); }
      cols.push(wslope(b, W / 2 + 0.15, W / 2 + 1.35, D / 2 + 0.1, -D / 2 + 0.2, y0 + gy, y0 + H + 0.22));
      // tenda da sole
      if (rnd() < 0.6) put(bk, 'cloth', BOX(W * 0.6, 0.04, 1.4, 0, dh + 0.45, D / 2 + 0.7).applyMatrix4(new THREE.Matrix4().makeRotationX(0.25)), mtx, [[0.8, 0.3, 0.25], [0.3, 0.5, 0.7], [0.85, 0.75, 0.4], [0.35, 0.6, 0.4]][(rnd() * 4) | 0]);
      cols.push(wbox(b, y0, -W / 2, H - 0.05, -D / 2, W / 2, H + 0.25, D / 2, {}));
    } else {
      const key = R === 'coppi' ? 'tiles' : R === 'paglia' ? 'thatch' : R === 'ardesia' ? 'slate' : 'shingle';
      const pitch = R === 'paglia' ? 0.78 : R === 'fienile' ? 0.72 : 0.6;
      const color = R === 'fienile' ? [0.75, 0.5, 0.38] : [1, 1, 1];
      const rise = gableRoof(bk, key, b, mtx, W, D, H, pitch, R === 'paglia' ? 0.55 : 0.38, color, wallKey === 'logs' ? 'wood' : wallKey, wc);
      // due falde calpestabili, che non si attraversano né dal basso né di lato
      { const along = W >= D, span = along ? D : W, ln = (along ? W : D) / 2 + 0.3, ov = R === 'paglia' ? 0.55 : 0.38, eave = H - ov * Math.tan(pitch);
        for (const sd of [-1, 1]) cols.push(G.Build.slopeBox(b, along ? 'z' : 'x', -ln, ln, sd * (span / 2 + ov), 0, y0 + eave - 0.05, y0 + H + rise + 0.1, { shell: 0.4 })); }
      cols.push(wbox(b, y0, -W / 2 + 0.2, H, -D / 2 + 0.2, W / 2 - 0.2, H + 0.15, D / 2 - 0.2, {}));
      if (R === 'scandole' || (st === 'pietra' && rnd() < 0.6)) { put(bk, 'stone', BOX(0.7, rise + 1.2, 0.7, W / 2 - 1, H + (rise + 1.2) / 2, -D / 4), mtx, [0.8, 0.78, 0.74]); }
    }
    // arredi interni
    const shelf = (x, z) => { put(bk, 'wood', BOX(1.4, 1.8, 0.35, x, 0.9, z), mtx, [0.55, 0.4, 0.28]); for (let i = 0; i < 6; i++) put(bk, 'iron', CYL(0.05, 0.04, 0.22, x - 0.5 + (i % 3) * 0.5, 0.95 + ((i / 3) | 0) * 0.55, z + 0.05, 6), mtx, [[0.3, 0.5, 0.3], [0.5, 0.3, 0.2], [0.6, 0.55, 0.4]][i % 3], false); };
    const table = (x, z) => { put(bk, 'wood', BOX(1.4, 0.08, 0.8, x, 0.78, z), mtx, [0.6, 0.45, 0.3]); for (const [a, c] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) put(bk, 'wood', BOX(0.08, 0.76, 0.08, x + a, 0.38, z + c), mtx, [0.5, 0.38, 0.26]); for (const sx of [-1, 1]) put(bk, 'wood', BOX(0.4, 0.45, 0.4, x + sx * 1.0, 0.22, z), mtx, [0.55, 0.42, 0.3]); };
    const barrel = (x, z) => { put(bk, 'wood', CYL(0.32, 0.36, 0.9, x, 0, z, 12), mtx, [0.65, 0.48, 0.3], false); for (const yy of [0.15, 0.75]) put(bk, 'iron', CYL(0.37, 0.37, 0.06, x, yy, z, 12), mtx, [1, 1, 1], false); cols.push(wbox(b, y0, x - 0.35, 0, z - 0.35, x + 0.35, 0.9, z + 0.35, { walk: true })); };
    if (!ruin && b.kind === 'locanda') {
      put(bk, 'wood', BOX(3.2, 1.1, 0.7, W / 2 - 2.0, 0.55, -D / 2 + 2.2), mtx, [0.55, 0.38, 0.25]);
      put(bk, 'wood', BOX(3.4, 0.08, 0.85, W / 2 - 2.0, 1.12, -D / 2 + 2.2), mtx, [0.42, 0.28, 0.18]);
      cols.push(wbox(b, y0, W / 2 - 3.6, 0, -D / 2 + 1.8, W / 2 - 0.4, 1.15, -D / 2 + 2.6, { walk: true }));
      shelf(W / 2 - 2.0, -D / 2 + 0.35); table(-W / 4, D / 6); table(W / 6, D / 4);
      barrel(-W / 2 + 0.6, D / 2 - 0.7);
    } else if (!ruin && b.kind === 'casa') {
      table(rnd() < 0.5 ? -W / 6 : W / 6, D / 8);
      if (rnd() < 0.6) shelf(-W / 2 + 0.9, -D / 2 + 0.35);
      if (rnd() < 0.7) barrel(W / 2 - 0.6, D / 2 - 0.7);
    } else if (b.kind === 'fienile') {
      for (let i = 0; i < 4; i++) put(bk, 'thatch', BOX(1.2, 0.8, 0.8, -W / 2 + 1 + (i % 2) * 1.3, 0.4 + ((i / 2) | 0) * 0.8, -D / 2 + 0.8), mtx, [1, 0.95, 0.75]);
    }
    // insegna della locanda
    if (b.kind === 'locanda') {
      const signTex = signTexture((v.inhabited ? 'Locanda ' : 'Locanda abbandonata · ') + v.name);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }));
      sign.position.set(0, Math.min(H, hf) - 0.45, D / 2 + T / 2 + 0.02); sign.applyMatrix4(mtx); sign.castShadow = false;
      bk.extra = bk.extra || []; bk.extra.push(sign);
      if (v.inhabited) (bk.lights = bk.lights || []).push(new V3(0, dh + 0.6, D / 2 + 0.6).applyMatrix4(mtx));
      put(bk, 'iron', BOX(0.06, 0.06, 0.6, -dw / 2 - 0.4, dh + 0.5, D / 2 + 0.3), mtx);
      put(bk, 'glow', BOX(0.2, 0.3, 0.2, -dw / 2 - 0.4, dh + 0.25, D / 2 + 0.55), mtx, [1, 1, 1], false);
    }
  }
  function signTexture(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#6a4426'); g.addColorStop(1, '#3e2614'); x.fillStyle = g; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#2a170a'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 120);
    x.fillStyle = '#f0d9a0'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 46; x.font = `700 ${fs}px Georgia, serif`; while (x.measureText(text).width > 470 && fs > 18) { fs -= 2; x.font = `700 ${fs}px Georgia, serif`; }
    x.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }

  /* ---------------- torri, mulini, case sugli alberi ---------------- */
  function tower(bk, cols, b, v, rnd) {
    const W = b.w, H = b.wallH, y0 = b.y, T = 0.35, mtx = placer(b);
    const key = v.style === 'coloniale' ? 'stucco' : v.style === 'baite' ? 'wood' : 'stone';
    const wc = v.style === 'coloniale' ? [0.98, 0.94, 0.84] : [0.9, 0.88, 0.84];
    put(bk, 'stone', BOX(W + 0.4, y0 - b.ground + 0.4, W + 0.4, 0, -(y0 - b.ground + 0.4) / 2, 0), mtx, [0.8, 0.78, 0.74]);
    cols.push(wbox(b, y0, -W / 2 - 0.2, b.ground - 0.4 - y0, -W / 2 - 0.2, W / 2 + 0.2, 0, W / 2 + 0.2, { walk: true }));
    const dw = 1.1, dh = 2.2;
    const seg = (lx0, lz0, lx1, lz1, ly0, ly1) => { const w = Math.max(Math.abs(lx1 - lx0), T), d = Math.max(Math.abs(lz1 - lz0), T); put(bk, key, BOX(w, ly1 - ly0, d, (lx0 + lx1) / 2, (ly0 + ly1) / 2, (lz0 + lz1) / 2), mtx, wc); cols.push(wbox(b, y0, (lx0 + lx1) / 2 - w / 2, ly0, (lz0 + lz1) / 2 - d / 2, (lx0 + lx1) / 2 + w / 2, ly1, (lz0 + lz1) / 2 + d / 2, { walk: true, climb: true })); };
    seg(-W / 2, -W / 2, W / 2, -W / 2, 0, H); seg(-W / 2, -W / 2, -W / 2, W / 2, 0, H); seg(W / 2, -W / 2, W / 2, W / 2, 0, H);
    seg(-W / 2, W / 2, -dw / 2, W / 2, 0, H); seg(dw / 2, W / 2, W / 2, W / 2, 0, H); seg(-dw / 2, W / 2, dw / 2, W / 2, dh, H);
    // finestrelle
    for (let yy = 4; yy < H - 2; yy += 3.5) for (const sx of [-1, 1]) put(bk, 'dark', BOX(0.05, 0.9, 0.4, sx * (W / 2 + 0.18), yy, 0), mtx, [1, 1, 1], false);
    // scala a pioli interna (si sale tenendo W)
    const lz = -W / 2 + T / 2 + 0.18;
    for (const sx of [-0.28, 0.28]) put(bk, 'wood', BOX(0.06, H + 0.4, 0.06, sx, (H + 0.4) / 2, lz), mtx, [0.55, 0.4, 0.28]);
    for (let yy = 0.3; yy < H + 0.3; yy += 0.35) put(bk, 'wood', BOX(0.56, 0.05, 0.05, 0, yy, lz), mtx, [0.6, 0.45, 0.3]);
    cols.push(wbox(b, y0, -0.45, 0, lz - 0.25, 0.45, H + 0.35, lz + 0.35, { climb: true, soft: true, ladder: true }));
    // piano in cima con botola sopra la scala e merli / parapetto
    const top = H;
    put(bk, 'wood', BOX(W - 0.2, 0.16, W - 0.2 - 1.0, 0, top - 0.08, 0.5), mtx, [0.7, 0.58, 0.44]);
    cols.push(wbox(b, y0, -W / 2, top - 0.16, -W / 2 + 1.0, W / 2, top, W / 2, { walk: true }));
    cols.push(wbox(b, y0, -W / 2, top - 0.16, -W / 2, -0.55, top, -W / 2 + 1.0, { walk: true }));
    cols.push(wbox(b, y0, 0.55, top - 0.16, -W / 2, W / 2, top, -W / 2 + 1.0, { walk: true }));
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) {
      const a = (i * Math.PI) / 2, t = (k - 1) * (W / 3);
      const px = Math.round(Math.cos(a)) * (W / 2) + Math.round(Math.sin(a)) * t, pz = Math.round(Math.sin(a)) * (W / 2) - Math.round(Math.cos(a)) * t;
      put(bk, key, BOX(0.5, 0.9, 0.5, px * 0.98, top + 0.45, pz * 0.98), mtx, wc);
    }
    for (const [px, pz, pw, pd] of [[0, -W / 2, W, 0.3], [0, W / 2, W, 0.3], [-W / 2, 0, 0.3, W], [W / 2, 0, 0.3, W]]) cols.push(wbox(b, y0, px - pw / 2, top, pz - pd / 2, px + pw / 2, top + 0.9, pz + pd / 2, { walk: true }));
    if (b.roof === 'campanile') {
      for (const [px, pz] of [[-W / 2 + 0.3, -W / 2 + 0.3], [W / 2 - 0.3, -W / 2 + 0.3], [-W / 2 + 0.3, W / 2 - 0.3], [W / 2 - 0.3, W / 2 - 0.3]]) put(bk, 'stucco', BOX(0.4, 2.6, 0.4, px, top + 1.3, pz), mtx, wc);
      const r = new THREE.ConeGeometry(W * 0.78, 1.8, 4); r.rotateY(Math.PI / 4); r.translate(0, top + 3.5, 0); put(bk, 'tiles', r, mtx);
      put(bk, 'iron', CYL(0.45, 0.25, 0.7, 0, top + 1.7, 0, 14), mtx, [0.9, 0.7, 0.3], false);
    } else if (v.style === 'baite') { const r = new THREE.ConeGeometry(W * 0.8, 2.2, 4); r.rotateY(Math.PI / 4); r.translate(0, top + 2.4, 0); put(bk, 'shingle', r, mtx); for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(bk, 'logs', CYL(0.12, 0.12, 1.4, px * (W / 2 - 0.2), top, pz * (W / 2 - 0.2), 6), mtx, [0.8, 0.75, 0.7], false); }
  }
  function windmill(bk, cols, b, v, rnd) {
    const H = b.wallH, mtx = placer(b);
    put(bk, 'stone', CYL(2.3, 1.8, H + (b.y - b.ground) + 0.4, 0, b.ground - b.y - 0.4, 0, 16), mtx, [0.95, 0.93, 0.88]);
    const r = new THREE.ConeGeometry(2.2, 2.4, 16); r.translate(0, H + 1.2, 0); put(bk, 'thatch', r, mtx);
    put(bk, 'dark', BOX(1.1, 2.1, 0.1, 0, 1.05, 2.25), mtx, [1, 1, 1], false);
    cols.push(wbox(b, b.y, -2.1, b.ground - b.y - 0.4, -2.1, 2.1, H, 2.1, { walk: true, climb: true }));
    // pale (ruotano)
    const g = new THREE.Group(); g.position.set(0, H - 0.6, 2.2); g.applyMatrix4(mtx);
    const bladeB = new Bucket();
    for (let i = 0; i < 4; i++) { const blade = BOX(0.9, 4.2, 0.05, 0.55, 2.3, 0); blade.rotateZ((i * Math.PI) / 2); bladeB.add('cloth', blade, [0.95, 0.92, 0.85]); const arm = BOX(0.12, 4.6, 0.12, 0, 2.3, 0.05); arm.rotateZ((i * Math.PI) / 2); bladeB.add('wood', arm, [0.5, 0.38, 0.26]); }
    const hub = new THREE.Group(); bladeB.build(hub); g.add(hub);
    bk.spin = bk.spin || []; bk.spin.push(hub); bk.extra = bk.extra || []; bk.extra.push(g);
  }
  function treehouse(bk, cols, b, v, rnd) {
    const top = b.y, base = b.ground - 0.3, R = b.platR || 3.6;
    const c0 = new V3(b.x, 0, b.z);
    // tronco gigante con radici
    const pts = [new V3(b.x, base, b.z), new V3(b.x + 0.2, base + (top - base) * 0.5, b.z - 0.1), new V3(b.x, top + 5, b.z + 0.2)];
    bk.add('bark', M().trunk(pts, 1.25, 0.6, 14, 6, null, 16), [0.95, 0.9, 0.85], false);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28 + rnd(); bk.add('bark', M().trunk([new V3(b.x + Math.cos(a) * 0.6, base + 1.2, b.z + Math.sin(a) * 0.6), new V3(b.x + Math.cos(a) * 2.0, base + 0.2, b.z + Math.sin(a) * 2.0), new V3(b.x + Math.cos(a) * 3.0, base - 0.4, b.z + Math.sin(a) * 3.0)], 0.45, 0.12, 8, 1, null, 6), [0.9, 0.85, 0.8], false); }
    // chioma
    const lv = []; const center = new V3(b.x, top + 6.5, b.z);
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = rnd() * 4.5; lv.push(...M().leafCluster(b.x + Math.cos(a) * r, top + 4.5 + rnd() * 4, b.z + Math.sin(a) * r, 4.2 + rnd() * 1.5, rnd, center, 2, [0.85, 0.95, 0.8])); }
    bk.add('leaves', M().merge(lv), [1, 1, 1], false);
    cols.push({ x0: b.x - 1.05, x1: b.x + 1.05, y0: base, y1: top, z0: b.z - 1.05, z1: b.z + 1.05, climb: true });
    // piattaforma ottagonale
    const mtx = placer(b);
    const plat = new THREE.CylinderGeometry(R, R, 0.2, 8); plat.translate(0, -0.1, 0); put(bk, 'wood', plat, mtx, [0.85, 0.72, 0.55]);
    for (let i = 0; i < 4; i++) { const beam = BOX(R * 2, 0.22, 0.22, 0, -0.32, 0); beam.rotateY((i * Math.PI) / 4); put(bk, 'logs', beam, mtx, [0.8, 0.75, 0.7]); }
    cols.push(wbox(b, top, -R * 0.82, -0.25, -R * 0.82, R * 0.82, 0, R * 0.82, { walk: true }));
    // parapetto di corda e pali
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 + Math.PI / 8; put(bk, 'logs', CYL(0.07, 0.07, 1.0, Math.cos(a) * (R - 0.15), 0, Math.sin(a) * (R - 0.15), 6), mtx, [0.8, 0.75, 0.7], false); }
    const ropeRing = new THREE.TorusGeometry(R - 0.15, 0.03, 4, 8); ropeRing.rotateX(Math.PI / 2); ropeRing.rotateY(Math.PI / 8); ropeRing.translate(0, 0.9, 0); put(bk, 'wood', ropeRing, mtx, [0.8, 0.68, 0.45], false);
    // capanna
    const hw = 1.9, hh = 2.4;
    for (const [lx0, lz0, lx1, lz1] of [[-hw, -hw, hw, -hw], [-hw, -hw, -hw, hw], [hw, -hw, hw, hw], [-hw, hw, -0.6, hw], [0.6, hw, hw, hw]]) {
      const w = Math.max(Math.abs(lx1 - lx0), 0.12), d = Math.max(Math.abs(lz1 - lz0), 0.12);
      put(bk, 'wood', BOX(w, hh, d, (lx0 + lx1) / 2, hh / 2, (lz0 + lz1) / 2), mtx, [0.75, 0.62, 0.45]);
      cols.push(wbox(b, top, (lx0 + lx1) / 2 - w / 2, 0, (lz0 + lz1) / 2 - d / 2, (lx0 + lx1) / 2 + w / 2, hh, (lz0 + lz1) / 2 + d / 2, { walk: true }));
    }
    const roof = new THREE.ConeGeometry(hw * 1.75, 2.0, 4, 1, true); roof.rotateY(Math.PI / 4); roof.translate(0, hh + 1.0, 0); put(bk, 'thatch', roof, mtx);
    cols.push(wbox(b, top, -hw, hh, -hw, hw, hh + 0.2, hw, {}));
    // scala di corda verso il centro del villaggio (lato +z)
    const lz = R - 0.2;
    for (const sx of [-0.3, 0.3]) put(bk, 'wood', BOX(0.05, top - base, 0.05, sx, -(top - base) / 2, lz + 0.1), mtx, [0.8, 0.68, 0.45], false);
    for (let yy = base - top + 0.3; yy < 0; yy += 0.4) put(bk, 'wood', BOX(0.64, 0.05, 0.08, 0, yy, lz + 0.1), mtx, [0.65, 0.5, 0.32]);
    cols.push(wbox(b, top, -0.45, base - top, lz - 0.1, 0.45, 0.4, lz + 0.45, { climb: true, soft: true, ladder: true }));
  }
  function bridge(bk, cols, br) {
    const ax = br.ax, az = br.az, bx = br.bx, bz = br.bz, d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.6);
    const ang = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = br.ay + (br.by - br.ay) * t - Math.sin(t * Math.PI) * 0.6;
      const g = BOX(1.2, 0.07, 0.4, 0, 0, 0); g.rotateY(ang); g.translate(x, y, z); bk.add('wood', g, [0.8, 0.66, 0.48]);
      if (i % 2 === 0) cols.push({ x0: x - 0.6, x1: x + 0.6, y0: y - 0.2, y1: y + 0.04, z0: z - 0.6, z1: z + 0.6, walk: true });
    }
    for (const sd of [-0.6, 0.6]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new V3(ax + (bx - ax) * t + Math.cos(ang) * sd, br.ay + (br.by - br.ay) * t - Math.sin(t * Math.PI) * 0.45 + 0.95, az + (bz - az) * t - Math.sin(ang) * sd)); }
      bk.add('wood', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.03, 4), [0.8, 0.68, 0.45], false);
    }
  }

  /* ---------------- arredi della piazza ---------------- */
  let palmCache = null;
  function prop(bk, cols, p, v, rnd, gen) {
    const mtx = placer({ x: p.x, z: p.z, rot: p.rot || 0 }, p.y);
    if (p.k === 'fontana') {
      put(bk, 'stone', CYL(2.2, 2.2, 0.6, 0, -0.1, 0, 20), mtx, [0.95, 0.92, 0.85]);
      put(bk, 'water', CYL(1.95, 1.95, 0.05, 0, 0.42, 0, 20), mtx, [1, 1, 1], false);
      put(bk, 'stone', CYL(0.3, 0.22, 1.8, 0, 0.4, 0, 10), mtx, [0.95, 0.92, 0.85]);
      put(bk, 'stone', CYL(0.8, 0.6, 0.25, 0, 1.9, 0, 14), mtx, [0.95, 0.92, 0.85]);
      cols.push({ x0: p.x - 2.1, x1: p.x + 2.1, y0: p.y - 0.2, y1: p.y + 0.5, z0: p.z - 2.1, z1: p.z + 2.1, walk: true });
    } else if (p.k === 'pozzo') {
      const ring = new THREE.CylinderGeometry(1.0, 1.0, 0.9, 16, 1, true); ring.translate(0, 0.45, 0); put(bk, 'stone', ring, mtx, [0.9, 0.88, 0.84]);
      put(bk, 'dark', CYL(0.9, 0.9, 0.02, 0, 0.3, 0, 14), mtx, [1, 1, 1], false);
      for (const sx of [-1, 1]) put(bk, 'wood', BOX(0.14, 2.0, 0.14, sx * 0.9, 1.0, 0), mtx, [0.5, 0.38, 0.26]);
      const r = new THREE.ConeGeometry(1.3, 0.8, 4); r.rotateY(Math.PI / 4); r.translate(0, 2.4, 0); put(bk, v.style === 'pietra' ? 'slate' : 'thatch', r, mtx);
      cols.push({ x0: p.x - 1, x1: p.x + 1, y0: p.y, y1: p.y + 0.9, z0: p.z - 1, z1: p.z + 1, walk: true });
    } else if (p.k === 'totem') {
      for (let i = 0; i < 4; i++) put(bk, 'wood', CYL(0.32 - i * 0.03, 0.3 - i * 0.03, 0.8, 0, i * 0.8, 0, 8), mtx, [[0.75, 0.35, 0.2], [0.85, 0.7, 0.35], [0.3, 0.45, 0.6], [0.8, 0.8, 0.75]][i]);
      put(bk, 'wood', BOX(1.8, 0.2, 0.25, 0, 2.6, 0), mtx, [0.75, 0.35, 0.2]);
      cols.push({ x0: p.x - 0.35, x1: p.x + 0.35, y0: p.y, y1: p.y + 3.2, z0: p.z - 0.35, z1: p.z + 0.35 });
    } else if (p.k === 'bancarella') {
      for (const [px, pz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) put(bk, 'wood', BOX(0.1, 2.3, 0.1, px, 1.15, pz), mtx, [0.5, 0.38, 0.26]);
      put(bk, 'wood', BOX(2.3, 0.1, 1.2, 0, 0.9, 0), mtx, [0.62, 0.46, 0.3]);
      const aw = BOX(2.7, 0.04, 1.7, 0, 2.35, 0.1); aw.rotateX(0.18); put(bk, 'cloth', aw, mtx, [[0.85, 0.3, 0.22], [0.25, 0.55, 0.45], [0.9, 0.75, 0.3], [0.3, 0.45, 0.7], [0.6, 0.3, 0.55], [0.9, 0.9, 0.85]][p.col || 0]);
      for (let i = 0; i < 7; i++) put(bk, 'cloth', new THREE.SphereGeometry(0.1, 8, 6).translate(-0.9 + i * 0.3, 1.02, (rnd() - 0.5) * 0.6), mtx, [[0.95, 0.6, 0.15], [0.8, 0.15, 0.1], [0.35, 0.6, 0.2]][i % 3], false);
      cols.push({ ...wbox({ x: p.x, z: p.z, rot: p.rot || 0 }, p.y, -1.15, 0, -0.65, 1.15, 1.0, 0.65), walk: true });
    } else if (p.k === 'fieno') {
      // carro di fieno ai piedi del campanile: cadere qui dentro non fa male
      put(bk, 'wood', BOX(2.6, 0.5, 1.9, 0, 0.55, 0), mtx, [0.55, 0.4, 0.26]);
      for (const sx of [-1, 1]) { const wh = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12); wh.rotateZ(Math.PI / 2); wh.translate(sx * 1.36, 0.45, 0.6); put(bk, 'wood', wh, mtx, [0.4, 0.3, 0.2]); const w2 = wh.clone(); w2.translate(0, 0, -1.2); put(bk, 'wood', w2, mtx, [0.4, 0.3, 0.2]); }
      const hay = new THREE.SphereGeometry(1.25, 14, 10); hay.scale(1.05, 0.55, 0.78); hay.translate(0, 1.0, 0); put(bk, 'thatch', hay, mtx, [1.05, 0.95, 0.7]);
      cols.push({ ...wbox({ x: p.x, z: p.z, rot: p.rot || 0 }, p.y, -1.3, 0, -0.95, 1.3, 1.4, 0.95), soft: true, hay: true });
    } else if (p.k === 'palma') {
      if (!palmCache) palmCache = M().palm(408);
      const m = new THREE.Matrix4().compose(new V3(p.x, p.y - 0.1, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot, 0)), new V3(p.s, p.s, p.s));
      bk.add('palmTrunk', palmCache.trunk.clone().applyMatrix4(m), [1, 1, 1], false);
      bk.add('palmLeaves', palmCache.leaves.clone().applyMatrix4(m), [1, 1, 1], false);
      cols.push({ x0: p.x - 0.3, x1: p.x + 0.3, y0: p.y, y1: p.y + 6, z0: p.z - 0.3, z1: p.z + 0.3 });
    } else if (p.k === 'campo') {
      for (let i = 0; i < 6; i++) { put(bk, 'stone', BOX(9, 0.15, 0.7, 0, 0.02, -3.2 + i * 1.3), mtx, [0.5, 0.38, 0.28]); for (let k = 0; k < 14; k++) { const g = M().cards(0.8, 0.9, 2, true); g.translate(-4.2 + k * 0.65, 0.05, -3.2 + i * 1.3); g.applyMatrix4(mtx); bk.add('wheat', g, [1.15, 1.0, 0.55], false); } }
    } else if (p.k === 'falo') {
      gen.push({ t: 'falo', id: 'g:' + v.id + ':falo', x: p.x, y: p.y, z: p.z, rot: 0 });
    }
  }

  /* ---------------- costruzione di un luogo ---------------- */
  function buildVillage(v) {
    const L = G.POI.layout(v);
    const rnd = G.mulberry32(v.seed ^ 0x77);
    const bk = new Bucket(), cols = [], gen = [];
    for (const b of L.buildings) {
      if (b.roof === 'albero') treehouse(bk, cols, b, v, rnd);
      else if (b.kind === 'torre') tower(bk, cols, b, v, rnd);
      else if (b.kind === 'mulino') windmill(bk, cols, b, v, rnd);
      else house(bk, cols, b, v, rnd);
    }
    for (const br of L.bridges) bridge(bk, cols, br);
    for (const p of L.props) prop(bk, cols, p, v, rnd, gen);
    // pontile con una barca ormeggiata
    if (L.dock) dock(bk, cols, L.dock, v);
    for (const c of L.chests) gen.push({ t: v.inhabited ? 'baule' : 'forziere', id: c.id, x: c.x, y: c.y, z: c.z, rot: c.rot, tier: c.tier });
    for (const bd of L.beds) gen.push({ t: 'letto', id: bd.id, x: bd.x, y: bd.y, z: bd.z, rot: bd.rot });
    return { bk, cols, gen };
  }
  function dock(bk, cols, d, v) {
    const len = Math.hypot(d.x1 - d.x0, d.z1 - d.z0), ang = Math.atan2(d.x1 - d.x0, d.z1 - d.z0), n = Math.ceil(len / 0.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = d.x0 + (d.x1 - d.x0) * t, z = d.z0 + (d.z1 - d.z0) * t;
      const g = BOX(2.4, 0.08, 0.42, 0, 0, 0); g.rotateY(ang); g.translate(x, d.y, z); bk.add('wood', g, [0.78, 0.66, 0.5]);
      if (i % 2 === 0) cols.push({ x0: x - 1.1, x1: x + 1.1, y0: d.y - 0.3, y1: d.y + 0.04, z0: z - 1.1, z1: z + 1.1, walk: true });
      if (i % 5 === 0) for (const sd of [-1.1, 1.1]) { const px = x + Math.cos(ang) * sd, pz = z - Math.sin(ang) * sd, gy = G.heightAt(px, pz); bk.add('logs', CYL(0.12, 0.12, d.y - gy + 0.9, px, gy - 0.3, pz, 7), [0.75, 0.7, 0.65], false); }
    }
    // barca a remi ormeggiata (solo decorazione)
    const ex = d.x1 - Math.sin(ang) * 2.5 + Math.cos(ang) * 2.4, ez = d.z1 - Math.cos(ang) * 2.5 - Math.sin(ang) * 2.4;
    if (G.heightAt(ex, ez) < -1.2) {
      const m = new THREE.Matrix4().compose(new V3(ex, G.SEA + 0.25, ez), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0.04)), new V3(1, 1, 1));
      for (const p of G.Boats.parts('barca_remi')) bk.add(p.mat === 'logs' ? 'logs' : 'wood', p.geo.clone().applyMatrix4(m), [0.9, 0.85, 0.8], false);
    }
  }
  function buildFaro(f) {
    const rnd = G.mulberry32(f.seed);
    const bk = new Bucket(), cols = [], gen = [];
    const y0 = f.h + 0.1, H = 17, R0 = 2.7, R1 = 2.1;
    // torre a fasce bianche e rosse
    for (let i = 0; i < 6; i++) { const h = H / 6, r0 = R0 + (R1 - R0) * (i / 6), r1 = R0 + (R1 - R0) * ((i + 1) / 6); bk.add('stucco', CYL(r0, r1, h, f.x, y0 + i * h, f.z, 24), i % 2 ? [0.85, 0.18, 0.15] : [1, 0.98, 0.94]); }
    bk.add('stone', CYL(R0 + 0.4, R0 + 0.3, 1.2, f.x, y0 - 1.0, f.z, 24), [0.9, 0.88, 0.84]);
    bk.add('dark', BOX(1.2, 2.2, 0.3, f.x, y0 + 1.1, f.z + R0 - 0.05), [1, 1, 1], false);
    // collisioni: anello di muri con la porta a sud (+z)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283; const cx = f.x + Math.sin(a) * (R0 - 0.2), cz = f.z + Math.cos(a) * (R0 - 0.2);
      if (i === 0) continue;
      cols.push({ x0: cx - 0.75, x1: cx + 0.75, y0: y0 - 1, y1: y0 + H, z0: cz - 0.75, z1: cz + 0.75, walk: true, climb: true });
    }
    cols.push({ x0: f.x - 2, x1: f.x + 2, y0: y0 - 1.2, y1: y0, z0: f.z - 2, z1: f.z + 2, walk: true });
    // scala interna (lato nord)
    const lz = f.z - R0 + 0.75;
    for (const sx of [-0.28, 0.28]) bk.add('wood', BOX(0.06, H + 0.3, 0.06, f.x + sx, y0 + (H + 0.3) / 2, lz), [0.55, 0.4, 0.28]);
    for (let yy = 0.3; yy < H + 0.3; yy += 0.35) bk.add('wood', BOX(0.56, 0.05, 0.05, f.x, y0 + yy, lz), [0.6, 0.45, 0.3]);
    cols.push({ x0: f.x - 0.45, x1: f.x + 0.45, y0, y1: y0 + H + 0.35, z0: lz - 0.3, z1: lz + 0.35, climb: true, soft: true, ladder: true });
    // ballatoio con botola sopra la scala
    const top = y0 + H;
    bk.add('stone', CYL(3.2, 3.2, 0.25, f.x, top - 0.25, f.z, 24), [0.9, 0.9, 0.88]);
    cols.push({ x0: f.x - 3, x1: f.x + 3, y0: top - 0.25, y1: top, z0: f.z - 3 + 1.4, z1: f.z + 3, walk: true });
    cols.push({ x0: f.x - 3, x1: f.x - 0.55, y0: top - 0.25, y1: top, z0: f.z - 3, z1: f.z - 3 + 1.4, walk: true });
    cols.push({ x0: f.x + 0.55, x1: f.x + 3, y0: top - 0.25, y1: top, z0: f.z - 3, z1: f.z - 3 + 1.4, walk: true });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; bk.add('iron', CYL(0.04, 0.04, 1.0, f.x + Math.cos(a) * 3.05, top, f.z + Math.sin(a) * 3.05, 5), [1, 1, 1], false); }
    const rail = new THREE.TorusGeometry(3.05, 0.04, 4, 24); rail.rotateX(Math.PI / 2); rail.translate(f.x, top + 1.0, f.z); bk.add('iron', rail, [1, 1, 1], false);
    for (const [x0, x1, z0, z1] of [[-3.2, 3.2, -3.2, -3.0], [-3.2, 3.2, 3.0, 3.2], [-3.2, -3.0, -3.2, 3.2], [3.0, 3.2, -3.2, 3.2]]) cols.push({ x0: f.x + x0, x1: f.x + x1, y0: top, y1: top + 1.05, z0: f.z + z0, z1: f.z + z1 });
    // lanterna
    bk.add('glass', CYL(1.3, 1.3, 2.0, f.x, top, f.z, 16), [1, 1, 1], false);
    bk.add('glow', CYL(0.45, 0.45, 0.9, f.x, top + 0.5, f.z, 12), [1, 1, 1], false);
    const dome = new THREE.SphereGeometry(1.45, 16, 8, 0, 6.283, 0, Math.PI / 2); dome.translate(f.x, top + 2.0, f.z); bk.add('iron', dome, [0.7, 0.15, 0.12], false);
    cols.push({ x0: f.x - 1.3, x1: f.x + 1.3, y0: top, y1: top + 2.2, z0: f.z - 1.3 + 0.0, z1: f.z + 1.3 });
    bk.lights = [new V3(f.x, top + 1.0, f.z)];
    bk.beamAt = new V3(f.x, top + 0.95, f.z);
    gen.push({ t: 'forziere', id: `c:${f.id}:0`, x: f.x + 1.9, y: top, z: f.z + 1.9, rot: -Math.PI / 4, tier: 3 });
    // casetta del guardiano
    const a = rnd() * 6.283, hx = f.x + Math.cos(a) * 8, hz = f.z + Math.sin(a) * 8, hh = G.heightAt(hx, hz);
    if (hh > 1.2 && Math.abs(hh - f.h) < 2.5) {
      const b = { kind: 'casa', x: hx, z: hz, w: 5, d: 4, rot: Math.round(Math.atan2(f.x - hx, f.z - hz) / (Math.PI / 2)) * (Math.PI / 2), y: Math.max(hh, G.heightAt(hx + 2.5, hz + 2), G.heightAt(hx - 2.5, hz - 2)) + 0.12, ground: hh - 0.6, wallH: 2.8, roof: 'ardesia' };
      house(bk, cols, b, { style: 'pietra', inhabited: false, name: f.name }, rnd);
      gen.push({ t: 'baule', id: `c:${f.id}:1`, x: hx + Math.sin(b.rot) * -1.2, y: b.y, z: hz + Math.cos(b.rot) * -1.2, rot: b.rot, tier: 1 });
    }
    return { bk, cols, gen };
  }
  function buildRelitto(w) {
    const bk = new Bucket(), cols = [], gen = [];
    const m = new THREE.Matrix4().compose(new V3(w.x, w.h + 0.9, w.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, w.yaw, w.roll, 'YXZ')), new V3(1.15, 1.15, 1.15));
    const parts = G.Boats.parts('veliero');
    for (const p of parts) {
      if (/Vela|Sartiame|Stiva/.test(p.name)) continue;
      let g = p.geo.clone();
      if (/Albero maestro/.test(p.name)) { g.applyMatrix4(new THREE.Matrix4().makeRotationZ(1.25)); g.translate(2.5, -1.5, 0); }
      if (/Albero di trinchetto/.test(p.name)) { g.scale(1, 0.35, 1); }
      if (/destro/.test(p.name)) { const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getZ(i) > 1.5 && pp.getY(i) > -0.2) pp.setY(i, -0.2 - Math.random() * 0.3); g.computeVertexNormals(); }
      g.applyMatrix4(m);
      bk.add(p.mat === 'logs' ? 'wreckLogs' : 'wreck', g, [0.75, 0.78, 0.68], false);
    }
    const rnd = G.mulberry32(w.seed);
    for (let i = 0; i < 6; i++) { const x = w.x + (rnd() - 0.5) * 14, z = w.z + (rnd() - 0.5) * 14, y = G.heightAt(x, z); const g = CYL(0.32, 0.36, 0.9, 0, 0, 0, 10); g.rotateZ(rnd() < 0.5 ? Math.PI / 2 : 0); g.translate(x, y + 0.3, z); bk.add('wreck', g, [0.6, 0.55, 0.45], false); }
    const c = Math.cos(w.yaw), s = Math.sin(w.yaw);
    gen.push({ t: 'forziere', id: `c:${w.id}:0`, x: w.x + s * -2 + c * 3.2, y: G.heightAt(w.x + s * -2 + c * 3.2, w.z + c * -2 - s * 3.2), z: w.z + c * -2 - s * 3.2, rot: w.yaw, tier: 2 });
    if (rnd() < 0.5) gen.push({ t: 'forziere', id: `c:${w.id}:1`, x: w.x + s * 4 - c * 2.6, y: G.heightAt(w.x + s * 4 - c * 2.6, w.z + c * 4 + s * 2.6), z: w.z + c * 4 + s * 2.6, rot: w.yaw + 1, tier: 3 });
    return { bk, cols, gen };
  }
  let flagTex = null;
  function jollyRoger() {
    if (flagTex) return flagTex;
    const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#101010'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#eeeae0';
    x.beginPath(); x.arc(128, 62, 30, 0, 7); x.fill(); x.fillRect(110, 82, 36, 18);
    x.fillStyle = '#101010'; x.beginPath(); x.arc(116, 60, 8, 0, 7); x.arc(140, 60, 8, 0, 7); x.fill(); x.fillRect(118, 90, 4, 10); x.fillRect(128, 90, 4, 10); x.fillRect(138, 90, 4, 10);
    x.strokeStyle = '#eeeae0'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(70, 108); x.lineTo(186, 146); x.moveTo(186, 108); x.lineTo(70, 146); x.stroke();
    flagTex = new THREE.CanvasTexture(c); flagTex.encoding = THREE.sRGBEncoding; return flagTex;
  }
  function buildCovo(k) {
    const rnd = G.mulberry32(k.seed);
    const bk = new Bucket(), cols = [], gen = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283 + rnd() * 0.5, d = 6 + rnd() * 2, x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d, y = G.heightAt(x, z);
      const rot = -a, mtx = placer({ x, z, rot }, y);
      const col = [[0.62, 0.3, 0.22], [0.55, 0.48, 0.36], [0.7, 0.62, 0.48]][i % 3];
      for (const sd of [-1, 1]) { const g = BOX(3.0, 0.04, 2.0, 0, 0, 0); g.rotateX(sd * 0.85); g.translate(0, 0.8, sd * 0.68); put(bk, 'cloth', g, mtx, col); }
      for (const sx of [-1.5, 1.5]) put(bk, 'wood', BOX(0.08, 1.7, 0.08, sx, 0.85, 0), mtx, [0.5, 0.4, 0.3]);
      cols.push({ ...wbox({ x, z, rot }, y, -1.5, 0, -1.3, 1.5, 1.6, 1.3) });
    }
    for (let i = 0; i < 7; i++) { const x = k.x + (rnd() - 0.5) * 12, z = k.z + (rnd() - 0.5) * 12, y = G.heightAt(x, z); if (Math.hypot(x - k.x, z - k.z) < 3) continue; if (rnd() < 0.5) bk.add('wood', CYL(0.32, 0.36, 0.9, x, y, z, 12), [0.62, 0.46, 0.3], false); else bk.add('wood', BOX(0.8, 0.8, 0.8, x, y + 0.4, z), [0.7, 0.55, 0.36]); cols.push({ x0: x - 0.4, x1: x + 0.4, y0: y, y1: y + 0.9, z0: z - 0.4, z1: z + 0.4, walk: true }); }
    // bandiera nera
    const fx = k.x - 4, fz = k.z + 1, fy = G.heightAt(fx, fz);
    bk.add('logs', CYL(0.09, 0.07, 7, fx, fy, fz, 7), [0.8, 0.75, 0.7], false);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4, 8, 1), new THREE.MeshStandardMaterial({ map: jollyRoger(), side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(fx + 1.15, fy + 6.2, fz); flag.castShadow = true;
    bk.extra = [flag]; bk.flag = flag;
    gen.push({ t: 'falo', id: `g:${k.id}:falo`, x: k.x - 1.5, y: G.heightAt(k.x - 1.5, k.z - 1), z: k.z - 1, rot: 0 });
    gen.push({ t: 'forziere', id: `c:${k.id}:0`, x: k.x + 2.5, y: G.heightAt(k.x + 2.5, k.z - 2.5), z: k.z - 2.5, rot: 0.7, tier: 3 });
    // palizzata
    for (let i = 0; i < 18; i++) { const a = (i / 18) * 3.4 + rnd() * 0.05 + 2.5, x = k.x + Math.cos(a) * 12, z = k.z + Math.sin(a) * 12, y = G.heightAt(x, z); if (y < 0.4) continue; const h = 2 + rnd() * 0.6; bk.add('logs', CYL(0.2, 0.18, h, x, y - 0.2, z, 7), [0.8, 0.75, 0.7], false); const cone = new THREE.ConeGeometry(0.2, 0.4, 7); cone.translate(x, y + h, z); bk.add('logs', cone, [0.8, 0.75, 0.7], false); cols.push({ x0: x - 0.25, x1: x + 0.25, y0: y, y1: y + h, z0: z - 0.25, z1: z + 0.25 }); }
    return { bk, cols, gen };
  }
  function buildTesoro(t) {
    const bk = new Bucket(), gen = [];
    const y = G.heightAt(t.x, t.z);
    const hole = new THREE.CircleGeometry(1.0, 16); hole.rotateX(-Math.PI / 2); hole.translate(t.x, y + 0.03, t.z); bk.add('dark', hole, [1, 1, 1], false);
    const mound = new THREE.SphereGeometry(0.9, 10, 6, 0, 6.283, 0, Math.PI / 2); mound.scale(1, 0.35, 1); mound.translate(t.x + 1.4, y - 0.05, t.z + 0.4); bk.add('stone', mound, [0.75, 0.62, 0.45]);
    gen.push({ t: 'forziere', id: 'c:' + t.id, x: t.x, y: y - 0.25, z: t.z, rot: 0.4, tier: 3 });
    return { bk, cols: [], gen };
  }

  /* ---------------- strutture abbandonate ---------------- */
  const GROUND = (x, z) => G.heightAt(x, z);
  function quarterRot(r) { return Math.floor(r * 4) * Math.PI / 2; }
  // rovine di pietra: case crollate, un torrione mozzo, colonne; un forziere tra le macerie
  function buildRovina(r) {
    const rnd = G.mulberry32(r.seed), bk = new Bucket(), cols = [], gen = [];
    const v = { style: 'pietra', inhabited: false, id: r.id };
    const n = 2 + ((rnd() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + rnd() * 0.6, d = 6 + rnd() * 3, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d;
      const rot = quarterRot(rnd()), w = 4.6 + rnd() * 1.6, dd = 5.2 + rnd() * 1.6;
      let gmin = Infinity, gmax = -Infinity; for (const [ox, oz] of [[-w / 2, -dd / 2], [w / 2, -dd / 2], [-w / 2, dd / 2], [w / 2, dd / 2], [0, 0]]) { const c = Math.cos(rot), sn = Math.sin(rot), h = GROUND(x + ox * c + oz * sn, z - ox * sn + oz * c); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h); }
      const b = { kind: 'casa', x, z, w, d: dd, rot, q: Math.round(rot / (Math.PI / 2)) & 3, y: gmax + 0.15, ground: gmin, wallH: 3.1, roof: 'coppi', ruin: 0.55 + rnd() * 0.35 };
      house(bk, cols, b, v, rnd);
      if (i === 0) gen.push({ t: 'forziere', id: `c:${r.id}:0`, x, y: b.y, z, rot, tier: 3 });
      else if (rnd() < 0.7) gen.push({ t: 'baule', id: `c:${r.id}:${i}`, x: x + Math.cos(rot) * 0.8, y: b.y, z: z - Math.sin(rot) * 0.8, rot, tier: 2 });
    }
    // torrione mozzo al centro
    { const y = GROUND(r.x, r.z), H = 4 + rnd() * 4, mtx = placer({ x: r.x, z: r.z, rot: rnd() * 6 }, y - 0.3);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283, hh = H * (0.45 + 0.55 * rnd()); put(bk, 'stone', BOX(1.25, hh, 0.7, Math.cos(a) * 2.2, hh / 2, Math.sin(a) * 2.2).applyMatrix4(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(0, 0, 0)), mtx, [0.72, 0.7, 0.66]); }
      for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; cols.push({ x0: r.x + Math.cos(a) * 2.2 - 0.45, x1: r.x + Math.cos(a) * 2.2 + 0.45, y0: y - 0.3, y1: y + H * 0.45, z0: r.z + Math.sin(a) * 2.2 - 0.45, z1: r.z + Math.sin(a) * 2.2 + 0.45 }); }
    }
    // colonne e massi caduti
    for (let k = 0; k < 9; k++) {
      const a = rnd() * 6.283, d = 9 + rnd() * 6, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, y = GROUND(x, z);
      if (rnd() < 0.55) { const h = 1 + rnd() * 3; bk.add('stone', CYL(0.4, 0.36, h, x, y - 0.2, z, 10), [0.86, 0.84, 0.78], false); cols.push({ x0: x - 0.4, x1: x + 0.4, y0: y, y1: y + h, z0: z - 0.4, z1: z + 0.4 }); }
      else { const g = BOX(1.6, 0.7, 0.7, 0, 0, 0); g.rotateY(rnd() * 3); g.rotateZ((rnd() - 0.5) * 0.4); g.translate(x, y + 0.2, z); bk.add('stone', g, [0.78, 0.76, 0.7]); }
    }
    return { bk, cols, gen };
  }
  // miniera: ingresso con armatura di legno, binari, carrello; una vera galleria scavata nella montagna
  function buildMiniera(m) {
    const rnd = G.mulberry32(m.seed), bk = new Bucket(), cols = [], gen = [];
    const dir = m.dir, fx = Math.sin(dir), fz = Math.cos(dir); // fuori (a valle)
    const y0 = GROUND(m.x, m.z) + 0.1;
    // galleria: sfere lungo la direzione verso l'interno, con una camera in fondo
    const L = 24 + rnd() * 10, sph = [];
    for (let d = -1.5; d <= L; d += 1.1) sph.push([m.x - fx * d, y0 + 1.35 + Math.sin(d * 0.3) * 0.15, m.z - fz * d, 1.75]);
    const ex = m.x - fx * (L + 2), ez = m.z - fz * (L + 2);
    sph.push([ex, y0 + 1.6, ez, 3.2]); sph.push([ex + fz * 2.5, y0 + 1.4, ez - fx * 2.5, 2.4]);
    if (G.Dig) G.Dig.addGen('mine:' + m.id, sph);
    const rot = dir;
    const mtxAt = (d, side) => { const x = m.x - fx * d + Math.cos(dir) * side, z = m.z - fz * d - Math.sin(dir) * side; return placer({ x, z, rot }, y0 - 0.1); };
    // armature di legno ogni 5 m
    for (let d = 0; d <= L; d += 5) {
      const mt = mtxAt(d, 0);
      for (const sd of [-1.25, 1.25]) put(bk, 'logs', CYL(0.13, 0.12, 2.6, sd, 0, 0, 7), mt, [0.75, 0.68, 0.6], false);
      put(bk, 'logs', BOX(2.9, 0.24, 0.26, 0, 2.6, 0), mt, [0.7, 0.62, 0.55]);
      for (const sd of [-1.3, 1.3]) { const x = m.x - fx * d + Math.cos(dir) * sd, z = m.z - fz * d - Math.sin(dir) * sd; cols.push({ x0: x - 0.16, x1: x + 0.16, y0: y0 - 0.1, y1: y0 + 2.5, z0: z - 0.16, z1: z + 0.16 }); }
    }
    // binari fino in fondo e fuori dall'ingresso
    for (let d = -6; d < L; d += 0.9) { const mt = mtxAt(d, 0); put(bk, 'wood', BOX(1.3, 0.06, 0.18, 0, 0.03, 0), mt, [0.48, 0.36, 0.26]); for (const sd of [-0.45, 0.45]) put(bk, 'iron', BOX(0.06, 0.07, 0.95, sd, 0.09, 0), mt, [0.6, 0.6, 0.6]); }
    // carrello
    { const mt = mtxAt(-3.5, 0); put(bk, 'wood', BOX(1.1, 0.7, 1.5, 0, 0.55, 0), mt, [0.5, 0.38, 0.27]); for (const [a, b] of [[-0.45, -0.5], [0.45, -0.5], [-0.45, 0.5], [0.45, 0.5]]) put(bk, 'iron', CYL(0.17, 0.17, 0.1, 0, 0, 0, 10).rotateZ(Math.PI / 2).translate(a, 0.2, b), mt, [0.35, 0.35, 0.35], false); put(bk, 'stone', BOX(0.9, 0.25, 1.2, 0, 0.95, 0), mt, [0.25, 0.25, 0.26]);
      const cx = m.x + fx * 3.5, cz = m.z + fz * 3.5; cols.push({ x0: cx - 0.7, x1: cx + 0.7, y0: y0, y1: y0 + 1.0, z0: cz - 0.7, z1: cz + 0.7, walk: true }); }
    // lanterne lungo la galleria
    bk.lights = [];
    for (let d = 4; d < L; d += 10) { const x = m.x - fx * d + Math.cos(dir) * 1.15, z = m.z - fz * d - Math.sin(dir) * 1.15; bk.add('glow', BOX(0.18, 0.26, 0.18, x, y0 + 2.0, z), [1, 1, 1]); bk.lights.push(new V3(x, y0 + 2.0, z)); }
    bk.always = true; // le lanterne della miniera sono accese anche di giorno
    // forziere in fondo, sul pavimento della camera
    const gy = G.Dig ? G.Dig.ground(ex, ez, y0 + 1.5) : y0;
    gen.push({ t: 'forziere', id: `c:${m.id}:0`, x: ex, y: gy, z: ez, rot: dir, tier: 3 });
    gen.push({ t: 'baule', id: `c:${m.id}:1`, x: ex + fz * 2.4, y: G.Dig ? G.Dig.ground(ex + fz * 2.4, ez - fx * 2.4, y0 + 1.5) : y0, z: ez - fx * 2.4, rot: dir, tier: 2 });
    return { bk, cols, gen };
  }
  // accampamento abbandonato: tende strappate, casse, un falò spento
  function buildAccampamento(c) {
    const rnd = G.mulberry32(c.seed), bk = new Bucket(), cols = [], gen = [];
    const n = 2 + ((rnd() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + rnd() * 0.7, d = 4.5 + rnd() * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, y = GROUND(x, z);
      const rot = -a + (rnd() - 0.5) * 0.4, mtx = placer({ x, z, rot }, y);
      const col = [[0.62, 0.6, 0.52], [0.55, 0.5, 0.4], [0.5, 0.56, 0.48]][i % 3];
      // un telo strappato pende di lato
      for (const sd of [-1, 1]) { const g = BOX(2.6, 0.04, 1.8, 0, 0, 0); g.rotateX(sd * (0.85 + (sd > 0 && rnd() < 0.5 ? 0.6 : 0))); g.translate(0, 0.75, sd * 0.62); put(bk, 'cloth', g, mtx, col); }
      for (const sx of [-1.3, 1.3]) put(bk, 'wood', BOX(0.07, 1.6, 0.07, sx, 0.8, 0), mtx, [0.45, 0.36, 0.28]);
      cols.push(wbox({ x, z, rot }, y, -1.3, 0, -1.2, 1.3, 1.5, 1.2));
    }
    for (let i = 0; i < 6; i++) { const x = c.x + (rnd() - 0.5) * 10, z = c.z + (rnd() - 0.5) * 10, y = GROUND(x, z); if (Math.hypot(x - c.x, z - c.z) < 2.5) continue; if (rnd() < 0.5) bk.add('wood', CYL(0.32, 0.36, 0.9, x, y, z, 12), [0.55, 0.42, 0.3], false); else bk.add('wood', BOX(0.8, 0.7, 0.8, x, y + 0.35, z), [0.6, 0.48, 0.34]); cols.push({ x0: x - 0.4, x1: x + 0.4, y0: y, y1: y + 0.9, z0: z - 0.4, z1: z + 0.4, walk: true }); }
    // falò spento: anello di pietre e cenere
    { const y = GROUND(c.x, c.z); for (let k = 0; k < 8; k++) { const a = k * 0.785; bk.add('stone', new THREE.DodecahedronGeometry(0.2, 0).translate(c.x + Math.cos(a) * 0.55, y + 0.08, c.z + Math.sin(a) * 0.55), [0.7, 0.68, 0.64]); } bk.add('dark', new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2).translate(c.x, y + 0.03, c.z), [1, 1, 1], false); }
    gen.push({ t: 'baule', id: `c:${c.id}:0`, x: c.x + 2.2, y: GROUND(c.x + 2.2, c.z + 1.2), z: c.z + 1.2, rot: rnd() * 6, tier: 2 });
    if (rnd() < 0.5) gen.push({ t: 'baule', id: `c:${c.id}:1`, x: c.x - 2.5, y: GROUND(c.x - 2.5, c.z - 0.8), z: c.z - 0.8, rot: rnd() * 6, tier: 1 });
    gen.push({ t: 'letto', id: `g:${c.id}:letto`, x: c.x - 1.2, y: GROUND(c.x - 1.2, c.z + 2.6), z: c.z + 2.6, rot: rnd() * 6 });
    return { bk, cols, gen };
  }

  /* ---------------- gestione ---------------- */
  const BUILD = { village: buildVillage, faro: buildFaro, relitto: buildRelitto, covo: buildCovo, tesoro: buildTesoro, rovina: buildRovina, miniera: buildMiniera, accampamento: buildAccampamento };
  S.extraMats = function () {
    const m = S.mats();
    if (!m.wreck) {
      m.wreck = G.patch(new THREE.MeshStandardMaterial({ map: G.TEX.planksT.map, normalMap: G.TEX.planksT.normal, vertexColors: true, roughness: 0.95, color: 0x8a8a74, side: THREE.DoubleSide }), { key: 's_wreck', moss: { th: 0.2, amt: 0.6 } });
      m.wreckLogs = G.patch(new THREE.MeshStandardMaterial({ map: G.TEX.barkT.map, normalMap: G.TEX.barkT.normal, vertexColors: true, roughness: 0.95, color: 0x7a7a66 }), { key: 's_wrecklogs' });
      m.palmTrunk = G.MAT.palmBark; m.palmLeaves = G.MAT.leaves.frond;
      m.wheat = G.MAT.reed;
    }
    return m;
  };
  S.init = function () { S.extraMats(); S.group = new THREE.Group(); G.scene.add(S.group); S.initLights(); };
  S.clear = function () {
    for (const a of S.active.values()) S.dispose(a);
    S.active.clear(); G.Build.setExtra([]); S.npcs = [];
  };
  S.dispose = function (a) {
    if (a.group) { S.group.remove(a.group); a.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    if (a.near) S.leaveNear(a);
  };
  function visualRange() { return Math.min(520, (G.settings.view || 4) * 64 + 90); }
  S.update = function (dt, P) {
    S.timer -= dt;
    const t = G.clock;
    if (S.timer <= 0) {
      S.timer = 0.6;
      const px = P.pos.x, pz = P.pos.z, R = visualRange();
      const want = new Map();
      for (const p of G.POI.near(px, pz, R)) want.set(p.id, p);
      for (const tr of G.POI.treasuresNear(px, pz, 220)) if (G.state.removed.has('dig:' + tr.id)) want.set(tr.id, tr);
      // rimuovi i lontani
      for (const [id, a] of S.active) if (!want.has(id)) { S.dispose(a); S.active.delete(id); }
      // costruisci al massimo un luogo per volta (niente scatti)
      let built = 0;
      const order = [...want.values()].filter((p) => !S.active.has(p.id)).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
      for (const p of order) {
        if (built++ >= 1) break;
        const r = BUILD[p.type](p);
        const group = new THREE.Group();
        r.bk.build(group);
        for (const e of r.bk.extra || []) group.add(e);
        S.group.add(group);
        S.active.set(p.id, { poi: p, group, cols: r.cols, gen: r.gen, lights: r.bk.lights || [], always: !!r.bk.always, spin: r.bk.spin || [], beamAt: r.bk.beamAt, flag: r.bk.flag, near: false });
      }
      // collisioni, casse, letti e abitanti solo per i luoghi vicini
      let changed = false;
      for (const a of S.active.values()) {
        const d = Math.hypot(a.poi.x - px, a.poi.z - pz);
        if (!a.near && d < 150) { S.enterNear(a); changed = true; }
        else if (a.near && d > 190) { S.leaveNear(a); changed = true; }
        // scoperta
        const disc = a.poi.type === 'village' ? 60 : a.poi.type === 'relitto' ? 26 : a.poi.type === 'tesoro' ? 0 : 40;
        if (d < disc) S.discover(a.poi);
      }
      if (changed) { const all = []; for (const a of S.active.values()) if (a.near) all.push(...a.cols); G.Build.setExtra(all); }
    }
    // animazioni: pale dei mulini, bandiere, faro, luci notturne
    const night = G.sky.night;
    S.mats().glow.emissiveIntensity = 0.15 + night * 2.2;
    S.mats().glass.emissiveIntensity = night * 1.4;
    for (const a of S.active.values()) {
      for (const h of a.spin) h.rotation.z += dt * (0.3 + G.WIND.level * 0.12);
      if (a.flag) { const p = a.flag.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1.1; p.setZ(i, Math.sin(t * 3 + x * 2.2) * 0.12 * x * (0.3 + G.WIND.level * 0.1)); } p.needsUpdate = true; }
      if (a.beamAt) {
        if (!a.beam) { const g = new THREE.ConeGeometry(4, 60, 16, 1, true); g.translate(0, -30, 0); g.rotateZ(Math.PI / 2); a.beam = new THREE.Mesh(g, S.mats().beam); a.beam.position.copy(a.beamAt); a.beam.renderOrder = 6; a.group.add(a.beam); a.beam2 = a.beam.clone(); a.beam2.rotation.y = Math.PI; a.group.add(a.beam2); }
        a.beam.visible = a.beam2.visible = night > 0.3;
        a.beam.rotation.y = t * 0.6; a.beam2.rotation.y = t * 0.6 + Math.PI;
      }
    }
    S.updateLights(P);
    S.updateNPCs(dt, P);
  };
  S.enterNear = function (a) {
    a.near = true;
    a.pieces = [];
    for (const g of a.gen) {
      if (G.Build.byId(g.id)) continue;
      const d = { t: g.t, id: g.id, x: g.x, y: g.y, z: g.z, rot: g.rot || 0, gen: true, tier: g.tier };
      if (g.t === 'baule' || g.t === 'forziere') d.inv = G.state.chests[g.id] || null;
      const p = G.Build.add(d, true); p.gen = true; p.tier = g.tier; p.fresh = !G.state.chests[g.id];
      a.pieces.push(p);
    }
    if (a.poi.type === 'village' && a.poi.inhabited) S.spawnNPCs(a);
  };
  S.leaveNear = function (a) {
    a.near = false;
    const ids = new Set((a.pieces || []).map((p) => p.id));
    G.Build.removeGen((p) => ids.has(p.id));
    a.pieces = [];
    for (const n of a.npcs || []) { G.scene.remove(n.p.root); }
    S.npcs = S.npcs.filter((n) => n.home !== a);
    a.npcs = [];
  };
  // apre una cassa del mondo: il contenuto nasce la prima volta (bottino + mappe del tesoro), poi resta salvato
  S.openChest = function (p) {
    if (!p.inv || p.fresh) {
      const rare = G.Player.rareFound || {};
      const inv = G.POI.loot(p.id, p.tier || 1, p.id.startsWith('c:t:') ? [['doblone', 25]] : null);
      for (let i = 0; i < inv.length; i++) {
        const s = inv[i]; if (!s) continue;
        if (G.RARE.includes(s.id) && (rare[s.id] || G.Player.count(s.id) > 0)) inv[i] = { id: 'doblone', n: 30 };
        if (s.id === 'mappa_tesoro') { const tg = G.POI.mapTarget(p.x, p.z, i + 7, G.state.removed); if (tg) s.d = tg; else inv[i] = { id: 'doblone', n: 10 }; }
      }
      p.inv = inv; p.fresh = false; G.state.chests[p.id] = inv;
      if (G.Net && G.Net.on) G.Net.send({ t: 'chest', id: p.id, inv });
      if (G.Audio) G.Audio.chest();
    }
    G.UI.openChest(p.inv, p.t === 'forziere' ? 'Forziere' : 'Cassa', { piece: p });
  };
  // stato di una cassa ricevuto da un altro giocatore
  S.netChest = function (id, inv) {
    G.state.chests[id] = inv;
    const p = G.Build.byId(id); if (p) { p.inv = inv; p.fresh = false; }
    if (G.UI.open === 'chest' && G.UI.chestOwner && G.UI.chestOwner.piece && G.UI.chestOwner.piece.id === id) { G.UI.chestInv = inv; G.UI.renderPanel(); }
  };
  S.discover = function (poi) {
    const P = G.Player; P.discovered = P.discovered || {};
    if (P.discovered[poi.id]) return;
    P.discovered[poi.id] = Date.now();
    const what = poi.type === 'village' ? `${poi.name} · ${G.POI.STYLE_N[poi.style]}${poi.inhabited ? '' : ' (abbandonato)'}` : poi.name;
    G.UI.toast(`Scoperta: ${what}`, 'good');
    if (G.Audio) G.Audio.bell();
    if (G.Quests) G.Quests.onDiscover(poi);
    G.saveSoon();
  };

  /* ---------------- luci notturne (le più vicine) ---------------- */
  S.initLights = function () {
    S.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa850, 0, 14, 2); l.castShadow = false; G.scene.add(l); S.lights.push(l); }
    S.faroLight = new THREE.PointLight(0xfff0c0, 0, 60, 1.5); G.scene.add(S.faroLight);
  };
  S.updateLights = function (P) {
    const night = G.sky.night, src = [];
    for (const a of S.active.values()) for (const l of a.lights) { if (a.poi.type === 'faro') continue; src.push([l, Math.hypot(l.x - P.pos.x, l.z - P.pos.z), a.always]); }
    src.sort((x, y) => x[1] - y[1]);
    S.lights.forEach((l, i) => { const s = src[i]; if (s && s[1] < 60) { l.position.copy(s[0]); l.intensity = (s[2] ? Math.max(night, 0.9) : night) * 1.6 * (0.9 + Math.sin(G.clock * 9 + i) * 0.08); } else l.intensity = 0; });
    let fl = null, fd = 1e9; for (const a of S.active.values()) if (a.poi.type === 'faro') { const d = Math.hypot(a.poi.x - P.pos.x, a.poi.z - P.pos.z); if (d < fd) { fd = d; fl = a.lights[0]; } }
    if (fl) { S.faroLight.position.copy(fl); S.faroLight.intensity = night * 3; } else S.faroLight.intensity = 0;
  };

  /* ---------------- abitanti ---------------- */
  S.spawnNPCs = function (a) {
    const v = a.poi, L = G.POI.layout(v);
    a.npcs = [];
    for (const n of L.npcs) {
      const p = G.People.build(n.look, { style: v.style, female: undefined, tool: n.role === 'mercante' ? null : null });
      const tag = nameTag(n.name);
      tag.position.y = p.height + 0.35; tag.visible = false; p.root.add(tag);
      G.scene.add(p.root);
      let way = null, len = 0;
      if (n.way) {
        // tra una porta e l'altra passa dalla piazza (così non attraversa i muri)
        way = []; for (const w of n.way) { way.push(w); way.push([v.x + (Math.random() - 0.5) * 6, v.z + (Math.random() - 0.5) * 6]); }
        for (let i = 0; i < way.length; i++) { const q = way[(i + 1) % way.length]; len += Math.hypot(q[0] - way[i][0], q[1] - way[i][1]); }
      }
      const e = { def: n, p, tag, home: a, village: v, way, len, x: n.x || v.x, z: n.z || v.z, y: n.y, yaw: n.rot || 0, talking: 0 };
      a.npcs.push(e); S.npcs.push(e);
    }
  };
  // abitante comparso con un comando: parla e commercia come quelli dei villaggi
  S.spawnWanderer = function (x, z, role) {
    const near = G.POI.near(x, z, 3000, 'village').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const style = near ? near.style : 'coloniale';
    const village = near || { id: 'v:viandanti', type: 'village', name: 'Viandanti', style, x, z, inhabited: true };
    const look = (Math.random() * 1e6) | 0, y = Math.max(G.World.groundAt(x, z), G.Build.groundAt(x, z, G.World.groundAt(x, z) + 1.5, 0.05));
    const def = { id: 'n:w:' + Math.random().toString(36).slice(2, 8), role, name: G.POI.npcName() + (role === 'mercante' ? ' il mercante' : ''), x, z, y, rot: 0, look };
    const p = G.People.build(look, { style });
    const tag = nameTag(def.name); tag.position.y = p.height + 0.35; tag.visible = false; p.root.add(tag);
    G.scene.add(p.root);
    const e = { def, p, tag, home: null, village, way: null, len: 0, x, z, y, yaw: Math.atan2(G.Player.pos.x - x, G.Player.pos.z - z), talking: 0, wander: true };
    S.npcs.push(e);
    return e;
  };
  function nameTag(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
    x.font = '600 30px Signika, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(500, x.measureText(text).width + 30);
    x.fillStyle = 'rgba(6,18,23,0.7)'; x.fillRect(256 - w / 2, 10, w, 44); x.fillStyle = '#ecd099'; x.fillText(text, 256, 33);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(1.7, 0.21, 1); s.renderOrder = 20;
    return s;
  }
  S.updateNPCs = function (dt, P) {
    const night = G.sky.night > 0.65;
    for (const n of S.npcs) {
      let speed = 0, state = 'idle';
      const d = n.def;
      if (n.way && n.len > 0) {
        // percorso in funzione del tempo: uguale per tutti i giocatori
        let s = ((G.clock * d.speed + d.ph * 10) % n.len + n.len) % n.len;
        for (let i = 0; i < n.way.length; i++) {
          const a = n.way[i], b = n.way[(i + 1) % n.way.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (s <= l) { const k = s / (l || 1); const nx = a[0] + (b[0] - a[0]) * k, nz = a[1] + (b[1] - a[1]) * k; const dx = nx - n.x, dz = nz - n.z; if (dx * dx + dz * dz > 1e-6) n.yaw += G.angleDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6); n.x = nx; n.z = nz; speed = d.speed; break; }
          s -= l;
        }
        n.y = Math.max(G.World.groundAt(n.x, n.z), G.Build.groundAt(n.x, n.z, G.World.groundAt(n.x, n.z) + 1.5, 0.05));
        n.p.root.visible = !night;
      } else {
        const dx = P.pos.x - n.x, dz = P.pos.z - n.z, dist = Math.hypot(dx, dz);
        if (dist < 6) n.yaw += G.angleDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
        n.p.root.visible = true;
      }
      if (n.talking > 0) { n.talking -= dt; state = 'talk'; speed = 0; const dx = P.pos.x - n.x, dz = P.pos.z - n.z; n.yaw += G.angleDiff(n.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 5); }
      // lontani: invisibili e senza animazione (ogni persona sono una ventina di oggetti da disegnare)
      const far = Math.hypot(P.pos.x - n.x, P.pos.z - n.z) > (G.lowQ() ? 45 : 85);
      if (far) { n.p.root.visible = false; continue; }
      n.p.root.position.set(n.x, n.y, n.z); n.p.root.rotation.y = n.yaw;
      G.People.animate(n.p, dt, speed, state, 0);
      const wantSh = Math.hypot(P.pos.x - n.x, P.pos.z - n.z) < 22;
      if (n._sh !== wantSh) { n._sh = wantSh; n.p.root.traverse((o) => { if (o.isMesh) o.castShadow = wantSh; }); }
      const dn = Math.hypot(P.pos.x - n.x, P.pos.z - n.z); n.tag.visible = dn < 10 && dn > 2.2;
    }
  };
  S.raycastNPC = function (o, d, max) {
    let best = null, bt = max;
    for (const n of S.npcs) {
      if (!n.p.root.visible) continue;
      for (const [hy, rad] of [[1.0, 0.4], [1.55, 0.25]]) {
        const ox = o.x - n.x, oy = o.y - (n.y + hy), oz = o.z - n.z;
        const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - rad * rad, disc = b * b - c;
        if (disc < 0) continue; const t = -b - Math.sqrt(disc); if (t > 0 && t < bt) { bt = t; best = n; }
      }
    }
    return best ? { npc: best, t: bt } : null;
  };
})();
