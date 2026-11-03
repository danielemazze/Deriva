/* =========================================================
   Atmosfera (con «Shaders» attivi): pulviscolo che brilla nei
   raggi di sole, pollini nei prati, lucciole di notte, particelle
   sospese sott'acqua. Tutto intorno alla camera, leggero.
   ========================================================= */
(function () {
  const AT = (G.Atmo = {});
  const N = 700, R = 16;
  let pts = null, mat = null, pos = null, seed = null;
  function init() {
    const g = new THREE.BufferGeometry();
    pos = new Float32Array(N * 3); seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * R; pos[i * 3 + 1] = (Math.random() * 2 - 1) * R * 0.5; pos[i * 3 + 2] = (Math.random() * 2 - 1) * R;
      seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random(); seed[i * 4 + 2] = Math.random(); seed[i * 4 + 3] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: G.shared.uTime, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        uDay: { value: 1 }, uUnder: { value: 0 }, uFire: { value: 0 }, uPollen: { value: 0 }, uWind: G.shared.uWind, uPx: { value: 1 } },
      vertexShader: `
        attribute vec4 aSeed; uniform float uTime, uDay, uUnder, uFire, uPollen, uWind, uPx; uniform vec3 uCam, uSun;
        varying float vA; varying vec3 vC; varying float vKind;
        void main(){
          float R = ${R.toFixed(1)};
          // ogni particella vaga lenta; le coordinate si avvolgono intorno alla camera (sempre piene, mai finite)
          vec3 drift = vec3(sin(uTime*0.13 + aSeed.x*40.0)*1.4 + uTime*0.25*uWind, sin(uTime*0.09 + aSeed.y*30.0)*0.8 + uTime*(aSeed.w-0.4)*0.05, cos(uTime*0.11 + aSeed.z*50.0)*1.4 + uTime*0.12*uWind);
          vec3 p = position + drift;
          p = mod(p - uCam + vec3(R, R*0.5, R), vec3(2.0*R, R, 2.0*R)) - vec3(R, R*0.5, R) + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vec3 V = normalize(p - uCam);
          // controluce: il pulviscolo si accende guardando verso il sole
          float back = pow(max(dot(V, uSun), 0.0), 5.0);
          float kind = aSeed.w; vKind = kind;
          float fade = smoothstep(R, R*0.55, length(p - uCam)) * smoothstep(0.3, 1.2, d);
          float size; vec3 c; float a;
          if (uUnder > 0.5) { size = 0.035; c = vec3(0.55, 0.85, 0.9); a = 0.35; }
          else if (uFire > 0.01 && kind > 0.86) {
            // lucciole: lampeggiano, solo alcune
            float bl = pow(max(sin(uTime*(1.2 + aSeed.x*1.8) + aSeed.y*20.0), 0.0), 6.0);
            size = 0.11; c = vec3(0.75, 1.0, 0.35); a = bl * uFire * 1.6;
          } else if (uPollen > 0.01 && kind > 0.7) { size = 0.07; c = vec3(1.0, 0.97, 0.85); a = (0.4 + back * 1.8) * uPollen * uDay; }
          else { size = 0.03; c = vec3(1.0, 0.92, 0.75); a = (0.12 + back * 2.4) * uDay; }
          vA = a * fade; vC = c;
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(size * uPx / d, 1.0, 22.0);
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC; varying float vKind;
        void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; float a = (1.0 - r); if (a <= 0.0) discard; gl_FragColor = vec4(vC * a * a * vA, 1.0); }`,
    });
    pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5;
    G.scene.add(pts);
  }
  AT.update = function (dt, P, S) {
    const on = !!(G.settings.shaders && G.started);
    if (!on) { if (pts) pts.visible = false; return; }
    if (!pts) init();
    pts.visible = true;
    const u = mat.uniforms, cam = P.cam || G.camera;
    u.uCam.value.copy(cam ? cam.getWorldPosition(u.uCam.value) : P.pos);
    if (S && S.sun) u.uSun.value.copy(S.sun);
    const day = S ? G.smooth(-0.05, 0.2, S.sun.y) : 1;
    u.uDay.value = day; u.uUnder.value = P.under ? 1 : 0;
    const wc = G.Climate && G.Climate.cur ? G.Climate.cur : null, rain = wc ? (wc.rain || 0) : 0;
    u.uFire.value = (1 - day) * (1 - rain) * (P.pos.y > G.SEA + 1 ? 1 : 0);
    // pollini sui prati e nei boschi (non in mare aperto né sulla neve)
    const g = G.World && G.World.groundAt ? G.World.groundAt(P.pos.x, P.pos.z) : 0;
    u.uPollen.value = g > G.SEA + 1.5 ? (1 - rain) : 0;
    u.uPx.value = (G.rtSize ? G.rtSize[1] : innerHeight) * 0.9;
  };
})();
