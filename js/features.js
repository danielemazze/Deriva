'use strict';
/* ==========================================================
   Elementi del paesaggio: banchisa (mare ghiacciato), lava e
   fumo dei vulcani, laghetti di montagna e cascate.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const F = (G.Features = { lakes: new Map(), volc: new Map() });
  const V3 = THREE.Vector3;
  let iceMat = null, lavaMat = null, lakeMat = null, fallMat = null, smokeTex = null;

  function mats() {
    if (iceMat) return;
    const T = G.TEX;
    iceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, metalness: 0.0, normalMap: T.rockT ? T.rockT.normal : null, normalScale: new THREE.Vector2(0.25, 0.25) });
    if (iceMat.normalMap) { iceMat.normalMap = iceMat.normalMap.clone(); iceMat.normalMap.needsUpdate = true; iceMat.normalMap.wrapS = iceMat.normalMap.wrapT = THREE.RepeatWrapping; }
    G.patch(iceMat, { key: 'ice' });
    lavaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: G.shared.uTime },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ vec2 p = vP.xz * 0.12; float t = uTime * 0.05;
          float a = n(p + vec2(t, -t)) * 0.6 + n(p * 2.3 - vec2(t * 1.7, t)) * 0.4;
          float crust = smoothstep(0.42, 0.62, a);
          vec3 hot = mix(vec3(1.6, 0.55, 0.08), vec3(2.2, 1.3, 0.3), n(p * 5.0 + t * 3.0));
          vec3 col = mix(hot, vec3(0.08, 0.05, 0.04), crust * 0.85);
          gl_FragColor = vec4(col, 1.0); }`,
    });
    lakeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: { uTime: G.shared.uTime, tN: { value: G.TEX.waterNormalT }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new V3() }, uSunCol: { value: new THREE.Color() }, uCam: { value: new V3() }, uAmb: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }',
      fragmentShader: `uniform float uTime, uAmb; uniform sampler2D tN; uniform vec3 uZen, uHor, uSun, uSunCol, uCam; varying vec3 vP;
        void main(){ vec2 uv1 = vP.xz * 0.08 + uTime * vec2(0.01, 0.006), uv2 = vP.xz * 0.21 - uTime * vec2(0.008, 0.013);
          vec3 nn = (texture2D(tN, uv1).xyz * 2.0 - 1.0) + (texture2D(tN, uv2).xyz * 2.0 - 1.0);
          vec3 N = normalize(vec3(nn.x * 0.18, 1.0, nn.y * 0.18)); vec3 V = normalize(uCam - vP);
          float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N); vec3 sky = mix(uHor, uZen, pow(max(R.y, 0.0), 0.5));
          vec3 deep = vec3(0.02, 0.12, 0.13) * uAmb;
          vec3 col = mix(deep, sky, clamp(fr, 0.0, 0.85)) + uSunCol * pow(max(dot(R, uSun), 0.0), 300.0) * 3.0;
          gl_FragColor = vec4(col, mix(0.72, 0.95, fr)); }`,
    });
    fallMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: G.shared.uTime, uL: { value: 1 } },
      vertexShader: 'attribute float aSteep; varying vec2 vUv; varying float vS; void main(){ vUv = uv; vS = aSteep; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime, uL; varying vec2 vUv; varying float vS;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ float sp = 1.0 + vS * 4.0;
          float s = n(vec2(vUv.x * 9.0, vUv.y * 0.9 - uTime * sp)) * 0.6 + n(vec2(vUv.x * 23.0, vUv.y * 2.1 - uTime * sp * 1.6)) * 0.4;
          float foam = smoothstep(0.35, 0.8, s) * (0.4 + vS * 0.8);
          float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          vec3 col = mix(vec3(0.16, 0.36, 0.4), vec3(0.92, 0.97, 1.0), clamp(foam, 0.0, 1.0)) * uL;
          gl_FragColor = vec4(col, edge * mix(0.55, 0.95, clamp(foam + vS * 0.4, 0.0, 1.0))); }`,
    });
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); smokeTex = new THREE.CanvasTexture(c);
  }

  F.materials = function () { mats(); return [iceMat, lavaMat, lakeMat, fallMat]; };
  /* ---------------- BANCHISA (per chunk) ---------------- */
  F.chunk = function (ch) {
    if (ch.minH > 0.2) return;
    const C = G.CHUNK, x0 = ch.cx * C, z0 = ch.cz * C;
    if (G.coldAt(x0 + C / 2, z0 + C / 2) < 0.35 && G.coldAt(x0, z0) < 0.35 && G.coldAt(x0 + C, z0 + C) < 0.35) return;
    mats();
    const N = 16, S = C / N, Y = G.SEA + G.ICE_Y;
    const ice = (i, j) => { const x = x0 + (i + 0.5) * S, z = z0 + (j + 0.5) * S; return G.heightAt(x, z) < G.SEA - 0.2 && G.iceAt(x, z); };
    const cells = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push(ice(i, j));
    if (!cells.some(Boolean)) return;
    const pos = [], col = [], nor = [], uv = [];
    const jit = (x, z) => [(G.hash2(Math.round(x * 3), Math.round(z * 3), 81) - 0.5) * S * 0.55, (G.hash2(Math.round(x * 3), Math.round(z * 3), 82) - 0.5) * S * 0.55];
    const vtx = (x, z, y, sh) => { const [jx, jz] = jit(x, z); pos.push(x + jx, y, z + jz); nor.push(0, 1, 0); uv.push((x + jx) * 0.08, (z + jz) * 0.08); col.push(0.86 * sh, 0.93 * sh, 0.99 * sh); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!cells[j * N + i]) continue;
      const xa = x0 + i * S, xb = xa + S, za = z0 + j * S, zb = za + S;
      const sh = 0.9 + G.hash2(ch.cx * 50 + i, ch.cz * 50 + j, 83) * 0.12;
      vtx(xa, za, Y, sh); vtx(xa, zb, Y, sh); vtx(xb, za, Y, sh);
      vtx(xb, za, Y, sh); vtx(xa, zb, Y, sh); vtx(xb, zb, Y, sh);
      // bordo della lastra: si vede lo spessore verso l'acqua libera
      const side = (ax, az, bx, bz) => { vtx(ax, az, Y, 0.75); vtx(bx, bz, Y, 0.75); vtx(ax, az, Y - 0.7, 0.55); vtx(bx, bz, Y, 0.75); vtx(bx, bz, Y - 0.7, 0.55); vtx(ax, az, Y - 0.7, 0.55); };
      const open = (ii, jj) => ii >= 0 && jj >= 0 && ii < N && jj < N ? !cells[jj * N + ii] : !ice(ii, jj);
      if (open(i, j - 1)) side(xb, za, xa, za); if (open(i, j + 1)) side(xa, zb, xb, zb);
      if (open(i - 1, j)) side(xa, za, xa, zb); if (open(i + 1, j)) side(xb, zb, xb, za);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, iceMat); m.receiveShadow = true;
    G.scene.add(m); ch.ice = m;
  };
  F.unchunk = function (ch) { if (ch.ice) { G.scene.remove(ch.ice); ch.ice.geometry.dispose(); ch.ice = null; } };

  /* ---------------- LAGHI, CASCATE, VULCANI (per vicinanza) ---------------- */
  function buildLake(L) {
    mats();
    const seg = 48, R = L.R * 1.16;
    const g = new THREE.CircleGeometry(R, seg).rotateX(-Math.PI / 2); g.translate(L.x, L.level, L.z);
    const lake = new THREE.Mesh(g, lakeMat); lake.renderOrder = 3;
    const grp = new THREE.Group(); grp.add(lake);
    // cascata: dal bordo più basso segue la discesa del terreno
    const pts = []; let x = L.x + Math.cos(L.out) * R * 0.95, z = L.z + Math.sin(L.out) * R * 0.95, dx = Math.cos(L.out), dz = Math.sin(L.out);
    let y = L.level, drop = 0;
    for (let i = 0; i < 90; i++) {
      pts.push([x, Math.max(G.heightAt(x, z), G.SEA) + 0.15, z]);
      // direzione di massima pendenza (con inerzia, così il rivo non serpeggia troppo)
      let bx = dx, bz = dz, bh = Infinity;
      for (let a = -0.9; a <= 0.9; a += 0.3) { const cx = Math.cos(Math.atan2(dz, dx) + a), cz = Math.sin(Math.atan2(dz, dx) + a); const hh = G.heightAt(x + cx * 1.8, z + cz * 1.8); if (hh < bh) { bh = hh; bx = cx; bz = cz; } }
      dx = dx * 0.4 + bx * 0.6; dz = dz * 0.4 + bz * 0.6; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      x += dx * 1.8; z += dz * 1.8;
      const h = G.heightAt(x, z); drop = L.level - h;
      if (h < G.SEA + 0.2 || drop > 45 || (i > 30 && h > pts[pts.length - 1][1] + 0.1)) break;
    }
    if (pts.length > 4) {
      const pos = [], uvs = [], st = []; let dist = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        const tx = q[0] - o[0], tz = q[2] - o[2], tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
        const steep = G.clamp((o[1] - q[1]) / (Math.hypot(q[0] - o[0], q[2] - o[2]) || 1) / 1.2, 0, 1);
        const w = 1.3 + steep * 0.5;
        if (i) dist += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) + Math.abs(p[1] - pts[i - 1][1]);
        pos.push(p[0] + nx * w, p[1], p[2] + nz * w, p[0] - nx * w, p[1], p[2] - nz * w);
        uvs.push(0, dist * 0.25, 1, dist * 0.25); st.push(steep, steep);
      }
      const idx = []; for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.setAttribute('aSteep', new THREE.Float32BufferAttribute(st, 1)); fg.setIndex(idx); fg.computeBoundingSphere();
      const fall = new THREE.Mesh(fg, fallMat); fall.renderOrder = 4; grp.add(fall);
      // punto più ripido: spruzzi e rumore
      let bi = 1, bs = -1; for (let i = 1; i < pts.length - 1; i++) { const s = pts[i - 1][1] - pts[i + 1][1]; if (s > bs) { bs = s; bi = i; } }
      L.mist = new V3(pts[bi][0], pts[bi][1], pts[bi][2]); L.bottom = new V3(...pts[pts.length - 1]);
      L.fallLen = dist;
    }
    G.scene.add(grp);
    return grp;
  }
  function buildVolcano(v) {
    mats();
    if (v.lava === undefined) G.heightAt(v.x + v.Rc, v.z);
    const grp = new THREE.Group();
    // lago di lava dove il fondo del cratere è sotto il livello
    const r = v.Rc * Math.cbrt(Math.max(0.05, (v.lava - v.floor) / v.depth)) * 1.05;
    const lava = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), lavaMat); lava.position.set(v.x, v.lava, v.z);
    grp.add(lava);
    // fumo: puff che salgono e si allargano
    const puffs = [];
    for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: new THREE.Color().setScalar(0.32 + Math.random() * 0.18), transparent: true, depthWrite: false, opacity: 0 })); s.userData.t = i / 34; s.userData.o = [(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2]; grp.add(s); puffs.push(s); }
    grp.userData = { puffs };
    G.scene.add(grp);
    return grp;
  }
  F.update = function (dt, P, t) {
    const px = P.pos.x, pz = P.pos.z;
    // laghi entro 420 m
    const near = new Set();
    for (const L of G.lakes(px, pz, 420)) { near.add(L.id); if (!F.lakes.has(L.id)) F.lakes.set(L.id, { L, grp: buildLake(L) }); }
    for (const [id, o] of F.lakes) if (!near.has(id)) { G.scene.remove(o.grp); o.grp.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); F.lakes.delete(id); }
    if (lakeMat) { const S = G.sky, u = lakeMat.uniforms; u.uZen.value.copy(S.zen); u.uHor.value.copy(S.hor); u.uSun.value.copy(S.sun); u.uSunCol.value.copy(S.sunCol); u.uCam.value.copy(G.camera.position); u.uAmb.value = 0.3 + S.day * 0.7; fallMat.uniforms.uL.value = 0.25 + S.day * 0.75; }
    // vulcani entro 1500 m (si vedono da lontano col fumo)
    const nv = new Set();
    for (const v of G.volcanoes(px, pz, 1500)) { const id = v.x.toFixed(0) + ',' + v.z.toFixed(0); nv.add(id); if (!F.volc.has(id)) F.volc.set(id, { v, grp: buildVolcano(v) }); }
    for (const [id, o] of F.volc) if (!nv.has(id)) { G.scene.remove(o.grp); F.volc.delete(id); }
    for (const o of F.volc.values()) {
      const v = o.v, wd = G.Climate ? G.Climate.windDirAt(v.x, v.z) : 0, ws = G.Climate ? G.Climate.windLevel() : 3;
      for (const s of o.grp.userData.puffs) {
        s.userData.t = (s.userData.t + dt * 0.035) % 1; const k = s.userData.t;
        const rise = k * 140;
        const o2 = s.userData.o, spread = 4 + k * 30;
        s.position.set(v.x + Math.sin(wd) * rise * (0.3 + ws * 0.12) + o2[0] * spread, v.rim + 2 + rise, v.z + Math.cos(wd) * rise * (0.3 + ws * 0.12) + o2[1] * spread);
        const sc = 12 + k * 55; s.scale.set(sc, sc, 1);
        s.material.opacity = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - k) * 0.5 * (0.35 + (G.sky ? G.sky.day : 1) * 0.65);
      }
    }
    // lava: brucia chi ci cade dentro
    const lv = G.lavaAt(px, pz);
    if (lv !== null && lv !== undefined && P.pos.y < lv + 0.6 && !G.creative()) { P.hurt(dt * 35, true); P.dmgFlash = 1; if (!F._lavaT || t - F._lavaT > 3) { F._lavaT = t; G.UI.toast('La lava brucia! Esci subito', 'warn'); } }
    // spruzzi ai piedi della cascata
    for (const o of F.lakes.values()) { const L = o.L; if (L.mist && Math.hypot(L.mist.x - px, L.mist.z - pz) < 80 && Math.random() < dt * 6) G.FX.burst(L.mist.x + (Math.random() - 0.5) * 2, L.mist.y + 0.2, L.mist.z + (Math.random() - 0.5) * 2, [0.9, 0.95, 1], 2, 1.6, { size: 1.3, g: 2 }); }
    if (G.Audio && G.Audio.falls) { let k = 0; for (const o of F.lakes.values()) if (o.L.mist) k = Math.max(k, 1 - Math.hypot(o.L.mist.x - px, o.L.mist.z - pz) / 70); G.Audio.falls(Math.max(0, k)); }
  };
  F.clear = function () {
    for (const o of F.lakes.values()) G.scene.remove(o.grp);
    for (const o of F.volc.values()) G.scene.remove(o.grp);
    F.lakes.clear(); F.volc.clear();
  };
  // superficie dell'acqua nel punto: mare (con onde) o lago
  G.waterLevelAt = function (x, z, t) {
    const sea = G.waveHeight(x, z, t);
    const l = G.lakeLevelAt(x, z);
    if (l !== null && l > sea) return l;
    if (G.iceAt && G.coldAt(x, z) > 0.55 && G.iceAt(x, z) && G.heightAt(x, z) < G.SEA - 0.2) return Math.min(sea, G.SEA); // sotto la banchisa
    return sea;
  };
})();
