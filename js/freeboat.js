'use strict';
/* ==========================================================
   Barca libera: la costruisci pezzo per pezzo, su una griglia di
   1 m (in altezza a strati di 0.5 m), e galleggia subito.
   Fisica: ogni pezzo ha peso e volume. La spinta dell'acqua si calcola
   pezzo per pezzo (quanto è immerso sotto l'onda in quel punto), quindi
   la barca si inclina verso dove pesa di più, beccheggia sulle onde,
   sbanda col vento sulla vela, imbarca acqua e affonda se è troppo
   carica, si ribalta se è alta e stretta.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const V3 = THREE.Vector3;
  const FB = (G.FreeBoat = {});
  const RHO = 1000, LEVEL = 0.5;
  // pezzi: peso (kg), volume che sposta (m³), altezza, calpestabile, materiale
  const DEF = FB.DEF = {
    fasciame: { n: 'Fasciame', mass: 40, vol: 0.5, h: 0.5, walk: true, hull: true },
    ponte_barca: { n: 'Ponte', mass: 15, vol: 0.09, h: 0.12, walk: true, hull: true },
    zavorra: { n: 'Zavorra', mass: 280, vol: 0.11, h: 0.45, walk: true },
    baule: { n: 'Baule', mass: 30, vol: 0.05, h: 0.6 },
    panca: { n: 'Panca', mass: 15, vol: 0.03, h: 0.45 },
    albero_barca: { n: 'Albero', mass: 110, vol: 0.06, h: 5.5, mast: true },
    vela: { n: 'Vela', mass: 18, vol: 0.01, h: 4, sail: 9 },
    timone: { n: 'Timone', mass: 35, vol: 0.05, h: 1.1, helm: true },
    remo: { n: 'Remo', mass: 10, vol: 0.02, h: 0.2, oar: true },
    torcia: { n: 'Lanterna', mass: 5, vol: 0, h: 1.2, light: true },
  };
  FB.isPiece = (id) => !!DEF[id];
  const key = (x, y, z) => x + ',' + y + ',' + z;

  /* ---------------- geometria ---------------- */
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const SM = G.Structures && G.Structures.mats ? G.Structures.mats() : null;
    MATS = { planks: G.MAT.planksB || G.MAT.planks, logs: G.MAT.logs, rock: G.MAT.rock, cloth: G.MAT.cloth, solid: G.MAT.solid, iron: SM ? SM.iron : G.MAT.solid };
    return MATS;
  }
  const M = () => G.MODELS;
  function box(w, h, d, x, y, z, k) { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const px = p.getX(i) + x, py = p.getY(i) + y, pz = p.getZ(i) + z; if (ay > 0.5) uv.setXY(i, px * 0.5, pz * 0.5); else if (ax > 0.5) uv.setXY(i, pz * 0.5, py * 0.5); else uv.setXY(i, px * 0.5, py * 0.5); }
    g.translate(x, y, z); return M().colorize(g, k || 1, k || 1, k || 1); }
  function cyl(r0, r1, h, x, y, z, k, rx, rz) { const g = new THREE.CylinderGeometry(r0, r1, h, 8); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return M().colorize(g, k || 1, k || 1, k || 1); }
  function pieceGeo(c, cells) {
    const x = c.x, z = c.z, y0 = c.y * LEVEL, out = { planks: [], logs: [], rock: [], cloth: [], iron: [] };
    const has = (dx, dy, dz, pred) => { const o = cells.get(key(c.x + dx, c.y + dy, c.z + dz)); return o && (!pred || pred(o)); };
    switch (c.t) {
      case 'fasciame': {
        out.planks.push(box(1.0, 0.5, 1.0, x, y0 + 0.25, z, 0.92));
        // capodibanda sui bordi liberi: si vede dove finisce lo scafo
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!has(dx, 0, dz, (o) => DEF[o.t].hull) && !has(0, 1, 0)) out.planks.push(box(dx ? 0.1 : 1.04, 0.16, dz ? 0.1 : 1.04, x + dx * 0.47, y0 + 0.55, z + dz * 0.47, 0.62));
        break;
      }
      case 'ponte_barca': out.planks.push(box(1.0, 0.12, 1.0, x, y0 + 0.06, z, 1.05)); break;
      case 'zavorra': { const r = M().rock(990 + ((c.x * 7 + c.z * 13) & 7), true); r.scale(0.48, 0.42, 0.48); r.translate(x, y0 + 0.2, z); out.rock.push(r); break; }
      case 'baule': out.planks.push(box(0.9, 0.5, 0.55, x, y0 + 0.25, z, 0.85), box(0.92, 0.16, 0.57, x, y0 + 0.58, z, 0.7)); break;
      case 'panca': out.planks.push(box(0.9, 0.08, 0.35, x, y0 + 0.42, z, 0.95), box(0.08, 0.4, 0.3, x - 0.38, y0 + 0.2, z, 0.7), box(0.08, 0.4, 0.3, x + 0.38, y0 + 0.2, z, 0.7)); break;
      case 'albero_barca': out.logs.push(cyl(0.11, 0.15, 5.4, x, y0 + 2.7, z, 0.95), cyl(0.06, 0.06, 2.6, x, y0 + 1.1, z + 0.0, 0.8, Math.PI / 2)); break;
      case 'vela': break; // disegnata a parte (si orienta col vento)
      case 'timone': out.planks.push(cyl(0.07, 0.09, 1.0, x, y0 + 0.5, z, 0.8)); { const w = new THREE.TorusGeometry(0.38, 0.04, 6, 14); w.rotateX(0.35); w.translate(x, y0 + 1.05, z + 0.05); out.planks.push(M().colorize(w, 0.75, 0.75, 0.75)); for (let i = 0; i < 4; i++) { const s = new THREE.BoxGeometry(0.04, 0.8, 0.04); s.rotateZ(i * Math.PI / 4); s.rotateX(0.35); s.translate(x, y0 + 1.05, z + 0.05); out.planks.push(M().colorize(s, 0.7, 0.7, 0.7)); } } break;
      case 'remo': { const side = c.x >= 0 ? 1 : -1; out.planks.push(box(2.2, 0.06, 0.08, x + side * 1.0, y0 + 0.35, z, 0.95), box(0.5, 0.04, 0.22, x + side * 2.05, y0 + 0.3, z, 0.85)); break; }
      case 'torcia': out.logs.push(cyl(0.04, 0.05, 1.0, x, y0 + 0.5, z, 0.9)); out.iron.push(box(0.2, 0.22, 0.2, x, y0 + 1.1, z, 0.9)); break;
    }
    return out;
  }
  FB.rebuild = function (b) {
    const pcs = b.pcs || [];
    const cells = new Map(); for (const c of pcs) cells.set(key(c.x, c.y, c.z), c);
    b.cells = cells;
    if (b.fbMesh) { b.inner.remove(b.fbMesh); b.fbMesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const grp = new THREE.Group(), parts = { planks: [], logs: [], rock: [], cloth: [], iron: [] };
    for (const c of pcs) { const g = pieceGeo(c, cells); for (const k in g) parts[k].push(...g[k]); }
    const MT = mats();
    for (const k in parts) if (parts[k].length) { const m = new THREE.Mesh(M().merge(parts[k]), MT[k] || MT.planks); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    // vele: una per albero che ne ha una nella stessa colonna
    b.sails = [];
    for (const c of pcs) if (c.t === 'vela') {
      const mast = pcs.find((o) => o.t === 'albero_barca' && o.x === c.x && o.z === c.z);
      const g = new THREE.PlaneGeometry(2.4, 3.6, 6, 6).translate(0, 0, 0); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 1.2) / 2.4, v = (p.getY(i) + 1.8) / 3.6; p.setZ(i, Math.sin(u * Math.PI) * (0.25 + 0.15 * v)); }
      g.rotateY(Math.PI / 2); g.translate(0, 0, -1.25); g.computeVertexNormals();
      const s = new THREE.Mesh(M().colorize(g, 0.96, 0.92, 0.84), MT.cloth); s.castShadow = true;
      const piv = new THREE.Group(); piv.position.set(c.x, (mast ? mast.y : c.y) * LEVEL + 3.0, c.z); piv.add(s); grp.add(piv);
      b.sails.push({ piv, mesh: s, ok: !!mast });
    }
    // lanterne: fiamma piccola
    b.lights = [];
    for (const c of pcs) if (c.t === 'torcia') { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.32).translate(0, 0.16, 0), G.flameMaterial()); f.position.set(c.x, c.y * LEVEL + 1.0, c.z); grp.add(f); b.lights.push(c); }
    b.fbMesh = grp; b.inner.add(grp);
    analyse(b);
  };

  /* ---------------- masse, spinte, statistiche ---------------- */
  function analyse(b) {
    const pcs = b.pcs || [];
    let M0 = 0, gx = 0, gy = 0, gz = 0, cap = 0, sail = 0, sailH = 0, oars = 0, helm = null, hullN = 0;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9, maxTop = -1e9;
    const samples = [], masses = [];
    for (const c of pcs) {
      const d = DEF[c.t]; if (!d) continue;
      const y0 = c.y * LEVEL, cy = d.mast ? y0 + 2.4 : d.sail ? y0 + 3 : y0 + Math.min(d.h, 0.5) / 2;
      masses.push({ x: c.x, y: cy, z: c.z, m: d.mass });
      M0 += d.mass; gx += c.x * d.mass; gy += cy * d.mass; gz += c.z * d.mass;
      if (d.vol > 0) {
        const hh = Math.min(d.h, 0.5);
        if (d.hull) { // 4 punti per pezzo di scafo: così il rollio "sente" la forma della barca
          for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) samples.push({ x: c.x + ox, z: c.z + oz, y0, y1: y0 + hh, vol: d.vol / 4, hull: true, top: !b.cells.has(key(c.x, c.y + 1, c.z)) && !b.cells.has(key(c.x, c.y + (d.h < 0.4 ? 1 : 1), c.z)) });
          hullN++;
        } else samples.push({ x: c.x, z: c.z, y0, y1: y0 + hh, vol: d.vol });
        cap += d.vol * RHO;
      }
      if (d.sail && pcs.some((o) => o.t === 'albero_barca' && o.x === c.x && o.z === c.z)) { sail += d.sail; sailH += (pcs.find((o) => o.t === 'albero_barca' && o.x === c.x && o.z === c.z).y * LEVEL + 3.0) * d.sail; }
      if (d.oar) oars++;
      if (d.helm) helm = c;
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); minY = Math.min(minY, y0);
      if (d.walk) maxTop = Math.max(maxTop, y0 + (c.t === 'ponte_barca' ? 0.12 : 0.5));
    }
    M0 = Math.max(M0, 1);
    b.fb = { M: M0, g: new V3(gx / M0, gy / M0, gz / M0), cap, sail, sailH: sail ? sailH / sail : 0, oars, helm, hullN, samples, masses, minX, maxX, minZ, maxZ, minY };
    // assetto di equilibrio in acqua ferma (per la scheda: pescaggio, stabilità)
    b.fb.draftY = equilibrium(b, M0);
    // inerzie di rollio e beccheggio attorno al baricentro
    let Ir = 0, Ip = 0; const g = b.fb.g;
    for (const m of masses) { Ir += m.m * ((m.x - g.x) ** 2 + (m.y - g.y) ** 2) + m.m * 0.08; Ip += m.m * ((m.z - g.z) ** 2 + (m.y - g.y) ** 2) + m.m * 0.08; }
    b.fb.Ir = Math.max(Ir, 30) * 1.6; b.fb.Ip = Math.max(Ip, 30) * 1.6; // con l'acqua che si sposta insieme allo scafo
    // stabilità iniziale (altezza metacentrica): sopra 0 sta dritta, sotto si ribalta
    const wl = b.fb.draftY; let Iwp = 0, A = 0, cx = 0;
    const cols = new Set(); for (const s of samples) if (s.hull && s.y0 <= wl && s.y1 >= wl - 0.01) cols.add(Math.round(s.x * 4) + ',' + Math.round(s.z * 4));
    for (const k of cols) { const x = +k.split(',')[0] / 4; A += 0.25; cx += x * 0.25; }
    cx = A ? cx / A : 0; for (const k of cols) { const x = +k.split(',')[0] / 4; Iwp += 0.25 * ((x - cx) ** 2 + 0.25 / 12); }
    const Vd = M0 / RHO, KB = (wl + minY) / 2, BM = Vd > 0 ? Iwp / Vd : 0;
    b.fb.GM = KB + BM - g.y;
    // inclinazione a riposo (acqua ferma): dove sta il peso rispetto al centro della spinta
    let bv = 0, bx = 0, bz = 0; for (const s of samples) { const v = s.vol * G.clamp((wl - s.y0) / (s.y1 - s.y0), 0, 1); bv += v; bx += s.x * v; bz += s.z * v; }
    if (bv > 0) { bx /= bv; bz /= bv; }
    const GMs = Math.max(0.05, b.fb.GM);
    let GL = 0; for (const s of samples) if (s.hull) GL += s.vol * (s.z - bz) ** 2; GL = Math.max(0.05, (bv ? GL * 4 / Math.max(Vd, 0.01) : 1) + KB - g.y);
    b.fb.heel = -Math.atan((g.x - bx) / GMs); b.fb.trim = Math.atan((g.z - bz) / GL);
    // la barca nel modello delle barche: guida, timone, ponte
    const T = b.T;
    T.L = Math.max(1, maxZ - minZ + 1); T.W = Math.max(1, maxX - minX + 1);
    T.sail = sail > 0; T.speed = 0; T.turn = helm ? 0.9 : 0.4; T.draft = Math.max(0.3, wl - minY); T.lift = 0;
    const hc = helm || pcs.find((o) => DEF[o.t].oar) || null;
    T.helm = hc ? [hc.x, hc.z + (helm ? -0.6 : 0)] : [1e6, 1e6]; T.helmTxt = helm ? 'Timone' : 'Remi';
    T.deck = FB.topAt(b, T.helm[0], T.helm[1]) || maxTop;
    T.seat = [hc ? hc.x : 0, T.deck + 1.5, hc ? hc.z - 3 : -3]; T.cam3 = Math.max(8, T.L * 1.3);
    if (b.helmMark) { b.inner.remove(b.helmMark); }
    if (G.Boats.helmMarker) { b.helmMark = G.Boats.helmMarker(T); b.inner.add(b.helmMark); }
    b.bbox = new THREE.Box3(new V3(minX - 0.6, minY - 0.1, minZ - 0.6), new V3(maxX + 0.6, Math.max(maxTop, minY + 0.5) + (sail ? 5 : 1), maxZ + 0.6));
  }
  // quota (locale) della linea di galleggiamento con la barca dritta in acqua ferma
  function equilibrium(b, mass) {
    const S = b.fb.samples; let lo = b.fb.minY - 1, hi = b.fb.minY + 6;
    const vol = (w) => { let v = 0; for (const s of S) v += s.vol * G.clamp((w - s.y0) / (s.y1 - s.y0), 0, 1); return v * RHO; };
    if (vol(hi) < mass) return hi; // troppo carica: affonda
    for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (vol(m) < mass) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  FB.stats = function (b) {
    const f = b.fb, rollDeg = Math.round((f.GM < 0 ? b.roll : f.heel) * 57.3), pitchDeg = Math.round(f.trim * 57.3);
    const load = (f.M + (b.flood || 0)) / Math.max(1, f.cap);
    const stab = f.GM < 0 ? 'si ribalta' : f.GM < 0.25 ? 'instabile' : f.GM < 0.7 ? 'discreta' : 'buona';
    const wind = G.Boats.wind.str || 0.4;
    const vSail = f.sail ? Math.min(13, 1.9 * Math.sqrt(f.sail * wind * 10 / Math.max(1.5, b.T.W * 0.9)) * Math.sqrt(1200 / Math.max(400, f.M)) ) : 0;
    const vOar = f.oars ? Math.min(5, 1.3 * Math.sqrt(f.oars * 90 / Math.max(1, f.M / 300))) : 0;
    return { mass: Math.round(f.M), cap: Math.round(f.cap), load, roll: rollDeg, pitch: pitchDeg, stab, GM: f.GM, knots: Math.round(Math.max(vSail * 0.7, vOar) * 1.94), vSail, sail: f.sail, oars: f.oars, helm: !!f.helm, flood: Math.round(b.flood || 0) };
  };

  /* ---------------- ponte calpestabile ---------------- */
  FB.topAt = function (b, x, z) {
    const cx = Math.round(x), cz = Math.round(z); let top = null;
    if (!b.pcs) return null;
    for (const c of b.pcs) if (c.x === cx && c.z === cz) { const d = DEF[c.t]; if (d.mast) return null; if (d.walk) { const t = c.y * LEVEL + (c.t === 'ponte_barca' ? 0.12 : d.h); if (top === null || t > top) top = t; } else if (top === null) top = c.y * LEVEL + 0.02; }
    return top;
  };

  // porta un punto locale sopra il pezzo calpestabile più vicino
  FB.snapOn = function (b, v) {
    let best = null, bd = 1e9;
    for (const c of b.pcs) { const top = FB.topAt(b, c.x, c.z); if (top === null) continue; const d = (c.x - v.x) ** 2 + (c.z - v.z) ** 2; if (d < bd) { bd = d; best = c; } }
    if (!best) { v.set(0, b.T.deck, 0); return; }
    if (bd > 0.2) { v.x = best.x; v.z = best.z; }
    v.y = FB.topAt(b, v.x, v.z) || b.T.deck;
  };
  /* ---------------- fisica ---------------- */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _gw = new V3(), _tw = new V3();
  FB.step = function (b, dt, t, input, driving) {
    const f = b.fb; if (!f) return;
    const T = b.T;
    if (b.sunk) { // sul fondo: resta lì
      const gy = G.heightAt(b.x, b.z) + 0.3; b.y += (gy - b.y - f.minY) * Math.min(1, dt * 0.4); b.root.position.set(b.x, b.y, b.z); return;
    }
    const steps = dt > 0.03 ? 2 : 1, h = dt / steps;
    for (let it = 0; it < steps; it++) {
      _e.set(b.pitch, b.yaw, b.roll, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(b.x, b.y, b.z), _q, _tw.set(1, 1, 1));
      const flood = b.flood || 0, Mt = f.M + flood;
      // baricentro (l'acqua imbarcata pesa in basso)
      const gl = _gw.copy(f.g).multiplyScalar(f.M); gl.y += (f.minY + 0.15) * flood; gl.divideScalar(Mt);
      const gW = gl.clone().applyMatrix4(_m);
      let F = 0, tx = 0, tz = 0, wetTops = 0, sub = 0;
      for (const s of f.samples) {
        _p.set(s.x, (s.y0 + s.y1) / 2, s.z).applyMatrix4(_m);
        const hh = s.y1 - s.y0, wh = G.waveHeight(_p.x, _p.z, t);
        const fr = G.clamp((wh - (_p.y - hh / 2)) / hh, 0, 1);
        if (fr <= 0) continue;
        const Fi = RHO * s.vol * fr; F += Fi; sub += fr;
        const rx = _p.x - gW.x, rz = _p.z - gW.z;
        tx += -rz * Fi; tz += rx * Fi; // momento della spinta (verticale) attorno al baricentro
        // acqua sopra il bordo: entra. Se la barca è troppo bassa sull'acqua ferma entra tanta acqua; le onde che scavalcano il bordo ne portano poca
        const topY = _p.y + hh / 2;
        if (s.top && fr >= 1) { if (G.SEA > topY + 0.03) wetTops += s.vol; else if (wh > topY + 0.35) wetTops += s.vol * 0.12; }
      }
      // vento sulla vela: spinge di lato in alto → sbandamento
      let sailTq = 0;
      if (f.sail && !b.flip) {
        const wd = G.Climate ? G.Climate.windDirAt(b.x, b.z) : G.Boats.wind.dir, ws = G.Boats.wind.str;
        const rel = Math.sin(wd - b.yaw); // >0: vento da sinistra
        const side = f.sail * ws * ws * 14 * rel * (driving || b.sailsUp ? 1 : 0.15);
        sailTq = -side * Math.max(0.5, f.sailH - gl.y); // il vento da sinistra la fa pendere a destra (kgf·m)
      }
      // momenti sugli assi della barca: rollio attorno alla prua (sin yaw, cos yaw), beccheggio attorno alla destra (cos yaw, −sin yaw)
      const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
      const tFwd = tx * sy + tz * cy, tRight = tx * cy - tz * sy;
      // in three.js il rollio è una rotazione attorno all'asse z locale (prua), il beccheggio attorno a x locale (destra)
      const aRoll = 9.81 * (tFwd + sailTq) / f.Ir, aPitch = 9.81 * tRight / f.Ip;
      // smorzamento dell'acqua: più la barca è immersa, più frena i dondolii
      const wk = Math.min(1, sub / Math.max(1, f.samples.length * 0.3));
      b.vroll = ((b.vroll || 0) + aRoll * h) * Math.exp(-h * (1.5 + 4.5 * wk));
      b.vpitch = ((b.vpitch || 0) + aPitch * h) * Math.exp(-h * (2 + 5 * wk));
      b.roll += b.vroll * h; b.pitch += b.vpitch * h;
      b.pitch = G.clamp(b.pitch, -0.7, 0.7);
      // sù e giù
      const ay = 9.81 * (F - Mt) / (Mt * 1.4);
      b.vy = ((b.vy || 0) + ay * h) * Math.exp(-h * (1.5 + 3 * wk));
      b.y += b.vy * h;
      // acqua imbarcata: entra dai bordi sotto l'onda, esce piano (si sgottta) se la barca torna su
      if (b.flip) { /* capovolta: l'acqua dentro non conta più */ } else if (wetTops > 0) b.flood = flood + wetTops * 350 * h; else if (flood > 0) b.flood = Math.max(0, flood - 45 * h); // l'equipaggio sgotta
    }
    // ribaltata?
    if (!b.flip && Math.abs(b.roll) > 1.35) { b.flip = Math.sign(b.roll); FB.onCapsize(b); }
    if (b.flip) { b.roll += (b.flip * Math.PI * 0.94 - b.roll) * Math.min(1, dt * 1.2); b.vroll = 0; }
    // affondata?
    if (!b.sunk && (b.flood || 0) + f.M > f.cap * 0.995 && b.y + f.minY + 0.5 < G.waveHeight(b.x, b.z, t) - 1.2) { b.sunk = true; FB.onSink(b); }
    // avanti: vela e remi; il timone fa girare
    let target = 0;
    const st = FB.stats(b), heelK = Math.max(0.2, Math.cos(b.roll) ** 2), loadK = G.clamp(1.6 - st.load, 0.2, 1);
    if (driving && !b.flip) {
      const vSail = f.sail ? st.vSail * G.Boats.windFactor(b) / Math.max(0.3, Math.min(1.35, G.Boats.wind.str * 1.6)) : 0;
      const vOar = f.oars ? Math.min(5, 1.3 * Math.sqrt(f.oars * 90 / Math.max(1, f.M / 300))) : 0;
      b.sailsUp = input.f > 0 && f.sail;
      if (input.f > 0) target = Math.max(f.sail ? vSail : 0, vOar) * heelK * loadK;
      else if (input.f < 0) target = -(vOar || 0.8) * 0.4;
      b.rudder += (input.t - b.rudder) * Math.min(1, dt * 3);
      const turn = (f.helm ? 0.9 : 0.5) * (0.25 + Math.min(Math.abs(b.speed) / 5, 1));
      b.yaw += b.rudder * turn * dt * Math.sign(b.speed || 1) * (6 / Math.max(3, T.L));
    } else { b.sailsUp = false; b.rudder *= 0.9; }
    const accel = 1.2 / Math.sqrt(Math.max(0.3, f.M / 1000));
    b.speed += (target - b.speed) * Math.min(1, dt * (target ? accel * 0.35 : 0.5));
    // le vele si girano col vento
    if (b.sails) { const wd = G.Climate ? G.Climate.windDirAt(b.x, b.z) : G.Boats.wind.dir; let a = G.angleDiff(b.yaw + Math.PI, wd); a = G.clamp(a, -1.2, 1.2); for (const s of b.sails) { s.piv.rotation.y += (a - s.piv.rotation.y) * Math.min(1, dt * 2); s.mesh.scale.set(1, b.sailsUp ? 1 : 0.35, 1); s.mesh.position.y = b.sailsUp ? 0 : 1.1; } }
  };
  FB.onCapsize = function (b) {
    if (G.Player.boat === b) { G.UI.toast('La barca si è ribaltata! Era troppo alta o sbilanciata. Dall’acqua, ' + G.useHow() + ' sullo scafo per raddrizzarla', 'warn'); G.Player.jumpOverboard(Math.sign(b.roll) || 1); }
    if (G.Audio) G.Audio.splash();
  };
  FB.onSink = function (b) {
    if (G.Player.boat === b) { G.UI.toast('La barca è affondata: era troppo carica. Ciò che c’era nel baule resta sul fondo', 'warn'); G.Player.jumpOverboard(1); }
    else if (Math.hypot(G.Player.pos.x - b.x, G.Player.pos.z - b.z) < 80) G.UI.toast('Una barca è affondata', 'warn');
    G.saveSoon && G.saveSoon();
  };
  FB.right = function (b) {
    if (b.sunk) { G.UI.toast('È affondata: non si può più raddrizzare', 'warn'); return; }
    b.flip = 0; b.roll = 0; b.vroll = 0; b.flood = 0; G.UI.toast('Barca raddrizzata', 'good'); if (G.Audio) G.Audio.splash();
    FB.send(b);
  };

  /* ---------------- costruire e smontare ---------------- */
  const _inv = new THREE.Matrix4(), _o = new V3(), _d = new V3();
  // cella colpita dal mirino (coordinate locali della barca) e faccia
  FB.rayCell = function (b, o, d, max) {
    b.root.updateMatrixWorld(true); _inv.copy(b.inner.matrixWorld).invert();
    _o.copy(o).applyMatrix4(_inv); _d.copy(d).transformDirection(_inv);
    let best = null, bt = max;
    for (const c of b.pcs) {
      const y0 = c.y * LEVEL, h = DEF[c.t].mast ? DEF[c.t].h : Math.max(0.12, Math.min(DEF[c.t].h, 0.5)), w = DEF[c.t].mast ? 0.25 : 0.5;
      const r = G.Build.rayBox(_o, _d, { x0: c.x - w, x1: c.x + w, y0, y1: y0 + h, z0: c.z - w, z1: c.z + w });
      if (r >= 0 && r < bt) { bt = r; best = c; }
    }
    if (!best) return null;
    const hp = _o.clone().addScaledVector(_d, bt), y0 = best.y * LEVEL, h = DEF[best.t].mast ? DEF[best.t].h : Math.max(0.12, Math.min(DEF[best.t].h, 0.5));
    // faccia: la più vicina al punto colpito
    const fc = [[Math.abs(hp.x - (best.x + 0.5)), 1, 0, 0], [Math.abs(hp.x - (best.x - 0.5)), -1, 0, 0], [Math.abs(hp.z - (best.z + 0.5)), 0, 0, 1], [Math.abs(hp.z - (best.z - 0.5)), 0, 0, -1], [Math.abs(hp.y - (y0 + h)), 0, 1, 0], [Math.abs(hp.y - y0), 0, -1, 0]].sort((a, c) => a[0] - c[0])[0];
    return { cell: best, n: [fc[1], fc[2], fc[3]], t: bt };
  };
  // dove andrebbe il pezzo che hai in mano
  FB.target = function (P, id) {
    const o = P.cam.position, d = P.lookDir(new V3());
    let best = null;
    for (const b of G.Boats.list) {
      if (!b.free || b.sunk || b.flip) continue;
      if (Math.hypot(b.x - o.x, b.z - o.z) > 12 + b.T.L) continue;
      const r = FB.rayCell(b, o, d, 7); if (!r || (best && best.t < r.t)) continue;
      const c = r.cell, D = DEF[id];
      let nx = c.x + r.n[0], ny = c.y + r.n[1] * (r.n[1] > 0 ? (DEF[c.t].h >= 0.45 ? 1 : 1) : 1), nz = c.z + r.n[2];
      // pezzi che stanno sopra: si appoggiano sulla faccia superiore
      if (!D.hull && id !== 'zavorra' && r.n[1] === 0) { nx = c.x; nz = c.z; ny = c.y + 1; }
      if (id === 'vela') { // va sull'albero
        const mast = b.pcs.find((m) => m.t === 'albero_barca' && m.x === c.x && m.z === c.z);
        if (!mast) { best = { b, ok: false, reason: 'La vela va montata su un albero: mira l’albero', t: r.t, x: nx, y: ny, z: nz }; continue; }
        nx = mast.x; nz = mast.z; ny = mast.y + 1;
        if (b.pcs.some((m) => m.t === 'vela' && m.x === nx && m.z === nz)) { best = { b, ok: false, reason: 'Quest’albero ha già la vela', t: r.t, x: nx, y: ny, z: nz }; continue; }
      }
      const occ = b.cells.has(key(nx, ny, nz)) || (id !== 'vela' && b.pcs.some((m) => DEF[m.t].mast && m.x === nx && m.z === nz && m.y < ny));
      best = { b, ok: !occ && b.pcs.length < 400, reason: occ ? 'Spazio occupato' : 'Barca troppo grande', t: r.t, x: nx, y: ny, z: nz };
    }
    if (best) return best;
    // nessuna barca: il primo pezzo di fasciame (o di ponte) sul mare ne crea una nuova
    if (!(id === 'fasciame' || id === 'ponte_barca')) return null;
    if (d.y > -0.02) return null;
    const t = (G.SEA - o.y) / d.y; if (t > 9) return null;
    const th = G.Build.terrainHit(o, d, t); if (th >= 0 && th < t - 0.05) return null; // c'è terra prima del mare
    const x = o.x + d.x * t, z = o.z + d.z * t;
    const deep = G.heightAt(x, z) < -1.2;
    return { b: null, ok: deep, reason: 'Qui l’acqua è troppo bassa: allontanati un po’ dalla riva', x, z, wy: G.waveHeight(x, z, G.time), t };
  };
  let ghost = null;
  FB.updateGhost = function (P) {
    const it = P.held(), id = it ? it.id : null;
    const show = id && DEF[id] && !P.placing && !(G.UI.open) && !(P.boat && P.helm);
    const tg = show ? FB.target(P, id) : null;
    FB.cur = tg ? Object.assign({ id }, tg) : null;
    FB.hud(P);
    if (!tg) { if (ghost) ghost.visible = false; return null; }
    if (!ghost) { ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1).translate(0, 0.25, 0), G.Boats.ghostOk); ghost.renderOrder = 7; G.scene.add(ghost); }
    ghost.visible = true; ghost.material = tg.ok ? G.Boats.ghostOk : G.Boats.ghostBad;
    const hh = Math.max(0.12, Math.min(DEF[id].h, 0.5)); ghost.scale.set(1, hh / 0.5, 1);
    if (tg.b) { tg.b.root.updateMatrixWorld(true); ghost.position.set(tg.x, tg.y * LEVEL, tg.z).applyMatrix4(tg.b.inner.matrixWorld); ghost.quaternion.setFromRotationMatrix(tg.b.inner.matrixWorld); }
    else { ghost.position.set(tg.x, tg.wy - 0.25, tg.z); ghost.rotation.set(0, P.yaw, 0); }
    return tg;
  };
  // scheda della barca (peso, portata, inclinazione, stabilità) mentre la costruisci o ci sei sopra
  let hudT = 0;
  FB.hud = function (P) {
    const el = document.getElementById('fbstats'); if (!el) return;
    const b = (FB.cur && FB.cur.b) || (P.boat && P.boat.free && !P.helm ? P.boat : null);
    if (!b || G.UI.open || G.UI.menu) { if (!el.hidden) el.hidden = true; if (FB._hintsHidden) { FB._hintsHidden = false; const hi = document.getElementById('hints'); if (hi) hi.style.visibility = ''; } return; }
    if ((hudT -= 1) > 0 && !el.hidden) return; hudT = 10;
    const st = FB.stats(b), w = [];
    const side = st.roll > 0 ? 'sinistra' : 'destra', other = st.roll > 0 ? 'destra' : 'sinistra';
    if (b.flip) w.push('Ribaltata: dall’acqua, ' + G.useHow() + ' sullo scafo per raddrizzarla');
    else if (b.sunk) w.push('Affondata');
    else {
      if (st.load > 0.85) w.push('Troppo carica: rischia di affondare. Aggiungi fasciame o togli peso');
      if (st.GM < 0.25) w.push('Instabile: allarga lo scafo o metti zavorra in basso');
      if (Math.abs(st.roll) >= 4) w.push(`Pende di ${Math.abs(st.roll)}° a ${side}: sposta peso verso ${other}`);
      if (!st.sail && !st.oars) w.push('Senza vela né remi galleggia ma non va avanti');
      if (!st.helm) w.push(st.oars ? 'Senza timone si gira solo coi remi' : 'Serve un timone per guidarla');
      if (st.flood > 20) w.push(`Ha imbarcato ${st.flood} kg d’acqua`);
    }
    const bar = (v, col) => `<i style="width:${Math.round(G.clamp(v, 0, 1) * 100)}%;background:${col}"></i>`;
    const stabK = st.GM < 0 ? 0.05 : G.clamp(st.GM / 1.2, 0.1, 1), stabCol = st.GM < 0.25 ? 'var(--coral)' : st.GM < 0.7 ? 'var(--brass-hi)' : 'var(--kelp)';
    el.innerHTML = `<div class="fbt">Barca libera <small>${b.pcs.length} pezzi</small></div>
      <div class="fbr"><span>Peso</span><b>${st.mass.toLocaleString('it-IT')} kg</b></div><div class="fbb">${bar(st.load, st.load > 0.85 ? 'var(--coral)' : 'var(--brass)')}</div>
      <div class="fbr"><span>Può portare fino a</span><b>${st.cap.toLocaleString('it-IT')} kg</b></div>
      <div class="fbr"><span>Pende</span><b>${Math.abs(st.roll)}°${Math.abs(st.roll) >= 1 ? ' a ' + side : ''}</b></div><div class="fbb">${bar(Math.abs(st.roll) / 30, Math.abs(st.roll) > 12 ? 'var(--coral)' : 'var(--brass-hi)')}</div>
      <div class="fbr"><span>Prua / poppa</span><b>${Math.abs(st.pitch)}°${Math.abs(st.pitch) >= 1 ? (st.pitch > 0 ? ' giù di prua' : ' giù di poppa') : ''}</b></div>
      <div class="fbr"><span>Stabilità</span><b>${st.stab}</b></div><div class="fbb">${bar(stabK, stabCol)}</div>
      <div class="fbr"><span>Velocità col vento</span><b>${st.knots ? '≈ ' + st.knots + ' nodi' : '—'}</b></div>
      ${w.length ? `<div class="fbw">${w.slice(0, 3).join('<br>')}</div>` : ''}`;
    el.hidden = false;
    const hi = document.getElementById('hints'); if (hi) hi.style.visibility = 'hidden'; FB._hintsHidden = true;
  };
  FB.tryPlace = function (P) {
    const tg = FB.cur; if (!tg) return false;
    if (!tg.ok) { G.UI.toast(tg.reason, 'warn'); return true; }
    const id = tg.id;
    if (!G.creative() && P.count(id) < 1) return false;
    P.take(id, 1);
    if (!tg.b) {
      const b = G.Boats.create({ tpl: 'libera', x: tg.x, z: tg.z, yaw: P.yaw + Math.PI, pcs: [{ t: id, x: 0, y: 0, z: 0 }] });
      b.y = tg.wy - 0.2;
      if (G.Net && G.Net.on) G.Net.send({ t: 'bnew', b: G.Boats.serializeOne(b) });
      if (!FB._tip) { FB._tip = 1; G.UI.toast('Barca libera iniziata! Aggiungi fasciame per allargarla, poi timone, albero e vela. Clic sinistro su un pezzo per toglierlo', 'good'); }
    } else {
      tg.b.pcs.push({ t: id, x: tg.x, y: tg.y, z: tg.z });
      FB.rebuild(tg.b); FB.send(tg.b);
    }
    if (G.Audio) G.Audio.place();
    G.saveSoon && G.saveSoon();
    return true;
  };
  // colpo su un pezzo: due colpi e torna nell'inventario
  FB.hit = function (P, b) {
    const r = FB.rayCell(b, P.cam.position, P.lookDir(new V3()), 6); if (!r) return false;
    const c = r.cell;
    c.hp = (c.hp === undefined ? 2 : c.hp) - 1;
    if (G.Audio) G.Audio.hit('wood');
    if (c.hp > 0) return true;
    // non si toglie il pezzo che regge gli altri (sopra) né l'ultimo se c'è qualcuno a bordo
    if (b.pcs.some((o) => o !== c && o.x === c.x && o.z === c.z && o.y > c.y)) { c.hp = 1; G.UI.toast('Prima togli i pezzi che ci sono sopra', 'warn'); return true; }
    b.pcs.splice(b.pcs.indexOf(c), 1);
    P.give(c.t, 1);
    if (!b.pcs.length) { G.Boats.remove(b); if (G.Net && G.Net.on) G.Net.send({ t: 'bdelboat', id: b.id }); }
    else { FB.rebuild(b); FB.send(b); }
    G.saveSoon && G.saveSoon();
    return true;
  };
  FB.send = function (b) { if (G.Net && G.Net.on) G.Net.send({ t: 'bpcs', id: b.id, pcs: b.pcs.map(({ t, x, y, z }) => ({ t, x, y, z })), flip: b.flip || 0, sunk: b.sunk ? 1 : 0 }); };
  FB.onRemote = function (m) {
    const b = G.Boats.byId(m.id); if (!b || !b.free) return;
    b.pcs = m.pcs; b.flip = m.flip || 0; if (!b.flip) b.roll = 0; b.sunk = !!m.sunk; FB.rebuild(b);
  };
})();
