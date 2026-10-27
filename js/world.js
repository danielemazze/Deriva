'use strict';
/* ==========================================================
   Mondo: materiali, chunk infiniti, vegetazione istanziata,
   risorse raccoglibili e collisioni
   ========================================================== */
(function () {
  const G = globalThis.G;
  const W = (G.World = { chunks: new Map(), kinds: {}, dirty: new Set(), queue: [] });
  const M = G.MODELS;

  /* ---------------- MATERIALI ---------------- */
  G.createMaterials = function (TEX, settings) {
    const MAT = (G.MAT = {});
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const leafDepth = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    const PH = G.PHOTO || {};
    const ph = (k, fb) => PH[k] || fb;
    MAT.terrain = G.patch(std({ map: ph('grass', TEX.grassT.map), normalMap: ph('grassN', TEX.grassT.normal), normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.95 }), {
      terrain: { tSand: { value: ph('sand', TEX.sandT.map) }, tSandN: { value: ph('sandN', TEX.sandT.normal) }, tRock: { value: ph('gravel', TEX.rockT.map) }, tRockN: { value: ph('gravelN', TEX.rockT.normal) },
        tDirt: { value: ph('dirt', TEX.sandT.map) }, tDirtN: { value: ph('dirtN', TEX.sandT.normal) }, tSea: { value: ph('seabed', TEX.sandT.map) }, tSeaN: { value: ph('seabedN', TEX.sandT.normal) },
        uDual: (MAT.uDual = { value: G.lowQ() ? 0 : 1 }) },
      key: 'terrain',
    });
    const treeWind = { amp: 0.0035, freq: 1.05, mode: 'tip' };
    if (PH.bark) { PH.bark.repeat.set(1, 0.35); PH.barkN.repeat.set(1, 0.35); }
    MAT.bark = G.patch(std({ map: ph('bark', TEX.barkT.map), normalMap: ph('barkN', TEX.barkT.normal), normalScale: new THREE.Vector2(1.6, 1.6), vertexColors: true, roughness: 0.95 }), { wind: treeWind, key: 'bark' });
    MAT.palmBark = G.patch(std({ map: TEX.palmBarkT.map, normalMap: TEX.palmBarkT.normal, vertexColors: true, roughness: 0.92 }), { wind: treeWind, key: 'pbark' });
    MAT.leaves = {};
    for (const k of ['leavesOak', 'leavesBirch', 'pine', 'frond']) {
      const photo = k === 'leavesOak' ? PH.leaves1 : k === 'leavesBirch' ? PH.leaves0 : null;
      const map = photo || TEX[k + 'T'];
      const m = G.patch(std({ map, normalMap: k === 'leavesOak' ? PH.leaves1N : k === 'leavesBirch' ? PH.leaves0N : null, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.82 }), { wind: Object.assign({ flutter: k === 'frond' ? 0.004 : 0.008 }, treeWind), backShade: true, key: 'leaf' + k });
      m.userData.depth = leafDepth(map);
      MAT.leaves[k] = m;
    }
    MAT.bushLeaves = G.patch(std({ map: ph('leaves1', TEX.leavesOakT), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 }), { wind: { amp: 0.05, freq: 1.4, mode: 'tip', flutter: 0.01 }, backShade: true, key: 'bush' });
    MAT.bushLeaves.userData.depth = leafDepth(ph('leaves1', TEX.leavesOakT));
    MAT.berries = G.patch(std({ vertexColors: true, roughness: 0.4 }), { wind: { amp: 0.05, freq: 1.4, mode: 'tip' }, key: 'berry' });
    MAT.grass = G.patch(std({ map: TEX.grassCardT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), { wind: { amp: 0.32, freq: 1.7, mode: 'tip' }, fadeDist: true, key: 'grass' });
    MAT.flowers = G.patch(std({ map: TEX.flowerCardT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), { wind: { amp: 0.3, freq: 1.5, mode: 'tip' }, fadeDist: true, key: 'flower' });
    MAT.seagrass = G.patch(std({ map: ph('seaweed', TEX.grassCardT), color: PH.seaweed ? 0xffffff : 0x6f9a50, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), { wind: { amp: 0.25, freq: 0.8, mode: 'tip' }, key: 'sgrass' });
    MAT.rock = G.patch(std({ map: TEX.rockT.map, normalMap: TEX.rockT.normal, vertexColors: true, roughness: 0.9 }), { key: 'rock', moss: { th: 0.6, amt: 0.75 } });
    MAT.oldWood = G.patch(std({ map: ph('bark', TEX.barkT.map), normalMap: ph('barkN', TEX.barkT.normal), normalScale: new THREE.Vector2(1.6, 1.6), vertexColors: true, roughness: 0.95 }), { key: 'oldwood', moss: { th: 0.55, amt: 0.7 } });
    MAT.drift = G.patch(std({ map: ph('bark', TEX.barkT.map), normalMap: ph('barkN', TEX.barkT.normal), vertexColors: true, roughness: 0.9, color: 0xd8d2c8 }), { key: 'drift' });
    const card = (map, wind, key, extra) => { const m = G.patch(std(Object.assign({ map, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85 }, extra || {})), { wind, backShade: true, key }); m.userData.depth = leafDepth(map); return m; };
    MAT.fern = card(TEX.fernT, { amp: 0.06, freq: 1.3, mode: 'tip', flutter: 0.01 }, 'fern');
    MAT.trop = card(TEX.tropLeafT, { amp: 0.05, freq: 1.0, mode: 'tip', flutter: 0.008 }, 'trop', { roughness: 0.6 });
    MAT.reed = G.patch(std({ map: TEX.reedT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), { wind: { amp: 0.12, freq: 1.2, mode: 'tip' }, key: 'reed' });
    MAT.pebble = G.patch(std({ map: TEX.rockT.map, vertexColors: true, roughness: 0.7 }), { key: 'pebble' });
    // materiali delle scansioni fotogrammetriche
    MAT.scan = {};
    if (G.SCAN) for (const [mat, t] of Object.entries(G.SCAN.tex)) {
      const alpha = /moss_01/.test(mat), tree = /quiver/.test(mat);
      const m = G.patch(std({ map: t.map, normalMap: t.normalMap || null, normalScale: new THREE.Vector2(1, 1), roughness: 0.92, alphaTest: alpha ? 0.4 : 0, side: alpha || tree ? THREE.DoubleSide : THREE.FrontSide }),
        { key: 'scan_' + mat, wind: alpha ? { amp: 0.25, freq: 1.4, mode: 'tip' } : tree ? { amp: 0.004, freq: 1.0, mode: 'tip' } : undefined, backShade: alpha || tree });
      if (alpha) m.userData.depth = leafDepth(t.map);
      MAT.scan[mat] = m;
    }
    MAT.cactus = G.patch(std({ map: TEX.cactusT.map, normalMap: TEX.cactusT.normal, vertexColors: true, roughness: 0.62 }), { key: 'cactus' });
    MAT.mush = G.patch(std({ vertexColors: true, roughness: 0.6 }), { key: 'mush' });
    MAT.solid = G.patch(std({ vertexColors: true, roughness: 0.65 }), { key: 'solid' });
    MAT.coral = G.patch(std({ map: TEX.coralT.map, normalMap: TEX.coralT.normal, vertexColors: true, roughness: 0.75 }), { key: 'coral' });
    MAT.fan = G.patch(std({ map: M.fanTexture(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }), { wind: { amp: 0.06, freq: 0.6, mode: 'kelp' }, key: 'fan' });
    MAT.kelp = G.patch(std({ map: TEX.kelpT, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), { wind: { amp: 0.09, freq: 0.55, mode: 'kelp' }, key: 'kelp' });
    MAT.shell = G.patch(std({ map: TEX.shellT.map, normalMap: TEX.shellT.normal, vertexColors: true, roughness: 0.5 }), { key: 'shell' });
    MAT.planks = G.patch(std({ map: TEX.planksT.map, normalMap: TEX.planksT.normal, vertexColors: true, roughness: 0.82 }), { key: 'planks' });
    MAT.logs = G.patch(std({ map: TEX.barkT.map, normalMap: TEX.barkT.normal, vertexColors: true, roughness: 0.9 }), { key: 'logs' });
    MAT.cloth = G.patch(std({ map: TEX.clothT.map, normalMap: TEX.clothT.normal, side: THREE.DoubleSide, vertexColors: true, roughness: 0.95 }), { key: 'cloth' });
    MAT.planksB = G.patch(std({ map: TEX.planksT.map, normalMap: TEX.planksT.normal, vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }), { key: 'planksB', alphaTag: 0.85 });
    MAT.logsB = G.patch(std({ map: TEX.barkT.map, normalMap: TEX.barkT.normal, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { key: 'logsB', alphaTag: 0.85 });
    MAT.rope = G.patch(std({ color: 0xc8a46a, roughness: 0.9 }), { key: 'rope' });
    TEX.woolT.map.repeat.set(3, 2); TEX.woolT.normal.repeat.set(3, 2);
    MAT.wool = G.patch(std({ map: TEX.woolT.map, normalMap: TEX.woolT.normal, color: 0xe8e2d6, roughness: 1 }), { key: 'wool' });
    MAT.cow = G.patch(std({ map: TEX.cowHideT.map, color: 0xd8d4cc, roughness: 0.85 }), { key: 'cow' });
    MAT.anim = G.patch(std({ vertexColors: true, roughness: 0.8 }), { key: 'anim' });
    MAT.turtle = G.patch(std({ map: TEX.shellT.map, normalMap: TEX.shellT.normal, roughness: 0.55 }), { key: 'turtle' });
    return MAT;
  };

  /* ---------------- TIPI ISTANZIATI ----------------
     Le istanze sono raggruppate per celle di 3×3 chunk: ogni cella ha la
     propria InstancedMesh con una sfera di contenimento, così la camera e la
     luce delle ombre scartano le celle che non vedono. */
  const CELLC = 2;
  // oltre questa distanza (m) dal giocatore una cella usa i modelli semplificati e non proietta ombre
  W.LOD_DIST = 110;
  W.cellOf = (cx, cz) => Math.floor(cx / CELLC) + ':' + Math.floor(cz / CELLC);
  function addKind(key, parts, opts) {
    const k = { key, parts, cells: new Map(), wraps: new Map(), opts: opts || {}, near: (opts && opts.near) || 0, count: 0 };
    k.hasLod = !k.near && parts.some((p) => p.lod || p.shadow);
    // "split": ogni oggetto sceglie il dettaglio in base alla propria distanza (vicino = pieno, poi medio, lontano = minimo)
    k.split = (!!(opts && opts.split) && parts.some((p) => p.lod)) || !!(opts && opts.nearOnly);
    W.kinds[key] = k;
    return k;
  }
  // distanza dal giocatore al bordo della cella
  function cellDist(cellKey) {
    const [ix, iz] = cellKey.replace('n', '').split(':').map(Number), span = CELLC * G.CHUNK;
    const px = W.px || 0, pz = W.pz || 0;
    const dx = Math.max(ix * span - px, 0, px - (ix + 1) * span), dz = Math.max(iz * span - pz, 0, pz - (iz + 1) * span);
    return Math.hypot(dx, dz);
  }
  // livello di dettaglio della cella: 0 pieno, 1 semplificato, 2 minimo (solo i "split")
  const wantLod = (k, cellKey) => k.split ? (cellDist(cellKey) > W.LOD_DIST ? 2 : 1) : (k.hasLod && cellDist(cellKey) > W.LOD_DIST ? 1 : 0);
  // distanze secondo la qualità grafica
  W.quality = function () {
    const S = G.settings || {}, p = S.preset === 'custom' ? S.basePreset : S.preset, low = G.lowQ && G.lowQ();
    W.NEAR_D = p === 'minima' ? 10 : low ? 15 : p === 'ultra' ? 42 : p === 'alta' ? 32 : 22;
    W.LOD_DIST = p === 'minima' ? 55 : low ? 75 : p === 'ultra' ? 170 : p === 'alta' ? 140 : 110;
  };
  function dropCell(k, cellKey) {
    const c = k.cells.get(cellKey); if (!c) return;
    for (const im of c.meshes) { W.scene.remove(im); im.dispose(); }
    k.cells.delete(cellKey);
  }
  function cellMeshes(k, cellKey, lod) {
    let c = k.cells.get(cellKey);
    if (c && c.lod === lod) return c;
    if (c) dropCell(k, cellKey);
    const [ix, iz] = cellKey.replace('n', '').split(':').map(Number);
    const span = CELLC * G.CHUNK;
    const center = new THREE.Vector3((ix + 0.5) * span, 0, (iz + 0.5) * span);
    c = { meshes: [], cap: 16, lod };
    for (const p of k.parts) {
      const src = lod === 2 ? (p.lod2 || p.lod || p.geo) : lod ? (p.lod || p.geo) : p.geo;
      // geometria "involucro" che condivide gli attributi ma ha la propria sfera
      // (non si fa dispose: gli attributi sono condivisi; il guscio si riusa al cambio di dettaglio)
      const wk = cellKey + '|' + (+lod || 0) + '|' + k.parts.indexOf(p);
      let g = k.wraps.get(wk);
      if (!g) {
        g = new THREE.BufferGeometry();
        for (const name in src.attributes) g.setAttribute(name, src.attributes[name]);
        if (src.index) g.setIndex(src.index);
        g.boundingSphere = new THREE.Sphere(center, span * 0.72 + 45);
        g.boundingBox = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(span + 30, 120, span + 30));
        k.wraps.set(wk, g);
      }
      const im = new THREE.InstancedMesh(g, p.mat, 16);
      im.count = 0; im.frustumCulled = true;
      im.castShadow = !!p.shadow && (k.split ? lod < 2 : !lod); im.receiveShadow = true;
      if (p.mat.userData.depth) im.customDepthMaterial = p.mat.userData.depth;
      if (k.opts.colors) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3), 3);
      W.scene.add(im);
      c.meshes.push(im);
    }
    k.cells.set(cellKey, c);
    return c;
  }
  W.VAR = { oak: 6, birch: 4, pine: 5, palm: 6, rock: 8, drift: 3, stump: 2 };
  W.markDirty = (kind, cx, cz) => W.dirty.add(kind + '|' + W.cellOf(cx, cz));
  W.init = function (scene, settings) {
    W.scene = scene; W.settings = settings;
    const MAT = G.MAT;
    W.treeInfo = {};
    const tree = (key, model) => {
      const leafMat = MAT.leaves[model.leafTex];
      addKind(key, [{ geo: model.trunk, lod: model.trunkLod, mat: model.leafTex === 'frond' ? MAT.palmBark : MAT.bark, shadow: true }, { geo: model.leaves, lod: model.leavesLod, mat: leafMat, shadow: true }], { split: G.lowQ() });
      W.treeInfo[key] = model;
    };
    for (let v = 0; v < W.VAR.oak; v++) tree('oak' + v, M.oak(100 + v));
    for (let v = 0; v < W.VAR.birch; v++) tree('birch' + v, M.oak(200 + v, true));
    for (let v = 0; v < W.VAR.pine; v++) tree('pine' + v, M.pine(300 + v));
    for (let v = 0; v < W.VAR.palm; v++) tree('palm' + v, M.palm(400 + v));
    for (let v = 0; v < 3; v++) { const b = M.bush(500 + v, false); addKind('bush' + v, [{ geo: b.leaves, mat: MAT.bushLeaves, shadow: true }], { near: 3 }); }
    for (let v = 0; v < 2; v++) { const b = M.bush(600 + v, true); addKind('berry' + v, [{ geo: b.leaves, mat: MAT.bushLeaves, shadow: true }, { geo: b.props, mat: MAT.berries }], { near: 3 }); }
    const SC = G.SCAN;
    // modello scansionato normalizzato: lato orizzontale più lungo = "span" metri
    const scan = (name, span) => {
      const inf = SC.info[name], k = span / Math.max(inf.size[0], inf.size[2]);
      const geos = SC.geo[name].map((g) => G.TEX.scaledGeo(g, k));
      return { geo: geos[0], lod: geos[1] || null, lod2: geos[2] || null, mat: MAT.scan[inf.mat], size: inf.size.map((v) => v * k) };
    };
    W.scanned = !!SC;
    if (SC) {
      W.VAR.rock = 6; W.VAR.drift = 1; W.VAR.stump = 1;
      W.rockInfo = {};
      for (let v = 0; v < 6; v++) { const r = scan('roccia' + v, 2.3); W.rockInfo['rock' + v] = r; addKind('rock' + v, [{ geo: r.geo, lod: r.lod, lod2: r.lod2, mat: r.mat, shadow: true }], { split: true }); }
      const c0 = scan('scogliera0', 7), c1 = scan('scogliera1', 11);
      W.cliffInfo = [c0, c1];
      addKind('cliff0', [{ geo: c0.geo, lod: c0.lod, lod2: c0.lod2, mat: c0.mat, shadow: true }], { split: true });
      addKind('cliff1', [{ geo: c1.geo, lod: c1.lod, lod2: c1.lod2, mat: c1.mat, shadow: true }], { split: true });
      const br = scan('ramo', 3.2); addKind('drift0', [{ geo: br.geo, lod: br.lod, lod2: br.lod2, mat: br.mat, shadow: true }], { near: 3, split: true });
      const st = scan('radici', 1.5); addKind('stump0', [{ geo: st.geo, lod: st.lod, lod2: st.lod2, mat: st.mat, shadow: true }], { near: 3, split: true });
      const ms = scan('muschio', 1.4); addKind('moss0', [{ geo: ms.geo, mat: ms.mat }], { near: 1, nearOnly: 26 });
      const fq = scan('faretra', 2.6);
      addKind('faretra0', [{ geo: fq.geo, lod: fq.lod, lod2: fq.lod2, mat: fq.mat, shadow: true }], { split: true });
      W.treeInfo.faretra0 = { trunk: fq.geo, scanMat: fq.mat, height: fq.size[1], radius: 0.3 };
    }
    for (let v = 0; v < W.VAR.rock && !SC; v++) addKind('rock' + v, [{ geo: M.rock(700 + v, v > 4), lod: M.rock(700 + v, v > 4, 1), mat: MAT.rock, shadow: true }]);
    // vene di minerale in superficie: rocce con macchie di carbone, ferro o oro
    const veinGeo = (seed, det, col) => {
      const g = M.rock(seed, false, det), c = g.attributes.color, p = g.attributes.position, rnd = G.mulberry32(seed + 7);
      for (let i = 0; i < p.count; i++) { const k = Math.sin(p.getX(i) * 7.1 + seed) * Math.sin(p.getY(i) * 6.3) * Math.sin(p.getZ(i) * 8.7 + 1.3);
        if (k > 0.12 || rnd() < 0.08) c.setXYZ(i, col[0], col[1], col[2]); else c.setXYZ(i, c.getX(i) * 0.82, c.getY(i) * 0.8, c.getZ(i) * 0.78); }
      c.needsUpdate = true; return g;
    };
    W.VEIN_COL = { 1: [0.07, 0.07, 0.08], 2: [0.72, 0.36, 0.2], 3: [1.25, 0.95, 0.3] };
    for (const t of [1, 2, 3]) addKind('vena' + t, [{ geo: veinGeo(840 + t, 2, W.VEIN_COL[t]), lod: veinGeo(840 + t, 1, W.VEIN_COL[t]), mat: MAT.rock, shadow: true }]);
    for (let v = 0; v < 3; v++) addKind('fern' + v, [{ geo: M.fern(1000 + v), mat: MAT.fern, shadow: true }], { near: 2 });
    for (let v = 0; v < 3; v++) addKind('trop' + v, [{ geo: M.tropical(1100 + v), mat: MAT.trop, shadow: true }], { near: 3 });
    for (let v = 0; v < 4; v++) addKind('mush' + v, [{ geo: M.mushrooms(1200 + v), mat: MAT.mush }], { near: 2 });
    W.logInfo = [];
    for (let v = 0; v < 3; v++) { const l = M.log(1300 + v); W.logInfo.push(l); addKind('log' + v, [{ geo: l.geo, mat: MAT.oldWood, shadow: true }], { near: 3 }); }
    for (let v = 0; v < 2 && !SC; v++) addKind('stump' + v, [{ geo: M.stump(1400 + v), mat: MAT.oldWood, shadow: true }], { near: 3 });
    for (let v = 0; v < 3 && !SC; v++) addKind('drift' + v, [{ geo: M.driftwood(1500 + v), mat: MAT.drift, shadow: true }], { near: 3 });
    for (let v = 0; v < 2; v++) addKind('pebbles' + v, [{ geo: M.pebbles(1600 + v), mat: MAT.pebble }], { near: 2 });
    for (let v = 0; v < 3; v++) addKind('cactus' + v, [{ geo: M.cactus(1700 + v), mat: MAT.cactus, shadow: true }], { near: 4 });
    addKind('reeds', [{ geo: M.cards(1.3, 1.9, 3, true), mat: MAT.reed }], { near: 2 });
    addKind('grass', [{ geo: M.cards(1.15, 0.8, 3, true), mat: MAT.grass }], { near: 2 });
    addKind('flowers', [{ geo: M.cards(1.0, 0.65, 2, true), mat: MAT.flowers }], { near: 2 });
    const UWN = G.lowQ() ? 1 : 2; // fondale: sulle schede integrate solo attorno al giocatore
    addKind('seagrass', [{ geo: M.cards(1.0, 0.9, 3, true), mat: MAT.seagrass }], { near: UWN });
    for (let v = 0; v < 3; v++) addKind('cbranch' + v, [{ geo: M.coralBranch(800 + v), mat: MAT.coral }], { colors: true, near: UWN });
    for (let v = 0; v < 2; v++) addKind('cbrain' + v, [{ geo: M.coralBrain(850 + v), mat: MAT.coral }], { colors: true, near: UWN });
    for (let v = 0; v < 2; v++) addKind('ctube' + v, [{ geo: M.coralTube(870 + v), mat: MAT.coral }], { colors: true, near: UWN });
    for (let v = 0; v < 2; v++) addKind('cfan' + v, [{ geo: M.coralFan(890 + v), mat: MAT.fan }], { colors: true, near: UWN });
    addKind('anemone', [{ geo: M.anemone(900), mat: MAT.coral }], { colors: true, near: UWN });
    addKind('kelp0', [{ geo: M.kelp(6), mat: MAT.kelp }], { near: UWN });
    addKind('kelp1', [{ geo: M.kelp(10), mat: MAT.kelp }], { near: UWN });
    addKind('starfish', [{ geo: M.starfish(), mat: MAT.solid }], { colors: true, near: UWN });
    addKind('seashell', [{ geo: M.seashell(), mat: MAT.shell, shadow: true }], { colors: true, near: 2 });
    W.terrainGroup = new THREE.Group(); scene.add(W.terrainGroup);
  };

  /* ---------------- TERRENO ---------------- */
  W.res = function () { const S = W.settings, p = S.preset === 'custom' ? S.basePreset || 'media' : S.preset; return p === 'minima' || p === 'bassa' ? 32 : p === 'media' ? 48 : 64; };
  // altezza coerente con la mesh (interpolazione sui triangoli)
  W.groundAt = function (x, z) {
    const N = W.res(), step = G.CHUNK / N;
    const gx = x / step, gz = z / step;
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const h = (a, b) => G.heightAt(a * step, b * step);
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
    // triangoli (a,c,b) e (b,c,d)
    const g = fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    // mare ghiacciato: si cammina sulla banchisa
    if (g < G.SEA - 0.2 && G.coldAt(x, z) > 0.55 && G.iceAt(x, z)) return G.SEA + G.ICE_Y;
    return g;
  };
  function buildTerrain(cx, cz) {
    const N = W.res(), step = G.CHUNK / N, x0 = cx * G.CHUNK, z0 = cz * G.CHUNK;
    const S = N + 3, H = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = G.heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
    const V = N + 1;
    const pos = new Float32Array(V * V * 3), nor = new Float32Array(V * V * 3), uv = new Float32Array(V * V * 2), bio = new Float32Array(V * V * 4), bio2 = new Float32Array(V * V * 3), bw = [0, 0, 0, 0], bw2 = [0, 0];
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i, x = x0 + i * step, z = z0 + j * step, hh = H[(j + 1) * S + i + 1];
      pos[k * 3] = x; pos[k * 3 + 1] = hh; pos[k * 3 + 2] = z;
      const hl = H[(j + 1) * S + i], hr = H[(j + 1) * S + i + 2], hd = H[j * S + i + 1], hu = H[(j + 2) * S + i + 1];
      let nx = hl - hr, ny = 2 * step, nz = hd - hu; const l = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
      uv[k * 2] = x * 0.22; uv[k * 2 + 1] = z * 0.22;
      G.biomeW(x, z, bw); bio[k * 4] = bw[0]; bio[k * 4 + 1] = bw[1]; bio[k * 4 + 2] = bw[2]; bio[k * 4 + 3] = bw[3];
      G.biomeW2(x, z, bw2); bio2[k * 3] = bw2[0]; bio2[k * 3 + 1] = bw2[1];
      // chiome degli alberi (per il sottobosco di muschio e i boschi lontani)
      { const bf = [0.15, 1, 1, 0.75, 0, hh < 30 ? 0.65 : 0, hh < 26 ? 0.35 : 0, 0][G.biomeAt(x, z)] || 0; bio2[k * 3 + 2] = hh > 2.6 ? G.smooth(0.25, 0.75, G.nD(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5) * bf : 0; }
    }
    const idx = new Uint32Array(N * N * 6); let o = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aBio', new THREE.BufferAttribute(bio, 4));
    g.setAttribute('aBio2', new THREE.BufferAttribute(bio2, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, G.MAT.terrain);
    m.receiveShadow = true; m.castShadow = W.settings.shadows >= 2048;
    let minH = Infinity, maxH = -Infinity; for (const v of H) { if (v < minH) minH = v; if (v > maxH) maxH = v; }
    return { mesh: m, minH, maxH };
  }

  /* ---------------- POPOLAMENTO ---------------- */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();
  function matrix(x, y, z, ry, s, tilt) {
    _q.setFromEuler(_e.set(0, ry, 0));
    if (tilt) { const tq = new THREE.Quaternion().setFromUnitVectors(_up, tilt); _q.premultiply(tq); }
    _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
    return _m.toArray(new Float32Array(16));
  }
  const CORAL_COLS = [[1.0, 0.25, 0.42], [1.0, 0.45, 0.12], [0.55, 0.22, 0.95], [1.0, 0.8, 0.15], [0.15, 0.85, 0.75], [0.95, 0.15, 0.2], [0.3, 0.6, 1.0], [0.9, 0.85, 0.75], [1.0, 0.5, 0.75]];

  function populate(ch) {
    const cx = ch.cx, cz = ch.cz, x0 = cx * G.CHUNK, z0 = cz * G.CHUNK, C = G.CHUNK;
    const removed = G.state.removed;
    const add = (kind, id, entry, res) => {
      if (removed.has(id)) return;
      let arr = ch.data[kind]; if (!arr) arr = ch.data[kind] = [];
      entry.id = id; entry.kind = kind;
      arr.push(entry);
      if (res) { res.id = id; res.kind = kind; res.entry = entry; res.chunk = ch; ch.resources.push(res); }
    };
    const grassD = W.settings.grass;
    // niente alberi e rocce dentro villaggi, fari e covi
    const poiNear = G.POI ? G.POI.near(x0 + C / 2, z0 + C / 2, C * 0.75 + 60).filter((p) => p.type !== 'relitto') : [];
    const clr = poiNear.length ? (x, z) => G.POI.clearAt(x, z) : () => 0;
    if (ch.maxH > -1.5) {
      // alberi
      const TS = 7;
      for (let gz = 0; gz < C / TS; gz++) for (let gx = 0; gx < C / TS; gx++) {
        const cellX = cx * 100 + gx, cellZ = cz * 100 + gz;
        const r0 = G.hash2(cellX, cellZ, 1);
        const x = x0 + (gx + 0.15 + G.hash2(cellX, cellZ, 2) * 0.7) * TS, z = z0 + (gz + 0.15 + G.hash2(cellX, cellZ, 3) * 0.7) * TS;
        if (Math.hypot(x - 4, z - 6) < 9) continue; // radura di partenza
        if (clr(x, z)) continue;
        const h = G.heightAt(x, z); if (h < 0.9) continue;
        const nrm = G.normalAt(x, z); if (nrm[1] < 0.8) continue;
        const b = G.biomeAt(x, z), B = G.BIOME, hot = G.isHot(x, z);
        const forest = G.nD(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5;
        const v4 = G.hash2(cellX, cellZ, 4), v5 = G.hash2(cellX, cellZ, 5);
        const pick = (k) => k + ((v4 * W.VAR[k]) | 0);
        let kind = null, big = 1;
        if (h < 3.2) { if (b !== B.NEVE && b !== B.VULCANO && r0 < (b === B.DESERTO ? 0.12 : hot ? 0.55 : 0.1)) kind = pick('palm'); }
        else {
          // densità e specie per bioma
          const P = [0.06, 0.62 * (0.42 + forest), 0.92, 0.6 * (0.6 + forest * 0.6), 0.05, h < 30 ? 0.4 * (0.5 + forest) : 0, h < 26 ? 0.2 * (0.4 + forest) : 0, 0][b] || 0;
          if (r0 < P) {
            if (b === B.PIANURA) kind = v5 < 0.25 ? pick('birch') : pick('oak');
            else if (b === B.FORESTA) { kind = forest > 0.62 ? (v5 < 0.62 ? pick('pine') : v5 < 0.78 ? pick('birch') : pick('oak')) : v5 < 0.28 ? pick('birch') : v5 < 0.4 ? pick('pine') : pick('oak'); if (kind.startsWith('pine') && forest > 0.62) big = 1.25 + G.hash2(cellX, cellZ, 9) * 0.35; }
            else if (b === B.PLUVIALE) { kind = v5 < 0.15 ? pick('palm') : pick('oak'); if (kind.startsWith('oak')) big = 1.45 + G.hash2(cellX, cellZ, 9) * 0.6; }
            else if (b === B.GIUNGLA) kind = v5 < 0.55 ? pick('palm') : pick('oak');
            else if (b === B.DESERTO) kind = W.scanned && v5 < 0.7 ? 'faretra0' : pick('palm');
            else if (b === B.NEVE) kind = pick('pine');
            else kind = v5 < 0.85 || h > 18 ? pick('pine') : pick('birch');
          }
        }
        if (!kind) continue;
        const s = (0.8 + G.hash2(cellX, cellZ, 6) * 0.45) * big;
        const ry = G.hash2(cellX, cellZ, 7) * Math.PI * 2;
        const info = W.treeInfo[kind];
        const sub = kind.replace(/\d/, '');
        add(kind, `${cx},${cz},t,${gx},${gz}`, { m: matrix(x, h - 0.05, z, ry, s), x, y: h, z, s, ry }, { type: 'tree', sub, x, y: h, z, r: info.radius * s, hp: sub === 'pine' ? 6 : 5, height: info.height * s, solid: true });
      }
      // cespugli e rocce terrestri
      const BS = 6;
      for (let gz = 0; gz < C / BS; gz++) for (let gx = 0; gx < C / BS; gx++) {
        const cellX = cx * 100 + gx + 50, cellZ = cz * 100 + gz + 50;
        const r0 = G.hash2(cellX, cellZ, 11);
        const x = x0 + (gx + G.hash2(cellX, cellZ, 12)) * BS, z = z0 + (gz + G.hash2(cellX, cellZ, 13)) * BS;
        if (clr(x, z)) continue;
        const h = G.heightAt(x, z);
        const ry = G.hash2(cellX, cellZ, 14) * 6.28;
        const bb = h > 0.5 ? G.biomeAt(x, z) : -1, BB = G.BIOME;
        const bushP = [0.3, 0.22, 0.3, 0.32, 0, h < 22 ? 0.12 : 0, 0.04, 0][bb] || 0;
        const rockP = bb === BB.MONTAGNA ? 0.72 : bb === BB.DESERTO ? 0.82 : bb === BB.VULCANO ? 0.55 : bb === BB.NEVE ? 0.8 : 0.9;
        if (bb === BB.DESERTO && h > 2.2 && r0 < 0.3) {
          // cactus: alti a candelabro o bassi a botte
          const v = (G.hash2(cellX, cellZ, 16) * 3) | 0;
          const s = 0.75 + G.hash2(cellX, cellZ, 17) * 0.5;
          add('cactus' + v, `${cx},${cz},b,${gx},${gz}`, { m: matrix(x, h - 0.08, z, ry, s) }, { type: 'plant', sub: 'cactus', x, y: h, z, r: (v === 2 ? 0.45 : 0.32) * s, hp: 1, height: (v === 2 ? 0.5 : 3.2) * s, solid: v !== 2 });
        } else if (h > 2.0 && r0 < bushP) {
          const berry = G.hash2(cellX, cellZ, 15) < 0.35;
          const kind = berry ? 'berry' + ((G.hash2(cellX, cellZ, 16) * 2) | 0) : 'bush' + ((G.hash2(cellX, cellZ, 16) * 3) | 0);
          const s = 0.8 + G.hash2(cellX, cellZ, 17) * 0.6;
          add(kind, `${cx},${cz},b,${gx},${gz}`, { m: matrix(x, h - 0.1, z, ry, s) }, { type: 'bush', berry, x, y: h, z, r: 0.7 * s, hp: 1, height: 1.2 * s });
        } else if (r0 > rockP && h > 6 && (bb === BB.MONTAGNA || bb === BB.NEVE || bb === BB.VULCANO || h > 18) && G.hash2(cellX, cellZ, 31) < 0.2) {
          // vena di minerale affiorante: si rompe solo col piccone
          const nrm = G.normalAt(x, z), q = G.hash2(cellX, cellZ, 32);
          const t = (h > 28 || bb === BB.VULCANO) && q < 0.14 ? 3 : q < 0.5 ? 2 : 1;
          const s = 0.95 + G.hash2(cellX, cellZ, 18) * 0.5;
          add('vena' + t, `${cx},${cz},r,${gx},${gz}`, { m: matrix(x, h - 0.2 * s, z, ry, s, _n.set(nrm[0], nrm[1], nrm[2])) }, { type: 'rock', vein: true, x, y: h, z, r: 0.95 * s, hp: Math.ceil(4 + s * 2), height: s * 0.9, size: s, solid: true, ore: { 1: 'carbone', 2: 'ferro_grezzo', 3: 'oro_grezzo' }[t] });
        } else if (r0 > rockP && h > -30) {
          const nrm = G.normalAt(x, z);
          const s = (h > 0 ? 0.5 : 0.7) + G.hash2(cellX, cellZ, 18) * (h > 0 ? 1.2 : 1.8);
          const kind = 'rock' + ((G.hash2(cellX, cellZ, 19) * W.VAR.rock) | 0);
          add(kind, `${cx},${cz},r,${gx},${gz}`, { m: matrix(x, h - (W.scanned ? 0.12 : 0.15) * s, z, ry, s, _n.set(nrm[0], nrm[1], nrm[2])) }, { type: 'rock', x, y: h, z, r: 0.95 * s, hp: Math.ceil(2 + s * 2), height: s * 0.9, size: s, solid: s > 0.7, ore: bb === BB.VULCANO ? 'ossidiana' : null });
        }
      }
      // erba e fiori
      if (grassD > 0) {
        const GS = 1.7 / Math.sqrt(grassD);
        const n = Math.floor(C / GS);
        for (let gz = 0; gz < n; gz++) for (let gx = 0; gx < n; gx++) {
          const cellX = cx * 1000 + gx, cellZ = cz * 1000 + gz;
          const x = x0 + (gx + G.hash2(cellX, cellZ, 21)) * GS, z = z0 + (gz + G.hash2(cellX, cellZ, 22)) * GS;
          const h = G.heightAt(x, z);
          if (h < 2.6 || h > 24) continue;
          if (poiNear.length && clr(x, z) === 2) continue;
          const gb = G.biomeAt(x, z), GB = G.BIOME;
          if (gb === GB.DESERTO || gb === GB.VULCANO || gb === GB.NEVE || (gb === GB.MONTAGNA && h > 20) || (gb !== GB.MONTAGNA && h > 16)) continue;
          const dens = (G.nB(x * 0.03, z * 0.03) * 0.5 + 0.55) * (gb === GB.PIANURA ? 1.35 : gb === GB.MONTAGNA ? 0.55 : 1);
          const r = G.hash2(cellX, cellZ, 23);
          if (r > dens) continue;
          const nrm = G.normalAt(x, z); if (nrm[1] < 0.82) continue;
          const flower = G.hash2(cellX, cellZ, 24) < (gb === GB.PIANURA ? 0.16 : 0.06);
          const s = 0.7 + G.hash2(cellX, cellZ, 25) * 0.7;
          const kind = flower ? 'flowers' : 'grass';
          add(kind, `${cx},${cz},g,${gx},${gz}`, { m: matrix(x, h - 0.05, z, G.hash2(cellX, cellZ, 26) * 6.28, s) }, { type: 'grass', x, y: h, z, r: 0.45, hp: 1, height: 0.6, flower });
        }
      }
      // scogliere e speroni di roccia sui pendii ripidi vicino al mare
      if (W.scanned) {
        const KS = 22;
        for (let gz = 0; gz < C / KS; gz++) for (let gx = 0; gx < C / KS; gx++) {
          const cellX = cx * 100 + gx + 80, cellZ = cz * 100 + gz + 80;
          if (G.hash2(cellX, cellZ, 71) > (G.climate(x0 + gx * KS, z0 + gz * KS).mt > 0.4 ? 0.8 : 0.45)) continue;
          const x = x0 + (gx + 0.2 + G.hash2(cellX, cellZ, 72) * 0.6) * KS, z = z0 + (gz + 0.2 + G.hash2(cellX, cellZ, 73) * 0.6) * KS;
          if (Math.hypot(x - 4, z - 6) < 14 || clr(x, z)) continue;
          const h = G.heightAt(x, z); if (h < -3 || h > 40) continue;
          const nrm = G.normalAt(x, z); if (nrm[1] > 0.86 || nrm[1] < 0.4) continue;
          const k = G.hash2(cellX, cellZ, 74) < 0.5 ? 0 : 1, info = W.cliffInfo[k];
          const s = 0.7 + G.hash2(cellX, cellZ, 75) * 0.6;
          // orientato lungo il pendio
          const ry = Math.atan2(nrm[0], nrm[2]) + Math.PI / 2 + (G.hash2(cellX, cellZ, 76) - 0.5) * 0.6;
          const len = Math.max(info.size[0], info.size[2]) * s;
          add('cliff' + k, `${cx},${cz},k,${gx},${gz}`, { m: matrix(x, h - 0.5 * s, z, ry, s) }, { type: 'cliff', x, y: h, z, r: len * 0.28, hp: 999, height: info.size[1] * s, solid: true });
        }
      }
      // sottobosco: felci, piante tropicali, funghi, canne, ciottoli
      const US = 3.2;
      const un = Math.floor(C / US);
      for (let gz = 0; gz < un; gz++) for (let gx = 0; gx < un; gx++) {
        const cellX = cx * 1000 + gx + 300, cellZ = cz * 1000 + gz + 300;
        const r = G.hash2(cellX, cellZ, 51);
        if (r > 0.34) continue;
        const x = x0 + (gx + G.hash2(cellX, cellZ, 52)) * US, z = z0 + (gz + G.hash2(cellX, cellZ, 53)) * US;
        if (clr(x, z)) continue;
        const h = G.heightAt(x, z);
        if (h < 0.4 || h > 22) continue;
        const nrm = G.normalAt(x, z);
        const ry = G.hash2(cellX, cellZ, 54) * 6.28, v = G.hash2(cellX, cellZ, 55);
        const b0 = G.biomeAt(x, z), UB = G.BIOME;
        // per il sottobosco: 0 = tropicale (giungla/pluviale), 1 = temperato, 4 = deserto
        const b = b0 === UB.GIUNGLA || b0 === UB.PLUVIALE ? 0 : b0 === UB.DESERTO || b0 === UB.NEVE || b0 === UB.VULCANO ? 4 : 1;
        if (b0 === UB.MONTAGNA && h > 20) continue;
        const forest = Math.min(1, (G.nD(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5) * (b0 === UB.PIANURA ? 0.55 : 1) + (b0 === UB.PLUVIALE ? 0.45 : 0));
        const id = `${cx},${cz},u,${gx},${gz}`;
        if (b === 4) { if (r < 0.05 && nrm[1] > 0.85) add('pebbles' + ((v * 2) | 0), id, { m: matrix(x, h - 0.02, z, ry, 0.8 + v * 0.8) }); continue; }
        if (h < 2.3 && h > 0.7 && b !== 0 && nrm[1] > 0.9 && G.nB(x * 0.05 + 9, z * 0.05) > 0.05 && r < 0.3) {
          add('reeds', id, { m: matrix(x, h - 0.05, z, ry, 0.8 + v * 0.5) }, { type: 'plant', sub: 'reed', x, y: h, z, r: 0.4, hp: 1, height: 1.5 });
        } else if (h < 2.2 && h > -0.4 && nrm[1] > 0.85 && r < 0.05) {
          add('pebbles' + ((v * 2) | 0), id, { m: matrix(x, h - 0.02, z, ry, 0.8 + v * 0.8) });
        } else if (h > 2.6 && nrm[1] > 0.82) {
          if (b === 0 && r < (b0 === UB.PLUVIALE ? 0.2 : 0.12)) add('trop' + ((v * 3) | 0), id, { m: matrix(x, h - 0.05, z, ry, 0.7 + G.hash2(cellX, cellZ, 56) * 0.6) }, { type: 'plant', sub: 'trop', x, y: h, z, r: 0.6, hp: 1, height: 1.2 });
          else if ((b !== 0 || b0 === UB.PLUVIALE) && forest > 0.45 && r < 0.2 * forest) add('fern' + ((v * 3) | 0), id, { m: matrix(x, h - 0.05, z, ry, 0.8 + G.hash2(cellX, cellZ, 56) * 0.7) }, { type: 'plant', sub: 'fern', x, y: h, z, r: 0.5, hp: 1, height: 0.7 });
          else if (W.scanned && !G.lowQ() && (b !== 0 || b0 === UB.PLUVIALE) && forest > 0.4 && r > 0.2 && r < 0.27) add('moss0', id, { m: matrix(x, h - 0.03, z, ry, 0.8 + G.hash2(cellX, cellZ, 56) * 0.6) });
          else if ((b !== 0 || b0 === UB.PLUVIALE) && forest > 0.55 && r > 0.31) add('mush' + ((v * 4) | 0), id, { m: matrix(x, h - 0.02, z, ry, 0.9 + G.hash2(cellX, cellZ, 56) * 0.6) }, { type: 'plant', sub: 'mush', x, y: h, z, r: 0.35, hp: 1, height: 0.25 });
        }
      }
      // legno: tronchi caduti e ceppi nei boschi, legni bianchi sulle spiagge
      const LS = 12;
      for (let gz = 0; gz < C / LS; gz++) for (let gx = 0; gx < C / LS; gx++) {
        const cellX = cx * 100 + gx + 60, cellZ = cz * 100 + gz + 60;
        const r = G.hash2(cellX, cellZ, 61);
        const x = x0 + (gx + 0.2 + G.hash2(cellX, cellZ, 62) * 0.6) * LS, z = z0 + (gz + 0.2 + G.hash2(cellX, cellZ, 63) * 0.6) * LS;
        if (Math.hypot(x - 4, z - 6) < 9 || clr(x, z)) continue;
        const h = G.heightAt(x, z), nrm = G.normalAt(x, z);
        if (nrm[1] < 0.9) continue;
        const ry = G.hash2(cellX, cellZ, 64) * 6.28, v = G.hash2(cellX, cellZ, 65);
        const id = `${cx},${cz},w,${gx},${gz}`;
        if (h > 0.3 && h < 1.8 && r < 0.22) {
          const k = (v * W.VAR.drift) | 0;
          add('drift' + k, id, { m: matrix(x, h - 0.06, z, ry, 0.9 + G.hash2(cellX, cellZ, 66) * 0.4) }, { type: 'wood', sub: 'drift', x, y: h, z, r: 0.9, hp: 1, height: 0.3 });
        } else if (W.scanned && G.biomeAt(x, z) === G.BIOME.DESERTO && h > 2 && r < 0.12) {
          add('drift0', id, { m: matrix(x, h - 0.05, z, ry, 0.8 + G.hash2(cellX, cellZ, 66) * 0.5) }, { type: 'wood', sub: 'drift', x, y: h, z, r: 0.9, hp: 1, height: 0.3 });
        } else if (h > 3 && h < 18 && [G.BIOME.FORESTA, G.BIOME.PLUVIALE, G.BIOME.MONTAGNA, G.BIOME.PIANURA].includes(G.biomeAt(x, z))) {
          const forest = G.nD(x * 0.012 + 50, z * 0.012) * 0.5 + 0.5;
          if (r > 0.3 * forest) continue;
          if (W.scanned && v > 0.8) add('drift0', id, { m: matrix(x, h - 0.05, z, ry, 0.8 + G.hash2(cellX, cellZ, 66) * 0.5) }, { type: 'wood', sub: 'drift', x, y: h, z, r: 0.9, hp: 1, height: 0.3 });
          else if (v < 0.55) {
            const k = (G.hash2(cellX, cellZ, 67) * 3) | 0, L = W.logInfo[k];
            // controlla che il tronco poggi su terreno quasi piano
            const ex = Math.cos(ry) * L.L * 0.5, ez = -Math.sin(ry) * L.L * 0.5;
            const h1 = G.heightAt(x + ex, z + ez), h2 = G.heightAt(x - ex, z - ez);
            if (Math.abs(h1 - h2) > 0.7) continue;
            add('log' + k, id, { m: matrix(x, Math.min(h1, h2, h) - 0.12, z, ry, 1) }, { type: 'wood', sub: 'log', x, y: h, z, r: 0.9, hp: 4, height: 0.7 });
          } else add('stump' + ((G.hash2(cellX, cellZ, 67) * W.VAR.stump) | 0), id, { m: matrix(x, h - 0.05, z, ry, 0.9 + G.hash2(cellX, cellZ, 68) * 0.4) }, { type: 'wood', sub: 'stump', x, y: h, z, r: 0.5, hp: 3, height: 0.7 });
        }
      }
      // spiaggia: conchiglie e stelle marine
      const SS = 4;
      for (let gz = 0; gz < C / SS; gz++) for (let gx = 0; gx < C / SS; gx++) {
        const cellX = cx * 100 + gx + 77, cellZ = cz * 100 + gz + 77;
        if (G.hash2(cellX, cellZ, 31) > 0.1) continue;
        const x = x0 + (gx + G.hash2(cellX, cellZ, 32)) * SS, z = z0 + (gz + G.hash2(cellX, cellZ, 33)) * SS;
        const h = G.heightAt(x, z);
        if (h < -0.6 || h > 2.0) continue;
        const star = G.hash2(cellX, cellZ, 34) < 0.4;
        const col = star ? [[1, 0.45, 0.2], [0.95, 0.3, 0.35], [0.9, 0.6, 0.25]][(G.hash2(cellX, cellZ, 35) * 3) | 0] : [1, 0.85 + G.hash2(cellX, cellZ, 36) * 0.15, 0.8];
        add(star ? 'starfish' : 'seashell', `${cx},${cz},s,${gx},${gz}`, { m: matrix(x, h, z, G.hash2(cellX, cellZ, 37) * 6.28, 0.8 + G.hash2(cellX, cellZ, 38) * 0.5), c: col }, { type: 'shell', x, y: h, z, r: 0.35, hp: 1, height: 0.2 });
      }
    }
    // fondale: coralli, alghe, posidonia
    if (ch.minH < -1) {
      const CS = 1.9;
      const n = Math.floor(C / CS);
      for (let gz = 0; gz < n; gz++) for (let gx = 0; gx < n; gx++) {
        const cellX = cx * 1000 + gx + 500, cellZ = cz * 1000 + gz + 500;
        const x = x0 + (gx + G.hash2(cellX, cellZ, 41)) * CS, z = z0 + (gz + G.hash2(cellX, cellZ, 42)) * CS;
        const h = G.heightAt(x, z);
        if (h > -1.0) continue;
        const r = G.hash2(cellX, cellZ, 43);
        const ry = G.hash2(cellX, cellZ, 44) * 6.28;
        const reef = G.reefAt(x, z);
        if (h > -16 && h < -1.3 && r < reef * 0.75) {
          const t = G.hash2(cellX, cellZ, 45);
          const kind = t < 0.3 ? 'cbranch' + ((t * 10) | 0) % 3 : t < 0.5 ? 'cbrain' + ((t * 10) | 0) % 2 : t < 0.68 ? 'ctube' + ((t * 10) | 0) % 2 : t < 0.88 ? 'cfan' + ((t * 10) | 0) % 2 : 'anemone';
          const col = CORAL_COLS[(G.hash2(cellX, cellZ, 46) * CORAL_COLS.length) | 0];
          let s = 0.6 + G.hash2(cellX, cellZ, 47) * 1.1; if (kind.startsWith('cbrain')) s *= 0.9;
          const nrm = G.normalAt(x, z);
          add(kind, `${cx},${cz},c,${gx},${gz}`, { m: matrix(x, h - 0.05, z, ry, s, kind.startsWith('cfan') ? null : _n.set(nrm[0], nrm[1] + 1, nrm[2]).normalize()), c: col });
        } else if (h < -5 && h > -32 && r > 0.96 - G.smooth(-8, -20, h) * 0.06) {
          const tall = h < -11;
          const kh = tall ? 10 : 6, ks = Math.min(0.8 + G.hash2(cellX, cellZ, 48) * 0.5, (-h - 1.8) / kh);
          if (ks > 0.3) add(tall ? 'kelp1' : 'kelp0', `${cx},${cz},k,${gx},${gz}`, { m: matrix(x, h - 0.1, z, ry, ks) });
        } else if (h > -9 && r > 0.55 && r < 0.55 + (1 - reef) * 0.25) {
          add('seagrass', `${cx},${cz},q,${gx},${gz}`, { m: matrix(x, h - 0.05, z, ry, 0.7 + G.hash2(cellX, cellZ, 49) * 0.6) });
        }
      }
    }
  }

  /* ---------------- GESTIONE CHUNK ---------------- */
  W.key = (cx, cz) => cx + ',' + cz;
  W.generate = function (cx, cz) {
    const t = buildTerrain(cx, cz);
    const ch = { cx, cz, key: W.key(cx, cz), mesh: t.mesh, minH: t.minH, maxH: t.maxH, data: {}, resources: [], entities: [] };
    W.terrainGroup.add(t.mesh);
    populate(ch);
    if (G.Features) G.Features.chunk(ch);
    for (const k in ch.data) W.markDirty(k, cx, cz);
    W.chunks.set(ch.key, ch);
    if (G.Entities) G.Entities.spawnForChunk(ch);
    return ch;
  };
  W.unload = function (ch) {
    W.terrainGroup.remove(ch.mesh); ch.mesh.geometry.dispose();
    if (G.Features) G.Features.unchunk(ch);
    for (const k in ch.data) W.markDirty(k, ch.cx, ch.cz);
    if (G.Entities) G.Entities.despawnChunk(ch);
    W.chunks.delete(ch.key);
  };
  // riempie le istanze di una cella (lista di voci)
  function fillCell(k, cellKey, list, level) {
    const n = list.length;
    let c = k.cells.get(cellKey);
    if (!n) { if (c) dropCell(k, cellKey); return; }
    c = cellMeshes(k, cellKey, level);
    if (n > c.cap) {
      c.cap = Math.ceil(n * 1.4) + 16;
      for (const im of c.meshes) {
        im.dispose();
        im.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(c.cap * 16), 16);
        if (k.opts.colors) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.cap * 3), 3);
      }
    }
    for (const im of c.meshes) {
      const arr = im.instanceMatrix.array, carr = im.instanceColor ? im.instanceColor.array : null;
      for (let i = 0; i < n; i++) { const e = list[i]; arr.set(e.m, i * 16); if (carr) { const cc = e.c || [1, 1, 1]; carr[i * 3] = cc[0]; carr[i * 3 + 1] = cc[1]; carr[i * 3 + 2] = cc[2]; } }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
  // oggetti vicini al giocatore in pieno dettaglio, gli altri semplificati
  function rebuildSplit(k, cellKey, chunks) {
    const near = [], far = [], px = W.px || 0, pz = W.pz || 0, nd = k.opts.nearOnly || W.NEAR_D, nd2 = nd * nd;
    // nearOnly: oltre quella distanza l'oggetto non si disegna affatto (muschio: migliaia di triangoli l'uno)
    const farLevel = k.opts.nearOnly ? 1 : wantLod(k, cellKey);
    for (const ch of chunks) for (const e of ch.data[k.key]) {
      const dx = e.m[12] - px, dz = e.m[14] - pz;
      if (farLevel === 1 && dx * dx + dz * dz < nd2) near.push(e); else far.push(e);
    }
    fillCell(k, cellKey + 'n', near, 0);
    fillCell(k, cellKey, k.opts.nearOnly ? [] : far, farLevel);
  }
  W.rebuild = function () {
    for (const dk of W.dirty) {
      const [key, cellKey] = dk.split('|');
      const k = W.kinds[key]; if (!k) continue;
      const [ix, iz] = cellKey.split(':').map(Number);
      const inR = (ch) => !k.near || (Math.abs(ch.cx - W.pcx) <= k.near && Math.abs(ch.cz - W.pcz) <= k.near);
      const chunks = [];
      for (let dz = 0; dz < CELLC; dz++) for (let dx = 0; dx < CELLC; dx++) {
        const ch = W.chunks.get(W.key(ix * CELLC + dx, iz * CELLC + dz));
        if (ch && ch.data[key] && ch.data[key].length && inR(ch)) chunks.push(ch);
      }
      if (k.split) { rebuildSplit(k, cellKey, chunks); continue; }
      let n = 0; for (const ch of chunks) n += ch.data[key].length;
      let c = k.cells.get(cellKey);
      if (!n) { if (c) dropCell(k, cellKey); continue; }
      c = cellMeshes(k, cellKey, wantLod(k, cellKey));
      if (n > c.cap) {
        c.cap = Math.ceil(n * 1.4) + 16;
        for (const im of c.meshes) {
          im.dispose();
          im.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(c.cap * 16), 16);
          if (k.opts.colors) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c.cap * 3), 3);
        }
      }
      const im0 = c.meshes[0], arr = im0.instanceMatrix.array, carr = im0.instanceColor ? im0.instanceColor.array : null;
      let i = 0;
      for (const ch of chunks) for (const e of ch.data[key]) {
        arr.set(e.m, i * 16);
        if (carr) { const cc = e.c || [1, 1, 1]; carr[i * 3] = cc[0]; carr[i * 3 + 1] = cc[1]; carr[i * 3 + 2] = cc[2]; }
        i++;
      }
      for (const im of c.meshes) {
        if (im !== im0) { im.instanceMatrix.array.set(arr.subarray(0, n * 16)); if (carr && im.instanceColor) im.instanceColor.array.set(carr.subarray(0, n * 3)); }
        im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    W.dirty.clear();
  };
  // svuota tutte le istanze (cambio mondo)
  W.clearAll = function () {
    for (const k of Object.values(W.kinds)) for (const ck of [...k.cells.keys()]) dropCell(k, ck);
  };
  W.update = function (px, pz, budgetMs) {
    const R = W.settings.view;
    const pcx = Math.floor(px / G.CHUNK), pcz = Math.floor(pz / G.CHUNK);
    W.px = px; W.pz = pz;
    // ogni ~16 m ricontrolla quali celle devono passare al modello semplificato (o tornare dettagliate)
    const lx = Math.round(px / 16), lz = Math.round(pz / 16);
    if (lx !== W._lodX || lz !== W._lodZ) {
      W._lodX = lx; W._lodZ = lz;
      for (const k of Object.values(W.kinds)) if (k.hasLod || k.split) for (const [ck, c] of k.cells) if (!ck.endsWith('n') && c.lod !== wantLod(k, ck)) W.dirty.add(k.key + '|' + ck);
    }
    // gli oggetti "split" vicini si riassegnano ogni pochi metri
    if (W.NEAR_D === undefined) W.quality();
    const sx = Math.round(px / 5), sz = Math.round(pz / 5);
    if (sx !== W._spX || sz !== W._spZ) {
      W._spX = sx; W._spZ = sz;
      for (const k of Object.values(W.kinds)) if (k.split) for (const ck of k.cells.keys()) { const base = ck.replace('n', ''); if (ck.endsWith('n') || cellDist(base) < (k.opts.nearOnly || W.NEAR_D) + 6) W.dirty.add(k.key + '|' + base); }
    }
    if (pcx !== W.pcx || pcz !== W.pcz) {
      W.pcx = pcx; W.pcz = pcz;
      for (const ch of W.chunks.values()) for (const key in ch.data) if (W.kinds[key] && W.kinds[key].near && Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) <= W.kinds[key].near + 2) W.markDirty(key, ch.cx, ch.cz);
    }
    // scarica i lontani
    for (const ch of [...W.chunks.values()]) if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 1) W.unload(ch);
    // genera i mancanti più vicini
    const need = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const k = W.key(pcx + dx, pcz + dz);
      if (!W.chunks.has(k)) need.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
    }
    need.sort((a, b) => a[0] - b[0]);
    const t0 = performance.now();
    let made = 0;
    for (const n of need) { W.generate(n[1], n[2]); made++; if (performance.now() - t0 > budgetMs) break; }
    if (W.dirty.size) W.rebuild();
    return need.length - made;
  };

  /* ---------------- QUERY ---------------- */
  W.nearby = function (x, z, r, fn) {
    const c0x = Math.floor((x - r) / G.CHUNK), c1x = Math.floor((x + r) / G.CHUNK), c0z = Math.floor((z - r) / G.CHUNK), c1z = Math.floor((z + r) / G.CHUNK);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const ch = W.chunks.get(W.key(cx, cz)); if (!ch) continue;
      for (const res of ch.resources) { const dx = res.x - x, dz = res.z - z; if (dx * dx + dz * dz < (r + res.r) * (r + res.r)) fn(res); }
    }
  };
  // raggio contro cilindri delle risorse
  W.raycastResources = function (o, d, maxDist) {
    let best = null, bestT = maxDist;
    W.nearby(o.x, o.z, maxDist + 1, (res) => {
      const ox = o.x - res.x, oz = o.z - res.z;
      const a = d.x * d.x + d.z * d.z, b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - res.r * res.r;
      let t;
      if (c < 0) t = 0; else { if (a < 1e-6) return; const disc = b * b - 4 * a * c; if (disc < 0) return; t = (-b - Math.sqrt(disc)) / (2 * a); }
      if (t < 0 || t > bestT) return;
      const y = o.y + d.y * t;
      if (y < res.y - 0.4 || y > res.y + res.height) return;
      bestT = t; best = res;
    });
    return best ? { res: best, t: bestT } : null;
  };
  W.removeResource = function (res, remote) {
    G.state.removed.add(res.id);
    if (!remote && G.Net && G.Net.on) G.Net.send({ t: 'rm', id: res.id });
    const ch = res.chunk, arr = ch.data[res.kind];
    const i = arr.indexOf(res.entry); if (i >= 0) arr.splice(i, 1);
    const j = ch.resources.indexOf(res); if (j >= 0) ch.resources.splice(j, 1);
    W.markDirty(res.kind, ch.cx, ch.cz);
  };
  // collisione orizzontale col giocatore (cerchi)
  W.collideCircle = function (p, rad) {
    W.nearby(p.x, p.z, rad + 1, (res) => {
      if (!res.solid) return;
      if (p.y > res.y + res.height || p.y + 1.8 < res.y - 0.5) return;
      const dx = p.x - res.x, dz = p.z - res.z, d = Math.hypot(dx, dz), min = rad + res.r;
      if (d < min && d > 1e-4) { p.x = res.x + (dx / d) * min; p.z = res.z + (dz / d) * min; }
    });
  };
})();
