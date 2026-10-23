'use strict';
/* ==========================================================
   Persone: abitanti dei villaggi e pirati.
   Corpo articolato (bacino, busto, testa, braccia e gambe in
   due segmenti) con vestiti, cappelli e armi; animazioni di
   camminata, riposo, parlata e attacco.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const H = (G.People = {});
  const M = () => G.MODELS;
  const V3 = THREE.Vector3;
  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
      cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, map: G.TEX.clothT.map, normalMap: G.TEX.clothT.normal, normalScale: new THREE.Vector2(0.6, 0.6) }),
      eye: new THREE.MeshBasicMaterial({ color: 0x141414 }),
    };
    return MAT;
  }
  const col = (g, c) => M().colorize(g, c[0], c[1], c[2]);
  // capsula orientata lungo -Y a partire dall'origine (per arti appesi a un perno)
  function limbGeo(r0, r1, len, c) {
    const g = new THREE.CylinderGeometry(r1, r0, len, 10, 3); g.translate(0, -len / 2, 0);
    const a = new THREE.SphereGeometry(r0, 10, 6); const b = new THREE.SphereGeometry(r1, 10, 6); b.translate(0, -len, 0);
    return col(M().merge([g, a, b]), c);
  }
  function sph(r, sx, sy, sz, x, y, z, c, seg) { const g = new THREE.SphereGeometry(r, seg || 14, (seg || 14) * 0.7); g.scale(sx, sy, sz); g.translate(x, y, z); return col(g, c); }
  function boxg(w, h, d, x, y, z, c) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return col(g, c); }
  const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const SKIN = [0xf1c8a5, 0xd9a27a, 0xb57a52, 0x8a5634, 0x5e3a22];
  const HAIR = [0x1d140e, 0x3a2618, 0x6a4422, 0xa8743e, 0x9a9690, 0xd8c8a0];
  const SHIRT = { coloniale: [0xf2ede2, 0xe3c9a0, 0xb8d0d8, 0xd89a7a], alberi: [0x9a6a3a, 0xd8b27a, 0x5f7f3a], palafitte: [0x7a9a6a, 0xc9b07a, 0x6a8aa0], fattoria: [0xe8e0c8, 0xa83a2a, 0x6a7a9a], baite: [0x7a2a1e, 0x3a5a3a, 0x8a6a4a], pietra: [0x5a6a7a, 0x8a7a6a, 0x4a3a2e] };
  const PANTS = [0x4a3a2a, 0x3a3f4a, 0x6a5a40, 0x2e2a26];

  /* look: numero intero che decide in modo stabile pelle, capelli e vestiti
     opts: { style, pirate, captain, female, hat } */
  H.build = function (look, opts) {
    opts = opts || {};
    const rnd = G.mulberry32((look | 0) + 17);
    const MT = mats();
    const skin = hex(SKIN[(rnd() * SKIN.length) | 0]), hair = hex(HAIR[(rnd() * HAIR.length) | 0]);
    const pal = SHIRT[opts.style] || SHIRT.coloniale;
    let shirt = hex(pal[(rnd() * pal.length) | 0]), pants = hex(PANTS[(rnd() * PANTS.length) | 0]);
    const female = opts.female !== undefined ? opts.female : rnd() < 0.45;
    let vest = rnd() < 0.5 ? hex([0x5a3a22, 0x3a2a1e, 0x6a2a1e, 0x2a3a4a][(rnd() * 4) | 0]) : null;
    if (opts.pirate) { shirt = hex([0xe8e0d0, 0x8a1e1a, 0x2a2a3a, 0xc9b07a][(rnd() * 4) | 0]); vest = hex([0x2a1a12, 0x4a1a14, 0x1e2630][(rnd() * 3) | 0]); pants = hex([0x2e2a26, 0x4a3a2a, 0x3a2a3a][(rnd() * 3) | 0]); }
    if (opts.captain) { shirt = hex(0xf2ede2); vest = hex(0x5a1410); pants = hex(0x1e1a18); }
    const sc = (opts.captain ? 1.08 : 0.94 + rnd() * 0.12) * (female ? 0.95 : 1);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(sc);
    const add = (parent, geo, mat) => { const m = new THREE.Mesh(geo, mat || MT.body); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    // bacino e busto
    const pelvis = new THREE.Group(); pelvis.position.y = 0.95; body.add(pelvis);
    add(pelvis, M().merge([sph(0.17, 1.05, 0.7, 0.75, 0, 0, 0, pants), boxg(0.34, 0.05, 0.22, 0, 0.06, 0, opts.pirate ? hex(0x8a1e1a) : hex(0x3a2a1e))]), MT.cloth);
    const torso = new THREE.Group(); torso.position.y = 0.08; pelvis.add(torso);
    const tparts = [sph(0.19, 1.0, 1.45, 0.72, 0, 0.27, 0, shirt), sph(0.14, 1.3, 0.55, 0.85, 0, 0.47, 0, shirt)];
    if (female) tparts.push(sph(0.2, 1.15, 0.9, 0.85, 0, -0.08, 0, shirt)); // gonna corta sopra i pantaloni
    if (vest) tparts.push(sph(0.196, 1.02, 1.3, 0.74, 0, 0.25, 0.006, vest));
    add(torso, M().merge(tparts), MT.cloth);
    add(torso, limbGeo(0.055, 0.05, 0.08, skin)).position.y = 0.62; // collo
    // testa
    const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
    const hp = [sph(0.115, 0.92, 1.08, 1.0, 0, 0.11, 0, skin), sph(0.03, 0.8, 1, 1.2, 0, 0.1, 0.11, skin), sph(0.022, 1, 0.8, 0.6, 0.11, 0.1, 0, skin), sph(0.022, 1, 0.8, 0.6, -0.11, 0.1, 0, skin)];
    if (!opts.hat || female || rnd() < 0.6) hp.push(sph(0.122, 1.0, 0.85, 1.02, 0, 0.16, -0.012, hair));
    if (female) hp.push(sph(0.09, 1.1, 1.5, 0.6, 0, 0.02, -0.1, hair));
    if (!female && (opts.pirate || rnd() < 0.3)) hp.push(sph(0.085, 1.05, 0.8, 0.7, 0, 0.0, 0.06, opts.captain ? hex(0x1a1410) : hair));
    add(head, M().merge(hp));
    for (const x of [0.04, -0.04]) { const e = add(head, new THREE.SphereGeometry(0.014, 8, 6), MT.eye); e.position.set(x, 0.13, 0.1); }
    // cappelli
    const hat = opts.captain ? 'tricorno' : opts.pirate ? (rnd() < 0.5 ? 'bandana' : 'tricorno') : opts.hat || (opts.style === 'fattoria' || opts.style === 'coloniale' ? (rnd() < 0.5 ? 'paglia' : null) : opts.style === 'baite' || opts.style === 'pietra' ? (rnd() < 0.4 ? 'berretto' : null) : null);
    if (hat === 'tricorno') {
      const c = opts.captain ? hex(0x14100e) : hex(0x2a1e16);
      const brim = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 3); brim.rotateY(Math.PI / 6); brim.translate(0, 0.24, 0);
      add(head, M().merge([col(brim, c), sph(0.11, 1, 0.75, 1, 0, 0.27, 0, c)].concat(opts.captain ? [sph(0.03, 2.5, 0.4, 0.4, 0, 0.255, 0.16, hex(0xe2b43c))] : [])), MT.cloth);
    } else if (hat === 'bandana') add(head, M().merge([sph(0.126, 1, 0.75, 1.03, 0, 0.17, 0, hex(0x9a1e1a)), sph(0.04, 0.6, 1.4, 0.6, -0.02, 0.12, -0.13, hex(0x9a1e1a))]), MT.cloth);
    else if (hat === 'paglia') { const b = new THREE.CylinderGeometry(0.24, 0.25, 0.02, 20); b.translate(0, 0.22, 0); const t = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16); t.translate(0, 0.28, 0); add(head, M().merge([col(b, hex(0xd8c088)), col(t, hex(0xc9b070))]), MT.cloth); }
    else if (hat === 'berretto') add(head, M().merge([sph(0.13, 1, 0.6, 1, 0, 0.2, 0, hex(0x6a2a1e))]), MT.cloth);
    // braccia (spalla -> gomito -> mano)
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.235, 0.5, 0); torso.add(sh);
      add(sh, limbGeo(0.055, 0.047, 0.28, shirt), MT.cloth);
      const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
      add(el, limbGeo(0.046, 0.04, 0.25, opts.pirate || rnd() < 0.5 ? skin : shirt));
      const hand = new THREE.Group(); hand.position.y = -0.27; el.add(hand);
      add(hand, sph(0.045, 0.9, 1.1, 0.7, 0, -0.02, 0, skin));
      return { sh, el, hand };
    };
    const aL = arm(1), aR = arm(-1);
    // gambe (anca -> ginocchio -> piede)
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.02, 0); pelvis.add(hip);
      add(hip, limbGeo(0.075, 0.06, 0.44, pants), MT.cloth);
      const kn = new THREE.Group(); kn.position.y = -0.44; hip.add(kn);
      add(kn, limbGeo(0.06, 0.05, 0.42, opts.pirate || rnd() < 0.6 ? hex(0x2a1e16) : pants), MT.cloth);
      add(kn, boxg(0.1, 0.07, 0.22, 0, -0.45, 0.04, hex(0x2a1e16)));
      return { hip, kn };
    };
    const lL = leg(1), lR = leg(-1);
    // arma
    let weapon = null;
    if (opts.pirate || opts.captain) {
      weapon = G.Tools.build('sciabola'); weapon.scale.setScalar(1.25); weapon.rotation.set(-1.4, 0, 0); weapon.position.set(0, -0.03, 0.03); aR.hand.add(weapon);
    } else if (opts.tool) { weapon = G.Tools.build(opts.tool); if (weapon) { weapon.rotation.set(-1.2, 0, 0); aR.hand.add(weapon); } }
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { root, body, pelvis, torso, head, aL, aR, lL, lR, weapon, phase: rnd() * 6, female, height: 1.75 * sc };
  };

  /* animazione: speed (m/s), stato: 'idle' | 'talk' | 'attack' (k = 0..1 del colpo) | 'swim' */
  H.animate = function (p, dt, speed, state, k) {
    p.phase += dt * (speed > 0.1 ? 2.2 + speed * 1.6 : 1.4);
    const run = Math.min(1, speed / 3.5), walk = Math.min(1, speed / 1.2);
    const s = Math.sin(p.phase), c = Math.cos(p.phase);
    const amp = walk * (0.55 + run * 0.35);
    p.lL.hip.rotation.x = s * amp; p.lR.hip.rotation.x = -s * amp;
    p.lL.kn.rotation.x = Math.max(0, -c) * amp * 1.3; p.lR.kn.rotation.x = Math.max(0, c) * amp * 1.3;
    p.aL.sh.rotation.x = -s * amp * 0.8; p.aR.sh.rotation.x = s * amp * 0.8;
    p.aL.el.rotation.x = -0.25 - run * 0.7; p.aR.el.rotation.x = -0.25 - run * 0.7;
    p.aL.sh.rotation.z = 0.08; p.aR.sh.rotation.z = -0.08;
    p.pelvis.position.y = 0.95 + Math.abs(c) * 0.04 * walk - run * 0.05;
    p.torso.rotation.x = run * 0.22; p.torso.rotation.y = s * 0.08 * walk;
    const breath = Math.sin(performance.now() / 900 + p.phase) * 0.012;
    p.torso.scale.set(1, 1 + breath, 1);
    p.head.rotation.x = 0;
    if (state === 'talk') {
      const t = performance.now() / 1000;
      p.aR.sh.rotation.x = -0.6 + Math.sin(t * 3.1) * 0.25; p.aR.el.rotation.x = -0.9 + Math.sin(t * 4.3) * 0.3; p.aR.sh.rotation.z = -0.25;
      p.head.rotation.y = Math.sin(t * 1.3) * 0.15; p.head.rotation.x = Math.sin(t * 2.2) * 0.06;
    } else p.head.rotation.y *= 0.9;
    if (p.weapon && state !== 'attack' && speed < 0.2) { p.aR.sh.rotation.x = -0.35; p.aR.el.rotation.x = -0.6; }
    if (state === 'attack') {
      const a = Math.sin(Math.min(1, k) * Math.PI);
      p.aR.sh.rotation.x = -2.4 * a + 0.2 * (1 - a); p.aR.sh.rotation.z = -0.5 * a; p.aR.el.rotation.x = -0.4;
      p.torso.rotation.y = -0.5 * a;
    }
    if (state === 'swim') { p.body.rotation.x = -1.2; p.aL.sh.rotation.x = -2.5 + s; p.aR.sh.rotation.x = -2.5 - s; } else p.body.rotation.x *= 0.85;
  };
})();
