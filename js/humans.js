/* =========================================================
   Persone vere: vestiti "Modular Character Outfits – Fantasy" di
   Quaternius (contadino/a, ranger uomo/donna, CC0) con una testa
   modellata qui (viso, occhi, sopracciglia, capelli, barba) e
   animazioni fatte muovendo direttamente le ossa dello scheletro.
   Se i modelli non si caricano resta il vecchio omino (people.js).
   ========================================================= */
(function () {
  const H = G.People, V3 = THREE.Vector3, Q = THREE.Quaternion;
  const HU = (G.Humans = { ready: false, models: {} });
  const OUTFITS = { contadino: 'Male_Peasant', contadina: 'Female_Peasant', ranger: 'Male_Ranger', ranger_f: 'Female_Ranger' };
  const SKINS = ['Light', 'Dark', 'Deep'];
  // tinta della pelle del viso (sRGB) per ognuna delle tre texture del corpo
  const SKIN_RGB = { Light: [0.78, 0.56, 0.42], Dark: [0.64, 0.43, 0.3], Deep: [0.33, 0.21, 0.14] };
  const HAIRC = [0x2a1a10, 0x150f0b, 0x5a3418, 0x8a5428, 0xb07a3a, 0xd2ad6a, 0x6e2c14, 0x8f8a84, 0x3a2416];
  const BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
  const FING = ['index', 'middle', 'ring', 'pinky'];

  HU.load = async function (base) {
    if (!THREE.GLTFLoader) return;
    const L = new THREE.GLTFLoader(), TL = new THREE.TextureLoader();
    await Promise.all(Object.entries(OUTFITS).map(async ([k, f]) => {
      try {
        const g = await L.loadAsync(base + f + '.gltf');
        const sc = g.scene; sc.updateMatrixWorld(true);
        sc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const m = o.material; if (m) { m.side = THREE.FrontSide; m.envMapIntensity = 0.6; } } });
        HU.models[k] = { scene: sc, female: f.startsWith('Female'), hood: f.includes('Ranger') };
      } catch (e) { console.warn('persona non caricata', f, e); }
    }));
    // texture della pelle chiara / scura per le braccia e le mani
    HU.skinTex = {};
    await Promise.all(['Male', 'Female'].flatMap((sx) => SKINS.map(async (s) => {
      try { const t = await TL.loadAsync(base + `T_Regular_${sx}_${s}_BaseColor.jpg`); t.flipY = false; t.encoding = THREE.sRGBEncoding; HU.skinTex[sx + s] = t; } catch (e) { }
    })));
    HU.ready = Object.keys(HU.models).length > 0;
  };

  /* ---------------- la testa ---------------- */
  const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));
  function colorize(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
  const lin = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]).convertSRGBToLinear();
  // cranio + viso: una sfera deformata (mascella, zigomi, naso, arcate, orbite, mento).
  // Capelli, barba, sopracciglia e labbra sono "dipinti" sui vertici e un po' sollevati.
  const CY = 0.07, CZ = 0.012;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function deform(x, y, z, female) {
    const W = female ? 0.072 : 0.077, Hh = female ? 0.106 : 0.112, D = female ? 0.093 : 0.098;
    const low = Math.max(0, -y);
    let sx = W * (1 - low * (female ? 0.3 : 0.22) * (0.6 + 0.4 * Math.max(0, z))), sz = D * (1 - low * 0.1);
    if (y < -0.55) sz *= 1 + (z > 0 ? 0.08 : -0.2) * (-y - 0.55) * 2;
    let X = x * sx, Y = y * Hh, Z = z * sz;
    const fz = Math.max(0, z);
    Z += 0.022 * gauss(x * x * 1.6 + (y + 0.13) * (y + 0.13) * 0.5, 0.1) * fz * fz * (female ? 0.8 : 1); // naso
    Y -= 0.004 * gauss(x * x + (y + 0.27) * (y + 0.27), 0.07) * fz;
    Z += 0.007 * gauss((y - 0.2) * (y - 0.2) * 8 + x * x * 0.5, 0.25) * fz; // arcate
    for (const s of [-1, 1]) Z -= 0.011 * gauss((x - s * 0.36) * (x - s * 0.36) + (y - 0.05) * (y - 0.05) * 1.6, 0.11) * fz; // orbite
    for (const s of [-1, 1]) X += s * 0.005 * gauss((x - s * 0.72) * (x - s * 0.72) + (y + 0.12) * (y + 0.12), 0.15); // zigomi
    Z -= 0.004 * gauss(x * x * 2 + (y + 0.47) * (y + 0.47) * 6, 0.18) * fz; // bocca
    Z += 0.004 * gauss(x * x * 4 + (y + 0.46) * (y + 0.46) * 30, 0.2) * fz; // labbra
    Z += 0.006 * gauss(x * x * 2 + (y + 0.8) * (y + 0.8) * 4, 0.2) * fz; // mento
    return [X, Y + CY, Z + CZ];
  }
  function headGeo(o, skin, hairC, lip) {
    const g = new THREE.SphereGeometry(1, 72, 54), p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    const hairD = o.hood ? 0 : o.style === 'calvo' ? 0 : o.style === 'rasati' ? 0.003 : 0.009;
    const brow = hairC.clone().multiplyScalar(0.75), stub = skin.clone().lerp(hairC, 0.45);
    const nrm = new V3(), tmp = new V3();
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
      const [X, Y, Z] = deform(x, y, z, o.female);
      let c = skin, lift = 0;
      // capelli: attaccatura alta in fronte, bassa sulla nuca, basette sui lati
      if (hairD || o.style === 'calvo') {
        const zf = sstep(-0.35, 0.55, z);
        let line = -0.42 + zf * (0.88 - 0.22 * ax * ax) + (o.style === 'calvo' ? 0 : 0);
        if (ax > 0.75 && z > -0.3 && z < 0.45) line = Math.min(line, o.female ? 0.05 : 0.15);
        let m = sstep(line - 0.03, line + 0.05, y);
        if (o.style === 'calvo') m *= 1 - sstep(0.2, 0.35, y); // corona calva, capelli solo ai lati e dietro
        if (m > 0) { c = c.clone().lerp(hairC, m); lift = Math.max(lift, m * (o.style === 'calvo' ? 0.004 : hairD) * (1 + 0.15 * Math.sin(x * 23 + z * 17) * Math.sin(y * 19))); }
      }
      // barba e baffi
      if (o.beard) {
        const mouth = ax < 0.34 && y > -0.58 && y < -0.38 && z > 0.55;
        let bm = 0;
        if (o.beard !== 'baffi') bm = (1 - sstep(-0.3, -0.12, y)) * sstep(-0.3, 0.0, z) * (mouth ? 0 : 1);
        if (o.beard !== 'baffi' && ax > 0.6 && z > -0.25 && z < 0.45) bm = Math.max(bm, 1 - sstep(0.05, 0.18, y)); // basette
        const must = ax < 0.42 && y > -0.42 && y < -0.3 && z > 0.6 ? 1 - sstep(0.3, 0.42, ax) : 0;
        if (o.beard !== 'corta') bm = Math.max(bm, must);
        if (bm > 0) { const full = o.beard === 'corta' ? 0.55 : 1; c = c.clone().lerp(o.beard === 'corta' ? stub : hairC, bm * full); lift = Math.max(lift, bm * (o.beard === 'corta' ? 0.0015 : 0.006)); }
      }
      // sopracciglia
      if (z > 0.6 && ax > 0.12 && ax < 0.58) { const bm = gauss((y - (0.21 - (ax - 0.35) * (ax - 0.35) * 0.6)) * (y - (0.21 - (ax - 0.35) * (ax - 0.35) * 0.6)), 0.03); if (bm > 0.2) { c = c.clone().lerp(brow, Math.min(1, bm * 1.3)); lift = Math.max(lift, 0.0015 * bm); } }
      // labbra
      if (z > 0.6) { const lm = gauss(x * x * (o.female ? 6 : 8) + (y + 0.465) * (y + 0.465) * 260, 0.35); if (lm > 0.15) c = c.clone().lerp(lip, Math.min(1, lm * 1.2)); }
      // guance appena rosate, ombra sotto il mento
      if (z > 0.4) { const ch = gauss((ax - 0.5) * (ax - 0.5) + (y + 0.2) * (y + 0.2), 0.14); if (ch > 0.1) c = c.clone().lerp(lip, ch * 0.12); }
      nrm.set(x, y, z).normalize();
      p.setXYZ(i, X + nrm.x * lift, Y + nrm.y * lift, Z + nrm.z * lift);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  function headMeshes(o, rnd) {
    const M = G.MODELS, female = o.female;
    const skin = lin(SKIN_RGB[o.skin]), hairC = new THREE.Color(o.hair).convertSRGBToLinear();
    const lip = skin.clone().lerp(new THREE.Color(0.5, 0.12, 0.1), female ? 0.4 : 0.25);
    const parts = [headGeo(o, skin, hairC, lip)];
    // collo
    const neck = new THREE.CylinderGeometry(female ? 0.043 : 0.052, female ? 0.05 : 0.06, 0.13, 18); neck.translate(0, -0.03, -0.012); parts.push(colorize(neck, skin));
    // orecchie
    for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.02, 12, 10); e.scale(0.42, 1.25, 0.8); e.rotateY(s * 0.35); const [X, Y, Z] = deform(s * 0.98, 0.02, -0.05, female); e.translate(X + s * 0.004, Y, Z); parts.push(colorize(e, skin)); }
    const meshes = [new THREE.Mesh(M.merge(parts), HU.matSkin)];
    // occhi nelle orbite: bianco, iride, pupilla, palpebra superiore
    const eyeG = [], irisG = [], lidG = [];
    const iris = new THREE.Color([0x3a2616, 0x2a4a6a, 0x3a5a2a, 0x1a120c, 0x5a7a8a][(rnd() * 5) | 0]).convertSRGBToLinear();
    for (const s of [-1, 1]) {
      const nx = s * 0.36, ny = 0.05, nz = Math.sqrt(1 - nx * nx - ny * ny);
      const [X, Y, Z] = deform(nx, ny, nz, female);
      const r = female ? 0.0138 : 0.0132, ex = X * 0.97, ey = Y, ez = Z - r * 0.55;
      const w = new THREE.SphereGeometry(r, 16, 12); w.translate(ex, ey, ez); eyeG.push(colorize(w, new THREE.Color(0.8, 0.78, 0.74)));
      const ir = new THREE.CircleGeometry(r * 0.52, 18); ir.translate(ex, ey, ez + r * 0.985); irisG.push(colorize(ir, iris));
      const pu = new THREE.CircleGeometry(r * 0.22, 12); pu.translate(ex, ey, ez + r * 0.995); irisG.push(colorize(pu, new THREE.Color(0.005, 0.005, 0.005)));
      const ld = new THREE.SphereGeometry(r * 1.08, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4); ld.rotateX(0.45); ld.translate(ex, ey, ez); lidG.push(colorize(ld, skin.clone().multiplyScalar(0.9)));
    }
    meshes.push(new THREE.Mesh(M.merge(eyeG), HU.matEye), new THREE.Mesh(M.merge(irisG), HU.matIris), new THREE.Mesh(M.merge(lidG), HU.matSkin));
    // capelli lunghi, coda, chignon, ciuffo
    if (!o.hood) {
      const hp = [], st = o.style;
      if (st === 'lunghi') { const L = new THREE.SphereGeometry(1, 24, 18); L.scale(0.075, 0.12, 0.045); L.translate(0, CY - 0.05, CZ - 0.07); hp.push(L); for (const s of [-1, 1]) { const c = new THREE.SphereGeometry(1, 14, 12); c.scale(0.02, 0.09, 0.04); c.translate(s * 0.068, CY - 0.05, CZ - 0.01); hp.push(c); } }
      if (st === 'coda') { const t = new THREE.CylinderGeometry(0.02, 0.006, 0.17, 10); t.translate(0, -0.085, 0); t.rotateX(0.35); t.translate(0, CY + 0.04, CZ - 0.1); hp.push(t); const k = new THREE.SphereGeometry(0.022, 10, 8); k.translate(0, CY + 0.04, CZ - 0.098); hp.push(k); }
      if (st === 'chignon') { const b = new THREE.SphereGeometry(0.034, 16, 12); b.translate(0, CY + 0.09, CZ - 0.07); hp.push(b); }
      if (st === 'ciuffo') { const c = new THREE.SphereGeometry(0.045, 16, 10); c.scale(1.3, 0.5, 1.1); c.translate(0, CY + 0.1, CZ + 0.02); hp.push(c); }
      if (o.beard === 'piena') { const b = new THREE.SphereGeometry(0.03, 14, 10); b.scale(1.3, 0.9, 0.8); const [X, Y, Z] = deform(0, -0.85, 0.5, female); b.translate(X, Y - 0.006, Z - 0.012); hp.push(b); }
      if (hp.length) meshes.push(new THREE.Mesh(colorize(M.merge(hp), hairC), HU.matHair));
    }
    for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    return meshes;
  }
  function mats() {
    if (HU.matSkin) return;
    HU.matSkin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
    HU.matHair = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
    HU.matEye = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0 });
    HU.matIris = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  /* ---------------- costruzione ---------------- */
  const _q = new Q(), _q2 = new Q(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _v = new V3(), _s = new V3();
  HU.build = function (look, opts) {
    opts = opts || {};
    mats();
    const rnd = G.mulberry32((look | 0) + 101);
    const female = opts.female !== undefined ? opts.female : rnd() < 0.45;
    let kind = opts.outfit || (opts.pirate || opts.captain ? (female ? 'contadina' : 'contadino') : rnd() < 0.7 ? (female ? 'contadina' : 'contadino') : (female ? 'ranger_f' : 'ranger'));
    if (!HU.models[kind]) kind = Object.keys(HU.models)[0];
    const md = HU.models[kind];
    const obj = THREE.SkeletonUtils.clone(md.scene);
    const skinK = opts.skin || SKINS[rnd() < 0.42 ? 0 : rnd() < 0.7 ? 1 : 2];
    const sx = md.female ? 'Female' : 'Male';
    // vestiti: ogni persona ha una sfumatura diversa; la pelle di braccia e mani prende la tinta giusta
    const tint = new THREE.Color().setHSL(rnd(), opts.pirate ? 0.25 : 0.12, opts.pirate ? 0.55 : 0.78 + rnd() * 0.2);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && m.name && m.name.startsWith('MI_Regular')) { o.material = m.clone(); o.material.map = HU.skinTex[sx + skinK] || m.map; }
      else if (m) { o.material = m.clone(); o.material.color.copy(opts.pirate ? new THREE.Color(0.5, 0.42, 0.4) : tint); if (opts.captain) o.material.color.setRGB(0.42, 0.2, 0.18); }
      if (md.hood && /Hood/.test(o.name) && opts.noHood) o.visible = false;
    });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(obj);
    const sc = (opts.captain ? 1.06 : 0.95 + rnd() * 0.1) * (md.female ? 0.97 : 1.03);
    body.scale.setScalar(sc);
    obj.updateMatrixWorld(true);
    // ossa: posa di riposo (locale) e orientamento nello spazio del modello
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const bones = {};
    const reg = (n) => { const b = obj.getObjectByName(n); if (!b) return; _m.multiplyMatrices(inv, b.matrixWorld); _m.decompose(_v, _q, _s); bones[n] = { b, rest: b.quaternion.clone(), W: _q.clone(), Wi: _q.clone().invert(), restPos: b.position.clone() }; };
    BONES.forEach(reg);
    for (const s of ['l', 'r']) { for (const f of FING) for (let i = 1; i <= 3; i++) reg(`${f}_0${i}_${s}`); for (let i = 1; i <= 3; i++) reg(`thumb_0${i}_${s}`); }
    // testa
    const hb = bones.Head;
    const head = new THREE.Group();
    if (hb) {
      _m.multiplyMatrices(inv, hb.b.matrixWorld); _m.decompose(_v, _q, _s);
      head.quaternion.copy(_q).invert(); head.scale.set(1.1 / _s.x, 1.1 / _s.y, 1.1 / _s.z);
      hb.b.add(head);
      const style = opts.hairStyle || (md.female ? ['lunghi', 'chignon', 'coda', 'lunghi'][(rnd() * 4) | 0] : ['corti', 'corti', 'rasati', 'ciuffo', 'calvo'][(rnd() * 5) | 0]);
      const beard = md.female ? null : opts.pirate ? ['piena', 'corta', 'baffi'][(rnd() * 3) | 0] : rnd() < 0.45 ? ['corta', 'piena', 'baffi'][(rnd() * 3) | 0] : null;
      const hair = opts.hairColor || HAIRC[(rnd() * HAIRC.length) | 0];
      for (const m of headMeshes({ female: md.female, skin: skinK, hair, style, beard, hood: md.hood && !opts.noHood }, rnd)) head.add(m);
      // cappelli dei pirati: tricorno o bandana, sopra la testa
      if (opts.pirate || opts.captain) {
        const cap = opts.captain || rnd() < 0.5;
        const c = new THREE.Color(opts.captain ? 0.02 : 0.04, 0.03, 0.025);
        const hatParts = [];
        if (cap) { const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.018, 3); brim.rotateY(Math.PI / 6 + Math.PI); brim.translate(0, CY + 0.088, 0.008); hatParts.push(colorize(brim, c)); const t = new THREE.SphereGeometry(0.092, 16, 10); t.scale(1, 0.72, 1.05); t.translate(0, CY + 0.095, 0.012); hatParts.push(colorize(t, c)); }
        else { const t = new THREE.SphereGeometry(0.098, 18, 12); t.scale(0.9, 0.8, 1.04); t.translate(0, CY + 0.03, 0.012); hatParts.push(colorize(t, new THREE.Color(0.45, 0.03, 0.025))); const k = new THREE.SphereGeometry(0.03, 8, 6); k.scale(0.7, 1.6, 0.6); k.translate(-0.02, CY - 0.01, -0.1); hatParts.push(colorize(k, new THREE.Color(0.45, 0.03, 0.025))); }
        const hm = new THREE.Mesh(G.MODELS.merge(hatParts), HU.matHair); hm.castShadow = true; head.add(hm);
      }
    }
    // mani: gruppi a cui appendere attrezzi e armi
    const hand = (s) => { const g = new THREE.Group(); const b = bones['hand_' + s]; if (b) { _m.multiplyMatrices(inv, b.b.matrixWorld); _m.decompose(_v, _q, _s); g.quaternion.copy(_q).invert(); g.scale.set(1 / _s.x, 1 / _s.y, 1 / _s.z); b.b.add(g); const off = new THREE.Group(); off.position.set(s === 'l' ? 0.08 : -0.08, -0.01, 0.02); g.add(off); return off; } return g; };
    const handR = hand('r'), handL = hand('l');
    let weapon = null;
    if (opts.pirate || opts.captain) { weapon = G.Tools.build('sciabola'); if (weapon) { weapon.scale.setScalar(1.2); weapon.rotation.set(Math.PI / 2, 0, 0); handR.add(weapon); } }
    else if (opts.tool) { weapon = G.Tools.build(opts.tool); if (weapon) { weapon.rotation.set(Math.PI / 2, 0, 0); handR.add(weapon); } }
    // per compatibilità con chi usa i campi del vecchio omino
    const p = { root, body, obj, bones, head, handR, handL, weapon, phase: rnd() * 6, female: md.female, height: 1.78 * sc, human: true, aR: { hand: handR }, aL: { hand: handL }, t: rnd() * 10, look: 0 };
    HU.pose(p, 0, 0, 'idle', 0);
    return p;
  };

  /* ---------------- animazione per ossa ----------------
     Ogni rotazione è data negli assi del modello (x = sinistra del personaggio, y = su, z = avanti)
     e applicata come se l'osso fosse ancora nella posa a T. */
  function rot(p, n, x, y, z) {
    const B = p.bones[n]; if (!B) return;
    _e.set(x, y, z, 'XYZ'); _q.setFromEuler(_e);
    B.b.quaternion.copy(B.rest).multiply(_q2.copy(B.Wi).multiply(_q).multiply(B.W));
  }
  // come rot ma con l'ordine "prima giù, poi avanti/indietro" (per braccia e gambe)
  function rot2(p, n, first, then) {
    const B = p.bones[n]; if (!B) return;
    _e.set(first[0], first[1], first[2], 'XYZ'); const a = new Q().setFromEuler(_e);
    _e.set(then[0], then[1], then[2], 'XYZ'); _q.setFromEuler(_e).multiply(a);
    B.b.quaternion.copy(B.rest).multiply(_q2.copy(B.Wi).multiply(_q).multiply(B.W));
  }
  HU.pose = function (p, dt, speed, state, k) {
    p.t += dt;
    p.phase += dt * (speed > 0.1 ? 2.4 + speed * 1.55 : 1.2);
    const t = p.t, ph = p.phase;
    const run = Math.min(1, Math.max(0, (speed - 1.8) / 2.5)), walk = Math.min(1, speed / 1.2);
    const s = Math.sin(ph), c = Math.cos(ph);
    const amp = walk * (0.5 + run * 0.35);
    const breath = Math.sin(t * 1.6) * 0.025;
    // gambe
    let thL = -s * amp, thR = s * amp, knL = Math.max(0, c) * amp * 1.35 + 0.05, knR = Math.max(0, -c) * amp * 1.35 + 0.05;
    // braccia lungo i fianchi (dalla posa a T), oscillano col passo
    let armDown = 1.28 - walk * 0.04, swL = s * amp * 0.75, swR = -s * amp * 0.75, elL = 0.25 + run * 0.9, elR = 0.25 + run * 0.9;
    let spineX = 0.03 + run * 0.2 + breath * 0.3, spineY = s * 0.07 * walk, headX = -0.04 - run * 0.1, headY = 0;
    let hipY = 0, bodyX = 0, bodyY = Math.abs(c) * 0.035 * walk - run * 0.04, armSideL = 0, armSideR = 0;
    if (state === 'talk') {
      swR = -0.5 + Math.sin(t * 3.1) * 0.25; elR = 1.0 + Math.sin(t * 4.3) * 0.35; armSideR = 0.15;
      headY = Math.sin(t * 1.3) * 0.18; headX = Math.sin(t * 2.2) * 0.06 - 0.03;
    }
    if (p.weapon && state !== 'attack' && speed < 0.2 && state !== 'swim') { swR = -0.35; elR = 0.9; }
    if (state === 'attack') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      swR = -2.5 * a + 0.2; elR = 0.4; armSideR = -0.4 * a; spineY = 0.45 * a;
    }
    if (state === 'swim') {
      // a pancia in giù: bracciate e gambe che battono
      bodyX = 1.25; thL = Math.sin(t * 6) * 0.3; thR = -Math.sin(t * 6) * 0.3; knL = 0.2; knR = 0.2;
      swL = -2.6 + Math.sin(t * 3) * 1.0; swR = -2.6 - Math.sin(t * 3) * 1.0; elL = elR = 0.3; armDown = 1.2; headX = -0.7; bodyY = -0.9;
    }
    if (state === 'helm' || state === 'sit') { swL = swR = -1.0 + Math.sin(t * 1.3) * 0.06; elL = elR = 0.6; }
    if (state === 'helm') { swL = swR = -0.95 + Math.sin(t * 1.3) * 0.06; elL = elR = 0.7; armSideL = armSideR = 0.25; }
    if (state === 'sit') { thL = thR = -1.45; knL = knR = 1.45; bodyY = -0.42; }
    p.body.rotation.x += ((state === 'swim' ? bodyX : 0) - p.body.rotation.x) * Math.min(1, (dt || 1) * 6);
    p.body.position.y = bodyY;
    rot(p, 'pelvis', 0, spineY * -0.5 + hipY, 0);
    rot(p, 'spine_01', spineX * 0.4, spineY * 0.4, 0);
    rot(p, 'spine_02', spineX * 0.3, spineY * 0.3, 0);
    rot(p, 'spine_03', spineX * 0.3 - breath * 0.3, spineY * 0.3, 0);
    rot(p, 'neck_01', headX * 0.4, headY * 0.4, 0);
    rot(p, 'Head', headX * 0.6 + (p.look || 0), headY * 0.6, 0);
    rot(p, 'clavicle_l', 0, 0, -0.08); rot(p, 'clavicle_r', 0, 0, 0.08);
    rot2(p, 'upperarm_l', [0, 0, -armDown + armSideL], [swL, 0, 0]);
    rot2(p, 'upperarm_r', [0, 0, armDown - armSideR], [swR, 0, 0]);
    rot(p, 'lowerarm_l', 0, -elL, 0); rot(p, 'lowerarm_r', 0, elR, 0);
    rot(p, 'hand_l', 0, 0, -0.15); rot(p, 'hand_r', 0, 0, 0.15);
    rot(p, 'thigh_l', thL, 0, 0.02); rot(p, 'thigh_r', thR, 0, -0.02);
    rot(p, 'calf_l', knL, 0, 0); rot(p, 'calf_r', knR, 0, 0);
    rot(p, 'foot_l', -knL * 0.35, 0, 0); rot(p, 'foot_r', -knR * 0.35, 0, 0);
    // dita piegate (mano rilassata, o chiusa se impugna qualcosa)
    for (const sd of ['l', 'r']) {
      const grip = sd === 'r' && p.weapon ? 1.3 : 0.45, sg = sd === 'l' ? -1 : 1;
      for (const f of FING) for (let i = 1; i <= 3; i++) rot(p, `${f}_0${i}_${sd}`, 0, 0, 0), rotFinger(p, `${f}_0${i}_${sd}`, grip * (i === 1 ? 0.8 : 1), sg);
      rotFinger(p, `thumb_02_${sd}`, 0.3, sg);
    }
  };
  // le dita nella posa a T puntano lungo x: si chiudono girando attorno all'asse z del modello (verso il basso)
  function rotFinger(p, n, a, sg) { const B = p.bones[n]; if (!B) return; _e.set(0, 0, 0); _q.setFromAxisAngle(_v.set(0, 0, 1), sg * a); _q.premultiply(new Q().setFromAxisAngle(_s.set(0, 1, 0), 0)); B.b.quaternion.copy(B.rest).multiply(_q2.copy(B.Wi).multiply(_q).multiply(B.W)); }

  // aggancio al vecchio modulo: se i modelli ci sono si usano loro
  const oldBuild = H.build, oldAnim = H.animate;
  H.buildOld = oldBuild;
  H.build = function (look, opts) { if (HU.ready && !(opts && opts.old)) { try { return HU.build(look, opts); } catch (e) { console.warn(e); } } return oldBuild(look, opts); };
  H.animate = function (p, dt, speed, state, k) { if (p.human) return HU.pose(p, dt, speed, state, k); return oldAnim(p, dt, speed, state, k); };
})();
