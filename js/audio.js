'use strict';
/* ==========================================================
   Audio sintetizzato (WebAudio): mare, vento, uccelli, effetti
   ========================================================== */
(function () {
  const G = globalThis.G;
  const A = (G.Audio = { ctx: null, vol: 0.6 });
  let noiseBuf = null;
  A.start = function (vol) {
    if (A.ctx) { A.setVolume(vol); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const ctx = A.ctx;
    A.master = ctx.createGain(); A.master.gain.value = vol === undefined ? 0.6 : vol; A.master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.15 * w; d[i] = b * 0.9 + w * 0.08; }
    // mare: rumore filtrato con onde lente
    const mk = (freq, q, gain) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(A.master); s.start(); return { s, f, g }; };
    A.sea = mk(500, 0.4, 0.0);
    A.wind = mk(900, 2.5, 0.0); A.wind.f.type = 'bandpass';
    A.under = mk(250, 0.7, 0.0);
    A.rain = mk(3200, 0.4, 0.0); A.rain.f.type = 'highpass';
    A.rumble = mk(110, 0.8, 0.0);
  };
  // pioggia continua e rombo dei gorghi
  A.weather = function (c, vort) {
    if (!A.ctx || !A.rain) return;
    const now = A.ctx.currentTime, P = G.Player, under = P.under ? 1 : 0, roof = G.Climate && G.Climate._roofed ? 0.45 : 1;
    A.rain.g.gain.setTargetAtTime((c.rain * 0.22 + c.storm * 0.08) * roof * (1 - under * 0.9), now, 0.6);
    A.rumble.g.gain.setTargetAtTime(Math.min(1, vort) * 0.45, now, 0.6);
  };
  A.falls = function (k) { if (!A.ctx || !A.rumble) return; if (!A.fallsN) { A.fallsN = 1; const ctx = A.ctx, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(A.master); s.start(); A.fallsG = g; } A.fallsG.gain.setTargetAtTime(k * 0.35, A.ctx.currentTime, 0.4); };
  A.thunder = function (dist) {
    const delay = Math.min(3.5, dist / 340), v = Math.max(0.25, 1 - dist / 800);
    noise(0.25, 'highpass', 1500, 0.5, 0.35 * v, delay);
    noise(2.8, 'lowpass', 160, 0.8, 1.0 * v, delay + 0.05);
    noise(1.8, 'lowpass', 90, 0.8, 0.8 * v, delay + 0.4);
  };
  A.setVolume = (v) => { A.vol = v; if (A.master) A.master.gain.value = v; };
  A.update = function (dt, t, player) {
    if (!A.ctx) return;
    const shore = Math.max(0, 1 - Math.abs(G.heightAt(player.pos.x, player.pos.z)) / 12);
    const swell = 0.6 + 0.4 * Math.sin(t * 0.55) * Math.sin(t * 0.21 + 1);
    const under = player.under ? 1 : 0;
    const now = A.ctx.currentTime;
    A.sea.g.gain.setTargetAtTime((0.18 + shore * 0.35) * swell * (1 - under * 0.8), now, 0.3);
    A.sea.f.frequency.setTargetAtTime(380 + swell * 500, now, 0.3);
    A.wind.g.gain.setTargetAtTime((0.03 + G.shared.uWind.value * 0.03 + Math.max(0, player.pos.y - 8) * 0.004) * (1 - under), now, 0.5);
    A.wind.f.frequency.setTargetAtTime(600 + Math.sin(t * 0.3) * 250, now, 0.5);
    A.under.g.gain.setTargetAtTime(under * 0.35, now, 0.15);
    // uccellini di giorno, grilli di notte
    if (!under && Math.random() < dt * 0.25 && G.sky.day > 0.6 && G.heightAt(player.pos.x, player.pos.z) > 1.5) A.chirp();
    if (!under && Math.random() < dt * 1.5 && G.sky.night > 0.6) A.cricket();
    if (!under && Math.random() < dt * 0.05 && G.sky.day > 0.5) A.gull();
  };
  function env(g, t0, a, dcy, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dcy); }
  function noise(dur, type, freq, q, peak, delay) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t0, 0.005, dur, peak); s.connect(f); f.connect(g); g.connect(A.master); s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.1);
    return f;
  }
  function tone(type, f0, f1, dur, peak, delay) {
    if (!A.ctx) return; const ctx = A.ctx, t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain(); env(g, t0, 0.01, dur, peak); o.connect(g); g.connect(A.master); o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  A.hit = (k) => { if (k === 'wood') { noise(0.12, 'bandpass', 900, 3, 0.5); tone('triangle', 220, 120, 0.1, 0.25); } else if (k === 'stone') { noise(0.08, 'highpass', 2200, 1, 0.45); tone('square', 1400, 900, 0.05, 0.06); } else if (k === 'leaf') noise(0.22, 'highpass', 3000, 0.5, 0.25); else noise(0.12, 'lowpass', 600, 1, 0.4); };
  A.thud = () => { noise(0.5, 'lowpass', 220, 1, 0.9); tone('sine', 90, 40, 0.45, 0.5); };
  A.creak = () => { const o = tone('sawtooth', 140, 110, 0.6, 0.04); };
  A.place = () => { tone('triangle', 180, 90, 0.12, 0.3); noise(0.08, 'lowpass', 900, 1, 0.3); };
  A.door = () => { tone('sawtooth', 300, 180, 0.35, 0.05); noise(0.1, 'lowpass', 500, 1, 0.3, 0.3); };
  A.eat = () => { for (let i = 0; i < 3; i++) noise(0.06, 'bandpass', 1800, 2, 0.3, i * 0.13); };
  A.splash = () => { noise(0.45, 'lowpass', 1600, 0.6, 0.5); noise(0.25, 'highpass', 4000, 0.5, 0.15, 0.05); };
  A.step = (k) => { if (k === 'water') noise(0.18, 'lowpass', 1200, 0.6, 0.18); else if (k === 'sand') noise(0.1, 'highpass', 1800, 0.4, 0.07); else noise(0.09, 'bandpass', 1300, 0.8, 0.08); };
  A.pickup = () => { tone('sine', 660, 990, 0.08, 0.08); };
  A.craft = () => { tone('triangle', 330, 330, 0.08, 0.2); tone('triangle', 495, 495, 0.1, 0.18, 0.08); };
  A.click = () => tone('sine', 900, 700, 0.04, 0.05);
  A.chirp = () => { const f = 2500 + Math.random() * 1800; const n = 2 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) tone('sine', f, f * (1.2 + Math.random() * 0.5), 0.07, 0.03, i * 0.11); };
  A.cricket = () => { const f = 4200 + Math.random() * 400; for (let i = 0; i < 3; i++) tone('square', f, f, 0.025, 0.006, i * 0.05); };
  A.gull = () => { tone('sawtooth', 1400, 900, 0.35, 0.02); tone('sawtooth', 1500, 1000, 0.3, 0.015, 0.4); };
  A.bow = () => { tone('triangle', 260, 520, 0.08, 0.15); noise(0.12, 'highpass', 2600, 0.6, 0.12, 0.02); };
  A.draw = () => { tone('sawtooth', 120, 180, 0.4, 0.015); };
  A.gun = () => { noise(0.55, 'lowpass', 900, 0.7, 1.0); noise(0.12, 'highpass', 2500, 0.6, 0.6); tone('sine', 120, 40, 0.4, 0.6); };
  A.dig = () => { noise(0.18, 'lowpass', 700, 0.8, 0.45); noise(0.08, 'highpass', 2000, 0.5, 0.15, 0.08); };
  A.coins = () => { for (let i = 0; i < 5; i++) tone('triangle', 1800 + Math.random() * 900, 1500, 0.08, 0.05, i * 0.06); };
  A.chest = () => { tone('sawtooth', 160, 120, 0.4, 0.04); noise(0.15, 'lowpass', 700, 1, 0.3, 0.25); };
  A.grunt = (dist) => { const v = Math.max(0.02, 0.2 - dist * 0.012); tone('sawtooth', 160 + Math.random() * 60, 110, 0.25, v * 0.3); };
  A.growl = (dist) => { const v = Math.max(0.02, 0.3 - dist * 0.015); const o = tone('sawtooth', 90, 70, 0.8, v * 0.35); };
  A.bell = () => { for (const [f, d] of [[660, 0], [880, 0.02], [1320, 0.04]]) tone('sine', f, f * 0.995, 2.2, 0.06, d); };
  A.animal = function (sp, dist) {
    if (sp === 'lupo' || sp === 'orso' || sp === 'giaguaro' || sp === 'coccodrillo') return A.growl(dist);
    const v = Math.max(0.02, 0.25 - dist * 0.018);
    if (sp === 'gallina') { for (let i = 0; i < 3; i++) tone('square', 700 + Math.random() * 200, 500, 0.06, v * 0.25, i * 0.12); }
    else if (sp === 'mucca') { const o = tone('sawtooth', 130, 105, 1.2, v * 0.5); }
    else if (sp === 'pecora') { const o = tone('sawtooth', 320, 290, 0.7, v * 0.3); if (o && A.ctx) { const l = A.ctx.createOscillator(), lg = A.ctx.createGain(); l.frequency.value = 9; lg.gain.value = 20; l.connect(lg); lg.connect(o.frequency); l.start(); l.stop(A.ctx.currentTime + 0.8); } }
    else if (sp === 'maiale') { noise(0.18, 'bandpass', 500, 4, v * 0.8); noise(0.14, 'bandpass', 420, 4, v * 0.6, 0.22); }
  };
})();
