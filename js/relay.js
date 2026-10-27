'use strict';
/* ==========================================================
   Collegamento con "codice partita".
   - Appuntamento: chi ospita e chi entra si trovano su un server
     pubblico gratuito di messaggi (broker MQTT via WebSocket).
     Ne usiamo più d'uno: se uno è giù si passa al successivo.
   - Poi si prova il collegamento diretto tra i due (WebRTC): è il
     più veloce. Se la rete non lo permette (router o operatori che
     lo bloccano), i dati del gioco passano dallo stesso broker:
     un po' più lento, ma funziona su qualsiasi rete.
   - Dal lato di chi ospita, tutto viene collegato al server locale
     della partita, quindi il resto del gioco non vede differenze.
   (Prima si usava il server pubblico di PeerJS, che ha smesso di
   inoltrare i messaggi: per questo il codice non funzionava.)
   ========================================================== */
(function () {
  const G = globalThis.G;
  const R = (G.Relay = { code: null, state: 'off', peers: new Map(), brokers: [] });
  R.BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  R.ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] };
  R.P2P_WAIT = 6500; // ms per il collegamento diretto, poi si passa al ponte
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I
  const CHUNK = 48000;
  const rnd = (n, a) => { let s = ''; const b = crypto.getRandomValues(new Uint8Array(n)); for (const x of b) s += a[x % a.length]; return s; };
  const ID = () => rnd(10, 'abcdefghijklmnopqrstuvwxyz0123456789');
  R.normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  R.isCode = (s) => !/[.:]/.test(String(s || '')) && R.normCode(s).length === 6 && [...R.normCode(s)].every((c) => ALPH.includes(c));
  R.fmt = (c) => c ? c.slice(0, 3) + '-' + c.slice(3) : '';
  // l'argomento sul broker non contiene il codice in chiaro
  const topicOf = (code) => { let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995; for (const ch of 'deriva:' + code) { const c = ch.charCodeAt(0); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; } return 'deriva/v5/' + a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0'); };
  const trace = (s) => { if (R.debug) R.debug.push((performance.now() / 1000).toFixed(2) + ' ' + s); };
  R.debug = null; // per le prove: R.debug = []

  /* ---------- client MQTT 3.1.1 minimo (QoS 0) su WebSocket ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  function vlen(n) { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; }
  function str(s) { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
  function packet(type, body) { const h = [type, ...vlen(body.length)]; const u = new Uint8Array(h.length + body.length); u.set(h, 0); u.set(body, h.length); return u; }
  function mqtt(url) {
    return new Promise((resolve, reject) => {
      let ws, buf = new Uint8Array(0), done = false, ping = null, pid = 1;
      const m = { url, onmsg: null, onclose: null, open: false,
        sub(topic) { if (ws.readyState !== 1) return; const id = pid++; ws.send(packet(0x82, new Uint8Array([id >> 8, id & 255, ...str(topic), 0]))); },
        pub(topic, text) { if (ws.readyState !== 1) return false; const t = str(topic), p = enc.encode(text), b = new Uint8Array(t.length + p.length); b.set(t, 0); b.set(p, t.length); ws.send(packet(0x30, b)); return true; },
        close() { m.open = false; clearInterval(ping); try { if (ws.readyState === 1) ws.send(new Uint8Array([0xe0, 0])); ws.close(); } catch (e) {} },
        buffered() { return ws ? ws.bufferedAmount : 0; } };
      const to = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) {} reject(new Error('timeout')); } }, 6000);
      try { ws = new WebSocket(url, ['mqtt']); } catch (e) { clearTimeout(to); return reject(e); }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const body = [...str('MQTT'), 4, 0x02, 0, 45, ...str('deriva_' + ID())];
        ws.send(packet(0x10, new Uint8Array(body)));
      };
      ws.onmessage = (e) => {
        const d = new Uint8Array(e.data), nb = new Uint8Array(buf.length + d.length); nb.set(buf, 0); nb.set(d, buf.length); buf = nb;
        for (;;) {
          if (buf.length < 2) break;
          let len = 0, mul = 1, i = 1, b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
          if (buf.length < i + len) break;
          const type = buf[0] >> 4, body = buf.subarray(i, i + len);
          if (type === 2) { // CONNACK
            if (!done) { done = true; clearTimeout(to); if (body[1] === 0) { m.open = true; ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); }, 20000); resolve(m); } else { ws.close(); reject(new Error('rifiutato ' + body[1])); } }
          } else if (type === 3) { // PUBLISH
            const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl));
            const q = (buf[0] >> 1) & 3, off = 2 + tl + (q ? 2 : 0);
            if (m.onmsg) { try { m.onmsg(topic, dec.decode(body.subarray(off))); } catch (er) { console.error(er); } }
          }
          buf = buf.slice(i + len);
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => { clearInterval(ping); const was = m.open; m.open = false; if (!done) { done = true; clearTimeout(to); reject(new Error('chiuso')); } else if (was && m.onclose) m.onclose(); };
    });
  }
  // messaggi: "<tipo>|<id del giocatore>|<contenuto>"
  const pack = (k, cid, s) => k + '|' + cid + '|' + (s || '');
  const unpack = (t) => { const a = t.indexOf('|'), b = t.indexOf('|', a + 1); return a < 0 || b < 0 ? null : { k: t.slice(0, a), cid: t.slice(a + 1, b), s: t.slice(b + 1) }; };
  // spezza i messaggi lunghi (fotografia del mondo all'ingresso) e li ricompone
  function chunker(send) { return (s) => { if (s.length <= CHUNK) return send('0' + s); for (let i = 0; i < s.length; i += CHUNK) send((i + CHUNK >= s.length ? '2' : '1') + s.slice(i, i + CHUNK)); }; }
  function joiner(onText) { let parts = []; return (d) => { const k = d.charCodeAt(0); if (k === 48) onText(d.slice(1)); else if (k === 49) parts.push(d.slice(1)); else if (k === 50) { parts.push(d.slice(1)); const s = parts.join(''); parts = []; onText(s); } }; }
  function iceQueue(pc) {
    const q = []; let ready = false;
    return { add(c) { if (ready) pc.addIceCandidate(c).catch(() => {}); else q.push(c); },
      ready() { ready = true; for (const c of q) pc.addIceCandidate(c).catch(() => {}); q.length = 0; } };
  }

  /* ---------- chi ospita ---------- */
  R.host = async function (port) {
    R.stopHost();
    R.port = port; R.state = 'opening';
    const code = rnd(6, ALPH), topic = topicOf(code);
    const res = await Promise.allSettled(R.BROKERS.map((u) => mqtt(u)));
    const ok = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!ok.length) { R.state = 'off'; return { ok: false, error: 'Il server dei codici non risponde: controlla la connessione a internet.' }; }
    R.code = code; R.topic = topic; R.state = 'on'; R.brokers = ok;
    for (const b of ok) attachHost(b);
    trace('host su ' + ok.map((b) => b.url).join(', '));
    return { ok: true, code };
  };
  function attachHost(b) {
    b.sub(R.topic + '/h');
    b.onmsg = (t, txt) => onHostMsg(b, txt);
    // se il broker cade, ci si ricollega con lo stesso codice
    b.onclose = () => { const url = b.url, code = R.code; setTimeout(async function retry() { if (R.state !== 'on' || R.code !== code) return; try { const nb = await mqtt(url); R.brokers = R.brokers.filter((x) => x !== b).concat(nb); attachHost(nb); } catch (e) { setTimeout(retry, 5000); } }, 2000); };
  }
  R.stopHost = function () {
    R.state = 'off'; R.code = null;
    for (const p of R.peers.values()) p.close();
    R.peers.clear();
    for (const b of R.brokers) { b.onclose = null; b.close(); }
    R.brokers = [];
  };
  function onHostMsg(b, txt) {
    const m = unpack(txt); if (!m || !m.cid) return;
    let peer = R.peers.get(m.cid);
    const reply = (k, s) => b.pub(R.topic + '/c/' + m.cid, pack(k, m.cid, s));
    if (m.k === 'P') { reply('Q', ''); return; } // "ci sei?" → "sì"
    if (!peer) { if (R.peers.size >= 8 || !['O', 'R', 'D'].includes(m.k)) return; peer = newPeer(m.cid, reply); }
    peer.seen = performance.now(); peer.reply = reply;
    if (m.k === 'O') peer.offer(JSON.parse(m.s));
    else if (m.k === 'C') peer.cand(JSON.parse(m.s));
    else if (m.k === 'R') peer.relay();
    else if (m.k === 'D') peer.data(m.s);
    else if (m.k === 'X') peer.close();
  }
  function newPeer(cid, reply) {
    let ws = null, wsQ = [], closed = false, mode = null, pc = null, iq = null, chSend = null;
    const toLocal = (txt) => { if (ws && ws.readyState === 1) ws.send(txt); else wsQ.push(txt); };
    const fromRelay = joiner(toLocal);
    const relaySend = chunker((s) => peer.reply('D', s));
    const peer = { seen: performance.now(), reply,
      // il canale verso il server locale della partita si apre solo quando c'è un collegamento
      bridge() {
        if (ws) return;
        ws = new WebSocket('ws://127.0.0.1:' + R.port);
        ws.onopen = () => { for (const q of wsQ) ws.send(q); wsQ = []; };
        ws.onmessage = (ev) => { if (mode === 'p2p' && chSend) chSend(ev.data); else if (mode === 'relay') relaySend(ev.data); };
        ws.onclose = () => { if (mode === 'relay') peer.reply('X', ''); peer.close(); };
      },
      async offer(o) {
        if (pc) return;
        pc = new RTCPeerConnection(R.ICE); iq = iceQueue(pc);
        pc.onicecandidate = (e) => { if (e.candidate) peer.reply('C', JSON.stringify(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate)); };
        pc.ondatachannel = (e) => {
          const ch = e.channel, rx = joiner(toLocal);
          ch.onmessage = (ev) => { if (typeof ev.data === 'string') rx(ev.data); };
          chSend = chunker((s) => { if (ch.readyState === 'open') ch.send(s); });
          ch.onopen = () => { if (mode) return; mode = 'p2p'; trace('host: diretto con ' + cid); peer.bridge(); };
          ch.onclose = () => { if (mode === 'p2p') peer.close(); };
        };
        try { await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp }); iq.ready(); const a = await pc.createAnswer(); await pc.setLocalDescription(a); peer.reply('A', JSON.stringify({ sdp: a.sdp })); }
        catch (e) { trace('host: offerta non valida ' + e); }
      },
      cand(c) { if (iq) iq.add(c); },
      // decide chi entra: se ha scelto il ponte si usa il ponte, anche se il diretto si era appena aperto qui
      relay() { if (mode !== 'relay') { mode = 'relay'; trace('host: ponte con ' + cid); try { if (pc) pc.close(); } catch (e) {} pc = null; peer.bridge(); } },
      data(s) { if (mode !== 'relay') peer.relay(); fromRelay(s); },
      close() { if (closed) return; closed = true; try { if (ws) ws.close(); } catch (e) {} try { if (pc) pc.close(); } catch (e) {} R.peers.delete(cid); },
    };
    R.peers.set(cid, peer);
    // chi non si fa più sentire viene chiuso (il giocatore manda un segnale ogni 10 s sul ponte)
    const watch = setInterval(() => { if (closed) return clearInterval(watch); if (mode !== 'p2p' && performance.now() - peer.seen > (mode ? 40000 : 30000)) { clearInterval(watch); peer.close(); } }, 5000);
    return peer;
  }

  /* ---------- chi si unisce: restituisce un oggetto simile a un WebSocket ---------- */
  R.join = function (code) {
    code = R.normCode(code);
    const topic = topicOf(code), cid = ID();
    const sock = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, failReason: null, mode: null,
      send(s) { if (sendFn) sendFn(s); },
      close() { finish(); } };
    let b = null, pc = null, ch = null, iq = null, sendFn = null, ended = false, keep = null, p2pT = null;
    const rx = joiner((txt) => { if (sock.onmessage) sock.onmessage({ data: txt }); });
    const pub = (k, s) => b && b.pub(topic + '/h', pack(k, cid, s));
    function finish(reason) {
      if (ended) return; ended = true;
      const wasOpen = sock.readyState === 1;
      sock.readyState = 3; clearInterval(keep); clearTimeout(p2pT);
      if (b) { if (sock.mode === 'relay') pub('X', ''); b.onclose = null; setTimeout(() => b.close(), 150); }
      try { if (pc) pc.close(); } catch (e) {}
      if (reason) sock.failReason = reason;
      if (!wasOpen && sock.onerror) sock.onerror({ reason });
      if (sock.onclose) sock.onclose({ reason });
    }
    function opened(mode) {
      if (sock.readyState !== 0 || ended) return;
      sock.mode = mode; sock.readyState = 1; clearTimeout(p2pT); trace('entra: ' + mode);
      if (mode === 'p2p') { sendFn = chunker((s) => { if (ch && ch.readyState === 'open') ch.send(s); }); if (b) { b.onclose = null; const bb = b; setTimeout(() => bb.close(), 1500); } }
      else {
        try { if (pc) pc.close(); } catch (e) {} pc = null;
        sendFn = chunker((s) => pub('D', s));
        keep = setInterval(() => pub('K', ''), 10000);
      }
      if (sock.onopen) sock.onopen();
    }
    function onMsg(txt) {
      const m = unpack(txt); if (!m || m.cid !== cid) return;
      if (m.k === 'Q') b.found = true;
      else if (m.k === 'A' && pc) pc.setRemoteDescription({ type: 'answer', sdp: JSON.parse(m.s).sdp }).then(() => iq.ready()).catch(() => {});
      else if (m.k === 'C' && iq) iq.add(JSON.parse(m.s));
      else if (m.k === 'D') rx(m.s);
      else if (m.k === 'X') finish('La partita è stata chiusa da chi ospita.');
    }
    (async () => {
      // 1. trova la partita: prova i broker uno dopo l'altro
      let reached = 0;
      for (const url of R.BROKERS) {
        if (ended) return;
        let nb; try { nb = await mqtt(url); } catch (e) { trace('broker ' + url + ' non risponde'); continue; }
        reached++;
        nb.onmsg = (t, txt) => onMsg(txt);
        nb.sub(topic + '/c/' + cid);
        b = nb;
        await new Promise((r) => setTimeout(r, 300)); // il broker registra l'iscrizione
        for (let i = 0; i < 4 && !nb.found && !ended; i++) { pub('P', ''); await new Promise((r) => setTimeout(r, 900)); }
        if (nb.found) break;
        nb.close(); b = null;
      }
      if (ended) return;
      if (!b) return finish(reached ? 'Nessuna partita aperta con il codice ' + R.fmt(code) + '. Controlla il codice: chi ospita lo vede nel menu (Esc) e la partita deve essere aperta.' : 'Il server dei codici non risponde: controlla la connessione a internet.');
      b.onclose = () => { if (sock.mode !== 'p2p') finish('Collegamento con il server dei codici perso.'); };
      // 2. collegamento diretto, se la rete lo permette
      p2pT = setTimeout(() => { trace('entra: diretto non riuscito, passo al ponte'); pub('R', ''); opened('relay'); }, R.P2P_WAIT);
      try {
        pc = new RTCPeerConnection(R.ICE); iq = iceQueue(pc);
        pc.onicecandidate = (e) => { if (e.candidate && sock.readyState === 0) pub('C', JSON.stringify(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate)); };
        ch = pc.createDataChannel('deriva', { ordered: true });
        ch.onmessage = (ev) => { if (typeof ev.data === 'string') rx(ev.data); };
        ch.onopen = () => opened('p2p');
        ch.onclose = () => { if (sock.mode === 'p2p') finish(); };
        const off = await pc.createOffer(); await pc.setLocalDescription(off);
        pub('O', JSON.stringify({ sdp: off.sdp }));
      } catch (e) { clearTimeout(p2pT); pub('R', ''); opened('relay'); }
    })().catch((e) => finish('Impossibile avviare il collegamento.'));
    return sock;
  };
})();
