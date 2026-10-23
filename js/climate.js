'use strict';
/* ==========================================================
   Clima: fasi lunari, meteo (sereno, nuvoloso, pioggia,
   temporale, caldo, siccità, neve), vento che cambia direzione
   e varia da zona a zona, gorghi in mare, temperatura.
   In multigiocatore il meteo lo decide chi ospita.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const C = (G.Climate = {});
  const TAU = Math.PI * 2;

  /* ---------------- LUNA ---------------- */
  C.PHASES = ['Luna nuova', 'Falce crescente', 'Primo quarto', 'Gibbosa crescente', 'Luna piena', 'Gibbosa calante', 'Ultimo quarto', 'Falce calante'];
  C.PHASE_ICON = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  G.moonOffset = 0;
  // 0 = nuova, 0.5 = piena; un ciclo ogni 8 giorni di gioco
  C.moonPhase = () => ((((G.time + G.moonOffset) / 8) % 1) + 1) % 1;
  C.moonIndex = () => Math.round(C.moonPhase() * 8) % 8;
  C.moonName = () => C.PHASES[C.moonIndex()];
  C.moonLight = () => 0.1 + 0.9 * (1 - Math.cos(C.moonPhase() * TAU)) / 2;
  C.setMoon = function (idx) { const cur = (((G.time / 8) % 1) + 1) % 1; G.moonOffset = ((idx / 8 - cur) * 8 + 64) % 8; };

  /* ---------------- METEO ---------------- */
  C.KINDS = {
    sereno: { n: 'Sereno', icon: '☀', cloud: 0.32, rain: 0, storm: 0, heat: 0, dry: 0, wind: 0, dur: [420, 780] },
    nuvoloso: { n: 'Nuvoloso', icon: '☁', cloud: 0.78, rain: 0, storm: 0, heat: 0, dry: 0, wind: 1, dur: [200, 420] },
    pioggia: { n: 'Pioggia', icon: '🌧', cloud: 0.95, rain: 0.75, storm: 0, heat: 0, dry: 0, wind: 2, dur: [200, 420] },
    temporale: { n: 'Temporale', icon: '⛈', cloud: 1, rain: 1, storm: 1, heat: 0, dry: 0, wind: 4, dur: [160, 320] },
    caldo: { n: 'Caldo torrido', icon: '🔥', cloud: 0.08, rain: 0, storm: 0, heat: 1, dry: 0.3, wind: -2, dur: [300, 600] },
    siccita: { n: 'Siccità', icon: '🏜', cloud: 0.04, rain: 0, storm: 0, heat: 0.7, dry: 1, wind: -3, dur: [480, 900] },
  };
  const NEXT = {
    sereno: [['nuvoloso', 0.38], ['caldo', 0.22], ['sereno', 0.25], ['siccita', 0.15]],
    nuvoloso: [['pioggia', 0.45], ['sereno', 0.35], ['temporale', 0.2]],
    pioggia: [['nuvoloso', 0.4], ['temporale', 0.3], ['sereno', 0.3]],
    temporale: [['pioggia', 0.6], ['nuvoloso', 0.4]],
    caldo: [['sereno', 0.5], ['siccita', 0.3], ['nuvoloso', 0.2]],
    siccita: [['caldo', 0.4], ['sereno', 0.4], ['nuvoloso', 0.2]],
  };
  C.state = { kind: 'sereno', t: 500, lock: false };
  // valori attuali (sfumati) visti dal giocatore
  C.cur = { cloud: 0.32, rain: 0, snow: 0, storm: 0, heat: 0, dry: 0, wind: 0 };
  C.reset = function (st) {
    C.state = Object.assign({ kind: 'sereno', t: 500, lock: false }, st || {});
    if (!C.KINDS[C.state.kind]) C.state.kind = 'sereno';
    const K = C.KINDS[C.state.kind];
    Object.assign(C.cur, { cloud: K.cloud, rain: K.rain, snow: 0, storm: K.storm, heat: K.heat, dry: K.dry, wind: K.wind });
    C.vort.clear(); C.flash = 0;
  };
  C.serialize = () => ({ kind: C.state.kind, t: Math.round(C.state.t), lock: C.state.lock || false, dir: +G.Boats.wind.dir.toFixed(3), moon: +G.moonOffset.toFixed(3) });
  C.load = function (w) { if (!w) { C.reset(); return; } C.reset(w); if (w.dir !== undefined) G.Boats.wind.dir = w.dir; G.moonOffset = w.moon || 0; };
  C.setWeather = function (kind, lock, quiet) {
    if (!C.KINDS[kind]) return false;
    const K = C.KINDS[kind];
    C.state.kind = kind; C.state.t = K.dur[0] + Math.random() * (K.dur[1] - K.dur[0]); C.state.lock = !!lock;
    // col cambio di tempo il vento gira
    if (kind === 'temporale' || kind === 'pioggia' || Math.random() < 0.5) C.windTarget = G.Boats.wind.dir + (Math.random() - 0.5) * 2.6;
    if (!quiet && G.UI) G.UI.toast(weatherMsg(kind));
    if (G.Net && G.Net.on && G.Net.isHost) G.Net.timeT = 0;
    return true;
  };
  function weatherMsg(k) {
    return { sereno: 'Il cielo si rasserena', nuvoloso: 'Si sta rannuvolando', pioggia: 'Comincia a piovere', temporale: 'Arriva un temporale! Mare grosso e fulmini', caldo: 'Caldo torrido: bevi spesso', siccita: 'Siccità: niente pioggia per molto tempo, l’erba ingiallisce' }[k];
  }
  function pickNext(k) { const l = NEXT[k]; let r = Math.random(); for (const [n, p] of l) { if ((r -= p) <= 0) return n; } return l[0][0]; }

  // il meteo "globale" si esprime diversamente a seconda del clima del posto
  C.localAt = function (x, z, out) {
    const K = C.KINDS[C.state.kind], cl = G.climate(x, z);
    const hot = G.smooth(0.08, 0.3, cl.t), cold = G.coldAt ? G.coldAt(x, z) : G.smooth(-0.25, -0.4, cl.t);
    const dryLand = G.smooth(-0.02, -0.25, cl.w) * hot; // deserto: piove pochissimo
    out = out || {};
    out.rain = K.rain * (1 - dryLand * 0.85) * (1 - cold);
    out.snow = Math.max(K.rain, K.cloud > 0.7 ? 0.35 : 0) * cold;
    out.storm = K.storm * (1 - cold * 0.6);
    out.heat = K.heat * (0.35 + hot * 0.65) * (1 - cold);
    out.dry = K.dry * (0.4 + hot * 0.6);
    out.cloud = K.cloud;
    out.wind = K.wind;
    return out;
  };

  /* ---------------- VENTO ---------------- */
  // direzione locale: quella generale piegata da correnti d'aria regionali (venti diversi in zone diverse)
  C.windDirAt = function (x, z) {
    const n = G.nA ? G.nA(x * 0.0014 + 11, z * 0.0014 - 7) * 0.9 + G.nB(x * 0.004 - 3, z * 0.004 + 5) * 0.25 : 0;
    return G.Boats.wind.dir + n * 1.25;
  };
  // forza effettiva: quella scelta per il mondo, più o meno quella del meteo
  C.windLevel = () => Math.max(0, Math.min(10, G.WIND.level + C.cur.wind));
  C.DIR_N = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  // direzione da cui soffia il vento, come nome cardinale
  C.dirName = (d) => C.DIR_N[Math.round(((((d + Math.PI) / TAU) % 1 + 1) % 1) * 8) % 8];
  C.dirFromName = function (s) { const i = C.DIR_N.indexOf(String(s || '').toUpperCase().replace('W', 'O')); return i < 0 ? null : (i / 8) * TAU - Math.PI; };

  /* ---------------- GORGHI ---------------- */
  // luoghi fissi in mare aperto, attivi solo con vento forte da una certa direzione: quando il vento cambia, il gorgo si spegne
  const VCELL = 520;
  C.vort = new Map(); // id -> stato {x,z,R,s}
  const sites = new Map();
  function site(cx, cz) {
    const key = cx + ',' + cz; if (sites.has(key)) return sites.get(key);
    const r = G.mulberry32((G.hashInt ? G.hashInt(cx * 7331, cz * 9173) : (cx * 73856093) ^ (cz * 19349663)) ^ (G.seed | 0));
    let v = null;
    if (r() < 0.55) for (let i = 0; i < 8 && !v; i++) {
      const x = cx * VCELL + 60 + r() * (VCELL - 120), z = cz * VCELL + 60 + r() * (VCELL - 120);
      if (Math.hypot(x, z) < 500) continue;
      if (G.heightAt(x, z) < -12 && G.heightAt(x + 40, z) < -8 && G.heightAt(x - 40, z) < -8 && G.heightAt(x, z + 40) < -8 && G.heightAt(x, z - 40) < -8)
        v = { id: key, x, z, R: 30 + r() * 14, wdir: r() * TAU, cw: r() < 0.5 ? 1 : -1 };
    }
    sites.set(key, v); return v;
  }
  C.sitesNear = function (x, z, rad) {
    const out = [];
    for (let cz = Math.floor((z - rad) / VCELL); cz <= Math.floor((z + rad) / VCELL); cz++) for (let cx = Math.floor((x - rad) / VCELL); cx <= Math.floor((x + rad) / VCELL); cx++) {
      const s = site(cx, cz); if (s && Math.hypot(s.x - x, s.z - z) < rad) out.push(s);
    }
    return out;
  };
  C.resetSites = () => { sites.clear(); C.vort.clear(); };
  C.forceVortex = null; // comando /gorgo: crea un gorgo accanto
  function updateVortices(dt, P) {
    const lv = C.windLevel();
    const near = C.sitesNear(P.pos.x, P.pos.z, 700);
    if (C.forceVortex) near.push(C.forceVortex);
    const seen = new Set();
    for (const s of near) {
      seen.add(s.id);
      const wd = C.windDirAt(s.x, s.z);
      const on = s.forced ? s.until > G.clock : (lv >= 6 && Math.abs(G.angleDiff(wd, s.wdir)) < 1.3);
      let v = C.vort.get(s.id); if (!v) { v = { x: s.x, z: s.z, R: s.R, cw: s.cw, s: 0, id: s.id }; C.vort.set(s.id, v); }
      const target = on ? (s.forced ? 0.9 : G.smooth(5.5, 8, lv) * 0.7 + 0.3) : 0;
      v.s += (target - v.s) * Math.min(1, dt * (target > v.s ? 0.08 : 0.12));
    }
    for (const [id, v] of C.vort) if (!seen.has(id)) { v.s -= dt * 0.2; if (v.s <= 0) C.vort.delete(id); }
    if (C.forceVortex && C.forceVortex.until < G.clock) C.forceVortex = null;
  }
  // abbassamento del mare al centro del gorgo (barche e nuotatori ci scivolano dentro)
  C.dip = function (x, z) {
    let d = 0;
    for (const v of C.vort.values()) { if (v.s < 0.02) continue; const dx = x - v.x, dz = z - v.z, r2 = (dx * dx + dz * dz) / (v.R * v.R * 0.16); if (r2 < 9) d += v.s * 2.4 * Math.exp(-r2); }
    return d;
  };
  // corrente del gorgo nel punto: [vx, vz, forza 0..1]
  C.current = function (x, z) {
    let vx = 0, vz = 0, k = 0;
    for (const v of C.vort.values()) {
      if (v.s < 0.05) continue;
      const dx = x - v.x, dz = z - v.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > v.R * 1.6) continue;
      const w = v.s * (1 - G.smooth(v.R * 0.9, v.R * 1.6, d));
      const tx = -dz / d * v.cw, tz = dx / d * v.cw; // tangente
      const inward = G.smooth(v.R * 0.25, v.R * 0.9, d); // verso il centro, fino all'orbita interna
      vx += (tx * 4.2 - dx / d * inward * 2.2) * w; vz += (tz * 4.2 - dz / d * inward * 2.2) * w;
      k = Math.max(k, w);
    }
    return [vx, vz, k];
  };
  C.trapped = new Set();
  C.vortexUniforms = function (out) {
    const P = G.Player, list = [...C.vort.values()].filter((v) => v.s > 0.02).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
    for (let i = 0; i < 4; i++) { const v = list[i]; if (v) out[i].set(v.x, v.z, v.R, v.s * v.cw); else out[i].set(0, 0, 1, 0); }
  };

  /* ---------------- TEMPERATURA ---------------- */
  // temperatura dell'aria in °C nel punto, a quest'ora, con questo tempo
  C.airTemp = function (x, z, y) {
    const cl = G.climate(x, z), L = C.localAt(x, z, _loc);
    let T = 17 + cl.t * 30;
    if (G.coldAt) T -= G.coldAt(x, z) * 16;
    if (G.volcanoHeat) T += G.volcanoHeat(x, z);
    const dryAir = G.smooth(0.1, -0.3, cl.w);
    const dayAmp = 4 + dryAir * 9; // nel deserto le notti sono fredde
    const sunUp = G.sky ? G.sky.day : 1;
    T += (sunUp - 0.5) * 2 * dayAmp;
    T -= Math.max(0, (y || 0) - 18) * 0.045;
    T -= L.rain * 4 + L.storm * 3 + L.snow * 4;
    T += L.heat * 10 + L.dry * 3;
    T -= Math.max(0, C.windLevel() - 4) * 0.6;
    return T;
  };
  const _loc = {};
  C.clothes = function () {
    const eq = G.Player.equip || [];
    let warm = 0, cool = 0;
    for (let i = 1; i < 4; i++) { const st = eq[i]; if (st && G.ITEMS[st.id]) { warm += G.ITEMS[st.id].warm || 0; cool += G.ITEMS[st.id].cool || 0; } }
    return { warm, cool };
  };
  // calore percepito: aria + fuoco + riparo + vestiti
  C.feltTemp = function () {
    const P = G.Player, x = P.pos.x, z = P.pos.z;
    let T = C.airTemp(x, z, P.pos.y);
    if (P.swim || P.under) T = Math.min(T, 12 + G.climate(x, z).t * 18 - (G.coldAt ? G.coldAt(x, z) * 14 : 0));
    // falò vicini
    let fire = 0;
    for (const p of G.Build.pieces) if (p.t === 'falo') { const d = Math.hypot(p.x - x, p.z - z); if (d < 7) fire = Math.max(fire, 1 - d / 7); }
    if (G.Structures && G.Structures.fireNear) fire = Math.max(fire, G.Structures.fireNear(x, z));
    T += fire * 18;
    if (P.heldTorch) T += 2;
    // sotto un tetto: niente pioggia e vento, al fresco col sole
    const roofed = G.Build.ceilingAt(x, z, P.pos.y + 1.8, 0.2) < P.pos.y + 7;
    if (roofed) { const L = C.localAt(x, z, _loc); T += (L.rain * 4 + L.snow * 3) * 0.8 + (T < 15 ? 3 : 0) - (T > 28 ? 4 : 0); }
    const cl = C.clothes();
    if (T < 16) T = Math.min(16, T + cl.warm * 2.6);
    else if (T > 27) T = Math.max(27, T - cl.cool * 3.5 + cl.warm * 1.2);
    C._roofed = roofed;
    return T;
  };
  C.bodyLabel = function (b) {
    return b < 12 ? 'Ipotermia!' : b < 30 ? 'Infreddolito' : b < 40 ? 'Freddo' : b > 88 ? 'Colpo di calore!' : b > 70 ? 'Accaldato' : b > 60 ? 'Caldo' : 'Bene';
  };
  function updateBody(dt, P) {
    if (P.temp === undefined) P.temp = 50;
    if (G.creative()) { P.temp = 50; return; }
    const T = C.feltTemp(); C.felt = T;
    const target = T < 12 ? Math.max(0, 50 - (12 - T) * 3.2) : T > 28 ? Math.min(100, 50 + (T - 28) * 3.6) : 50;
    P.temp += (target - P.temp) * Math.min(1, dt * 0.025);
    // effetti
    if (P.temp < 12) { P.hurt(dt * 0.55, true); if (!C._coldWarn) { C._coldWarn = 1; G.UI.toast('Stai congelando: vicino a un falò o con vestiti di lana (berretto, maglione, stivali)', 'warn'); } }
    else if (P.temp > 30) C._coldWarn = 0;
    if (P.temp > 88 && !P.swim) { P.hurt(dt * 0.5, true); if (!C._hotWarn) { C._hotWarn = 1; G.UI.toast('Colpo di calore: bevi, mettiti all’ombra o fai un bagno', 'warn'); } }
    else if (P.temp < 70) C._hotWarn = 0;
  }
  // moltiplicatori per sete, fame e passo
  C.thirstMul = () => { const b = G.Player.temp === undefined ? 50 : G.Player.temp; return 1 + Math.max(0, (b - 55) / 22) + C.cur.heat * 0.4; };
  C.hungerMul = () => { const b = G.Player.temp === undefined ? 50 : G.Player.temp; return 1 + Math.max(0, (40 - b) / 30); };
  C.speedMul = () => { const b = G.Player.temp === undefined ? 50 : G.Player.temp; return b < 25 ? 0.85 : 1; };
  G.Player.tempInfo = () => { const c = C.clothes(); return { warm: c.warm, cool: c.cool }; };

  /* ---------------- AGGIORNAMENTO ---------------- */
  const _l = {};
  C.flash = 0; C.bolt = null;
  C.update = function (dt, P, playing) {
    const host = !(G.Net && G.Net.on && !G.Net.isHost);
    if (playing && host && !C.state.lock) {
      C.state.t -= dt;
      if (C.state.t <= 0) C.setWeather(pickNext(C.state.kind), false);
    }
    // vento: la direzione generale gira piano, e di più a ogni cambio di tempo
    if (host) {
      if (C.windTarget === undefined) C.windTarget = G.Boats.wind.dir;
      if (Math.random() < dt * 0.004) C.windTarget += (Math.random() - 0.5) * 1.2;
      G.Boats.wind.dir += G.angleDiff(G.Boats.wind.dir, C.windTarget) * Math.min(1, dt * 0.03);
    }
    // valori locali sfumati
    C.localAt(P.pos.x, P.pos.z, _l);
    const k = Math.min(1, dt * 0.15);
    for (const key of ['cloud', 'rain', 'snow', 'storm', 'heat', 'dry', 'wind']) C.cur[key] += (_l[key] - C.cur[key]) * k;
    G.shared.uWet.value += ((C.cur.rain > 0.2 ? 1 : 0) - G.shared.uWet.value) * Math.min(1, dt * (C.cur.rain > 0.2 ? 0.05 : 0.008));
    G.shared.uDry.value += (C.cur.dry - G.shared.uDry.value) * Math.min(1, dt * 0.01);
    if (playing) { updateVortices(dt, P); updateBody(dt, P); }
    // fulmini
    C.flash = Math.max(0, C.flash - dt * 4);
    if (C.cur.storm > 0.5 && Math.random() < dt * 0.09 * C.cur.storm) lightning(P);
    if (C.bolt) { C.bolt.t -= dt; C.bolt.mesh.visible = C.bolt.t > 0 && (C.bolt.t > 0.12 || C.bolt.t % 0.06 < 0.03); if (C.bolt.t <= 0) { G.scene.remove(C.bolt.mesh); C.bolt.mesh.geometry.dispose(); C.bolt = null; } }
    Precip.update(dt, P);
    if (G.Audio && G.Audio.weather) G.Audio.weather(C.cur, C.trapped.size ? 1 : vortexNear(P));
  };
  function vortexNear(P) { let k = 0; for (const v of C.vort.values()) { const d = Math.hypot(P.pos.x - v.x, P.pos.z - v.z); k = Math.max(k, v.s * (1 - G.smooth(v.R, v.R * 3, d))); } return k; }
  function lightning(P) {
    C.flash = 1;
    const a = Math.random() * TAU, d = 120 + Math.random() * 500;
    const x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
    if (C.bolt) { G.scene.remove(C.bolt.mesh); C.bolt.mesh.geometry.dispose(); }
    const pts = []; let px = x, py = 260, pz = z;
    const gy = Math.max(G.SEA, G.heightAt(x, z));
    while (py > gy) { pts.push(new THREE.Vector3(px, py, pz)); px += (Math.random() - 0.5) * 18; pz += (Math.random() - 0.5) * 18; py -= 12 + Math.random() * 16; }
    pts.push(new THREE.Vector3(px, gy, pz));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.95, fog: false }));
    mesh.frustumCulled = false; mesh.renderOrder = 15; G.scene.add(mesh);
    C.bolt = { mesh, t: 0.28 };
    if (G.Audio && G.Audio.thunder) G.Audio.thunder(d);
  }
  // cielo: nuvole, luce velata, lampi, luna
  C.applySky = function (S) {
    const c = C.cur, over = G.smooth(0.45, 1.0, c.cloud);
    S.sunCol.multiplyScalar(1 - over * 0.68);
    S.light.multiplyScalar(1 - over * 0.62);
    const grey = (S.zen.r + S.zen.g + S.zen.b) / 3;
    S.zen.lerp(new THREE.Color(grey, grey, grey * 1.05).multiplyScalar(0.85), over * 0.7);
    const gh = (S.hor.r + S.hor.g + S.hor.b) / 3;
    S.hor.lerp(new THREE.Color(gh, gh, gh * 1.04), over * 0.6);
    S.glow.multiplyScalar(1 - over * 0.8);
    // di notte la luna illumina secondo la fase
    if (S.lightDir === S.moon) S.light.multiplyScalar(0.3 + C.moonLight() * 1.4);
    if (C.flash > 0) { const f = C.flash * C.flash; S.zen.addScalar(f * 0.5); S.hor.addScalar(f * 0.6); S.amb.addScalar(f * 0.4); }
    S.heat = c.heat;
  };

  /* ---------------- PIOGGIA E NEVE ---------------- */
  const Precip = (C.Precip = {});
  Precip.init = function () {
    const N = G.lowQ && G.lowQ() ? 900 : 2200;
    const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2 * 4);
    for (let i = 0; i < N; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random(), s = Math.random();
      for (let e = 0; e < 2; e++) { pos.set([0, e, 0], (i * 2 + e) * 3); seed.set([x, y, z, s], (i * 2 + e) * 4); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: G.shared.uTime, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uSnow: { value: 0 }, uWind: { value: new THREE.Vector2() }, uLight: { value: 1 } },
      vertexShader: `attribute vec4 aSeed; uniform float uTime, uSnow; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
        void main(){
          vec3 B = vec3(46.0, 28.0, 46.0);
          float sp = mix(17.0, 1.6, uSnow) * (0.8 + aSeed.w * 0.4);
          vec3 p = aSeed.xyz * B;
          p.y -= uTime * sp; p.xz += uWind * uTime * mix(0.35, 1.2, uSnow);
          if (uSnow > 0.5) { p.x += sin(uTime * 1.3 + aSeed.w * 40.0) * 0.6; p.z += cos(uTime * 1.1 + aSeed.w * 30.0) * 0.6; }
          p = mod(p - uCam + B * 0.5, B) - B * 0.5 + uCam;
          // la goccia è una striscia orientata con la caduta; il fiocco un trattino corto
          float len = mix(0.75, 0.06, uSnow);
          p.y += position.y * len; p.xz += position.y * uWind * len * 0.06;
          vA = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uAmt, uSnow, uLight; varying float vA;
        void main(){ float a = mix(0.32, 0.9, uSnow) * uAmt * mix(1.0 - vA * 0.6, 1.0, uSnow); gl_FragColor = vec4(vec3(0.78, 0.84, 0.9) * mix(0.55, 1.1, uSnow) * uLight, a); }`,
    });
    Precip.mesh = new THREE.LineSegments(g, mat); Precip.mesh.frustumCulled = false; Precip.mesh.renderOrder = 12; Precip.mesh.visible = false;
    G.scene.add(Precip.mesh);
  };
  Precip.update = function (dt, P) {
    if (!Precip.mesh) return;
    const c = C.cur, amt = Math.max(c.rain, c.snow);
    const m = Precip.mesh, u = m.material.uniforms;
    const covered = C._roofed || P.under;
    u.uAmt.value += ((covered ? amt * 0.25 : amt) - u.uAmt.value) * Math.min(1, dt * 2);
    m.visible = u.uAmt.value > 0.02;
    if (!m.visible) return;
    u.uCam.value.copy(G.camera.position);
    u.uSnow.value = c.snow > c.rain ? 1 : 0;
    const wd = C.windDirAt(P.pos.x, P.pos.z), ws = C.windLevel() * 0.9;
    u.uWind.value.set(Math.sin(wd) * ws, Math.cos(wd) * ws);
    u.uLight.value = 0.25 + (G.sky ? G.sky.day : 1) * 0.75 + C.flash * 1.5;
  };
  C.init = function () { Precip.init(); C.reset(); };
})();
