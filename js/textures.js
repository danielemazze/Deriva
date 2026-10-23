'use strict';
/* ==========================================================
   Texture procedurali ripetibili (albedo + normal map)
   ========================================================== */
(function () {
  const G = globalThis.G;
  const TEX = (G.TEX = {});

  /* --- rumore periodico (tileable) --- */
  function lattice(i, j, p, s) { i = ((i % p) + p) % p; j = ((j % p) + p) % p; return G.hash2(i, j, s); }
  function vnoise(u, v, p, s) {
    // u,v in [0,1) * p
    const x = u * p, y = v * p;
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = lattice(i, j, p, s), b = lattice(i + 1, j, p, s), c = lattice(i, j + 1, p, s), d = lattice(i + 1, j + 1, p, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(u, v, base, oct, s, gain = 0.5) {
    let sum = 0, amp = 1, tot = 0, p = base;
    for (let o = 0; o < oct; o++) { sum += vnoise(u, v, p, s + o * 31) * amp; tot += amp; amp *= gain; p *= 2; }
    return sum / tot;
  }
  // Worley periodico: restituisce [f1, f2, id]
  function worley(u, v, p, s) {
    const x = u * p, y = v * p, i = Math.floor(x), j = Math.floor(y);
    let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = i + di, cj = j + dj;
      const px = ci + lattice(ci, cj, p, s), py = cj + lattice(ci, cj, p, s + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; id = lattice(ci, cj, p, s + 13); } else if (d < f2) f2 = d;
    }
    return [f1, f2, id];
  }
  TEX.vnoise = vnoise; TEX.fbm = fbm; TEX.worley = worley;

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

  /* genera albedo + altezza con una funzione per pixel */
  function bake(size, fn) {
    const c = makeCanvas(size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size), d = img.data;
    const H = new Float32Array(size * size);
    const out = [0, 0, 0, 0];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      fn(x / size, y / size, out);
      const k = (y * size + x) * 4;
      d[k] = out[0]; d[k + 1] = out[1]; d[k + 2] = out[2]; d[k + 3] = 255;
      H[y * size + x] = out[3];
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, height: H, size };
  }
  function normalFromHeight(H, size, strength) {
    const c = makeCanvas(size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size), d = img.data;
    const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (y * size + x) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function toTex(canvas, srgb, repeat = true) {
    const t = new THREE.CanvasTexture(canvas);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    t.anisotropy = G.maxAniso || 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  }
  function pair(size, strength, fn) {
    const b = bake(size, fn);
    return { map: toTex(b.canvas, true), normal: toTex(normalFromHeight(b.height, size, strength), false), canvas: b.canvas };
  }
  const mix = (a, b, t) => a + (b - a) * t;

  /* ================= TERRENO ================= */
  TEX.grass = (S) => pair(S, 1.0, (u, v, o) => {
    const n = fbm(u, v, 8, 5, 11), m = fbm(u, v, 3, 3, 19);
    const blades = vnoise(u * 1.0, v * 1.0, S / 3, 23) * 0.6 + vnoise(u, v, S / 6, 29) * 0.4;
    const dirt = G.smooth(0.74, 0.86, m + n * 0.2) * 0.85;
    let r = mix(62, 96, n) * (0.8 + blades * 0.35), g = mix(98, 140, n) * (0.8 + blades * 0.35), b = mix(34, 52, n);
    // tinte gialle e trifogli
    const dry = G.smooth(0.5, 0.8, fbm(u, v, 5, 3, 41));
    r = mix(r, r * 1.35 + 18, dry * 0.5); g = mix(g, g * 1.08, dry * 0.5);
    r = mix(r, 110 + n * 30, dirt); g = mix(g, 88 + n * 20, dirt); b = mix(b, 58 + n * 15, dirt);
    o[0] = r; o[1] = g; o[2] = b; o[3] = blades * 0.6 + n * 0.4 - dirt * 0.3;
  });
  TEX.sand = (S) => pair(S, 0.9, (u, v, o) => {
    const n = fbm(u, v, 6, 4, 51), grain = lattice((u * S) | 0, (v * S) | 0, S, 57);
    const warp = fbm(u, v, 4, 3, 61);
    const rip = Math.sin((v * 22 + warp * 3.5 + u * 2) * Math.PI * 2) * 0.5 + 0.5;
    const shell = G.smooth(0.94, 0.99, lattice((u * S / 4) | 0, (v * S / 4) | 0, S / 4, 67)) * 0.6;
    const t = n * 0.6 + grain * 0.4;
    o[0] = mix(192, 222, t) + shell * 30; o[1] = mix(168, 198, t) + shell * 25; o[2] = mix(124, 152, t) + shell * 25;
    o[3] = rip * 0.55 + n * 0.35 + grain * 0.05;
  });
  TEX.rock = (S) => pair(S, 3.0, (u, v, o) => {
    const w = worley(u, v, 5, 71);
    const n = fbm(u, v, 4, 6, 79, 0.55), n2 = fbm(u, v, 16, 3, 81);
    const strata = Math.sin((v * 9 + n * 2.5) * Math.PI * 2) * 0.5 + 0.5;
    const crack = G.smooth(0.0, 0.05, w[1] - w[0] + n2 * 0.06);
    const lich = G.smooth(0.66, 0.74, fbm(u, v, 9, 3, 83));
    const base = 0.42 + n * 0.4 + strata * 0.1 + n2 * 0.12;
    let r = 128 * base + 22, g = 122 * base + 22, b = 110 * base + 20;
    r = mix(r, 118, lich * 0.55); g = mix(g, 126, lich * 0.55); b = mix(b, 78, lich * 0.55);
    const c = 0.55 + 0.45 * crack;
    o[0] = r * c; o[1] = g * c; o[2] = b * c;
    o[3] = n * 0.8 + n2 * 0.3 + strata * 0.15 + crack * 0.35;
  });
  /* ================= EDIFICI ================= */
  // intonaco a calce: chiaro, con macchie, crepe e zone dove si vede la pietra (si colora con i colori dei vertici)
  TEX.stucco = (S) => pair(S, 1.4, (u, v, o) => {
    const n = fbm(u, v, 5, 5, 201), d = fbm(u, v, 14, 3, 203);
    const w = worley(u, v, 6, 205);
    const bare = G.smooth(0.84, 0.9, fbm(u, v, 3, 4, 207) + G.smooth(0.25, 0.0, v) * 0.18);
    const stain = G.smooth(0.55, 0.9, 1 - v + n * 0.3) * 0.18;
    let l = 228 - n * 30 - d * 14 - stain * 80;
    const crack = 1 - G.smooth(0.0, 0.025, Math.abs(w[1] - w[0]) + d * 0.02) * 0.0;
    const sb = G.smooth(0.0, 0.08, w[1] - w[0]);
    let r = l, g = l * 0.97, b = l * 0.92;
    r = mix(r, 150 * (0.6 + sb * 0.5), bare); g = mix(g, 130 * (0.6 + sb * 0.5), bare); b = mix(b, 108 * (0.6 + sb * 0.5), bare);
    o[0] = r * crack; o[1] = g * crack; o[2] = b * crack; o[3] = n * 0.4 + d * 0.2 + bare * (0.3 + sb * 0.4);
  });
  // coppi: file di tegole curve in terracotta
  TEX.tiles = (S) => pair(S, 3.0, (u, v, o) => {
    const rows = 8, cols = 10, rv = v * rows, row = Math.floor(rv), fv = rv - row;
    const cu = u * cols + (row % 2) * 0.5, fu = cu - Math.floor(cu), col = Math.floor(cu);
    const arch = Math.sin(fu * Math.PI);
    const tile = lattice(col, row, cols * 3, 211);
    const n = fbm(u, v, 12, 3, 213);
    const shade = 0.55 + arch * 0.45 - (1 - fv) * 0.0 - G.smooth(0.8, 1.0, fv) * 0.35;
    o[0] = (150 + tile * 50 + n * 20) * shade; o[1] = (72 + tile * 28 + n * 10) * shade; o[2] = (44 + tile * 14) * shade;
    o[3] = arch * 0.7 + fv * 0.3 + n * 0.1;
  });
  // paglia: fasci di steli allineati
  TEX.thatch = (S) => pair(S, 2.6, (u, v, o) => {
    const st = vnoise(u * 1.0, v * 0.06, 90, 221), st2 = vnoise(u, v * 0.1, 40, 223);
    const layer = (v * 7) % 1, edge = G.smooth(0.85, 1.0, layer);
    const n = fbm(u, v, 6, 3, 225);
    const t = st * 0.5 + st2 * 0.3 + n * 0.2;
    o[0] = mix(98, 196, t) * (1 - edge * 0.45); o[1] = mix(76, 160, t) * (1 - edge * 0.45); o[2] = mix(38, 92, t) * (1 - edge * 0.45);
    o[3] = t * 0.7 + (1 - edge) * 0.3;
  });
  // scandole di legno
  TEX.shingles = (S) => pair(S, 2.4, (u, v, o) => {
    const rows = 9, rv = v * rows, row = Math.floor(rv), fv = rv - row;
    const cu = u * 7 + (row % 2) * 0.5 + lattice(row, 0, 99, 231) * 0.3, col = Math.floor(cu), fu = cu - col;
    const t = lattice(col, row, 99, 233), gr = vnoise(u, v * 0.15, 60, 235);
    const gap = G.smooth(0.0, 0.05, fu) * (1 - G.smooth(0.95, 1.0, fu)) * (1 - G.smooth(0.88, 1.0, fv) * 0.6);
    const l = (0.45 + t * 0.35 + gr * 0.2) * (0.35 + gap * 0.65);
    o[0] = 150 * l + 20; o[1] = 112 * l + 14; o[2] = 80 * l + 10; o[3] = gap * 0.6 + fv * 0.35 + gr * 0.1;
  });
  // muro di pietre squadrate a corsi irregolari
  TEX.stonewall = (S) => pair(S, 3.2, (u, v, o) => {
    const rows = 6, rv = v * rows + fbm(u, v, 3, 2, 241) * 0.15, row = Math.floor(rv), fv = rv - row;
    const len = 2 + lattice(row, 1, 99, 243) * 2;
    const cu = u * len + lattice(row, 2, 99, 245), col = Math.floor(cu), fu = cu - col;
    const t = lattice(col, row, 99, 247), n = fbm(u, v, 10, 4, 249);
    const mortar = Math.min(G.smooth(0.0, 0.07, fu), 1 - G.smooth(0.93, 1.0, fu), G.smooth(0.0, 0.1, fv), 1 - G.smooth(0.9, 1.0, fv));
    const l = (0.5 + t * 0.3 + n * 0.25) * (0.45 + mortar * 0.55);
    o[0] = 150 * l + 18; o[1] = 142 * l + 18; o[2] = 128 * l + 16; o[3] = mortar * 0.7 + n * 0.3;
  });
  // ardesia: lastre scure sovrapposte
  TEX.slate = (S) => pair(S, 2.2, (u, v, o) => {
    const rows = 10, rv = v * rows, row = Math.floor(rv), fv = rv - row;
    const cu = u * 6 + (row % 2) * 0.5, col = Math.floor(cu), fu = cu - col;
    const t = lattice(col, row, 99, 251), n = fbm(u, v, 14, 3, 253);
    const gap = G.smooth(0.0, 0.04, fu) * (1 - G.smooth(0.96, 1.0, fu)) * (1 - G.smooth(0.9, 1.0, fv) * 0.7);
    const l = (0.32 + t * 0.15 + n * 0.12) * (0.5 + gap * 0.5);
    o[0] = 140 * l + 14; o[1] = 146 * l + 16; o[2] = 160 * l + 20; o[3] = gap * 0.6 + fv * 0.3;
  });
  /* ================= LEGNO ================= */
  TEX.bark = (S) => pair(S, 3.0, (u, v, o) => {
    const warp = fbm(u, v, 3, 3, 91) * 0.15;
    const ridges = vnoise(u + warp, v * 0.08, 18, 93);
    const fine = fbm(u, v, 24, 3, 97);
    const groove = G.smooth(0.25, 0.55, ridges);
    const t = groove * 0.7 + fine * 0.3;
    o[0] = mix(46, 102, t); o[1] = mix(34, 78, t); o[2] = mix(24, 56, t);
    o[3] = groove * 0.8 + fine * 0.3;
  });
  TEX.palmBark = (S) => pair(S, 3.5, (u, v, o) => {
    const ring = (v * 5) % 1, n = fbm(u, v, 10, 3, 101);
    const edge = G.smooth(0.0, 0.15, ring) * (1 - G.smooth(0.75, 1.0, ring));
    const fib = vnoise(u, v * 0.1, 40, 103);
    const t = edge * 0.6 + n * 0.25 + fib * 0.15;
    o[0] = mix(70, 150, t); o[1] = mix(55, 120, t); o[2] = mix(38, 86, t);
    o[3] = edge * 0.7 + fib * 0.3;
  });
  TEX.planks = (S) => pair(S, 2.0, (u, v, o) => {
    const rows = 4, row = Math.floor(v * rows), fv = v * rows - row;
    const shift = lattice(row, 0, 64, 111);
    const len = 0.5, col = Math.floor((u + shift) / len), fu = ((u + shift) / len) % 1;
    const id = lattice(col, row, 64, 113);
    const grain = vnoise(u * 0.6 + id, v * 0.02 + fbm(u, v, 4, 2, 117) * 0.05, 80, 119) * 0.5 + vnoise(u, v, 160, 121) * 0.5;
    const knot = Math.max(0, 1 - Math.hypot((fu - 0.5) * 3, (fv - 0.5) * 2) * 2) * (id > 0.7 ? 1 : 0);
    const gap = G.smooth(0.0, 0.03, fv) * (1 - G.smooth(0.97, 1.0, fv)) * G.smooth(0.0, 0.01, fu) * (1 - G.smooth(0.99, 1.0, fu));
    const t = 0.55 + (id - 0.5) * 0.35 + grain * 0.35 - knot * 0.4;
    o[0] = mix(70, 196, t) * (0.25 + 0.75 * gap); o[1] = mix(46, 140, t) * (0.25 + 0.75 * gap); o[2] = mix(26, 86, t) * (0.25 + 0.75 * gap);
    o[3] = gap * 0.8 + grain * 0.25;
  });

  // legno levigato per i manici (venature lunghe)
  TEX.woodGrain = (S) => pair(S, 1.6, (u, v, o) => {
    const warp = fbm(u, v, 3, 3, 211) * 0.08;
    const grain = vnoise(u * 1.0 + warp, v * 0.05, 64, 213) * 0.6 + vnoise(u, v * 0.1, 160, 217) * 0.4;
    const ring = Math.sin((u + warp * 3) * Math.PI * 22) * 0.5 + 0.5;
    const t = 0.45 + grain * 0.35 + ring * 0.12 + fbm(u, v, 6, 3, 219) * 0.15;
    o[0] = mix(92, 168, t); o[1] = mix(60, 118, t); o[2] = mix(34, 72, t); o[3] = grain * 0.5 + ring * 0.25;
  });
  // corda ritorta (trefoli diagonali)
  TEX.rope = (S) => pair(S, 3.5, (u, v, o) => {
    const strand = Math.sin((u * 3 + v * 6) * Math.PI * 2) * 0.5 + 0.5;
    const fib = vnoise(u, v, 96, 221);
    const t = 0.55 + strand * 0.3 + fib * 0.15;
    o[0] = mix(110, 206, t); o[1] = mix(86, 170, t); o[2] = mix(52, 112, t); o[3] = strand * 0.8 + fib * 0.2;
  });
  // selce scheggiata (testa degli attrezzi)
  TEX.flint = (S) => pair(S, 4.0, (u, v, o) => {
    const w = worley(u, v, 9, 231), w2 = worley(u, v, 23, 233);
    const n = fbm(u, v, 6, 5, 237);
    const conch = Math.sin(w[0] * 22) * 0.5 + 0.5;
    const t = 0.4 + n * 0.4 + w[2] * 0.15 + conch * 0.03;
    o[0] = mix(46, 128, t); o[1] = mix(44, 120, t); o[2] = mix(42, 108, t);
    o[3] = conch * 0.15 + (1 - G.smooth(0, 0.08, w2[1] - w2[0])) * 0.35 + n * 0.5;
  });

  /* ================= TESSUTI / ANIMALI ================= */
  TEX.wool = (S) => pair(S, 3.0, (u, v, o) => {
    const w = worley(u, v, 22, 131), n = fbm(u, v, 8, 3, 133);
    const curl = 1 - G.smooth(0, 0.55, w[0]);
    const t = 0.7 + curl * 0.25 + n * 0.1;
    o[0] = 236 * t; o[1] = 230 * t; o[2] = 216 * t; o[3] = curl + n * 0.3;
  });
  TEX.cloth = (S) => pair(S, 1.2, (u, v, o) => {
    const wx = Math.sin(u * 64 * Math.PI) * 0.5 + 0.5, wy = Math.sin(v * 64 * Math.PI) * 0.5 + 0.5;
    const n = fbm(u, v, 6, 3, 141), stain = G.smooth(0.6, 0.8, fbm(u, v, 3, 3, 143));
    const t = 0.86 + (wx * wy) * 0.05 + n * 0.08 - stain * 0.1;
    o[0] = 236 * t; o[1] = 226 * t; o[2] = 200 * t; o[3] = n * 0.6 + stain * 0.2;
  });
  TEX.hide = (S, base, spot, spots) => pair(S, 1.0, (u, v, o) => {
    const n = fbm(u, v, 4, 3, 151), f = fbm(u, v, 30, 2, 153);
    const sp = spots ? G.smooth(0.5, 0.54, fbm(u, v, 3, 4, 155)) : 0;
    const t = 0.85 + n * 0.15 + f * 0.08;
    o[0] = mix(base[0], spot[0], sp) * t; o[1] = mix(base[1], spot[1], sp) * t; o[2] = mix(base[2], spot[2], sp) * t; o[3] = f;
  });
  TEX.shell = (S) => pair(S, 3.0, (u, v, o) => {
    const w = worley(u, v, 6, 161), n = fbm(u, v, 8, 3, 163);
    const edge = G.smooth(0.0, 0.12, w[1] - w[0]);
    const t = 0.5 + w[2] * 0.3 + n * 0.25;
    o[0] = mix(50, 140, t) * (0.4 + 0.6 * edge); o[1] = mix(48, 112, t) * (0.4 + 0.6 * edge); o[2] = mix(20, 50, t) * (0.4 + 0.6 * edge);
    o[3] = edge * 0.8 + n * 0.2;
  });
  TEX.coral = (S) => pair(S, 4.0, (u, v, o) => {
    const w = worley(u, v, 26, 171), n = fbm(u, v, 8, 3, 173);
    const pore = G.smooth(0.15, 0.45, w[0]);
    const t = 0.6 + pore * 0.4;
    o[0] = 255 * t; o[1] = 255 * t; o[2] = 255 * t; o[3] = pore + n * 0.3;
  });
  TEX.waterNormal = (S) => {
    const b = bake(S, (u, v, o) => {
      const n = fbm(u, v, 4, 5, 181, 0.55);
      const w = worley(u, v, 8, 183);
      o[0] = o[1] = o[2] = 0; o[3] = n * 0.8 + (1 - w[0]) * 0.25;
    });
    return toTex(normalFromHeight(b.height, S, 3.0), false);
  };

  /* ================= CARD CON ALPHA (fogliame) ================= */
  function cardCanvas(S, draw) { const c = makeCanvas(S); const ctx = c.getContext('2d'); draw(ctx, S); return c; }
  function leafShape(ctx, x, y, len, wid, ang, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const grd = ctx.createLinearGradient(0, -wid, 0, wid);
    grd.addColorStop(0, col[0]); grd.addColorStop(0.5, col[1]); grd.addColorStop(1, col[2]);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid * 0.9, len, 0);
    ctx.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.3, wid, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(30,50,10,0.35)'; ctx.lineWidth = Math.max(1, wid * 0.12);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.95, 0); ctx.stroke();
    ctx.restore();
  }
  TEX.leaves = (S, hue) => {
    const rnd = G.mulberry32(hue * 1000 + 7);
    const c = cardCanvas(S, (ctx) => {
      // rami
      ctx.strokeStyle = '#4a3622'; ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        ctx.lineWidth = S * 0.012; ctx.beginPath();
        const a = rnd() * Math.PI * 2; ctx.moveTo(S / 2, S / 2);
        ctx.quadraticCurveTo(S / 2 + Math.cos(a) * S * 0.2, S / 2 + Math.sin(a + 0.4) * S * 0.2, S / 2 + Math.cos(a) * S * 0.45, S / 2 + Math.sin(a) * S * 0.45);
        ctx.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const r = Math.sqrt(rnd()) * S * 0.44, a = rnd() * Math.PI * 2;
        const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
        const L = S * (0.055 + rnd() * 0.05);
        const shade = 0.55 + rnd() * 0.5 - (r / S) * 0.2;
        const h = hue + (rnd() - 0.5) * 18, l = 18 + shade * 22;
        leafShape(ctx, x, y, L, L * 0.38, a + (rnd() - 0.5) * 1.6, [`hsl(${h},55%,${l + 8}%)`, `hsl(${h},50%,${l}%)`, `hsl(${h},45%,${l - 7}%)`]);
      }
    });
    return toTex(c, true, false);
  };
  TEX.pine = (S) => {
    const rnd = G.mulberry32(77);
    const c = cardCanvas(S, (ctx) => {
      ctx.lineCap = 'round';
      for (let b = 0; b < 5; b++) {
        const y0 = S * (0.12 + b * 0.18);
        ctx.strokeStyle = '#3d2b1a'; ctx.lineWidth = S * 0.012;
        ctx.beginPath(); ctx.moveTo(S * 0.06, y0); ctx.lineTo(S * 0.94, y0 + S * 0.05); ctx.stroke();
        for (let i = 0; i < 180; i++) {
          const t = rnd(), x = S * (0.06 + t * 0.88), y = y0 + t * S * 0.05;
          const a = (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.8);
          const L = S * (0.05 + rnd() * 0.06) * (1 - t * 0.4);
          const l = 14 + rnd() * 16;
          ctx.strokeStyle = `hsl(${120 + rnd() * 25},${40 + rnd() * 20}%,${l}%)`; ctx.lineWidth = S * 0.005;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L * 0.4, y + Math.sin(a) * L); ctx.stroke();
        }
      }
    });
    return toTex(c, true, false);
  };
  TEX.frond = (S) => {
    const rnd = G.mulberry32(91);
    const c = cardCanvas(S, (ctx) => {
      ctx.lineCap = 'round';
      // nervatura centrale lungo la x
      ctx.strokeStyle = '#7a7a3a'; ctx.lineWidth = S * 0.018;
      ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
      for (let i = 0; i < 38; i++) {
        const t = i / 38, x = t * S * 0.96;
        const L = S * 0.47 * Math.sin(Math.PI * (0.1 + t * 0.85)) * (0.8 + rnd() * 0.2);
        for (const s of [-1, 1]) {
          if (rnd() < 0.08) continue;
          const l = 20 + rnd() * 16, h = 78 + rnd() * 22;
          ctx.fillStyle = `hsl(${h},50%,${l}%)`;
          const ex = x + L * 0.5, ey = S / 2 + s * L, w = S * 0.012;
          ctx.beginPath(); ctx.moveTo(x - w, S / 2); ctx.quadraticCurveTo(x + L * 0.2, S / 2 + s * L * 0.55, ex, ey);
          ctx.quadraticCurveTo(x + L * 0.2 + w * 2, S / 2 + s * L * 0.5, x + w, S / 2); ctx.fill();
        }
      }
    });
    return toTex(c, true, false);
  };
  TEX.grassCard = (S) => {
    const rnd = G.mulberry32(123);
    const c = cardCanvas(S, (ctx) => {
      // tanti fili sottili, colori presi dall'erba vera (verdi spenti e paglierini)
      for (let i = 0; i < 260; i++) {
        const x = S * (0.03 + rnd() * 0.94), h = S * (0.3 + rnd() * 0.68), bend = (rnd() - 0.5) * S * 0.3;
        const w = S * (0.006 + rnd() * 0.008);
        const g = ctx.createLinearGradient(0, S, 0, S - h);
        const dry = rnd() < 0.18;
        const hue = dry ? 48 + rnd() * 12 : 72 + rnd() * 26, sat = dry ? 35 : 38 + rnd() * 20, l = dry ? 48 + rnd() * 10 : 26 + rnd() * 18;
        g.addColorStop(0, `hsl(${hue},${sat}%,${l * 0.7}%)`); g.addColorStop(0.5, `hsl(${hue},${sat}%,${l}%)`); g.addColorStop(1, `hsl(${hue - 6},${sat + 6}%,${l + 12}%)`);
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(x - w, S); ctx.quadraticCurveTo(x + bend * 0.35, S - h * 0.55, x + bend, S - h);
        ctx.quadraticCurveTo(x + bend * 0.35 + w * 0.4, S - h * 0.55, x + w, S); ctx.fill();
      }
    });
    return toTex(c, true, false);
  };
  TEX.flowerCard = (S) => {
    const rnd = G.mulberry32(321);
    const c = cardCanvas(S, (ctx) => {
      const cols = ['#f4f1e8', '#f2c94c', '#e86a92', '#8f7ff2', '#ff8a4c', '#5ab4f0'];
      for (let i = 0; i < 9; i++) {
        const x = S * (0.1 + rnd() * 0.8), h = S * (0.35 + rnd() * 0.5);
        ctx.strokeStyle = '#3f6b24'; ctx.lineWidth = S * 0.012;
        ctx.beginPath(); ctx.moveTo(x, S); ctx.quadraticCurveTo(x + (rnd() - 0.5) * 20, S - h * 0.5, x, S - h); ctx.stroke();
        const col = cols[(rnd() * cols.length) | 0], R = S * (0.03 + rnd() * 0.025);
        ctx.fillStyle = col;
        for (let p = 0; p < 6; p++) { const a = (p / 6) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * R, S - h + Math.sin(a) * R, R * 0.8, R * 0.45, a, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#f5d142'; ctx.beginPath(); ctx.arc(x, S - h, R * 0.45, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 40; i++) {
        const x = S * rnd(), h = S * (0.2 + rnd() * 0.4);
        ctx.strokeStyle = `hsl(${90 + rnd() * 20},45%,${25 + rnd() * 15}%)`; ctx.lineWidth = S * 0.01;
        ctx.beginPath(); ctx.moveTo(x, S); ctx.lineTo(x + (rnd() - 0.5) * 30, S - h); ctx.stroke();
      }
    });
    return toTex(c, true, false);
  };
  TEX.kelp = (S) => {
    const rnd = G.mulberry32(555);
    const c = cardCanvas(S, (ctx) => {
      for (let i = 0; i < 5; i++) {
        const x = S * (0.15 + i * 0.17 + rnd() * 0.05);
        ctx.strokeStyle = '#4b5a1c'; ctx.lineWidth = S * 0.01;
        ctx.beginPath(); ctx.moveTo(x, S);
        for (let y = S; y > 0; y -= S / 16) ctx.lineTo(x + Math.sin(y * 0.03 + i) * S * 0.03, y);
        ctx.stroke();
        for (let y = S * 0.95; y > S * 0.03; y -= S * (0.05 + rnd() * 0.04)) {
          const xx = x + Math.sin(y * 0.03 + i) * S * 0.03, s = rnd() < 0.5 ? -1 : 1;
          leafShape(ctx, xx, y, S * (0.09 + rnd() * 0.06), S * 0.025, s > 0 ? -0.5 : Math.PI + 0.5, [`hsl(${60 + rnd() * 20},55%,38%)`, `hsl(${55 + rnd() * 20},60%,28%)`, `hsl(${50 + rnd() * 20},50%,20%)`]);
        }
      }
    });
    return toTex(c, true, false);
  };

  // felce: fronda pennata lungo la x, pinnule fitte e seghettate
  TEX.fern = (S) => {
    const rnd = G.mulberry32(77);
    const c = cardCanvas(S, (ctx) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4d5a22'; ctx.lineWidth = S * 0.012;
      ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S * 0.98, S / 2); ctx.stroke();
      for (let i = 0; i < 34; i++) {
        const t = i / 34, x = t * S * 0.95;
        const L = S * 0.46 * Math.sin(Math.PI * (0.06 + t * 0.9)) * (0.85 + rnd() * 0.15);
        for (const sd of [-1, 1]) {
          // ogni pinnula è fatta di piccoli lobi
          const lobes = 6;
          for (let k = 0; k < lobes; k++) {
            const u = k / lobes, px = x + L * 0.35 * u, py = S / 2 + sd * L * u;
            const r = S * 0.016 * (1 - u * 0.6);
            ctx.fillStyle = `hsl(${84 + rnd() * 16},${45 + rnd() * 15}%,${32 + rnd() * 14 + u * 8}%)`;
            ctx.beginPath(); ctx.ellipse(px + r * 0.8, py, r * 1.5, r, sd * 0.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    });
    return toTex(c, true, false);
  };
  // foglia tropicale larga con nervature (u lungo la foglia, v di traverso)
  TEX.tropLeaf = (S) => {
    const rnd = G.mulberry32(88);
    const c = cardCanvas(S, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, S, 0);
      g.addColorStop(0, '#3d6420'); g.addColorStop(0.5, '#558a2c'); g.addColorStop(1, '#6a9a36');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, S / 2);
      ctx.bezierCurveTo(S * 0.25, S * 0.02, S * 0.75, S * 0.02, S, S / 2);
      ctx.bezierCurveTo(S * 0.75, S * 0.98, S * 0.25, S * 0.98, 0, S / 2); ctx.fill();
      // strappi laterali (come banano)
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) { const x = S * (0.2 + rnd() * 0.7), sd = rnd() < 0.5 ? -1 : 1; ctx.lineWidth = S * 0.006; ctx.beginPath(); ctx.moveTo(x, S / 2 + sd * S * 0.12); ctx.lineTo(x + S * 0.06, S / 2 + sd * S * 0.5); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = 'rgba(190,210,120,0.55)'; ctx.lineWidth = S * 0.012;
      ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,190,100,0.25)'; ctx.lineWidth = S * 0.004;
      for (let i = 0; i < 26; i++) { const x = S * (i / 26); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, S / 2); ctx.quadraticCurveTo(x + S * 0.04, S / 2 + sd * S * 0.2, x + S * 0.09, S / 2 + sd * S * 0.48); ctx.stroke(); } }
      for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '200,220,140'},${0.04 + rnd() * 0.05})`; ctx.fillRect(rnd() * S, rnd() * S, 2, 2); }
      ctx.globalCompositeOperation = 'source-over';
    });
    return toTex(c, true, false);
  };
  // canne palustri e tife
  TEX.reed = (S) => {
    const rnd = G.mulberry32(99);
    const c = cardCanvas(S, (ctx) => {
      for (let i = 0; i < 46; i++) {
        const x = S * (0.04 + rnd() * 0.92), h = S * (0.55 + rnd() * 0.44), bend = (rnd() - 0.5) * S * 0.12, w = S * (0.006 + rnd() * 0.006);
        const dry = rnd() < 0.3;
        ctx.fillStyle = dry ? `hsl(${44 + rnd() * 8},${30 + rnd() * 10}%,${44 + rnd() * 10}%)` : `hsl(${70 + rnd() * 20},${35 + rnd() * 15}%,${36 + rnd() * 16}%)`;
        ctx.beginPath(); ctx.moveTo(x - w, S); ctx.quadraticCurveTo(x + bend * 0.4, S - h * 0.5, x + bend, S - h); ctx.quadraticCurveTo(x + bend * 0.4 + w, S - h * 0.5, x + w, S); ctx.fill();
        if (rnd() < 0.25) { ctx.fillStyle = `hsl(25,${40 + rnd() * 10}%,${18 + rnd() * 6}%)`; ctx.beginPath(); ctx.ellipse(x + bend * 0.95, S - h * 0.92, w * 2.4, S * 0.045, 0, 0, Math.PI * 2); ctx.fill(); }
      }
    });
    return toTex(c, true, false);
  };

  // buccia del cactus: righe verticali lungo le costole e areole con spine
  TEX.cactus = (S) => pair(S, 2.2, (u, v, o) => {
    const rib = Math.cos(u * Math.PI * 2 * 12) * 0.5 + 0.5;
    const n = fbm(u, v, 6, 3, 401);
    const ar = (Math.abs(((u * 12) % 1) - 0.5) < 0.06 && ((v * 22) % 1) < 0.12) ? 1 : 0;
    const l = 0.55 + rib * 0.35 + n * 0.12;
    o[0] = 120 * l + ar * 110; o[1] = 150 * l + ar * 90; o[2] = 95 * l + ar * 60; o[3] = 0.5 + rib * 0.3 + ar * 0.4;
  });
  /* ---- texture fotografiche (cartella assets) ---- */
  TEX.loadPhotos = function (base) {
    const list = { grass: 'grass.jpg', grassN: 'grass_n.jpg', sand: 'sand.jpg', sandN: 'sand_n.jpg', dirt: 'dirt.jpg', dirtN: 'dirt_n.jpg', gravel: 'gravel.jpg', gravelN: 'gravel_n.jpg',
      bark: 'bark.jpg', barkN: 'bark_n.jpg', seabed: 'seabed.jpg', seabedN: 'seabed_n.jpg', leaves0: 'leaves0.png', leaves1: 'leaves1.png', leaves0N: 'leaves0_n.jpg', leaves1N: 'leaves1_n.jpg', seaweed: 'seaweed.png' };
    const loader = new THREE.TextureLoader();
    const out = {};
    return Promise.all(Object.entries(list).map(([k, f]) => new Promise((res) => {
      loader.load(base + f, (t) => {
        const isColor = !/N$/.test(k);
        t.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
        if (!/^leaves|seaweed/.test(k)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = G.maxAniso || 4; t.minFilter = THREE.LinearMipmapLinearFilter;
        out[k] = t; res();
      }, undefined, () => res());
    }))).then(() => out);
  };

  /* ---- modelli scansionati (Poly Haven, CC0) ----
     modelli.json descrive ogni modello e i suoi livelli di dettaglio;
     modelli.bin contiene posizioni, normali, uv e indici */
  TEX.loadScans = async function (base) {
    const meta = await (await fetch(base + 'modelli.json')).json();
    const bin = await (await fetch(base + 'modelli.bin')).arrayBuffer();
    const out = { geo: {}, info: {}, tex: {} };
    for (const [name, m] of Object.entries(meta.models)) {
      out.info[name] = m;
      out.geo[name] = m.lods.map((l) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, l.pos, l.vc * 3), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, l.nor, l.vc * 3), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, l.uv, l.vc * 2), 2));
        g.setIndex(new THREE.BufferAttribute(l.big ? new Uint32Array(bin, l.idx, l.ic) : new Uint16Array(bin, l.idx, l.ic), 1));
        g.computeBoundingSphere();
        return g;
      });
    }
    const loader = new THREE.TextureLoader();
    await Promise.all(Object.entries(meta.textures).flatMap(([mat, t]) => Object.entries(t).map(([key, file]) => new Promise((res) => {
      loader.load(base + file, (tx) => {
        tx.encoding = key === 'map' ? THREE.sRGBEncoding : THREE.LinearEncoding;
        tx.anisotropy = G.maxAniso || 4;
        (out.tex[mat] = out.tex[mat] || {})[key] = tx; res();
      }, undefined, () => res());
    }))));
    return out;
  };
  // copia di una geometria scalata (le scansioni hanno dimensioni reali)
  TEX.scaledGeo = function (g, k) {
    const c = g.clone(); c.scale(k, k, k); c.computeBoundingSphere(); return c;
  };

  /* ---- genera tutto il set ---- */
  TEX.buildAll = function (size, onStep) {
    const S = size, s2 = Math.max(256, size / 2), s4 = Math.max(128, size / 4);
    const jobs = [
      ['grass', () => TEX.grass(S)], ['sand', () => TEX.sand(S)], ['rock', () => TEX.rock(S)],
      ['bark', () => TEX.bark(s2)], ['palmBark', () => TEX.palmBark(s2)], ['planks', () => TEX.planks(S)],
      ['woodGrain', () => TEX.woodGrain(s2)], ['rope', () => TEX.rope(s4)], ['flint', () => TEX.flint(s2)],
      ['wool', () => TEX.wool(s4)], ['cloth', () => TEX.cloth(s2)], ['shell', () => TEX.shell(s4)], ['coral', () => TEX.coral(s4)],
      ['cowHide', () => TEX.hide(s4, [238, 234, 226], [34, 30, 28], true)],
      ['waterNormal', () => TEX.waterNormal(s2)],
      ['leavesOak', () => TEX.leaves(s2, 100)], ['leavesBirch', () => TEX.leaves(s2, 78)], ['pine', () => TEX.pine(s2)],
      ['frond', () => TEX.frond(s2)], ['grassCard', () => TEX.grassCard(s4)], ['flowerCard', () => TEX.flowerCard(s4)], ['kelp', () => TEX.kelp(s4)],
      ['fern', () => TEX.fern(s4)], ['stucco', () => TEX.stucco(s2)], ['tiles', () => TEX.tiles(s2)], ['thatch', () => TEX.thatch(s2)], ['shingles', () => TEX.shingles(s2)], ['stonewall', () => TEX.stonewall(s2)], ['slate', () => TEX.slate(s2)], ['cactus', () => TEX.cactus(s4)], ['tropLeaf', () => TEX.tropLeaf(s4)], ['reed', () => TEX.reed(s4)],
    ];
    let i = 0;
    return new Promise((res) => {
      function step() {
        if (i >= jobs.length) return res(TEX);
        const [k, f] = jobs[i++];
        TEX[k + 'T'] = f();
        if (onStep) onStep(i / jobs.length, k);
        setTimeout(step, 0);
      }
      step();
    });
  };
})();
