'use strict';
/* ==========================================================
   Luoghi da scoprire (deterministici, uguali per tutti):
   villaggi per bioma, fari, relitti, covi dei pirati, tesori.
   Solo dati: niente Three.js (lo usa anche il server).
   ========================================================== */
(function () {
  const G = globalThis.G;
  const P = (G.POI = { cache: new Map(), tcache: new Map(), byIdMap: new Map() });
  const REG = (P.REG = 384), TREG = (P.TREG = 256);
  P.reset = function () { P.cache.clear(); P.tcache.clear(); P.byIdMap.clear(); };

  const hashR = (P._hashR = (a, b, s) => { let h = (a * 73856093) ^ (b * 19349663) ^ (s * 83492791) ^ (G.seed | 0); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; });
  const flatOK = (x, z, r, n) => { let ok = 0; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; if (G.normalAt(x + Math.cos(a) * r, z + Math.sin(a) * r)[1] > 0.9) ok++; } return ok / n; };

  /* ---------- nomi ---------- */
  const NAMES = {
    coloniale: [['San', 'Santa', 'Puerto', 'Villa', 'Porto'], ['Rosario', 'Esperanza', 'Cruz', 'Marina', 'del Sol', 'Lucía', 'Domingo', 'Real', 'Dorado']],
    alberi: [['Kai', 'Ula', 'Tama', 'Nalu', 'Moana', 'Riki'], ['hoa', 'kani', 'lapa', 'nui', 'roa', 'mahi']],
    palafitte: [['Isola', 'Riva', 'Canneto', 'Laguna'], ['Verde', 'delle Rane', 'Umida', 'dei Fiori', 'Nebbiosa']],
    fattoria: [['Campo', 'Prato', 'Borgo', 'Casale'], ['Fiorito', 'Lungo', 'del Mulino', 'Dorato', 'Ventoso']],
    baite: [['Pino', 'Bosco', 'Valle', 'Rifugio'], ['Alto', 'Scuro', 'del Cervo', 'Muschiato', 'Quieto']],
    pietra: [['Rocca', 'Monte', 'Picco', 'Forte'], ['Grigia', 'del Falco', 'Nevosa', 'Antica', 'del Vento']],
  };
  function mkName(style, rnd) { const [a, b] = NAMES[style]; const x = a[(rnd() * a.length) | 0], y = b[(rnd() * b.length) | 0]; return style === 'alberi' ? x + y : x + ' ' + y; }
  const STYLE = ['fattoria', 'baite', 'palafitte', 'alberi', 'coloniale', 'pietra', 'baite', 'pietra'];
  P.STYLE_N = { coloniale: 'cittadina coloniale', alberi: 'villaggio sugli alberi', palafitte: 'villaggio su palafitte', fattoria: 'borgo agricolo', baite: 'villaggio di baite', pietra: 'borgo di pietra' };
  const LIGHT_N = ['Capo', 'Punta', 'Scoglio'], LIGHT_N2 = ['Nero', 'delle Sirene', 'del Naufrago', 'Bianco', 'dei Gabbiani', 'Tempesta'];
  const SHIP_N = ['La Sirena', 'Il Delfino', 'San Telmo', 'La Fortuna', 'Il Grifone', 'La Speranza', 'Il Corsaro', 'La Medusa'];

  /* ---------- luoghi di una regione ---------- */
  P.region = function (rx, rz) {
    const key = rx + ',' + rz;
    let r = P.cache.get(key); if (r) return r;
    r = [];
    const rnd = G.mulberry32(hashR(rx, rz, 7));
    const x0 = rx * REG, z0 = rz * REG;
    const home = Math.hypot(x0 + REG / 2, z0 + REG / 2) < 260;
    const roll = rnd();
    // villaggi molto più frequenti: in ogni regione di terra c'è quasi sempre un villaggio
    const nearHome = Math.hypot(x0 + REG / 2, z0 + REG / 2) < 650; // attorno al punto di partenza c'è sempre un villaggio da scoprire
    const landType = home || nearHome ? (roll < 0.85 ? 'village' : 'faro') : roll < 0.74 ? 'village' : roll < 0.85 ? 'faro' : roll < 0.95 ? 'covo' : null;
    const pick = (landType, avoid) => {
      let best = null, bs = -1;
      for (let i = 0; i < 70; i++) {
        const x = x0 + 50 + rnd() * (REG - 100), z = z0 + 50 + rnd() * (REG - 100), h = G.heightAt(x, z);
        if (Math.hypot(x, z) < 170) continue;
        if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 170) continue;
        let score = -1;
        if (landType === 'village') {
          if (h < 2.0 || h > 18) continue;
          const f = flatOK(x, z, 14, 8); if (f < 0.5) continue;
          let land = 0; for (let k = 0; k < 8; k++) { const a = k * 0.785; if (G.heightAt(x + Math.cos(a) * 30, z + Math.sin(a) * 30) > 1.2) land++; }
          if (land < 5) continue;
          let coast = 0; for (let k = 0; k < 12; k++) { const a = k * 0.5236; if (G.heightAt(x + Math.cos(a) * 62, z + Math.sin(a) * 62) < -1) coast = 1; }
          score = f + coast * 0.6 + land * 0.05;
        } else if (landType === 'faro') {
          if (h < 3 || h > 18 || G.normalAt(x, z)[1] < 0.82) continue;
          let deep = 0; for (let k = 0; k < 10; k++) { const a = k * 0.628; if (G.heightAt(x + Math.cos(a) * 22, z + Math.sin(a) * 22) < -2.5) deep++; }
          if (!deep) continue; score = deep + h * 0.05;
        } else {
          if (h < 0.9 || h > 2.8 || G.normalAt(x, z)[1] < 0.92) continue;
          let sea = 0; for (let k = 0; k < 8; k++) { const a = k * 0.785; if (G.heightAt(x + Math.cos(a) * 26, z + Math.sin(a) * 26) < -0.8) sea++; }
          if (!sea || sea > 5) continue; score = flatOK(x, z, 8, 6) + 0.2;
        }
        if (score > bs) { bs = score; best = { x, z, h }; }
      }
      return best;
    };
    const mkVillage = (best, id) => { const b = G.biomeAt(best.x, best.z), style = STYLE[b]; return { id, type: 'village', x: best.x, z: best.z, h: best.h, biome: b, style, inhabited: rnd() < 0.68, name: mkName(style, rnd), seed: (rnd() * 1e9) | 0 }; };
    if (landType) {
      const best = pick(landType);
      if (best) {
        const b = G.biomeAt(best.x, best.z);
        if (landType === 'village') {
          r.push(mkVillage(best, `v:${rx}:${rz}`));
          // a volte un secondo borgo nella stessa regione
          if (rnd() < 0.4) { const b2 = pick('village', best); if (b2) r.push(mkVillage(b2, `v:${rx}:${rz}:b`)); }
        } else if (landType === 'faro') {
          r.push({ id: `f:${rx}:${rz}`, type: 'faro', x: best.x, z: best.z, h: best.h, biome: b, name: 'Faro di ' + LIGHT_N[(rnd() * 3) | 0] + ' ' + LIGHT_N2[(rnd() * LIGHT_N2.length) | 0], seed: (rnd() * 1e9) | 0 });
        } else {
          r.push({ id: `k:${rx}:${rz}`, type: 'covo', x: best.x, z: best.z, h: best.h, biome: b, name: 'Covo dei pirati', seed: (rnd() * 1e9) | 0, pirates: 3 + ((rnd() * 3) | 0) });
        }
      }
    } else { rnd(); }
    // strutture abbandonate con bottino: rovine sulle colline, miniere nelle montagne, accampamenti
    if (!home && rnd() < 0.62) {
      const roll2 = rnd();
      const kind = roll2 < 0.38 ? 'rovina' : roll2 < 0.68 ? 'miniera' : 'accampamento';
      let best = null, bs = -1;
      for (let i = 0; i < 50; i++) {
        const x = x0 + 40 + rnd() * (REG - 80), z = z0 + 40 + rnd() * (REG - 80), h = G.heightAt(x, z);
        if (Math.hypot(x, z) < 220) continue;
        if (r.some((q) => Math.hypot(q.x - x, q.z - z) < 90)) continue;
        if (G.biomeAt(x, z) === G.BIOME.VULCANO || (G.lakeLevelAt && G.lakeLevelAt(x, z) !== null)) continue;
        let score = -1, extra = null;
        if (kind === 'miniera') {
          if (h < 5 || h > 40) continue;
          const n = G.normalAt(x, z); if (n[1] > 0.86 || n[1] < 0.45) continue;
          // l'ingresso guarda a valle; dentro c'è la montagna per almeno 20 m
          const dir = Math.atan2(n[0], n[2]);
          let inside = 0; for (let d = 4; d <= 24; d += 4) if (G.heightAt(x - Math.sin(dir) * d, z - Math.cos(dir) * d) > h + 2.5 + d * 0.15) inside++;
          if (inside < 5) continue;
          const front = G.heightAt(x + Math.sin(dir) * 4, z + Math.cos(dir) * 4); if (front < 1.2) continue;
          score = inside + (1 - n[1]); extra = { dir };
        } else if (kind === 'rovina') {
          if (h < 4 || h > 30) continue;
          const f = flatOK(x, z, 12, 8); if (f < 0.45) continue;
          score = f + h * 0.02;
        } else {
          if (h < 2.5 || h > 16) continue;
          const f = flatOK(x, z, 9, 6); if (f < 0.6) continue;
          score = f;
        }
        if (score > bs) { bs = score; best = Object.assign({ x, z, h }, extra); }
      }
      if (best) {
        const N = { rovina: ['Rovine di ', ['San Teodoro', 'Torre Vecchia', 'Castel Muto', 'Santa Rufina', 'Monte Corvo', 'Valdiluce']], miniera: ['Miniera ', ['del Carbonaio', 'della Vena Nera', 'di Sant’Agata', 'dei Sette Pozzi', 'del Lupo']], accampamento: ['Accampamento ', ['dei Naufraghi', 'abbandonato', 'dei Cacciatori', 'del Cartografo']] }[kind];
        r.push(Object.assign({ id: `${kind[0] === 'a' ? 'q' : kind[0]}:${rx}:${rz}`, type: kind, name: N[0] + N[1][(rnd() * N[1].length) | 0], seed: (rnd() * 1e9) | 0 }, best));
      }
    } else { rnd(); }
    // relitto sul fondale
    if (rnd() < 0.42) {
      for (let i = 0; i < 30; i++) {
        const x = x0 + 30 + rnd() * (REG - 60), z = z0 + 30 + rnd() * (REG - 60), h = G.heightAt(x, z);
        if (h > -6 || h < -24 || G.normalAt(x, z)[1] < 0.9) continue;
        const ship = SHIP_N[(rnd() * SHIP_N.length) | 0];
        r.push({ id: `w:${rx}:${rz}`, type: 'relitto', x, z, h, yaw: rnd() * 6.283, roll: (rnd() - 0.5) * 0.7, name: 'Relitto: ' + ship, ship, seed: (rnd() * 1e9) | 0 });
        break;
      }
    }
    // castello: solo in cima alle montagne alte (il sito e l'altopiano li decide il generatore del terreno)
    if (G.castleSites) for (const C of G.castleSites(x0, z0, REG)) {
      const cr = G.mulberry32(hashR(rx, rz, 13));
      for (let k = r.length - 1; k >= 0; k--) if (r[k].type !== 'relitto' && Math.hypot(r[k].x - C.x, r[k].z - C.z) < 150) r.splice(k, 1);
      const CN = ['Corvonero', 'Roccascura', 'Montenebbia', 'Pietralunga', 'Valfosca', 'Torrenera', 'Altamura', 'Nidodaquila'];
      r.push({ id: `x:${rx}:${rz}`, type: 'castello', x: C.x, z: C.z, h: C.level, name: 'Castello di ' + CN[(cr() * CN.length) | 0], seed: (cr() * 1e9) | 0, rotR: C.rotR });
    }
    for (const p of r) P.byIdMap.set(p.id, p);
    P.cache.set(key, r);
    return r;
  };
  P.near = function (x, z, rad, type) {
    const out = [];
    const r0x = Math.floor((x - rad) / REG), r1x = Math.floor((x + rad) / REG), r0z = Math.floor((z - rad) / REG), r1z = Math.floor((z + rad) / REG);
    for (let rz = r0z; rz <= r1z; rz++) for (let rx = r0x; rx <= r1x; rx++) for (const p of P.region(rx, rz)) {
      if (type && p.type !== type) continue;
      if (Math.hypot(p.x - x, p.z - z) <= rad) out.push(p);
    }
    return out;
  };
  P.byId = function (id) {
    let p = P.byIdMap.get(id); if (p) return p;
    const m = /^[a-z]:(-?\d+):(-?\d+)/.exec(id); if (!m) return null;
    if (id[0] === 't') { P.treasureCell(+m[1], +m[2]); return P.byIdMap.get(id) || null; }
    P.region(+m[1], +m[2]); return P.byIdMap.get(id) || null;
  };
  P.inChunk = function (cx, cz) {
    const x = (cx + 0.5) * G.CHUNK, z = (cz + 0.5) * G.CHUNK;
    return P.near(x, z, G.CHUNK).filter((p) => Math.floor(p.x / G.CHUNK) === cx && Math.floor(p.z / G.CHUNK) === cz);
  };

  /* ---------- punti del tesoro (uno per cella da 256 m) ---------- */
  P.treasureCell = function (tx, tz) {
    const key = tx + ',' + tz;
    if (P.tcache.has(key)) return P.tcache.get(key);
    const rnd = G.mulberry32(hashR(tx, tz, 31));
    let t = null;
    for (let i = 0; i < 24; i++) {
      const x = tx * TREG + 20 + rnd() * (TREG - 40), z = tz * TREG + 20 + rnd() * (TREG - 40), h = G.heightAt(x, z);
      if (h < 1.2 || h > 10 || G.normalAt(x, z)[1] < 0.9 || Math.hypot(x, z) < 150) continue;
      t = { id: `t:${tx}:${tz}`, type: 'tesoro', x, z, h, seed: (rnd() * 1e9) | 0, name: 'Tesoro sepolto' };
      break;
    }
    if (t) P.byIdMap.set(t.id, t);
    P.tcache.set(key, t);
    return t;
  };
  P.treasuresNear = function (x, z, rad) {
    const out = [];
    for (let tz = Math.floor((z - rad) / TREG); tz <= Math.floor((z + rad) / TREG); tz++) for (let tx = Math.floor((x - rad) / TREG); tx <= Math.floor((x + rad) / TREG); tx++) {
      const t = P.treasureCell(tx, tz); if (t && Math.hypot(t.x - x, t.z - z) <= rad) out.push(t);
    }
    return out;
  };

  /* ==========================================================
     PIANTA DEL VILLAGGIO
     edifici: { kind, x, z, w, d, rot (multipli di 90°), y (pavimento), wallH, roof, stilts, ruin }
     il lato "fronte" (porta) è +z locale
     ========================================================== */
  const CAT = {
    coloniale: { inn: [10, 8, 4.4, 'piatto'], house: [[6, 6, 3.6, 'coppi'], [7, 5, 3.6, 'piatto'], [5, 5, 3.4, 'coppi'], [6, 5, 6.6, 'piatto']], n: [7, 9] },
    alberi: { inn: [10, 6, 3.2, 'paglia'], house: [[6, 6, 0, 'albero']], n: [5, 7] },
    palafitte: { inn: [9, 6, 3.0, 'paglia'], house: [[5, 5, 2.8, 'paglia'], [6, 4, 2.8, 'paglia']], n: [6, 8], stilts: 2.2 },
    fattoria: { inn: [10, 7, 3.4, 'paglia'], house: [[7, 6, 3.0, 'paglia'], [9, 7, 4.2, 'fienile'], [6, 5, 3.0, 'paglia'], [4, 4, 7, 'mulino']], n: [6, 8] },
    baite: { inn: [10, 7, 3.2, 'scandole'], house: [[6, 5, 2.9, 'scandole'], [5, 5, 2.9, 'scandole'], [3, 3, 8, 'torretta']], n: [6, 8] },
    pietra: { inn: [9, 7, 3.4, 'ardesia'], house: [[6, 5, 3.0, 'ardesia'], [5, 5, 3.0, 'ardesia'], [4, 4, 11, 'torre']], n: [6, 8] },
  };
  const FIRST = ['Marta', 'Elio', 'Rosa', 'Tito', 'Nina', 'Aldo', 'Lia', 'Gino', 'Vera', 'Ugo', 'Ada', 'Carlo', 'Iris', 'Bruno', 'Elsa', 'Remo', 'Dora', 'Pio', 'Sofia', 'Leo'];
  const LAST = ['il pescatore', 'la tessitrice', 'il vecchio', 'la contadina', 'il carpentiere', 'la cuoca', 'il cacciatore', 'la vedetta', 'lo smemorato', 'la guaritrice'];
  P.layout = function (v) {
    if (v.L) return v.L;
    const rnd = G.mulberry32(v.seed);
    const C = CAT[v.style];
    const L = { buildings: [], props: [], chests: [], npcs: [], beds: [], dock: null, trees: [], bridges: [], clearR: 40 };
    const cx = v.x, cz = v.z;
    const hAt = (x, z) => G.heightAt(x, z);
    const occupied = [];
    const overlaps = (x, z, w, d, pad) => occupied.some((o) => Math.abs(o.x - x) < (o.w + w) / 2 + pad && Math.abs(o.z - z) < (o.d + d) / 2 + pad);
    const tryPlace = (spec, dmin, dmax, kind, tries) => {
      for (let t = 0; t < (tries || 40); t++) {
        const a = rnd() * 6.283, dd = dmin + rnd() * (dmax - dmin);
        const x = cx + Math.cos(a) * dd, z = cz + Math.sin(a) * dd;
        const q = Math.round(Math.atan2(cx - x, cz - z) / (Math.PI / 2)) & 3, rot = q * Math.PI / 2;
        let [w, d] = spec; if (q & 1) [w, d] = [d, w];
        if (Math.hypot(x - cx, z - cz) < 7 + Math.max(w, d) / 2) continue;
        if (overlaps(x, z, w, d, 2.2)) continue;
        const pts = [[x, z], [x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2]];
        const hs = pts.map(([px, pz]) => hAt(px, pz));
        const mn = Math.min(...hs), mx = Math.max(...hs);
        if (mn < 1.3 || mx - mn > (C.stilts ? 3.6 : spec[3] === 'albero' ? 4 : 2.4) || mx > v.h + 7) continue;
        occupied.push({ x, z, w, d });
        const b = { kind, x, z, w: spec[0], d: spec[1], rot, q, y: mx + 0.12 + (C.stilts || 0), ground: mn, wallH: spec[2], roof: spec[3], stilts: C.stilts || 0 };
        if (!v.inhabited && kind !== 'torre' && rnd() < 0.55) b.ruin = 0.35 + rnd() * 0.45;
        L.buildings.push(b);
        return b;
      }
      return null;
    };
    occupied.push({ x: cx, z: cz, w: 12, d: 12 }); // piazza
    const inn = tryPlace(C.inn, 9, 16, 'locanda', 60) || tryPlace(C.inn, 9, 24, 'locanda', 60);
    const n = C.n[0] + ((rnd() * (C.n[1] - C.n[0] + 1)) | 0);
    for (let i = 0; i < n; i++) {
      const spec = C.house[(rnd() * C.house.length) | 0];
      const kind = spec[3] === 'mulino' ? 'mulino' : spec[3] === 'torre' || spec[3] === 'torretta' ? 'torre' : spec[3] === 'fienile' ? 'fienile' : 'casa';
      if ((kind === 'mulino' || kind === 'torre') && L.buildings.some((b) => b.kind === kind)) { i--; if (rnd() < 0.3) break; continue; }
      tryPlace(spec, 11, 36, kind);
    }
    // la torre campanaria della cittadina coloniale, con il carro di fieno ai piedi (salto della fede)
    if (v.style === 'coloniale') {
      const t = tryPlace([4, 4, 15, 'campanile'], 8, 20, 'torre', 60);
      if (t) {
        const c = Math.cos(t.rot), s = Math.sin(t.rot);
        const hx = t.x + c * 4.2, hz = t.z - s * 4.2;
        L.props.push({ k: 'fieno', x: hx, z: hz, y: hAt(hx, hz), rot: t.rot });
      }
      for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.4 + rnd() * 0.3; L.props.push({ k: 'bancarella', x: cx + Math.cos(a) * 7.5, z: cz + Math.sin(a) * 7.5, y: hAt(cx + Math.cos(a) * 7.5, cz + Math.sin(a) * 7.5), rot: -a + Math.PI / 2, col: (rnd() * 6) | 0 }); }
      L.props.push({ k: 'fontana', x: cx, z: cz, y: hAt(cx, cz) });
      for (let i = 0; i < 4; i++) { const a = rnd() * 6.283, d = 16 + rnd() * 18, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!overlaps(x, z, 2, 2, 0.5)) L.props.push({ k: 'palma', x, z, y: hAt(x, z), s: 0.9 + rnd() * 0.4, rot: rnd() * 6.28 }); }
    } else if (v.style === 'fattoria') {
      L.props.push({ k: 'pozzo', x: cx, z: cz, y: hAt(cx, cz) });
      for (let i = 0; i < 2; i++) { const a = rnd() * 6.283, d = 30 + rnd() * 8, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!overlaps(x, z, 10, 8, 1) && hAt(x, z) > 1.5) { occupied.push({ x, z, w: 10, d: 8 }); L.props.push({ k: 'campo', x, z, y: hAt(x, z), rot: 0 }); } }
      L.props.push({ k: 'bancarella', x: cx + 6.5, z: cz + 1, y: hAt(cx + 6.5, cz + 1), rot: Math.PI / 2, col: 2 });
    } else if (v.style === 'pietra') {
      L.props.push({ k: 'pozzo', x: cx, z: cz, y: hAt(cx, cz) });
      L.props.push({ k: 'bancarella', x: cx - 6.5, z: cz, y: hAt(cx - 6.5, cz), rot: -Math.PI / 2, col: 4 });
    } else {
      L.props.push({ k: 'falo', x: cx, z: cz, y: hAt(cx, cz) });
      L.props.push({ k: 'totem', x: cx + 3.2, z: cz - 2.4, y: hAt(cx + 3.2, cz - 2.4) });
      L.props.push({ k: 'bancarella', x: cx - 5.5, z: cz + 2, y: hAt(cx - 5.5, cz + 2), rot: -Math.PI / 2, col: 1 });
    }
    // case sugli alberi: alberi giganti e ponti di corda tra le piattaforme vicine
    if (v.style === 'alberi') {
      const th = L.buildings.filter((b) => b.roof === 'albero');
      for (const b of th) { b.y = b.ground + 6.2; b.platR = 3.6; L.trees.push({ x: b.x, z: b.z, y: b.ground, top: b.y }); }
      for (let i = 0; i < th.length; i++) for (let j = i + 1; j < th.length; j++) { const d = Math.hypot(th[i].x - th[j].x, th[i].z - th[j].z); if (d < 17 && L.bridges.length < th.length) L.bridges.push({ a: i, b: j, ax: th[i].x, az: th[i].z, ay: th[i].y, bx: th[j].x, bz: th[j].z, by: th[j].y }); }
    }
    // casse: dentro le case (di più nei villaggi abbandonati), una nella locanda, una in cima alla torre
    let ci = 0;
    for (const b of L.buildings) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const loc = (lx, lz) => ({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c });
      if (b.kind === 'torre') {
        if (rnd() < 0.8) { const p = loc(0.6, -0.6); L.chests.push({ id: `c:${v.id}:${ci++}`, x: p.x, z: p.z, y: b.y + b.wallH, rot: b.rot, tier: 2 }); }
        continue;
      }
      if (b.kind === 'mulino') continue;
      const inner = b.roof === 'albero' ? [1.4, 1.4] : [b.w / 2 - 0.8, b.d / 2 - 0.8];
      const p = loc(inner[0] * (rnd() < 0.5 ? 1 : -1), -inner[1]);
      const chance = b.kind === 'locanda' ? 1 : v.inhabited ? 0.45 : 0.85;
      if (rnd() < chance) L.chests.push({ id: `c:${v.id}:${ci++}`, x: p.x, z: p.z, y: b.y, rot: b.rot, tier: v.inhabited ? 1 : 2 });
      if (b.kind === 'locanda') {
        for (let k = 0; k < 2; k++) { const q = loc(-b.w / 2 + 1.2 + k * 1.6, -b.d / 2 + 1.4); L.beds.push({ id: `b:${v.id}:${k}`, x: q.x, z: q.z, y: b.y, rot: b.rot }); }
      }
    }
    // pontile verso il mare
    for (let k = 0; k < 24 && !L.dock; k++) {
      const a = (k / 24) * 6.283;
      let shore = null, end = null;
      for (let d = 14; d < 90; d += 1.5) {
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, h = hAt(x, z);
        if (!shore && h < 0.9) shore = { x, z, d };
        if (shore && h < -2.4) { end = { x, z, d }; break; }
        if (shore && d - shore.d > 26) break;
      }
      if (shore && end && end.d - shore.d > 5) {
        const sx = shore.x - Math.cos(a) * 3, sz = shore.z - Math.sin(a) * 3;
        L.dock = { x0: sx, z0: sz, x1: end.x + Math.cos(a) * 4, z1: end.z + Math.sin(a) * 4, a, y: G.SEA + 1.05 };
      }
    }
    // abitanti (solo nei villaggi abitati)
    if (v.inhabited) {
      const outfit = () => (rnd() * 1e6) | 0;
      const nm = () => FIRST[(rnd() * FIRST.length) | 0];
      if (inn) { const c = Math.cos(inn.rot), s = Math.sin(inn.rot); L.npcs.push({ id: `n:${v.id}:0`, role: 'locandiere', name: nm() + ' l’oste', x: inn.x + 1.2 * s, z: inn.z + 1.2 * c, y: inn.y, rot: inn.rot, look: outfit() }); }
      const stall = L.props.find((p) => p.k === 'bancarella');
      if (stall) L.npcs.push({ id: `n:${v.id}:1`, role: 'mercante', name: nm() + ' il mercante', x: stall.x - Math.sin(stall.rot) * 1.1, z: stall.z - Math.cos(stall.rot) * 1.1, y: stall.y, rot: stall.rot + Math.PI, look: outfit() });
      L.npcs.push({ id: `n:${v.id}:2`, role: 'capo', name: nm() + (v.style === 'coloniale' ? ' il governatore' : ' la capovillaggio'), x: cx + 3.5, z: cz + 3.5, y: hAt(cx + 3.5, cz + 3.5), rot: rnd() * 6.28, look: outfit() });
      const nv = 3 + ((rnd() * 3) | 0);
      for (let i = 0; i < nv; i++) {
        const way = [];
        for (let k = 0; k < 4; k++) { const b = L.buildings[(rnd() * L.buildings.length) | 0]; if (!b || b.roof === 'albero' || b.stilts) { const a = rnd() * 6.28; way.push([cx + Math.cos(a) * 6, cz + Math.sin(a) * 6]); continue; } const c = Math.cos(b.rot), s = Math.sin(b.rot); way.push([b.x + s * (b.d / 2 + 1.6), b.z + c * (b.d / 2 + 1.6)]); }
        L.npcs.push({ id: `n:${v.id}:${3 + i}`, role: 'abitante', name: nm() + ' ' + LAST[(rnd() * LAST.length) | 0], way, speed: 0.9 + rnd() * 0.4, ph: rnd() * 100, look: outfit() });
      }
    }
    v.L = L;
    return L;
  };
  P.npcName = function (rnd) { rnd = rnd || Math.random; return FIRST[(rnd() * FIRST.length) | 0] + ' ' + LAST[(rnd() * LAST.length) | 0];
  };
  // vegetazione: 0 libero, 1 = dentro un villaggio (niente alberi/rocce), 2 = sotto un edificio (niente erba)
  P.clearAt = function (x, z) {
    let res = 0;
    for (const p of P.near(x, z, 100)) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > 60 && p.type !== 'castello') continue;
      if (p.type === 'village') {
        if (d > 44) continue;
        res = Math.max(res, 1);
        const L = P.layout(p);
        for (const b of L.buildings) { const [w, dd] = b.q & 1 ? [b.d, b.w] : [b.w, b.d]; if (Math.abs(x - b.x) < w / 2 + 1 && Math.abs(z - b.z) < dd / 2 + 1) return 2; }
        if (d < 7) return 2;
      } else if (p.type === 'faro' && d < 12) return 2;
      else if (p.type === 'covo' && d < 14) res = Math.max(res, d < 9 ? 2 : 1);
      else if ((p.type === 'rovina' || p.type === 'accampamento') && d < 16) res = Math.max(res, d < 11 ? 2 : 1);
      else if (p.type === 'miniera' && d < 9) return 2;
      else if (p.type === 'castello' && d < 95) {
        const q = Math.floor(p.rotR * 4) & 3, lx = q & 1 ? (q === 1 ? -(z - p.z) : z - p.z) : (q === 0 ? x - p.x : -(x - p.x)), lz = q & 1 ? (q === 1 ? x - p.x : -(x - p.x)) : (q === 0 ? z - p.z : -(z - p.z));
        if (Math.abs(lx) < 60 && lz > -60 && lz < 80) return 2;
        if (Math.abs(lx) < 70 && lz > -70 && lz < 88) res = Math.max(res, 1);
      }
    }
    return res;
  };

  /* ==========================================================
     BOTTINO DELLE CASSE (deterministico per id; gli oggetti rari
     già trovati diventano dobloni quando la cassa viene aperta)
     ========================================================== */
  const T1 = [['doblone', 2, 7, 1], ['bacche', 2, 5, 0.5], ['pesce_cotto', 1, 3, 0.4], ['corda', 1, 3, 0.5], ['stoffa', 1, 2, 0.35], ['freccia', 3, 8, 0.4], ['torcia', 1, 3, 0.35], ['ciotola_acqua', 1, 2, 0.35], ['assi', 2, 6, 0.3], ['mappa_tesoro', 1, 1, 0.12], ['progetto_canoa', 1, 1, 0.05], ['perla', 1, 1, 0.08]];
  const T2 = [['doblone', 6, 18, 1], ['freccia', 6, 14, 0.6], ['munizioni', 2, 6, 0.4], ['sciabola', 1, 1, 0.16], ['arco', 1, 1, 0.14], ['lancia', 1, 1, 0.15], ['pala', 1, 1, 0.18], ['stoffa', 2, 4, 0.4], ['corda', 2, 5, 0.4], ['mappa_tesoro', 1, 1, 0.32], ['perla', 1, 3, 0.3], ['cannocchiale', 1, 1, 0.08], ['pinne', 1, 1, 0.08], ['progetto_catamarano', 1, 1, 0.07], ['progetto_canoa', 1, 1, 0.1], ['cannone', 1, 2, 0.12]];
  const T3 = [['doblone', 20, 55, 1], ['munizioni', 4, 10, 0.6], ['pistola', 1, 1, 0.25], ['sciabola', 1, 1, 0.3], ['perla', 2, 5, 0.5], ['mappa_tesoro', 1, 1, 0.35], ['bussola_oro', 1, 1, 0.16], ['vela_leggendaria', 1, 1, 0.13], ['lanterna', 1, 1, 0.1], ['progetto_galeone', 1, 1, 0.12], ['progetto_catamarano', 1, 1, 0.12], ['cannone', 2, 4, 0.25]];
  // tesoro della cripta del castello: il premio più ricco del gioco
  const T4 = [['doblone', 70, 140, 1], ['lingotto_oro', 3, 8, 1], ['perla', 4, 9, 0.8], ['spada_ferro', 1, 1, 0.7], ['pistola_capitano', 1, 1, 0.3], ['bussola_oro', 1, 1, 0.35], ['vela_leggendaria', 1, 1, 0.3], ['lanterna', 1, 1, 0.45], ['progetto_galeone', 1, 1, 0.4], ['munizioni', 8, 16, 0.7], ['pinne', 1, 1, 0.25], ['cannocchiale', 1, 1, 0.3]];
  P.TIERS = [null, T1, T2, T3, T4];
  P.loot = function (id, tier, extra) {
    const rnd = G.mulberry32(hashR(id.length, [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7), 91));
    const inv = new Array(27).fill(null);
    let slot = 0;
    const put = (it, n) => { if (slot < 27) { inv[(slot * 7) % 27] = { id: it, n }; slot++; } };
    for (const [it, mn, mx, p] of P.TIERS[tier]) if (rnd() < p) put(it, mn + ((rnd() * (mx - mn + 1)) | 0));
    for (const e of extra || []) put(e[0], e[1]);
    return inv;
  };
  // mappa del tesoro: punta a un tesoro tra 250 e 900 m dal luogo dove la trovi
  P.mapTarget = function (x, z, salt, removed) {
    const list = P.treasuresNear(x, z, 900).filter((t) => Math.hypot(t.x - x, t.z - z) > 220 && !(removed && removed.has('dig:' + t.id)));
    if (!list.length) return null;
    const t = list[(hashR(Math.round(x), Math.round(z), salt) >>> 3) % list.length];
    return { x: +t.x.toFixed(1), z: +t.z.toFixed(1), id: t.id };
  };
})();
