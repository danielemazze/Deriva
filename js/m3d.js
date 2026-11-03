/* =========================================================
   Modelli 3D fotografati (ambientCG, CC0): frutta, pane e bastone.
   Si vedono in mano e quando sono a terra. L'icona dell'inventario
   è la foto del modello.
   ========================================================= */
(function () {
  const M3 = (G.M3D = {});
  // id dell'oggetto → misura voluta (lato più lungo, in metri)
  M3.SIZE = { mela: 0.1, pane: 0.15, limone: 0.09, pera: 0.11, mango: 0.13, melone: 0.26, avocado: 0.11, kiwi: 0.07, bastone: 0.55 };
  M3.has = (id) => M3.SIZE[id] !== undefined;
  const geos = {}, mats = {};
  function parse(txt) {
    const v = [], vt = [], vn = [], P = [], U = [], N = [];
    for (const l of txt.split('\n')) {
      const p = l.trim().split(/\s+/);
      if (p[0] === 'v') v.push(+p[1], +p[2], +p[3]);
      else if (p[0] === 'vt') vt.push(+p[1], +p[2]);
      else if (p[0] === 'vn') vn.push(+p[1], +p[2], +p[3]);
      else if (p[0] === 'f') {
        const ids = p.slice(1).map((s) => s.split('/').map((x) => (x ? +x - 1 : -1)));
        for (let k = 1; k < ids.length - 1; k++) for (const q of [ids[0], ids[k], ids[k + 1]]) {
          P.push(v[q[0] * 3], v[q[0] * 3 + 1], v[q[0] * 3 + 2]);
          if (q[1] >= 0) U.push(vt[q[1] * 2], vt[q[1] * 2 + 1]); else U.push(0, 0);
          if (q[2] >= 0) N.push(vn[q[2] * 3], vn[q[2] * 3 + 1], vn[q[2] * 3 + 2]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    if (N.length === P.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); else g.computeVertexNormals();
    g.computeBoundingBox(); return g;
  }
  function load(id) {
    if (geos[id]) return geos[id];
    geos[id] = fetch('assets/m3d/' + id + '.obj').then((r) => r.text()).then((t) => {
      const g = parse(t), b = g.boundingBox, s = new THREE.Vector3(); b.getSize(s);
      const k = M3.SIZE[id] / Math.max(s.x, s.y, s.z), c = new THREE.Vector3(); b.getCenter(c);
      g.translate(-c.x, -b.min.y, -c.z); g.scale(k, k, k); g.computeBoundingBox();
      const L = new THREE.TextureLoader(), map = L.load('assets/m3d/' + id + '_c.jpg'), nm = L.load('assets/m3d/' + id + '_n.jpg');
      map.encoding = THREE.sRGBEncoding; map.anisotropy = 4;
      mats[id] = new THREE.MeshStandardMaterial({ map, normalMap: nm, roughness: id === 'bastone' || id === 'pane' ? 0.85 : 0.45 });
      return g;
    }).catch(() => null);
    return geos[id];
  }
  // gruppo che si riempie col modello appena è caricato
  M3.mesh = function (id, scale) {
    const grp = new THREE.Group();
    load(id).then((g) => { if (!g) return; const m = new THREE.Mesh(g, mats[id]); m.castShadow = true; m.receiveShadow = true; if (scale) m.scale.setScalar(scale); grp.add(m); });
    return grp;
  };
})();
