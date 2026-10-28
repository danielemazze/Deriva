/* =========================================================
   Modelli animati (glTF): animali della fattoria di Quaternius (CC0).
   Ogni animale è un clone con il suo scheletro e un AnimationMixer.
   ========================================================= */
(function () {
  const A = (G.AnimLib = { models: {}, ready: false });
  // nome nel gioco → file, lunghezza del corpo in metri, da chi prendere le animazioni mancanti
  A.LIST = {
    pecora: { file: 'sheep', len: 1.25, clips: 'cow' },
    mucca: { file: 'cow', len: 2.1 },
    maiale: { file: 'pig', len: 1.35, clips: 'cow' },
    cavallo: { file: 'horse', len: 2.25 },
    lama: { file: 'llama', len: 1.55, clips: 'horse' },
    zebra: { file: 'zebra', len: 2.15 },
    cane: { file: 'pug', len: 0.75, clips: 'cow' },
  };
  A.load = async function (base) {
    if (!THREE.GLTFLoader) return;
    const L = new THREE.GLTFLoader(), files = {};
    const want = [...new Set(Object.values(A.LIST).map((d) => d.file))];
    await Promise.all(want.map(async (f) => { try { files[f] = await L.loadAsync(base + f + '.glb'); } catch (e) { console.warn('modello non caricato', f, e); } }));
    const clipsOf = (f) => { const g = files[f]; const o = {}; if (g) for (const c of g.animations) o[c.name.replace(/^.*\|/, '')] = c; return o; };
    for (const [sp, d] of Object.entries(A.LIST)) {
      const g = files[d.file]; if (!g) continue;
      const sc = g.scene; sc.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sc), size = box.getSize(new THREE.Vector3());
      const own = clipsOf(d.file), lend = d.clips ? clipsOf(d.clips) : {};
      // le animazioni prese in prestito tengono solo le rotazioni (le proporzioni sono diverse)
      const clips = Object.assign({}, own);
      for (const [k, c] of Object.entries(lend)) if (!clips[k]) clips[k] = new THREE.AnimationClip(k, c.duration, c.tracks.filter((t) => t.name.endsWith('.quaternion')));
      sc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.roughness = 0.85; o.material.metalness = 0; o.material.flatShading = true; o.material.needsUpdate = true; } } });
      A.models[sp] = { scene: sc, clips, scale: d.len / Math.max(size.z, size.x), minY: box.min.y, height: size.y };
    }
    A.ready = true;
  };
  A.has = (sp) => !!A.models[sp];
  // un nuovo esemplare: { root, mixer, act(nome), height }
  A.make = function (sp) {
    const m = A.models[sp]; if (!m) return null;
    const obj = THREE.SkeletonUtils.clone(m.scene);
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.add(obj);
    inner.scale.setScalar(m.scale); inner.position.y = -m.minY * m.scale;
    // i modelli guardano dalla parte opposta rispetto al gioco: si gira il gruppo esterno di 180°
    // (non il modello, perché le animazioni ne riscrivono la rotazione), così camminano col muso in avanti
    inner.rotation.y = Math.PI;
    const mixer = new THREE.AnimationMixer(obj), acts = {};
    for (const [k, c] of Object.entries(m.clips)) acts[k] = mixer.clipAction(c);
    let cur = null;
    const act = (name, fade) => {
      const a = acts[name] || acts.Idle; if (!a || a === cur) return a;
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (name === 'Death') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      if (cur) cur.crossFadeTo(a, fade === undefined ? 0.25 : fade, false);
      cur = a; return a;
    };
    act('Idle', 0);
    return { root, inner, obj, mixer, act, acts, height: m.height * m.scale };
  };
})();
