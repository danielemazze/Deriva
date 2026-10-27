'use strict';
/* ==========================================================
   Chat vocale tra i giocatori (WebRTC, da giocatore a giocatore).
   - I messaggi per mettersi in contatto passano dal server della
     partita ('vsig'); la voce poi viaggia diretta tra i due.
   - Microfono: sempre aperto (si attiva quando parli), tieni premuto Q,
     oppure spento. Si sceglie in Impostazioni > Audio.
   - La voce arriva da dove sta il giocatore e si abbassa con la distanza.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const V = (G.Voice = { peers: new Map(), stream: null, talking: false, ptt: false, level: 0, state: 'off', warned: false });
  const S = () => {
    const s = G.settings; if (!s.voice) s.voice = { mode: 'open', vol: 1, range: 60, sens: 0.5 };
    return s.voice;
  };
  V.settings = S;
  const ICE = () => (G.Relay && G.Relay.ICE) || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const send = (to, d) => { if (G.Net && G.Net.on) G.Net.send({ t: 'vsig', to, d }); };

  /* ---------- microfono ---------- */
  let micPromise = null, analyser = null, abuf = null, hang = 0;
  function mic() {
    if (V.stream) return Promise.resolve(V.stream);
    if (micPromise) return micPromise;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      V.state = 'nomic';
      G.UI.toast(location.protocol === 'http:' && !/^(localhost|127\.)/.test(location.hostname) ? 'Chat vocale: da questo indirizzo il browser non dà il microfono. Usa il sito o Deriva.exe' : 'Chat vocale: microfono non disponibile su questo dispositivo', 'warn');
      return Promise.reject(new Error('nomic'));
    }
    micPromise = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      .then((st) => {
        V.stream = st; V.state = 'on';
        if (G.Audio && G.Audio.ctx) {
          // il rilevamento della voce ascolta una copia sempre attiva (la traccia inviata resta spenta finché non parli)
          V.probe = st.getAudioTracks()[0].clone(); const src = G.Audio.ctx.createMediaStreamSource(new MediaStream([V.probe])); analyser = G.Audio.ctx.createAnalyser(); analyser.fftSize = 512; abuf = new Float32Array(analyser.fftSize); src.connect(analyser);
        }
        setTalking(false);
        for (const p of V.peers.values()) attachMic(p);
        return st;
      })
      .catch((e) => { micPromise = null; V.state = 'denied'; G.UI.toast('Chat vocale: permesso del microfono negato. Puoi riattivarlo dalle impostazioni del browser', 'warn'); throw e; });
    return micPromise;
  }
  function setTalking(on) {
    const ch = V.talking !== on; V.talking = on;
    if (ch && G.UI && G.UI.refreshPlayers && G.Net && G.Net.on) G.UI.refreshPlayers();
    if (V.stream) for (const t of V.stream.getAudioTracks()) t.enabled = on;
  }
  V.stopMic = function () { if (V.stream) for (const t of V.stream.getTracks()) t.stop(); if (V.probe) { V.probe.stop(); V.probe = null; } V.stream = null; micPromise = null; analyser = null; V.state = 'off'; setTalking(false); };

  /* ---------- collegamenti con gli altri ---------- */
  function attachMic(p) {
    if (!V.stream || p.sender || !p.tx) return; // chi riceve la chiamata aspetta l'offerta per avere il suo canale
    const tr = V.stream.getAudioTracks()[0]; if (!tr) return;
    p.tx.sender.replaceTrack(tr).catch(() => {}); p.sender = p.tx.sender;
    try { p.tx.sender.setStreams && p.tx.sender.setStreams(V.stream); } catch (e) {}
  }
  function peer(id, caller) {
    let p = V.peers.get(id);
    if (p) return p;
    const pc = new RTCPeerConnection(ICE());
    p = { id, pc, gain: null, pan: null, an: null, abuf: null, level: 0, speaking: false, el: null, made: performance.now(), q: [], ready: false, makingOffer: false };
    V.peers.set(id, p);
    // chi chiama apre il canale audio (anche col microfono ancora spento: la voce si aggancia dopo, senza rinegoziare)
    if (caller) p.tx = pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.onicecandidate = (e) => { if (e.candidate) send(id, { c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.onnegotiationneeded = async () => {
      try { p.makingOffer = true; await pc.setLocalDescription(await pc.createOffer()); send(id, { sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
      catch (e) {} finally { p.makingOffer = false; }
    };
    pc.ontrack = (e) => {
      const st = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
      // Chrome fa scorrere l'audio remoto in WebAudio solo se lo stream è anche agganciato a un elemento <audio>
      const el = new Audio(); el.muted = true; el.srcObject = st; el.play().catch(() => {}); p.el = el;
      const A = G.Audio; if (!A || !A.ctx) return;
      const src = A.ctx.createMediaStreamSource(st);
      p.gain = A.ctx.createGain(); p.gain.gain.value = 0;
      p.pan = A.ctx.createStereoPanner ? A.ctx.createStereoPanner() : null;
      p.an = A.ctx.createAnalyser(); p.an.fftSize = 512; p.abuf = new Float32Array(p.an.fftSize);
      src.connect(p.an); src.connect(p.gain);
      if (p.pan) { p.gain.connect(p.pan); p.pan.connect(A.bus.voice || A.master); } else p.gain.connect(A.bus.voice || A.master);
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') p.ok = true; if (pc.connectionState === 'failed') { closePeer(id); } };
    attachMic(p);
    return p;
  }
  function closePeer(id) { const p = V.peers.get(id); if (!p) return; try { p.pc.close(); } catch (e) {} if (p.el) { p.el.srcObject = null; } V.peers.delete(id); }
  V.closePeer = closePeer;
  // segnali in arrivo: "perfect negotiation" (il giocatore con l'id più basso cede in caso di offerte incrociate)
  V.onSignal = async function (m) {
    if (S().mode === 'off') return;
    const id = m.from, d = m.d || {};
    const p = peer(id), pc = p.pc, polite = String(G.Net.id) < String(id);
    try {
      if (d.sdp) {
        const collision = d.sdp.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
        if (collision && !polite) return;
        await pc.setRemoteDescription(d.sdp);
        if (!p.tx) { p.tx = pc.getTransceivers()[0] || null; if (p.tx) { p.tx.direction = 'sendrecv'; attachMic(p); } }
        p.ready = true; for (const c of p.q) pc.addIceCandidate(c).catch(() => {}); p.q = [];
        if (d.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); send(id, { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
      } else if (d.c) { if (p.ready) pc.addIceCandidate(d.c).catch(() => {}); else p.q.push(d.c); }
    } catch (e) {}
  };

  /* ---------- ogni frame ---------- */
  const rms = (an, buf) => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i += 2) s += buf[i] * buf[i]; return Math.sqrt(s / (buf.length / 2)); };
  let syncT = 0;
  V.update = function (dt) {
    const N = G.Net, set = S();
    if (!N || !N.on || set.mode === 'off') { if (V.peers.size) for (const id of [...V.peers.keys()]) closePeer(id); if (V.stream && set.mode === 'off') V.stopMic(); V.talking = false; return; }
    // un collegamento per ogni altro giocatore
    syncT -= dt;
    if (syncT <= 0) {
      syncT = 1;
      for (const id of N.remotes.keys()) if (!V.peers.has(id) && String(N.id) > String(id)) peer(id, true); // chi ha l'id più alto chiama
      for (const id of [...V.peers.keys()]) if (!N.remotes.has(id)) closePeer(id);
      if (!V.stream && V.state !== 'denied' && V.state !== 'nomic' && N.remotes.size) mic().catch(() => {});
      // collegamento passato dal ponte e voce mai arrivata: avvisa una volta
      for (const p of V.peers.values()) if (!p.ok && !V.warned && performance.now() - p.made > 20000) { V.warned = true; G.UI.toast('Chat vocale: non riesco a collegare la voce con ' + ((N.remotes.get(p.id) || {}).name || 'un giocatore') + ' (la rete blocca i collegamenti diretti)', 'warn'); }
    }
    // microfono: tieni premuto Q, oppure si apre da solo quando parli
    if (V.stream) {
      let on;
      if (set.mode === 'ptt') on = V.ptt;
      else {
        V.level = analyser ? rms(analyser, abuf) : 0;
        const th = 0.004 + (1 - set.sens) * 0.05;
        if (V.level > th) hang = 0.45; else hang -= dt;
        on = hang > 0;
      }
      if (on !== V.talking) setTalking(on);
    }
    // voci degli altri: posizione, distanza, chi sta parlando
    const P = G.Player, range = set.range || 60, A = G.Audio;
    for (const p of V.peers.values()) {
      const r = N.remotes.get(p.id); if (!r || !p.gain || !A || !A.ctx) continue;
      const dx = r.pos.x - P.pos.x, dz = r.pos.z - P.pos.z, d = Math.hypot(dx, dz, r.pos.y - P.pos.y);
      const k = d < range * 0.3 ? 1 : Math.max(0, 1 - (d - range * 0.3) / (range * 0.7));
      p.gain.gain.setTargetAtTime(k * k * (set.vol === undefined ? 1 : set.vol) * 1.6, A.ctx.currentTime, 0.1);
      if (p.pan) { const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw); p.pan.pan.setTargetAtTime(G.clamp((dx * rx + dz * rz) / Math.max(1, Math.hypot(dx, dz)), -1, 1) * 0.8, A.ctx.currentTime, 0.1); }
      p.level = rms(p.an, p.abuf);
      const sp = p.level > 0.01;
      if (sp) p.spT = 0.35; else p.spT = (p.spT || 0) - dt;
      const speaking = p.spT > 0;
      if (speaking !== p.speaking) { p.speaking = speaking; r.speaking = speaking; if (G.UI.refreshPlayers) G.UI.refreshPlayers(); }
    }
    const pill = document.getElementById('voicepill');
    if (pill) { const show = V.talking && V.peers.size > 0; if (pill.hidden === show) pill.hidden = !show; }
  };
  V.setPTT = function (on) { V.ptt = on; };
  V.leaveAll = function () { for (const id of [...V.peers.keys()]) closePeer(id); };
})();
