'use strict';
/* ==========================================================
   Avvio, ciclo principale, pipeline di rendering, salvataggi
   ========================================================== */
(function () {
  const G = globalThis.G;
  const $ = (id) => document.getElementById(id);
  const DAY = 1320; // secondi per un giorno intero
  G.time = 0.31; G.clock = 0; G.anims = []; G.started = false;

  G.settings = Object.assign(G.defaultSettings(), G.store.get('deriva_settings') || {});

  /* ---------------- RENDERER ---------------- */
  const canvas = $('c');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    $('loadText').textContent = 'WebGL non è disponibile in questo browser.'; return;
  }
  G.renderer = renderer;
  /* scheda video: le integrate (Intel, Radeon dei portatili) partono con la qualità Bassa */
  G.gpu = (() => { try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); } catch (e) { return ''; } })();
  G.gpuName = G.gpu.replace(/^ANGLE \((.*)\)$/, '$1').replace(/^(NVIDIA|Intel|AMD|ATI Technologies Inc\.|Google Inc\. \(.*?\)), /, '').replace(/ Direct3D.*$| \(0x[0-9A-F]+\).*$|, OpenGL.*$/i, '').replace(/\s*vs_\d.*$/, '').trim();
  G.gpuSoft = /swiftshader|llvmpipe|basic render|software/i.test(G.gpu);
  G.gpuWeak = /intel|iris|uhd|hd graphics|radeon\(tm\) (r[2-7]|vega|graphics)|radeon graphics|vega \d|mali|adreno|powervr/i.test(G.gpu) && !/arc\b|rtx|gtx|rx \d{3,4}/i.test(G.gpu);
  if (!G.settings.gpuChecked) {
    G.settings.gpuChecked = true;
    if ((G.gpuWeak || G.gpuSoft || G.isTouch) && !['minima', 'bassa'].includes(G.settings.preset)) {
      const keep = { fov: G.settings.fov, sens: G.settings.sens, volume: G.settings.volume, vols: G.settings.vols };
      const k = G.gpuSoft || /(^|[^u])hd graphics( [2-6]\d{2,3}\b|$|\s*\()/i.test(G.gpu) ? 'minima' : 'bassa';
      G.settings = Object.assign({}, G.settings, G.PRESETS[k], keep, { preset: k });
      G.autoPreset = k;
    }
    G.store.set('deriva_settings', G.settings);
  }
  G.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let frameN = 0;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = (G.scene = new THREE.Scene());
  const camera = (G.camera = new THREE.PerspectiveCamera(G.settings.fov, 1, 0.08, 2600));
  scene.add(camera);
  const waterScene = new THREE.Scene();

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x88aacc, 0x445533, 0.5); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.1); scene.add(amb);

  let rtA, rtB, rtC, post, water, sky;
  function makeTargets() {
    const w = Math.max(2, Math.floor(innerWidth * G.pixelRatio)), h = Math.max(2, Math.floor(innerHeight * G.pixelRatio));
    for (const r of [rtA, rtB, rtC]) if (r) r.dispose();
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    rtA = new THREE.WebGLRenderTarget(w, h, opt);
    rtA.depthTexture = new THREE.DepthTexture(w, h); rtA.depthTexture.type = THREE.UnsignedIntType;
    rtB = new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: false }, opt));
    rtC = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    G.rtSize = [w, h]; G._rt = { rtA, rtB, rtC };
  }
  function resize() {
    // sugli schermi ad alta densità (portatili al 125-200%) non si renderizza oltre la risoluzione nativa "logica"
    const S = G.settings, dprCap = S.preset === 'ultra' ? 2 : S.preset === 'alta' ? 1.25 : 1;
    G.pixelRatio = Math.min(window.devicePixelRatio || 1, dprCap) * S.pixel * (S.dynres !== false ? G.dyn.scale : 1);
    renderer.setPixelRatio(G.pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    makeTargets();
  }
  window.addEventListener('resize', resize);
  G.resize = resize;
  { const set0 = G.store.set; G.store.set = function (k, v) { if (k === 'deriva_settings' && G.dyn && G.dyn.base) v = Object.assign({}, v, G.dyn.base); return set0.call(G.store, k, v); }; }
  /* grafica adattiva: per tenere gli FPS stabili abbassa (e poi rialza) la grafica un passo alla volta,
     avvisando il giocatore. I valori scelti nelle impostazioni non vengono toccati sul disco. */
  G.dyn = { scale: 1, acc: 0, n: 0, t: 0, lvl: 0, cool: 0, good: 0, lock: {}, base: null, cpuWarned: false };
  const LADDER = [
    { k: 'res', v: 0.85, msg: 'risoluzione all’85%' },
    { k: 'res', v: 0.72, msg: 'risoluzione al 72%' },
    { k: 'shadows', msg: 'ombre disattivate', need: () => (G.dyn.base || G.settings).shadows > 0 },
    { k: 'fx', msg: 'raggi di sole e occlusione disattivati', need: () => { const b = G.dyn.base || G.settings; return b.godrays || b.ao !== false; } },
    { k: 'view', msg: 'distanza visiva ridotta', need: () => (G.dyn.base || G.settings).view > 2 },
    { k: 'res', v: 0.6, msg: 'risoluzione al 60%' },
  ];
  function applyLevel(lvl, up) {
    const S = G.settings, D = G.dyn;
    if (!D.base) D.base = { shadows: S.shadows, godrays: S.godrays, ao: S.ao, view: S.view };
    const B = D.base;
    let scale = 1, sh = B.shadows, god = B.godrays, ao = B.ao, view = B.view;
    for (let i = 0; i < lvl; i++) {
      const st = LADDER[i];
      if (st.k === 'res') scale = st.v; else if (st.k === 'shadows') sh = 0; else if (st.k === 'fx') { god = false; ao = false; } else if (st.k === 'view') view = Math.max(2, B.view - 1);
    }
    const changed = [];
    if (scale !== D.scale) { D.scale = scale; resize(); }
    if (sh !== S.shadows) { S.shadows = sh; G.applySettings('shadows', true); }
    if (god !== S.godrays || ao !== S.ao) { S.godrays = god; S.ao = ao; }
    if (view !== S.view) { S.view = view; G.applySettings('view', true); }
    D.lvl = lvl;
    if (lvl === 0) D.base = null;
    return changed;
  }
  G.adaptReset = function () { if (G.dyn.lvl) applyLevel(0); G.dyn.scale = 1; G.dyn.lock = {}; };
  function dynRes(dt) {
    const S = G.settings, D = G.dyn;
    if (S.dynres === false || !G.started || G.UI.menu) { if (S.dynres === false && (D.lvl || D.scale !== 1)) { applyLevel(0); D.scale = 1; resize(); } D.acc = 0; D.n = 0; D.t = 0; return; }
    D.acc += dt; D.n++; D.t += dt; D.cool = Math.max(0, D.cool - dt);
    if (D.t < 2) return;
    const fps = D.n / D.acc; D.acc = 0; D.n = 0; D.t = 0;
    const target = S.fpsTarget || 60;
    const low = fps < target * 0.86, high = fps > target * 0.96;
    if (low && D.cool <= 0) {
      D.good = 0;
      // appena rialzata e subito di nuovo lenta: quel livello resta bloccato per un minuto
      if (D.justRaised) { D.lock[D.justRaised.lvl] = performance.now() + 60000; D.justRaised = null; }
      let next = D.lvl;
      while (next < LADDER.length && LADDER[next].need && !LADDER[next].need()) next++;
      if (next < LADDER.length) {
        applyLevel(next + 1); D.cool = 3; D.prevFps = fps;
        G.UI.toast(`Grafica adattiva: ${LADDER[next].msg} per tenere ${target} FPS (ora ${Math.round(fps)})`);
      } else if (!D.cpuWarned) { D.cpuWarned = true; G.UI.toast(`Grafica già al minimo adattivo: ${Math.round(fps)} FPS. Prova la qualità Minima o chiudi altri programmi.`, 'warn'); }
    } else if (high && D.lvl > 0) {
      // risale solo dopo 3 misure buone di fila, e non torna a un livello appena abbandonato
      D.good++;
      let prev = D.lvl - 1;
      while (prev > 0 && LADDER[prev - 1].need && !LADDER[prev - 1].need()) prev--;
      if (D.good >= 3 && D.cool <= 0 && performance.now() > (D.lock[prev] || 0)) {
        const step = LADDER[D.lvl - 1];
        applyLevel(prev); D.cool = 4; D.good = 0; D.justRaised = { lvl: prev, from: prev + 1 };
        G.UI.toast(`Grafica adattiva: c’è margine, rialzo la grafica (${step.msg.replace('disattivate', 'riattivate').replace('disattivati', 'riattivati').replace('ridotta', 'ripristinata')})`, 'good');
      }
    } else if (!high) D.good = 0;
    if (!low && D.justRaised && D.cool <= 0 && D.good >= 2) D.justRaised = null;
  }
  G.dynRes = dynRes;
  /* luci puntiformi: accese tutte insieme solo quando servono (di giorno non pesano sugli shader) */
  let plights = null;
  function gateLights() {
    if (!plights) plights = [...(G.Build.lights || []), ...((G.Structures && G.Structures.lights) || []), ...((G.Structures && G.Structures.faroLight) ? [G.Structures.faroLight] : [])];
    let any = false; for (const l of plights) if (l.intensity > 0.005) { any = true; break; }
    if (plights.length && plights[0].visible !== any) for (const l of plights) l.visible = any;
  }
  G.setPointLights = (on) => { gateLights(); for (const l of plights) l.visible = on; };

  /* ---------------- IMPOSTAZIONI ---------------- */
  G.applyPreset = function (k) {
    const keep = { fov: G.settings.fov, sens: G.settings.sens, volume: G.settings.volume, vols: G.settings.vols };
    if (G.adaptReset) G.adaptReset();
    G.settings = Object.assign({}, G.settings, G.PRESETS[k], keep, { preset: k, basePreset: k });
    for (const key of ['shadows', 'pixel', 'view', 'godrays', 'fx']) G.applySettings(key, true);
    G.store.set('deriva_settings', G.settings);
  };
  G.applySettings = function (k, quiet) {
    const S = G.settings;
    if (k === 'pixel') resize();
    if (k === 'dynres') { G.adaptReset(); resize(); }
    if (k === 'fov') { camera.fov = S.fov; camera.updateProjectionMatrix(); }
    if (k === 'shadows') {
      const on = S.shadows > 0;
      if (sun.castShadow !== on || (on && sun.shadow.mapSize.x !== S.shadows)) {
        sun.castShadow = on; renderer.shadowMap.enabled = on;
        if (on) { sun.shadow.mapSize.set(S.shadows, S.shadows); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
        scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
      }
      const half = S.shadows >= 4096 ? 80 : S.shadows >= 2048 ? 65 : 50;
      const c = sun.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 400; c.updateProjectionMatrix();
    }
    if (k === 'view' && G.World.settings) { G.World.settings.view = S.view; if (G.World.quality) { G.World.quality(); G.World._lodX = null; G.World._spX = null; } }
    if (k === 'volume' && G.Audio) G.Audio.setVolume(S.volume);
    if (k === 'fx' && G.World.settings) G.World.settings.fx = S.fx;
    if (k === 'fullscreen' && window.deriva) window.deriva.setFullscreen(!!S.fullscreen);
    if (k === 'vsync' && window.deriva) window.deriva.setConfig({ vsync: S.vsync !== false });
    if (!quiet) G.store.set('deriva_settings', G.settings);
  };

  /* ---------------- SALVATAGGI ---------------- */
  G.mode = 'sopravvivenza';
  G.creative = () => G.mode === 'creativa';
  G.serializeAll = () => ({
    v: 3, name: G.worldName, mode: G.mode, seed: G.seed, time: G.time, player: G.Player.serialize(), builds: G.Build.serialize(), boats: G.Boats.serialize(),
    removed: [...G.state.removed], killed: [...(G.state.killed || [])], wind: G.Boats.wind.dir, lv: G.WIND.level, chests: G.state.chests, enemies: !G.enemiesOff,
    weather: G.Climate ? G.Climate.serialize() : null, digs: G.Dig ? G.Dig.serialize() : [], pets: G.Pets ? G.Pets.serialize() : [],
  });
  G.save = function () {
    if (!G.started || !G.worldId) return;
    if (G.Net && G.Net.on && !G.Net.isHost) return; // il mondo è di chi ospita
    const ok = G.Worlds.write(G.worldId, G.serializeAll(), { name: G.worldName, mode: G.mode, seed: G.seed });
    G.lastSave = performance.now();
    if (!ok && !G._saveWarned) { G._saveWarned = true; G.UI.toast('Impossibile salvare il mondo: spazio esaurito', 'warn'); }
    return ok;
  };
  G.setMode = function (mode, quiet) {
    G.mode = mode === 'creativa' ? 'creativa' : 'sopravvivenza';
    const P = G.Player; if (G.creative()) { P.health = P.hunger = P.thirst = P.oxygen = 100; } else P.fly = false;
    document.body.classList.toggle('creative', G.creative());
    if (G.UI && G.UI.refreshHotbar) G.UI.refreshHotbar();
    if (!quiet) G.UI.toast(G.creative() ? 'Modalità creativa: hai tutti gli oggetti, niente fame né danni · doppio Spazio per volare' : 'Modalità sopravvivenza', 'good');
  };
  let saveTimer = null;
  G.saveSoon = function () { clearTimeout(saveTimer); saveTimer = setTimeout(G.save, 1500); };
  window.addEventListener('beforeunload', () => G.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });

  G.findSpawn = function () {
    for (let r = 0; r < 160; r += 2) for (let a = 0; a < 6.28; a += 0.4) {
      const x = 4 + Math.cos(a) * r, z = 6 + Math.sin(a) * r, h = G.heightAt(x, z);
      if (h > 2.6 && h < 9 && G.normalAt(x, z)[1] > 0.9) return { x, y: G.World.groundAt(x, z), z };
    }
    return { x: 0, y: G.heightAt(0, 0) + 1, z: 0 };
  };
  G.coordsText = function () {
    const p = G.Player.pos; const lat = 38.1 + p.z / -111000, lon = 13.36 + p.x / 88000;
    return `${Math.abs(lat).toFixed(3)}° N · ${lon.toFixed(3)}° E · seme ${G.seed || '—'}`;
  };

  /* ---------------- POINTER LOCK ---------------- */
  G.locked = false;
  G.requestLock = function () {
    if (!G.started || G.UI.open || G.UI.menu) return;
    if (G.isTouch) { G.locked = true; $('resume').hidden = true; return; } // sul telefono non c'è il puntatore da bloccare
    try {
      const r = canvas.requestPointerLock && canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => { $('resume').hidden = false; });
    } catch (e) { $('resume').hidden = false; }
  };
  document.addEventListener('pointerlockchange', () => {
    G.locked = document.pointerLockElement === canvas;
    if (G.locked) $('resume').hidden = true;
    else if (G.started && !G.UI.open && !G.UI.menu) { G.UI.showMenu('main'); G.save(); }
  });
  document.addEventListener('pointerlockerror', () => { $('resume').hidden = false; });

  /* ---------------- MONDO ---------------- */
  function resetWorld(seed) {
    for (const ch of [...G.World.chunks.values()]) G.World.unload(ch);
    G.World.rebuild();
    G.initWorldGen(seed);
    G.state = { removed: new Set(), chests: {} };
    if (G.POI) G.POI.reset();
    if (G.Structures && G.Structures.group) G.Structures.clear();
    if (G.MapUI) G.MapUI.reset();
    if (G.Combat) G.Combat.clear();
    if (G.Climate) { G.Climate.resetSites(); G.moonOffset = 0; }
    if (G.Features) G.Features.clear();
    if (G.Dig) G.Dig.reset();
    if (G.Pets) G.Pets.reset();
  }
  G.setEnemies = function (on, quiet) {
    G.enemiesOff = !on;
    if (!on && G.Entities) for (const a of G.Entities.list.slice()) if (a.kind === 'animal' && G.isHostile(a.sp)) G.Entities.removeAnimal(a);
    if (!quiet && G.UI) G.UI.toast(on ? 'Nemici attivi: pirati e predatori' : 'Nemici disattivati: mondo tranquillo');
  };
  // fresh: nuovo mondo (opts: name, seed, mode, lv); altrimenti opts.id = mondo da continuare
  G.startGame = function (fresh, quiet, opts) {
    opts = opts || {};
    let save = null;
    if (!fresh) {
      const id = opts.id || (G.Worlds.list()[0] || {}).id;
      save = id ? G.Worlds.read(id) : null;
      if (save) { G.worldId = id; G.worldName = save.name || (G.Worlds.meta(id) || {}).name || 'Mondo'; }
    }
    if (!save) {
      G.worldId = G.Worlds.newId();
      G.worldName = (opts.name || '').trim() || 'Arcipelago ' + (G.Worlds.list().length + 1);
    }
    const seedIn = opts.seed !== undefined && String(opts.seed).trim() !== '' ? String(opts.seed).trim() : null;
    const seed = save ? save.seed : seedIn ? (/^-?\d+$/.test(seedIn) ? parseInt(seedIn, 10) : G.hashString(seedIn)) : (Math.random() * 1e9) | 0;
    G.enemiesOff = save ? save.enemies === false : opts.enemies === false;
    resetWorld(seed);
    G.setMode(save ? save.mode : opts.mode, true);
    G.setWind(save ? (save.lv !== undefined ? save.lv : 4) : (opts.lv !== undefined ? opts.lv : 4)); G.waveAmp = G.windAmp(G.WIND.level);
    G.Player.fly = false;
    if (save) {
      G.state.removed = new Set(save.removed || []);
      G.state.killed = new Set(save.killed || []);
      G.state.chests = save.chests || {};
      G.time = save.time; G.Boats.wind.dir = save.wind || 0.6;
      if (G.Climate) G.Climate.load(save.weather);
      if (G.Dig) G.Dig.load(save.digs);
      if (G.Pets) G.Pets.load(save.pets);
    } else {
      if (G.Climate) G.Climate.reset(); G.time = 0.31; G.Player.inv = new Array(36).fill(null); G.Player.equip = [null, null, null, null]; G.Player.temp = 50; }
    G.Build.load(save ? save.builds : []);
    G.Boats.load(save ? save.boats : []);
    G.Player.resetProgress();
    if (save) G.Player.load(save.player);
    else {
      const sp = G.findSpawn();
      Object.assign(G.Player, { health: 100, hunger: 100, thirst: 100, oxygen: 100, sel: 0, spawn: null, boat: null });
      G.Player.pos.set(sp.x, sp.y + 0.1, sp.z);
      // guarda verso il mare
      let best = 0, bd = 1e9; for (let a = 0; a < 6.28; a += 0.3) { const h = G.heightAt(sp.x - Math.sin(a) * 40, sp.z - Math.cos(a) * 40); if (h < bd) { bd = h; best = a; } }
      G.Player.yaw = best; G.Player.pitch = -0.05;
      if (G.creative()) for (const id of ['ascia', 'piccone', 'coltello', 'canna', 'torcia', 'banco', 'assi', 'tronco']) G.Player.give(id, G.ITEMS[id].stack, true);
    }
    // genera subito i chunk vicini
    G.World.update(G.Player.pos.x, G.Player.pos.z, 400);
    G.settleOnGround();
    G.started = true;
    G.UI.hideMenu(); G.UI.refreshHotbar();
    if (G.Audio) G.Audio.start(G.settings.volume);
    if (!quiet) G.requestLock();
    if (!save && !quiet && G.creative()) setTimeout(() => G.UI.toast('Modalità creativa: apri l’inventario (I) per prendere qualsiasi oggetto. Doppio Spazio per volare.', 'good'), 600);
    else if (!save && !quiet) {
      setTimeout(() => G.UI.toast('Sei naufragato su un’isola. Apri il libro del costruttore con B.', 'good'), 600);
      setTimeout(() => G.UI.toast('Raccogli legno, pietra e fibra: poi costruisci una barca ed esplora.'), 4200);
    }
    G.save();
  };
  // evita di ritrovarsi a mezz'aria (e di cadere) dopo un caricamento
  G.settleOnGround = function () {
    const p = G.Player.pos;
    const g = Math.max(G.World.groundAt(p.x, p.z), G.Build.groundAt(p.x, p.z, p.y + 0.5, 0.1));
    if (p.y > g + 1.5 || p.y < g - 0.5) p.y = Math.max(g, G.waveHeight(p.x, p.z, G.clock) - 1.6);
    G.Player.vel.set(0, 0, 0);
  };
  // istantanea del mondo per il server multigiocatore
  G.netSnapshot = () => ({ seed: G.seed, time: G.time, weather: G.Climate ? G.Climate.serialize() : null, digs: G.Dig ? G.Dig.serialize() : [], pets: G.Pets ? G.Pets.serialize() : [], wind: G.Boats.wind.dir, lv: G.WIND.level, mode: G.mode, enemies: !G.enemiesOff, chests: G.state.chests, removed: [...G.state.removed], killed: [...(G.state.killed || [])], builds: G.Build.serialize(), boats: G.Boats.serialize() });
  // ingresso in una partita altrui
  G.startFromSnapshot = function (snap, you) {
    G.enemiesOff = snap.enemies === false;
    resetWorld(snap.seed);
    G.state.removed = new Set(snap.removed || []);
    G.state.killed = new Set(snap.killed || []);
    G.state.chests = snap.chests || {};
    G.Player.resetProgress();
    G.time = snap.time || 0.3; G.Boats.wind.dir = snap.wind || 0.6;
    if (G.Climate) G.Climate.load(snap.weather);
    if (G.Dig) G.Dig.load(snap.digs);
    if (G.Pets) G.Pets.load(snap.pets);
    G.worldId = null; G.setMode(snap.mode, true); G.setWind(snap.lv !== undefined ? snap.lv : 4); G.waveAmp = G.windAmp(G.WIND.level);
    G.Build.load(snap.builds || []);
    G.Boats.load(snap.boats || []);
    Object.assign(G.Player, { health: 100, hunger: 100, thirst: 100, oxygen: 100, sel: 0, spawn: null, boat: null, helm: false });
    if (you) G.Player.load(you);
    else {
      G.Player.inv = new Array(36).fill(null); G.Player.equip = [null, null, null, null]; G.Player.temp = 50;
      const sp = G.findSpawn();
      G.Player.pos.set(sp.x + (Math.random() - 0.5) * 6, sp.y + 0.1, sp.z + (Math.random() - 0.5) * 6);
    }
    G.World.update(G.Player.pos.x, G.Player.pos.z, 400);
    G.settleOnGround();
    G.started = true;
    G.UI.hideMenu(); G.UI.refreshHotbar();
    if (G.Audio) G.Audio.start(G.settings.volume);
    G.requestLock();
  };
  G.toTitle = function () {
    if (G.Net && G.Net.on) { G.UI.hostInfo = null; G.Net.leave(); }
    G.started = false; G.Player.boat = null; G.UI.setBoatHud(false);
    G.UI.showMenu('main');
  };

  /* ---------------- AVVIO ---------------- */
  async function boot() {
    resize();
    const S = G.settings;
    G.initWorldGen(1337); G.state = { removed: new Set() };
    $('loadText').textContent = 'Dipingo le texture…';
    await G.TEX.buildAll(S.texSize, (p, k) => { $('loadBar').style.transform = `scaleX(${p * 0.75})`; });
    $('loadText').textContent = 'Carico le texture fotografiche…';
    G.PHOTO = await G.TEX.loadPhotos('assets/');
    try { G.SCAN = await G.TEX.loadScans('assets/models/'); } catch (e) { G.SCAN = null; console.warn('modelli scansionati non disponibili', e); }
    $('loadText').textContent = 'Faccio crescere le foreste…';
    await new Promise((r) => setTimeout(r, 0));
    G.createMaterials(G.TEX, S);
    G.World.init(scene, S);
    G.Entities.initFish(); G.Entities.initBirds(); G.FX.init();
    G.Build.init(scene); G.Boats.init(); G.Structures.init();
    if (G.Climate) G.Climate.init();
    G.Player.init(camera);
    sky = G.createSky(); scene.add(sky);
    water = G.createWater(S.waterSeg); waterScene.add(water);
    water.material.uniforms.tNormal.value = G.TEX.waterNormalT;
    post = G.createPost(); G._post = post; G._water = water; G._waterScene = waterScene;
    G.UI.init();
    if (G.Cmd) G.Cmd.init();
    G.applySettings('shadows', true);
    // scena del titolo: un'isola vista dal mare
    G.Worlds.migrate();
    const save = G.Worlds.list()[0] ? G.Worlds.read(G.Worlds.list()[0].id) : null;
    if (save) G.initWorldGen(save.seed);
    G.Player.pos.set(-70, 4, 60);
    G.World.update(0, 0, 200);
    // precompila tutti gli shader: niente scatti la prima volta che appare un corallo o un pesce
    $('loadText').textContent = 'Preparo gli shader…';
    await new Promise((r) => setTimeout(r, 0));
    // un'istanza fittizia per ogni tipo di vegetazione, così anche i materiali non ancora visibili vengono compilati
    const warm = new THREE.Group();
    for (const k of Object.values(G.World.kinds)) for (const p of k.parts) { const im = new THREE.InstancedMesh(p.geo, p.mat, 1); im.castShadow = !!p.shadow; if (p.mat.userData.depth) im.customDepthMaterial = p.mat.userData.depth; if (k.opts.colors) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); im.frustumCulled = false; warm.add(im); }
    // anche villaggi, persone e armi (niente scatti quando compaiono la prima volta)
    for (const m of Object.values(G.Structures.extraMats())) if (m && m.isMaterial) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), m); mesh.frustumCulled = false; warm.add(mesh); }
    { const pp = G.People.build(1, { pirate: true }); pp.root.traverse((o) => { o.frustumCulled = false; }); warm.add(pp.root); }
    for (const id of ['arco', 'pistola', 'lancia', 'pala', 'cannocchiale', 'lanterna', 'bussola_oro']) { const t = G.Tools.build(id); if (t) { t.traverse((o) => { o.frustumCulled = false; }); warm.add(t); } }
    // ghiaccio, lava, laghi, cascate, gallerie, pioggia
    if (G.Features) for (const m of G.Features.materials()) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), m); mesh.frustumCulled = false; warm.add(mesh); }
    if (G.Dig) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute([0, 0, 0], 1)); g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2)); const mesh = new THREE.Mesh(g, G.Dig.material()); mesh.frustumCulled = false; warm.add(mesh); }
    if (G.Climate && G.Climate.Precip.mesh) { G.Climate.Precip.mesh.visible = true; }
    scene.add(warm);
    try {
      renderer.setRenderTarget(rtA);
      G.setPointLights(true); renderer.compile(scene, camera);
      G.setPointLights(false); renderer.compile(scene, camera);
      renderer.setRenderTarget(rtB); renderer.compile(waterScene, camera); renderer.setRenderTarget(null);
    } catch (e) {}
    scene.remove(warm);
    $('loadBar').style.transform = 'scaleX(1)';
    setTimeout(() => { $('loading').hidden = true; }, 300);
    G.UI.showMenu('main');
    if (G.autoPreset) setTimeout(() => G.UI.toast(`Scheda video integrata (${G.gpuName || 'sconosciuta'}): ho scelto la qualità ${G.PRESETS[G.autoPreset].label}. Puoi cambiarla in Impostazioni.`, 'good'), 1200);
    if (G.gpuSoft) setTimeout(() => G.UI.toast('Il gioco non sta usando la scheda video (rendering software): aggiorna i driver grafici.', 'warn'), 2500);
    // ripristino dopo un aggiornamento della pagina pubblicata
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => (G.started ? G.serializeAll() : null));
    requestAnimationFrame(loop);
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && !G.isTouch) { const n = document.createElement('div'); n.id = 'mobileNote'; n.textContent = 'Deriva si gioca con tastiera e mouse: aprilo da un computer.'; $('game').appendChild(n); }
    G.ready = true;
  }

  /* ---------------- CICLO ---------------- */
  let last = performance.now();
  const _v = new THREE.Vector3(), _proj = new THREE.Vector3(), _hc = new THREE.Color(), _hg = new THREE.Color();
  let fpsAcc = 0, fpsN = 0; G.fps = 60;
  function loop(now) {
    requestAnimationFrame(loop);
    if (G.pauseLoop) { last = now; return; }
    G.frame(now);
  }
  G.frame = function (now, fixedDt) {
    let dt = fixedDt !== undefined ? fixedDt : Math.min(0.05, (now - last) / 1000); last = now;
    if (G.frozen) dt = 0;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    // in multigiocatore il mondo non si ferma mai, nemmeno col menu aperto
    const mp = G.Net && G.Net.on;
    const playing = G.started && (!G.UI.menu || mp);
    const paused = G.started && !playing;
    if (playing) { G.time += dt / DAY; G.clock += dt; }
    else if (!paused) G.clock += dt * 0.5;
    const t = G.clock;
    G.shared.uTime.value = t;
    const S = G.updateSky(G.time % 1);
    if (G.Climate) { G.Climate.update(dt, G.Player, playing); G.Climate.applySky(S); }
    // luci
    sun.color.copy(S.light); sun.intensity = 1.0;
    sun.color.multiplyScalar(1.0);
    hemi.color.copy(S.zen).lerp(S.hor, 0.3).multiplyScalar(1.1 + S.day * 0.4); hemi.groundColor.setRGB(0.32, 0.27, 0.2).multiplyScalar(0.25 + S.day * 0.5); hemi.intensity = 0.55;
    if (S.dark > 0) { const k = S.dark; hemi.color.lerp(_hc.copy(S.zen).lerp(S.hor, 0.5).multiplyScalar(1.6), k); hemi.groundColor.lerp(_hg.setRGB(0.02, 0.07, 0.06), k); hemi.intensity += (0.6 - hemi.intensity) * k; }
    amb.intensity = 0.05 + (1 - S.day) * 0.05 * (G.Climate ? 0.5 + G.Climate.moonLight() : 1);
    if (G.Climate && G.Climate.flash > 0) { hemi.intensity += G.Climate.flash * 2.2; amb.intensity += G.Climate.flash * 0.8; }
    G.shared.uSunInt.value = S.light.r * 0.5;
    const su = sky.material.uniforms;
    su.uCloud.value = G.Climate ? G.Climate.cur.cloud : 0.45; su.uMoonPh.value = G.Climate ? G.Climate.moonPhase() : 0.5;
    su.uDark.value = S.dark; su.uMoonCol.value.copy(G.moonCol()); su.uSun.value.copy(S.sun); su.uMoon.value.copy(S.moon); su.uZen.value.copy(S.zen); su.uHor.value.copy(S.hor); su.uGlow.value.copy(S.glow); su.uSunCol.value.copy(S.sunCol); su.uNight.value = S.night;

    const P = G.Player;
    if (paused) {
      // pausa in singolo: tutto fermo, la visuale resta dov'era
    } else if (playing) {
      if (G.UI.menu) P.keys = {};
      { const ax = P.ax, aF = Math.abs(ax.f) > 0.35 ? Math.sign(ax.f) : 0, aR = Math.abs(ax.r) > 0.35 ? Math.sign(ax.r) : 0; G.Boats.update(dt, t, { f: G.clamp((P.keys.KeyW ? 1 : 0) - (P.keys.KeyS ? 1 : 0) + aF, -1, 1), t: G.clamp((P.keys.KeyA ? 1 : 0) - (P.keys.KeyD ? 1 : 0) - aR, -1, 1), l: !!P.keys.KeyA || aR < 0, r: !!P.keys.KeyD || aR > 0 }); }
      if (P.keys.ArrowLeft) P.yaw += dt * 2; if (P.keys.ArrowRight) P.yaw -= dt * 2;
      if (P.keys.ArrowUp) P.pitch = Math.min(1.5, P.pitch + dt * 1.5); if (P.keys.ArrowDown) P.pitch = Math.max(-1.5, P.pitch - dt * 1.5);
      P.update(dt, t);
      G.Combat.update(dt, P);
      G.Entities.update(dt, P, t);
      G.Structures.update(dt, P);
      G.MapUI.track(dt);
      if ((G._rareT = (G._rareT || 0) - dt) <= 0) { G._rareT = 1; G.Combat.noteRares(); }
      G.Build.update(dt, P, t);
      if (G.Features) G.Features.update(dt, P, t);
      if (G.Dig) G.Dig.update();
      G.FX.update(dt, P, t);
      G.UI.update(dt, t);
      if (G.Audio) G.Audio.update(dt, t, P);
      for (let i = G.anims.length - 1; i >= 0; i--) { const a = G.anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k, k >= 1); if (k >= 1) G.anims.splice(i, 1); }
      if (performance.now() - (G.lastSave || 0) > 45000) G.save();
      G.World.update(P.pos.x, P.pos.z, 7);
      if (G.Net) G.Net.update(dt, t);
      if (G.Voice) G.Voice.update(dt);
    } else {
      // camera del titolo: orbita lenta attorno all'isola
      if (G.Player.vm) G.Player.vm.visible = false;
      const a = t * 0.025 + 2.2;
      camera.position.set(Math.cos(a) * 95, 9 + Math.sin(t * 0.1) * 2, Math.sin(a) * 95);
      camera.lookAt(0, 4, 0);
      G.Player.pos.set(camera.position.x, camera.position.y, camera.position.z);
      G.World.update(0, 0, 6);
      G.Boats.update(dt, t, { f: 0, t: 0 });
      G.Entities.update(dt, P, t);
      G.FX.update(dt, P, t);
      if ($('coords') && Math.random() < 0.05) $('coords').textContent = G.coordsText();
    }
    G.shared.uCamPos.value.copy(camera.position);
    G.shared.uGrassDist.value = 30 + G.settings.view * 9;
    // ombre che seguono la camera, agganciate ai texel
    const ld = S.lightDir || S.sun;
    const half = sun.shadow.camera.right, texel = (half * 2) / Math.max(512, G.settings.shadows || 1024);
    _v.set(Math.round(camera.position.x / texel) * texel, Math.round(camera.position.y / texel) * texel, Math.round(camera.position.z / texel) * texel);
    sun.position.copy(_v).addScaledVector(ld, 180); sun.target.position.copy(_v); sun.target.updateMatrixWorld();
    sky.position.copy(camera.position);
    // nebbia: più fitta col buio, entro la distanza visiva
    const viewDist = G.settings.view * G.CHUNK;
    const wc = G.Climate ? G.Climate.cur : null;
    const fogDen = (G.hiQ() ? 1.3 : 1.5) / viewDist * (wc ? 1 + wc.rain * 1.4 + wc.snow * 2.2 + wc.storm * 0.8 : 1);
    G.fogDen = fogDen;
    const spyK = G.Combat ? G.Combat.zoom || 0 : 0; // attraverso la lente la foschia quasi sparisce

    if (G.noRender) return; // test: solo logica
    camera.updateMatrixWorld(); _mt = performance.now();
    gateLights();
    if (G.MAT && G.MAT.uDual) G.MAT.uDual.value = G.lowQ() ? 0 : 1;
    if (fixedDt === undefined) dynRes(dt);
    // ombre: ogni frame in Alta/Ultra, a frame alterni nelle altre qualità
    frameN++;
    if ((G.settings.shadows || 0) >= 2048 || frameN % 2 === 0) renderer.shadowMap.needsUpdate = true;
    // 1) scena opaca → rtA (colore + profondità)
    renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, camera); mark('scene');
    // 2) copia + oceano → rtB
    const wu = water.material.uniforms;
    wu.tScene.value = rtA.texture; wu.tDepth.value = rtA.depthTexture; wu.uRes.value.set(G.rtSize[0], G.rtSize[1]);
    wu.uNear.value = camera.near; wu.uFar.value = camera.far; wu.uCam.value.copy(camera.position);
    wu.uSunDir.value.copy(S.sun); wu.uSunCol.value.copy(S.sunCol); wu.uZen.value.copy(S.zen); wu.uHor.value.copy(S.hor); wu.uAmb.value.copy(S.amb);
    wu.uFogDen.value = fogDen * 0.85 * (1 - spyK * 0.45); wu.uUnder.value = P.under ? 1 : 0;
    wu.uWaveAmp.value = G.waveAmp; wu.uWindLv.value = (G.Climate ? G.Climate.windLevel() : G.WIND.level) / 10;
    if (G.Climate) G.Climate.vortexUniforms(wu.uVort.value);
    // riflessi in spazio schermo solo su Alta/Ultra (e non quando la grafica adattiva ha tolto gli effetti)
    wu.uSSR.value = G.hiQ() && G.settings.godrays !== false ? 1 : 0;
    if (wu.uSSR.value) wu.uVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const snap = 6; wu.uOffset.value.set(Math.round(camera.position.x / snap) * snap, Math.round(camera.position.z / snap) * snap);
    renderer.setRenderTarget(rtB); renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
    renderer.autoClear = false;
    renderer.render(waterScene, camera); mark('water');
    renderer.autoClear = true;
    // 3) post-processing: nebbia, raggi di sole, tonemapping
    const pu = post.post.uniforms;
    pu.tColor.value = rtB.texture; pu.tScene.value = rtA.texture; pu.tDepth.value = rtA.depthTexture;
    pu.uInvProj.value.copy(camera.projectionMatrixInverse); pu.uCamWorld.value.copy(camera.matrixWorld);
    pu.uNear.value = camera.near; pu.uFar.value = camera.far; pu.uRes.value.set(G.rtSize[0], G.rtSize[1]);
    pu.uSunDir.value.copy(S.sun); pu.uSunCol.value.copy(S.sunCol); pu.uHor.value.copy(S.hor); pu.uZen.value.copy(S.zen); pu.uAmb.value.copy(S.amb);
    pu.uFogDen.value = fogDen * (1 - spyK * 0.45); pu.uUnder.value = P.under ? 1 : 0; pu.uGod.value = G.settings.godrays ? 1 : 0; pu.uAO.value = G.settings.ao === false || G.lowQ() ? 0 : 1;
    {
      // foschia nelle valli: mattino presto, pioggia, foreste pluviali (Alta/Ultra)
      const hi = G.hiQ() && G.settings.godrays !== false, tday = G.time % 1;
      let mist = 0, mh = G.SEA + 3;
      if (hi) {
        const bw = G.biomeW(P.pos.x, P.pos.z, _bwM), morning = G.smooth(0.17, 0.23, tday) * (1 - G.smooth(0.3, 0.4, tday));
        mist = morning * 0.6 + bw[1] * 0.45 + (wc ? wc.rain * 0.6 + wc.snow * 0.4 : 0);
        mh = G.SEA - 2 + bw[1] * 9 + morning * 4;
      }
      if (S.dark > 0) { mist = Math.max(mist, 0.5 * S.dark); mh = Math.max(mh, G.SEA + 4 * S.dark); }
      pu.uMist.value = mist * (1 - spyK * 0.7); pu.uMistH.value = mh; pu.uDark.value = S.dark;
      const pre = G.settings.preset === 'custom' ? G.settings.basePreset : G.settings.preset;
      pu.uGodK.value = pre === 'ultra' ? 0.62 : pre === 'alta' ? 0.5 : 0.3;
      pu.uCamDepth.value = P.under ? Math.max(0, (G.waterLevelAt ? G.waterLevelAt(camera.position.x, camera.position.z, t, camera.position.y) : G.SEA) - camera.position.y) : 0;
      pu.uHeat.value = wc ? Math.max(0, wc.heat - 0.2) : 0;
    }
    pu.uDamage.value = P.dmgFlash * 0.6 + (P.health < 25 ? 0.15 + Math.sin(t * 4) * 0.08 : 0);
    // posizione del sole sullo schermo
    _proj.copy(camera.position).addScaledVector(P.under ? new THREE.Vector3(S.sun.x * 0.3, 1, S.sun.z * 0.3).normalize() : S.sun, 1000).project(camera);
    const inFront = _proj.z < 1;
    pu.uSunScreen.value.set(_proj.x * 0.5 + 0.5, _proj.y * 0.5 + 0.5);
    const edge = Math.max(Math.abs(_proj.x), Math.abs(_proj.y));
    pu.uSunVis.value = inFront ? G.clamp(1.6 - edge, 0, 1) * (P.under ? 0.8 : G.smooth(-0.02, 0.12, S.sun.y)) : 0;
    pu.uExposure.value = 0.82 + (1 - S.day) * 0.12 + (1.0 - 0.82 - (1 - S.day) * 0.12) * S.dark;
    post.quad.material = post.post;
    const useFxaa = !G.lowQ();
    renderer.setRenderTarget(useFxaa ? rtC : null);
    renderer.render(post.scene, post.cam); mark('post');
    if (useFxaa) {
      post.fxaa.uniforms.t.value = rtC.texture; post.fxaa.uniforms.uRes.value.set(G.rtSize[0], G.rtSize[1]);
      post.quad.material = post.fxaa; renderer.setRenderTarget(null); renderer.render(post.scene, post.cam); mark('fxaa');
    }
  };
  let _mt = 0; const _bwM = [0, 0, 0, 0];
  function mark(k) {
    if (!G.prof) return;
    const gl = renderer.getContext(); const rt = renderer.getRenderTarget(); if (rt && rt.texture.type === THREE.HalfFloatType) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, new Float32Array(4)); else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const n = performance.now(); (G.profLog = G.profLog || []).push(k + ':' + Math.round(n - _mt)); _mt = n;
  }

  boot().catch((e) => { console.error(e); $('loadText').textContent = 'Errore di avvio: ' + e.message; });
})();
