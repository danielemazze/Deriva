'use strict';
/* ==========================================================
   Generazione del mondo: altezza, biomi, scogliere coralline
   Funzioni pure (usabili anche fuori dal browser)
   ========================================================== */
(function () {
  const G = globalThis.G;

  G.initWorldGen = function (seed) {
    G.seed = seed;
    G.nA = G.makeNoise(seed);
    G.nB = G.makeNoise(seed + 101);
    G.nC = G.makeNoise(seed + 202);
    G.nD = G.makeNoise(seed + 303);
    G.hCache = new Map();
    VOLC.clear(); LAKES.clear(); CASTLES.clear();
  };

  function fbm(n, x, z, oct) {
    let s = 0, a = 1, f = 1, t = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, z * f) * a; t += a; a *= 0.5; f *= 2.03; }
    return s / t;
  }
  G.fbm = fbm;

  // profilo verticale in funzione della "massa" continentale m
  const PROFILE = [
    [-1.3, -38], [-0.75, -26], [-0.4, -12], [-0.22, -5.5], [-0.1, -2.6],
    [-0.02, -0.6], [0.03, 0.6], [0.12, 1.6], [0.3, 4.2], [0.55, 7], [0.85, 11.5], [1.3, 19],
  ];

  // massa continentale grezza
  G.landMass = function (x, z) {
    const wx = x + G.nB(x * 0.0021 + 17.3, z * 0.0021) * 90;
    const wz = z + G.nB(x * 0.0021, z * 0.0021 + 41.7) * 90;
    let c = fbm(G.nA, wx * 0.0021, wz * 0.0021, 4);
    // arcipelago infinito: macchie di isole a varie scale
    let m = (c - 0.24) * 2.5 + fbm(G.nC, x * 0.009, z * 0.009, 2) * 0.35;
    // isola di partenza garantita
    const r = Math.sqrt(x * x + z * z);
    const spawn = 0.85 - r / 140 + G.nC(x * 0.02, z * 0.02) * 0.12;
    m = m > spawn ? m : spawn + Math.log(1 + Math.exp((m - spawn) * 6)) / 6;
    return m;
  };

  /* ---------- clima e biomi ----------
     t = temperatura, w = umidità, mt = catene montuose (0..1).
     Vicino al punto di partenza il clima è temperato e senza montagne. */
  G.BIOME = { PIANURA: 0, FORESTA: 1, PLUVIALE: 2, GIUNGLA: 3, DESERTO: 4, MONTAGNA: 5, NEVE: 6, VULCANO: 7 };
  G.BIOME_N = ['Pianura', 'Foresta', 'Foresta pluviale', 'Giungla', 'Deserto', 'Montagne', 'Neve', 'Vulcano'];
  const hashI = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
  G.hashInt = (a, b) => hashI(a, b, G.seed | 0);

  /* ---------- vulcani: isole coniche con cratere e lava (rari, lontano dalla partenza) ---------- */
  const VC = 1100, VOLC = new Map();
  function volcSite(cx, cz) {
    const k = cx + ',' + cz; if (VOLC.has(k)) return VOLC.get(k);
    const r = G.mulberry32(hashI(cx, cz, (G.seed | 0) + 77));
    let v = null;
    if (r() < 0.3) {
      const x = cx * VC + 300 + r() * (VC - 600), z = cz * VC + 300 + r() * (VC - 600);
      if (Math.hypot(x, z) > 1000) v = { x, z, R: 230 + r() * 80, H: 58 + r() * 26, Rc: 24 + r() * 8, depth: 13 + r() * 5 };
    }
    VOLC.set(k, v); return v;
  }
  G.volcanoNear = function (x, z) {
    const v = volcSite(Math.floor(x / VC), Math.floor(z / VC)); if (!v) return null;
    const d = Math.hypot(x - v.x, z - v.z); return d < v.R ? { v, d } : null;
  };
  G.volcanoes = function (x, z, rad) { const out = []; for (let cz = Math.floor((z - rad) / VC); cz <= Math.floor((z + rad) / VC); cz++) for (let cx = Math.floor((x - rad) / VC); cx <= Math.floor((x + rad) / VC); cx++) { const v = volcSite(cx, cz); if (v) out.push(v); } return out; };
  function coneH(v, d) { const t = 1 - d / v.R; return v.H * Math.pow(Math.max(0, t), 1.55); }
  // superficie della lava nel cratere (o null)
  G.lavaAt = function (x, z) { const n = G.volcanoNear(x, z); if (!n || n.d > n.v.Rc) return null; return n.v.lava; };
  G.volcanoHeat = function (x, z) { const n = G.volcanoNear(x, z); if (!n) return 0; return (1 - n.d / n.v.R) * 12 + (n.d < n.v.Rc * 1.3 ? 22 : 0); };

  /* ---------- freddo: neve e mare ghiacciato ---------- */
  G.coldAt = function (x, z) { const c = G.climate(x, z); return G.smooth(-0.24, -0.38, c.t); };
  // banchisa: dove fa molto freddo il mare gela, con qualche canale d'acqua libera
  G.ICE_Y = 0.42;
  G.iceAt = function (x, z) {
    // meno ghiaccio: solo dove fa freddissimo, a lastre sparse con tanta acqua libera
    const cold = G.coldAt(x, z); if (cold < 0.85) return false;
    const n = G.nA(x * 0.021 + 5, z * 0.021 - 3) * 0.5 + G.nC(x * 0.07, z * 0.07) * 0.18;
    return n + (cold - 0.97) * 1.2 > 0.2;
  };

  /* ---------- laghetti di montagna (con cascata dove trabocca) ---------- */
  const LC = 640, LAKES = new Map();
  function lakeSite(cx, cz) {
    const k = cx + ',' + cz; if (LAKES.has(k)) return LAKES.get(k);
    LAKES.set(k, null);
    const r = G.mulberry32(hashI(cx, cz, (G.seed | 0) + 913));
    let best = null;
    if (r() < 0.62) for (let i = 0; i < 26; i++) {
      const x = cx * LC + 80 + r() * (LC - 160), z = cz * LC + 80 + r() * (LC - 160);
      if (Math.hypot(x, z) < 400) continue;
      const cl = G.climate(x, z); if (cl.mt < 0.45) continue;
      if (G.volcanoNear(x, z) || G.volcanoNear(x + 60, z) || G.volcanoNear(x - 60, z)) continue;
      const h = baseHeight(x, z); if (h < 12 || h > 52) continue;
      // conca: si sceglie il punto più basso di un altopiano
      let flat = 0; for (let k2 = 0; k2 < 8; k2++) { const a = k2 * 0.785; flat += Math.abs(baseHeight(x + Math.cos(a) * 14, z + Math.sin(a) * 14) - h); }
      const score = -flat / 8 + r() * 0.5;
      if (!best || score > best.score) best = { x, z, h, score };
    }
    let L = null;
    if (best && best.score > -4.5) {
      const R = 13 + r() * 11;
      // il bordo più basso decide il livello dell'acqua e da dove esce la cascata
      let low = Infinity, la = 0;
      for (let k2 = 0; k2 < 24; k2++) { const a = (k2 / 24) * 6.2832; const hh = baseHeight(best.x + Math.cos(a) * R * 1.12, best.z + Math.sin(a) * R * 1.12); if (hh < low) { low = hh; la = a; } }
      const level = Math.min(best.h + 1.2, low) - 0.25;
      if (level > 9) L = { id: 'l:' + k, x: best.x, z: best.z, R, level, depth: 2.6 + r() * 2, out: la };
    }
    LAKES.set(k, L); return L;
  }
  G.lakeNear = function (x, z) {
    const L = lakeSite(Math.floor(x / LC), Math.floor(z / LC)); if (!L) return null;
    const d = Math.hypot(x - L.x, z - L.z); return d < L.R * 1.6 ? { L, d } : null;
  };
  G.lakes = function (x, z, rad) { const out = []; for (let cz = Math.floor((z - rad) / LC); cz <= Math.floor((z + rad) / LC); cz++) for (let cx = Math.floor((x - rad) / LC); cx <= Math.floor((x + rad) / LC); cx++) { const L = lakeSite(cx, cz); if (L) out.push(L); } return out; };
  /* ---------- castelli: solo in cima alle montagne alte, su un altopiano spianato ---------- */
  const CC = 1536, CASTLES = new Map();
  function castleSite(cx, cz) {
    const k = cx + ',' + cz; if (CASTLES.has(k)) return CASTLES.get(k);
    CASTLES.set(k, null);
    const r = G.mulberry32(hashI(cx, cz, (G.seed | 0) + 4127));
    let best = null;
    if (r() < 0.85) for (let i = 0; i < 70; i++) {
      const x = cx * CC + 220 + r() * (CC - 440), z = cz * CC + 220 + r() * (CC - 440);
      if (Math.hypot(x, z) < 900) continue;
      const cl = G.climate(x, z); if (cl.mt < 0.4) continue;
      const h = baseHeight(x, z); if (h < 20) continue;
      if (G.volcanoNear(x, z) || G.volcanoNear(x + 120, z) || G.volcanoNear(x - 120, z)) continue;
      let sum = 0, n = 0, mn = 1e9; for (let a2 = -2; a2 <= 2; a2++) for (let c2 = -2; c2 <= 2; c2++) { const g = baseHeight(x + a2 * 25, z + c2 * 25); sum += g; n++; mn = Math.min(mn, g); }
      if (mn < -4 || sum / n < 9) continue;
      const score = h - (h - sum / n) * 0.6 + r() * 2;
      if (!best || score > best.score) best = { x, z, h, mean: sum / n, score };
    }
    let C = null;
    if (best) {
      const lk = lakeSite(Math.floor(best.x / LC), Math.floor(best.z / LC));
      if (!lk || Math.hypot(lk.x - best.x, lk.z - best.z) > 260) C = { id: 'c:' + k, x: best.x, z: best.z, level: Math.round((best.mean * 0.55 + best.h * 0.45) * 10) / 10, R: 84, R2: 150, rotR: r() };
    }
    CASTLES.set(k, C); return C;
  }
  G.castleNear = function (x, z) {
    const C = castleSite(Math.floor(x / CC), Math.floor(z / CC)); if (!C) return null;
    const d = Math.hypot(x - C.x, z - C.z); return d < C.R2 ? { C, d } : null;
  };
  G.castleSites = function (x0, z0, size) { const out = []; for (let cz = Math.floor(z0 / CC); cz <= Math.floor((z0 + size) / CC); cz++) for (let cx = Math.floor(x0 / CC); cx <= Math.floor((x0 + size) / CC); cx++) { const C = castleSite(cx, cz); if (C && C.x >= x0 && C.x < x0 + size && C.z >= z0 && C.z < z0 + size) out.push(C); } return out; };
  // livello dell'acqua dolce nel punto (null se fuori dai laghi)
  G.lakeLevelAt = function (x, z) { const n = G.lakeNear(x, z); if (!n || n.d > n.L.R * 1.12) return null; return n.L.level; };
  const _cl = { t: 0, w: 0, mt: 0 };
  G.climate = function (x, z, out) {
    out = out || _cl;
    const r = Math.sqrt(x * x + z * z), home = 1 - G.smooth(110, 220, r);
    out.t = (G.nB(x * 0.0012 + 300, z * 0.0012 - 200) * 0.85 + G.nA(x * 0.0048 - 40, z * 0.0048 + 70) * 0.15) * (1 - home * 0.85);
    out.w = G.nD(x * 0.00135 - 500, z * 0.00135 + 800) * 0.85 + G.nC(x * 0.0052 + 33, z * 0.0052 - 12) * 0.15; // biomi grandi
    out.mt = G.smooth(0.3, 0.56, G.nC(x * 0.0011 + 900, z * 0.0011 - 400)) * (1 - home);
    return out;
  };
  // pesi continui (per i colori del terreno): deserto, rigoglioso, prateria secca, montagna
  G.biomeW = function (x, z, out) {
    const c = G.climate(x, z);
    const hot = G.smooth(0.02, 0.22, c.t);
    out[0] = hot * G.smooth(-0.02, -0.22, c.w);
    out[1] = hot * G.smooth(0.0, 0.3, c.w);
    out[2] = (1 - hot) * G.smooth(0.15, -0.12, c.w);
    out[3] = G.smooth(0.35, 0.65, c.mt);
    return out;
  };
  // pesi extra: neve, cenere vulcanica
  G.biomeW2 = function (x, z, out) {
    const c = G.climate(x, z);
    out[0] = G.smooth(-0.24, -0.36, c.t);
    const vn = G.volcanoNear(x, z); out[1] = vn ? G.smooth(0.08, 0.97, 1 - vn.d / vn.v.R) : 0;
    return out;
  };
  G.heightAt = function (x, z) {
    let h = baseHeight(x, z);
    // altopiano del castello: la cima viene spianata, i fianchi raccordati dolcemente
    const cn = G.castleNear(x, z);
    if (cn) { const k = 1 - G.smooth(cn.C.R, cn.C.R2, cn.d); h = G.lerp(h, cn.C.level, k * k * (3 - 2 * k)); }
    // laghetti: conca sotto il livello dell'acqua
    const ln = G.lakeNear(x, z);
    if (ln) {
      const L = ln.L, t = ln.d / L.R;
      const bowl = L.level - L.depth * (1 - t * t) * (t < 1 ? 1 : 0) + (t < 1 ? 0 : (t - 1) * 0.6);
      const k = 1 - G.smooth(1.0, 1.6, t);
      if (bowl < h) h = G.lerp(h, bowl, k);
      // canale d'uscita verso la cascata
      const oa = Math.atan2(z - L.z, x - L.x), da = Math.abs(G.angleDiff ? G.angleDiff(oa, L.out) : 0);
      if (t > 0.85 && t < 1.6 && da < 0.12) h = Math.min(h, L.level - 0.5 + (t - 0.85) * 2);
    }
    return h;
  };
  function baseHeight(x, z) {
    const m = G.landMass(x, z);
    let h = G.piecewise(PROFILE, m);
    const landT = G.smooth(0.02, 0.5, m);
    const cl = G.climate(x, z);
    // catene montuose: creste affilate nell'entroterra
    if (cl.mt > 0.001) {
      const inland = G.smooth(0.12, 0.65, m);
      const rg = 1 - Math.abs(G.nA(x * 0.0055 + 13, z * 0.0055 - 7)), rg2 = 1 - Math.abs(G.nB(x * 0.014 - 3, z * 0.014 + 9));
      h += cl.mt * inland * (rg * rg * 34 + rg2 * rg2 * 9 + 4);
    }
    // dune nel deserto
    const hot = G.smooth(0.02, 0.22, cl.t), dry = G.smooth(-0.02, -0.22, cl.w);
    if (hot * dry > 0.01) { const d = Math.sin(x * 0.045 + G.nC(x * 0.01, z * 0.01) * 3) * 0.5 + 0.5; h += hot * dry * G.smooth(0.1, 0.5, m) * (d * d * 2.2 + G.nD(x * 0.03, z * 0.03) * 0.8); }
    // colline nell'entroterra
    const hills = fbm(G.nD, x * 0.011, z * 0.011, 4);
    h += hills * 5 * landT + Math.abs(G.nD(x * 0.004 + 9, z * 0.004)) * 7 * G.smooth(0.35, 1.0, m);
    // fondale: dune e piccole irregolarità
    const sea = 1 - G.smooth(-0.1, 0.05, m);
    h += (G.nC(x * 0.05, z * 0.05) * 0.7 + G.nB(x * 0.17, z * 0.17) * 0.25) * sea;
    // spiagge piatte
    const beach = 1 - G.smooth(0.08, 0.28, m);
    h = G.lerp(h, G.lerp(h, 0.9 + hills * 0.4, 0.55), beach * G.smooth(-0.15, 0.05, m));
    // vulcano: l'isola conica sale dal mare, con il cratere in cima
    const vn = G.volcanoNear(x, z);
    if (vn) {
      const v = vn.v, t = 1 - vn.d / v.R;
      if (h < 0) h *= 1 - G.smooth(0.05, 0.45, t) * 0.97;
      const ridge = 1 + 0.08 * G.nB(x * 0.05, z * 0.05) + 0.06 * Math.abs(G.nA(Math.atan2(z - v.z, x - v.x) * 3, vn.d * 0.02));
      const cone = coneH(v, vn.d) * ridge;
      if (v.rim === undefined) { v.rim = coneH(v, v.Rc); v.floor = v.rim - v.depth; v.lava = v.floor + 2.2; }
      h = h * (1 - G.smooth(0.0, 0.3, t) * 0.4) + cone;
      if (vn.d < v.Rc) { const q = vn.d / v.Rc; h = Math.min(h, v.floor + v.depth * q * q * q); }
    }
    // micro dettaglio
    h += G.nA(x * 0.25, z * 0.25) * 0.12;
    return h;
  }

  G.normalAt = function (x, z) {
    const e = 0.75;
    const hl = G.heightAt(x - e, z), hr = G.heightAt(x + e, z);
    const hd = G.heightAt(x, z - e), hu = G.heightAt(x, z + e);
    const nx = hl - hr, nz = hd - hu, ny = 2 * e;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  };

  // bioma: pianura, foresta, foresta pluviale, giungla, deserto, montagne
  G.biomeAt = function (x, z) {
    const c = G.climate(x, z), B = G.BIOME;
    const vn = G.volcanoNear(x, z); if (vn && vn.d < vn.v.R * 0.8) return B.VULCANO;
    if (G.smooth(-0.24, -0.38, c.t) > 0.5) return B.NEVE;
    if (c.mt > 0.5) return B.MONTAGNA;
    if (c.t > 0.12) return c.w < -0.12 ? B.DESERTO : c.w < 0.28 ? B.GIUNGLA : B.PLUVIALE;
    return c.w < 0.05 ? B.PIANURA : B.FORESTA;
  };
  G.isHot = (x, z) => G.climate(x, z).t > 0.12;
  G.reefAt = function (x, z) {
    // 0..1 densità di corallo
    const r = G.nC(x * 0.018 + 70, z * 0.018 - 30) * 0.6 + G.nA(x * 0.06, z * 0.06) * 0.4;
    return G.smooth(-0.15, 0.45, r);
  };
  G.isLand = (x, z) => G.heightAt(x, z) > 0.25;
})();
