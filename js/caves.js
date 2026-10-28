'use strict';
/* ==========================================================
   Grotte naturali: un imbocco sul fianco della collina, una galleria
   che scende serpeggiando nella roccia, cunicoli laterali più stretti,
   caverne ampie con pozze d'acqua, stalattiti e stalagmiti, muschio
   vicino alla luce e all'acqua, funghi (alcuni luminosi in profondità),
   pipistrelli appesi alla volta, vene di carbone, ferro e oro sulle
   pareti. Nelle zone fredde le stalattiti sono di ghiaccio.
   Tutto è deterministico (dal seme del mondo): ogni giocatore trova la
   stessa grotta. Le gallerie sono scavi "generati" (dig.js).
   ========================================================== */
(function () {
  const G = globalThis.G;
  const CV = (G.Caves = { active: new Map() });
  const V3 = THREE.Vector3;
  const M = () => G.MODELS;

  /* ---------------- generazione delle gallerie ---------------- */
  CV.generate = function (c) {
    const rnd = G.mulberry32(c.seed);
    const sph = [], path = [], caverns = [], pools = [], veins = [], tunnels = [];
    const SEA = G.SEA, minY = SEA + 3.2;
    const cold = G.coldAt ? G.coldAt(c.x, c.z) : 0;
    const uphill = (x, z) => { const gx = G.heightAt(x + 3, z) - G.heightAt(x - 3, z), gz = G.heightAt(x, z + 3) - G.heightAt(x, z - 3); return Math.atan2(gx, gz); };
    const vein = (x, y, z, deep) => {
      const k = rnd(), type = deep > 12 && k < 0.18 ? 3 : (deep > 5 && k < 0.6) || k < 0.3 ? 2 : 1;
      veins.push({ x, y, z, r: 1.0 + rnd() * 0.7, type });
    };
    // galleria: un "verme" che avanza, gira piano e scende restando dentro la roccia
    function worm(x, y, z, yaw, steps, base, maxDepth, mouth) {
      const pts = [];
      for (let i = 0; i < steps; i++) {
        const surf = G.heightAt(x, z);
        const squeeze = rnd() < 0.06 ? 0.62 : 1; // ogni tanto una strettoia
        const r = Math.max(1.18, (base + Math.sin(i * 0.37 + base) * 0.35 + (rnd() - 0.5) * 0.4) * squeeze);
        let target = Math.max(minY + r * 0.5, surf - Math.min(maxDepth, 2.5 + i * 0.2) - r * 0.4);
        if (mouth && i < 5) target = c.h + 0.7 - i * 0.12;
        y += G.clamp(target - y, -0.5, 0.3);
        // troppo vicini alla superficie: si torna verso l'interno del monte e si scende un po'
        const shallow = surf - y < r + 1.3 && !(mouth && i < 6);
        if (shallow) { yaw += G.clamp(G.angleDiff(yaw, uphill(x, z)), -0.35, 0.35); y -= 0.4; }
        yaw += (rnd() - 0.5) * 0.34 + Math.sin(i * 0.11 + base * 3) * 0.05;
        x += Math.sin(yaw) * 1.25; z += Math.cos(yaw) * 1.25;
        if (y < minY + r * 0.4) y = minY + r * 0.4;
        sph.push([x, y, z, r]); pts.push({ x, y, z, r, yaw, deep: G.heightAt(x, z) - y });
        if (i > 6 && i % 9 === 0 && rnd() < 0.55) { const sd = rnd() < 0.5 ? -1 : 1, px = Math.cos(yaw) * sd, pz = -Math.sin(yaw) * sd; vein(x + px * (r + 0.55), y + (rnd() - 0.3) * r * 0.8, z + pz * (r + 0.55), G.heightAt(x, z) - y); }
      }
      tunnels.push(pts);
      return pts;
    }
    // caverna: tante sfere sovrapposte, irregolare, con una pozza nel punto più basso
    function cavern(x, y, z, size) {
      const surf = G.heightAt(x, z);
      let R = Math.min(7.5, size);
      // la volta resta sotto la superficie, il pavimento sopra il mare
      if (y + R > surf - 2.2) y = surf - 2.2 - R;
      if (y - R < minY - 1) { if (surf - 2.2 - (minY - 1) < 7) R = Math.max(3.2, (surf - 2.2 - (minY - 1)) / 2); y = minY - 1 + R; }
      sph.push([x, y, z, R]);
      const n = 6 + ((rnd() * 6) | 0), parts = [{ x, y, z, r: R }];
      for (let k = 0; k < n; k++) {
        const a = rnd() * 6.283, d = R * (0.45 + rnd() * 0.55), rr = R * (0.45 + rnd() * 0.35);
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y - R * 0.15 + (rnd() - 0.5) * R * 0.35;
        if (py + rr > G.heightAt(px, pz) - 1.8) continue;
        sph.push([px, Math.max(minY - 1 + rr, py), pz, rr]); parts.push({ x: px, y: py, z: pz, r: rr });
      }
      const cv = { x, y, z, R, parts };
      caverns.push(cv);
      if (rnd() < 0.75) pools.push({ x: x + (rnd() - 0.5) * R * 0.3, z: z + (rnd() - 0.5) * R * 0.3, y: y - R + 0.55 + rnd() * 0.25, r: R * (0.45 + rnd() * 0.15) });
      for (let k = 0; k < 3 + ((rnd() * 3) | 0); k++) { const a = rnd() * 6.283, e = (rnd() - 0.3) * 1.2; vein(x + Math.cos(a) * Math.cos(e) * (R + 0.5), y + Math.sin(e) * (R + 0.5), z + Math.sin(a) * Math.cos(e) * (R + 0.5), surf - y); }
      return cv;
    }
    const inward = c.dir + Math.PI;
    const main = worm(c.x + Math.sin(c.dir) * 1.2, c.h + 0.9, c.z + Math.cos(c.dir) * 1.2, inward, 95 + ((rnd() * 55) | 0), 1.95, 16 + rnd() * 10, true);
    path.push(...main);
    const mid = main[(main.length * (0.4 + rnd() * 0.15)) | 0];
    cavern(mid.x, mid.y + 1.5, mid.z, 4.5 + rnd() * 2);
    const end = main[main.length - 1];
    cavern(end.x, end.y + 2, end.z, 5.5 + rnd() * 2);
    // cunicoli laterali
    const nb = 2 + ((rnd() * 2) | 0);
    for (let b = 0; b < nb; b++) {
      const s = main[(main.length * (0.2 + rnd() * 0.65)) | 0];
      const br = worm(s.x, s.y, s.z, s.yaw + (rnd() < 0.5 ? -1 : 1) * (0.9 + rnd() * 0.7), 22 + ((rnd() * 40) | 0), 1.4, 22, false);
      if (rnd() < 0.55) { const e = br[br.length - 1]; cavern(e.x, e.y + 1, e.z, 3.4 + rnd() * 1.6); }
    }
    return { sph, path, caverns, pools, veins, tunnels, cold, mouth: { x: c.x, y: c.h, z: c.z }, rnd };
  };

  /* ---------------- caverne nascoste sotto terra ----------------
     Ovunque sotto la terraferma, a 7–30 m di profondità: caverne chiuse (nessun imbocco)
     collegate da gallerie. Scavando verso il basso o di lato è facile sbucarci dentro.
     Si generano man mano che il giocatore si muove (celle di 44 m, deterministiche). */
  const HC = 44;
  CV.hidden = new Map(); // chiave cella -> sistema (o null)
  const hh = (a, b, k) => { let h = (a * 73856093) ^ (b * 19349663) ^ (k * 83492791) ^ ((G.seed | 0) * 2654435761); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function landAround(x, z, R) { for (let k = 0; k < 8; k++) { const a = k * 0.785; if (G.heightAt(x + Math.cos(a) * R, z + Math.sin(a) * R) < G.SEA + 1.5) return false; } return true; }
  function genHidden(ix, iz) {
    if (hh(ix, iz, 1) > 0.92) return null;
    const rnd = G.mulberry32((hh(ix, iz, 2) * 4294967296) | 0);
    const x = (ix + 0.15 + rnd() * 0.7) * HC, z = (iz + 0.15 + rnd() * 0.7) * HC, h = G.heightAt(x, z);
    if (h < G.SEA + 2 || Math.hypot(x, z) < 50) return null;
    const R = 3.4 + rnd() * 3.6;
    if (!landAround(x, z, R + 4)) return null;
    let y = h - (4 + rnd() * 13) - R; // la volta da 4 a 17 m sotto i piedi y = Math.max(y, G.SEA - 30 + R); if (y + R > h - 3) y = h - 3 - R;
    if (y - R < G.SEA - 34) return null;
    const sph = [], caverns = [], pools = [], veins = [], tunnels = [];
    const vein = (vx, vy, vz) => { const deep = G.heightAt(vx, vz) - vy, k = rnd(); veins.push({ x: vx, y: vy, z: vz, r: 0.9 + rnd() * 0.7, type: deep > 14 && k < 0.2 ? 3 : (deep > 6 && k < 0.62) || k < 0.3 ? 2 : 1 }); };
    // la caverna: sfere sovrapposte, irregolare
    sph.push([x, y, z, R]); const parts = [{ x, y, z, r: R }];
    for (let k = 0, n = 5 + ((rnd() * 6) | 0); k < n; k++) {
      const a = rnd() * 6.283, d = R * (0.45 + rnd() * 0.6), rr = R * (0.4 + rnd() * 0.4), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y - R * 0.1 + (rnd() - 0.5) * R * 0.4;
      if (py + rr > G.heightAt(px, pz) - 2.5) continue;
      sph.push([px, py, pz, rr]); parts.push({ x: px, y: py, z: pz, r: rr });
    }
    caverns.push({ x, y, z, R, parts });
    if (rnd() < 0.6) pools.push({ x: x + (rnd() - 0.5) * R * 0.3, z: z + (rnd() - 0.5) * R * 0.3, y: y - R + 0.5, r: R * 0.5 });
    for (let k = 0; k < 2 + ((rnd() * 4) | 0); k++) { const a = rnd() * 6.283, e = (rnd() - 0.3) * 1.1; vein(x + Math.cos(a) * Math.cos(e) * (R + 0.5), y + Math.sin(e) * (R + 0.5), z + Math.sin(a) * Math.cos(e) * (R + 0.5)); }
    // gallerie che partono dalla caverna (verso le celle vicine: spesso si incontrano)
    for (let t = 0, nt = 2 + ((rnd() * 2) | 0); t < nt; t++) {
      let yaw = rnd() * 6.283, tx = x, ty = y - R * 0.4, tz = z; const pts = [], base = 1.3 + rnd() * 0.7;
      for (let i = 0, n = 14 + ((rnd() * 26) | 0); i < n; i++) {
        tx += Math.sin(yaw) * 1.25; tz += Math.cos(yaw) * 1.25; yaw += (rnd() - 0.5) * 0.4;
        const surf = G.heightAt(tx, tz), r = Math.max(1.15, base + (rnd() - 0.5) * 0.5);
        if (surf < G.SEA + 2) break;
        ty += (rnd() - 0.5) * 0.7; ty = Math.min(ty, surf - r - 3); ty = Math.max(ty, G.SEA - 32);
        sph.push([tx, ty, tz, r]); pts.push({ x: tx, y: ty, z: tz, r, yaw, deep: surf - ty });
        if (i % 7 === 3 && rnd() < 0.5) { const sd = rnd() < 0.5 ? -1 : 1; vein(tx + Math.cos(yaw) * sd * (r + 0.5), ty + (rnd() - 0.4) * r, tz - Math.sin(yaw) * sd * (r + 0.5)); }
      }
      if (pts.length) tunnels.push(pts);
    }
    return { key: ix + ',' + iz, sph, caverns, pools, veins, tunnels, cold: G.coldAt ? G.coldAt(x, z) : 0, mouth: { x, z }, hidden: true, found: false, decorated: false, x, y, z, R };
  }
  CV.hiddenAt = function (x, y, z, pad) {
    for (const sys of CV.hidden.values()) { if (!sys || Math.hypot(sys.x - x, sys.z - z) > 70) continue; for (const q of sys.sph) if (Math.hypot(q[0] - x, q[1] - y, q[2] - z) < q[3] + (pad || 0.6)) return sys; }
    return null;
  };
  CV._ht = 0;
  CV.updateHidden = function (dt, P) {
    if (!G.Dig || !G.started) return;
    if ((CV._ht -= dt) > 0) return; CV._ht = 0.7;
    const cx = Math.floor(P.pos.x / HC), cz = Math.floor(P.pos.z / HC);
    let made = 0;
    for (let r = 0; r <= 3 && made < 2; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r || made >= 2) continue;
      const k = (cx + i) + ',' + (cz + j); if (CV.hidden.has(k)) continue;
      const sys = genHidden(cx + i, cz + j); CV.hidden.set(k, sys); made++;
      if (sys) { G.Dig.addGen('hid:' + k, sys.sph, true); G.Dig.addVeins('hid:' + k, sys.veins); }
    }
    // se gli scavi sono stati ricaricati (nuova partita, ingresso in una partita in rete) si rimettono le caverne
    for (const [k, sys] of CV.hidden) if (sys && !G.Dig.genKeys.has('hid:' + k)) { G.Dig.addGen('hid:' + k, sys.sph, true); G.Dig.addVeins('hid:' + k, sys.veins); }
    // decorazioni (stalattiti, funghi, pozze, pipistrelli) solo quando ci si avvicina davvero
    for (const sys of CV.hidden.values()) {
      if (!sys || sys.decorated || Math.hypot(sys.x - P.pos.x, sys.z - P.pos.z) > 45) continue;
      sys.decorated = true;
      const dec = CV.decorate(sys);
      if (!CV.hgroup) { CV.hgroup = new THREE.Group(); G.scene.add(CV.hgroup); }
      const g = new THREE.Group(); for (const m of dec.meshes) g.add(m); CV.hgroup.add(g);
      CV.attach('hid:' + sys.key, g, dec); CV.active.get('hid:' + sys.key).own = true;
      break;
    }
  };
  CV.resetHidden = function () { CV.hidden.clear(); if (CV.hgroup) { G.scene.remove(CV.hgroup); CV.hgroup = null; } for (const [k, c] of CV.active) if (c.own) CV.active.delete(k); };
  // una vena o un colpo di piccone che sbuca in una caverna nascosta
  CV.onDig = function (x, y, z) {
    const sys = CV.hiddenAt(x, y, z);
    if (sys && !sys.found) { sys.found = true; G.UI.toast('Hai aperto una caverna sotterranea! Fai luce con la torcia', 'good'); if (G.Audio && G.Audio.drip) G.Audio.drip(); return; }
    // vicino a un vuoto la roccia suona diversa: un indizio per chi scava
    const near = !sys && CV.hiddenAt(x, y, z, 4);
    if (near && !near.found && !near.echo) { near.echo = true; G.UI.toast('Il piccone rimbomba: qui vicino c’è un vuoto nella roccia…', ''); if (G.Audio && G.Audio.drip) { G.Audio.drip(); setTimeout(() => G.Audio.drip(), 300); } }
  };

  /* ---------------- materiali al buio ----------------
     Come le pareti delle gallerie: il sole e il cielo non arrivano sottoterra, le torce sì. */
  function caveify(mat, key) {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float aDepth; varying float vDepth;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vDepth = aDepth;');
      sh.fragmentShader = 'varying float vDepth;\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>', 'float caveK = mix(1.0, 0.04, smoothstep(0.6, 4.5, vDepth));\n' + THREE.ShaderChunk.lights_fragment_begin
        .split('getDirectionalLightInfo( directionalLight, geometry, directLight );').join('getDirectionalLightInfo( directionalLight, geometry, directLight ); directLight.color *= caveK;')
        .replace('vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );', 'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor ) * mix(1.0, 0.35, 1.0 - caveK);')
        .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );', 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal ) * mix(caveK, 1.0, 0.12);'));
    };
    mat.customProgramCacheKey = () => 'cave_' + key;
    return mat;
  }
  CV.caveify = caveify;
  function withDepth(g) {
    const p = g.attributes.position, d = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) d[i] = Math.max(0, G.heightAt(p.getX(i), p.getZ(i)) - p.getY(i));
    g.setAttribute('aDepth', new THREE.BufferAttribute(d, 1));
    return g;
  }
  CV.withDepth = withDepth;
  let MT = null;
  function mats() {
    if (MT) return MT;
    const T = G.TEX || {}, PH = G.PHOTO || {};
    MT = {
      rock: caveify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, map: PH.gravel || (T.rockT && T.rockT.map) || null }), 'rock'),
      wet: caveify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.03 }), 'wet'),
      moss: caveify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }), 'moss'),
      plant: caveify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 }), 'plant'),
      glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: null }),
      ice: caveify(new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.82, emissive: 0x0a1a24 }), 'ice'),
      water: caveify(new THREE.MeshStandardMaterial({ color: 0x0d2a33, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.82, emissive: 0x03161c, depthWrite: false, side: THREE.DoubleSide }), 'water'),
      bat: new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.9, side: THREE.DoubleSide }),
    };
    // i funghi luminosi: il colore della luce è quello dei vertici
    MT.glow.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor * 1.6;'); };
    return MT;
  }

  /* ---------------- decorazioni ---------------- */
  const col = (g, r, gg, b, jit, rnd) => M().colorize(g, r, gg, b, jit, rnd);
  // tetto e pavimento sopra/sotto un punto dentro la grotta
  function probe(x, y, z, up) {
    for (let k = 0, yy = y; k < 60; k++, yy += up ? 0.2 : -0.2) if (G.Dig.solidAt(x, yy, z)) return yy;
    return null;
  }
  CV.decorate = function (sys) {
    const rnd = G.mulberry32((sys.mouth.x * 13 + sys.mouth.z * 7) | 0), MTs = mats();
    const L = { rock: [], wet: [], moss: [], plant: [], glow: [], ice: [], water: [] };
    const cold = sys.cold > 0.5;
    const drip = [], roosts = [];
    const stal = (x, z, top, down, len, r) => {
      const g = new THREE.ConeGeometry(r, len, 10, 8); if (down) g.rotateX(Math.PI);
      const p = g.attributes.position, cc = new Float32Array(p.count * 3), t0 = 0.4 + rnd() * 0.15, ph = rnd() * 6;
      for (let i = 0; i < p.count; i++) {
        const yy = p.getY(i) / len + 0.5, a = Math.atan2(p.getZ(i), p.getX(i));
        const k = 1 + Math.sin(yy * 22 + ph) * 0.1 + Math.sin(a * 3 + ph) * 0.12 + Math.sin(a * 7 + yy * 5) * 0.05;
        p.setX(i, p.getX(i) * k + Math.sin(yy * 4 + ph) * r * 0.25); p.setZ(i, p.getZ(i) * k);
        const tip = down ? 1 - yy : yy, t = t0 * (0.85 + tip * 0.35) * (0.92 + 0.08 * Math.sin(yy * 40 + a));
        cc[i * 3] = t * 1.06; cc[i * 3 + 1] = t * 0.96; cc[i * 3 + 2] = t * 0.82;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.computeVertexNormals();
      g.translate(x, top + (down ? -len / 2 : len / 2), z);
      if (cold && down) L.ice.push(g); else L.wet.push(g);
    };
    const patch = (x, y, z, R, c) => {
      const n = 14, g = new THREE.CircleGeometry(R, n); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position; for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 0.65 + 0.35 * Math.abs(Math.sin(a * 3 + x)) + rnd() * 0.15; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      for (let i = 0; i < p.count; i++) { const px = x + p.getX(i), pz = z + p.getZ(i); const f = probe(px, y + 0.8, pz, false); p.setXYZ(i, px, (f !== null ? f : y) + 0.035, pz); }
      g.computeVertexNormals();
      L.moss.push(col(g, c[0], c[1], c[2], 0.35, rnd));
    };
    const mush = (x, y, z, glow) => {
      const n = 2 + ((rnd() * 5) | 0);
      for (let k = 0; k < n; k++) {
        const a = rnd() * 6.28, d = rnd() * 0.35, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, h = 0.06 + rnd() * (glow ? 0.16 : 0.2), cr = 0.03 + rnd() * 0.06;
        const fy = probe(px, y + 0.6, pz, false); if (fy === null) continue;
        const st = new THREE.CylinderGeometry(cr * 0.3, cr * 0.38, h, 6); st.translate(px, fy + h / 2, pz);
        const cp = new THREE.SphereGeometry(cr, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2); cp.scale(1, 0.6, 1); cp.translate(px, fy + h, pz);
        L.plant.push(col(st, 0.85, 0.82, 0.74));
        if (glow) { const gc = glow === 1 ? [0.15, 0.95, 0.85] : [1.0, 0.62, 0.15]; L.glow.push(col(cp, gc[0], gc[1], gc[2])); }
        else { const t = rnd(); L.plant.push(col(cp, t < 0.5 ? 0.55 : 0.82, t < 0.5 ? 0.36 : 0.7, t < 0.5 ? 0.22 : 0.55)); }
      }
    };
    // caverne: stalattiti, stalagmiti, colonne, pozze, funghi, pipistrelli
    for (const cv of sys.caverns) {
      const nS = 14 + ((rnd() * 16) | 0);
      for (let k = 0; k < nS; k++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd()) * cv.R * 0.85, x = cv.x + Math.cos(a) * d, z = cv.z + Math.sin(a) * d;
        const ceil = probe(x, cv.y, z, true), floor = probe(x, cv.y, z, false); if (ceil === null || floor === null) continue;
        const gap = ceil - floor, inPool = sys.pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r);
        if (gap < 3.2 && rnd() < 0.35 && !inPool) { const g = new THREE.CylinderGeometry(0.22 + rnd() * 0.2, 0.35 + rnd() * 0.25, gap + 0.4, 8); g.translate(x, floor + gap / 2, z); const t = 0.58 + rnd() * 0.15; L.wet.push(col(g, t * 1.05, t * 0.96, t * 0.84)); continue; } // colonna
        const len = Math.min(gap * 0.4, 0.4 + rnd() * 1.9);
        stal(x, z, ceil + 0.1, true, len, 0.06 + len * 0.12);
        if (rnd() < 0.55 && !inPool) { const l2 = Math.min(gap * 0.35, 0.3 + rnd() * 1.4); stal(x + (rnd() - 0.5) * 0.2, z + (rnd() - 0.5) * 0.2, floor - 0.08, false, l2, 0.12 + l2 * 0.16); }
        if (rnd() < 0.3) drip.push(new V3(x, ceil - len, z));
        if (rnd() < 0.4 && roosts.length < 16) roosts.push({ x: x + 0.4, y: ceil - 0.18, z: z + 0.3, cv });
      }
      for (let k = 0; k < 4 + ((rnd() * 4) | 0); k++) { const a = rnd() * 6.283, d = cv.R * (0.3 + rnd() * 0.6); mush(cv.x + Math.cos(a) * d, cv.y, cv.z + Math.sin(a) * d, cv.y < G.heightAt(cv.x, cv.z) - 8 && rnd() < 0.6 ? (rnd() < 0.7 ? 1 : 2) : 0); }
    }
    // pozze: acqua ferma, muschio sulle rive
    for (const p of sys.pools) {
      // l'acqua sta solo nella conca: livello appena sopra il punto più basso, bordo dove il pavimento risale
      const low = probe(p.x, p.y + 1.5, p.z, false); if (low === null) continue;
      p.y = low + 0.42;
      const N = 20, rad = [];
      for (let k = 0; k < N; k++) { const a = k / N * 6.283; let r = 0.3; for (; r < p.r * 2.2; r += 0.2) { const f = probe(p.x + Math.cos(a) * r, p.y + 0.6, p.z + Math.sin(a) * r, false); if (f === null || f > p.y - 0.02) break; } rad.push(r + 0.12); }
      const sh = new THREE.Shape(); rad.forEach((r, k) => { const a = k / N * 6.283, x = Math.cos(a) * r, y = Math.sin(a) * r; k ? sh.lineTo(x, y) : sh.moveTo(x, y); });
      const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); g.translate(p.x, p.y, p.z); L.water.push(g);
      p.r = Math.max(...rad) * 0.8;
      for (let k = 0; k < 5; k++) { const a = rnd() * 6.283; patch(p.x + Math.cos(a) * p.r * 0.95, p.y + 0.4, p.z + Math.sin(a) * p.r * 0.95, 0.5 + rnd() * 0.6, cold ? [0.7, 0.78, 0.8] : [0.22, 0.42, 0.14]); }
      drip.push(new V3(p.x, p.y + 4, p.z));
    }
    // gallerie: muschio e radici vicino all'imbocco, qualche stalattite, funghi
    for (const T of sys.tunnels) for (let i = 0; i < T.length; i++) {
      const s = T[i];
      if (!sys.hidden && i < 22 && T === sys.tunnels[0] && rnd() < 0.55) patch(s.x + (rnd() - 0.5) * s.r, s.y, s.z + (rnd() - 0.5) * s.r, 0.4 + rnd() * 0.7, cold ? [0.75, 0.8, 0.82] : [0.2 + rnd() * 0.1, 0.4 + rnd() * 0.12, 0.12]);
      if (!sys.hidden && i < 10 && T === sys.tunnels[0] && rnd() < 0.5) { const ceil = probe(s.x, s.y, s.z, true); if (ceil !== null) for (let k = 0; k < 3; k++) { const x = s.x + (rnd() - 0.5) * s.r, z = s.z + (rnd() - 0.5) * s.r, len = 0.4 + rnd() * 1.1; const g = new THREE.CylinderGeometry(0.012, 0.025, len, 4); g.translate(x, ceil - len / 2 + 0.05, z); L.plant.push(col(g, 0.32, 0.22, 0.14)); } }
      if (i > 8 && rnd() < 0.18) { const ceil = probe(s.x, s.y, s.z, true); if (ceil !== null) { const len = 0.25 + rnd() * 0.8; stal(s.x + (rnd() - 0.5) * s.r * 0.8, s.z + (rnd() - 0.5) * s.r * 0.8, ceil + 0.08, true, len, 0.05 + len * 0.1); } }
      if (i > 12 && rnd() < 0.07) mush(s.x, s.y, s.z, s.deep > 9 && rnd() < 0.5 ? 1 : 0);
      if (i > 15 && rnd() < 0.05 && roosts.length < 20) { const ceil = probe(s.x, s.y, s.z, true); if (ceil !== null) roosts.push({ x: s.x, y: ceil - 0.18, z: s.z, cv: { x: s.x, y: s.y, z: s.z, R: 3 } }); }
    }
    const meshes = [];
    for (const k in L) {
      if (!L[k].length) continue;
      const g = withDepth(M().merge(L[k]));
      const m = new THREE.Mesh(g, MTs[k]); m.castShadow = k !== 'water' && k !== 'moss'; m.receiveShadow = true; if (k === 'water') m.renderOrder = 3;
      meshes.push(m);
    }
    return { meshes, drip, roosts };
  };

  /* ---------------- pipistrelli ---------------- */
  let batGeo = null;
  function makeBat() {
    if (!batGeo) {
      const body = new THREE.SphereGeometry(0.06, 8, 6); body.scale(0.8, 1.3, 0.8);
      const ear = new THREE.ConeGeometry(0.018, 0.05, 4); ear.translate(0.025, 0.09, 0); const ear2 = ear.clone(); ear2.translate(-0.05, 0, 0);
      batGeo = { body: M().merge([body, ear, ear2]), wing: (() => { const s = new THREE.Shape(); s.moveTo(0, 0.02); s.quadraticCurveTo(0.12, 0.08, 0.26, 0.03); s.lineTo(0.22, -0.02); s.lineTo(0.16, 0.0); s.lineTo(0.1, -0.04); s.lineTo(0.05, -0.01); s.lineTo(0, -0.03); return new THREE.ShapeGeometry(s); })() };
    }
    const g = new THREE.Group(), MTs = mats();
    g.add(new THREE.Mesh(batGeo.body, MTs.bat));
    const wl = new THREE.Mesh(batGeo.wing, MTs.bat), wr = new THREE.Mesh(batGeo.wing, MTs.bat); wr.scale.x = -1;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr); g.add(pl, pr);
    g.userData = { pl, pr };
    return g;
  }
  CV.attach = function (id, group, dec) {
    const bats = dec.roosts.map((r, i) => { const m = makeBat(); m.position.set(r.x, r.y, r.z); m.rotation.x = Math.PI; group.add(m); return { m, r, state: 'roost', t: Math.random() * 10, v: new V3(), ph: Math.random() * 6, i }; });
    CV.active.set(id, { group, bats, drip: dec.drip, dripT: 1 });
  };
  const _v = new V3();
  CV.update = function (dt, P) {
    for (const [id, c] of CV.active) {
      if (!c.own && !G.Structures.active.has(id)) { CV.active.delete(id); continue; }
      const near = c.bats.length && Math.hypot(c.bats[0].r.x - P.pos.x, c.bats[0].r.z - P.pos.z) < 160;
      if (!near) continue;
      const light = P.heldTorch ? 14 : 7;
      for (const b of c.bats) {
        const m = b.m, ud = m.userData; b.t += dt;
        const d = m.position.distanceTo(P.eye || P.pos);
        if (b.state === 'roost') {
          // appesi a testa in giù, le ali chiuse; ogni tanto si stiracchiano
          ud.pl.rotation.y = 1.3 + Math.sin(b.t * 0.7 + b.ph) * 0.05; ud.pr.rotation.y = -1.3 - Math.sin(b.t * 0.7 + b.ph) * 0.05;
          if (d < light || (b.t > 25 && Math.random() < dt * 0.01)) { b.state = 'fly'; b.t = 0; b.v.set((Math.random() - 0.5) * 4, -1, (Math.random() - 0.5) * 4); if (G.Audio && G.Audio.bat && d < 25) G.Audio.bat(d); }
        } else {
          // volo a zig zag dentro la caverna, poi tornano al posatoio
          const flap = Math.sin(b.t * 28 + b.ph); ud.pl.rotation.y = flap * 1.0; ud.pr.rotation.y = -flap * 1.0;
          const cv = b.r.cv, home = b.t > 14 + (b.i % 5) * 2;
          const tgt = home ? _v.set(b.r.x, b.r.y, b.r.z) : _v.set(cv.x + Math.sin(b.t * 0.9 + b.ph) * cv.R * 0.7, cv.y + Math.sin(b.t * 1.7 + b.i) * cv.R * 0.3, cv.z + Math.cos(b.t * 1.1 + b.ph * 2) * cv.R * 0.7);
          const acc = tgt.sub(m.position); const al = acc.length() || 1; acc.multiplyScalar(Math.min(al, 3) / al * (home ? 5 : 3));
          if (d < 3) { const away = m.position.clone().sub(P.eye || P.pos).normalize().multiplyScalar(9); acc.add(away); }
          b.v.addScaledVector(acc, dt); b.v.x += (Math.random() - 0.5) * dt * 14; b.v.y += (Math.random() - 0.5) * dt * 8; b.v.z += (Math.random() - 0.5) * dt * 14;
          const sp = b.v.length(), max = 5.5; if (sp > max) b.v.multiplyScalar(max / sp);
          const nx = m.position.x + b.v.x * dt, ny = m.position.y + b.v.y * dt, nz = m.position.z + b.v.z * dt;
          if (G.Dig.solidAt(nx, ny, nz)) b.v.multiplyScalar(-0.6); else m.position.set(nx, ny, nz);
          m.rotation.set(0, Math.atan2(b.v.x, b.v.z), 0);
          if (home && m.position.distanceTo(_v.set(b.r.x, b.r.y, b.r.z)) < 0.35) { b.state = 'roost'; b.t = 0; m.position.set(b.r.x, b.r.y, b.r.z); m.rotation.set(Math.PI, Math.random() * 6, 0); }
          if (G.Audio && G.Audio.bat && d < 18 && Math.random() < dt * 0.25) G.Audio.bat(d);
        }
      }
      // gocce che cadono dalle stalattiti
      c.dripT -= dt;
      if (c.dripT <= 0 && c.drip.length) {
        c.dripT = 0.4 + Math.random() * 1.2;
        const p = c.drip[(Math.random() * c.drip.length) | 0];
        if (p.distanceTo(P.pos) < 30) { G.FX.burst(p.x, p.y, p.z, [0.7, 0.8, 0.85], 2, 0.4, { size: 0.5 }); if (G.Audio && G.Audio.drip && p.distanceTo(P.pos) < 14 && Math.random() < 0.5) G.Audio.drip(); }
      }
    }
  };
})();
