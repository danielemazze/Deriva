'use strict';
/* ==========================================================
   Attrezzi dettagliati (vista in prima persona e in mano
   agli altri giocatori): ascia, piccone, coltello, canna da
   pesca, torcia, libro, ciotola
   ========================================================== */
(function () {
  const G = globalThis.G;
  const T = (G.Tools = {});
  const V3 = THREE.Vector3;
  let MATS = null;

  function mats() {
    if (MATS) return MATS;
    const TX = G.TEX;
    const rep = (t, x, y) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); return c; };
    MATS = {
      wood: new THREE.MeshStandardMaterial({ map: rep(TX.woodGrainT.map, 1, 3), normalMap: rep(TX.woodGrainT.normal, 1, 3), roughness: 0.62, color: 0xd8c2a4 }),
      woodDark: new THREE.MeshStandardMaterial({ map: rep(TX.woodGrainT.map, 1, 2), normalMap: rep(TX.woodGrainT.normal, 1, 2), roughness: 0.7, color: 0x8a6a4a }),
      flint: new THREE.MeshStandardMaterial({ map: rep(TX.flintT.map, 0.6, 0.6), normalMap: rep(TX.flintT.normal, 0.6, 0.6), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.38, metalness: 0.02, color: 0xd6cfc4 }),
      stone: new THREE.MeshStandardMaterial({ map: rep(TX.rockT.map, 0.8, 0.8), normalMap: rep(TX.rockT.normal, 0.8, 0.8), normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.8, color: 0xf0ebe2 }),
      rope: new THREE.MeshStandardMaterial({ map: rep(TX.ropeT.map, 6, 1), normalMap: rep(TX.ropeT.normal, 6, 1), normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.95 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x5a3720, roughness: 0.55, normalMap: rep(TX.woolT.normal, 3, 3), normalScale: new THREE.Vector2(0.3, 0.3) }),
      cloth: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1, normalMap: rep(TX.clothT.normal, 3, 3), normalScale: new THREE.Vector2(1.5, 1.5) }),
      cork: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9, normalMap: rep(TX.sandT.normal, 2, 4) }),
      paper: new THREE.MeshStandardMaterial({ color: 0xe9dcbc, roughness: 0.9 }),
      cover: new THREE.MeshStandardMaterial({ color: 0x5e2617, roughness: 0.5, normalMap: rep(TX.woolT.normal, 2, 2), normalScale: new THREE.Vector2(0.25, 0.25) }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc9a25e, roughness: 0.35, metalness: 0.85 }),
      line: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 }),
    };
    return MATS;
  }

  /* manico rastremato e leggermente curvo */
  function handle(len, r0, r1, bend) {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new V3(Math.sin(t * Math.PI) * (bend || 0), t * len - 0.06, 0)); }
    const geo = G.MODELS.trunk(pts, r0, r1, 14, 1, null, 24);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mats().wood);
  }
  /* legatura: corda avvolta a elica */
  function lashing(rIn, h, turns, y, opts) {
    const pts = [];
    const n = turns * 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * Math.PI * 2;
      const r = rIn + (opts && opts.bulge ? Math.sin(t * Math.PI) * opts.bulge : 0);
      pts.push(new V3(Math.cos(a) * r * (opts && opts.sx || 1), y + t * h, Math.sin(a) * r * (opts && opts.sz || 1)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, n * 2, (opts && opts.thick) || 0.0055, 6, false), (opts && opts.mat) || mats().rope);
  }
  /* testa scheggiata: profilo estruso con bisellatura, assottigliato verso il filo */
  function knappedHead(shapePts, depth, edgeAxis, edgeFrom, edgeTo, minScale) {
    const sh = new THREE.Shape(); shapePts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: depth * 0.3, bevelSegments: 3, curveSegments: 12, steps: 2 });
    geo.translate(0, 0, -depth / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = edgeAxis === 'x' ? p.getX(i) : p.getY(i);
      const k = G.smooth(edgeFrom, edgeTo, v);
      // assottiglia verso il filo e aggiunge sfaccettature di scheggiatura
      const facet = Math.sin(p.getX(i) * 140 + p.getY(i) * 90) * 0.0012;
      p.setZ(i, p.getZ(i) * G.lerp(1, minScale, k) + facet * Math.sign(p.getZ(i)));
    }
    geo.computeVertexNormals();
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 6, p.getY(i) * 6);
    return geo;
  }

  T.build = function (id) {
    const M = mats();
    // attrezzi di ferro: stesso modello di quelli di pietra, con la testa di metallo
    if (/^(ascia|piccone)_legno$/.test(id) || id === 'spada_legno') {
      const g0 = T.build(id === 'spada_legno' ? 'sciabola' : id.replace('_legno', '')); if (!g0) return null;
      const wd = M.toolWood || (M.toolWood = new THREE.MeshStandardMaterial({ map: M.wood.map, normalMap: M.wood.normalMap, color: 0xd9b27c, roughness: 0.8 }));
      g0.traverse((o) => { if (o.isMesh && (o.material === M.stone || o.material === M.flint || (M.steel && o.material === M.steel))) o.material = wd; });
      return g0;
    }
    if (/^(ascia|piccone|pala)_ferro$/.test(id) || id === 'spada_ferro') {
      const g0 = T.build(id === 'spada_ferro' ? 'sciabola' : id.replace('_ferro', '')); if (!g0) return null;
      const iron = M.iron || (M.iron = new THREE.MeshStandardMaterial({ color: 0xa9aeb3, roughness: 0.35, metalness: 0.85 }));
      g0.traverse((o) => { if (o.isMesh && (o.material === M.stone || o.material === M.flint || (M.steel && o.material === M.steel))) o.material = iron; });
      if (id === 'spada_ferro') g0.scale.set(1.08, 1.1, 1.08);
      return g0;
    }
    const g = new THREE.Group();
    const add = (m) => { m.castShadow = false; g.add(m); return m; };
    if (id === 'ascia') {
      add(handle(0.56, 0.019, 0.016, 0.012));
      // testa: lama di selce con filo curvo
      const head = new THREE.Mesh(knappedHead([[-0.035, -0.03], [0.02, -0.035], [0.075, -0.06], [0.112, -0.052], [0.128, 0], [0.112, 0.052], [0.075, 0.062], [0.02, 0.036], [-0.035, 0.032], [-0.045, 0]], 0.03, 'x', 0.02, 0.125, 0.18), M.flint);
      head.rotation.y = Math.PI * 0.92; head.position.set(0, 0.42, 0);
      add(head);
      add(lashing(0.024, 0.075, 7, 0.385, { sx: 1.25, sz: 1.05, bulge: 0.004 }));
      add(lashing(0.022, 0.02, 2, 0.36, { thick: 0.004 }));
      // pomolo
      add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), M.woodDark)).position.y = -0.06;
    } else if (id === 'piccone') {
      add(handle(0.56, 0.02, 0.017, 0.008));
      // testa curva a due punte
      const half = (dir) => {
        const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new V3(0, 0.44 - t * t * 0.07, dir * t * 0.19)); }
        const geo = G.MODELS.trunk(pts, 0.03, 0.005, 12, 1, null, 16);
        const pp = geo.attributes.position; for (let i = 0; i < pp.count; i++) pp.setX(i, pp.getX(i) * 0.75);
        geo.computeVertexNormals();
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.6);
        return new THREE.Mesh(geo, M.stone);
      };
      add(half(1)); add(half(-1));
      add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10).scale(0.85, 1.05, 1.2), M.stone)).position.y = 0.44;
      add(lashing(0.024, 0.07, 6, 0.405, { sx: 1.0, sz: 1.35, bulge: 0.006 }));
      add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), M.woodDark)).position.y = -0.06;
    } else if (id === 'coltello') {
      const h = handle(0.13, 0.016, 0.014, 0); add(h);
      add(lashing(0.0165, 0.1, 9, -0.045, { mat: M.leather, thick: 0.0045 }));
      const blade = new THREE.Mesh(knappedHead([[-0.016, 0], [0.016, 0], [0.019, 0.06], [0.012, 0.13], [0, 0.17], [-0.008, 0.12], [-0.014, 0.05]], 0.012, 'x', 0.0, 0.02, 0.2), M.flint);
      blade.position.y = 0.07; add(blade);
      add(lashing(0.017, 0.022, 3, 0.055, { thick: 0.0045 }));
    } else if (id === 'canna') {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new V3(0, t * 1.05 - 0.1, -t * t * 0.08)); }
      add(new THREE.Mesh(G.MODELS.trunk(pts, 0.013, 0.0035, 10, 1, null, 24), M.wood));
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.16, 16), M.cork)).position.y = 0.0;
      const reel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 20), M.woodDark)); reel.rotation.z = Math.PI / 2; reel.position.set(0.03, 0.12, 0);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 20), M.line)).position.set(0.03, 0.12, 0);
      for (const t of [0.35, 0.6, 0.82]) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0016, 5, 12), M.brass)); r.position.set(0, t * 1.05 - 0.1 + 0.005, -t * t * 0.08 - 0.012); }
      g.rotation.x = -0.45;
    } else if (id === 'torcia') {
      add(handle(0.42, 0.017, 0.02, 0.005));
      // testa di stoffa catramata avvolta
      const hg = new THREE.SphereGeometry(0.04, 18, 14); const hp = hg.attributes.position;
      for (let i = 0; i < hp.count; i++) { const y = hp.getY(i); const k = 1 + Math.sin(y * 160) * 0.06 + Math.sin(Math.atan2(hp.getZ(i), hp.getX(i)) * 7) * 0.04; hp.setXYZ(i, hp.getX(i) * k, y * 1.6, hp.getZ(i) * k); }
      hg.computeVertexNormals();
      add(new THREE.Mesh(hg, M.cloth)).position.y = 0.37;
      add(lashing(0.021, 0.03, 4, 0.3, { thick: 0.004 }));
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.3).translate(0, 0.15, 0), G.flameMaterial()); f.position.y = 0.38; g.add(f);
    } else if (id === 'libro') {
      const b = new THREE.Group();
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.012), M.cover); cover.position.z = -0.017; b.add(cover);
      const back = cover.clone(); back.position.z = 0.017; b.add(back);
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12, 1, false, Math.PI / 2, Math.PI), M.cover); spine.position.x = -0.075; b.add(spine);
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.19, 0.024), M.paper); pages.position.x = 0.003; b.add(pages);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.202, 0.046), M.leather); strap.position.x = 0.045; b.add(strap);
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.05), M.brass); clasp.position.x = 0.072; b.add(clasp);
      b.rotation.set(1.0, 0.35, 0.2); b.position.set(-0.05, 0.08, -0.04);
      g.add(b);
    } else if (id === 'ciotola') {
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.02 + Math.sin(t * Math.PI / 2) * 0.07, t * 0.05)); }
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ map: M.wood.map, normalMap: M.wood.normalMap, roughness: 0.6, side: THREE.DoubleSide, color: 0xc8a882 }));
      bowl.position.set(-0.03, 0.06, -0.04); g.add(bowl);
    } else if (id === 'arco') {
      // arco curvo con corda; la corda e la freccia si muovono quando lo tendi
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12 - 0.5; pts.push(new V3(0, t * 1.1, -Math.cos(t * Math.PI) * 0.14 + 0.14 - Math.abs(t) * 0.05)); }
      add(new THREE.Mesh(G.MODELS.trunk(pts, 0.016, 0.009, 10, 2, null, 30), M.wood));
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), M.leather));
      const str = new THREE.Group(); g.add(str); g.userData.string = str;
      const top = new V3(0, 0.55, 0.07), bot = new V3(0, -0.55, 0.07);
      const mkStr = () => { const geo = new THREE.BufferGeometry().setFromPoints([top, new V3(0, 0, 0.07), bot]); return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8e0d0 })); };
      const line = mkStr(); str.add(line); g.userData.line = line; g.userData.top = top; g.userData.bot = bot;
      const arrow = T.build('freccia'); arrow.rotation.x = -Math.PI / 2; arrow.position.set(0.0, 0.02, 0.07); arrow.visible = false; g.add(arrow); g.userData.arrow = arrow;
      g.rotation.set(0.1, 0, 0.25);
    } else if (id === 'freccia') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.62, 6).translate(0, 0.0, 0), M.wood));
      const tip = add(new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4), M.flint)); tip.position.y = 0.33;
      for (let i = 0; i < 3; i++) { const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.08), M.paper)); f.material = M.paper; f.position.y = -0.27; f.rotation.y = (i / 3) * Math.PI; f.material.side = THREE.DoubleSide; }
    } else if (id === 'lancia') {
      add(handle(1.3, 0.02, 0.017, 0.01)).position.y = -0.45;
      const head = new THREE.Mesh(knappedHead([[-0.02, 0], [0.02, 0], [0.026, 0.06], [0.012, 0.15], [0, 0.2], [-0.012, 0.15], [-0.026, 0.06]], 0.014, 'x', 0.0, 0.026, 0.25), M.flint);
      head.position.y = 0.79; add(head);
      add(lashing(0.021, 0.06, 6, 0.76, { thick: 0.005 }));
    } else if (id === 'sciabola') {
      const steel = M.steel || (M.steel = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.22, metalness: 0.95 }));
      const sh = new THREE.Shape(); sh.moveTo(-0.014, 0); sh.quadraticCurveTo(-0.02, 0.4, 0.05, 0.72); sh.quadraticCurveTo(0.02, 0.42, 0.016, 0); sh.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1, curveSegments: 16 }), steel);
      blade.position.set(0, 0.1, -0.002); add(blade);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 10), M.leather)).position.y = 0.03;
      const guard = add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 20, Math.PI * 1.2), M.brass)); guard.position.set(0.01, 0.06, 0); guard.rotation.set(0, Math.PI / 2, 2.2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), M.brass)).position.y = 0.09;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), M.brass)).position.y = -0.03;
    } else if (id === 'pistola' || id === 'pistola_capitano') {
      const metal = new THREE.MeshStandardMaterial({ color: id === 'pistola' ? 0x7c8288 : 0x9a8a5a, roughness: 0.35, metalness: 0.9 });
      const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 12), metal)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.1, -0.15);
      const stock = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.2), M.woodDark)); stock.position.set(0, 0.09, -0.06);
      const grip = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), M.woodDark)); grip.position.set(0, 0.03, 0.04); grip.rotation.x = -0.45;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), M.brass)).position.set(0, -0.02, 0.07);
      const lock = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.05), metal)); lock.position.set(0.02, 0.11, -0.02);
      if (id === 'pistola_capitano') for (const z of [-0.2, -0.1, 0.0]) { const b = add(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 5, 12), M.brass)); b.position.set(0, 0.1, z); }
      g.rotation.x = 0.25;
    } else if (id === 'pala') {
      add(handle(0.85, 0.018, 0.017, 0.005));
      const metal = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.55, metalness: 0.6 });
      const sh = new THREE.Shape(); sh.moveTo(-0.08, 0); sh.lineTo(0.08, 0); sh.lineTo(0.075, 0.14); sh.quadraticCurveTo(0, 0.24, -0.075, 0.14); sh.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false }), metal); blade.rotation.z = Math.PI; blade.position.set(0, -0.05, 0); add(blade);
      g.rotation.x = 0.2;
    } else if (id === 'cannocchiale') {
      let z = 0; for (const [r, l, m] of [[0.026, 0.12, M.woodDark], [0.022, 0.1, M.brass], [0.018, 0.1, M.woodDark], [0.015, 0.05, M.brass]]) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 16), m)); c.rotation.x = Math.PI / 2; c.position.set(0, 0.08, -z - l / 2); z += l * 0.92; }
    } else if (id === 'lanterna') {
      const frame = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.5, metalness: 0.7 });
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 12), frame)).position.y = 0.0;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.04, 12), frame)).position.y = 0.17;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb84a, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }))).position.y = 0.085;
      add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI), frame)).position.y = 0.2;
    } else if (id === 'bussola_oro') {
      const gold = new THREE.MeshStandardMaterial({ color: 0xe2b43c, roughness: 0.25, metalness: 1 });
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 24), gold)).rotation.x = Math.PI / 2 - 0.6;
      const face = add(new THREE.Mesh(new THREE.CircleGeometry(0.042, 24), M.paper)); face.position.set(0, 0.008, 0.007); face.rotation.x = -0.6;
    } else if (id === 'mappa_tesoro' || id === 'pacco' || /^progetto/.test(id)) {
      const tex = new THREE.TextureLoader().load(G.icon(id)); tex.encoding = THREE.sRGBEncoding;
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 })));
      m.position.set(-0.02, 0.08, -0.04); m.rotation.set(-0.6, 0.3, 0);
    } else return null;
    return g;
  };
})();
