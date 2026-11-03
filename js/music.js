/* =========================================================
   Strumenti: chitarra (corde e legno) e flauto d'osso di gallina.
   Chitarra: clic sinistro pizzica l'accordo, tasto destro cambia
   accordo. Flauto: clic sinistro soffia,
   guardando su o giù la nota sale o scende (scala pentatonica).
   Suoni sintetizzati (Karplus-Strong per le corde) finché non
   arrivano le registrazioni vere.
   ========================================================= */
(function () {
  const MU = (G.Music = { chord: 0, key: 0 });
  const INSTR = { chitarra: 1, flauto: 1 };
  MU.is = (id) => !!INSTR[id];
  // accordi (semitoni sopra il Mi basso, 6 corde: -1 = muta)
  const CHORDS = [
    ['Mi-', [0, 7, 12, 15, 19, 24]], ['La-', [-1, 5, 12, 17, 20, 24]], ['Do', [-1, 8, 12, 15, 20, 24]],
    ['Sol', [3, 7, 10, 15, 19, 27]], ['Re', [-1, -1, 10, 17, 22, 26]], ['Fa', [1, 8, 13, 17, 20, 25]],
  ];
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const E2 = 82.41;

  /* ---------- modelli in mano ---------- */
  MU.mesh = function (id) {
    if (id === 'chitarra') {
      const wood = new THREE.MeshStandardMaterial(G.ACG && G.ACG.on && G.ACG.tex.woodGrain ? G.ACG.mat('woodGrain', { color: 0xe0a070, roughness: 0.7 }) : { color: 0x9a5a24, roughness: 0.55 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.6 }), str = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 });
      const g = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), wood); b1.scale.set(1, 1.05, 0.32);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), wood); b2.scale.set(1, 1, 0.32); b2.position.y = 0.2; g.add(b1, b2);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), dark); hole.position.set(0, 0.12, 0.056); g.add(hole);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.025), dark); neck.position.set(0, 0.5, 0.03); g.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.025), wood); head.position.set(0, 0.76, 0.025); g.add(head);
      const brg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.015), dark); brg.position.set(0, -0.06, 0.06); g.add(brg);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.8, 0.002), str); s.position.set(-0.02 + i * 0.008, 0.34, 0.062); g.add(s); }
      g.position.set(0.16, -0.36, -0.62); g.rotation.set(-0.35, 0.25, 1.2); g.userData.instr = 1;
      return g;
    }
    if (id === 'flauto') {
      const bone = new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.7 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.6 });
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.34, 12), bone));
      const k1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), bone); k1.position.y = 0.17; k1.scale.set(1, 0.7, 1); const k2 = k1.clone(); k2.position.y = -0.17; g.add(k1, k2);
      for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.01, 8), dark); h.rotation.x = Math.PI / 2; h.position.set(0, -0.09 + i * 0.045, 0.015); g.add(h); }
      g.position.set(-0.02, 0.06, -0.38); g.rotation.set(0.3, 0.25, 1.45); g.userData.instr = 1;
      return g;
    }
    return null;
  };

  /* ---------- suoni ---------- */
  const bufCache = {};
  function pluckBuf(ctx, f, dur) {
    const k = Math.round(f * 10); if (bufCache[k]) return bufCache[k];
    const sr = ctx.sampleRate, n = Math.floor(sr * dur), N = Math.max(2, Math.round(sr / f)), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const ring = new Float32Array(N); for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    // filtro del corpo: un po' più scuro
    let prev = 0; for (let i = 0; i < N; i++) { ring[i] = prev * 0.5 + ring[i] * 0.5; prev = ring[i]; }
    let p = 0; const damp = 0.4985 + Math.min(0.0012, f / 400000);
    for (let i = 0; i < n; i++) { const a = ring[p], q = (p + 1) % N; ring[p] = (a + ring[q]) * damp; d[i] = a; p = q; }
    return (bufCache[k] = b);
  }
  function strum(pos, ci, key, local) {
    const A = G.Audio; if (!A || !A.ctx) return;
    const ctx = A.ctx, out = A.spot('sfx', local ? null : pos, local ? 0 : undefined, 4); if (!out) return;
    const t0 = ctx.currentTime, ch = CHORDS[ci % CHORDS.length][1];
    let j = 0;
    for (const s of ch) {
      if (s < 0) continue;
      const f = E2 * Math.pow(2, (s + key) / 12), src = ctx.createBufferSource(); src.buffer = pluckBuf(ctx, f, 3);
      const g = ctx.createGain(); g.gain.value = 0.28; src.connect(g); g.connect(out);
      src.start(t0 + j * 0.022 + Math.random() * 0.006); j++;
    }
  }
  function blow(pos, step, local) {
    const A = G.Audio; if (!A || !A.ctx) return;
    const ctx = A.ctx, out = A.spot('sfx', local ? null : pos, local ? 0 : undefined, 2); if (!out) return;
    const t0 = ctx.currentTime, f = 523.25 * Math.pow(2, PENTA[step] / 12), dur = 0.55;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2; vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(o.frequency);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.12; o2.connect(g2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.06); g.gain.setValueAtTime(0.2, t0 + dur - 0.12); g.gain.linearRampToValueAtTime(0, t0 + dur);
    // fiato: rumore filtrato
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 2; const ng = ctx.createGain(); ng.gain.value = 0.05; ns.connect(bp); bp.connect(ng); ng.connect(g);
    o.connect(g); g2.connect(g); g.connect(out);
    for (const x of [o, o2, vib, ns]) { x.start(t0); x.stop(t0 + dur + 0.05); }
  }

  /* ---------- suonare ---------- */
  const _p = new THREE.Vector3();
  function note(P) { P.lookDir(_p); return G.clamp(Math.round((Math.asin(G.clamp(_p.y, -1, 1)) / (Math.PI / 2) * 0.5 + 0.5) * (PENTA.length - 1)), 0, PENTA.length - 1); }
  MU.play = function (P) {
    const id = P.held() && P.held().id; if (!MU.is(id)) return false;
    const pos = { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
    if (id === 'chitarra') { strum(pos, MU.chord, MU.key, true); P.actionCd = 0.25; G.Net && G.Net.on && G.Net.send({ t: 'fx', k: 'note', i: 'g', c: MU.chord, n: MU.key, o: [+pos.x.toFixed(1), +pos.y.toFixed(1), +pos.z.toFixed(1)] }); }
    else { const n = note(P); blow(pos, n, true); P.actionCd = 0.22; G.Net && G.Net.on && G.Net.send({ t: 'fx', k: 'note', i: 'f', c: n, o: [+pos.x.toFixed(1), +pos.y.toFixed(1), +pos.z.toFixed(1)] }); }
    MU.hit = 1; MU.floatNote(id);
    return true;
  };
  MU.secondary = function (P) {
    const id = P.held() && P.held().id; if (id !== 'chitarra') return id === 'flauto';
    MU.chord = (MU.chord + 1) % CHORDS.length; MU.hint(P, true); return true;
  };
  MU.wheel = function (P, d) {
    const id = P.held() && P.held().id; if (id !== 'chitarra') return false;
    MU.key = G.clamp(MU.key + (d > 0 ? -1 : 1), -5, 7); MU.hint(P, true); return true;
  };
  MU.netNote = function (m) {
    const pos = { x: m.o[0], y: m.o[1], z: m.o[2] };
    if (m.i === 'g') strum(pos, m.c | 0, m.n | 0, false); else blow(pos, G.clamp(m.c | 0, 0, PENTA.length - 1), false);
  };

  /* ---------- note che volano e suggerimento ---------- */
  let hintEl = null, hintT = 0;
  MU.hint = function (P, force) {
    const id = P.held() && P.held().id;
    if (!hintEl) { hintEl = document.createElement('div'); hintEl.className = 'musichint'; const h = document.getElementById('hud'); if (h) h.appendChild(hintEl); else return; }
    if (!MU.is(id) || (G.UI && G.UI.open)) { hintEl.hidden = true; return; }
    hintEl.hidden = false;
    const k = (s) => `<b>${s}</b>`, ck = ['Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si', 'Do', 'Do#', 'Re', 'Re#', 'Mi'];
    const html = id === 'chitarra'
      ? `${k(G.isTouch ? 'Tocca' : 'Clic sinistro')} pizzica · ${k(G.isTouch ? 'Usa' : 'Clic destro')} accordo: <em>${CHORDS[MU.chord][0]}</em>`
      : `${k(G.isTouch ? 'Tocca' : 'Clic sinistro')} soffia · ${k('guarda su o giù')} per la nota`;
    if (hintEl._h !== html) { hintEl._h = html; hintEl.innerHTML = html; }
    void ck; if (force) hintT = 0;
  };
  MU.floatNote = function (id) {
    const h = document.getElementById('hud'); if (!h) return;
    const n = document.createElement('div'); n.className = 'mnote'; n.textContent = ['♪', '♫', '♩'][(Math.random() * 3) | 0];
    n.style.left = (id === 'chitarra' ? 56 + Math.random() * 8 : 44 + Math.random() * 6) + '%'; n.style.top = (id === 'chitarra' ? 58 : 50) + '%';
    h.appendChild(n); setTimeout(() => n.remove(), 1600);
  };
  MU.update = function (dt, P) {
    const id = P.held() && P.held().id, on = MU.is(id);
    if (P.arm) P.arm.visible = !on;
    MU.hint(P);
    // piccolo movimento quando suoni
    MU.hit = Math.max(0, (MU.hit || 0) - dt * 5);
    const m = on && P.vmCache && P.vmCache[id];
    if (m) { if (!m.userData.base) m.userData.base = m.rotation.z; m.rotation.z = m.userData.base + (id === 'chitarra' ? MU.hit * 0.04 : -MU.hit * 0.02); }
    if (on) P.swingT = 0;
  };
})();
