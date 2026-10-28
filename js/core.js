'use strict';
/* ==========================================================
   DERIVA — core: namespace, rumore, utilità, impostazioni
   ========================================================== */
const G = (globalThis.G = globalThis.G || {});
G.SEA = 0;
G.CHUNK = 64;

/* ---------- RNG e hash deterministici ---------- */
G.mulberry32 = function (a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
G.hash2 = function (x, z, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul((s | 0) + 1013, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/* ---------- Simplex 2D seminato ---------- */
G.makeNoise = function (seed) {
  const rnd = G.mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const g3 = [1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const gi = pm12[ii + perm[jj]] * 2; t0 *= t0; n0 = t0 * t0 * (g3[gi] * x0 + g3[gi + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const gi = pm12[ii + i1 + perm[jj + j1]] * 2; t1 *= t1; n1 = t1 * t1 * (g3[gi] * x1 + g3[gi + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const gi = pm12[ii + 1 + perm[jj + 1]] * 2; t2 *= t2; n2 = t2 * t2 * (g3[gi] * x2 + g3[gi + 1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
};

/* ---------- utilità matematiche ---------- */
G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = (a, b, v) => { const t = G.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
G.angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/* curva a tratti monotona (per il profilo isola) */
G.piecewise = function (pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      const t = (x - a[0]) / (b[0] - a[0]);
      const s = t * t * (3 - 2 * t);
      return a[1] + (b[1] - a[1]) * (0.35 * t + 0.65 * s);
    }
  }
  const l = pts[pts.length - 1], k = pts[pts.length - 2];
  return l[1] + (x - l[0]) * (l[1] - k[1]) / (l[0] - k[0]) * 0.6;
};

/* ---------- Impostazioni grafiche ---------- */
G.PRESETS = {
  minima: { label: 'Minima', pixel: 0.7, shadows: 0, godrays: false, view: 2, grass: 0.12, texSize: 512, waterSeg: 110, fx: false, ao: false },
  bassa: { label: 'Bassa', pixel: 0.75, shadows: 0, godrays: false, view: 3, grass: 0.3, texSize: 512, waterSeg: 150, fx: false, ao: false },
  media: { label: 'Media', pixel: 1.0, shadows: 1024, godrays: true, view: 4, grass: 0.65, texSize: 512, waterSeg: 220, fx: true, ao: true },
  alta: { label: 'Alta', pixel: 1.0, shadows: 2048, godrays: true, view: 5, grass: 1.0, texSize: 1024, waterSeg: 280, fx: true, ao: true },
  ultra: { label: 'Ultra', pixel: 1.25, shadows: 4096, godrays: true, view: 6, grass: 1.4, texSize: 1024, waterSeg: 340, fx: true, ao: true },
};
G.VERSION = '1.14';
/* versione web (anche per telefono): stesso gioco, pubblicato su GitHub Pages */
G.WEB_URL = 'danielemazze.github.io/Deriva';
// pagina aperta dal PC che ospita (http://ip:porta): il campo "entra" si riempie da solo
G.servedByHost = (() => { try { return !window.deriva && location.protocol === 'http:' && !!location.port; } catch (e) { return false; } })();
/* telefono o tablet: comandi touch, grafica leggera */
G.isTouch = (() => { try { const q = location.search; if (/[?&]touch=1/.test(q)) return true; if (/[?&]touch=0/.test(q)) return false; return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0); } catch (e) { return false; } })();
// tipo di base dei pezzi di pietra (stesse regole di aggancio e collisione di quelli di legno); serve anche al server
G.PIECE_KIND = { pavimento_pietra: 'pavimento', muro_pietra: 'muro', muro_porta_pietra: 'muro_porta', muro_finestra_pietra: 'muro_finestra', tetto_pietra: 'tetto', scala_pietra: 'scala' };
G.pieceKind = (t) => G.PIECE_KIND[t] || t;
// come si interagisce (timone, bauli, porte, persone): tasto destro, sul telefono il pulsante Usa
G.useKey = () => (G.isTouch ? 'Usa' : 'Tasto destro');
G.useHow = () => (G.isTouch ? 'tocca Usa' : 'usa il tasto destro');
G.defaultSettings = function () {
  const vols = { amb: 1, room: 1, ani: 1, wx: 1, sfx: 1, ui: 1 };
  if (G.isTouch) return Object.assign({ preset: 'bassa', fov: 80, sens: 1.0, volume: 0.6, vols, dynres: true, fpsTarget: 30 }, G.PRESETS.bassa);
  return Object.assign({ preset: 'media', fov: 75, sens: 1.0, volume: 0.6, vols }, G.PRESETS.media);
};
G.hiQ = () => { const S = G.settings; if (!S) return false; const p = S.preset === 'custom' ? S.basePreset : S.preset; return p === 'alta' || p === 'ultra'; };
G.lowQ = () => { const S = G.settings; if (!S) return false; const p = S.preset === 'custom' ? S.basePreset : S.preset; return p === 'minima' || p === 'bassa'; };
G.store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
G.hashString = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 1e9; };
