'use strict';
/* ==========================================================
   Collegamento con "codice partita" (WebRTC).
   Chi ospita registra un codice su un server di appuntamento
   pubblico (protocollo PeerJS); chi si unisce lo usa per aprire
   un canale diretto tra i due PC, che attraversa router e NAT
   senza aprire porte (con ripiego su un server TURN).
   Il canale viene poi collegato al server locale di chi ospita,
   quindi il resto del gioco non vede differenze.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const R = (G.Relay = { code: null, state: 'off', peers: new Map() });
  R.SIGNAL = 'wss://0.peerjs.com:443/peerjs';
  R.KEY = 'peerjs';
  R.ICE = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    ],
  };
  const PREFIX = 'deriva3-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I
  const CHUNK = 15000;
  const rnd = (n, a) => { let s = ''; const b = crypto.getRandomValues(new Uint8Array(n)); for (const x of b) s += a[x % a.length]; return s; };
  R.normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  R.isCode = (s) => !/[.:]/.test(String(s || '')) && R.normCode(s).length === 6 && [...R.normCode(s)].every((c) => ALPH.includes(c));
  R.fmt = (c) => c ? c.slice(0, 3) + '-' + c.slice(3) : '';
  const signalUrl = () => (window.__signal || R.SIGNAL);

  /* ---------- server di appuntamento ---------- */
  function signal(id) {
    return new Promise((resolve, reject) => {
      let ws, done = false, hb = null;
      const token = rnd(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
      const s = { id, handlers: new Set(), ws: null, closed: false,
        send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
        close() { s.closed = true; clearInterval(hb); try { ws.close(); } catch (e) {} },
        onClose: null };
      const to = setTimeout(() => { if (!done) { done = true; s.close(); reject(new Error('timeout')); } }, 9000);
      try { ws = new WebSocket(signalUrl() + '?key=' + R.KEY + '&id=' + encodeURIComponent(id) + '&token=' + token + '&version=1.5.4'); }
      catch (e) { clearTimeout(to); return reject(e); }
      s.ws = ws;
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === 'OPEN') { if (!done) { done = true; clearTimeout(to); hb = setInterval(() => s.send({ type: 'HEARTBEAT' }), 5000); resolve(s); } return; }
        if (m.type === 'ID-TAKEN' || m.type === 'ERROR') { if (!done) { done = true; clearTimeout(to); s.close(); reject(new Error(m.type)); } return; }
        for (const h of s.handlers) h(m);
      };
      ws.onerror = () => {};
      ws.onclose = () => { clearInterval(hb); if (!done) { done = true; clearTimeout(to); reject(new Error('closed')); } else if (!s.closed && s.onClose) s.onClose(); };
    });
  }

  /* ---------- canale dati con messaggi lunghi spezzati ---------- */
  function wrapChannel(ch, onText) {
    let parts = [];
    ch.onmessage = (e) => {
      const d = typeof e.data === 'string' ? e.data : '';
      const k = d.charCodeAt(0);
      if (k === 48) onText(d.slice(1)); // '0' messaggio intero
      else if (k === 49) parts.push(d.slice(1)); // '1' pezzo
      else if (k === 50) { parts.push(d.slice(1)); const s = parts.join(''); parts = []; onText(s); } // '2' ultimo pezzo
    };
    return (s) => {
      if (ch.readyState !== 'open') return;
      if (s.length <= CHUNK) { ch.send('0' + s); return; }
      for (let i = 0; i < s.length; i += CHUNK) ch.send((i + CHUNK >= s.length ? '2' : '1') + s.slice(i, i + CHUNK));
    };
  }
  // candidati arrivati prima della descrizione remota: in coda
  function iceQueue(pc) {
    const q = []; let ready = false;
    return { add(c) { if (ready) pc.addIceCandidate(c).catch(() => {}); else q.push(c); },
      ready() { ready = true; for (const c of q) pc.addIceCandidate(c).catch(() => {}); q.length = 0; } };
  }
  function waitIce(pc, cb) { pc.onicecandidate = (e) => { if (e.candidate) cb(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); }; }

  /* ---------- chi ospita ---------- */
  R.host = async function (port) {
    R.stopHost();
    R.port = port; R.state = 'opening';
    let lastErr = null;
    for (let tries = 0; tries < 4; tries++) {
      const code = rnd(6, ALPH);
      try {
        const s = await signal(PREFIX + code.toLowerCase());
        R.sig = s; R.code = code; R.state = 'on';
        s.handlers.add(onHostSignal);
        // se il server di appuntamento cade, ci si ricollega con lo stesso codice
        s.onClose = () => { if (R.state === 'on') setTimeout(() => reconnectHost(code), 2000); };
        return { ok: true, code };
      } catch (e) { lastErr = e; if (e.message !== 'ID-TAKEN') break; }
    }
    R.state = 'off'; R.code = null;
    return { ok: false, error: lastErr && lastErr.message === 'timeout' ? 'Il server dei codici non risponde (serve la connessione a internet).' : 'Codice partita non disponibile al momento.' };
  };
  async function reconnectHost(code) {
    if (R.state !== 'on' || R.code !== code) return;
    try { const s = await signal(PREFIX + code.toLowerCase()); R.sig = s; s.handlers.add(onHostSignal); s.onClose = () => { if (R.state === 'on') setTimeout(() => reconnectHost(code), 3000); }; }
    catch (e) { setTimeout(() => reconnectHost(code), 5000); }
  }
  R.stopHost = function () {
    R.state = 'off'; R.code = null;
    if (R.sig) { R.sig.close(); R.sig = null; }
    for (const p of R.peers.values()) p.close();
    R.peers.clear();
  };
  function onHostSignal(m) {
    const p = m.payload || {};
    if (m.type === 'OFFER' && p.sdp) hostAccept(m.src, p);
    else if (m.type === 'CANDIDATE') { const peer = R.peers.get(m.src + '/' + p.cid); if (peer && p.candidate) peer.iq.add(p.candidate); }
    else if (m.type === 'LEAVE' || m.type === 'EXPIRE') { for (const [k, peer] of R.peers) if (k.startsWith(m.src + '/') && !peer.open) peer.close(); }
  }
  async function hostAccept(src, p) {
    if (R.peers.size >= 6) return;
    const key = src + '/' + p.cid;
    const pc = new RTCPeerConnection(R.ICE);
    let ws = null, queue = [], closed = false, sendCh = null;
    const iq = iceQueue(pc);
    const peer = { pc, iq, open: false, close() {
      if (closed) return; closed = true;
      try { if (ws) ws.close(); } catch (e) {} try { pc.close(); } catch (e) {}
      R.peers.delete(key);
    } };
    R.peers.set(key, peer);
    waitIce(pc, (c) => R.sig && R.sig.send({ type: 'CANDIDATE', dst: src, payload: { candidate: c, cid: p.cid } }));
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) peer.close(); };
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      sendCh = wrapChannel(ch, (txt) => { if (ws && ws.readyState === 1) ws.send(txt); else queue.push(txt); });
      ch.onopen = () => {
        peer.open = true;
        // collega il canale al server locale come se fosse un giocatore in rete
        ws = new WebSocket('ws://127.0.0.1:' + R.port);
        ws.onopen = () => { for (const q of queue) ws.send(q); queue = []; };
        ws.onmessage = (ev) => sendCh(ev.data);
        ws.onclose = () => { try { ch.close(); } catch (er) {} peer.close(); };
      };
      ch.onclose = () => peer.close();
    };
    setTimeout(() => { if (!peer.open) peer.close(); }, 30000);
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: p.sdp });
      iq.ready();
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      R.sig.send({ type: 'ANSWER', dst: src, payload: { sdp: ans.sdp, cid: p.cid } });
    } catch (e) { peer.close(); }
  }

  /* ---------- chi si unisce: restituisce un oggetto simile a un WebSocket ---------- */
  R.join = function (code) {
    code = R.normCode(code);
    const sock = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, failReason: null,
      send(s) { if (sendCh) sendCh(s); },
      close() { finish(); } };
    let sig = null, pc = null, ch = null, sendCh = null, ended = false, iq = null;
    const cid = 'dc_' + rnd(10, 'abcdefghijklmnopqrstuvwxyz0123456789');
    const dst = PREFIX + code.toLowerCase();
    function finish(reason) {
      if (ended) return; ended = true;
      const wasOpen = sock.readyState === 1;
      sock.readyState = 3;
      if (sig) sig.close(); try { if (pc) pc.close(); } catch (e) {}
      if (reason) sock.failReason = reason;
      if (!wasOpen && sock.onerror) sock.onerror({ reason });
      if (sock.onclose) sock.onclose({ reason });
    }
    const to = setTimeout(() => { if (sock.readyState !== 1) finish('Il collegamento con ' + R.fmt(code) + ' non riesce: la rete di uno dei due blocca le connessioni dirette. Riprova, oppure usate l’indirizzo IP sulla stessa rete.'); }, 25000);
    (async () => {
      try { sig = await signal('deriva-g-' + rnd(10, 'abcdefghijklmnopqrstuvwxyz0123456789')); }
      catch (e) { clearTimeout(to); return finish('Il server dei codici non risponde: controlla la connessione a internet.'); }
      if (ended) return;
      sig.handlers.add((m) => {
        const p = m.payload || {};
        if (m.src !== dst) return;
        if (m.type === 'ANSWER' && p.sdp) pc.setRemoteDescription({ type: 'answer', sdp: p.sdp }).then(() => iq.ready()).catch(() => {});
        else if (m.type === 'CANDIDATE' && p.candidate) iq.add(p.candidate);
        else if (m.type === 'EXPIRE' || m.type === 'LEAVE') { clearTimeout(to); finish('Nessuna partita aperta con il codice ' + R.fmt(code) + '. Controlla il codice (chi ospita lo vede nel menu Esc).'); }
      });
      pc = new RTCPeerConnection(R.ICE); iq = iceQueue(pc);
      waitIce(pc, (c) => sig && !ended && sig.send({ type: 'CANDIDATE', dst, payload: { candidate: c, cid } }));
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { clearTimeout(to); finish('Il collegamento diretto non è riuscito (rete troppo restrittiva). Riprova, oppure usate una rete diversa.'); } };
      ch = pc.createDataChannel('deriva', { ordered: true });
      sendCh = wrapChannel(ch, (txt) => { if (sock.onmessage) sock.onmessage({ data: txt }); });
      ch.onopen = () => { clearTimeout(to); sock.readyState = 1; if (sig) { sig.close(); sig = null; } if (sock.onopen) sock.onopen(); };
      ch.onclose = () => finish();
      const off = await pc.createOffer();
      await pc.setLocalDescription(off);
      sig.send({ type: 'OFFER', dst, payload: { sdp: off.sdp, type: 'data', cid, connectionId: cid, label: cid, reliable: true, serialization: 'raw' } });
    })().catch(() => { clearTimeout(to); finish('Impossibile avviare il collegamento.'); });
    return sock;
  };
})();
