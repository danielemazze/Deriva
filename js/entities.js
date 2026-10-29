'use strict';
/* ==========================================================
   Fauna: animali di terra, tartarughe, pesci, gabbiani
   + particelle (schegge, schizzi, bolle, foglie che cadono)
   ========================================================== */
(function () {
  const G = globalThis.G;
  const E = (G.Entities = { list: [], schools: [] });
  const M = G.MODELS;
  const V3 = THREE.Vector3;

  /* ---------------- MODELLI ANIMALI ---------------- */
  const col = (g, c) => M.colorize(g, c[0], c[1], c[2]);
  function sph(r, sx, sy, sz, x, y, z, c, seg) { const g = new THREE.SphereGeometry(r, seg || 12, seg ? seg * 0.7 : 9); g.scale(sx, sy, sz); g.translate(x, y, z); return col(g, c); }
  function box(w, h, d, x, y, z, c) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return col(g, c); }
  function cyl(r0, r1, h, x, y, z, c, rx) { const g = new THREE.CylinderGeometry(r0, r1, h, 7); g.translate(0, -h / 2, 0); if (rx) g.rotateX(rx); g.translate(x, y, z); return col(g, c); }
  function cone(r, h, x, y, z, c, rx, rz) { const g = new THREE.ConeGeometry(r, h, 7); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return col(g, c); }
  // cubo "arrotondato": interpolazione tra cubo e sfera
  function rounded(w, h, d, seg, x, y, z) {
    const g = new THREE.SphereGeometry(1, seg * 4, seg * 3); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i), b = p.getY(i), c = p.getZ(i);
      const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) || 1;
      p.setXYZ(i, G.lerp(a, a / m, 0.55) * w / 2, G.lerp(b, b / m, 0.55) * h / 2, G.lerp(c, c / m, 0.55) * d / 2);
    }
    g.computeVertexNormals(); g.translate(x, y, z); return g;
  }

  const SPECIES = G.SPECIES;
  E.SPECIES = SPECIES;

  function buildAnimal(sp) {
    // modelli veri (animati) quando ci sono
    if (G.AnimLib && G.AnimLib.has(sp)) { const k = G.AnimLib.make(sp); return { root: k.root, body: k.inner, legs: [], head: new THREE.Group(), woolMesh: null, rig: k }; }
    const MAT = G.MAT, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const legs = [];
    const mkLeg = (geo, x, y, z, mat) => { const piv = new THREE.Group(); piv.position.set(x, y, z); const m = new THREE.Mesh(geo, mat || MAT.anim); m.castShadow = true; piv.add(m); body.add(piv); legs.push(piv); };
    const add = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat || MAT.anim); m.castShadow = shadow; m.receiveShadow = true; body.add(m); return m; };
    let head = new THREE.Group(); body.add(head);
    const addHead = (geo, mat) => { const m = new THREE.Mesh(geo, mat || MAT.anim); m.castShadow = true; head.add(m); return m; };
    let woolMesh = null;
    if (sp === 'gallina') {
      const W = [0.86, 0.84, 0.8], R = [0.8, 0.1, 0.08], Y = [0.9, 0.62, 0.16];
      add(M.merge([sph(0.17, 1, 0.95, 1.35, 0, 0.32, 0, W), cone(0.1, 0.22, 0, 0.45, -0.2, W, -0.9), sph(0.1, 0.5, 0.8, 1.1, 0.15, 0.32, 0, [0.9, 0.88, 0.84]), sph(0.1, 0.5, 0.8, 1.1, -0.15, 0.32, 0, [0.9, 0.88, 0.84])]));
      head.position.set(0, 0.46, 0.17);
      addHead(M.merge([sph(0.085, 1, 1.05, 1, 0, 0.04, 0.02, W), box(0.025, 0.07, 0.09, 0, 0.13, 0.02, R), cone(0.03, 0.07, 0, 0.03, 0.12, Y, Math.PI / 2), sph(0.025, 0.8, 1.4, 0.8, 0, -0.03, 0.08, R), sph(0.012, 1, 1, 1, 0.06, 0.06, 0.06, [0.05, 0.05, 0.05]), sph(0.012, 1, 1, 1, -0.06, 0.06, 0.06, [0.05, 0.05, 0.05])]));
      const leg = M.merge([cyl(0.018, 0.015, 0.2, 0, 0, 0, Y), box(0.08, 0.015, 0.09, 0, -0.2, 0.03, Y)]);
      mkLeg(leg, 0.07, 0.2, 0); mkLeg(leg, -0.07, 0.2, 0);
    } else if (sp === 'pecora') {
      const D = [0.18, 0.16, 0.15];
      const wg = new THREE.IcosahedronGeometry(0.45, 3); const p = wg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + Math.sin(x * 18) * Math.sin(y * 17) * Math.sin(z * 19) * 0.07; p.setXYZ(i, x * 0.85 * k, y * 0.72 * k, z * 1.25 * k); }
      wg.computeVertexNormals(); wg.translate(0, 0.68, 0);
      woolMesh = add(wg, MAT.wool);
      add(M.merge([sph(0.3, 0.9, 0.75, 1.3, 0, 0.66, 0, [0.85, 0.75, 0.7])]));
      head.position.set(0, 0.85, 0.5);
      addHead(M.merge([sph(0.14, 0.85, 0.9, 1.3, 0, 0, 0.08, D), sph(0.13, 1, 0.75, 0.9, 0, 0.1, -0.02, [0.95, 0.94, 0.9]), sph(0.06, 1.6, 0.5, 0.9, 0.16, 0.02, 0, D), sph(0.06, 1.6, 0.5, 0.9, -0.16, 0.02, 0, D), sph(0.018, 1, 1, 1, 0.08, 0.05, 0.18, [0.02, 0.02, 0.02]), sph(0.018, 1, 1, 1, -0.08, 0.05, 0.18, [0.02, 0.02, 0.02])]));
      const leg = cyl(0.05, 0.04, 0.48, 0, 0, 0, D);
      for (const [x, z] of [[0.18, 0.3], [-0.18, 0.3], [0.18, -0.3], [-0.18, -0.3]]) mkLeg(leg, x, 0.48, z);
    } else if (sp === 'mucca') {
      const bodyG = rounded(0.75, 0.75, 1.55, 6, 0, 1.05, 0);
      const m = add(bodyG, MAT.cow);
      head.position.set(0, 1.25, 0.85);
      const headG = rounded(0.36, 0.42, 0.52, 4, 0, 0, 0.12);
      const hm = new THREE.Mesh(headG, MAT.cow); hm.castShadow = true; head.add(hm);
      addHead(M.merge([box(0.3, 0.2, 0.12, 0, -0.12, 0.38, [0.9, 0.7, 0.68]), cone(0.04, 0.2, 0.2, 0.22, 0.02, [0.9, 0.86, 0.78], 0, -1.2), cone(0.04, 0.2, -0.2, 0.22, 0.02, [0.9, 0.86, 0.78], 0, 1.2),
        sph(0.07, 1.6, 0.6, 0.8, 0.24, 0.08, 0, [0.9, 0.88, 0.85]), sph(0.07, 1.6, 0.6, 0.8, -0.24, 0.08, 0, [0.9, 0.88, 0.85]), sph(0.025, 1, 1, 1, 0.13, 0.08, 0.3, [0.02, 0.02, 0.02]), sph(0.025, 1, 1, 1, -0.13, 0.08, 0.3, [0.02, 0.02, 0.02])]));
      add(M.merge([sph(0.15, 1, 0.7, 1, 0, 0.66, -0.25, [0.95, 0.72, 0.72]), cyl(0.025, 0.02, 0.6, 0, 1.3, -0.78, [0.15, 0.12, 0.1], 0.4)]));
      const leg = M.merge([cyl(0.08, 0.07, 0.62, 0, 0, 0, [0.92, 0.9, 0.86]), cyl(0.075, 0.08, 0.1, 0, -0.56, 0, [0.15, 0.12, 0.1])]);
      for (const [x, z] of [[0.24, 0.55], [-0.24, 0.55], [0.24, -0.55], [-0.24, -0.55]]) mkLeg(leg, x, 0.68, z);
    } else if (sp === 'maiale') {
      const P = [0.86, 0.56, 0.54];
      add(M.merge([sph(0.33, 0.95, 0.85, 1.45, 0, 0.55, 0, P), cyl(0.02, 0.01, 0.14, 0, 0.65, -0.5, P, 0.8)]));
      head.position.set(0, 0.62, 0.48);
      addHead(M.merge([sph(0.2, 1, 0.95, 1, 0, 0, 0.05, P), cyl(0.085, 0.085, 0.08, 0, 0, 0.27, [0.92, 0.55, 0.55], Math.PI / 2), cone(0.06, 0.12, 0.12, 0.17, 0.0, P, -0.4, -0.4), cone(0.06, 0.12, -0.12, 0.17, 0.0, P, -0.4, 0.4),
        sph(0.02, 1, 1, 1, 0.09, 0.06, 0.2, [0.03, 0.03, 0.03]), sph(0.02, 1, 1, 1, -0.09, 0.06, 0.2, [0.03, 0.03, 0.03])]));
      const leg = cyl(0.055, 0.05, 0.32, 0, 0, 0, P);
      for (const [x, z] of [[0.15, 0.28], [-0.15, 0.28], [0.15, -0.28], [-0.15, -0.28]]) mkLeg(leg, x, 0.32, z);
    } else if (sp === 'coniglio') {
      const B = [0.55, 0.42, 0.3], L = [0.85, 0.8, 0.72];
      add(M.merge([sph(0.12, 0.9, 0.85, 1.3, 0, 0.16, 0, B), sph(0.05, 1, 1, 1, 0, 0.2, -0.16, [0.95, 0.95, 0.95]), sph(0.06, 1.4, 0.7, 1.2, 0.08, 0.1, -0.06, B), sph(0.06, 1.4, 0.7, 1.2, -0.08, 0.1, -0.06, B)]));
      head.position.set(0, 0.26, 0.13);
      addHead(M.merge([sph(0.075, 1, 0.95, 1.15, 0, 0, 0.03, B), sph(0.03, 0.9, 3.2, 0.5, 0.035, 0.15, -0.01, B), sph(0.03, 0.9, 3.2, 0.5, -0.035, 0.15, -0.01, B), sph(0.02, 0.7, 2.6, 0.3, 0.035, 0.15, 0.005, [0.9, 0.7, 0.7]), sph(0.02, 0.7, 2.6, 0.3, -0.035, 0.15, 0.005, [0.9, 0.7, 0.7]),
        sph(0.013, 1, 1, 1, 0.045, 0.02, 0.08, [0.02, 0.02, 0.02]), sph(0.013, 1, 1, 1, -0.045, 0.02, 0.08, [0.02, 0.02, 0.02]), sph(0.012, 1, 1, 1, 0, -0.01, 0.11, [0.9, 0.6, 0.6])]));
      const leg = cyl(0.022, 0.02, 0.1, 0, 0, 0, L);
      mkLeg(leg, 0.05, 0.1, 0.08); mkLeg(leg, -0.05, 0.1, 0.08);
    } else if (sp === 'lupo' || sp === 'giaguaro') {
      const wolf = sp === 'lupo';
      const C1 = wolf ? [0.26, 0.24, 0.22] : [0.82, 0.6, 0.28], C2 = wolf ? [0.5, 0.47, 0.43] : [0.95, 0.85, 0.65];
      const bodyG = M.merge([sph(0.22, 1, 0.95, 2.2, 0, 0.62, 0, C1), sph(0.2, 0.95, 0.85, 1.0, 0, 0.58, 0.28, C2), cyl(0.05, 0.025, wolf ? 0.42 : 0.7, 0, 0.66, -0.45, C1, wolf ? 0.9 : 1.2)]);
      const bm = add(bodyG, wolf ? MAT.anim : MAT.anim);
      if (!wolf) { bm.material = G.MAT.jaguar || (G.MAT.jaguar = new THREE.MeshStandardMaterial({ map: G.TEX.hide(128, [214, 160, 74], [40, 28, 16], false).map, vertexColors: true, roughness: 0.8 })); }
      head.position.set(0, 0.74, 0.5);
      addHead(M.merge([sph(0.14, 0.95, 0.85, 1.05, 0, 0, 0, C1), sph(0.07, 0.85, 0.7, 1.6, 0, -0.04, 0.16, C2), sph(0.03, 1, 0.8, 1, 0, -0.01, 0.27, [0.05, 0.05, 0.05]),
        cone(0.045, wolf ? 0.14 : 0.07, 0.08, 0.13, -0.02, C1), cone(0.045, wolf ? 0.14 : 0.07, -0.08, 0.13, -0.02, C1), sph(0.016, 1, 1, 1, 0.06, 0.04, 0.12, [0.9, 0.75, 0.1]), sph(0.016, 1, 1, 1, -0.06, 0.04, 0.12, [0.9, 0.75, 0.1])]));
      const leg = cyl(0.045, 0.035, 0.5, 0, 0, 0, C1);
      for (const [x, z] of [[0.11, 0.3], [-0.11, 0.3], [0.11, -0.3], [-0.11, -0.3]]) mkLeg(leg, x, 0.5, z);
    } else if (sp === 'orso') {
      const C = [0.32, 0.22, 0.15];
      add(M.merge([sph(0.42, 1, 0.95, 1.55, 0, 0.95, 0, C), sph(0.36, 1, 0.9, 0.9, 0, 1.05, 0.38, C)]));
      head.position.set(0, 1.12, 0.78);
      addHead(M.merge([sph(0.2, 1, 0.9, 1.05, 0, 0, 0, C), sph(0.1, 0.9, 0.75, 1.1, 0, -0.06, 0.18, [0.45, 0.33, 0.24]), sph(0.04, 1, 0.8, 1, 0, -0.02, 0.29, [0.04, 0.04, 0.04]), sph(0.06, 1, 1, 0.5, 0.13, 0.15, -0.02, C), sph(0.06, 1, 1, 0.5, -0.13, 0.15, -0.02, C)]));
      const leg = cyl(0.12, 0.1, 0.72, 0, 0, 0, C);
      for (const [x, z] of [[0.24, 0.42], [-0.24, 0.42], [0.24, -0.42], [-0.24, -0.42]]) mkLeg(leg, x, 0.72, z);
    } else if (sp === 'serpente') {
      const C = [0.55, 0.48, 0.25];
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new V3(Math.sin(t * 9) * 0.12, 0.05, (0.5 - t) * 1.3)); }
      add(M.trunk(pts, 0.05, 0.01, 8, 2, C, 40), G.MAT.snake || (G.MAT.snake = new THREE.MeshStandardMaterial({ map: G.TEX.hide(64, [150, 130, 70], [60, 50, 20], false).map, vertexColors: true, roughness: 0.5 })));
      head.position.set(Math.sin(0) * 0.12, 0.07, 0.68);
      addHead(M.merge([sph(0.06, 1, 0.6, 1.4, 0, 0, 0, C), sph(0.01, 1, 1, 1, 0.03, 0.02, 0.05, [0.05, 0.05, 0.05]), sph(0.01, 1, 1, 1, -0.03, 0.02, 0.05, [0.05, 0.05, 0.05])]));
    } else if (sp === 'coccodrillo') {
      const C = [0.28, 0.34, 0.18], D = [0.6, 0.6, 0.42];
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new V3(0, 0.22, (0.6 - t) * 2.6)); }
      const g = M.trunk(pts, 0.28, 0.04, 12, 4, C, 30); const p2 = g.attributes.position; for (let i = 0; i < p2.count; i++) { p2.setY(i, 0.22 + (p2.getY(i) - 0.22) * 0.55); } g.computeVertexNormals();
      add(M.merge([g, sph(0.27, 1, 0.4, 1.6, 0, 0.14, 0.4, D)]));
      for (let i = 0; i < 9; i++) add(cone(0.04, 0.08, 0, 0.36, 1.2 - i * 0.28, [0.22, 0.28, 0.14]));
      head.position.set(0, 0.24, 1.6);
      addHead(M.merge([box(0.3, 0.14, 0.6, 0, 0, 0.25, C), box(0.26, 0.08, 0.55, 0, -0.08, 0.27, D), sph(0.04, 1, 1, 1, 0.1, 0.09, 0.02, [0.8, 0.7, 0.1]), sph(0.04, 1, 1, 1, -0.1, 0.09, 0.02, [0.8, 0.7, 0.1])]));
      const leg = cyl(0.06, 0.05, 0.22, 0, 0, 0, C);
      for (const [x, z] of [[0.3, 1.0], [-0.3, 1.0], [0.3, 0.1], [-0.3, 0.1]]) mkLeg(leg, x, 0.22, z);
    } else if (sp === 'squalo') {
      const C = [0.45, 0.5, 0.56], W = [0.88, 0.9, 0.9];
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new V3(0, 0, (0.5 - t) * 2.8)); }
      const g = M.trunk(pts, 0.36, 0.06, 14, 3, C, 30);
      const p2 = g.attributes.position, cA = g.attributes.color; for (let i = 0; i < p2.count; i++) { const z = p2.getZ(i); const k = 0.3 + 0.7 * Math.sin(Math.min(1, Math.max(0, (1.4 - z) / 2.8)) * Math.PI) ; p2.setX(i, p2.getX(i) * 0.75 * (0.5 + k * 0.6)); p2.setY(i, p2.getY(i) * (0.5 + k * 0.6)); if (p2.getY(i) < -0.05) cA.setXYZ(i, W[0], W[1], W[2]); }
      g.computeVertexNormals();
      const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.15, 0.3, 0, 0.75, -0.15, 0, 0.15, -0.35], 3)); fin.computeVertexNormals(); col(fin, C);
      const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.2, 0, 0.55, -1.65, 0, 0, -1.4, 0, 0, -1.2, 0, 0, -1.4, 0, -0.35, -1.6], 3)); tail.computeVertexNormals(); col(tail, C);
      const pec = new THREE.BufferGeometry(); pec.setAttribute('position', new THREE.Float32BufferAttribute([0.2, -0.12, 0.55, 0.75, -0.35, 0.1, 0.2, -0.12, 0.2, -0.2, -0.12, 0.55, -0.2, -0.12, 0.2, -0.75, -0.35, 0.1], 3)); pec.computeVertexNormals(); col(pec, C);
      const m = add(M.merge([g, fin, tail, pec]), G.MAT.shark || (G.MAT.shark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide })));
      head.position.set(0, 0, 1.3);
      addHead(M.merge([sph(0.03, 1, 1, 1, 0.22, 0.06, 0.05, [0.02, 0.02, 0.02]), sph(0.03, 1, 1, 1, -0.22, 0.06, 0.05, [0.02, 0.02, 0.02])]));
    } else if (sp === 'pirata' || sp === 'capitano') {
      const pp = G.People.build((Math.random() * 1e6) | 0, { pirate: true, captain: sp === 'capitano' });
      root.add(pp.root); root.userData.person = pp;
      return { root, body: pp.body, legs: [], head: pp.head, woolMesh: null, person: pp };
    } else if (sp === 'tartaruga') {
      const S = [0.48, 0.52, 0.32];
      const shell = new THREE.SphereGeometry(0.35, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1, 0.55, 1.25); shell.translate(0, 0.12, 0);
      add(shell, MAT.turtle);
      add(M.merge([sph(0.33, 1, 0.25, 1.2, 0, 0.12, 0, [0.85, 0.8, 0.6])]));
      head.position.set(0, 0.16, 0.44);
      addHead(M.merge([sph(0.08, 1, 0.85, 1.4, 0, 0, 0.04, S), sph(0.014, 1, 1, 1, 0.05, 0.03, 0.12, [0.02, 0.02, 0.02]), sph(0.014, 1, 1, 1, -0.05, 0.03, 0.12, [0.02, 0.02, 0.02])]));
      const fl = sph(0.09, 2.2, 0.3, 0.9, 0, 0, 0, S);
      for (const [x, z] of [[0.3, 0.25], [-0.3, 0.25], [0.24, -0.3], [-0.24, -0.3]]) { const g = fl.clone(); g.translate(x > 0 ? 0.12 : -0.12, 0, 0); mkLeg(g, x, 0.1, z); }
    }
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    return { root, body, legs, head, woolMesh };
  }

  /* ---------------- ANIMALI DI TERRA ---------------- */
  E.byId = new Map();
  E.spawnForChunk = function (ch) {
    // in multiplayer gli animali di terra arrivano dal server
    if (!(G.Net && G.Net.online)) for (const s of G.animalSpawns(ch.cx, ch.cz)) { if (!G.state.killed || !G.state.killed.has(s.id)) E.addAnimal(G.newAnimalState(s), ch); }
    const sea = G.seaSpawns(ch.cx, ch.cz, ch.minH);
    for (const sc of sea.schools) E.addSchool(sc, ch);
    for (const t of sea.turtles) E.addSeaTurtle(t, ch);
  };
  // st = stato condiviso (vedi shared.js)
  E.addAnimal = function (st, ch, remote) {
    const m = buildAnimal(st.sp);
    m.root.scale.setScalar(st.scale);
    m.root.position.set(st.x, G.World.groundAt(st.x, st.z), st.z);
    G.scene.add(m.root);
    const a = { kind: 'animal', id: st.id, st, sp: st.sp, def: SPECIES[st.sp], ...m, pos: m.root.position, scale: st.scale, phase: 0, chunk: ch, remote: !!remote, wool: st.wool,
      net: remote ? { x: st.x, z: st.z, yaw: st.yaw, speed: 0 } : null };
    if (ch) ch.entities.push(a);
    E.list.push(a); E.byId.set(a.id, a);
    return a;
  };
  E.removeAnimal = function (a) {
    G.scene.remove(a.root); a.dead = true;
    if (a.chunk) { const i = a.chunk.entities.indexOf(a); if (i >= 0) a.chunk.entities.splice(i, 1); }
    const j = E.list.indexOf(a); if (j >= 0) E.list.splice(j, 1);
    E.byId.delete(a.id);
  };
  E.despawnChunk = function (ch) {
    for (const a of ch.entities) { if (a.root) G.scene.remove(a.root); a.dead = true; if (a.id) E.byId.delete(a.id); }
    E.list = E.list.filter((a) => !a.dead);
    E.schools = E.schools.filter((s) => s.chunk !== ch);
    ch.entities.length = 0;
  };
  const W = () => G.World;
  const blocks = (x, y, z) => G.Build && G.Build.blocksPoint(x, y, z, 0.3);

  function updateAnimal(a, dt, player) {
    const st = a.st, def = a.def;
    const dP = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z);
    if (a.remote) {
      // interpolazione verso lo stato ricevuto dal server
      const n = a.net, k = Math.min(1, dt * 8);
      st.x += (n.x - st.x) * k; st.z += (n.z - st.z) * k;
      st.yaw += G.angleDiff(st.yaw, n.yaw) * k; st.speed += (n.speed - st.speed) * k;
      st.hurt = Math.max(0, st.hurt - dt); st.atkT = Math.max(0, (st.atkT || 0) - dt);
    } else {
      const P = G.Player;
      const atk = G.animalStep(st, dt, blocks, [{ id: 'local', x: P.pos.x, y: P.pos.y, z: P.pos.z, sw: P.swim || P.under, cr: G.creative() || P.health <= 0 }]);
      if (atk) E.onAttack(a, atk);
      if (st.sp === 'gallina') { st.eggTimer -= dt; if (st.eggTimer <= 0 && dP < 30) { st.eggTimer = 120 + Math.random() * 180; G.Build.dropPickup('uovo', st.x, W().groundAt(st.x, st.z) + 0.05, st.z); } }
    }
    a.wool = st.wool;
    if (a.woolMesh) a.woolMesh.visible = st.wool;
    let gh = W().groundAt(st.x, st.z);
    if (def.sea) gh = Math.max(gh + 0.8, G.waveHeight(st.x, st.z, G.clock) - 1.4 + Math.sin(performance.now() / 1300 + a.scale * 9) * 0.25);
    if (a.person) {
      const pp = a.person, atkK = st.atkT > 0 ? 1 - st.atkT / 0.45 : 0;
      G.People.animate(pp, dt, st.speed, st.atkT > 0 ? 'attack' : 'idle', atkK);
      a.pos.set(st.x, gh + (st.hurt > 0 ? Math.sin(st.hurt * 40) * 0.02 : 0), st.z);
      a.root.rotation.y = st.yaw;
      if (dP < 22 && Math.random() < dt * 0.05 && G.Audio && G.Audio.grunt) G.Audio.grunt(dP, a.pos);
      // il fendente di spada: grido d'attacco quando parte il colpo
      if (st.atkT > 0 && !a._atkS) { a._atkS = true; if (G.Audio && G.Audio.pirateAttack && dP < 40) G.Audio.pirateAttack(a.pos); } else if (!(st.atkT > 0)) a._atkS = false;
      return;
    }
    if (st.scale !== a.scale) { a.scale = st.scale; a.root.scale.setScalar(st.scale); }
    if (a.rig) {
      // animazioni vere: fermo, passo, corsa
      const rg = a.rig, sp = st.speed;
      rg.act(sp < 0.12 ? 'Idle' : sp > 2.2 && rg.acts.Run ? 'Run' : sp > 0.9 || !rg.acts.WalkSlow ? 'Walk' : 'WalkSlow');
      const cur = sp < 0.12 ? 1 : sp > 2.2 ? sp / 3.2 : sp / (sp > 0.9 ? 1.3 : 0.8);
      rg.mixer.timeScale = G.clamp(cur, 0.5, 1.8);
      if (dP < 90) rg.mixer.update(dt);
      a.pos.set(st.x, gh + (st.hurt > 0 ? Math.sin(st.hurt * 40) * 0.02 : 0), st.z);
      a.root.rotation.y = st.yaw;
      const n = G.normalAt(st.x, st.z);
      rg.inner.rotation.x = G.lerp(rg.inner.rotation.x, -Math.atan2(n[2] * Math.cos(st.yaw) + n[0] * Math.sin(st.yaw), n[1]) * 0.8, 0.1);
      if (dP < 40 && Math.random() < dt * 0.05 && G.Audio) G.Audio.animal(a.sp, dP, a.pos, st.age !== undefined && st.age < 1);
      return;
    }
    a.phase += st.speed * dt * (def.hop ? 9 : 7) / Math.max(a.scale, 0.5);
    const bob = def.hop ? Math.abs(Math.sin(a.phase)) * 0.12 * Math.min(st.speed, 1) : 0;
    a.pos.set(st.x, gh + bob + (st.hurt > 0 ? Math.sin(st.hurt * 40) * 0.02 : 0), st.z);
    a.root.rotation.y = st.yaw;
    if (def.sea) { a.body.rotation.z = Math.sin(a.phase * 0.5) * 0.08; a.body.rotation.y = Math.sin(a.phase * 0.7) * 0.12; a.legs.forEach(() => {}); return; }
    if (def.hostile && st.atkT > 0) a.head.position.z += 0; // morso: vedi sotto
    const n = G.normalAt(st.x, st.z);
    a.body.rotation.x = G.lerp(a.body.rotation.x, -Math.atan2(n[2] * Math.cos(st.yaw) + n[0] * Math.sin(st.yaw), n[1]) * 0.8, 0.1);
    const sw = Math.sin(a.phase) * Math.min(st.speed * 0.5, 0.6);
    a.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw) * (def.hop ? 0.4 : 1); if (a.sp === 'tartaruga') { l.rotation.y = sw * (i % 2 ? 1 : -1); l.rotation.x = 0; } });
    if (def.hostile && st.atkT > 0) { a.body.position.z = Math.sin((1 - st.atkT / 0.45) * Math.PI) * 0.35; a.head.rotation.x = -0.4; }
    else a.body.position.z *= 0.8;
    if (st.speed < 0.15 && !def.hostile) { const t = performance.now() / 1000 + a.scale * 10; const graze = Math.max(0, Math.sin(t * (a.sp === 'gallina' ? 3 : 0.5))); a.head.rotation.x = graze * (a.sp === 'gallina' ? 0.9 : 0.6); }
    else a.head.rotation.x *= 0.9;
    if (dP < 40 && Math.random() < dt * (def.hostile ? 0.07 : 0.05) && G.Audio) G.Audio.animal(a.sp, dP, a.pos, st.age !== undefined && st.age < 1);
  }
  // un predatore o un pirata ti colpisce (in giocatore singolo; in multigiocatore arriva dal server come 'hurt')
  E.onAttack = function (a, atk) {
    const P = G.Player;
    P.hurt(atk.dmg);
    P.vel.x += atk.dx * 4; P.vel.z += atk.dz * 4; P.vel.y = Math.max(P.vel.y, 2.5);
    if (G.Audio) G.Audio.hit('soft');
    if (!E._hurtMsg || performance.now() - E._hurtMsg > 6000) { E._hurtMsg = performance.now(); G.UI.toast(`${a.def.n}: ti attacca!`, 'warn'); }
  };
  E.killFx = function (a) { G.FX.burst(a.pos.x, a.pos.y + 0.3, a.pos.z, [1, 1, 1], 18, 3); };
  /* ---------- colpo visibile: lampo rosso, sangue, numero del danno, segno sul mirino ---------- */
  const redMats = new Map();
  function redOf(m) {
    let r = redMats.get(m); if (r) return r;
    r = m.clone(); if (r.color) r.color.setRGB(1, 0.25, 0.2); if ('emissive' in r) { r.emissive = new THREE.Color(0.9, 0.08, 0.04); r.emissiveIntensity = 1; }
    if (r.map) r.map = m.map; redMats.set(m, r); return r;
  }
  E.flashes = [];
  E.hitFx = function (a, dmg, killed) {
    const y = a.pos.y + (a.def.size || 1) * 0.55;
    G.FX.burst(a.pos.x, y, a.pos.z, [0.55, 0.04, 0.03], killed ? 22 : 12, 2.4, { size: 0.9 });
    // lampo rosso su tutto il corpo
    const meshes = []; a.root.traverse((o) => { if (o.isMesh && !o.isSprite && o.material && !Array.isArray(o.material)) meshes.push(o); });
    for (const o of meshes) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = redOf(o.userData.mat0); }
    E.flashes.push({ meshes, t: 0.16 });
    // sobbalzo
    a.st.hurt = Math.max(a.st.hurt || 0, 0.35);
    G.UI.damageNumber(a.pos.x, y + 0.6, a.pos.z, dmg, killed);
    G.UI.hitMarker(killed);
  };
  function updateFlashes(dt) {
    for (let i = E.flashes.length - 1; i >= 0; i--) {
      const f = E.flashes[i]; f.t -= dt;
      if (f.t <= 0) { for (const o of f.meshes) if (o.userData.mat0) { o.material = o.userData.mat0; o.userData.mat0 = null; } E.flashes.splice(i, 1); }
    }
  }
  E.hit = function (a, dmg, player) {
    const p = G.Player.pos;
    if (a.def.peaceful) { a.st.flee = 1; G.UI.toast('La tartaruga si ritira nel guscio'); return; }
    if (G.Audio) { G.Audio.hit('soft'); if (G.Audio.animalHurt) G.Audio.animalHurt(a.sp, a.pos); }
    const willDie = !a.remote && a.st.hp !== undefined && a.st.hp - dmg <= 0;
    E.hitFx(a, Math.round(dmg * 10) / 10, willDie);
    if (a.remote) { a.st.hurt = 0.35; G.Net.send({ t: 'ahit', id: a.id, dmg }); return; }
    const r = G.animalHit(a.st, dmg, p.x, p.z, 'local');
    if (r.dead) {
      G.Player._popPos = { x: a.pos.x, y: a.pos.y + 0.3, z: a.pos.z }; for (const [id, n] of r.drops) G.Player.give(id, n); G.Player._popPos = null;
      E.killFx(a); E.removeAnimal(a);
      (G.state.killed = G.state.killed || new Set()).add(a.id);
      E.onKill(a.sp);
    }
  };
  // conteggio delle uccisioni (missioni e diario)
  E.onKill = function (sp) {
    const P = G.Player; P.kills = P.kills || {}; P.kills[sp] = (P.kills[sp] || 0) + 1;
    if (G.Quests) G.Quests.onKill(sp);
  };
  E.shear = function (a) {
    if (!a.def.shear) return false;
    if (!a.st.wool) { G.UI.toast('La lana deve ricrescere'); return true; }
    G.FX.burst(a.pos.x, a.pos.y + 0.7, a.pos.z, [1, 1, 0.96], 14, 2);
    if (a.remote) { G.Net.send({ t: 'shear', id: a.id }); return true; }
    const n = G.animalShear(a.st); if (n) { G.Player.give('lana', n + (G.Skills.chance('allevatore', 0.02) ? 1 : 0)); G.Skills.add('allevatore', 4); }
    return true;
  };
  E.raycast = function (o, d, maxDist, pad) {
    let best = null, bt = maxDist;
    for (const a of E.list) {
      if (a.kind !== 'animal') continue;
      const r = (a.person ? 0.42 : a.def.size * 0.55) * a.scale + (pad || 0);
      const cx = a.pos.x, cy = a.pos.y + (a.person ? 1.0 : a.def.size * 0.45 * a.scale), cz = a.pos.z;
      const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
      const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
      const disc = b * b - c; if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bt) { bt = t; best = a; }
    }
    return best ? { ent: best, t: bt } : null;
  };

  /* ---------------- TARTARUGHE MARINE (posizione = funzione del tempo) ---------------- */
  E.addSeaTurtle = function (p, ch) {
    const m = buildAnimal('tartaruga');
    m.root.scale.setScalar(1.6);
    G.scene.add(m.root);
    const t = { kind: 'seaturtle', ...m, cx: p.x, cz: p.z, floor: p.h, r: p.r, ang0: p.ang0, dir: p.dir, chunk: ch };
    ch.entities.push(t); E.list.push(t);
    return t;
  };
  function updateSeaTurtle(t, dt, clock) {
    const ang = t.ang0 + clock * 0.07 * t.dir, ph = clock * 2.2;
    const x = t.cx + Math.cos(ang) * t.r, z = t.cz + Math.sin(ang) * t.r;
    const fl = G.heightAt(x, z);
    const y = Math.min(-1.2, Math.max(fl + 1.2, (fl - 1) * 0.5 + Math.sin(ph * 0.2) * 1.2));
    t.root.position.set(x, y, z);
    t.root.rotation.y = -ang + (t.dir > 0 ? Math.PI : 0);
    t.legs.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i < 2 ? 0 : 1.5)) * 0.5 * (i % 2 ? 1 : -1); });
  }

  /* ---------------- PESCI ---------------- */
  const FISH_TYPES = [
    { c1: [1.0, 0.45, 0.08], c2: [1, 1, 1], stripes: true, len: 0.22 },
    { c1: [0.98, 0.85, 0.15], c2: [0.15, 0.35, 0.9], stripes: false, len: 0.26 },
    { c1: [0.2, 0.55, 0.95], c2: [0.95, 0.9, 0.2], stripes: false, len: 0.3 },
    { c1: [0.7, 0.75, 0.8], c2: [0.35, 0.45, 0.55], stripes: false, len: 0.38 },
    { c1: [0.9, 0.3, 0.55], c2: [0.95, 0.75, 0.3], stripes: true, len: 0.24 },
  ];
  function fishGeo(t) {
    const L = t.len, g = new THREE.SphereGeometry(1, 12, 8);
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const taper = z < 0 ? 1 + z * 0.75 : 1 - z * 0.25;
      const cc = (t.stripes && (Math.abs(Math.sin(z * 7.5)) < 0.25)) ? t.c2 : (y < -0.2 ? [0.95, 0.95, 0.92] : t.c1);
      const mixT = t.stripes ? 0 : G.smooth(-0.6, 0.6, z) * 0.6;
      c[i * 3] = G.lerp(cc[0], t.c2[0], mixT); c[i * 3 + 1] = G.lerp(cc[1], t.c2[1], mixT); c[i * 3 + 2] = G.lerp(cc[2], t.c2[2], mixT);
      p.setXYZ(i, x * 0.28 * taper * L, y * 0.42 * taper * L * (t.len > 0.3 ? 0.7 : 1), z * L);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -L * 0.9, 0, L * 0.35, -L * 1.4, 0, -L * 0.35, -L * 1.4], 3));
    tail.setAttribute('color', new THREE.Float32BufferAttribute([...t.c1, ...t.c1, ...t.c1], 3));
    tail.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    tail.computeVertexNormals();
    const dorsal = new THREE.BufferGeometry();
    dorsal.setAttribute('position', new THREE.Float32BufferAttribute([0, L * 0.38, L * 0.35, 0, L * 0.55, -L * 0.05, 0, L * 0.3, -L * 0.45], 3));
    dorsal.setAttribute('color', new THREE.Float32BufferAttribute([...t.c2, ...t.c2, ...t.c2], 3));
    dorsal.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    dorsal.computeVertexNormals();
    return M.merge([g, tail, dorsal]);
  }
  E.initFish = function () {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = G.shared.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float fw = sin(uTime*11.0 + float(gl_InstanceID)*1.37 - position.z*14.0);
        transformed.x += fw * 0.6 * max(0.0, -position.z) * 0.8;`);
    };
    E.fishMeshes = FISH_TYPES.map((t) => {
      const im = new THREE.InstancedMesh(fishGeo(t), mat, 500);
      im.count = 0; im.frustumCulled = false; im.castShadow = false;
      G.scene.add(im); return im;
    });
  };
  E.addSchool = function (p, ch) {
    const rnd = G.mulberry32(p.seed);
    const fish = [];
    for (let i = 0; i < p.count; i++) fish.push({ off: new V3((rnd() - 0.5) * 3, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 3), ph: rnd() * 6.28, p: new V3(p.x, p.h + 2, p.z), yaw: 0 });
    const s = { type: p.type, fish, c: new V3(p.x, Math.max(p.h + 1.5, p.h * 0.5), p.z), home: new V3(p.x, 0, p.z), ang0: p.ang0, r: p.r, sp: p.sp, dir: p.dir, chunk: ch, scare: 0 };
    E.schools.push(s);
    return s;
  };
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _one = new V3(1, 1, 1);
  const _fPrev = new V3(), _fV = new V3(), _fWob = new V3(), _fT = new V3(), _fA = new V3(), _fD = new V3();
  function updateFish(dt, player, t) {
    const counts = E.fishMeshes.map(() => 0);
    for (const s of E.schools) {
      const dpx = s.c.x - player.pos.x, dpz = s.c.z - player.pos.z;
      const fr = player.under || player.swim ? 120 : 50; // dalla superficie i pesci lontani non si vedono
      if (dpx * dpx + dpz * dpz > fr * fr) continue;
      const ang = s.ang0 + G.clock * s.sp * s.dir;
      const tx = s.home.x + Math.cos(ang) * s.r, tz = s.home.z + Math.sin(ang) * s.r;
      const fl = G.heightAt(tx, tz);
      const ty = Math.min(-0.9, Math.max(fl + 0.9, fl * 0.55 + Math.sin(t * 0.3 + s.r) * 0.8));
      const prev = _fPrev.copy(s.c);
      s.c.x += (tx - s.c.x) * Math.min(1, dt * 0.8); s.c.z += (tz - s.c.z) * Math.min(1, dt * 0.8); s.c.y += (ty - s.c.y) * Math.min(1, dt * 0.5);
      const v = _fV.copy(s.c).sub(prev);
      const pd = Math.hypot(player.pos.x - s.c.x, player.eye.y - s.c.y, player.pos.z - s.c.z);
      s.scare = G.lerp(s.scare, pd < 4 ? 1 : 0, dt * 2);
      const im = E.fishMeshes[s.type];
      for (const f of s.fish) {
        const wob = _fWob.set(Math.sin(t * 0.7 + f.ph) * 0.6, Math.sin(t * 0.9 + f.ph * 2) * 0.25, Math.cos(t * 0.6 + f.ph) * 0.6);
        const target = _fT.copy(s.c).add(f.off).add(wob);
        if (s.scare > 0.1) { const away = _fA.set(target.x - player.pos.x, 0, target.z - player.pos.z).normalize().multiplyScalar(s.scare * 2.5); target.add(away); }
        const fd = _fD.copy(target).sub(f.p);
        f.p.add(fd.multiplyScalar(Math.min(1, dt * (1.5 + s.scare * 3))));
        const mv = fd.lengthSq() > 1e-6 ? fd : v;
        const ty2 = Math.atan2(mv.x, mv.z);
        f.yaw += G.angleDiff(f.yaw, ty2) * Math.min(1, dt * 5);
        _eu.set(0, f.yaw, 0);
        _q.setFromEuler(_eu);
        _m4.compose(f.p, _q, _one);
        const i = counts[s.type]++;
        if (i < 500) _m4.toArray(im.instanceMatrix.array, i * 16);
      }
    }
    E.fishMeshes.forEach((im, k) => { im.count = Math.min(500, counts[k]); im.instanceMatrix.needsUpdate = true; });
  }

  /* ---------------- GABBIANI ---------------- */
  E.initBirds = function () {
    E.birds = [];
    const bodyG = M.merge([sph(0.09, 1, 0.9, 2.4, 0, 0, 0, [0.95, 0.95, 0.95]), cone(0.025, 0.08, 0, -0.01, 0.25, [0.95, 0.75, 0.2], Math.PI / 2), sph(0.06, 1, 1, 1.1, 0, 0.05, 0.17, [0.97, 0.97, 0.97])]);
    const wingG = new THREE.BufferGeometry();
    wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.08, 0, 0, -0.1, 0.55, 0.02, -0.12, 0.55, 0.02, -0.12, 0.75, 0, -0.2, 0, 0, 0.08], 3));
    wingG.setAttribute('color', new THREE.Float32BufferAttribute([0.85, 0.87, 0.9, 0.85, 0.87, 0.9, 0.6, 0.62, 0.66, 0.6, 0.62, 0.66, 0.15, 0.15, 0.15, 0.85, 0.87, 0.9], 3));
    wingG.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
    wingG.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyG, mat));
      const wl = new THREE.Mesh(wingG, mat), wr = new THREE.Mesh(wingG, mat); wr.scale.x = -1;
      g.add(wl, wr); g.scale.setScalar(1.4);
      G.scene.add(g);
      E.birds.push({ g, wl, wr, ang: Math.random() * 6.28, r: 15 + Math.random() * 25, h: 14 + Math.random() * 14, sp: 0.15 + Math.random() * 0.12, ph: Math.random() * 6, cx: 0, cz: 0 });
    }
  };
  function updateBirds(dt, player, t) {
    const night = G.sky.night > 0.6;
    for (const b of E.birds) {
      b.g.visible = !night;
      if (!b.home || Math.hypot(b.cx - player.pos.x, b.cz - player.pos.z) > 90) { b.cx = player.pos.x + (Math.random() - 0.5) * 60; b.cz = player.pos.z + (Math.random() - 0.5) * 60; b.home = true; }
      b.ang += dt * b.sp;
      const x = b.cx + Math.cos(b.ang) * b.r, z = b.cz + Math.sin(b.ang) * b.r;
      const y = Math.max(G.heightAt(x, z), 0) + b.h + Math.sin(t * 0.4 + b.ph) * 2;
      b.g.position.set(x, y, z);
      b.g.rotation.set(0, -b.ang, -0.25);
      const flap = Math.sin(t * 6 + b.ph) > 0.3 ? Math.sin(t * 10 + b.ph) * 0.6 : 0.12;
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
    }
  }

  E.update = function (dt, player, t) {
    // gli animali lontani si aggiornano meno spesso (a scatti invisibili da lontano)
    E._fr = (E._fr || 0) + 1;
    G.petCtx = G.Pets && !(G.Net && G.Net.on) ? G.Pets.ctx() : null;
    const vis = G.lowQ && G.lowQ() ? 75 : 150;
    for (const a of E.list) {
      if (a.kind === 'animal') {
        const d = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z);
        a.root.visible = d < vis;
        const wantSh = d < 26;
        if (a._sh !== wantSh) { a._sh = wantSh; a.root.traverse((o) => { if (o.isMesh) o.castShadow = wantSh; }); }
        if (d < 45) { updateAnimal(a, dt + (a._acc || 0), player); a._acc = 0; }
        else if (d < 120) { a._acc = (a._acc || 0) + dt; if (((E._fr + (a.id ? a.id.length : 0)) % 3 === 0) || a._acc > 0.2) { updateAnimal(a, Math.min(0.15, a._acc), player); a._acc = 0; } }
      } else if (a.kind === 'seaturtle') updateSeaTurtle(a, dt, G.clock);
    }
    updateFish(dt, player, t);
    updateBirds(dt, player, t);
    updateFlashes(dt);
  };

  /* ==========================================================
     PARTICELLE
     ========================================================== */
  const FX = (G.FX = {});
  FX.init = function () {
    const N = 600;
    const g = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    FX.mesh = new THREE.InstancedMesh(g, mat, N); FX.mesh.frustumCulled = false; FX.mesh.count = 0;
    FX.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    G.scene.add(FX.mesh);
    FX.parts = [];
    // foglie che cadono
    const lg = new THREE.PlaneGeometry(0.14, 0.1);
    const lmat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
    FX.leafMesh = new THREE.InstancedMesh(lg, lmat, 260); FX.leafMesh.frustumCulled = false; FX.leafMesh.count = 0;
    FX.leafMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3), 3);
    G.scene.add(FX.leafMesh);
    FX.leaves = [];
    // bolle
    const bmat = new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.CustomBlending, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    FX.bubbleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), bmat, 200); FX.bubbleMesh.frustumCulled = false; FX.bubbleMesh.count = 0;
    G.scene.add(FX.bubbleMesh);
    FX.bubbles = [];
  };
  FX.burst = function (x, y, z, c, n, sp, opts) {
    for (let i = 0; i < n; i++) {
      if (FX.parts.length > 590) FX.parts.shift();
      const v = new V3((Math.random() - 0.5) * sp, Math.random() * sp * 0.9 + 0.5, (Math.random() - 0.5) * sp);
      const j = 0.8 + Math.random() * 0.4;
      FX.parts.push({ p: new V3(x, y, z), v, life: 0.6 + Math.random() * 0.6, max: 1.2, c: [c[0] * j, c[1] * j, c[2] * j], s: (opts && opts.size || 1) * (0.6 + Math.random() * 0.8), g: opts && opts.g !== undefined ? opts.g : 9.8, rot: Math.random() * 6 });
    }
  };
  FX.splash = function (x, y, z, n) { FX.burst(x, y, z, [0.85, 0.95, 1], n || 14, 3, { size: 1.2 }); };
  FX.bubble = function (x, y, z) { if (FX.bubbles.length < 200) FX.bubbles.push({ p: new V3(x, y, z), life: 4, s: 0.5 + Math.random() * 1.2, ph: Math.random() * 6 }); };
  const _mm = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _ee = new THREE.Euler(), _ss = new V3();
  FX.update = function (dt, player, t) {
    let i = 0; const arr = FX.mesh.instanceMatrix.array, carr = FX.mesh.instanceColor.array;
    for (let k = FX.parts.length - 1; k >= 0; k--) {
      const p = FX.parts[k];
      p.life -= dt; if (p.life <= 0) { FX.parts.splice(k, 1); continue; }
      p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.rot += dt * 5;
      const gh = G.heightAt(p.p.x, p.p.z);
      if (p.p.y < gh) { p.p.y = gh; p.v.multiplyScalar(0.3); }
      const s = p.s * Math.min(1, p.life * 3);
      _mm.compose(p.p, _qq.setFromEuler(_ee.set(p.rot, p.rot * 0.7, 0)), _ss.set(s, s, s));
      _mm.toArray(arr, i * 16); carr[i * 3] = p.c[0]; carr[i * 3 + 1] = p.c[1]; carr[i * 3 + 2] = p.c[2];
      i++;
    }
    FX.mesh.count = i; FX.mesh.instanceMatrix.needsUpdate = true; FX.mesh.instanceColor.needsUpdate = true;

    // foglie: nascono dalle chiome vicine
    if (W().settings.fx && FX.leaves.length < 250 && Math.random() < dt * 14) {
      const trees = [];
      W().nearby(player.pos.x, player.pos.z, 30, (r) => { if (r.type === 'tree' && r.sub !== 'pine') trees.push(r); });
      if (trees.length) {
        const tr = trees[(Math.random() * trees.length) | 0];
        const autumn = Math.random();
        const c = tr.sub === 'palm' ? [0.55, 0.6, 0.25] : autumn < 0.5 ? [0.35, 0.5, 0.15] : autumn < 0.8 ? [0.75, 0.6, 0.15] : [0.7, 0.3, 0.1];
        FX.leaves.push({ p: new V3(tr.x + (Math.random() - 0.5) * 4, tr.y + tr.height * (0.6 + Math.random() * 0.3), tr.z + (Math.random() - 0.5) * 4), life: 12, ph: Math.random() * 6, c, rest: 0 });
      }
    }
    i = 0; const la = FX.leafMesh.instanceMatrix.array, lc = FX.leafMesh.instanceColor.array;
    const wind = G.shared.uWind.value;
    for (let k = FX.leaves.length - 1; k >= 0; k--) {
      const l = FX.leaves[k];
      l.life -= dt; if (l.life <= 0) { FX.leaves.splice(k, 1); continue; }
      const gh = G.heightAt(l.p.x, l.p.z);
      if (l.p.y > Math.max(gh, 0) + 0.03) {
        l.p.y -= dt * (0.6 + Math.sin(t * 2 + l.ph) * 0.25);
        l.p.x += dt * (Math.sin(t * 1.3 + l.ph) * 0.8 + 0.6 * wind); l.p.z += dt * (Math.cos(t * 1.1 + l.ph) * 0.6 + 0.3 * wind);
      } else l.life = Math.min(l.life, 3);
      const s = Math.min(1, l.life);
      _mm.compose(l.p, _qq.setFromEuler(_ee.set(Math.sin(t * 3 + l.ph) * 1.2, t * 1.5 + l.ph, Math.cos(t * 2.4 + l.ph))), _ss.set(s, s, s));
      _mm.toArray(la, i * 16); lc[i * 3] = l.c[0]; lc[i * 3 + 1] = l.c[1]; lc[i * 3 + 2] = l.c[2]; i++;
    }
    FX.leafMesh.count = i; FX.leafMesh.instanceMatrix.needsUpdate = true; FX.leafMesh.instanceColor.needsUpdate = true;

    // bolle
    i = 0; const ba = FX.bubbleMesh.instanceMatrix.array;
    for (let k = FX.bubbles.length - 1; k >= 0; k--) {
      const b = FX.bubbles[k];
      b.life -= dt; b.p.y += dt * (0.9 + b.s * 0.3); b.p.x += Math.sin(t * 5 + b.ph) * dt * 0.2;
      if (b.life <= 0 || b.p.y > G.waveHeight(b.p.x, b.p.z, t)) { FX.bubbles.splice(k, 1); continue; }
      _mm.compose(b.p, _qq.identity(), _ss.set(b.s, b.s, b.s)); _mm.toArray(ba, i * 16); i++;
    }
    FX.bubbleMesh.count = i; FX.bubbleMesh.instanceMatrix.needsUpdate = true;
  };
})();
