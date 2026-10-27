'use strict';
/* ==========================================================
   Costruzione: pezzi a griglia, mobili, collisioni, luci
   ========================================================== */
(function () {
  const G = globalThis.G;
  const B = (G.Build = { pieces: [], boxes: [], pickups: [] });
  const M = G.MODELS;
  const V3 = THREE.Vector3;
  const CELL = 3, WALL_H = 3;

  /* ---------- materiale olografico (anteprima e sagome barche) ---------- */
  G.holoMaterial = function (color) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: G.shared.uTime, uAlpha: { value: 0.55 } },
      vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime, uAlpha; varying vec3 vN; varying vec3 vW; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          float scan = 0.65 + 0.35*sin(vW.y*22.0 - uTime*4.0);
          float grid = max(step(0.94, fract(vW.x*2.0)), max(step(0.94, fract(vW.y*2.0)), step(0.94, fract(vW.z*2.0))));
          gl_FragColor = vec4(uColor*(1.2 + f*2.0 + grid*0.8), clamp((0.18 + f*0.6 + grid*0.25)*scan*uAlpha*2.0, 0.0, 0.9)); }`,
    });
  };

  /* ---------- geometrie dei pezzi ---------- */
  function boxUV(w, h, d, x, y, z, uvScale) {
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal;
    const s = uvScale || 0.33;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      const px = p.getX(i) + x, py = p.getY(i) + y, pz = p.getZ(i) + z;
      if (ay > 0.5) uv.setXY(i, px * s, pz * s); else if (ax > 0.5) uv.setXY(i, pz * s, py * s); else uv.setXY(i, px * s, py * s);
    }
    g.translate(x, y, z);
    return M.colorize(g, 1, 1, 1);
  }
  const darker = (g, k) => M.colorize(g, k, k, k);
  const GEO = {};
  function buildGeos() {
    GEO.pavimento = M.merge([boxUV(3, 0.2, 3, 0, -0.1, 0), darker(boxUV(0.18, 0.22, 3, -1.41, -0.12, 0), 0.8), darker(boxUV(0.18, 0.22, 3, 1.41, -0.12, 0), 0.8)]);
    const wallParts = (holes) => {
      const parts = [];
      const posts = [darker(boxUV(0.22, 3, 0.26, -1.39, 1.5, 0), 0.75), darker(boxUV(0.22, 3, 0.26, 1.39, 1.5, 0), 0.75), darker(boxUV(3, 0.2, 0.26, 0, 2.9, 0), 0.75), darker(boxUV(3, 0.16, 0.26, 0, 0.08, 0), 0.75)];
      parts.push(...posts);
      if (holes === 'door') {
        parts.push(boxUV(1.0, 2.8, 0.14, -0.95, 1.4, 0), boxUV(1.0, 2.8, 0.14, 0.95, 1.4, 0), boxUV(1.0, 0.6, 0.14, 0, 2.5, 0), darker(boxUV(0.12, 2.25, 0.22, -0.5, 1.12, 0), 0.7), darker(boxUV(0.12, 2.25, 0.22, 0.5, 1.12, 0), 0.7));
      } else if (holes === 'win') {
        parts.push(boxUV(2.6, 1.0, 0.14, 0, 0.6, 0), boxUV(2.6, 0.8, 0.14, 0, 2.5, 0), boxUV(0.7, 1.0, 0.14, -0.95, 1.6, 0), boxUV(0.7, 1.0, 0.14, 0.95, 1.6, 0),
          darker(boxUV(1.3, 0.1, 0.3, 0, 1.12, 0.05), 0.7), darker(boxUV(0.08, 1.0, 0.1, 0, 1.6, 0), 0.6), darker(boxUV(1.2, 0.08, 0.1, 0, 1.6, 0), 0.6));
      } else parts.push(boxUV(2.6, 2.8, 0.14, 0, 1.4, 0));
      return M.merge(parts);
    };
    GEO.muro = wallParts(); GEO.muro_porta = wallParts('door'); GEO.muro_finestra = wallParts('win');
    GEO.porta = M.merge([boxUV(0.95, 2.2, 0.07, 0.475, 1.1, 0), darker(boxUV(0.1, 2.0, 0.1, 0.12, 1.1, 0.04), 0.7), darker(boxUV(0.75, 0.1, 0.1, 0.5, 1.6, 0.04), 0.7), darker(boxUV(0.75, 0.1, 0.1, 0.5, 0.6, 0.04), 0.7), M.colorize(new THREE.SphereGeometry(0.04, 6, 4).translate(0.82, 1.05, 0.08), 0.8, 0.65, 0.3)]);
    // tetto: falda inclinata 3x3 che sale di 1.6 m verso -z
    const slope = Math.atan2(1.6, 3), L = Math.hypot(3, 1.6);
    const r1 = boxUV(3.3, 0.12, L + 0.3, 0, 0, 0); r1.rotateX(slope); r1.translate(0, 0.8, 0);
    const beams = [];
    for (let i = 0; i < 4; i++) { const b = darker(boxUV(0.12, 0.16, L + 0.3, -1.5 + i, -0.1, 0), 0.65); b.rotateX(slope); b.translate(0, 0.8, 0); beams.push(b); }
    GEO.tetto = M.merge([r1, ...beams]);
    // trappola: gabbia di bastoni con porta a ghigliottina
    { const parts = [boxUV(1.3, 0.08, 1.3, 0, 0.04, 0)];
      for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) { parts.push(darker(boxUV(0.05, 0.9, 0.05, -0.6 + i * 0.24, 0.47, sd * 0.62), 0.75)); parts.push(darker(boxUV(0.05, 0.9, 0.05, sd * 0.62, 0.47, -0.6 + i * 0.24), 0.75)); }
      parts.push(boxUV(1.3, 0.06, 1.3, 0, 0.93, 0), darker(boxUV(0.08, 0.5, 0.08, 0, 1.2, 0.55), 0.6), darker(boxUV(0.9, 0.06, 0.06, 0, 1.45, 0.55), 0.6));
      GEO.trappola = M.merge(parts); }
    GEO.recinto = M.merge([darker(boxUV(0.14, 1.3, 0.14, -1.45, 0.65, 0), 0.8), darker(boxUV(0.14, 1.3, 0.14, 1.45, 0.65, 0), 0.8), darker(boxUV(0.14, 1.3, 0.14, 0, 0.65, 0), 0.8), boxUV(3, 0.12, 0.06, 0, 0.45, 0.06), boxUV(3, 0.12, 0.06, 0, 0.95, 0.06)]);
    const steps = []; for (let i = 0; i < 10; i++) steps.push(boxUV(1.4, 0.12, 0.36, 0, (i + 1) * 0.3 - 0.06, 1.5 - i * 0.3 - 0.15));
    steps.push(darker(boxUV(0.12, 0.2, 3.6, -0.68, 1.5, 0), 0.7)); steps.push(darker(boxUV(0.12, 0.2, 3.6, 0.68, 1.5, 0), 0.7));
    const sr = steps.slice(-2); sr.forEach((g) => { g.translate(0, -1.5, 0); g.rotateX(-Math.PI / 4); g.translate(0, 1.5, 0); });
    GEO.scala = M.merge(steps);
    GEO.banco = M.merge([boxUV(1.6, 0.12, 0.85, 0, 0.92, 0), ...[[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]].map(([x, z]) => darker(boxUV(0.1, 0.9, 0.1, x, 0.45, z), 0.75)), darker(boxUV(1.45, 0.06, 0.7, 0, 0.3, 0), 0.8),
      M.colorize(new THREE.BoxGeometry(0.3, 0.05, 0.12).translate(-0.3, 1.0, 0.1), 0.55, 0.55, 0.55), M.colorize(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5).rotateZ(1.2).translate(0.3, 1.0, -0.1), 0.45, 0.3, 0.15)]);
    // forziere del tesoro: legno scuro con bande di ferro e coperchio bombato
    const lid = new THREE.CylinderGeometry(0.29, 0.29, 0.92, 14, 1, false, 0, Math.PI); lid.rotateZ(Math.PI / 2); lid.rotateY(Math.PI / 2); lid.rotateX(0); lid.scale(1, 0.7, 1);
    lid.rotateY(Math.PI / 2); lid.translate(0, 0.5, 0);
    GEO.forziere = M.merge([darker(boxUV(0.9, 0.5, 0.56, 0, 0.25, 0), 0.62), darker(lid, 0.62),
      ...[-0.32, 0, 0.32].map((x) => M.colorize(new THREE.BoxGeometry(0.06, 0.56, 0.6).translate(x, 0.28, 0), 0.22, 0.22, 0.24)),
      ...[-0.32, 0, 0.32].map((x) => { const b = new THREE.CylinderGeometry(0.305, 0.305, 0.06, 14, 1, false, 0, Math.PI); b.rotateZ(Math.PI / 2); b.scale(1, 0.7, 1); b.translate(x, 0.5, 0); return M.colorize(b, 0.22, 0.22, 0.24); }),
      M.colorize(new THREE.BoxGeometry(0.12, 0.14, 0.05).translate(0, 0.46, 0.3), 0.85, 0.7, 0.3)]);
    GEO.baule = M.merge([boxUV(0.9, 0.5, 0.55, 0, 0.25, 0), darker(boxUV(0.92, 0.18, 0.57, 0, 0.58, 0), 0.85), M.colorize(new THREE.BoxGeometry(0.94, 0.06, 0.59).translate(0, 0.48, 0), 0.35, 0.3, 0.25), M.colorize(new THREE.BoxGeometry(0.1, 0.12, 0.04).translate(0, 0.45, 0.29), 0.85, 0.7, 0.35)]);
    GEO.letto = M.merge([darker(boxUV(1.1, 0.3, 2.1, 0, 0.25, 0), 0.8), darker(boxUV(1.1, 0.7, 0.1, 0, 0.45, -1.05), 0.7), M.colorize(new THREE.BoxGeometry(1.0, 0.16, 1.6).translate(0, 0.46, 0.2), 0.72, 0.2, 0.18), M.colorize(new THREE.BoxGeometry(1.0, 0.14, 0.45).translate(0, 0.45, -0.75), 0.95, 0.93, 0.88), M.colorize(new THREE.BoxGeometry(0.7, 0.12, 0.3).translate(0, 0.56, -0.78), 0.98, 0.97, 0.94)]);
    // falò: pietre + legna
    const fp = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const r = M.rock(900 + i, true); r.scale(0.16, 0.16, 0.16); r.translate(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5); fp.push(r); }
    GEO.faloStones = M.merge(fp);
    const logs = []; for (let i = 0; i < 4; i++) { const l = M.colorize(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 7), 0.7, 0.55, 0.45); l.rotateZ(1.15); l.translate(0.1, 0.22, 0); l.rotateY(i * Math.PI / 2 + 0.3); logs.push(l); }
    const ash = M.colorize(new THREE.CircleGeometry(0.4, 12).rotateX(-Math.PI / 2).translate(0, 0.02, 0), 0.12, 0.1, 0.09);
    GEO.faloLogs = M.merge([...logs, ash]);
    GEO.torcia = M.merge([M.colorize(new THREE.CylinderGeometry(0.035, 0.03, 1.1, 6).translate(0, 0.55, 0), 0.55, 0.38, 0.22), M.colorize(new THREE.CylinderGeometry(0.06, 0.045, 0.14, 7).translate(0, 1.12, 0), 0.25, 0.18, 0.12)]);
    GEO.egg = M.colorize(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 1.3, 1), 0.98, 0.94, 0.86);
    // ---- pietra: blocchi pieni, la trama dei conci la dà il materiale
    const sb = (w, h, d, x, y, z, k) => (k ? darker(boxUV(w, h, d, x, y, z, 0.42), k) : boxUV(w, h, d, x, y, z, 0.42));
    const T = 0.34;
    GEO.muro_pietra = M.merge([sb(3, 3, T, 0, 1.5, 0), sb(3.06, 0.18, T + 0.06, 0, 0.09, 0, 0.82)]);
    GEO.muro_porta_pietra = M.merge([sb(1.05, 3, T, -0.975, 1.5, 0), sb(1.05, 3, T, 0.975, 1.5, 0), sb(0.9, 0.8, T, 0, 2.6, 0), sb(1.1, 0.16, T + 0.08, 0, 2.24, 0, 0.8)]);
    GEO.muro_finestra_pietra = M.merge([sb(3, 1.1, T, 0, 0.55, 0), sb(3, 0.8, T, 0, 2.6, 0), sb(0.9, 1.1, T, -1.05, 1.65, 0), sb(0.9, 1.1, T, 1.05, 1.65, 0), sb(1.36, 0.12, T + 0.14, 0, 1.12, 0.03, 0.8)]);
    GEO.pavimento_pietra = M.merge([sb(3, 0.3, 3, 0, -0.15, 0)]);
    GEO.tetto_pietra = GEO.tetto;
    { const st = []; for (let i = 0; i < 10; i++) st.push(sb(1.4, (i + 1) * 0.3, 0.3, 0, (i + 1) * 0.15, 1.5 - i * 0.3 - 0.15, i % 2 ? 0.92 : 1)); GEO.scala_pietra = M.merge(st); }
    GEO.pilastro = M.merge([sb(0.56, 0.2, 0.56, 0, 0.1, 0, 0.85), sb(0.46, 2.6, 0.46, 0, 1.5, 0), sb(0.56, 0.2, 0.56, 0, 2.9, 0, 0.85)]);
    GEO.camino = M.merge([sb(2.0, 0.25, 0.9, 0, 0.125, 0.15, 0.85), sb(0.4, 1.4, 0.9, -0.8, 0.95, 0.15), sb(0.4, 1.4, 0.9, 0.8, 0.95, 0.15), sb(2.0, 0.3, 0.9, 0, 1.8, 0.15, 0.9), sb(2.1, 0.14, 1.0, 0, 2.0, 0.17, 0.75),
      sb(1.2, 1.4, 0.2, 0, 0.95, -0.2, 0.6), sb(0.9, 1.0, 0.7, 0, 2.55, 0.05)]);
    { const body = new THREE.CylinderGeometry(0.55, 0.78, 1.5, 10, 1).translate(0, 0.75, 0); const top = new THREE.CylinderGeometry(0.2, 0.32, 0.5, 8, 1).translate(0, 1.75, 0);
      GEO.fornace = M.merge([M.colorize(body, 1, 1, 1), darker(M.colorize(top, 1, 1, 1), 0.8), sb(0.62, 0.1, 0.3, 0, 0.32, 0.66, 0.6)]);
      GEO.fornaceMouth = new THREE.PlaneGeometry(0.44, 0.38).translate(0, 0.55, 0.705); }
    // torcia a muro: staffa di ferro + manico inclinato verso l'esterno
    { const stick = M.colorize(new THREE.CylinderGeometry(0.035, 0.03, 0.7, 6).translate(0, 0.35, 0), 0.55, 0.38, 0.22); stick.rotateX(0.5); stick.translate(0, -0.1, 0.12);
      const head = M.colorize(new THREE.CylinderGeometry(0.06, 0.045, 0.14, 7).translate(0, 0.69, 0), 0.25, 0.18, 0.12); head.rotateX(0.5); head.translate(0, -0.1, 0.12);
      const br = M.colorize(new THREE.BoxGeometry(0.16, 0.05, 0.2).translate(0, 0.02, 0.07), 0.22, 0.22, 0.24), plate = M.colorize(new THREE.BoxGeometry(0.12, 0.22, 0.03).translate(0, 0.02, 0.0), 0.2, 0.2, 0.22);
      GEO.torciaMuro = M.merge([stick, head, br, plate]); }
  }
  const STONE = new Set(['muro_pietra', 'muro_porta_pietra', 'muro_finestra_pietra', 'pavimento_pietra', 'scala_pietra', 'pilastro', 'camino', 'fornace']);
  const kind = (t) => G.pieceKind(t);
  B.kind = kind;
  B.isStone = (t) => STONE.has(t) || t === 'tetto_pietra';

  /* ---------- fiamme ---------- */
  G.flameMaterial = function () {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      uniforms: { uTime: G.shared.uTime, uSeed: { value: Math.random() * 10 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy * vec2(1.0, 1.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime, uSeed; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ vec2 uv = vUv; float t = uTime*2.2 + uSeed;
          float nn = n(vec2(uv.x*4.0, uv.y*3.0 - t*1.6))*0.6 + n(vec2(uv.x*8.0, uv.y*6.0 - t*2.4))*0.4;
          float shape = 1.0 - length(vec2((uv.x-0.5)*2.2/(1.0-uv.y*0.75+0.1), (uv.y-0.25)*1.3));
          float f = clamp(shape + nn*0.6 - 0.45, 0.0, 1.0) * smoothstep(0.0, 0.08, uv.y);
          if (f < 0.06) discard; // fuori dalla fiamma niente profondità: niente rettangolo sull'acqua
          vec3 c = mix(vec3(1.0,0.25,0.05), vec3(1.0,0.75,0.25), smoothstep(0.1,0.6,f)); c = mix(c, vec3(1.0,0.97,0.8), smoothstep(0.6,0.95,f));
          gl_FragColor = vec4(c*3.5, f); }`,
    });
  };
  function flame(w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), G.flameMaterial()); m.renderOrder = 5; m.frustumCulled = false; return m; }

  /* ---------- pool di luci puntiformi (numero costante = niente ricompilazioni) ---------- */
  B.initLights = function (scene) {
    B.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff9a48, 0, 13, 2); l.castShadow = false; scene.add(l); B.lights.push(l); }
  };
  B.updateLights = function (player, t) {
    const srcs = [];
    for (const p of B.pieces) if (p.light) srcs.push(p);
    if (player.heldTorch) srcs.push({ lightPos: player.torchPos, power: player.torchPower || 0.85, held: true });
    srcs.sort((a, b) => a.lightPos.distanceToSquared(player.pos) - b.lightPos.distanceToSquared(player.pos));
    B.lights.forEach((l, i) => {
      const s = srcs[i];
      if (!s || s.lightPos.distanceTo(player.pos) > 60) { l.intensity = 0; return; }
      l.position.copy(s.lightPos);
      const fl = 0.85 + Math.sin(t * 13 + i) * 0.06 + Math.sin(t * 7.3 + i * 2) * 0.08;
      l.intensity = (s.power || 1) * fl * (s.held ? 0.9 : 1.6) * (0.3 + 0.7 * (1 - (G.Player.underground ? 0 : G.sky.day) * 0.85)) * (G.Player.underground ? 1.6 : 1);
    });
  };

  /* ---------- creazione pezzi ---------- */
  const FREE = new Set(['banco', 'falo', 'baule', 'letto', 'torcia', 'trappola', 'pilastro', 'camino', 'fornace']);
  B.isPlaceable = (id) => ['pavimento', 'muro', 'muro_porta', 'muro_finestra', 'porta', 'tetto', 'recinto', 'scala', 'banco', 'falo', 'baule', 'letto', 'torcia', 'trappola'].includes(id) || G.PIECE_KIND[id] !== undefined || ['pilastro', 'camino', 'fornace'].includes(id);

  function makeMesh(p) {
    const MAT = G.MAT;
    const g = new THREE.Group();
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (p.t === 'falo') {
      add(GEO.faloStones, MAT.rock); add(GEO.faloLogs, MAT.logs);
      const f1 = flame(0.7, 1.0), f2 = flame(0.5, 0.75); f2.position.set(0.12, 0, 0.05); f1.position.y = 0.12; f2.position.y = 0.12; g.add(f1, f2);
      p.light = true; p.lightPos = new V3(p.x, p.y + 0.8, p.z); p.power = 1.2;
    } else if (p.t === 'torcia' && p.wall) {
      // torcia a muro: la fiamma sporge in avanti rispetto alla parete
      add(GEO.torciaMuro, MAT.solid); const f = flame(0.25, 0.42); f.position.set(0, 0.52, 0.47); g.add(f);
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      p.light = true; p.lightPos = new V3(p.x + s * 0.5, p.y + 0.75, p.z + c * 0.5); p.power = 0.7;
    } else if (p.t === 'torcia') {
      add(GEO.torcia, MAT.solid); const f = flame(0.25, 0.42); f.position.y = 1.14; g.add(f);
      p.light = true; p.lightPos = new V3(p.x, p.y + 1.4, p.z); p.power = 0.7;
    } else if (p.t === 'camino') {
      const SM = G.Structures.mats(); add(GEO.camino, SM.stone); add(GEO.faloLogs, MAT.logs).position.set(0, 0.25, 0.2);
      const f1 = flame(0.8, 0.9), f2 = flame(0.55, 0.7); f1.position.set(0, 0.3, 0.22); f2.position.set(0.15, 0.3, 0.3); g.add(f1, f2);
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      p.light = true; p.lightPos = new V3(p.x + s * 0.6, p.y + 0.9, p.z + c * 0.6); p.power = 1.3;
    } else if (p.t === 'fornace') {
      const SM = G.Structures.mats(); add(GEO.fornace, SM.stone);
      const mouth = new THREE.Mesh(GEO.fornaceMouth, SM.glow.clone()); g.add(mouth); p.mouth = mouth;
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      p.light = true; p.lightPos = new V3(p.x + s * 0.9, p.y + 0.6, p.z + c * 0.9); p.power = 0.5;
    } else if (STONE.has(p.t)) {
      add(GEO[p.t], G.Structures.mats().stone);
    } else if (p.t === 'tetto_pietra') {
      add(GEO.tetto, G.Structures.mats().slate);
    } else if (p.t === 'porta') {
      p.hinge = new THREE.Group(); p.hinge.position.set(-0.475, 0, 0); g.add(p.hinge);
      const m = new THREE.Mesh(GEO.porta, MAT.planks); m.castShadow = true; m.receiveShadow = true; p.hinge.add(m);
      p.hinge.rotation.y = p.open ? -Math.PI / 2 : 0;
    } else add(GEO[p.t], MAT.planks);
    if (kind(p.t) === 'pavimento' && G.World.groundAt) {
      const stone = p.t !== 'pavimento';
      // pali di sostegno fino al terreno
      for (const [ox, oz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35], [0, 0]]) {
        const gy = G.World.groundAt(p.x + ox, p.z + oz);
        const len = p.y - 0.2 - gy + 0.4;
        if (len < 0.3) continue;
        const post = stone ? new THREE.Mesh(boxUV(0.4, len, 0.4, ox, -0.3 - len / 2, oz, 0.42), G.Structures.mats().stone) : new THREE.Mesh(M.colorize(new THREE.CylinderGeometry(0.11, 0.13, len, 7).translate(ox, -0.2 - len / 2, oz), 0.8, 0.72, 0.62), MAT.logs);
        post.castShadow = true; post.receiveShadow = true; g.add(post);
      }
    }
    g.position.set(p.x, p.y, p.z); g.rotation.y = p.rot;
    return g;
  }
  /* falda inclinata in coordinate locali dell'oggetto o (x, z, rot):
     axis = asse locale lungo cui sale ('x' o 'z'), [o0,o1] = estensione sull'altro asse,
     sale da yLow (in aLow) a yHigh (in aHigh). Con flags.shell diventa una lastra sottile (tetti). */
  B.slopeBox = function (o, axis, o0, o1, aLow, aHigh, yLow, yHigh, flags) {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const a of [aLow, aHigh]) for (const t of [o0, o1]) {
      const lx = axis === 'x' ? a : t, lz = axis === 'x' ? t : a;
      const wx = o.x + lx * c + lz * s, wz = o.z - lx * s + lz * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
    }
    const q = Math.round(o.rot / (Math.PI / 2)) & 3;
    // asse mondo corrispondente all'asse locale e conversione della coordinata
    let ax, conv;
    if (axis === 'z') { ax = q & 1 ? 'x' : 'z'; conv = (a) => (ax === 'z' ? o.z + a * c : o.x + a * s); }
    else { ax = q & 1 ? 'z' : 'x'; conv = (a) => (ax === 'x' ? o.x + a * c : o.z - a * s); }
    return Object.assign({ x0, x1, y0: yLow, y1: yHigh, z0, z1, slope: { ax, a0: conv(aLow), a1: conv(aHigh) } }, flags || {});
  };
  // quota della superficie di una falda nel punto (x,z)
  B.slopeTop = function (b, x, z) { const S = b.slope, v = S.ax === 'x' ? x : z; const t = G.clamp((v - S.a0) / (S.a1 - S.a0), 0, 1); return b.y0 + (b.y1 - b.y0) * t; };
  /* collisioni (AABB in coordinate mondo) */
  function rotBox(p, lx0, ly0, lz0, lx1, ly1, lz1, flags) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx0, lz1], [lx1, lz1]]) {
      const wx = p.x + lx * c + lz * s, wz = p.z - lx * s + lz * c;
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
    }
    return Object.assign({ x0, x1, y0: p.y + ly0, y1: p.y + ly1, z0, z1, piece: p }, flags || {});
  }
  function colliders(p) {
    const bx = [];
    switch (kind(p.t)) {
      case 'pilastro': bx.push(rotBox(p, -0.28, 0, -0.28, 0.28, WALL_H, 0.28, { walk: true })); break;
      case 'camino': bx.push(rotBox(p, -1.05, 0, -0.3, 1.05, 3.05, 0.0, { walk: true }), rotBox(p, -1.05, 0, -0.3, -0.6, 2.1, 0.6, { walk: true }), rotBox(p, 0.6, 0, -0.3, 1.05, 2.1, 0.6, { walk: true }), rotBox(p, -1.05, 1.65, -0.3, 1.05, 2.1, 0.67, { walk: true })); break;
      case 'fornace': bx.push(rotBox(p, -0.72, 0, -0.72, 0.72, 1.55, 0.72, { walk: true })); break;
      case 'pavimento': bx.push(rotBox(p, -1.5, -0.25, -1.5, 1.5, 0, 1.5, { walk: true })); break;
      case 'muro': bx.push(rotBox(p, -1.5, 0, -0.12, 1.5, WALL_H, 0.12, { walk: true })); break;
      case 'muro_finestra': bx.push(rotBox(p, -1.5, 0, -0.12, 1.5, WALL_H, 0.12, { walk: true })); break;
      case 'muro_porta': bx.push(rotBox(p, -1.5, 0, -0.12, -0.45, WALL_H, 0.12, { walk: true }), rotBox(p, 0.45, 0, -0.12, 1.5, WALL_H, 0.12, { walk: true }), rotBox(p, -1.5, 2.2, -0.12, 1.5, WALL_H, 0.12, { walk: true })); break;
      case 'porta': if (!p.open) bx.push(rotBox(p, -0.45, 0, -0.06, 0.45, 2.2, 0.06)); break;
      case 'recinto': bx.push(rotBox(p, -1.5, 0, -0.1, 1.5, 1.3, 0.1)); break;
      case 'scala': bx.push(rotBox(p, -0.75, 0, -1.5, 0.75, 3, 1.5, { ramp: true })); break;
      case 'banco': bx.push(rotBox(p, -0.8, 0, -0.42, 0.8, 1.0, 0.42, { walk: true })); break;
      case 'baule': case 'forziere': bx.push(rotBox(p, -0.45, 0, -0.28, 0.45, 0.65, 0.28, { walk: true })); break;
      case 'letto': bx.push(rotBox(p, -0.55, 0, -1.05, 0.55, 0.55, 1.05, { walk: true })); break;
      case 'falo': bx.push(rotBox(p, -0.5, 0, -0.5, 0.5, 0.3, 0.5, { soft: true })); break;
      case 'torcia': break;
      case 'trappola': bx.push(rotBox(p, -0.65, 0, -0.65, 0.65, 1.0, 0.65, { soft: true })); break;
      case 'tetto': bx.push(B.slopeBox(p, 'z', -1.65, 1.65, 1.65, -1.65, p.y - 0.05, p.y + 1.72, { shell: 0.32, piece: p })); break;
    }
    return bx;
  }
  // per selezionare un pezzo col mirino
  function pickBox(p) {
    if (p.t === 'porta') return rotBox(p, -0.5, 0, -0.15, 0.5, 2.25, 0.15);
    if (p.t === 'torcia' && p.wall) return rotBox(p, -0.15, -0.15, -0.05, 0.15, 0.85, 0.55);
    if (p.t === 'torcia') return rotBox(p, -0.15, 0, -0.15, 0.15, 1.4, 0.15);
    if (p.t === 'camino') return rotBox(p, -1.05, 0, -0.3, 1.05, 3.05, 0.67);
    if (p.t === 'falo') return rotBox(p, -0.55, 0, -0.55, 0.55, 0.9, 0.55);
    if (p.t === 'trappola') return rotBox(p, -0.66, 0, -0.66, 0.66, 1.1, 0.66);
    if (kind(p.t) === 'tetto') return rotBox(p, -1.6, -0.1, -1.6, 1.6, 1.8, 1.6);
    return colliders(p)[0] || rotBox(p, -0.5, 0, -0.5, 0.5, 1, 0.5);
  }

  B.add = function (data, silent) {
    const p = Object.assign({}, data);
    if (!p.id) p.id = Math.random().toString(36).slice(2, 10);
    if ((p.t === 'baule' || p.t === 'forziere') && !p.inv) p.inv = new Array(27).fill(null);
    if (p.t === 'falo' && !p.cook) p.cook = { in: null, out: null, prog: 0 };
    if (p.t === 'fornace' && !p.cook) p.cook = { in: null, out: null, fuel: null, prog: 0, burn: 0 };
    p.mesh = makeMesh(p);
    G.scene.add(p.mesh);
    p.boxes = colliders(p);
    p.pick = pickBox(p);
    B.pieces.push(p);
    if (!silent && G.Audio) G.Audio.place();
    B.reindex();
    return p;
  };
  B.remove = function (p) {
    G.scene.remove(p.mesh);
    B.pieces.splice(B.pieces.indexOf(p), 1);
    B.reindex();
  };
  B.refresh = function (p) { p.boxes = colliders(p); B.reindex(); };
  // collisioni extra (villaggi, fari, relitti…): impostate dal modulo Structures
  B.extra = [];
  B.reindex = function () { B.boxes = B.extra.slice(); for (const p of B.pieces) B.boxes.push(...p.boxes); };
  B.setExtra = function (list) { B.extra = list; B.reindex(); };
  B.byId = (id) => B.pieces.find((p) => p.id === id);
  B.serialize = () => B.pieces.filter((p) => !p.gen).map((p) => B.serializeOne(p));
  B.removeGen = function (pred) { const rm = B.pieces.filter((p) => p.gen && pred(p)); for (const p of rm) { G.scene.remove(p.mesh); B.pieces.splice(B.pieces.indexOf(p), 1); } if (rm.length) B.reindex(); };
  B.serializeOne = (p) => { { const o = { id: p.id, t: p.t, x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), rot: +p.rot.toFixed(4) }; if (p.inv) o.inv = p.inv; if (p.open) o.open = 1; if (p.cook) o.cook = p.cook; if (p.wall) o.wall = 1; return o; } };
  B.load = function (arr) { for (const p of B.pieces) G.scene.remove(p.mesh); B.pieces = []; for (const d of arr || []) B.add(d, true); };

  /* ---------- query fisiche ---------- */
  // superficie calpestabile più alta sotto (x,z) che non sia sopra i piedi + gradino
  B.groundAt = function (x, z, feetY, rad) {
    let best = -Infinity;
    const r = rad || 0;
    for (const b of B.boxes) {
      if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;
      if (b.roof || b.soft) continue;
      let top = b.y1;
      if (b.slope) {
        // rampa generica: lungo l'asse 'x' o 'z' sale da y0 (in a0) a y1 (in a1)
        const S = b.slope, v = S.ax === 'x' ? x : z;
        const t = G.clamp((v - S.a0) / (S.a1 - S.a0), 0, 1);
        top = b.y0 + (b.y1 - b.y0) * t;
      } else if (b.ramp) {
        const p = b.piece; const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const dx = x - p.x, dz = z - p.z; const lz = -dx * s + dz * c; // asse locale z
        if (Math.abs(dx * c - dz * s) > 0.8) continue;
        top = p.y + G.clamp((1.5 - lz), 0, 3);
      } else if (!b.walk) continue;
      if (top <= feetY + 0.6 && top > best) best = top;
    }
    return best;
  };
  B.collide = function (p, rad, height) {
    for (const b of B.boxes) {
      if (b.shell) {
        if (p.x < b.x0 - rad || p.x > b.x1 + rad || p.z < b.z0 - rad || p.z > b.z1 + rad) continue;
        const top = B.slopeTop(b, G.clamp(p.x, b.x0, b.x1), G.clamp(p.z, b.z0, b.z1));
        // corpo che attraversa la lastra (piedi sotto la superficie, testa sopra il lato inferiore): si torna fuori
        if (p.y < top - 0.45 && p.y + height > top - b.shell) {
          const opts = [[b.x0 - rad - p.x, 0], [b.x1 + rad - p.x, 0], [0, b.z0 - rad - p.z], [0, b.z1 + rad - p.z]];
          opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); p.x += opts[0][0]; p.z += opts[0][1];
        }
        continue;
      }
      if (b.ramp || b.soft || b.roof || b.slope) continue;
      if (p.y + height <= b.y0 + 0.02 || p.y >= b.y1 - 0.05) continue;
      const cx = G.clamp(p.x, b.x0, b.x1), cz = G.clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < rad * rad) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * rad; p.z = cz + (dz / d) * rad; }
        else { // dentro il box: esci dal lato più vicino
          const opts = [[b.x0 - rad - p.x, 0], [b.x1 + rad - p.x, 0], [0, b.z0 - rad - p.z], [0, b.z1 + rad - p.z]];
          opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
  };
  B.ceilingAt = function (x, z, headY, rad) {
    let best = Infinity;
    for (const b of B.boxes) {
      if (x < b.x0 - rad || x > b.x1 + rad || z < b.z0 - rad || z > b.z1 + rad) continue;
      if (b.shell) { const under = B.slopeTop(b, x, z) - b.shell; if (under >= headY - 0.3 && under < best) best = under; continue; }
      if (b.ramp || b.roof || b.soft || b.slope || b.climbOnly) continue;
      if (b.y0 >= headY - 0.3 && b.y0 < best) best = b.y0;
    }
    return best;
  };
  B.blocksPoint = function (x, y, z, r) {
    for (const b of B.boxes) { if (b.roof || b.soft || b.slope) continue; if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && y > b.y0 - 0.5 && y < b.y1) return true; }
    return false;
  };
  // pareti su cui arrampicarsi: restituisce il box davanti al giocatore (entro 0.2 m dal bordo)
  B.climbAt = function (p, rad, height, fx, fz) {
    for (const b of B.boxes) {
      if (!b.climb) continue;
      if (p.y > b.y1 - 0.05 || p.y + height < b.y0) continue;
      const cx = G.clamp(p.x, b.x0, b.x1), cz = G.clamp(p.z, b.z0, b.z1), dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz);
      if (d > rad + 0.2) continue;
      if (d > 1e-4 && (dx * fx + dz * fz) / d < 0.45) continue;
      return b;
    }
    return null;
  };
  // carro di fieno: chi ci cade dentro non si fa male
  B.inHay = function (x, y, z) { for (const b of B.boxes) if (b.hay && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.y1 + 0.6) return true; return false; };
  function rayBox(o, d, b) {
    let t0 = 0, t1 = 1e9;
    for (const [oa, da, a0, a1] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
      if (Math.abs(da) < 1e-9) { if (oa < a0 || oa > a1) return -1; continue; }
      let ta = (a0 - oa) / da, tb = (a1 - oa) / da; if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
    }
    return t0;
  }
  B.rayBox = rayBox;
  B.raycast = function (o, d, max) {
    let best = null, bt = max;
    for (const p of B.pieces) { const t = rayBox(o, d, p.pick); if (t >= 0 && t < bt) { bt = t; best = p; } }
    return best ? { piece: best, t: bt } : null;
  };

  /* ---------- anteprima e posizionamento ---------- */
  B.init = function (scene) {
    buildGeos();
    B.initLights(scene);
    B.holoOk = G.holoMaterial(0x7fe0ff); B.holoBad = G.holoMaterial(0xff5a4a);
    B.ghost = null; B.ghostType = null; B.rotStep = 0;
  };
  const solid = (x, y, z) => (G.Dig && G.Dig.activeAt(x, z) ? G.Dig.solidAt(x, y, z) : y < G.World.groundAt(x, z));
  const gAt = (x, z, yHint) => (G.Dig ? G.Dig.ground(x, z, yHint) : G.World.groundAt(x, z));
  function terrainHit(o, d, max) {
    let prev = 0;
    for (let t = 0.3; t <= max; t += 0.25) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (solid(x, y, z)) {
        let a = prev, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (solid(o.x + d.x * m, o.y + d.y * m, o.z + d.z * m)) b = m; else a = m; }
        return b;
      }
      prev = t;
    }
    return -1;
  }
  B.terrainHit = terrainHit;
  const snap = (v) => Math.floor(v / CELL) * CELL + CELL / 2;
  function supportY(x, z, hitY) {
    // prova ad agganciarsi a pavimenti / cime dei muri vicini
    let best = null, bd = 1.7;
    for (const p of B.pieces) {
      if (Math.abs(p.x - x) > CELL * 1.05 || Math.abs(p.z - z) > CELL * 1.05) continue;
      const kk = kind(p.t), ys = kk === 'pavimento' ? [p.y] : kk.startsWith('muro') || kk === 'pilastro' ? [p.y + WALL_H, p.y] : [];
      for (const y of ys) { const d = Math.abs(y - hitY); if (d < bd) { bd = d; best = y; } }
    }
    return best;
  }
  B.computePlacement = function (type0, o, d) {
    const MAXD = 7.5, type = kind(type0);
    let t = terrainHit(o, d, MAXD);
    const bh = B.raycast(o, d, MAXD);
    if (bh && (t < 0 || bh.t < t)) t = bh.t;
    if (t < 0) return null;
    const hx = o.x + d.x * t, hy = o.y + d.y * t, hz = o.z + d.z * t;
    const res = { t: type0, x: hx, y: hy, z: hz, rot: 0, ok: true, reason: '' };
    const yaw = G.Player.yaw;
    if (FREE.has(type)) {
      res.rot = Math.round((yaw + Math.PI) / (Math.PI / 4)) * (Math.PI / 4) + B.rotStep * Math.PI / 2;
      const top = B.groundAt(hx, hz, hy + 0.1, 0);
      res.y = Math.max(gAt(hx, hz, hy + 0.3), top);
    } else if (type === 'pavimento' || type === 'scala') {
      res.x = snap(hx); res.z = snap(hz);
      const sy = supportY(res.x, res.z, hy);
      if (sy !== null) res.y = sy;
      else { let m = -Infinity; for (const [ox, oz] of [[0, 0], [-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) m = Math.max(m, gAt(res.x + ox, res.z + oz, hy + 0.3)); res.y = m + (type === 'pavimento' ? 0.25 : 0); }
      res.rot = (type === 'scala' ? Math.round(yaw / (Math.PI / 2)) + B.rotStep : 0) * (Math.PI / 2);
      if (type === 'scala' && sy !== null) res.y = sy;
    } else if (type === 'porta') {
      // si aggancia al vano del muro con porta più vicino
      let best = null, bd = 2.5;
      for (const p of B.pieces) if (kind(p.t) === 'muro_porta') { const dd = Math.hypot(p.x - hx, p.y + 1.2 - hy, p.z - hz); if (dd < bd) { bd = dd; best = p; } }
      if (!best) { res.ok = false; res.reason = 'Mira un muro con porta'; }
      else {
        Object.assign(res, { x: best.x, y: best.y, z: best.z, rot: best.rot });
        if (B.pieces.some((p) => p.t === 'porta' && Math.hypot(p.x - best.x, p.z - best.z) < 0.1 && Math.abs(p.y - best.y) < 0.1)) { res.ok = false; res.reason = 'C’è già una porta'; }
      }
      return res;
    } else if (type === 'tetto') {
      res.x = snap(hx); res.z = snap(hz);
      let y = null;
      for (const p of B.pieces) if (kind(p.t).startsWith('muro') && Math.abs(p.x - res.x) <= 1.6 && Math.abs(p.z - res.z) <= 1.6) y = Math.max(y === null ? -Infinity : y, p.y + WALL_H);
      if (y === null) { const sy = supportY(res.x, res.z, hy); y = sy !== null ? sy + WALL_H : G.World.groundAt(res.x, res.z) + WALL_H; }
      res.y = y; res.rot = (Math.round(yaw / (Math.PI / 2)) + B.rotStep) * (Math.PI / 2);
    } else {
      // muri e recinti: si allineano al bordo di cella più vicino
      const cx = snap(hx), cz = snap(hz), fx = hx - cx, fz = hz - cz;
      if (Math.abs(fx) > Math.abs(fz)) { res.x = cx + Math.sign(fx) * 1.5; res.z = cz; res.rot = Math.PI / 2; }
      else { res.x = cx; res.z = cz + Math.sign(fz) * 1.5; res.rot = 0; }
      const sy = supportY(res.x, res.z, hy);
      if (sy !== null) res.y = sy;
      else { const c = Math.cos(res.rot), s = Math.sin(res.rot); res.y = Math.max(G.World.groundAt(res.x + c * 1.4, res.z - s * 1.4), G.World.groundAt(res.x - c * 1.4, res.z + s * 1.4), G.World.groundAt(res.x, res.z)) + 0.05; if (type === 'recinto') res.y -= 0.1; }
    }
    // validità
    const ground = G.World.groundAt(res.x, res.z);
    const onPiece = B.groundAt(res.x, res.z, res.y + 0.05, 0.2) > -Infinity;
    if (ground < 0.1 && !onPiece && res.y < 0.4) { res.ok = false; res.reason = 'Non si può costruire in acqua'; }
    const dup = B.pieces.find((p) => kind(p.t) === type && Math.abs(p.x - res.x) < 0.2 && Math.abs(p.z - res.z) < 0.2 && Math.abs(p.y - res.y) < 0.3 && (FREE.has(type) || Math.abs(Math.cos(p.rot - res.rot)) > 0.9));
    if (dup) { res.ok = false; res.reason = 'Spazio occupato'; }
    if (FREE.has(type) && type === 'camino') {
      // il camino si appoggia col retro al muro che guardi
      const wh = B.raycast(o, d, MAXD);
      if (wh && kind(wh.piece.t).startsWith('muro')) { const w = wh.piece, c = Math.cos(w.rot), sn = Math.sin(w.rot), nx = sn, nz = c, side = Math.sign((o.x - w.x) * nx + (o.z - w.z) * nz) || 1;
        res.x = hx + nx * side * 0.32; res.z = hz + nz * side * 0.32; res.y = w.y; res.rot = Math.atan2(nx * side, nz * side); }
    }
    if (FREE.has(type)) {
      const pl = G.Player.pos; if (Math.hypot(pl.x - res.x, pl.z - res.z) < 0.6 && type !== 'torcia') { res.ok = false; res.reason = 'Troppo vicino'; }
    }
    return res;
  };
  // torcia: si piazza subito dove guardi; su una parete (muro, roccia, galleria) si attacca al muro
  B.placeTorch = function (o, d) {
    const MAXD = 6;
    let t = terrainHit(o, d, MAXD), piece = null;
    const bh = B.raycast(o, d, MAXD);
    if (bh && (t < 0 || bh.t < t)) { t = bh.t; piece = bh.piece; }
    if (t < 0) return { ok: false, reason: 'Mira il terreno o un muro più vicino' };
    const hx = o.x + d.x * t, hy = o.y + d.y * t, hz = o.z + d.z * t;
    let nx = 0, ny = 1, nz = 0;
    if (piece) {
      const k = kind(piece.t);
      if (k.startsWith('muro') || k === 'pilastro' || k === 'camino') { const c = Math.cos(piece.rot), s = Math.sin(piece.rot); let ax = s, az = c; if (k === 'pilastro') { ax = -d.x; az = -d.z; } const side = Math.sign(-(d.x * ax + d.z * az)) || 1; nx = ax * side; nz = az * side; ny = 0;
        if (k === 'pilastro') { const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; } }
      else if (hy < piece.pick.y1 - 0.05) { nx = -d.x; nz = -d.z; ny = 0; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; }
    } else {
      // normale della superficie (terreno o parete di una galleria) dai punti pieni intorno
      let gx = 0, gy = 0, gz = 0; const e = 0.35;
      for (const [ax, ay, az] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!solid(hx + ax * e, hy + ay * e, hz + az * e)) { gx += ax; gy += ay; gz += az; }
      const l = Math.hypot(gx, gy, gz); if (l > 0) { nx = gx / l; ny = gy / l; nz = gz / l; }
    }
    const pl = G.Player.pos;
    if (ny > 0.6) {
      const y = piece ? B.groundAt(hx, hz, hy + 0.1, 0) : gAt(hx, hz, hy + 0.3);
      return { ok: true, t: 'torcia', x: hx, y: y > -Infinity ? y : hy, z: hz, rot: G.Player.yaw + Math.PI };
    }
    if (ny < -0.6) return { ok: false, reason: 'Non si attacca al soffitto: mira il pavimento o una parete' };
    const hl = Math.hypot(nx, nz) || 1; nx /= hl; nz /= hl;
    if (Math.hypot(pl.x - hx, pl.z - hz) < 0.25) return { ok: false, reason: 'Troppo vicino' };
    return { ok: true, t: 'torcia', wall: 1, x: hx + nx * 0.02, y: hy - 0.3, z: hz + nz * 0.02, rot: Math.atan2(nx, nz) };
  };
  B.updateGhost = function (type, o, d) {
    if (!type) { if (B.ghost) { G.scene.remove(B.ghost); B.ghost = null; B.ghostType = null; } return null; }
    if (B.ghostType !== type) {
      if (B.ghost) G.scene.remove(B.ghost);
      const p = { t: type, x: 0, y: 0, z: 0, rot: 0 };
      B.ghost = makeMesh(p);
      B.ghost.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.userData.isFlame = m.material.type === 'ShaderMaterial' && !!m.material.uniforms.uSeed; } });
      G.scene.add(B.ghost); B.ghostType = type;
    }
    const pl = B.computePlacement(type, o, d);
    if (!pl) { B.ghost.visible = false; return null; }
    B.ghost.visible = true;
    B.ghost.position.set(pl.x, pl.y, pl.z); B.ghost.rotation.y = pl.rot;
    const mat = pl.ok ? B.holoOk : B.holoBad;
    B.ghost.traverse((m) => { if (m.isMesh && !m.userData.isFlame) m.material = mat; });
    return pl;
  };

  /* ---------- oggetti a terra (uova) ---------- */
  B.dropPickup = function (id, x, y, z) {
    const m = new THREE.Mesh(GEO.egg, G.MAT.solid); m.position.set(x, y + 0.05, z); m.castShadow = true;
    G.scene.add(m); B.pickups.push({ id, mesh: m, t: 0 });
  };
  B.update = function (dt, player, t) {
    for (let i = B.pickups.length - 1; i >= 0; i--) {
      const p = B.pickups[i]; p.t += dt;
      if (p.mesh.position.distanceTo(player.pos) < 1.4) { player.give(p.id, 1); G.scene.remove(p.mesh); B.pickups.splice(i, 1); }
      else if (p.t > 600) { G.scene.remove(p.mesh); B.pickups.splice(i, 1); }
    }
    // porte animate e cottura sul falò
    for (const p of B.pieces) {
      if (p.hinge) { const tgt = p.open ? -Math.PI / 2 : 0; p.hinge.rotation.y += (tgt - p.hinge.rotation.y) * Math.min(1, dt * 8); }
      if (p.t === 'fornace') { smelt(p, dt); continue; }
      if (p.cook && p.cook.in) {
        const raw = p.cook.in.id, out = G.COOK[raw];
        if (out && (!p.cook.out || (p.cook.out.id === out && p.cook.out.n < 64))) {
          p.cook.prog += dt / 5;
          if (p.cook.prog >= 1) {
            p.cook.prog = 0; p.cook.in.n--; if (p.cook.in.n <= 0) p.cook.in = null;
            if (p.cook.out) p.cook.out.n++; else p.cook.out = { id: out, n: 1 };
            if (G.UI.onCookTick) G.UI.onCookTick(p);
          }
        } else p.cook.prog = 0;
        if (Math.random() < dt * 4) G.FX.burst(p.x, p.y + 0.6, p.z, [0.35, 0.33, 0.32], 1, 0.3, { g: -0.8, size: 2.5 });
      }
      if (p.t === 'falo' && Math.random() < dt * 6) G.FX.burst(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.4, p.z + (Math.random() - 0.5) * 0.3, [1.6, 0.6, 0.15], 1, 0.6, { g: -1.5, size: 0.5 });
    }
    B.updateLights(player, t);
  };
  // fornace: un minerale ogni 6 secondi; il combustibile si consuma un pezzo alla volta
  function smelt(p, dt) {
    const c = p.cook, out = c.in && G.SMELT[c.in.id];
    const can = out && (!c.out || (c.out.id === out && c.out.n < 64));
    if (can && c.burn <= 0 && c.fuel && G.SMELT_FUEL[c.fuel.id]) { c.burn += G.SMELT_FUEL[c.fuel.id]; c.fuel.n--; if (c.fuel.n <= 0) c.fuel = null; }
    const on = can && c.burn > 0;
    if (on) {
      c.prog += dt / 6;
      if (c.prog >= 1) {
        c.prog = 0; c.burn -= 1; c.in.n--; if (c.in.n <= 0) c.in = null;
        if (c.out) c.out.n++; else c.out = { id: out, n: 1 };
        if (G.UI.onCookTick) G.UI.onCookTick(p);
      }
      if (Math.random() < dt * 3) G.FX.burst(p.x, p.y + 2.05, p.z, [0.3, 0.29, 0.28], 1, 0.4, { g: -1.2, size: 3 });
    } else c.prog = Math.max(0, c.prog - dt * 0.05);
    const k = on ? 1 : c.burn > 0 ? 0.4 : 0.05;
    p.glow = (p.glow || 0) + (k - (p.glow || 0)) * Math.min(1, dt * 2);
    if (p.mouth) p.mouth.material.emissiveIntensity = p.glow * 2.2;
    p.power = 0.15 + p.glow * 0.7;
  }
  B.WALL_H = WALL_H;
})();
