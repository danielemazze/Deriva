'use strict';
/* ==========================================================
   Scavo del terreno: con piccone e pala si scolpisce il suolo
   in forme morbide (caverne, tunnel, case dentro la montagna).
   Ogni colpo toglie una sfera; il volume risultante si disegna
   con "surface nets" e diventa calpestabile.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const D = (G.Dig = { list: [], cells: new Map(), meshes: new Map(), dirty: new Set() });
  const CELL = 8, VOX = 0.5;
  const V3 = THREE.Vector3;
  let mat = null;

  /* ---------------- dati ---------------- */
  const ck = (ix, iz) => ix + ',' + iz;
  function index(s, i) {
    const [x, , z] = s, r = Math.abs(s[3]);
    for (let iz = Math.floor((z - r - 1) / CELL); iz <= Math.floor((z + r + 1) / CELL); iz++) for (let ix = Math.floor((x - r - 1) / CELL); ix <= Math.floor((x + r + 1) / CELL); ix++) {
      const k = ck(ix, iz); let l = D.cells.get(k); if (!l) D.cells.set(k, (l = [])); l.push(i); D.dirty.add(k);
    }
  }
  D.reset = function () { for (const m of D.meshes.values()) { G.scene.remove(m); m.geometry.dispose(); } D.list = []; D.cells.clear(); D.meshes.clear(); D.dirty.clear(); D.uniformDirty = true; if (D.genKeys) D.genKeys.clear(); D.extraVeins = []; };
  D.load = function (arr) { D.reset(); for (const s of arr || []) D.add(s, true); };
  // le gallerie delle miniere (gen) nascono dal mondo stesso: non si salvano
  D.serialize = () => D.list.filter((s) => !s[4]).map((s) => s.slice(0, 4).map((v) => +v.toFixed(2)));
  D.genKeys = new Set();
  // hidden: caverne chiuse sotto terra; le loro pareti si disegnano solo quando ci si avvicina
  D.addGen = function (key, spheres, hidden) { if (D.genKeys.has(key)) return; D.genKeys.add(key); for (const s of spheres) { D.add([s[0], s[1], s[2], s[3], 1], true); if (hidden) D.list[D.list.length - 1].hid = true; } };
  D.add = function (s, silent) {
    // gli scavi del giocatore al massimo 3,5 m; caverne e gallerie generate dal mondo possono essere più grandi
    s = [s[0], s[1], s[2], Math.sign(s[3] || 1) * Math.min(s[4] ? 8 : 3.5, Math.max(0.3, Math.abs(s[3])))].concat(s[4] ? [1] : []);
    // tocca la superficie? (solo queste bucano il terreno disegnato: ingressi e scavi a cielo aperto)
    s.surf = s[3] > 0 && G.heightAt(s[0], s[2]) - s[1] < s[3] + 0.4;
    D.list.push(s); index(s, D.list.length - 1); D.uniformDirty = true;
    if (!silent && G.Net && G.Net.on) G.Net.send({ t: 'dig', s });
  };
  const near = (x, z) => D.cells.get(ck(Math.floor(x / CELL), Math.floor(z / CELL)));
  D.activeAt = (x, z) => !!near(x, z);
  // densità: > 0 dentro la roccia, < 0 nell'aria
  // ogni scavo ha il bordo bitorzoluto; i "riempimenti" (raggio negativo: terra rimessa a posto) richiudono, nell'ordine in cui sono fatti
  function carveVal(s, x, y, z) {
    const dx = x - s[0], dy = y - s[1], dz = z - s[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ph = s[0] * 1.7 + s[1] * 2.3 + s[2] * 3.1, id = 1 / (d + 1e-4), nx = dx * id, ny = dy * id, nz = dz * id;
    const n = Math.sin(nx * 3.1 + ph) * Math.sin(ny * 2.7 + ph * 1.3) * Math.sin(nz * 3.4 + ph * 0.7) + 0.5 * Math.sin((nx + nz) * 6.3 + ph * 2.1) * Math.sin(ny * 5.7 - ph);
    return s[3] * (1 + 0.3 * (0.5 + 0.5 * Math.max(-1, Math.min(1, n)))) - d;
  }
  function carveDist(x, y, z, l) {
    let m = -Infinity;
    for (const i of l) {
      const s = D.list[i];
      if (s[3] < 0) { const d = Math.hypot(x - s[0], y - s[1], z - s[2]); m = Math.min(m, d + s[3]); continue; }
      const dx = x - s[0], dy = y - s[1], dz = z - s[2];
      if (s[3] * 1.3 - Math.sqrt(dx * dx + dy * dy + dz * dz) < m) continue;
      const v = carveVal(s, x, y, z); if (v > m) m = v;
    }
    return m;
  }
  // solo gli scavi, senza i riempimenti: decide quali facce disegna la galleria
  function carveRaw(x, y, z, l) {
    let m = -Infinity;
    for (const i of l) { const s = D.list[i]; if (s[3] < 0) continue; const v = carveVal(s, x, y, z); if (v > m) m = v; }
    return m;
  }
  D.density = function (x, y, z, hCache) {
    const T = (hCache !== undefined ? hCache : G.heightAt(x, z)) - y;
    const l = near(x, z); if (!l) return T;
    return Math.min(T, -carveDist(x, y, z, l));
  };
  D.solidAt = function (x, y, z) {
    const g = G.World.groundAt(x, z);
    if (y >= g) return false;
    const l = near(x, z); if (!l) return true;
    return carveDist(x, y, z, l) < 0;
  };
  // terreno calpestabile sotto i piedi tenendo conto delle gallerie
  D.ground = function (x, z, feetY) {
    const g = G.World.groundAt(x, z);
    const l = near(x, z); if (!l) return g;
    if (feetY === undefined) feetY = g;
    // superficie non scavata e piedi sopra: normale
    if (feetY >= g - 0.05 && carveDist(x, g - 0.05, z, l) < 0) return g;
    let y = Math.min(feetY + 0.55, g);
    if (D.solidAt(x, y, z)) { // dentro la roccia: risali fino all'aria (al massimo un gradino)
      for (let k = 0; k < 8; k++) { y += 0.12; if (!D.solidAt(x, y, z)) return y; }
      return g;
    }
    for (let k = 0; k < 60; k++) { const ny = y - 0.12; if (D.solidAt(x, ny, z)) { let a = ny, b = y; for (let i = 0; i < 5; i++) { const m = (a + b) / 2; if (D.solidAt(x, m, z)) a = m; else b = m; } return a; } y = ny; }
    return y;
  };
  D.ceiling = function (x, z, headY) {
    const l = near(x, z); if (!l) return Infinity;
    const g = G.World.groundAt(x, z); if (headY > g) return Infinity;
    for (let y = headY - 0.3, k = 0; k < 30 && y < g + 0.1; k++, y += 0.15) if (D.solidAt(x, y, z)) return y;
    return Infinity;
  };
  // pareti della galleria: punti del corpo dentro la roccia
  D.blocked = function (x, feet, z, height) {
    if (!near(x, z)) return false;
    for (const dy of [0.45, 1.0, height - 0.15]) if (D.solidAt(x, feet + dy, z)) return true;
    return false;
  };
  D.raycast = function (o, d, max) {
    let prev = 0;
    for (let t = 0.2; t <= max; t += 0.12) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (D.solidAt(x, y, z)) {
        let a = prev, b = t;
        for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (D.solidAt(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m)) b = m; else a = m; }
        return b;
      }
      prev = t;
    }
    return -1;
  };

  /* ---------------- scavare ---------------- */
  /* ---------------- vene di minerale nella roccia ----------------
     Celle di 7 m: in ognuna può esserci una vena (sfera) di carbone, ferro o oro,
     sempre sotto la superficie. Deterministiche: tutti i giocatori le trovano uguali. */
  const VC = 7;
  const h3 = (a, b, c, k) => { let h = (a * 374761393 + b * 668265263 + c * 1442695041 + k * 2246822519 + (G.seed | 0) * 3266489917) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const ORE_IDS = { 1: 'carbone', 2: 'ferro_grezzo', 3: 'oro_grezzo' };
  function veinIn(cx, cy, cz) {
    const r0 = h3(cx, cy, cz, 1); if (r0 > 0.46) return null;
    const r = 1.4 + h3(cx, cy, cz, 2) * 1.2, m = r + 0.2;
    const x = cx * VC + m + h3(cx, cy, cz, 3) * (VC - 2 * m), y = cy * VC + m + h3(cx, cy, cz, 4) * (VC - 2 * m), z = cz * VC + m + h3(cx, cy, cz, 5) * (VC - 2 * m);
    const surf = G.heightAt(x, z), depth = surf - y;
    if (depth < r + 0.6 || surf < G.SEA + 1) return null;
    const mt = surf > 14 || G.biomeAt(x, z) === G.BIOME.MONTAGNA || G.biomeAt(x, z) === G.BIOME.NEVE, vol = G.volcanoNear && G.volcanoNear(x, z);
    const k = h3(cx, cy, cz, 6);
    let type = 1;
    if ((depth > 9 || vol) && k < 0.16) type = 3;
    else if ((mt || depth > 5) && k < 0.55) type = 2;
    else if (r0 > 0.34) return null;
    return { x, y, z, r, type, ore: ORE_IDS[type] };
  }
  // vene in più messe da grotte e miniere (affiorano sulle pareti delle gallerie)
  D.extraVeins = [];
  D.addVeins = function (key, list) { if (D.genKeys.has('v:' + key)) return; D.genKeys.add('v:' + key); for (const v of list) D.extraVeins.push(Object.assign({ ore: ORE_IDS[v.type] }, v)); D.uniformDirty = true; };
  G.oreAt = function (x, y, z) {
    for (const v of D.extraVeins) { const dx = x - v.x, dy = y - v.y, dz = z - v.z; if (dx * dx + dy * dy + dz * dz < v.r * v.r) return v; }
    const v = veinIn(Math.floor(x / VC), Math.floor(y / VC), Math.floor(z / VC)); if (!v) return null; const dx = x - v.x, dy = y - v.y, dz = z - v.z; return dx * dx + dy * dy + dz * dz < v.r * v.r ? v : null;
  };
  D.veinsNear = function (x, y, z, rad) {
    const out = [], n = Math.ceil(rad / VC), cx = Math.floor(x / VC), cy = Math.floor(y / VC), cz = Math.floor(z / VC);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) { const v = veinIn(cx + i, cy + j, cz + k); if (v) out.push(v); }
    for (const v of D.extraVeins) if (Math.hypot(v.x - x, v.y - y, v.z - z) < rad + v.r) out.push(v);
    out.sort((a, b) => Math.hypot(a.x - x, a.y - y, a.z - z) - Math.hypot(b.x - x, b.y - y, b.z - z));
    return out;
  };
  // rimettere la terra in un buco scavato: una sfera "piena" dove si guarda (non oltre il terreno originale)
  D.fill = function (P) {
    const o = P.cam.position, d = P.lookDir(new V3());
    const t = D.raycast(o, d, 6.5); if (t < 0) return false;
    const hx = o.x + d.x * t, hy = o.y + d.y * t, hz = o.z + d.z * t;
    if (!near(hx, hz) || carveRaw(hx - d.x * 0.5, hy - d.y * 0.5, hz - d.z * 0.5, near(hx, hz)) < -0.2) { G.UI.toast('La terra si rimette solo nei buchi scavati', 'warn'); return true; }
    // il centro sta nell'aria davanti al punto colpito: il buco si riempie verso di te
    for (const b of G.Build.boxes) if (hx > b.x0 - 0.6 && hx < b.x1 + 0.6 && hz > b.z0 - 0.6 && hz < b.z1 + 0.6 && hy > b.y0 - 1 && hy < b.y1 + 0.3) { G.UI.toast('Qui c’è una costruzione', 'warn'); return true; }
    const pp = P.pos; const c = [hx - d.x * 0.45, hy - d.y * 0.45, hz - d.z * 0.45, -0.85];
    if (Math.hypot(c[0] - pp.x, c[2] - pp.z) < 0.9 && c[1] > pp.y - 0.6 && c[1] < pp.y + 2) { G.UI.toast('Sei troppo vicino: spostati un po’', 'warn'); return true; }
    D.add(c);
    if (G.Audio) G.Audio.dig();
    G.FX.burst(hx, hy, hz, [0.45, 0.33, 0.22], 10, 2);
    return 'ok';
  };
  D.dig = function (P, tool, pow) {
    pow = pow || 1;
    const o = P.cam.position, d = P.lookDir(new V3());
    const t = D.raycast(o, d, 4.6); if (t < 0) return false;
    const hx = o.x + d.x * t, hy = o.y + d.y * t, hz = o.z + d.z * t;
    if (hy < -45) { G.UI.toast('Troppo in profondità', 'warn'); return true; }
    const r = (tool === 'pala' ? 0.95 : tool === 'piccone' ? 0.8 : 0.55) * (pow > 1 ? 1.18 : 1);
    const c = [hx + d.x * r * 0.55, hy + d.y * r * 0.55, hz + d.z * r * 0.55, r];
    // non si scava sotto un villaggio o una costruzione
    for (const b of G.Build.boxes) if (hx > b.x0 - 1 && hx < b.x1 + 1 && hz > b.z0 - 1 && hz < b.z1 + 1 && hy > b.y0 - 1.5 && hy < b.y1 + 0.5) { G.UI.toast('Qui sopra c’è una costruzione', 'warn'); return true; }
    // un colpo non fa una sfera perfetta: un grappolo di cavità più piccole, diverso ogni volta
    D.add([c[0], c[1], c[2], r * 0.78]);
    if (G.Caves && G.Caves.onDig) G.Caves.onDig(c[0], c[1], c[2]);
    const nSat = 2 + ((Math.random() * 3) | 0);
    for (let k = 0; k < nSat; k++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.5) * 1.6, rr = r * (0.38 + Math.random() * 0.3), off = r * (0.35 + Math.random() * 0.35);
      D.add([c[0] + Math.cos(a) * Math.cos(e) * off, c[1] + Math.sin(e) * off * 0.8, c[2] + Math.sin(a) * Math.cos(e) * off, rr]);
    }
    // materiale: terra in superficie, pietra (e carbone) in profondità, ossidiana nei vulcani
    const surf = G.heightAt(hx, hz) - hy, rocky = G.normalAt(hx, hz)[1] < 0.82 || (G.climate(hx, hz).mt > 0.5 && surf > 0.6) || surf > 1.6;
    const vol = G.biomeAt(hx, hz) === G.BIOME.VULCANO;
    if (!G.creative()) {
      const vein = G.oreAt(c[0], c[1], c[2]);
      if (vein && tool === 'piccone') { P.give(vein.ore, vein.type === 3 ? (Math.random() < 0.6 ? 1 : 0) : 1); P.give('pietra', 1); if (!D._veinTip) { D._veinTip = 1; G.UI.toast('Hai trovato una vena di ' + { 1: 'carbone', 2: 'ferro', 3: 'oro' }[vein.type] + '!', 'good'); } }
      else if (vein) { if (!D._veinPala || performance.now() - D._veinPala > 5000) { D._veinPala = performance.now(); G.UI.toast('Qui c’è una vena di minerale: per estrarlo serve il piccone', 'warn'); } P.give('pietra', 1); }
      else if (rocky || vol) {
        P.give('pietra', tool === 'piccone' ? 2 : 1);
        // nella roccia si trovano anche minerali sparsi (col piccone): più si scava a fondo e in montagna, più è facile
        if (tool === 'piccone') { const deep = G.clamp(surf / 8, 0, 1), mt = G.climate(hx, hz).mt; const pf = 0.05 + deep * 0.09 + mt * 0.05, po = 0.008 + deep * 0.025 + mt * 0.01, r = Math.random();
          if (r < po) { P.give('oro_grezzo', 1); G.UI.toast('Una pepita d’oro nella roccia! Fondila nella fornace', 'good'); }
          else if (r < po + pf) { P.give('ferro_grezzo', 1); if (!D._feTip) { D._feTip = 1; G.UI.toast('Ferro grezzo! Nella fornace diventa un lingotto', 'good'); } } }
      }
      else P.give('terra', tool === 'pala' ? 2 : 1);
      if (!vein && surf > 3 && Math.random() < 0.06) P.give('carbone', 1);
      if (vol && Math.random() < 0.3) P.give('ossidiana', 1);
    }
    G.FX.burst(hx, hy, hz, rocky ? [0.55, 0.53, 0.5] : [0.42, 0.31, 0.2], 14, 2.4);
    if (G.Audio) { if (rocky) G.Audio.hit('stone'); else G.Audio.dig(); }
    P.swingT = 1;
    if (!D._tip) { D._tip = 1; G.UI.toast('Scavi il terreno: con il piccone e la pala puoi farti tunnel, cantine e case dentro la montagna', 'good'); }
    return true;
  };

  /* ---------------- mesh (surface nets) ---------------- */
  function material() {
    if (mat) return mat;
    const T = G.TEX, PH = G.PHOTO || {};
    const rockMap = PH.gravel || T.rockT.map, dirtMap = PH.dirt || T.sandT.map, rockN = PH.gravelN || T.rockT.normal;
    mat = new THREE.MeshStandardMaterial({ map: rockMap, normalMap: rockN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tDirt = { value: dirtMap }; sh.uniforms.uVein = D.U.uVein; sh.uniforms.uVeinN = D.U.uVeinN;
      sh.vertexShader = 'attribute float aDepth; varying float vDepth; varying vec3 vWp; varying vec3 vWn;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vDepth = aDepth; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform sampler2D tDirt; uniform vec4 uVein[16]; uniform int uVeinN; varying float vDepth; varying vec3 vWp; varying vec3 vWn;\nfloat vh(vec3 p){ return fract(sin(dot(floor(p), vec3(12.99, 78.23, 37.71))) * 43758.55); }\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec3 bw = pow(abs(vWn), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
          vec4 rk = texture2D(map, vWp.zy * 0.3) * bw.x + texture2D(map, vWp.xz * 0.3) * bw.y + texture2D(map, vWp.xy * 0.3) * bw.z;
          vec4 dt = texture2D(tDirt, vWp.zy * 0.33) * bw.x + texture2D(tDirt, vWp.xz * 0.33) * bw.y + texture2D(tDirt, vWp.xy * 0.33) * bw.z;
          vec4 tc = mix(dt, rk, smoothstep(0.6, 2.2, vDepth));
          diffuseColor *= tc;
          for (int i = 0; i < 16; i++) { if (i >= uVeinN) break; vec4 V = uVein[i]; float vr = floor(V.w); float vt = fract(V.w) * 10.0;
            float d = length(vWp - V.xyz) / vr; if (d > 1.15) continue;
            float sp = step(0.62, vh(vWp * 5.0)) * smoothstep(1.15, 0.7, d);
            vec3 oc = vt < 1.5 ? vec3(0.05) : vt < 2.5 ? vec3(0.62, 0.3, 0.17) : vec3(1.0, 0.78, 0.22);
            diffuseColor.rgb = mix(diffuseColor.rgb, oc, sp * 0.9); }`)
        .replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = (texture2D(normalMap, vWp.xz * 0.3).xyz * bw.y + texture2D(normalMap, vWp.zy * 0.3).xyz * bw.x + texture2D(normalMap, vWp.xy * 0.3).xyz * bw.z) * 2.0 - 1.0;')
        // al buio sottoterra: sole e cielo non arrivano in fondo alle gallerie, le torce sì
        .replace('#include <lights_fragment_begin>', 'float caveK = mix(1.0, 0.04, smoothstep(0.6, 4.5, vDepth));\n' + THREE.ShaderChunk.lights_fragment_begin
          .split('getDirectionalLightInfo( directionalLight, geometry, directLight );').join('getDirectionalLightInfo( directionalLight, geometry, directLight ); directLight.color *= caveK;')
          .replace('vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );', 'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor ) * mix(1.0, 0.35, 1.0 - caveK);')
          .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );', 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal ) * mix(caveK, 1.0, 0.12);'));
    };
    mat.customProgramCacheKey = () => 'digmat';
    return mat;
  }
  D.material = () => material();
  function buildCell(k) {
    const old = D.meshes.get(k); if (old) { G.scene.remove(old); old.geometry.dispose(); D.meshes.delete(k); }
    const l = D.cells.get(k); if (!l || !l.length) return;
    const [ix, iz] = k.split(',').map(Number);
    // limiti verticali dalle sfere
    let y0 = Infinity, y1 = -Infinity;
    for (const i of l) { const s = D.list[i], r = Math.abs(s[3]); y0 = Math.min(y0, s[1] - r - 1); y1 = Math.max(y1, s[1] + r + 1); }
    const X0 = ix * CELL - VOX, Z0 = iz * CELL - VOX, Y0 = Math.floor(y0 / VOX) * VOX;
    const NX = Math.ceil((CELL + 2 * VOX) / VOX) + 1, NZ = NX, NY = Math.ceil((y1 - Y0) / VOX) + 1;
    const hh = new Float32Array(NX * NZ); for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) hh[j * NX + i] = G.heightAt(X0 + i * VOX, Z0 + j * VOX);
    const den = new Float32Array(NX * NY * NZ), at = (i, j, kk) => (kk * NY + j) * NX + i;
    for (let kk = 0; kk < NZ; kk++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) den[at(i, j, kk)] = D.density(X0 + i * VOX, Y0 + j * VOX, Z0 + kk * VOX, hh[kk * NX + i]);
    // un vertice per ogni cubo attraversato dalla superficie
    const vid = new Int32Array((NX - 1) * (NY - 1) * (NZ - 1)).fill(-1), cid = (i, j, kk) => (kk * (NY - 1) + j) * (NX - 1) + i;
    const pos = [], nor = [], dep = [], col = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float32Array(8);
    for (let kk = 0; kk < NZ - 1; kk++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) { const v = den[at(i + (c & 1), j + ((c >> 1) & 1), kk + ((c >> 2) & 1))]; cv[c] = v; if (v > 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        const va = cv[a], vb = cv[b]; if ((va > 0) === (vb > 0)) continue;
        const t = va / (va - vb);
        sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); n++;
      }
      const px = X0 + (i + sx / n) * VOX, py = Y0 + (j + sy / n) * VOX, pz = Z0 + (kk + sz / n) * VOX;
      vid[cid(i, j, kk)] = pos.length / 3;
      pos.push(px, py, pz);
      // normale dal gradiente della densità
      const e = 0.25; let gx = D.density(px + e, py, pz) - D.density(px - e, py, pz), gy = D.density(px, py + e, pz) - D.density(px, py - e, pz), gz = D.density(px, py, pz + e) - D.density(px, py, pz - e);
      const gl = Math.hypot(gx, gy, gz) || 1; nor.push(-gx / gl, -gy / gl, -gz / gl);
      dep.push(Math.max(0, G.heightAt(px, pz) - py));
      const sh = 0.85 + G.hash2(Math.round(px * 2), Math.round(pz * 2 + py * 3), 91) * 0.2; col.push(sh, sh, sh);
    }
    // facce: per ogni spigolo attraversato, un quadrilatero tra i 4 cubi che lo condividono
    const idx = [];
    const keep = (a, b, c) => {
      // tieni solo le facce delle gallerie: quelle sulla superficie originale le disegna già il terreno
      const x = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, y = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, z = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
      return carveRaw(x, y, z, l) > -0.32;
    };
    const quad = (a, b, c, d2, flip) => { if (a < 0 || b < 0 || c < 0 || d2 < 0) return; if (flip) { if (keep(a, c, b)) idx.push(a, c, b); if (keep(a, d2, c)) idx.push(a, d2, c); } else { if (keep(a, b, c)) idx.push(a, b, c); if (keep(a, c, d2)) idx.push(a, c, d2); } };
    for (let kk = 1; kk < NZ - 1; kk++) for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const v0 = den[at(i, j, kk)] > 0;
      if ((den[at(i + 1, j, kk)] > 0) !== v0) quad(vid[cid(i, j - 1, kk - 1)], vid[cid(i, j, kk - 1)], vid[cid(i, j, kk)], vid[cid(i, j - 1, kk)], !v0);
      if ((den[at(i, j + 1, kk)] > 0) !== v0) quad(vid[cid(i - 1, j, kk - 1)], vid[cid(i - 1, j, kk)], vid[cid(i, j, kk)], vid[cid(i, j, kk - 1)], !v0);
      if ((den[at(i, j, kk + 1)] > 0) !== v0) quad(vid[cid(i - 1, j - 1, kk)], vid[cid(i, j - 1, kk)], vid[cid(i, j, kk)], vid[cid(i - 1, j, kk)], !v0);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material()); m.receiveShadow = true; m.castShadow = true;
    G.scene.add(m); D.meshes.set(k, m);
  }
  // si ricostruiscono prima le celle vicine, poche per fotogramma (le grotte sono grandi: niente scatti)
  D.update = function () {
    if (D.dirty.size) {
      const P = G.Player, px = P.pos.x / CELL, pz = P.pos.z / CELL, t0 = performance.now();
      const ks = [...D.dirty].map((k) => { const [a, b] = k.split(',').map(Number); return [k, Math.hypot(a + 0.5 - px, b + 0.5 - pz)]; }).sort((a, b) => a[1] - b[1]);
      for (const [k, d] of ks) {
        if (d * CELL > 220 && D.meshes.size) break; // lontane: aspettano
        if (d * CELL > 52) { const l = D.cells.get(k); if (l && l.every((i) => D.list[i].hid)) continue; } // caverne chiuse lontane: non si vedono
        D.dirty.delete(k); buildCell(k);
        if (performance.now() - t0 > (G.started ? 7 : 400)) break;
      }
    }
    if (D.uniformDirty || (D._ut = (D._ut || 0) + 1) % 30 === 0) updateUniforms();
  };
  // il terreno normale si "buca" dentro le sfere scavate più vicine (fino a 64)
  D.U = { uVein: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -999, 0, 1)) }, uVeinN: { value: 0 }, uDig: { value: Array.from({ length: 64 }, () => new THREE.Vector4(0, -999, 0, 0)) }, uDigN: { value: 0 },
    // per l'acqua: solo gli scavi sotto terra ferma (montagne, colline): lì il mare non deve comparire
    uDigW: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, -999, 0, 0)) }, uDigWN: { value: 0 } };
  function updateUniforms() {
    D.uniformDirty = false;
    const P = G.Player, carves = D.list.filter((s) => s[3] > 0 && s.surf !== false), list = carves.length > 64 ? carves.slice().sort((a, b) => Math.hypot(a[0] - P.pos.x, a[2] - P.pos.z) - a[3] - Math.hypot(b[0] - P.pos.x, b[2] - P.pos.z) + b[3]).slice(0, 64) : carves;
    for (let i = 0; i < 64; i++) { const s = list[i]; if (s && s[3] > 0) D.U.uDig.value[i].set(s[0], s[1], s[2], s[3] - 0.04); else D.U.uDig.value[i].set(0, -999, 0, 0); }
    D.U.uDigN.value = list.length;
    let n = 0;
    const all = D.list.filter((s) => s[3] > 0), listW = all.length > 24 ? all.slice().sort((a, b) => Math.hypot(a[0] - P.pos.x, a[1] - P.pos.y, a[2] - P.pos.z) - Math.hypot(b[0] - P.pos.x, b[1] - P.pos.y, b[2] - P.pos.z)) : all;
    for (const s of listW) { if (n >= 24) break; if (s[3] > 0 && G.heightAt(s[0], s[2]) > G.SEA + 1) D.U.uDigW.value[n++].set(s[0], s[1], s[2], s[3] + 0.4); }
    for (let i = n; i < 24; i++) D.U.uDigW.value[i].set(0, -999, 0, 0);
    D.U.uDigWN.value = n;
    // vene vicine al giocatore (solo dove si scava si vedono)
    const vs = D.list.length ? D.veinsNear(P.pos.x, P.pos.y, P.pos.z, 14).filter((v) => near(v.x, v.z)).slice(0, 16) : [];
    vs.forEach((v, i) => D.U.uVein.value[i].set(v.x, v.y, v.z, Math.floor(v.r + 0.5) + v.type / 10 + 0.001));
    D.U.uVeinN.value = vs.length;
  }
  // un punto dentro uno scavo sotto terra ferma: niente mare (anche se è sotto il livello del mare)
  D.dryAt = function (x, y, z) {
    const l = near(x, z); if (!l || G.heightAt(x, z) <= G.SEA + 1) return false;
    for (const i of l) { const s = D.list[i]; if (s[3] < 0) continue; const dx = x - s[0], dy = y - s[1], dz = z - s[2]; if (dx * dx + dy * dy + dz * dz < (s[3] + 1.5) * (s[3] + 1.5)) return true; }
    return false;
  };
})();
