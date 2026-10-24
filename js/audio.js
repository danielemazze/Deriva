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
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25; comp.connect(ctx.destination);
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
  function envl(g, t0, a, dcy, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dcy); }
  function noise(dur, type, freq, q, peak, delay, dest, buf) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); envl(g, t0, 0.005, dur, peak); s.connect(f); f.connect(g); g.connect(dest || A.bus.sfx); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.1);
    return f;
  }
  function tone(type, f0, f1, dur, peak, delay, dest) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (delay || 0);
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain(); envl(g, t0, 0.01, dur, peak); o.connect(g); g.connect(dest || A.bus.sfx); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  // voce con formanti (muggiti, belati, ululati…): fonte → filtri di vocale → inviluppo
  //  pts: [[tempo 0..1, frequenza], …]  form: [[freq, q, guadagno], …]
  function voc(dest, o) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = now() + (o.delay || 0), dur = o.dur;
    const osc = ctx.createOscillator(); osc.type = o.wave || 'sawtooth';
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
    const ctx = A.ctx, P = G.Player; let d = dist || 0, pan = (Math.random() - 0.5) * 0.6;
    if (pos && P) {
      const dx = pos.x - P.pos.x, dz = pos.z - P.pos.z; d = dist !== undefined ? dist : Math.hypot(dx, dz);
      const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw); pan = G.clamp((dx * rx + dz * rz) / Math.max(1, Math.hypot(dx, dz)), -1, 1) * 0.85;
    }
    const g = ctx.createGain(); g.gain.value = (bus === 'ani' ? 1.6 : 1) / (1 + Math.pow(d / 7, 1.35));
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(700, 16000 * Math.exp(-d / 45));
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.connect(f); if (p) { p.pan.value = pan; f.connect(p); p.connect(A.bus[bus]); } else f.connect(A.bus[bus]);
    setTimeout(() => { try { g.disconnect(); f.disconnect(); if (p) p.disconnect(); } catch (e) {} }, (life || 4) * 1000 + 500);
    return g;
  }
  const far = (bus, d) => spot(bus, null, d); // suono lontano senza posizione precisa
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
    A.wind.g.gain.setTargetAtTime((0.006 + wind * 0.012 + Math.min(0.02, Math.max(0, P.pos.y - 8) * 0.0012) + (S.bi === G.BIOME.NEVE ? 0.01 : 0)) * (0.6 + 0.4 * Math.sin(t * 0.21) * Math.sin(t * 0.53)), n, 0.8);
    A.wind.f.frequency.setTargetAtTime(600 + Math.sin(t * 0.3) * 250, n, 0.5);
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
  A.hit = (k) => { if (k === 'wood') { noise(0.12, 'bandpass', 900, 3, 0.5); tone('triangle', 220, 120, 0.1, 0.25); } else if (k === 'stone') { noise(0.08, 'highpass', 2200, 1, 0.45); tone('square', 1400, 900, 0.05, 0.06); } else if (k === 'leaf') noise(0.22, 'highpass', 3000, 0.5, 0.25); else { noise(0.12, 'lowpass', 600, 1, 0.4); tone('sine', 140, 60, 0.12, 0.25); } };
  A.thud = () => { noise(0.5, 'lowpass', 220, 1, 0.9); tone('sine', 90, 40, 0.45, 0.5); };
  A.creak = () => { tone('sawtooth', 140 + Math.random() * 40, 105, 0.7, 0.035); tone('sawtooth', 210, 170, 0.4, 0.015, 0.25); };
  A.place = () => { tone('triangle', 180, 90, 0.12, 0.3); noise(0.08, 'lowpass', 900, 1, 0.3); };
  A.door = () => { tone('sawtooth', 300, 180, 0.35, 0.05); noise(0.1, 'lowpass', 500, 1, 0.3, 0.3); };
  A.eat = () => { for (let i = 0; i < 3; i++) noise(0.06, 'bandpass', 1800, 2, 0.3, i * 0.13); };
  A.splash = () => { noise(0.45, 'lowpass', 1600, 0.6, 0.5); noise(0.25, 'highpass', 4000, 0.5, 0.15, 0.05); };
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
  A.step = (k) => {
    const v = 1 + (Math.random() - 0.5) * 0.3;
    if (k === 'water') noise(0.18, 'lowpass', 1200, 0.6, 0.18 * v);
    else if (k === 'sand') noise(0.1, 'highpass', 1800, 0.4, 0.07 * v);
    else if (k === 'wood') { noise(0.06, 'bandpass', 700, 2, 0.12 * v); tone('triangle', 160, 110, 0.06, 0.05 * v); }
    else if (k === 'stone') { noise(0.05, 'bandpass', 2400, 1.4, 0.09 * v); noise(0.04, 'highpass', 4500, 0.7, 0.03 * v, 0.02); }
    else if (k === 'snow') { noise(0.16, 'bandpass', 900, 0.9, 0.1 * v); noise(0.1, 'highpass', 3500, 0.5, 0.025 * v, 0.04); }
    else if (k === 'ice') { noise(0.04, 'highpass', 3000, 0.8, 0.06 * v); tone('sine', 2200, 1800, 0.05, 0.012 * v); }
    else if (k === 'gravel') { for (let i = 0; i < 3; i++) noise(0.03, 'bandpass', 2000 + Math.random() * 1500, 1.5, 0.05 * v, i * 0.025); }
    else noise(0.09, 'bandpass', 1300, 0.8, 0.08 * v);
  };
  A.pickup = () => { tone('sine', 660, 990, 0.08, 0.08, 0, U()); };
  A.craft = () => { tone('triangle', 330, 330, 0.08, 0.2, 0, U()); tone('triangle', 495, 495, 0.1, 0.18, 0.08, U()); };
  A.click = () => tone('sine', 900, 700, 0.04, 0.05, 0, U());
  A.coins = () => { for (let i = 0; i < 5; i++) tone('triangle', 1800 + Math.random() * 900, 1500, 0.08, 0.05, i * 0.06, U()); };
  A.bow = () => { tone('triangle', 260, 520, 0.08, 0.15); noise(0.12, 'highpass', 2600, 0.6, 0.12, 0.02); };
  A.draw = () => { tone('sawtooth', 120, 180, 0.4, 0.015); };
  A.gun = () => { noise(0.55, 'lowpass', 900, 0.7, 1.0); noise(0.12, 'highpass', 2500, 0.6, 0.6); tone('sine', 120, 40, 0.4, 0.6); };
  A.dig = () => { noise(0.18, 'lowpass', 700, 0.8, 0.45); noise(0.08, 'highpass', 2000, 0.5, 0.15, 0.08); };
  A.chest = () => { tone('sawtooth', 160, 120, 0.4, 0.04); noise(0.15, 'lowpass', 700, 1, 0.3, 0.25); };
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
      if (dist > 14 && G.sky.night > 0.5) return howlTo(d);
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
  A.howl = (dist) => howlTo(far('ani', dist || 150));
  // versi lontani di animali da fattoria, per non sentire la pianura vuota
  A.farAnimal = () => { const sp = ['mucca', 'pecora', 'gallina'][Math.random() * 3 | 0]; CALLS[sp](far('ani', rnd(50, 120)), false, 80); };
  A.animal = function (sp, dist, pos) {
    if (!A.ctx || !CALLS[sp]) return;
    CALLS[sp](spot('ani', pos, dist, 4), false, dist || 0);
  };
  A.animalHurt = function (sp, pos) { if (!A.ctx || !CALLS[sp]) return; CALLS[sp](spot('ani', pos, undefined, 2), true, 0); };
  A.grunt = (dist, pos) => { if (A.ctx) CALLS.pirata(spot('ani', pos, dist, 2), false); };
  A.growl = (dist, pos) => { if (A.ctx) CALLS.lupo(spot('ani', pos, dist, 3), false, 0); };
})();
