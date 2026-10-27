'use strict';
/* ==========================================================
   Rendering: cielo, luci, oceano, materiali, post-processing
   ========================================================== */
(function () {
  const G = globalThis.G;

  /* ---------------- ONDE (CPU + GPU condivise) ---------------- */
  G.WAVES = [
    [1.0, 0.25, 0.20, 36], [0.55, 0.85, 0.17, 22], [-0.45, 1.0, 0.15, 13.5],
    [0.92, -0.45, 0.13, 8.2], [0.15, -1.0, 0.10, 5.1], [-0.8, -0.6, 0.07, 3.3],
  ].map(([x, z, q, L]) => { const l = Math.hypot(x, z); const k = (2 * Math.PI) / L; return { dx: x / l, dz: z / l, q, k, c: Math.sqrt(9.8 / k), a: q / k }; });
  G.waveAmp = 0.5;
  /* vento: livello 0 (bonaccia) … 10 (burrasca). Decide onde, schiuma, vele e vegetazione. */
  G.WIND = { level: 4, dir: 0.6 };
  G.windAmp = (lv) => [0.015, 0.08, 0.17, 0.27, 0.4, 0.55, 0.72, 0.92, 1.15, 1.42, 1.75][Math.max(0, Math.min(10, Math.round(lv)))];
  G.setWind = function (lv) {
    G.WIND.level = Math.max(0, Math.min(10, Math.round(lv)));
  };
  // avvicina gradualmente il mare al livello scelto (niente onde che saltano di colpo)
  G.updateWind = function (dt) {
    const eff = G.Climate ? G.Climate.windLevel() : G.WIND.level;
    // tra i ghiacci il mare è quasi piatto
    const cold = G.coldAt && G.Player ? G.coldAt(G.Player.pos.x, G.Player.pos.z) : 0;
    const target = G.windAmp(eff) * (1 - cold * 0.8);
    G.waveAmp += (target - G.waveAmp) * Math.min(1, dt * 0.35);
    const lv = eff / 10;
    G.shared.uWind.value += (0.08 + lv * 1.9 - G.shared.uWind.value) * Math.min(1, dt * 0.5);
  };
  G.waveDisp = function (x, z, t, out) {
    let px = 0, py = 0, pz = 0;
    for (const w of G.WAVES) {
      const f = w.k * (w.dx * x + w.dz * z) - w.c * w.k * t;
      const A = w.a * G.waveAmp, cf = Math.cos(f);
      px += w.q * A * w.dx * cf; pz += w.q * A * w.dz * cf; py += A * Math.sin(f);
    }
    out[0] = px; out[1] = py; out[2] = pz; return out;
  };
  const _d = [0, 0, 0];
  G.waveHeight = function (x, z, t) {
    // inverte approssimativamente lo spostamento orizzontale
    let sx = x, sz = z;
    for (let i = 0; i < 2; i++) { G.waveDisp(sx, sz, t, _d); sx = x - _d[0]; sz = z - _d[2]; }
    G.waveDisp(sx, sz, t, _d);
    return G.SEA + _d[1] - (G.Climate ? G.Climate.dip(x, z) : 0);
  };

  /* ---------------- GLSL condiviso ---------------- */
  const GLSL_WAVES = () => {
    let s = 'uniform float uWaveAmp;\nvec3 gerstner(vec2 p, float t, out vec3 nrm){ vec3 d=vec3(0.); vec3 n=vec3(0.,1.,0.); float f; float A;\n';
    for (const w of G.WAVES) {
      const v = (x) => x.toFixed(5);
      s += `f=${v(w.k)}*dot(vec2(${v(w.dx)},${v(w.dz)}),p)-${v(w.c * w.k)}*t; A=${v(w.a)}*uWaveAmp;
      d.x+=${v(w.q)}*A*${v(w.dx)}*cos(f); d.z+=${v(w.q)}*A*${v(w.dz)}*cos(f); d.y+=A*sin(f);
      n.x-=${v(w.dx)}*${v(w.k)}*A*cos(f); n.z-=${v(w.dz)}*${v(w.k)}*A*cos(f); n.y-=${v(w.q)}*${v(w.k)}*A*sin(f);\n`;
    }
    s += 'nrm=normalize(n); return d; }\n';
    return s;
  };
  G.GLSL_CAUSTIC = `
  float causticF(vec2 p, float time){
    p *= 0.32; float t = time*0.55; vec2 i = p; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 3; n++) {
      float tt = t * (1.0 - (3.5 / float(n+1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0/length(vec2(p.x / (sin(i.x+tt)/inten), p.y / (cos(i.y+tt)/inten)));
    }
    c /= 3.0; c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 6.0) * 1.6, 0.0, 3.0);
  }`;

  /* ---------------- PATCH DEI MATERIALI ----------------
     aggiunge: posizione mondo, vento, caustiche, assorbimento subacqueo */
  G.shared = { uTime: { value: 0 }, uSunInt: { value: 1 }, uWind: { value: 1 }, uWaterY: { value: 0 }, uCamPos: { value: new THREE.Vector3() }, uGrassDist: { value: 60 }, uWet: { value: 0 }, uDry: { value: 0 } };
  G.patch = function (mat, opt) {
    opt = opt || {};
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = G.shared.uTime; sh.uniforms.uSunInt = G.shared.uSunInt; sh.uniforms.uWind = G.shared.uWind;
      sh.uniforms.uWaterY = G.shared.uWaterY; sh.uniforms.uCamPos = G.shared.uCamPos; sh.uniforms.uGrassDist = G.shared.uGrassDist; sh.uniforms.uWet = G.shared.uWet; sh.uniforms.uDry = G.shared.uDry;
      if (opt.terrain) { Object.assign(sh.uniforms, opt.terrain); if (G.Dig) Object.assign(sh.uniforms, G.Dig.U); }
      let vs = sh.vertexShader, fs = sh.fragmentShader;
      vs = 'varying vec3 vWPos; varying vec3 vWN; uniform float uTime; uniform float uWind; uniform vec3 uCamPos; uniform float uGrassDist;\n' + vs;
      let windCode = '';
      if (opt.wind) {
        const w = opt.wind; // {amp, freq, mode}
        windCode = `
        {
          #ifdef USE_INSTANCING
            vec4 _wp0 = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
          #else
            vec4 _wp0 = modelMatrix * vec4(0.,0.,0.,1.);
          #endif
          float ph = _wp0.x*0.21 + _wp0.z*0.17;
          float h = max(transformed.y, 0.0);
          float gust = 0.6 + 0.4*sin(uTime*0.35 + _wp0.x*0.02);
          float sway = (sin(uTime*${w.freq.toFixed(2)} + ph) * 0.6 + sin(uTime*${(w.freq * 2.3).toFixed(2)} + ph*1.7)*0.25) * gust * uWind;
          float k = ${w.amp.toFixed(3)} * ${w.mode === 'tip' ? 'h*h' : w.mode === 'kelp' ? 'h' : 'h'};
          transformed.x += sway * k;
          transformed.z += cos(uTime*${(w.freq * 0.8).toFixed(2)} + ph*1.3) * k * 0.6 * gust * uWind;
          ${w.flutter ? `transformed.y += sin(uTime*7.0 + position.x*4.0 + position.z*3.0 + ph) * ${w.flutter.toFixed(3)} * h * uWind;` : ''}
          ${opt.fadeDist ? `float _cd = distance(_wp0.xyz, uCamPos); transformed *= 1.0 - smoothstep(uGrassDist*0.75, uGrassDist, _cd);` : ''}
        }`;
      }
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + windCode + (opt.terrain ? '\n vBio = aBio; vBio2 = aBio2;' : ''));
      if (opt.terrain) vs = 'attribute vec4 aBio; varying vec4 vBio; attribute vec3 aBio2; varying vec3 vBio2;\n' + vs;
      vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);
      const fsHead = 'varying vec3 vWPos; varying vec3 vWN; uniform float uTime; uniform float uSunInt; uniform float uWaterY; uniform float uWet; uniform float uDry;\n' + G.GLSL_CAUSTIC + '\n';
      if (opt.terrain) {
        fs = fsHead + 'varying vec4 vBio; varying vec3 vBio2;\nuniform sampler2D tSand; uniform sampler2D tSandN; uniform sampler2D tRock; uniform sampler2D tRockN; uniform sampler2D tDirt; uniform sampler2D tDirtN; uniform sampler2D tSea; uniform sampler2D tSeaN; uniform float uDual; uniform float uPhoto; uniform vec4 uDig[48]; uniform int uDigN;\n' + `
        float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(tHash(i), tHash(i+vec2(1,0)), f.x), mix(tHash(i+vec2(0,1)), tHash(i+vec2(1,1)), f.x), f.y); }
        vec4 terrainW4(out float under, out float snowW){
          float h = vWPos.y; float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
          float nz = sin(vWPos.x*0.09)*sin(vWPos.z*0.11)*0.6 + sin(vWPos.x*0.31+vWPos.z*0.27)*0.3;
          float des = vBio.x, mnt = vBio.w;
          float sand = 1.0 - smoothstep(1.7 + nz, 2.6 + nz, h);
          // pendii: roccia solo dove è davvero ripido (nei biomi verdi la vegetazione tiene anche le scarpate)
          float lushK = (1.0 - des) * (0.5 + vBio.y * 0.5);
          float rock = smoothstep(0.30 + des*0.12 + lushK*0.16, 0.48 + des*0.12 + lushK*0.18, slope + nz*0.04);
          rock = max(rock, smoothstep(26.0 + mnt*10.0, 30.0 + mnt*11.0, h + nz*2.0) * (1.0 - des));
          rock *= (1.0 - sand*0.8);
          float grass = max(0.0, 1.0 - sand - rock);
          float dn = tNoise(vWPos.xz*0.045) * 0.65 + tNoise(vWPos.xz*0.17) * 0.35;
          float dirt = grass * (smoothstep(0.62, 0.8, dn) + smoothstep(3.4, 2.4, h) * 0.7 + vBio.z * 0.25 * smoothstep(0.4, 0.7, dn));
          dirt = min(dirt, grass); grass -= dirt;
          // deserto: tutto sabbia
          sand += (grass + dirt) * des; grass *= 1.0 - des; dirt *= 1.0 - des;
          under = smoothstep(-0.6, -2.2, h);
          // neve sulle cime, non sui pendii più ripidi
          snowW = smoothstep(46.0, 53.0, h + nz*3.0 + tNoise(vWPos.xz*0.08)*3.0) * (1.0 - smoothstep(0.5, 0.75, slope));
          // biomi freddi: tutto innevato tranne le pareti ripide e la battigia
          snowW = max(snowW, smoothstep(0.35, 0.8, vBio2.x + nz * 0.15) * (1.0 - smoothstep(0.55, 0.8, slope)) * smoothstep(0.4, 1.4, h));
          vec4 w = vec4(grass, sand, rock, dirt); return w / (w.x + w.y + w.z + w.w + 1e-4);
        }
        // due campionamenti a scale e orientamenti diversi: niente ripetizione evidente
        vec4 tri(sampler2D t, vec2 uv){ vec4 a = texture2D(t, uv); if (uDual < 0.5) return a; vec2 r = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.317 + vec2(0.37, 0.11); return mix(a, texture2D(t, r), 0.45); }
        ` + fs;
      } else fs = fsHead + fs;
      if (opt.terrain) {
        // dove si è scavato il terreno normale sparisce (lo sostituisce la galleria)
        fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          for (int i = 0; i < 48; i++) { if (i >= uDigN) break; vec4 ds = uDig[i]; vec3 dd = vWPos - ds.xyz; if (dot(dd, dd) < ds.w * ds.w) discard; }`);
        fs = fs.replace('#include <map_fragment>', `
          float tUnder, tSnow;
          vec4 tw = terrainW4(tUnder, tSnow);
          vec2 tp = vWPos.xz;
          vec2 uvG = tp * 0.42, uvS = tp * 0.33, uvR = vec2(tp.x + vWPos.y * 0.35, tp.y + vWPos.y * 0.2) * 0.22, uvD = tp * 0.3, uvW = tp * 0.14;
          vec4 cg = tri(map, uvG), cs = tri(tSand, uvS), cr = tri(tRock, uvR), cd = tri(tDirt, uvD);
          vec4 cw = tri(tSea, uvW);
          // tinte di bioma: giungla e foresta pluviale più scure e sature, prateria più gialla, deserto più caldo
          cg.rgb *= mix(vec3(1.0), vec3(0.68, 0.86, 0.58), vBio.y) * mix(vec3(1.0), vec3(1.14, 1.06, 0.74), vBio.z);
          cg.rgb = mix(cg.rgb, cg.rgb * vec3(1.3, 1.08, 0.52), uDry * 0.75);
          // sottobosco: tappeto di muschio verde-giallo sotto le chiome
          float canopy = vBio2.z;
          cg.rgb = mix(cg.rgb, cg.rgb * vec3(0.78, 1.05, 0.42) + vec3(0.012, 0.03, 0.0), canopy * 0.55);
          cs.rgb *= mix(vec3(1.0), vec3(1.1, 0.96, 0.8), vBio.x);
          cr.rgb *= mix(vec3(1.0), vec3(1.2, 0.95, 0.74), vBio.x);
          cs = mix(cs, cw * vec4(1.05, 1.0, 0.92, 1.0), tUnder);
          vec4 tcol = cg*tw.x + cs*tw.y + cr*tw.z + cd*tw.w;
          // variazione su larga scala: macchie più secche, più verdi, più scure
          float mv = tNoise(tp * 0.012) * 0.6 + tNoise(tp * 0.05) * 0.4;
          tcol.rgb *= mix(0.86, 1.1, mv);
          tcol.rgb = mix(tcol.rgb, tcol.rgb * vec3(1.15, 1.05, 0.72), smoothstep(0.55, 0.85, tNoise(tp * 0.02 + 7.0)) * tw.x * 0.6);
          float wet = max(smoothstep(1.1, 0.2, vWPos.y) * tw.y * (1.0 - tUnder), uWet * 0.55 * (1.0 - tSnow));
          tcol.rgb *= mix(1.0, 0.6, wet);
          tcol.rgb = mix(tcol.rgb, vec3(0.9, 0.93, 0.97) * (0.92 + tNoise(tp * 0.6) * 0.1), tSnow);
          // boschi lontani: dove ci sono alberi il colpo d'occhio è verde scuro (le chiome che non si disegnano più)
          { float cd = length(vWPos - cameraPosition), farK = smoothstep(110.0, 240.0, cd) * canopy * (1.0 - tw.z) * (1.0 - tSnow);
            vec3 cc = mix(vec3(0.035, 0.07, 0.022), vec3(0.06, 0.1, 0.03), tNoise(tp * 0.07)) * mix(1.0, 0.75, vBio.y);
            tcol.rgb = mix(tcol.rgb, cc, farK * 0.85); }
          // vulcano: cenere scura e basalto
          float ashW = vBio2.y * (1.0 - tUnder);
          vec3 ash = mix(vec3(0.03, 0.028, 0.027), vec3(0.075, 0.058, 0.046), tNoise(tp * 0.11)) * (0.6 + cr.rgb * 0.8);
          tcol.rgb = mix(tcol.rgb, ash, smoothstep(0.02, 0.22, ashW) * (1.0 - tSnow * 0.7));
          diffuseColor *= tcol;`);
        fs = fs.replace('vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;', `
          vec3 nS = mix(tri(tSandN, uvS).xyz, tri(tSeaN, uvW).xyz, tUnder);
          vec3 mapN = (tri(normalMap, uvG).xyz*tw.x + nS*tw.y + tri(tRockN, uvR).xyz*tw.z + tri(tDirtN, uvD).xyz*tw.w) * 2.0 - 1.0;
          mapN = mix(mapN, vec3(0.0, 0.0, 1.0), tSnow * 0.7);`);
        fs = fs.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.3, wet);');
        // crepe di lava incandescente vicino al cratere
        fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { float lv = smoothstep(0.86, 0.97, vBio2.y);
            if (lv > 0.0) { float cn = 1.0 - abs(tNoise(vWPos.xz * 0.23) * 2.0 - 1.0); float crack = smoothstep(0.955, 0.99, cn) * lv * smoothstep(0.35, 0.6, tNoise(vWPos.xz * 0.05));
              totalEmissiveRadiance += vec3(1.0, 0.3, 0.04) * crack * (1.6 + 0.5 * sin(uTime * 1.7 + vWPos.x * 0.3)); } }`);
      }
      if (opt.moss) {
        // muschio e licheni sulle facce rivolte verso l'alto (non sott'acqua)
        fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 mp = vWPos.xz * 1.3 + vWPos.y * 0.7;
            float mn = fract(sin(dot(floor(mp), vec2(12.9898, 78.233))) * 43758.5453);
            float mn2 = sin(vWPos.x * 2.7 + vWPos.z * 1.9) * sin(vWPos.z * 3.1 - vWPos.y * 2.3);
            // macchie: rumore a due scale, così il muschio cresce a chiazze e non uniforme
            vec2 q = vWPos.xz * 0.9 + vWPos.y * 0.5;
            vec2 qi = floor(q), qf = fract(q); qf = qf*qf*(3.0-2.0*qf);
            float h00 = fract(sin(dot(qi, vec2(127.1,311.7)))*43758.5), h10 = fract(sin(dot(qi+vec2(1,0), vec2(127.1,311.7)))*43758.5);
            float h01 = fract(sin(dot(qi+vec2(0,1), vec2(127.1,311.7)))*43758.5), h11 = fract(sin(dot(qi+vec2(1,1), vec2(127.1,311.7)))*43758.5);
            float patchN = mix(mix(h00,h10,qf.x), mix(h01,h11,qf.x), qf.y);
            float up = smoothstep(${(opt.moss.th || 0.45).toFixed(2)}, 0.95, vWN.y + mn2 * 0.15) * smoothstep(0.35, 0.7, patchN + mn2 * 0.25);
            float dry = smoothstep(0.5, 2.2, vWPos.y - uWaterY);
            float m = up * dry * ${(opt.moss.amt || 0.85).toFixed(2)};
            vec3 mossC = mix(vec3(0.13, 0.19, 0.05), vec3(0.27, 0.32, 0.10), patchN) * (0.8 + mn * 0.4);
            diffuseColor.rgb = mix(diffuseColor.rgb, mossC, m);
            // licheni chiari a macchie
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.22, 1.1), step(0.94, mn) * dry * (1.0 - up) * 0.6);
          }`);
      }
      if (opt.backShade) {
        // le facce posteriori del fogliame sono più scure (finta traslucenza/occlusione)
        fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= gl_FrontFacing ? 1.0 : 0.78;');
      }
      fs = fs.replace('#include <output_fragment>', `
        {
          float d = uWaterY - vWPos.y;
          if (d > 0.0) {
            float cst = causticF(vWPos.xz, uTime) * smoothstep(0.0, 0.6, d) * exp(-d*0.06) * uSunInt;
            outgoingLight += diffuseColor.rgb * cst * 1.8 * max(vWN.y, 0.15);
            outgoingLight *= mix(vec3(1.0), vec3(0.16, 0.58, 0.74), clamp(d/9.0, 0.0, 1.0));
          }
        }
        #include <output_fragment>`);
      if (opt.alphaTag) fs = fs.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = ' + opt.alphaTag.toFixed(2) + ';');
      sh.vertexShader = vs; sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => JSON.stringify(opt.key || opt.wind || '') + (opt.terrain ? 'T' : '') + (opt.backShade ? 'B' : '') + (opt.fadeDist ? 'F' : '') + (opt.alphaTag ? 'A' : '') + (opt.moss ? 'M' : '');
    return mat;
  };

  /* ---------------- CIELO ---------------- */
  G.createSky = function () {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, -1, 0) }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
        uGlow: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: G.shared.uTime, uCloud: { value: 0.45 }, uMoonPh: { value: 0.5 }, uDark: { value: 0 }, uMoonCol: { value: new THREE.Color(0.85, 0.9, 1.0) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uSun, uMoon, uZen, uHor, uGlow, uSunCol; uniform float uNight, uTime, uCloud, uMoonPh, uDark; uniform vec3 uMoonCol;
        float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<5;i++){ s+=vn(p)*a; p=p*2.07+vec2(1.7,9.2); a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float y = max(d.y, 0.0);
          vec3 col = mix(uHor, uZen, pow(y, 0.42));
          float sd = max(dot(d, uSun), 0.0);
          col += uGlow * pow(sd, 5.0) * (1.0 - y*0.7) * 0.9;
          col += uSunCol * (pow(sd, 260.0)*0.9 + pow(sd, 18.0)*0.12) * (1.0 - uDark);
          col += uSunCol * smoothstep(0.99955, 0.9998, sd) * 40.0 * (1.0 - uDark);
          // nebulosa e via lattea (notte dark fantasy)
          if (uDark > 0.01 && d.y > -0.05) {
            vec3 bn = normalize(vec3(0.35, 0.25, 0.9));
            float band = exp(-pow(dot(d, bn) / 0.32, 2.0));
            vec2 np = vec2(atan(d.z, d.x) * 2.2, d.y * 3.0);
            float neb = fbm(np * 1.3 + vec2(uTime * 0.002, 0.0)) * fbm(np * 3.1 + 7.0);
            vec3 nc = mix(vec3(0.42, 0.10, 0.62), vec3(0.10, 0.32, 0.65), fbm(np * 0.8 + 3.0));
            col += nc * neb * band * 1.1 * smoothstep(-0.05, 0.25, d.y) * uDark;
          }
          // stelle
          if (uNight > 0.01 || uDark > 0.01) {
            float uN = max(uNight, uDark * 0.9);
            vec3 sp = d * 160.0; vec3 cell = floor(sp); vec3 fr = fract(sp) - 0.5;
            float st = fract(sin(dot(cell, vec3(12.9898,78.233,37.719)))*43758.5453);
            vec3 off = vec3(fract(st*13.7), fract(st*71.3), fract(st*37.1)) - 0.5;
            float tw = 0.6 + 0.4*sin(uTime*3.0 + st*60.0);
            float star = smoothstep(0.993 - uDark * 0.004, 1.0, st) * smoothstep(0.16, 0.0, length(fr - off*0.6));
            col += mix(vec3(1.0,0.85,0.7), vec3(0.75,0.85,1.0), fract(st*7.0)) * star * tw * uN * 3.0 * smoothstep(0.0, 0.2, d.y);
            float md = max(dot(d, uMoon), 0.0);
            // disco lunare con la fase: si illumina la parte verso il sole
            vec3 mt = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0))), mb = cross(mt, uMoon);
            vec2 q = vec2(dot(d - uMoon, mt), dot(d - uMoon, mb)) / mix(0.026, 0.06, uDark);
            float disc = smoothstep(1.0, 0.92, length(q));
            float ph = uMoonPh * 6.2831853;
            float term = cos(ph) * sqrt(max(0.0, 1.0 - q.y * q.y));
            float lit = uMoonPh < 0.5 ? step(term, q.x) : step(q.x, -term);
            float cr = 0.85 + 0.15 * sin(q.x * 9.0 + q.y * 7.0) * sin(q.y * 11.0);
            float mare = mix(1.0, 0.8 + 0.2 * vn(q * 2.3 + 3.1) * vn(q * 5.1), uDark);
            col += mix(vec3(0.85,0.9,1.0), uMoonCol, uDark) * disc * mix(lit * cr * 6.0 + 0.04, (lit * 1.7 + (1.0 - lit) * 0.32) * cr * mare, uDark) * uNight;
            float bright = 0.1 + 0.9 * (1.0 - cos(ph)) * 0.5;
            col += vec3(0.25,0.32,0.5) * pow(md, 60.0) * 0.4 * uNight * bright * (1.0 - uDark);
            col += uMoonCol * (pow(md, 90.0) * 0.5 + pow(md, 14.0) * 0.2) * (1.0 - disc) * uDark * uNight * (0.35 + 0.65 * bright);
          }
          // nuvole
          if (d.y > 0.0) {
            vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime*0.006, uTime*0.0025);
            float n = fbm(cp*0.7);
            float cov = smoothstep(1.0 - uCloud, 1.05 - uCloud*0.6, n);
            float lit = fbm(cp*0.7 + uSun.xz*0.06);
            vec3 cc = mix(uHor*0.9 + uSunCol*0.25, vec3(1.0)*(0.3 + 0.9*(1.0-uNight)) + uGlow*0.35, clamp(1.0 - (lit - n)*4.0, 0.0, 1.0));
            cc += uSunCol * pow(sd, 8.0) * 0.6 * (1.0 - cov);
            vec3 cn = mix(col, cc * (1.0 - uNight*0.85), cov * smoothstep(0.0, 0.18, d.y) * 0.92);
            // di notte: nuvole blu-viola coi bordi argentati dalla luna
            float edge = clamp(1.0 - (lit - n) * 4.0, 0.0, 1.0);
            float smd = max(dot(d, uMoon), 0.0);
            vec3 cd = mix(uHor * 0.5 + vec3(0.008, 0.0, 0.025), uMoonCol * 0.2 + uZen * 1.3 + vec3(0.02, 0.0, 0.04), edge);
            cd += uMoonCol * pow(smd, 6.0) * 0.5 * (1.0 - cov * 0.5);
            col = mix(cn, mix(col, cd, cov * smoothstep(0.0, 0.18, d.y) * 0.9), uDark);
          } else {
            col = mix(uHor, uHor*0.5, clamp(-d.y*3.0, 0.0, 1.0));
          }
          gl_FragColor = vec4(col, 0.3);
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
    m.frustumCulled = false; m.renderOrder = -1;
    return m;
  };

  /* calcolo stato del cielo lato CPU */
  const cZenD = new THREE.Color(0.11, 0.30, 0.72), cHorD = new THREE.Color(0.56, 0.72, 0.92);
  const cZenS = new THREE.Color(0.16, 0.19, 0.42), cHorS = new THREE.Color(1.0, 0.50, 0.26);
  const cZenN = new THREE.Color(0.004, 0.008, 0.024), cHorN = new THREE.Color(0.018, 0.03, 0.06);
  const dZenD = new THREE.Color(0.03, 0.018, 0.10), dHorD = new THREE.Color(0.06, 0.065, 0.21);
  const dZenS = new THREE.Color(0.09, 0.03, 0.20), dHorS = new THREE.Color(0.22, 0.08, 0.30);
  const dZenN = new THREE.Color(0.012, 0.007, 0.04), dHorN = new THREE.Color(0.03, 0.03, 0.095);
  const _dAmb = new THREE.Color(0.006, 0.014, 0.022), _dz = new THREE.Color(), _dh = new THREE.Color(), _dg = new THREE.Color(), _ds = new THREE.Color(), _dl = new THREE.Color(), _da = new THREE.Color();
  G.moonCol = () => (G.settings && G.settings.moon !== 'argento' ? _mRed : _mSil);
  const _mSil = new THREE.Color(0.62, 0.72, 1.0), _mRed = new THREE.Color(1.0, 0.34, 0.30);
  G.sky = { sun: new THREE.Vector3(), moon: new THREE.Vector3(), zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), sunCol: new THREE.Color(), light: new THREE.Color(), amb: new THREE.Color(), day: 1, night: 0 };
  G.updateSky = function (t) {
    const S = G.sky;
    const a = (t - 0.25) * Math.PI * 2;
    S.sun.set(Math.cos(a) * 0.82, Math.sin(a), 0.42 + Math.cos(a) * 0.1).normalize();
    S.moon.copy(S.sun).multiplyScalar(-1); S.moon.y = Math.max(S.moon.y, -0.2); S.moon.normalize();
    const sh = S.sun.y;
    const day = G.smooth(-0.14, 0.22, sh);
    const twi = 1 - G.smooth(0.0, 0.32, Math.abs(sh + 0.02));
    S.day = day; S.night = 1 - G.smooth(-0.22, -0.02, sh);
    S.zen.copy(cZenN).lerp(cZenD, day).lerp(cZenS, twi * 0.55);
    S.hor.copy(cHorN).lerp(cHorD, day).lerp(cHorS, twi * 0.7);
    S.glow.setRGB(1.0, 0.42, 0.16).multiplyScalar(twi * 1.3 + 0.08 * day);
    const warm = G.smooth(0.0, 0.42, sh);
    S.sunCol.setRGB(1.0, 0.42 + 0.52 * warm, 0.18 + 0.7 * warm).multiplyScalar(G.smooth(-0.06, 0.12, sh) * 2.5);
    // luce direzionale: sole di giorno, luna di notte
    if (sh > -0.03) { S.light.copy(S.sunCol); S.lightDir = S.sun; }
    else { S.light.setRGB(0.32, 0.42, 0.68).multiplyScalar(0.2 * G.smooth(-0.03, -0.25, sh)); S.lightDir = S.moon; }
    S.amb.copy(S.zen).lerp(S.hor, 0.5).multiplyScalar(1.1).addScalar(0.012);
    // la notte è "dark fantasy": cielo blu-viola, nebulose, una grande luna (rossa o argento)
    const k = 1 - G.smooth(-0.2, 0.03, sh);
    S.dark = k; S.darkK = k;
    if (k > 0) {
      const mc = G.moonCol();
      S.zen.lerp(_dz.copy(dZenN).lerp(dZenS, twi * 0.5), k);
      S.hor.lerp(_dh.copy(dHorN).lerp(dHorS, twi * 0.5), k);
      S.glow.lerp(_dg.setRGB(0.36, 0.12, 0.55).multiplyScalar(twi * 0.9 + 0.12), k);
      S.sunCol.lerp(_ds.copy(mc).multiplyScalar(0.16), k);
      S.light.lerp(_dl.setRGB(0.30, 0.42, 0.80).lerp(mc, 0.3).multiplyScalar(0.4), k);
      S.amb.lerp(_da.copy(S.zen).lerp(S.hor, 0.5).multiplyScalar(0.9).add(_dAmb), k);
    }
    return S;
  };

  /* ---------------- OCEANO ---------------- */
  G.createWater = function (seg) {
    const N = seg, R = 1800;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 1) * (N + 1) * 3);
    const map = (u) => R * (0.1 * u + 0.9 * u * u * u);
    let k = 0;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { pos[k++] = map(i / N * 2 - 1); pos[k++] = 0; pos[k++] = map(j / N * 2 - 1); }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: false,
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tNormal: { value: null }, uRes: { value: new THREE.Vector2() },
        uNear: { value: 0.1 }, uFar: { value: 2000 }, uTime: G.shared.uTime, uWaveAmp: { value: G.waveAmp }, uWindLv: { value: 0.4 }, uCam: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
        uAmb: { value: new THREE.Color() }, uFogDen: { value: 0.002 }, uUnder: { value: 0 }, uOffset: { value: new THREE.Vector2() },
        uVort: { value: [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0)] },
        uSSR: { value: 0 }, uVP: { value: new THREE.Matrix4() },
        uDigW: (G.Dig && G.Dig.U.uDigW) || { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, -999, 0, 0)) }, uDigWN: (G.Dig && G.Dig.U.uDigWN) || { value: 0 },
      },
      vertexShader: GLSL_WAVES() + `
        uniform float uTime; uniform vec2 uOffset; uniform vec3 uCam; uniform vec4 uVort[4];
        varying vec3 vWPos; varying vec3 vN; varying float vH; varying float vViewZ;
        void main(){
          vec3 p = position; p.xz += uOffset;
          float fade = 1.0 - smoothstep(250.0, 900.0, length(p.xz - uCam.xz));
          vec3 n; vec3 d = gerstner(p.xz, uTime, n);
          p += d * fade; vN = normalize(mix(vec3(0.,1.,0.), n, fade)); vH = d.y * fade;
          // gorghi: imbuto al centro
          for (int i = 0; i < 4; i++) { vec4 v = uVort[i]; if (abs(v.w) < 0.02) continue; vec2 dv = p.xz - v.xy; float r2 = dot(dv, dv) / (v.z * v.z * 0.16);
            float dip = abs(v.w) * 2.4 * exp(-r2); p.y -= dip; vec2 g = dv / max(length(dv), 0.01); vN = normalize(vN + vec3(g.x, 0.0, g.y) * dip * 0.6); }
          vWPos = p;
          vec4 mv = viewMatrix * vec4(p, 1.0); vViewZ = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D tScene, tDepth, tNormal; uniform vec2 uRes; uniform float uNear, uFar, uTime, uFogDen, uUnder, uWaveAmp, uWindLv, uSSR; uniform vec4 uVort[4]; uniform mat4 uVP; uniform vec4 uDigW[24]; uniform int uDigWN;
        uniform vec3 uCam, uSunDir, uSunCol, uZen, uHor, uAmb;
        varying vec3 vWPos; varying vec3 vN; varying float vH; varying float vViewZ;
        float lin(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
        float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        vec3 skyC(vec3 r){ float y = max(r.y, 0.0); return mix(uHor, uZen, pow(y, 0.42)); }
        void main(){
          vec2 suv = gl_FragCoord.xy / uRes;
          float sceneZ = lin(texture2D(tDepth, suv).r);
          if (sceneZ < vViewZ - 0.05) discard;
          for (int i = 0; i < 24; i++) { if (i >= uDigWN) break; vec3 dd = vWPos - uDigW[i].xyz; if (dot(dd, dd) < uDigW[i].w * uDigW[i].w) discard; }
          vec3 V = uCam - vWPos; float dist = length(V); V /= dist;
          vec2 u1 = vWPos.xz*0.045 + uTime*vec2(0.018,0.011), u2 = vWPos.xz*0.12 - uTime*vec2(0.012,0.026);
          vec3 n1 = texture2D(tNormal, u1).xyz*2.0-1.0, n2 = texture2D(tNormal, u2).xyz*2.0-1.0;
          float ds = mix(0.42, 0.06, clamp(dist/260.0, 0.0, 1.0)) * (0.12 + uWindLv * 1.25);
          vec3 N = normalize(vN + vec3(n1.x + n2.x, 0.0, n1.y + n2.y) * ds);
          float under = uUnder;
          if (under > 0.5) N = -N;
          float ndv = max(dot(N, V), 0.0);
          float lightLvl = clamp(dot(uSunCol, vec3(0.3,0.5,0.2))*0.32 + dot(uAmb, vec3(0.3,0.5,0.2))*0.8, 0.02, 1.3);
          // rifrazione
          float thick0 = max(sceneZ - vViewZ, 0.0);
          vec2 ruv = suv + N.xz * 0.04 * clamp(thick0*0.25, 0.0, 1.0) / (1.0 + dist*0.03);
          float rz = lin(texture2D(tDepth, ruv).r);
          if (rz < vViewZ) { ruv = suv; rz = sceneZ; }
          float thick = max(rz - vViewZ, 0.0);
          vec4 refrA = texture2D(tScene, ruv); vec3 refr = refrA.rgb; float notBoat = 1.0 - step(abs(texture2D(tScene, suv).a - 0.85), 0.04);
          vec3 col;
          if (under < 0.5) {
            float vth = thick * max(V.y, 0.08);
            vec3 T = exp(-vec3(0.38, 0.075, 0.055) * (thick*0.55 + vth*0.9));
            vec3 scat = mix(vec3(0.0, 0.13, 0.17), vec3(0.02, 0.32, 0.36), exp(-vth*0.16)) * lightLvl;
            col = refr * T + scat * (1.0 - T.g);
            // riflesso
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
            vec3 refl = skyC(R);
            // riflesso delle isole e delle montagne: marcia in spazio schermo lungo il raggio riflesso
            if (uSSR > 0.5 && dist < 500.0) {
              vec3 Rr = reflect(-V, normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.35)));
              float tt = 1.5;
              for (int i = 0; i < 18; i++) {
                tt *= 1.32; vec3 pp = vWPos + Rr * tt;
                vec4 cl = uVP * vec4(pp, 1.0); vec3 nd = cl.xyz / cl.w;
                if (abs(nd.x) > 1.0 || abs(nd.y) > 1.0 || cl.w < 0.0) break;
                vec2 ruv2 = nd.xy * 0.5 + 0.5; float sz = lin(texture2D(tDepth, ruv2).r);
                if (cl.w > sz + 0.2 && cl.w < sz + tt * 0.35 + 3.0) {
                  vec3 sc = texture2D(tScene, ruv2).rgb;
                  float fd2 = (dist + tt) * uFogDen; sc = mix(sc, mix(uHor, uZen, 0.08), 1.0 - exp(-fd2 * fd2));
                  float edgeK = smoothstep(1.0, 0.8, abs(nd.x)) * smoothstep(1.0, 0.85, abs(nd.y));
                  refl = mix(refl, sc, edgeK * 0.95); break;
                }
              }
            }
            col = mix(col, refl, clamp(fres, 0.0, 0.92));
            float sp = max(dot(R, uSunDir), 0.0);
            col += uSunCol * (pow(sp, 900.0)*6.0 + pow(sp, 90.0)*0.22);
            // schiuma riva + creste
            float fn = vn(vWPos.xz*0.9 + uTime*0.25)*0.6 + vn(vWPos.xz*2.7 - uTime*0.4)*0.4;
            // schiuma a chiazze sulla battigia (non un velo bianco uniforme), più forte col vento
            float wl = clamp(uWindLv, 0.0, 1.0);
            float shore = (1.0 - smoothstep(0.0, 0.9 + wl * 0.8, vth)) * smoothstep(0.0, 0.06, vth) * notBoat;
            float lace = smoothstep(0.5, 0.85, fn + sin(vth*9.0 - uTime*1.7)*0.18);
            float bands = smoothstep(0.6, 0.95, sin(vth*6.0 - uTime*2.2 + fn*3.0)*0.5+0.5) * (1.0 - smoothstep(0.0, 2.2, vth)) * notBoat;
            float crest = smoothstep(0.55, 1.0, vH / (0.9*uWaveAmp+0.01) + fn*0.25) * smoothstep(0.25, 0.7, wl);
            float foam = clamp(shore*lace*(0.45 + wl*0.5) + bands*(0.25 + wl*0.45)*fn + crest*fn*(0.3 + wl*0.7), 0.0, 1.0);
            // schiuma a spirale dei gorghi, centro scuro
            for (int i = 0; i < 4; i++) { vec4 v = uVort[i]; if (abs(v.w) < 0.02) continue; vec2 dv = vWPos.xz - v.xy; float dd = length(dv) / v.z;
              if (dd > 1.7) continue; float ang = atan(dv.y, dv.x) * sign(v.w);
              float sp = sin(ang * 3.0 + log(dd + 0.05) * 7.0 + uTime * 2.4 * abs(v.w));
              float ring = smoothstep(1.7, 0.6, dd) * smoothstep(0.05, 0.3, dd);
              foam = max(foam, smoothstep(0.55, 0.95, sp * 0.5 + 0.5 + fn * 0.3) * ring * abs(v.w));
              col *= 1.0 - abs(v.w) * 0.55 * smoothstep(0.45, 0.0, dd); }
            col = mix(col, vec3(0.92, 0.96, 0.98) * (lightLvl*0.9 + 0.08), foam * 0.85);
            float fd = dist * uFogDen; float fog = 1.0 - exp(-fd * fd);
            vec3 fogc = mix(uHor, uZen, 0.08) + uSunCol*0.06*pow(max(dot(-V, uSunDir),0.0), 6.0);
            col = mix(col, fogc, fog);
          } else {
            // visto da sotto: finestra di Snell
            float win = smoothstep(0.62, 0.9, -V.y);
            vec3 sky = skyC(vec3(0.0,1.0,0.0))*1.3 + uSunCol*pow(max(dot(-V, uSunDir),0.0), 40.0)*0.8;
            col = mix(vec3(0.02, 0.17, 0.2) * lightLvl, sky, win);
            col += causticSparkle(0.0);
          }
          gl_FragColor = vec4(col, 0.0);
        }`.replace('col += causticSparkle(0.0);', 'col += vec3(0.6,0.9,1.0) * pow(vn(vWPos.xz*0.6 + uTime*0.3), 6.0) * 0.4 * lightLvl;'),
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    return mesh;
  };

  /* ---------------- POST PROCESSING ---------------- */
  const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  G.createPost = function () {
    const copy = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { t: { value: null } }, vertexShader: QUAD_VS,
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }' });
    const post = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: null }, tScene: { value: null }, tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
        uNear: { value: 0.1 }, uFar: { value: 2000 }, uSunScreen: { value: new THREE.Vector2() }, uSunVis: { value: 0 }, uSunDir: { value: new THREE.Vector3() },
        uSunCol: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uFogDen: { value: 0.002 },
        uUnder: { value: 0 }, uTime: G.shared.uTime, uGod: { value: 1 }, uExposure: { value: 1 }, uAmb: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2() },
        uDamage: { value: 0 }, uSleep: { value: 0 }, uAO: { value: 1 },
        uMist: { value: 0 }, uMistH: { value: 4 }, uGodK: { value: 0.3 }, uCamDepth: { value: 0 }, uHeat: { value: 0 }, uDark: { value: 0 },
      },
      vertexShader: QUAD_VS,
      fragmentShader: `
        uniform sampler2D tColor, tScene, tDepth; uniform mat4 uInvProj, uCamWorld; uniform float uNear, uFar, uSunVis, uFogDen, uUnder, uTime, uGod, uExposure, uDamage, uSleep, uAO, uMist, uMistH, uGodK, uCamDepth, uHeat, uDark;
        uniform vec2 uSunScreen, uRes; uniform vec3 uSunDir, uSunCol, uHor, uZen, uAmb; varying vec2 vUv;
        float lin(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
        float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          // tColor contiene solo l'acqua (alfa 0); dove è vuoto (alfa 1) si legge la scena
          vec2 suv = vUv;
          if (uHeat > 0.01) suv.x += sin(vUv.y * 140.0 + uTime * 6.0) * 0.0012 * uHeat * smoothstep(0.35, 0.55, vUv.y) * (1.0 - smoothstep(0.55, 0.75, vUv.y));
          vec4 c = texture2D(tColor, suv); if (c.a > 0.5) c = texture2D(tScene, suv);
          float dRaw = texture2D(tDepth, vUv).r;
          vec4 vr = uInvProj * vec4(vUv*2.0-1.0, 1.0, 1.0); vr.xyz /= vr.w;
          vec3 rayV = normalize(vr.xyz);
          vec3 ray = normalize((uCamWorld * vec4(rayV, 0.0)).xyz);
          float zv = lin(dRaw); float dist = zv / max(-rayV.z, 1e-3);
          vec3 col = c.rgb;
          float isSolid = step(0.6, c.a);
          // occlusione ambientale in screen space (solo dalla profondità)
          if (uAO > 0.5 && isSolid > 0.5 && zv < 90.0) {
            float occ = 0.0;
            float radPx = clamp(uRes.y * 0.9 / zv, 3.0, 60.0);
            float rot = h12(vUv * uRes) * 6.2831;
            for (int i = 0; i < 12; i++) {
              float fi = float(i);
              float ang = fi * 2.39996 + rot;
              float rr = (fi + 0.5) / 12.0;
              vec2 off = vec2(cos(ang), sin(ang)) * rr * radPx / uRes;
              float sz = lin(texture2D(tDepth, vUv + off).r);
              float diff = zv - sz;
              occ += smoothstep(0.03, 0.35, diff) * (1.0 - smoothstep(1.2, 3.0, diff));
            }
            float ao = 1.0 - (occ / 12.0) * 0.75;
            col *= mix(1.0, ao, 1.0 - smoothstep(40.0, 90.0, zv));
          }
          // foschia bassa nelle valli (mattino, pioggia, foreste pluviali): nebbia che dipende dalla quota
          if (uMist > 0.001 && uUnder < 0.5) {
            vec3 cp = uCamWorld[3].xyz; float L = isSolid > 0.5 ? min(dist, 700.0) : 700.0;
            float H = 9.0, a = exp(-(cp.y - uMistH) / H);
            float ry = ray.y; float integ = abs(ry) < 0.002 ? L * a : H / ry * (a - exp(-(cp.y + ry * L - uMistH) / H));
            float mist = 1.0 - exp(-max(integ, 0.0) * uMist * 0.0032);
            vec3 mc = mix(uHor * 1.05 + uAmb * 0.3, uSunCol * 0.55 + uHor * 0.6, pow(max(dot(ray, uSunDir), 0.0), 8.0));
            col = mix(col, mc, clamp(mist, 0.0, 0.6));
          }
          if (uUnder < 0.5) {
            if (isSolid > 0.5) {
              float fd = dist * uFogDen; float fog = 1.0 - exp(-fd * fd);
              fog *= mix(1.0, 0.55, clamp(ray.y*2.0, 0.0, 1.0));
              vec3 fc = mix(uHor, uZen, clamp(ray.y*1.5+0.05, 0.0, 1.0)*0.35) + uSunCol*0.12*pow(max(dot(ray, uSunDir),0.0), 6.0);
              col = mix(col, fc, fog);
            }
          } else {
            float dd = (c.a < 0.1) ? 6.0 : (c.a < 0.5 ? 60.0 : dist);
            // più si scende, più l'acqua diventa blu scuro
            float deepK = exp(-max(uCamDepth, 0.0) * 0.11);
            vec3 uw = mix(vec3(0.002, 0.02, 0.05), vec3(0.006, 0.058, 0.095), deepK) * clamp(dot(uAmb, vec3(0.3,0.5,0.2))*1.4 + dot(uSunCol, vec3(0.1)), 0.05, 1.2);
            float f = 1.0 - exp(-dd * mix(0.13, 0.085, deepK));
            col = mix(col * vec3(0.36, 0.74, 0.86), uw, f);
          }
          // raggi di sole (godrays) in screen space, sopra l'acqua
          if (uGod > 0.5 && uSunVis > 0.001 && uUnder < 0.5) {
            vec2 dir = (uSunScreen - vUv);
            float jitter = h12(vUv*uRes + uTime);
            vec2 stepv = dir / 30.0;
            vec2 p = vUv + stepv * jitter;
            float acc = 0.0, w = 1.0;
            for (int i = 0; i < 30; i++) {
              vec4 s = texture2D(tColor, p); if (s.a > 0.5) s = texture2D(tScene, p);
              float m = (1.0 - abs(s.a - 0.3)*6.0) * clamp(dot(s.rgb, vec3(0.3,0.5,0.2))*0.6, 0.0, 2.0);
              acc += max(m, 0.0) * w; w *= 0.955; p += stepv;
            }
            acc /= 30.0;
            float fall = pow(max(1.0 - length(dir*vec2(uRes.x/uRes.y,1.0))*0.9, 0.0), 1.6);
            col += uSunCol * acc * fall * uSunVis * uGodK;
          }
          // fasci di luce subacquei (analitici, senza campionamenti)
          if (uUnder > 0.5 && uGod > 0.5) {
            vec3 ld = normalize(vec3(uSunDir.x*0.35, 1.0, uSunDir.z*0.35));
            float ang = max(dot(ray, ld), 0.0);
            vec3 side = normalize(cross(ld, vec3(0.0,0.0,1.0)));
            vec3 up2 = cross(side, ld);
            vec2 q2 = vec2(dot(ray, side), dot(ray, up2)) / max(ang, 0.05);
            float a2 = atan(q2.y, q2.x);
            float shafts = 0.5 + 0.5*sin(a2*13.0 + uTime*0.35) * sin(a2*7.0 - uTime*0.22 + 1.7);
            shafts = pow(shafts, 3.0) * pow(ang, 2.5);
            float lit = clamp(dot(uSunCol, vec3(0.3,0.5,0.2))*0.25, 0.0, 1.0);
            col += vec3(0.45, 0.8, 0.9) * shafts * lit * (0.55 + uGodK) * smoothstep(0.0, 0.4, ray.y + 0.3);
          }
          col *= uExposure;
          col = mix(col, col * vec3(1.08, 1.0, 0.86), uHeat * 0.5);
          col = aces(col);
          col = pow(col, vec3(1.0/2.2));
          // grading leggero
          float l = dot(col, vec3(0.299,0.587,0.114));
          col = mix(vec3(l), col, 1.08);
          vec2 q = vUv - 0.5; col *= 1.0 - dot(q,q)*0.55;
          if (uDark > 0.01) {
            vec3 c0 = col;
            // notte dark fantasy: ombre blu-petrolio, verdi smeraldo, fuochi caldi che risaltano
            float warm = smoothstep(0.04, 0.22, col.r - max(col.g * 0.85, col.b)) * smoothstep(0.22, 0.5, col.r);
            float green = smoothstep(0.0, 0.08, col.g - max(col.r, col.b * 0.9));
            vec3 cool = col * vec3(0.86, 0.96, 1.10) + vec3(0.004, 0.004, 0.016);
            cool = mix(cool, cool * vec3(0.34, 0.95, 0.9), green);
            float sandy = smoothstep(0.0, 0.06, col.r - col.b) * (1.0 - warm) * smoothstep(0.1, 0.22, l) * 0.8;
            cool = mix(cool, vec3(dot(cool, vec3(0.3, 0.55, 0.15))) * vec3(0.62, 0.78, 1.1), sandy * 0.75);
            col = mix(cool, col * vec3(1.2, 0.98, 0.78), warm);
            l = dot(col, vec3(0.299,0.587,0.114));
            col = mix(vec3(l), col, 1.18);
            col = max(col - 0.012, 0.0) * 1.03;
            col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
            col += vec3(0.25, 0.08, 0.02) * pow(warm * l, 2.0) * 0.6;
            col *= 1.0 - dot(q,q) * 0.7;
            col = mix(c0, col, uDark);
          }
          col = mix(col, vec3(0.55,0.05,0.04), uDamage * (0.25 + dot(q,q)*1.2));
          col *= 1.0 - uSleep;
          col += (h12(vUv*uRes + fract(uTime)) - 0.5) / 255.0;
          gl_FragColor = vec4(col, l);
        }`,
    });
    const fxaa = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, uniforms: { t: { value: null }, uRes: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS,
      fragmentShader: `
        uniform sampler2D t; uniform vec2 uRes; varying vec2 vUv;
        void main(){
          vec2 px = 1.0 / uRes;
          vec3 rgbNW = texture2D(t, vUv + vec2(-1.,-1.)*px).rgb, rgbNE = texture2D(t, vUv + vec2(1.,-1.)*px).rgb;
          vec3 rgbSW = texture2D(t, vUv + vec2(-1.,1.)*px).rgb, rgbSE = texture2D(t, vUv + vec2(1.,1.)*px).rgb;
          vec4 M = texture2D(t, vUv);
          vec3 L = vec3(0.299,0.587,0.114);
          float lNW = dot(rgbNW,L), lNE = dot(rgbNE,L), lSW = dot(rgbSW,L), lSE = dot(rgbSE,L), lM = dot(M.rgb,L);
          float lMin = min(lM, min(min(lNW,lNE), min(lSW,lSE))), lMax = max(lM, max(max(lNW,lNE), max(lSW,lSE)));
          vec2 dir = vec2(-((lNW+lNE)-(lSW+lSE)), ((lNW+lSW)-(lNE+lSE)));
          float red = max((lNW+lNE+lSW+lSE)*0.03125, 1.0/128.0);
          float rcp = 1.0/(min(abs(dir.x), abs(dir.y)) + red);
          dir = clamp(dir*rcp, vec2(-8.0), vec2(8.0)) * px;
          vec3 A = 0.5*(texture2D(t, vUv + dir*(1./3.-.5)).rgb + texture2D(t, vUv + dir*(2./3.-.5)).rgb);
          vec3 B = A*0.5 + 0.25*(texture2D(t, vUv + dir*-0.5).rgb + texture2D(t, vUv + dir*0.5).rgb);
          float lB = dot(B, L);
          gl_FragColor = vec4((lB < lMin || lB > lMax) ? A : B, 1.0);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
    quad.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(quad);
    const cam = new THREE.Camera();
    return { copy, post, fxaa, quad, scene, cam };
  };
})();
