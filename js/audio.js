'use strict';
/* ==========================================================
   Audio sintetizzato (WebAudio), diviso in volumi separati:
   ambiente · stanze e grotte · animali · meteo · effetti · interfaccia.
   Nessun file audio: tutto è generato, quindi pesa zero e funziona
   uguale su Deriva.exe e nel browser del telefono.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const A = (G.Audio = { ctx: null, vol: 0.6, bus: {}, BED: 0.5 }); // BED: livello dei rumori di fondo continui (0.5 = -6 dB)
  // [chiave, nome, cosa comprende] — usato anche dal menu Impostazioni
  A.BUSES = [
    ['amb', 'Ambiente', 'mare, vento, uccelli, insetti, foglie'],
    ['room', 'Stanze e grotte', 'suono degli interni e delle gallerie, eco, gocce, fuoco'],
    ['ani', 'Animali', 'versi degli animali, vicini e lontani'],
    ['wx', 'Meteo', 'pioggia, tuoni, gorghi, cascate'],
    ['sfx', 'Effetti', 'passi, colpi, armi, attrezzi, barca'],
    ['ui', 'Interfaccia', 'clic, oggetti raccolti, monete'],
    ['mus', 'Musica', 'colonna sonora dei luoghi (per ora: i castelli)'],
  ];
  let noiseBuf = null;
  const env = { indoor: 0, cave: 0, under: 0, fire: 0, boat: 0 }; // 0..1, ammorbiditi
  let envT = 0, ambT = 0;

  /* ---------------- grafo ---------------- */
  A.start = function (vol) {
    if (A.ctx) { A.setVolume(vol); if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ctx = A.ctx;
    // sul telefono il suono parte solo dopo un tocco
    const resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
    document.addEventListener('touchend', resume, { passive: true }); document.addEventListener('mousedown', resume); document.addEventListener('keydown', resume);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    // limitatore finale: i suoni fortissimi (Kraken, tuoni, cannoni) non gracchiano
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12; comp.connect(lim); lim.connect(ctx.destination);
    A.master = ctx.createGain(); A.master.gain.value = vol === undefined ? 0.6 : vol; A.master.connect(comp);
    // i suoni "di fuori" (ambiente e meteo) passano da un filtro che si chiude al chiuso, in grotta e sott'acqua
    A.outside = ctx.createBiquadFilter(); A.outside.type = 'lowpass'; A.outside.frequency.value = 18000; A.outside.Q.value = 0.5;
    A.outsideG = ctx.createGain(); A.outside.connect(A.outsideG); A.outsideG.connect(A.master);
    // eco: riverbero generato (rumore che si spegne) — forte in grotta, leggero in casa
    A.revIn = ctx.createGain(); A.revIn.gain.value = 1;
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, G.isTouch ? 1.8 : 2.8, 2.6); // sul telefono un'eco più corta pesa meno
    A.revOut = ctx.createGain(); A.revOut.gain.value = 0.04;
    A.revIn.connect(conv); conv.connect(A.revOut); A.revOut.connect(A.master);
    const vols = (G.settings && G.settings.vols) || {};
    for (const [k] of A.BUSES) {
      const g = ctx.createGain(); g.gain.value = vols[k] === undefined ? 1 : vols[k];
      if (k === 'amb' || k === 'wx') g.connect(A.outside); else g.connect(A.master);
      if (k === 'sfx' || k === 'ani' || k === 'room') { const s = ctx.createGain(); s.gain.value = k === 'room' ? 0.7 : 0.45; g.connect(s); s.connect(A.revIn); }
      A.bus[k] = g;
    }
    A.bus.voice = ctx.createGain(); A.bus.voice.connect(A.master); // voci della chat (il volume si regola in Impostazioni > Voce)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.15 * w; d[i] = b * 0.9 + w * 0.02; } // quasi niente fruscio acuto nel rumore di base
    A.white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const wd = A.white.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    // tappeti continui: tutti passano da un taglio fisso di -6 dB (A.BED), così restano solo percettibili
    const bedTrim = {}; const trim = (bus) => { const t = ctx.createGain(); t.gain.value = A.BED; t.connect(A.bus[bus]); return t; };
    const loop = (bus, type, freq, q, buf) => { const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; s.loop = true; s.loopStart = Math.random(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(bedTrim[bus] || (bedTrim[bus] = trim(bus))); s.start(0, Math.random() * 2); return { s, f, g }; };
    A.sea = loop('amb', 'lowpass', 500, 0.4);
    A.wind = loop('amb', 'bandpass', 900, 2.5);
    A.leaves = loop('amb', 'highpass', 2600, 0.6, A.white);
    A.cicada = loop('amb', 'bandpass', 5200, 9, A.white);
    { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 38; lg.gain.value = 0.5; const am = ctx.createGain(); am.gain.value = 0.5; A.cicada.f.disconnect(); A.cicada.f.connect(am); am.connect(A.cicada.g); l.connect(lg); lg.connect(am.gain); l.start(); }
    A.under = loop('room', 'lowpass', 250, 0.7);
    A.roomIn = loop('room', 'lowpass', 240, 0.5);
    A.roomCave = loop('room', 'lowpass', 110, 1.0);
    A.caveMoan = loop('room', 'bandpass', 260, 12);
    A.fireLoop = loop('room', 'lowpass', 420, 0.6);
    A.hull = loop('sfx', 'bandpass', 380, 1.2);
    A.lava = loop('amb', 'lowpass', 70, 1.2);
    A.rain = loop('wx', 'highpass', 3200, 0.4);
    A.rainRoof = loop('room', 'bandpass', 1300, 0.8); // pioggia sul tetto, sentita da dentro
    A.rumble = loop('wx', 'lowpass', 110, 0.8);
    A.fallsL = loop('wx', 'lowpass', 1400, 0.5);
  };
  function impulse(ctx, dur, decay) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1); } }
    return b;
  }
  A.setVolume = (v) => { A.vol = v; if (A.master) A.master.gain.value = v; };
  A.setBus = (k, v) => { if (A.bus[k]) A.bus[k].gain.setTargetAtTime(v, A.ctx.currentTime, 0.05); };

  /* ---------------- mattoncini ---------------- */
  const now = () => A.ctx.currentTime;
  // ogni suono, ogni volta, leggermente più su o più giù (±10 cent): due suoni uguali insieme non fanno l'effetto "pettine"
  const CENT = () => (Math.random() * 2 - 1) * 10;
  const centRate = () => Math.pow(2, CENT() / 1200);
  function envl(g, t0, a, dcy, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dcy); }
  function noise(dur, type, freq, q, peak, delay, dest, buf) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; s.playbackRate.value = centRate(); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); envl(g, t0, 0.005, dur, peak); s.connect(f); f.connect(g); g.connect(dest || A.bus.sfx); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.1);
    return f;
  }
  function tone(type, f0, f1, dur, peak, delay, dest) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (delay || 0);
    const o = ctx.createOscillator(); o.type = type; o.detune.value = CENT(); o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain(); envl(g, t0, 0.01, dur, peak); o.connect(g); g.connect(dest || A.bus.sfx); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  // voce con formanti (muggiti, belati, ululati…): fonte → filtri di vocale → inviluppo
  //  pts: [[tempo 0..1, frequenza], …]  form: [[freq, q, guadagno], …]
  function voc(dest, o) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (o.delay || 0), dur = o.dur;
    const osc = ctx.createOscillator(); osc.type = o.wave || 'sawtooth'; osc.detune.value = CENT();
    const pts = o.pts || [[0, o.f0], [1, o.f1 || o.f0]];
    osc.frequency.setValueAtTime(pts[0][1], t0); for (let i = 1; i < pts.length; i++) osc.frequency.linearRampToValueAtTime(pts[i][1], t0 + pts[i][0] * dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    const g = ctx.createGain(), att = o.att || 0.04, pk = o.peak;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(pk, t0 + att); g.gain.setValueAtTime(pk, t0 + Math.max(att, dur * (o.hold || 0.65))); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (o.trem) { const l = ctx.createOscillator(), lg = ctx.createGain(), am = ctx.createGain(); l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1]; am.gain.value = 1 - o.trem[1]; l.connect(lg); lg.connect(am.gain); am.connect(g); l.start(t0); l.stop(t0 + dur + 0.1); var head = am; } else var head = g;
    if (o.form) for (const [f, q, k] of o.form) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const fg = ctx.createGain(); fg.gain.value = k * (o.fk || 3); osc.connect(bp); bp.connect(fg); fg.connect(head); }
    else osc.connect(head);
    if (o.breath) noise(dur * 0.9, 'bandpass', o.breath[0], o.breath[1], pk * o.breath[2], o.delay, head === g ? g : head);
    g.connect(dest); osc.start(t0); osc.stop(t0 + dur + 0.05);
    return osc;
  }
  // punto nello spazio: volume per distanza, panoramica destra/sinistra, alti che si perdono lontano
  function spot(bus, pos, dist, life) {
    const ctx = A.ctx, P = G.Player; let d = dist || 0;
    if (pos && P) { const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z; d = dist !== undefined ? dist : Math.hypot(dx, dz); }
    const g = ctx.createGain(); g.gain.value = (bus === 'ani' ? 1.6 : 1) / (1 + Math.pow(d / 7, 1.35));
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(700, 16000 * Math.exp(-d / 45));
    g.connect(f);
    let p = null;
    if (pos && ctx.createPanner) {
      // la sorgente sta ferma nel mondo: girandoti il suono passa da un orecchio all'altro
      p = ctx.createPanner(); p.panningModel = G.isTouch ? 'equalpower' : 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1; p.maxDistance = 10000;
      const y = pos.y !== undefined ? pos.y + 0.6 : (P ? P.pos.y + 1.2 : 0);
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, y, pos.z);
      f.connect(p); p.connect(A.bus[bus]);
    } else if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = (Math.random() - 0.5) * 0.6; f.connect(p); p.connect(A.bus[bus]); }
    else f.connect(A.bus[bus]);
    setTimeout(() => { try { g.disconnect(); f.disconnect(); if (p) p.disconnect(); } catch (e) {} }, (life || 4) * 1000 + 500);
    return g;
  }
  // l'ascoltatore è la testa del giocatore (posizione e direzione della camera)
  const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();
  function updateListener(P) {
    const L = A.ctx.listener, c = P.cam; if (!c) return;
    const p = c.getWorldPosition ? c.getWorldPosition(_lu.set(0, 0, 0)) : c.position;
    const px = p.x, py = p.y, pz = p.z;
    c.getWorldDirection(_lf); _lu.set(0, 1, 0).applyQuaternion(c.quaternion);
    if (L.positionX) { const t = A.ctx.currentTime; L.positionX.setTargetAtTime(px, t, 0.02); L.positionY.setTargetAtTime(py, t, 0.02); L.positionZ.setTargetAtTime(pz, t, 0.02); L.forwardX.setTargetAtTime(_lf.x, t, 0.02); L.forwardY.setTargetAtTime(_lf.y, t, 0.02); L.forwardZ.setTargetAtTime(_lf.z, t, 0.02); L.upX.setTargetAtTime(_lu.x, t, 0.02); L.upY.setTargetAtTime(_lu.y, t, 0.02); L.upZ.setTargetAtTime(_lu.z, t, 0.02); }
    else { L.setPosition(px, py, pz); L.setOrientation(_lf.x, _lf.y, _lf.z, _lu.x, _lu.y, _lu.z); }
  }
  const far = (bus, d) => { const P = G.Player; if (!P) return spot(bus, null, d); const a = Math.random() * 6.283; return spot(bus, { x: P.pos.x + Math.cos(a) * d, y: P.pos.y + 2, z: P.pos.z + Math.sin(a) * d }, d); }; // suono lontano senza posizione precisa
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------------- ambiente vivo ---------------- */
  function surroundings(P) {
    const x = P.pos.x, z = P.pos.z, h = G.heightAt(x, z), bi = G.biomeAt ? G.biomeAt(x, z) : 0, B = G.BIOME;
    const forest = bi === B.FORESTA || bi === B.PLUVIALE || bi === B.GIUNGLA ? 1 : 0;
    const lake = G.lakeNear ? G.lakeNear(x, z) : null, vol = G.volcanoNear ? G.volcanoNear(x, z) : null;
    return { h, bi, forest, lake: lake ? Math.max(0, 1 - lake.d / (lake.L.R * 1.6)) : 0, volc: vol ? 1 - vol.d / vol.v.R : 0 };
  }
  A.update = function (dt, t, P) {
    if (!A.ctx) return;
    if (smRaw) decodeAll();
    if (P) updateListener(P);
    musicUpdate(dt, P);
    if (A.body) A.body(dt, P);
    const n = now();
    // dove sono? (ricalcolato 4 volte al secondo)
    envT -= dt;
    if (A._force) { A._tgt = A._force.tgt; A._sur = A._force.sur; } // solo per le prove
    else if (envT <= 0) {
      envT = 0.25;
      const roof = G.Build && G.Build.ceilingAt ? G.Build.ceilingAt(P.pos.x, P.pos.z, P.pos.y + 1.8, 0.2) < P.pos.y + 7 : false;
      A._tgt = { cave: P.underground ? 1 : 0, indoor: roof && !P.underground ? 1 : 0, under: P.under ? 1 : 0, boat: P.boat ? 1 : 0, fire: fireNear(P) };
      A._sur = surroundings(P);
    }
    const tg = A._tgt || env, k = 1 - Math.exp(-dt * 3);
    for (const key in env) env[key] += ((tg[key] || 0) - env[key]) * k;
    const S = A._sur || { h: 0, bi: 0, forest: 0, lake: 0, volc: 0 };
    const out = Math.max(env.cave, env.under), shut = Math.max(out, env.indoor * 0.75);
    A.outside.frequency.setTargetAtTime(18000 * Math.pow(0.045, shut), n, 0.15);
    A.outsideG.gain.setTargetAtTime(1 - env.cave * 0.75 - env.indoor * 0.3 - env.under * 0.4, n, 0.2);
    A.revOut.gain.setTargetAtTime(0.03 + env.indoor * 0.16 + env.cave * 0.7, n, 0.3);
    // mare, vento, foglie, cicale
    const shore = Math.max(0, 1 - Math.abs(S.h) / 12);
    const swell = 0.6 + 0.4 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1), wind = G.shared.uWind.value;
    // onde: crescono e si ritirano (non un fruscio fisso), forti solo vicino alla riva
    const wave = Math.pow(Math.max(0, Math.sin(t * 0.85) * 0.5 + 0.5), 1.6) * (0.75 + 0.25 * Math.sin(t * 0.23));
    A.sea.g.gain.setTargetAtTime((0.022 + shore * 0.085 + env.boat * 0.03) * (0.3 + 0.7 * wave), n, 0.35);
    A.sea.f.frequency.setTargetAtTime(240 + wave * 420, n, 0.35);
    // col vento forte l'ululato cresce davvero (raffiche più lunghe e più acute)
    const wl = Math.max(0, Math.min(1, (wind - 0.08) / 1.9)), gust = 0.6 + 0.4 * Math.sin(t * (0.21 + wl * 0.3)) * Math.sin(t * (0.53 + wl * 0.4));
    A.wind.g.gain.setTargetAtTime((0.005 + wl * 0.01 + wl * wl * 0.055 + Math.min(0.02, Math.max(0, P.pos.y - 8) * 0.0012) + (S.bi === G.BIOME.NEVE ? 0.01 : 0)) * gust, n, 0.8);
    A.wind.f.frequency.setTargetAtTime(520 + wl * 650 + Math.sin(t * 0.3) * (250 + wl * 300), n, 0.5);
    A.leaves.g.gain.setTargetAtTime(S.forest * (0.0018 + wind * 0.003) * (0.35 + 0.65 * Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 0.37 + 2) * 0.5 + 0.5)), n, 0.8); // fruscio a raffiche
    const hot = G.Climate && G.Climate.airTemp ? G.clamp((G.Climate.airTemp(P.pos.x, P.pos.z) - 24) / 8, 0, 1) : 0;
    const cic = G.sky.day > 0.6 ? hot * (S.forest || S.bi === G.BIOME.DESERTO || S.bi === G.BIOME.PIANURA ? 1 : 0.3) : 0;
    A.cicada.g.gain.setTargetAtTime(cic * 0.004, n, 1.2);
    A.lava.g.gain.setTargetAtTime(Math.max(0, S.volc) * 0.15, n, 0.8);
    // stanze e grotte
    A.under.g.gain.setTargetAtTime(env.under * 0.15, n, 0.15);
    A.roomIn.g.gain.setTargetAtTime(env.indoor * 0.016, n, 0.4);
    A.roomCave.g.gain.setTargetAtTime(env.cave * 0.05, n, 0.4);
    A.caveMoan.g.gain.setTargetAtTime(env.cave * 0.008, n, 0.6); A.caveMoan.f.frequency.setTargetAtTime(230 + Math.sin(t * 0.13) * 60, n, 1);
    A.fireLoop.g.gain.setTargetAtTime(env.fire * 0.02, n, 0.3);
    A.hull.g.gain.setTargetAtTime(env.boat * (0.014 + Math.abs((P.boat && P.boat.speed) || 0) * 0.003) * swell, n, 0.3);
    A.hull.f.frequency.setTargetAtTime(320 + swell * 160, n, 0.4);
    // eventi a caso: ogni effetto ha la sua probabilità al secondo
    const day = G.sky.day > 0.55, night = G.sky.night > 0.6, outdoor = 1 - Math.max(env.cave, env.under), land = S.h > 1.5;
    const B = G.BIOME, bi = S.bi, wet = G.Climate && G.Climate.cur ? G.Climate.cur.rain : 0, calm = 1 - Math.min(1, wet * 1.5);
    const r = (rate) => Math.random() < dt * rate;
    if (outdoor > 0.5) {
      if (day && land && calm > 0.2) {
        if (bi === B.GIUNGLA || bi === B.PLUVIALE) { if (r(0.18 * calm)) A.parrot(); if (r(0.06 * calm)) A.monkey(); if (r(0.2)) A.chirp(); }
        else if (bi === B.FORESTA) { if (r(0.3 * calm)) A.chirp(); if (r(0.05)) A.cuckoo(); if (r(0.04)) A.woodpecker(); if (r(0.08)) A.blackbird(); }
        else if (bi === B.NEVE || bi === B.MONTAGNA) { if (r(0.05)) A.raven(); }
        else if (bi === B.PIANURA) { if (r(0.25 * calm)) A.chirp(); if (r(0.05)) A.dove(); if (r(0.03)) A.farAnimal(); }
        else if (bi === B.DESERTO) { if (r(0.03)) A.raven(); }
      }
      if (G.sky.day > 0.5 && shore > 0.25 && r(0.07)) A.gull();
      if (night && land) {
        if (bi !== B.NEVE && r(1.4 * calm)) A.cricket();
        if ((S.lake > 0 || bi === B.GIUNGLA || bi === B.PLUVIALE) && r(0.9 * Math.max(S.lake, 0.4))) A.frog();
        if (S.forest && r(0.04)) A.owl();
        if ((bi === B.FORESTA || bi === B.NEVE || bi === B.MONTAGNA) && r(0.012)) A.howl(rnd(120, 300));
      }
      if (S.volc > 0.2 && r(0.3 * S.volc)) A.lavaPop(S.volc);
    }
    if (env.cave > 0.5 && r(0.6)) A.drip();
    if (env.under > 0.5 && r(0.8)) A.bubbles();
    if (env.fire > 0.05 && r(9 * env.fire)) A.crackle(env.fire);
    if (env.indoor > 0.5 && wet > 0.2) A.rainRoof.g.gain.setTargetAtTime(wet * 0.035, n, 0.5); else A.rainRoof.g.gain.setTargetAtTime(0, n, 0.5);
  };
  function fireNear(P) {
    let k = P.heldTorch ? 0.35 : 0;
    if (G.Build && G.Build.pieces) for (const p of G.Build.pieces) {
      if (!p.light) continue; const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z, (p.y || 0) - P.pos.y); if (d > 9) continue;
      k = Math.max(k, (1 - d / 9) * (p.t === 'falo' || p.t === 'falò' ? 1 : 0.45));
    }
    return k;
  }

  /* ---------------- meteo ---------------- */
  A.weather = function (c, vort) {
    if (!A.ctx || !A.rain) return;
    const n = now();
    A.rain.g.gain.setTargetAtTime((c.rain * 0.085 + c.storm * 0.035) * (1 - env.indoor * 0.6), n, 0.6);
    A.rumble.g.gain.setTargetAtTime(Math.min(1, vort) * 0.3, n, 0.6);
  };
  A.falls = function (k) { if (A.fallsL) A.fallsL.g.gain.setTargetAtTime(k * 0.18, now(), 0.4); };
  A.thunder = function (dist) {
    if (!A.ctx) return;
    const delay = Math.min(3.5, dist / 340), v = Math.max(0.25, 1 - dist / 800), W = A.bus.wx;
    noise(0.25, 'highpass', 1500, 0.5, 0.35 * v * (dist < 200 ? 1 : 0.3), delay, W);
    noise(2.8, 'lowpass', 160, 0.8, 1.0 * v, delay + 0.05, W);
    noise(1.8, 'lowpass', 90, 0.8, 0.8 * v, delay + 0.4, W);
    noise(1.2, 'lowpass', 220, 0.6, 0.4 * v, delay + 1.1 + Math.random(), W);
  };

  /* ---------------- effetti ---------------- */
  const U = () => A.bus.ui;
  // risonanza "modale": il corpo colpito vibra su poche frequenze non armoniche che si spengono
  //  (legno: basse e brevi; pietra: medie e secche; metallo: alte e lunghe). Ogni colpo varia un po'.
  const MODES = {
    wood: { f: [1, 2.32, 3.9, 5.6], d: [0.16, 0.09, 0.06, 0.04], g: [1, 0.5, 0.3, 0.15], base: [170, 260], n: ['bandpass', 1100, 1.6, 0.05] },
    stone: { f: [1, 1.73, 2.61, 3.48], d: [0.05, 0.04, 0.03, 0.02], g: [1, 0.6, 0.4, 0.3], base: [900, 1500], n: ['highpass', 2600, 0.8, 0.04] },
    metal: { f: [1, 2.76, 5.4, 8.93], d: [0.9, 0.6, 0.4, 0.25], g: [1, 0.55, 0.35, 0.2], base: [520, 900], n: ['highpass', 4200, 0.7, 0.02] },
    flesh: { f: [1, 1.5], d: [0.08, 0.05], g: [1, 0.4], base: [90, 140], n: ['lowpass', 700, 0.9, 0.12] },
  };
  function modal(kind, peak, delay, dest, pitch) {
    if (!A.ctx) return; const M = MODES[kind], b0 = rnd(M.base[0], M.base[1]) * (pitch || 1);
    for (let i = 0; i < M.f.length; i++) { const f = b0 * M.f[i] * rnd(0.97, 1.03); tone('sine', f, f * 0.985, M.d[i] * rnd(0.8, 1.2), peak * M.g[i] * 0.35, delay, dest); }
    const [t, fq, q, dur] = M.n; noise(dur * rnd(0.8, 1.3), t, fq * rnd(0.85, 1.15), q, peak * 0.8, delay, dest, A.white);
  }
  A.modal = modal;
  A.hit = (k) => {
    if (k === 'wood') { modal('wood', 0.55); noise(0.05, 'lowpass', 500, 1, 0.35); }
    else if (k === 'stone') { modal('stone', 0.4); for (let i = 0; i < 3; i++) noise(0.02, 'bandpass', rnd(2500, 5000), 2, 0.12, 0.03 + i * rnd(0.02, 0.05), undefined, A.white); }
    else if (k === 'metal') modal('metal', 0.3);
    else if (k === 'leaf') { noise(0.25, 'highpass', rnd(2600, 3600), 0.5, 0.22, 0, undefined, A.white); noise(0.18, 'bandpass', 1400, 0.8, 0.1, 0.04); }
    else { modal('flesh', 0.5); }
  };
  A.thud = () => { noise(0.5, 'lowpass', 220, 1, 0.9); tone('sine', 90, 40, 0.45, 0.5); modal('wood', 0.25, 0.01, undefined, 0.6); for (let i = 0; i < 4; i++) noise(0.05, 'bandpass', rnd(600, 1400), 1.5, 0.12, 0.12 + i * rnd(0.05, 0.12)); };
  A.creak = () => { const f = rnd(120, 180); tone('sawtooth', f, f * 0.75, rnd(0.5, 0.8), 0.03); tone('sawtooth', f * 1.5, f * 1.2, 0.4, 0.012, rnd(0.15, 0.3)); };
  A.place = () => { modal('wood', 0.4, 0, undefined, 0.8); noise(0.06, 'lowpass', 700, 1, 0.3); noise(0.12, 'bandpass', 1600, 0.6, 0.06, 0.04, undefined, A.white); };
  A.door = () => { const f = rnd(260, 340); tone('sawtooth', f, f * 0.6, 0.45, 0.035); tone('sawtooth', f * 1.33, f * 0.9, 0.3, 0.012, 0.08); modal('wood', 0.35, 0.42, undefined, 0.7); };
  A.eat = (drink) => { if (A.ctx && playS(drink ? 'beve' : 'mangia', A.bus.sfx, { vol: 0.8 })) return; A.eat0(); };
  A.eat0 = () => { for (let i = 0; i < 4; i++) { const t = i * rnd(0.11, 0.16); noise(0.05, 'bandpass', rnd(1400, 2600), 1.6, 0.28, t, undefined, A.white); noise(0.07, 'lowpass', 500, 1, 0.12, t + 0.01); } tone('sine', 300, 180, 0.12, 0.04, 0.6); };
  A.splash = () => {
    noise(0.5, 'lowpass', rnd(1300, 1900), 0.6, 0.5); noise(0.3, 'highpass', 4000, 0.5, 0.15, 0.05, undefined, A.white); tone('sine', 220, 70, 0.25, 0.12);
    // bollicine e gocce che ricadono
    for (let i = 0; i < 6; i++) { const f = rnd(700, 1800), d = 0.12 + i * rnd(0.04, 0.09); tone('sine', f, f * 1.8, 0.04, 0.03, d); }
  };
  // passi: il terreno sotto i piedi cambia il suono
  A.surface = function (P) {
    const x = P.pos.x, z = P.pos.z, th = G.World.groundAt(x, z), bh = G.Build.groundAt(x, z, P.pos.y, 0.05);
    if (P.boat) return 'wood';
    if (bh > th + 0.05 && Math.abs(P.pos.y - bh) < 0.4) return 'wood';
    if (P.underground) return 'stone';
    if (G.iceAt && G.iceAt(x, z) && th < 0.6) return 'ice';
    const bi = G.biomeAt(x, z);
    if (bi === G.BIOME.NEVE && th > 1) return 'snow';
    if (th < 2) return 'sand';
    if (bi === G.BIOME.VULCANO) return 'gravel';
    if (th > 26 || (G.normalAt && G.normalAt(x, z)[1] < 0.78)) return 'stone';
    return 'grass';
  };
  // passi: tallone e punta, granuli per neve, ghiaia e sabbia
  A.step = (k) => {
    const v = 1 + (Math.random() - 0.5) * 0.35, W = A.white;
    if (k === 'water') { noise(0.2, 'lowpass', rnd(900, 1400), 0.6, 0.18 * v); noise(0.12, 'highpass', 3000, 0.5, 0.03 * v, 0.05, undefined, W); }
    else if (k === 'sand') { noise(0.1, 'highpass', rnd(1500, 2100), 0.4, 0.06 * v, 0, undefined, W); noise(0.08, 'lowpass', 600, 0.7, 0.05 * v, 0.03); }
    else if (k === 'wood') { modal('wood', 0.13 * v, 0, undefined, 0.75); noise(0.05, 'lowpass', 400, 1, 0.08 * v, 0.06); if (Math.random() < 0.12) A.creak(); }
    else if (k === 'stone') { noise(0.04, 'bandpass', rnd(2000, 2800), 1.4, 0.08 * v); noise(0.05, 'lowpass', 350, 1, 0.08 * v); noise(0.03, 'highpass', 4500, 0.7, 0.025 * v, 0.05, undefined, W); }
    else if (k === 'snow') { for (let i = 0; i < 4; i++) noise(0.05, 'bandpass', rnd(700, 1400), 1, 0.05 * v, i * 0.035); noise(0.1, 'lowpass', 400, 0.7, 0.05 * v); }
    else if (k === 'ice') { noise(0.035, 'highpass', 3000, 0.8, 0.06 * v, 0, undefined, W); tone('sine', rnd(1900, 2500), 1700, 0.06, 0.012 * v); }
    else if (k === 'gravel') { for (let i = 0; i < 5; i++) noise(0.025, 'bandpass', rnd(1600, 3800), 1.5, 0.045 * v, i * rnd(0.015, 0.03), undefined, W); noise(0.06, 'lowpass', 400, 1, 0.05 * v); }
    else { noise(0.08, 'lowpass', 500, 0.8, 0.07 * v); noise(0.1, 'bandpass', rnd(1100, 1600), 0.8, 0.05 * v, 0.03); noise(0.09, 'highpass', 3200, 0.5, 0.015 * v, 0.05, undefined, W); }
  };
  A.pickup = () => { const f = rnd(560, 700); tone('sine', f, f * 1.5, 0.07, 0.08, 0, U()); tone('triangle', f * 2, f * 2.4, 0.05, 0.025, 0.03, U()); };
  A.craft = () => { modal('wood', 0.3, 0, undefined, 1.2); modal('wood', 0.25, 0.14, undefined, 1.4); tone('triangle', 523, 523, 0.12, 0.08, 0.22, U()); tone('triangle', 784, 784, 0.18, 0.07, 0.3, U()); };
  A.click = () => tone('sine', 900, 700, 0.04, 0.05, 0, U());
  A.coins = () => { for (let i = 0; i < 5; i++) tone('triangle', 1800 + Math.random() * 900, 1500, 0.08, 0.05, i * 0.06, U()); };
  A.bow = () => { if (A.ctx && playS('arco_scocca', A.bus.sfx, { vol: 0.9 })) return; A.bow0(); };
  A.bow0 = () => { const f = rnd(180, 230); tone('triangle', f, f * 0.98, 0.35, 0.14); tone('sine', f * 2.01, f * 2, 0.25, 0.05); noise(0.04, 'bandpass', 900, 2, 0.2); noise(0.35, 'bandpass', 2400, 0.8, 0.05, 0.03, undefined, A.white); };
  A.draw = () => { if (A.ctx && playS('arco_tende', A.bus.sfx, { vol: 0.8 })) return; A.draw0(); };
  A.draw0 = () => { tone('sawtooth', 120, 180, 0.4, 0.015); };
  A.gun = () => { noise(0.6, 'lowpass', 900, 0.7, 1.0); noise(0.1, 'highpass', 2500, 0.6, 0.6, 0, undefined, A.white); tone('sine', 120, 40, 0.4, 0.6); noise(1.6, 'lowpass', 300, 0.5, 0.18, 0.08); modal('metal', 0.05, 0.6, undefined, 1.6); };
  A.dig = () => { noise(0.18, 'lowpass', rnd(550, 800), 0.8, 0.45); for (let i = 0; i < 4; i++) noise(0.03, 'bandpass', rnd(1500, 3000), 1.5, 0.08, 0.06 + i * rnd(0.03, 0.07), undefined, A.white); noise(0.25, 'lowpass', 300, 0.7, 0.12, 0.12); };
  A.chest = () => { modal('metal', 0.12, 0, undefined, 1.3); const f = rnd(140, 180); tone('sawtooth', f, f * 0.7, 0.5, 0.03, 0.06); modal('wood', 0.35, 0.5, undefined, 0.65); };
  // cannonata: boato basso, attenuato con la distanza
  A.cannon = (d) => { const k = Math.max(0.12, Math.min(1, 30 / Math.max(10, d || 10))); noise(1.4, 'lowpass', 420 * (0.6 + k * 0.4), 0.8, 1.1 * k); noise(0.25, 'bandpass', 1600, 0.8, 0.5 * k); tone('sine', 70, 28, 1.1, 0.9 * k); noise(2.2, 'lowpass', 260, 0.5, 0.25 * k, 0.15); };
  // il ruggito del Kraken: gorgoglio profondo che sale
  A.roar = () => { tone('sawtooth', 55, 38, 2.6, 0.35); tone('sawtooth', 82, 50, 2.4, 0.22, 0.1); noise(2.8, 'lowpass', 380, 3, 0.5); noise(2.2, 'bandpass', 160, 6, 0.4, 0.3); };
  // pipistrello: squittii acuti e brevi, più deboli da lontano
  A.bat = (d) => { const k = Math.max(0.15, Math.min(1, 6 / Math.max(2, d || 4))); for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) { const f = rnd(6500, 9500); tone('sine', f, f * 0.82, 0.025, 0.02 * k, i * rnd(0.04, 0.09)); } noise(0.06, 'highpass', 6000, 0.6, 0.012 * k, 0, undefined, A.white); };
  A.bell = () => { for (const [f, d] of [[660, 0], [880, 0.02], [1320, 0.04]]) tone('sine', f, f * 0.995, 2.2, 0.06, d); };

  /* ---------------- stanze, grotte, fuoco, acqua ---------------- */
  A.drip = () => { const d = spot('room', null, rnd(2, 14), 2), f = rnd(1100, 1900); tone('sine', f, f * 2.1, 0.05, 0.12, 0, d); tone('sine', f * 1.4, f * 2.6, 0.04, 0.05, 0.07, d); };
  A.crackle = (k) => { const d = A.bus.room; noise(rnd(0.008, 0.025), 'highpass', rnd(1500, 4000), 0.7, rnd(0.05, 0.25) * k, 0, d, A.white); };
  A.bubbles = () => { const d = far('room', rnd(1, 4)); const n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) { const f = rnd(300, 700); tone('sine', f, f * 1.8, 0.06, 0.06, i * rnd(0.05, 0.12), d); } };
  A.lavaPop = (k) => { const d = far('amb', rnd(10, 40)); noise(0.15, 'lowpass', 300, 1, 0.3 * k, 0, d); tone('sine', 90, 40, 0.2, 0.2 * k, 0.02, d); };

  /* ---------------- uccelli e insetti ---------------- */
  const amb = (d) => far('amb', d === undefined ? rnd(10, 45) : d);
  A.chirp = () => { const d = amb(), f = rnd(2500, 4300), n = 2 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) tone('sine', f * rnd(0.9, 1.1), f * rnd(1.2, 1.7), 0.07, 0.05, i * 0.11, d); };
  A.blackbird = () => { const d = amb(rnd(15, 40)); let t = 0; for (let i = 0; i < 6; i++) { const f = rnd(1600, 3200), l = rnd(0.08, 0.22); tone('sine', f, f * rnd(0.8, 1.3), l, 0.05, t, d); t += l + rnd(0.02, 0.08); } };
  A.cuckoo = () => { const d = amb(rnd(40, 90)); for (let r = 0; r < 2 + (Math.random() * 2 | 0); r++) { tone('sine', 690, 680, 0.18, 0.12, r * 0.75, d); tone('sine', 565, 555, 0.3, 0.12, r * 0.75 + 0.24, d); } };
  A.woodpecker = () => { const d = amb(rnd(25, 60)); for (let i = 0; i < 14; i++) noise(0.012, 'bandpass', 1300, 4, 0.5 * (1 - i / 20), i * 0.045, d, A.white); };
  A.dove = () => { const d = amb(rnd(20, 50)); [[0, 0.3], [0.45, 0.25], [0.8, 0.55]].forEach(([t, l]) => voc(d, { wave: 'sine', pts: [[0, 480], [0.3, 540], [1, 470]], dur: l, peak: 0.08, att: 0.06, delay: t })); };
  A.gull = () => { const d = amb(rnd(20, 60)); for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) voc(d, { pts: [[0, 1250], [0.25, 1650], [1, 1100]], dur: 0.32, peak: 0.05, att: 0.02, delay: i * 0.42, form: [[1800, 5, 1], [3000, 6, 0.5]] }); };
  A.raven = () => { const d = amb(rnd(30, 80)); for (let i = 0; i < 2; i++) voc(d, { pts: [[0, 520], [1, 400]], dur: 0.35, peak: 0.07, att: 0.02, delay: i * 0.5, form: [[900, 4, 1], [1500, 6, 0.6]], breath: [1200, 2, 0.4] }); };
  A.parrot = () => { const d = amb(rnd(15, 50)); voc(d, { pts: [[0, 1400], [0.4, 1800], [1, 1150]], dur: 0.3, peak: 0.07, att: 0.015, form: [[1900, 4, 1], [3200, 5, 0.6]], breath: [2500, 1.5, 0.3] }); if (Math.random() < 0.5) voc(d, { pts: [[0, 1600], [1, 1250]], dur: 0.22, peak: 0.05, att: 0.015, delay: 0.38, form: [[2100, 4, 1]] }); };
  A.monkey = () => { const d = amb(rnd(50, 140)); let t = 0; for (let i = 0; i < 5; i++) { const f = 300 + i * 90; voc(d, { pts: [[0, f], [0.6, f * 1.5], [1, f * 1.2]], dur: 0.28, peak: 0.08, att: 0.03, delay: t, form: [[700, 3, 1], [1200, 4, 0.5]] }); t += 0.32 - i * 0.03; } };
  A.cricket = () => { const d = amb(rnd(4, 25)), f = rnd(4200, 4700); for (let i = 0; i < 3; i++) tone('square', f, f, 0.025, 0.01, i * 0.05, d); };
  A.frog = () => { const d = amb(rnd(6, 35)), f = rnd(140, 230); for (let i = 0; i < 1 + (Math.random() * 3 | 0); i++) voc(d, { wave: 'square', pts: [[0, f], [1, f * 0.85]], dur: 0.2, peak: 0.06, att: 0.01, delay: i * 0.28, trem: [32, 0.9], form: [[500, 3, 1], [1200, 4, 0.4]] }); };
  A.owl = () => { const d = amb(rnd(25, 70)); [[0, 0.35], [0.7, 0.15], [0.95, 0.6]].forEach(([t, l]) => voc(d, { wave: 'sine', pts: [[0, 410], [0.2, 440], [1, 380]], dur: l, peak: 0.08, att: 0.05, delay: t, vib: [5, 4] })); };

  /* ---------------- animali ---------------- */
  // ogni specie: verso normale e verso di dolore (quando la colpisci)
  const CALLS = {
    mucca: (d, hurt) => voc(d, { pts: hurt ? [[0, 160], [0.4, 190], [1, 130]] : [[0, 96], [0.25, 118], [0.8, 112], [1, 92]], dur: hurt ? 0.6 : 1.5, peak: 0.22, att: 0.12, vib: [5, 2], form: [[320, 5, 1], [750, 7, 0.55], [2300, 10, 0.15]], breath: [600, 1, 0.15] }),
    pecora: (d, hurt) => voc(d, { pts: [[0, hurt ? 440 : 330], [1, hurt ? 400 : 290]], dur: hurt ? 0.45 : 0.85, peak: 0.16, att: 0.03, vib: [7.5, hurt ? 30 : 20], form: [[520, 5, 1], [1850, 8, 0.6], [2600, 10, 0.3]] }),
    gallina: (d, hurt) => {
      if (hurt) { voc(d, { wave: 'square', pts: [[0, 1100], [0.3, 1400], [1, 800]], dur: 0.4, peak: 0.1, att: 0.01, form: [[1300, 4, 1], [2800, 6, 0.4]], breath: [3000, 1, 0.5] }); return; }
      const n = 3 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) voc(d, { wave: 'square', pts: [[0, rnd(620, 820)], [1, 520]], dur: 0.07, peak: 0.1, att: 0.006, delay: i * rnd(0.1, 0.16), form: [[950, 4, 1], [2500, 6, 0.35]] });
      if (Math.random() < 0.3) voc(d, { wave: 'square', pts: [[0, 700], [0.5, 1000], [1, 750]], dur: 0.35, peak: 0.08, att: 0.02, delay: n * 0.14 + 0.05, form: [[1100, 4, 1], [2600, 6, 0.4]] });
    },
    maiale: (d, hurt) => {
      if (hurt) { voc(d, { pts: [[0, 600], [0.3, 950], [1, 520]], dur: 0.55, peak: 0.13, att: 0.02, form: [[900, 4, 1], [1800, 6, 0.5]], breath: [1200, 1.5, 0.3] }); return; }
      for (let i = 0; i < 2; i++) voc(d, { pts: [[0, 190], [1, 140]], dur: 0.2, peak: 0.16, att: 0.015, delay: i * 0.26, form: [[560, 4, 1], [1100, 5, 0.6]], breath: [600, 3, 0.6] });
    },
    coniglio: (d, hurt) => { if (hurt) tone('sine', 2200, 1500, 0.12, 0.08, 0, d); else noise(0.05, 'bandpass', 3000, 2, 0.04, 0, d); },
    tartaruga: (d) => noise(0.5, 'highpass', 2500, 0.5, 0.03, 0, d),
    lupo: (d, hurt, dist) => {
      if (hurt) { voc(d, { pts: [[0, 900], [0.3, 1200], [1, 700]], dur: 0.35, peak: 0.14, att: 0.01, form: [[1200, 4, 1], [2400, 5, 0.5]] }); return; }
      if (dist >= 45 && G.sky.night > 0.5) return howlTo(d); // l'ululato solo da lontano
      voc(d, { pts: [[0, 90], [1, 75]], dur: 1.0, peak: 0.2, att: 0.08, trem: [24, 0.7], form: [[350, 3, 1], [800, 4, 0.5]], breath: [400, 1, 0.5] });
    },
    orso: (d, hurt) => voc(d, { pts: hurt ? [[0, 220], [1, 150]] : [[0, 120], [0.3, 140], [1, 70]], dur: hurt ? 0.6 : 1.3, peak: 0.17, att: 0.06, trem: [18, 0.4], form: [[420, 3, 1], [950, 4, 0.6]], breath: [500, 1, 0.8] }),
    giaguaro: (d, hurt) => { const n = hurt ? 1 : 4 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) voc(d, { pts: [[0, hurt ? 300 : 150], [1, hurt ? 220 : 120]], dur: 0.22, peak: 0.14, att: 0.02, delay: i * 0.34, form: [[480, 3, 1], [1100, 4, 0.5]], breath: [800, 1, 0.9] }); },
    serpente: (d) => noise(1.1, 'highpass', 4500, 0.6, 0.12, 0, d, A.white),
    coccodrillo: (d, hurt) => { voc(d, { pts: [[0, 62], [1, 55]], dur: hurt ? 0.5 : 1.4, peak: 0.25, att: 0.1, trem: [14, 0.6], form: [[200, 3, 1], [500, 4, 0.4]] }); noise(0.6, 'highpass', 3500, 0.5, 0.05, 0.2, d); },
    squalo: (d) => {},
    pirata: (d, hurt) => voc(d, { pts: hurt ? [[0, 210], [1, 150]] : [[0, rnd(120, 160)], [1, 105]], dur: hurt ? 0.3 : 0.35, peak: 0.12, att: 0.02, form: [[700, 6, 1], [1150, 8, 0.6], [2500, 10, 0.2]], breath: [1500, 1, 0.2] }),
  };
  CALLS.capitano = CALLS.pirata;
  function howlTo(d) { voc(d, { wave: 'triangle', pts: [[0, 360], [0.2, 700], [0.75, 650], [1, 430]], dur: 3.2, peak: 0.12, att: 0.4, hold: 0.7, vib: [5, 7], form: [[650, 3, 1], [1050, 4, 0.5]], fk: 2 }); }
  // l'ululato vero solo da lontano (vicino il lupo ringhia)
  A.howl = (dist) => { dist = Math.max(45, dist || 150); if (!playS('lupo_ulula', far('ani', dist), { life: 9 })) howlTo(far('ani', dist)); };
  // versi lontani di animali da fattoria, per non sentire la pianura vuota
  A.farAnimal = () => { const sp = ['mucca', 'pecora', 'gallina'][Math.random() * 3 | 0]; const d = far('ani', rnd(50, 120)); if (!playS(SAMPLE_CALL[sp], d, { life: 4 })) CALLS[sp](d, false, 80); };
  // registrazioni vere (assets/audio): se ci sono si usano, altrimenti il verso sintetizzato
  const SAMPLE_CALL = { mucca: 'mucca', pecora: 'pecora', maiale: 'maiale', gallina: 'gallina', orso: 'orso' };
  const SAMPLE_HURT = { mucca: 'mucca_dolore', maiale: 'maiale_dolore', pirata: 'pirata_dolore', capitano: 'pirata_dolore' };
  A.animal = function (sp, dist, pos, baby) {
    if (!A.ctx) return;
    // il lupo: ulula solo quando è lontano; da vicino ringhia
    if (sp === 'lupo') { if ((dist || 0) >= 45 && G.sky.night > 0.5) return A.howl(dist); if (CALLS.lupo) CALLS.lupo(spot('ani', pos, dist, 3), false, 0); return; }
    const grp = baby && sp === 'pecora' ? 'agnello' : SAMPLE_CALL[sp];
    if (grp && hasS(grp)) { playS(grp, spot('ani', pos, dist, lenS(grp) + 0.5), { base: baby ? 1.22 : 1 }); return; }
    if (CALLS[sp]) CALLS[sp](spot('ani', pos, dist, 4), false, dist || 0);
  };
  A.animalHurt = function (sp, pos) {
    if (!A.ctx) return;
    const grp = SAMPLE_HURT[sp]; if (grp && hasS(grp)) { playS(grp, spot('ani', pos, undefined, lenS(grp) + 0.5), {}); return; }
    if (CALLS[sp]) CALLS[sp](spot('ani', pos, undefined, 2), true, 0);
  };
  /* ---------------- registrazioni ---------------- */
  const SM = (A.samples = {}); let smRaw = null;
  A.loadSamples = async function (base) {
    try {
      const list = await (await fetch(base + 'suoni.json')).json(); smRaw = [];
      for (const [dir, names] of Object.entries(list)) for (const n of names) smRaw.push({ n, url: base + dir + '/' + n + '.mp3', dir });
      await Promise.all(smRaw.map(async (r) => { try { r.buf = await (await fetch(r.url)).arrayBuffer(); } catch (e) { } }));
      if (A.ctx) decodeAll();
    } catch (e) { console.warn('suoni registrati non disponibili', e); }
  };
  async function decodeAll() {
    if (!smRaw || !A.ctx) return; const raw = smRaw; smRaw = null;
    for (const r of raw) {
      if (!r.buf) continue;
      try { const b = await A.ctx.decodeAudioData(r.buf); const g = r.n.replace(/_\d+$/, ''); (SM[g] = SM[g] || []).push(b); } catch (e) { }
    }
  }
  const hasS = (g) => !!(SM[g] && SM[g].length);
  const lenS = (g) => hasS(g) ? Math.max(...SM[g].map((b) => b.duration)) : 2;
  function playS(g, dest, o) {
    if (!A.ctx || !hasS(g)) return false; o = o || {};
    const L = SM[g], b = L.length > 1 ? L[(Math.random() * L.length) | 0] : L[0];
    const s = A.ctx.createBufferSource(); s.buffer = b;
    s.playbackRate.value = (o.base || 1) * centRate();
    const g2 = A.ctx.createGain(); g2.gain.value = o.vol || 1; s.connect(g2); g2.connect(dest || A.bus.sfx);
    s.start(); return b.duration;
  }
  A.playS = playS; A.hasS = hasS;
  /* ---------------- musica dei luoghi ---------------- */
  let mus = null;
  A.music = function (name) {
    if (!A.ctx || !A.bus.mus) return;
    if (mus && mus.name === name) return;
    const t = A.ctx.currentTime;
    if (mus) { const old = mus; old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0, t, 1.2); setTimeout(() => { try { old.s.stop(); } catch (e) { } }, 6000); mus = null; }
    if (!name || !hasS(name)) return;
    const s = A.ctx.createBufferSource(); s.buffer = SM[name][0]; s.loop = true;
    const g = A.ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.55, t, 1.5);
    s.connect(g); g.connect(A.bus.mus); s.start(); mus = { name, s, g };
  };
  let musT = 0;
  function musicUpdate(dt, P) {
    if ((musT -= dt) > 0) return; musT = 1.5;
    let want = null;
    if (G.POI && G.started && !(G.UI && G.UI.menu === 'main')) {
      const c = G.POI.near(P.pos.x, P.pos.z, 140, 'castello')[0];
      if (c && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 120) want = 'castello';
    }
    A.music(want);
  }
  A.grunt = (dist, pos) => { if (!A.ctx) return; if (!playS('pirata', spot('ani', pos, dist, lenS('pirata') + 0.5))) CALLS.pirata(spot('ani', pos, dist, 2), false); };
  // un suono registrato in un punto del mondo (gruppo, posizione, opzioni: bus, vol); restituisce false se non c'è
  A.at = function (grp, pos, o) { if (!A.ctx || !hasS(grp)) return false; o = o || {}; return playS(grp, spot(o.bus || 'sfx', pos, o.dist, lenS(grp) + 0.5), o); };
  A.pirateAttack = (pos) => { if (A.ctx && !A.at('pirata_attacco', pos, { bus: 'ani' })) CALLS.pirata(spot('ani', pos, undefined, 2), false); };
  A.KRAKEN_DB = 11;
  A.kraken = function (kind, pos) {
    if (!A.ctx) return;
    const grp = { voce: 'kraken', breve: 'kraken_breve', ferito: 'kraken_ferito', morte: 'kraken_morte', tonfo: 'splash', movimento: 'kraken_movimento' }[kind] || 'kraken';
    // il Kraken si sente forte: +10 dB rispetto agli altri versi (×3,16)
    const k = Math.pow(10, A.KRAKEN_DB / 20);
    if (!A.at(grp, pos, { bus: kind === 'tonfo' || kind === 'movimento' ? 'sfx' : 'ani', vol: (kind === 'tonfo' || kind === 'movimento' ? 1.1 : 1.4) * k })) { if (kind === 'movimento') return; if (kind === 'tonfo') A.splash(); else A.roar(); }
  };
  // saluto di un abitante (dalla sua posizione)
  A.greet = (pos) => A.at('abitante_saluto', pos, { bus: 'ani', vol: 0.9 });
  /* battito e respiro: due anelli continui che salgono e scendono col bisogno */
  const loops = {};
  function loopTo(name, grp, v) {
    if (!A.ctx || !hasS(grp)) return;
    let L = loops[name];
    if (!L) {
      if (v < 0.01) return;
      const s = A.ctx.createBufferSource(); s.buffer = SM[grp][0]; s.loop = true;
      const g = A.ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(A.bus.sfx); s.start(); L = loops[name] = { s, g, v: 0 };
    }
    L.g.gain.setTargetAtTime(v, A.ctx.currentTime, 0.6);
    if (v < 0.005) { L.off = (L.off || 0) + 1; if (L.off > 20) { const o = L; setTimeout(() => { try { o.s.stop(); } catch (e) { } }, 3000); delete loops[name]; } } else L.off = 0;
  }
  let fat = 0, lastOx = 100, gasp = 0;
  A.body = function (dt, P) {
    if (!A.ctx || !P) return;
    const dead = P.dead || !G.started;
    // battito: sotto il 35% di vita, più forte quanto più sei grave
    const hp = P.health === undefined ? 100 : P.health;
    loopTo('cuore', 'battito_loop', dead ? 0 : G.clamp((35 - hp) / 25, 0, 1) * 0.75);
    // respiro affannato: dopo una lunga corsa o tornando a galla senz'aria
    const moving = P.vel && P.vel.lengthSq() > 9, run = P.keys && (P.keys.ShiftLeft || P.keys.ShiftRight) && moving && !P.swim;
    fat = G.clamp(fat + (run ? dt / 10 : -dt / 7), 0, 1.6);
    if (!P.under && lastOx < 45 && (P.oxygen === undefined || P.oxygen >= lastOx)) gasp = 1;
    lastOx = P.under ? (P.oxygen === undefined ? 100 : P.oxygen) : 100;
    gasp = Math.max(0, gasp - dt / 6);
    loopTo('fiato', 'respiro_affannato', dead ? 0 : Math.max(G.clamp(fat - 0.6, 0, 1), gasp) * 0.55);
  };
  A.growl = (dist, pos) => { if (A.ctx) CALLS.lupo(spot('ani', pos, dist, 3), false, 0); };
})();
