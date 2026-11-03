/* =========================================================
   Texture fotografiche ambientCG (CC0): colore, normale e
   ruvidezza per terreno, legni, pietre, tetti, metalli, tessuti,
   foglie ed erba. 2K su Alta e Ultra, 1K su Minima, Bassa, Media
   e sul telefono. Con «Patata» restano le texture di prima.
   ========================================================= */
(function () {
  const AC = (G.ACG = { on: false, res: null, tex: {}, rough: new Map(), cards: {}, terrain: null });
  // livello delle texture per ogni qualità: 0 = quelle di prima, 1 = 1K, 2 = 2K
  AC.level = function (S) {
    const p = S.preset === 'custom' ? S.basePreset : S.preset;
    if (p === 'patata') return 0;
    if (G.isTouch) return 1;
    return p === 'alta' || p === 'ultra' ? 2 : 1;
  };
  // quante volte si ripete ogni texture rispetto a quella disegnata a mano che sostituisce
  const REP = { cloth: [3, 3], rope: [1, 1] };
  const loader = new THREE.TextureLoader();
  const load = (url, srgb, wrap) => new Promise((res) => loader.load(url, (t) => {
    t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    if (wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = G.maxAniso || 4; t.minFilter = THREE.LinearMipmapLinearFilter;
    res(t);
  }, undefined, () => res(null)));
  const img = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });

  AC.load = async function (S, onStep) {
    const lv = AC.level(S); if (!lv) return false;
    const base = 'assets/acg/' + (lv === 2 ? '2k' : '1k') + '/';
    let man; try { man = await (await fetch(base + 'acg.json')).json(); } catch (e) { console.warn('texture ambientCG non trovate', e); return false; }
    AC.res = lv === 2 ? 2048 : 1024;
    let done = 0; const total = man.obj.length + man.cards.length + 1, step = () => onStep && onStep(++done / total);
    // oggetti: colore + normale + ruvidezza
    await Promise.all(man.obj.map(async (k) => {
      const [map, normal, rough] = await Promise.all([load(base + k + '.jpg', true), load(base + k + '_n.jpg', false), load(base + k + '_r.jpg', false)]);
      step(); if (!map) return;
      const r = REP[k]; if (r) for (const t of [map, normal, rough]) if (t) t.repeat.set(r[0], r[1]);
      AC.tex[k] = { map, normal, rough };
      if (rough) AC.rough.set(map, rough);
    }));
    // carte di fogliame ed erba (con trasparenza)
    await Promise.all(man.cards.map(async (k) => {
      const [map, normal] = await Promise.all([load(base + k + '.png', true, false), load(base + k + '_n.jpg', false, false)]);
      step(); if (map) AC.cards[k] = { map, normal };
    }));
    // terreno: due "pile" di texture (colore; normale + ruvidezza + altezza) lette dallo shader
    if (G.renderer && G.renderer.capabilities.isWebGL2) {
      try { AC.terrain = await buildTerrain(base, man.terrain); } catch (e) { console.warn('terreno PBR non disponibile', e); AC.terrain = null; }
    }
    step();
    AC.on = true;
    apply();
    return true;
  };
  async function buildTerrain(base, layers) {
    const ims = await Promise.all(layers.flatMap((k) => [img(base + 't_' + k + '.jpg'), img(base + 't_' + k + '_n.jpg'), img(base + 't_' + k + '_h.jpg')]));
    if (ims.some((i) => !i)) return null;
    const cs = ims[0].width, ns = ims[1].width, L = layers.length;
    const cv = document.createElement('canvas'), x = cv.getContext('2d', { willReadFrequently: true });
    const read = (im, s) => { cv.width = cv.height = s; x.clearRect(0, 0, s, s); x.drawImage(im, 0, 0, s, s); return x.getImageData(0, 0, s, s).data; };
    const C = new Uint8Array(cs * cs * 4 * L), N = new Uint8Array(ns * ns * 4 * L);
    for (let i = 0; i < L; i++) {
      C.set(read(ims[i * 3], cs), i * cs * cs * 4);
      const n = read(ims[i * 3 + 1], ns), h = read(ims[i * 3 + 2], ns), o = i * ns * ns * 4;
      for (let p = 0, q = n.length; p < q; p += 4) { N[o + p] = n[p]; N[o + p + 1] = n[p + 1]; N[o + p + 2] = n[p + 2]; N[o + p + 3] = h[p]; }
      await new Promise((r) => setTimeout(r, 0));
    }
    const mk = (data, s, srgb) => {
      const t = new THREE.DataArrayTexture(data, s, s, L);
      t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
      t.anisotropy = G.maxAniso || 4; t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding; t.needsUpdate = true;
      t.onUpdate = () => { t.image.data = null; }; // caricata sulla scheda video: la copia in memoria non serve più
      return t;
    };
    const idx = {}; layers.forEach((k, i) => { idx[k] = i; });
    return { C: mk(C, cs, true), N: mk(N, ns, false), idx };
  }
  // sostituisce le texture disegnate a mano con le foto (prima che si creino i materiali)
  function apply() {
    const T = G.TEX, PH = G.PHOTO || (G.PHOTO = {});
    for (const k of ['bark', 'planks', 'woodGrain', 'rope', 'cloth', 'rock', 'stucco', 'tiles', 'thatch', 'shingles', 'stonewall', 'slate']) {
      const a = AC.tex[k]; if (a && T[k + 'T']) T[k + 'T'] = { map: a.map, normal: a.normal };
    }
    if (AC.tex.bark) { PH.bark = AC.tex.bark.map; PH.barkN = AC.tex.bark.normal; }
    const c = AC.cards;
    if (c.leaves0) { PH.leaves0 = c.leaves0.map; PH.leaves0N = c.leaves0.normal; }
    if (c.leaves1) { PH.leaves1 = c.leaves1.map; PH.leaves1N = c.leaves1.normal; }
    if (c.pine) T.pineT = c.pine.map;
    if (c.grasscard) T.grassCardT = c.grasscard.map;
  }
  // parametri per un materiale con una texture fotografica (se c'è)
  AC.mat = function (k, o, rep) {
    const a = AC.on && AC.tex[k]; if (!a) return o;
    const r = rep ? (t) => { const c = t.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; } : (t) => t;
    return Object.assign({}, o, { map: r(a.map), normalMap: a.normal ? r(a.normal) : null, roughnessMap: a.rough ? r(a.rough) : null });
  };
  // ogni materiale con una foto prende anche la sua mappa di ruvidezza
  const Base = THREE.MeshStandardMaterial;
  THREE.MeshStandardMaterial = class extends Base {
    constructor(p) { super(p); if (AC.on && this.map && !this.roughnessMap) { const r = AC.rough.get(this.map); if (r) this.roughnessMap = r; } }
  };
})();
