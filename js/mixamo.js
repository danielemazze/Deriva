/* =========================================================
   Personaggi Mixamo (scelti dal giocatore): cavaliere e paladino
   nel castello, Morak tra i banditi, Arissa ed Erika come abitanti
   e come nemiche, la piratessa sulle navi e nei covi.
   Tutti hanno lo stesso scheletro: le animazioni (fermo, camminata,
   corsa, colpito, due attacchi) vanno bene per tutti.
   Si caricano in sottofondo; finché non sono pronti restano i
   personaggi di prima. Sul telefono non si caricano (troppo pesanti).
   ========================================================= */
(function () {
  const MX = (G.MX = { ready: false, models: {}, clips: {} });
  const KINDS = ['knight', 'paladin', 'morak', 'arissa', 'erika', 'pirate'];
  const FEMALE = { arissa: true, erika: true, pirate: true };
  MX.load = async function (base) {
    if (G.isTouch || !THREE.GLTFLoader || !THREE.SkeletonUtils) return;
    const L = new THREE.GLTFLoader();
    try {
      const A = await L.loadAsync(base + 'anims.glb');
      for (const c of A.animations) {
        // niente spostamento del bacino: lo muove il gioco (e le unità cambiano da un personaggio all'altro)
        c.tracks = c.tracks.filter((t) => !/Hips\.position$/.test(t.name)).map((t) => { t.name = t.name.replace(/^mixamorig\d*/, 'mixamorig'); return t; });
        MX.clips[c.name] = c;
      }
      await Promise.all(KINDS.map(async (k) => {
        try {
          const g = await L.loadAsync(base + k + '.glb'), s = g.scene;
          s.traverse((o) => { if (o.isBone) o.name = o.name.replace(/^mixamorig\d*/, 'mixamorig'); if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.anisotropy = 4; } });
          const b = new THREE.Box3().setFromObject(s), h = b.max.y - b.min.y;
          MX.models[k] = { scene: s, scale: 1.78 / h, foot: -b.min.y };
        } catch (e) { console.warn('personaggio non caricato', k, e); }
      }));
      MX.ready = Object.keys(MX.models).length > 0 && !!MX.clips.camminata;
    } catch (e) { console.warn('personaggi Mixamo non disponibili', e); }
  };
  // chi diventa chi (in base a cosa si chiede al vecchio costruttore)
  MX.pick = function (look, opts) {
    if (!MX.ready) return null;
    opts = opts || {};
    const r = G.mulberry32((look | 0) + 777)();
    let k = null;
    if (opts.mx) k = opts.mx;
    else if (opts.captain) k = 'pirate';
    else if (opts.pirate) k = opts.female === false ? 'morak' : r < 0.35 ? 'pirate' : r < 0.7 ? 'morak' : r < 0.85 ? 'arissa' : 'erika';
    else if (opts.guard) k = r < 0.5 ? 'knight' : 'paladin';
    else if (!opts.outfit && opts.female !== false) {
      // abitanti: le donne sono Arissa o Erika
      const fem = opts.female !== undefined ? opts.female : G.mulberry32((look | 0) + 101)() < 0.45;
      if (fem) k = r < 0.5 ? 'arissa' : 'erika';
    }
    return k && MX.models[k] ? k : null;
  };
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  MX.build = function (k, look, opts) {
    const md = MX.models[k], rnd = G.mulberry32((look | 0) + 33);
    const obj = THREE.SkeletonUtils.clone(md.scene);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(obj);
    const sc = md.scale * (0.96 + rnd() * 0.08) * (opts && opts.captain ? 1.05 : 1);
    obj.scale.multiplyScalar(sc); obj.position.y = md.foot * sc;
    obj.updateMatrixWorld(true);
    const mixer = new THREE.AnimationMixer(obj), acts = {};
    for (const [n, c] of Object.entries(MX.clips)) acts[n] = mixer.clipAction(c);
    for (const n of ['attacco1', 'attacco2', 'colpito']) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = true; }
    // mani: gruppi in metri, attaccati alle ossa delle mani
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const hand = (n) => { const g = new THREE.Group(), b = obj.getObjectByName('mixamorig' + n); if (b) { _m.copy(b.matrixWorld); _m.decompose(_v, _q, _s); g.scale.set(1 / _s.x, 1 / _s.y, 1 / _s.z); b.add(g); } return g; };
    const head = new THREE.Group(), hb = obj.getObjectByName('mixamorigHead'); if (hb) { hb.updateMatrixWorld(true); hb.matrixWorld.decompose(_v, _q, _s); head.scale.set(1 / _s.x, 1 / _s.y, 1 / _s.z); hb.add(head); }
    const p = { root, body, obj, bones: {}, head, handR: hand('RightHand'), handL: hand('LeftHand'), weapon: null, phase: rnd() * 6, female: !!FEMALE[k], height: 1.78 * (sc / md.scale), human: true, mx: { mixer, acts, cur: null, busy: 0, kind: k }, aR: {}, aL: {}, t: rnd() * 10, look: 0 };
    p.aR.hand = p.handR; p.aL.hand = p.handL;
    const idle = acts.fermo || acts.idle1; if (idle) { idle.play(); idle.time = rnd() * idle.getClip().duration; p.mx.cur = idle; }
    mixer.update(0);
    return p;
  };
  function play(p, name, fade, ts) {
    const M = p.mx, a = M.acts[name]; if (!a) return;
    if (ts) a.timeScale = ts;
    if (M.cur === a) return;
    a.reset(); a.play(); if (M.cur) a.crossFadeFrom(M.cur, fade, false);
    M.cur = a;
  }
  // stessi argomenti del vecchio animatore: velocità in m/s e uno stato
  MX.pose = function (p, dt, speed, state, k) {
    const M = p.mx;
    if (state === 'attack' && M.busy <= 0) { const n = Math.random() < 0.5 ? 'attacco1' : 'attacco2'; if (M.acts[n]) { play(p, n, 0.12, 1.25); M.busy = M.acts[n].getClip().duration / 1.25 * 0.9; } }
    else if (state === 'hurt' && M.busy <= 0 && M.acts.colpito) { play(p, 'colpito', 0.1, 1); M.busy = M.acts.colpito.getClip().duration * 0.8; }
    M.busy -= dt;
    if (M.busy <= 0) {
      if (speed > 2.6 && M.acts.corsa) play(p, 'corsa', 0.25, Math.min(1.5, Math.max(0.7, speed / 4.2)));
      else if (speed > 0.15) play(p, (M.kind === 'knight' || M.kind === 'paladin') && M.acts.camm2 ? 'camm2' : 'camminata', 0.25, Math.min(1.6, Math.max(0.6, speed / 1.45)));
      else {
        const hostile = M.kind === 'morak' || M.kind === 'pirate' || state === 'alert';
        play(p, hostile && M.acts.allerta ? 'allerta' : (p.phase % 6 < 3 ? 'fermo' : 'idle1'), 0.4, 1);
      }
    }
    M.mixer.update(dt);
  };
  // aggancio: People.build / People.animate scelgono i personaggi Mixamo quando ci sono
  const H = G.People, b0 = H.build, a0 = H.animate;
  H.build = function (look, opts) { const k = MX.pick(look, opts); if (k) { try { return MX.build(k, look, opts || {}); } catch (e) { console.warn(e); } } return b0(look, opts); };
  H.animate = function (p, dt, speed, state, k) { if (p.mx) return MX.pose(p, dt, speed, state, k); return a0(p, dt, speed, state, k); };
})();
