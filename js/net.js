'use strict';
/* ==========================================================
   Multigiocatore (client): connessione, sincronizzazione,
   avatar degli altri giocatori, fuoco amico, ping
   ========================================================== */
(function () {
  const G = globalThis.G;
  const V3 = THREE.Vector3;
  const N = (G.Net = { on: false, isHost: false, ws: null, id: null, slot: 0, ff: true, remotes: new Map(), ping: 0, stT: 0, pingT: 0, pdT: 0, timeT: 0, boatT: 0 });
  N.PROTOCOL = 6; // 1.19.1: menu Giocatori (operatori)
  Object.defineProperty(N, 'online', { get: () => N.on });
  N.animalSeen = new Map();
  N.COLORS = [0xd9583b, 0x3b8fd9, 0x4fae5a, 0xe0b23a];
  N.COLOR_CSS = ['#e8735a', '#5aa6ec', '#6cc47a', '#efc65a'];

  // operatori: chi ospita li sceglie; restano tali (per nome) anche nelle partite successive
  N.setOp = function (id, on) {
    if (!N.isHost) return; const r = N.remotes.get(id); if (!r) return;
    r.op = !!on; const nm = String(r.name).toLowerCase(); G.state.ops = (G.state.ops || []).filter((x) => x !== nm); if (on) G.state.ops.push(nm); G.saveSoon();
    N.send({ t: 'op', id, on: on ? 1 : 0 });
  };
  N.send = function (o) { if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(o)); };
  // target: indirizzo ws://… oppure un canale del codice partita (G.Relay.join)
  N.connect = function (target, name, isHost) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (!done) { done = true; resolve(r); } };
      const relay = typeof target !== 'string';
      const where = relay ? 'la partita' : target.replace('ws://', '');
      let ws;
      try { ws = relay ? target : new WebSocket(target); } catch (e) { return finish({ ok: false, reason: 'Indirizzo non valido.' }); }
      N.ws = ws;
      const lan = !relay && !/^ws:\/\/(127\.|localhost)/.test(target);
      const to = setTimeout(() => { try { ws.close(); } catch (e) {} finish({ ok: false, reason: relay ? 'La partita non risponde.' : 'Nessuna risposta da ' + where + '.' + (lan ? ' Se siete in case diverse usate il codice partita; sulla stessa rete chi ospita deve premere “Sblocca nel firewall”.' : '') }); }, relay ? 40000 : 8000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: N.PROTOCOL, name, host: !!isHost }));
      ws.onerror = (e) => { clearTimeout(to); finish({ ok: false, reason: (relay && ws.failReason) || ('Impossibile collegarsi a ' + where + '.' + (lan ? ' Controlla l’indirizzo e che la partita sia aperta.' : '')) }); };
      ws.onclose = () => {
        clearTimeout(to);
        finish({ ok: false, reason: (relay && ws.failReason) || 'Connessione chiusa.' });
        if (N.on) { N.leave(true); G.UI.toast('Connessione con la partita persa', 'warn'); }
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'welcome') { clearTimeout(to); N.onWelcome(m, isHost); finish({ ok: true }); }
        else if (m.t === 'reject') { clearTimeout(to); finish({ ok: false, reason: m.reason }); }
        else N.handle(m);
      };
    });
  };
  N.onWelcome = function (m, isHost) {
    N.on = true; N.id = m.id; N.slot = m.slot; N.isHost = !!m.host; N.ff = m.ff; N.op = false;
    // in multigiocatore gli animali di terra li simula il server
    for (const a of G.Entities.list.slice()) if (a.kind === 'animal' && !a.remote) G.Entities.removeAnimal(a);
    if (!isHost) G.startFromSnapshot(m.snap, m.you);
    // mappa comune: si riceve quella della partita e si manda la propria
    if (G.MapUI) { G.MapUI.merge(m.snap && m.snap.mapEx, m.snap && m.snap.mapDisc); setTimeout(() => { if (N.on) G.MapUI.flush(true); }, 1500); }
    for (const p of m.players) { N.addRemote(p.id, p.name, p.slot, p.st); const r = N.remotes.get(p.id); if (r) { r.host = !!p.host; r.op = !!p.op; } }
    G.UI.refreshPlayers();
    G.UI.toast(isHost ? 'Partita aperta: gli amici possono unirsi' : 'Sei nella partita!', 'good');
  };
  N.leave = function (lost) {
    const wasOn = N.on;
    N.on = false;
    try { if (N.ws) N.ws.close(); } catch (e) {}
    N.ws = null;
    for (const id of [...N.remotes.keys()]) N.removeRemote(id);
    if (N.isHost && window.deriva) window.deriva.hostStop();
    if (N.isHost && G.Relay) G.Relay.stopHost();
    if (G.Voice) G.Voice.leaveAll();
    const wasClient = wasOn && !N.isHost;
    N.isHost = false;
    G.UI.refreshPlayers();
    if (wasClient || lost) G.toTitle();
  };

  /* ---------------- messaggi in arrivo ---------------- */
  N.handle = function (m) {
    switch (m.t) {
      case 'bpcs': if (G.FreeBoat) G.FreeBoat.onRemote(m); break;
      case 'banchor': { const b = G.Boats.byId(m.id); if (b) b.anchored = !!m.on; break; }
      case 'bhull': { const b = G.Boats.byId(m.id); if (b) b.hull = m.h; break; }
      case 'bdelboat': { const b = G.Boats.byId(m.id); if (b) G.Boats.remove(b); break; }
      case 'vsig': if (G.Voice) G.Voice.onSignal(m); break;
      case 'join': N.addRemote(m.id, m.name, m.slot); { const r = N.remotes.get(m.id); if (r) r.host = !!m.host; } if (N.isHost && G.state.ops && G.state.ops.includes(String(m.name).toLowerCase())) setTimeout(() => N.setOp(m.id, true), 800); G.UI.toast(`${m.name} si è unito alla partita`, 'good'); G.UI.refreshPlayers(); break;
      case 'leave': N.removeRemote(m.id); G.UI.toast(`${m.name} ha lasciato la partita`); G.UI.refreshPlayers(); break;
      case 'st': { const r = N.remotes.get(m.id); if (r) N.applyState(r, m); break; }
      case 'pong': N.ping = Math.round(performance.now() - m.c); break;
      case 'rm': N.remoteRemove(m.id); break;
      case 'badd': if (!G.Build.byId(m.p.id)) G.Build.add(m.p, true); break;
      case 'bdel': { const p = G.Build.byId(m.id); if (p) G.Build.remove(p); break; }
      case 'bupd': {
        const p = G.Build.byId(m.id); if (!p) break;
        if ('open' in m) { p.open = !!m.open; G.Build.refresh(p); }
        if ('inv' in m && p.inv) { p.inv.splice(0, p.inv.length, ...m.inv); if (G.UI.open === 'chest' && G.UI.chestInv === p.inv) G.UI.renderPanel(); }
        if ('cook' in m && p.cook) { Object.assign(p.cook, m.cook); if (G.UI.open === 'fire' && G.UI.fire === p) G.UI.renderPanel(); }
        break;
      }
      case 'bnew': if (!G.Boats.byId(m.b.id)) G.Boats.create(m.b); break;
      case 'bfill': { const b = G.Boats.byId(m.id); if (b) { G.Boats.fillPart(b, m.part, true); if (G.UI.open === 'boat') G.UI.renderPanel(); } break; }
      case 'bst': { const b = G.Boats.byId(m.id); if (b) { b.net = { x: m.x, z: m.z, yaw: m.yaw, speed: m.speed, by: m.by, t: performance.now() }; if (m.op) { b.oarL.ph = m.op[0]; b.oarL.on = !!m.op[1]; b.oarR.ph = m.op[2]; b.oarR.on = !!m.op[3]; } } break; }
      case 'binv': { const b = G.Boats.byId(m.id); if (b && b.inv) { b.inv.splice(0, b.inv.length, ...m.inv); if (G.UI.open === 'chest' && G.UI.chestInv === b.inv) G.UI.renderPanel(); } break; }
      case 'hurt': {
        const P = G.Player;
        P.hurt(m.dmg);
        if (m.fx !== undefined) { P.vel.x += m.fx * 5; P.vel.z += m.fz * 5; P.vel.y = Math.max(P.vel.y, 3); }
        if (!m.enemy || !N._hm || performance.now() - N._hm > 6000) { N._hm = performance.now(); G.UI.toast(m.enemy ? `${m.from}: ti attacca!` : `${m.from} ti ha colpito`, 'warn'); }
        if (G.Audio) G.Audio.hit('soft');
        break;
      }
      case 'time': if (!N.isHost) { N.targetTime = m.time; if (m.vg !== undefined) G.voiceGlobal = !!m.vg; if (m.ki !== undefined) G.keepInv = !!m.ki; if (m.wind !== undefined) G.Boats.wind.dir = m.wind; if (m.lv !== undefined && m.lv !== G.WIND.level) G.setWind(m.lv); if (m.mode && m.mode !== G.mode) G.setMode(m.mode); if (m.en !== undefined && !!m.en === !!G.enemiesOff) G.setEnemies(!!m.en); if (m.wx && G.Climate) { const C = G.Climate; if (m.wx.kind !== C.state.kind) C.setWeather(m.wx.kind, m.wx.lock, false); C.state.t = m.wx.t; C.state.lock = !!m.wx.lock; G.moonOffset = m.wx.moon || 0; } } break;
      case 'chat': G.UI.toast(`${m.from}: ${m.text}`); break;
      case 'padm': if (G.Admin) G.Admin.onCmd(m); break;
      case 'kicked': G.UI.toast(`Sei stato espulso dalla partita da ${m.by}`, 'warn'); setTimeout(() => N.leave(true), 300); break;
      case 'pinfo': if (G.Admin) G.Admin.onInfo(m.id, m.d); break;
      case 'oplog': if (G.Admin) G.Admin.log(m.text); break;
      case 'drop': case 'dpick': if (G.Drops) G.Drops.onNet(m); break;
      case 'opset': N.op = !!m.on; G.UI.toast(m.on ? 'Ora sei operatore: puoi usare i comandi (T) e gli strumenti (K)' : 'Non sei più operatore', m.on ? 'good' : ''); if (G.UI.menu) G.UI.showMenu(G.UI.menu); break;
      case 'ops': for (const r of N.remotes.values()) r.op = (m.ids || []).includes(r.id); if (G.UI.menu === 'main') G.UI.showMenu('main'); break;
      case 'wcmd': if (N.isHost && G.Cmd) G.Cmd.run(m.line, m.from); break;
      case 'an': N.syncAnimals(m.l); break;
      case 'adead': {
        const a = G.Entities.byId.get(m.id);
        (G.state.killed = G.state.killed || new Set()).add(m.id);
        const sp = a ? a.sp : null;
        if (a) { G.Entities.killFx(a); G.Entities.removeAnimal(a); }
        if (m.by === N.id) { for (const [id, n] of m.drops) G.Player.give(id, n); if (sp) G.Entities.onKill(sp); }
        break;
      }
      case 'give': for (const [id, n] of m.items) G.Player.give(id, n); break;
      case 'chest': G.Structures.netChest(m.id, m.inv); break;
      case 'fx': G.Combat.netFx(m); break;
      case 'mapex': if (G.MapUI) G.MapUI.merge(m.k, m.d); break;
      case 'dig': if (G.Dig && Array.isArray(m.s)) G.Dig.add(m.s, true); break;
      case 'pets': if (G.Pets && Array.isArray(m.l)) G.Pets.remote = m.l; break;
    }
  };
  // animali vicini ricevuti dal server: [id, specie, x, z, yaw, velocità, lana, ferito, scala]
  N.syncAnimals = function (list) {
    const E = G.Entities, now = performance.now();
    for (const [id, sp, x, z, yaw, speed, wool, hurt, scale, atk] of list) {
      let a = E.byId.get(id);
      if (!a) {
        const [cx, cz] = id.split(',');
        const ch = G.World.chunks.get(cx + ',' + cz) || null;
        a = E.addAnimal({ id, sp, x, z, yaw, scale, speed: 0, wool: !!wool, hurt: 0, flee: 0 }, ch, true);
      }
      a.net.x = x; a.net.z = z; a.net.yaw = yaw; a.net.speed = speed;
      a.st.wool = !!wool; if (hurt) a.st.hurt = Math.max(a.st.hurt || 0, 0.2);
      if (atk && !(a.st.atkT > 0)) a.st.atkT = 0.45;
      N.animalSeen.set(id, now);
    }
    for (const a of E.list.slice()) if (a.kind === 'animal' && a.remote && now - (N.animalSeen.get(a.id) || 0) > 2500) { E.removeAnimal(a); N.animalSeen.delete(a.id); }
  };
  N.remoteRemove = function (id) {
    G.state.removed.add(id);
    const [cx, cz] = id.split(',');
    const ch = G.World.chunks.get(cx + ',' + cz);
    if (!ch) return;
    const res = ch.resources.find((r) => r.id === id);
    if (res) {
      if (res.type === 'tree') G.FX.burst(res.x, res.y + 2, res.z, [0.35, 0.5, 0.2], 20, 3);
      G.World.removeResource(res, true);
    }
  };

  /* ---------------- invio periodico ---------------- */
  N.update = function (dt, t) {
    if (!N.on) return;
    const P = G.Player, now = performance.now();
    N.stT -= dt; N.pingT -= dt; N.pdT -= dt; N.timeT -= dt; N.boatT -= dt;
    if (N.stT <= 0) {
      N.stT = 1 / 15;
      const held = P.held();
      N.send({ t: 'st', p: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)], yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(2),
        h: held ? held.id : null, lh: P.equip && P.equip[0] ? P.equip[0].id : null, bl: P.blocking ? 1 : 0, sw: P.swingT > 0.5 ? 1 : 0, sm: P.swim ? 1 : 0, b: P.boat ? P.boat.id : null, cr: G.creative() || P.ghost ? 1 : 0, hm: P.boat && P.helm && P.boat.T.sit ? 1 : 0, hp: Math.round(P.health), ping: N.ping });
    }
    if (N.pingT <= 0) { N.pingT = 2; N.send({ t: 'ping', c: now }); }
    if (N.pdT <= 0) { N.pdT = 8; N.send({ t: 'pdata', data: P.serialize() }); }
    if (N.isHost && N.timeT <= 0) { N.timeT = 3; N.send({ t: 'time', time: G.time, wind: G.Boats.wind.dir, lv: G.WIND.level, mode: G.mode, en: G.enemiesOff ? 0 : 1, vg: G.voiceGlobal ? 1 : 0, ki: G.keepInv ? 1 : 0, wx: G.Climate ? G.Climate.serialize() : undefined }); }
    if (!N.isHost && N.targetTime !== undefined) { const d = N.targetTime - G.time; if (Math.abs(d) > 0.02) G.time = N.targetTime; else G.time += d * Math.min(1, dt); }
    // stato della barca che guido
    if (P.boat && P.helm && G.Boats.isComplete(P.boat) && N.boatT <= 0) {
      N.boatT = 1 / 12; const b = P.boat;
      N.send({ t: 'bst', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), yaw: +b.yaw.toFixed(3), speed: +b.speed.toFixed(2), op: b.T.oars ? [+b.oarL.ph.toFixed(2), b.oarL.on ? 1 : 0, +b.oarR.ph.toFixed(2), b.oarR.on ? 1 : 0] : undefined });
    }
    for (const r of N.remotes.values()) updateAvatar(r, dt, t);
  };

  /* ---------------- avatar ---------------- */
  function nameSprite(name, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '600 30px Signika, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(250, x.measureText(name).width + 28);
    x.fillStyle = 'rgba(6,18,23,0.72)'; x.beginPath(); x.roundRect ? x.roundRect(128 - w / 2, 10, w, 44, 12) : x.rect(128 - w / 2, 10, w, 44); x.fill();
    x.fillStyle = color; x.fillRect(128 - w / 2 + 10, 28, 8, 8);
    x.fillStyle = '#e8efe9'; x.fillText(name, 136, 33);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const s = new THREE.Sprite(m); s.scale.set(1.6, 0.4, 1); s.renderOrder = 20;
    return s;
  }
  function buildAvatar(slot) {
    // persona vera (vestiti Quaternius) se i modelli sono caricati; guarda verso -z come il giocatore
    if (G.Humans && G.Humans.ready) {
      try {
        const look = [11, 23, 37, 41][slot % 4], outfit = ['ranger', 'contadino', 'ranger_f', 'contadina'][slot % 4];
        const p = G.Humans.build(look, { outfit, noHood: true, skin: ['Light', 'Dark', 'Light', 'Deep'][slot % 4] });
        const g = new THREE.Group(); p.root.rotation.y = Math.PI; g.add(p.root);
        return { g, body: p.body, head: p.head, person: p, hand: p.handR, handL: p.handL };
      } catch (e) { console.warn(e); }
    }
    const shirt = new THREE.MeshStandardMaterial({ color: N.COLORS[slot % 4], roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a27a, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: [0x3a2618, 0x111111, 0x8a5a2e, 0xc9a25e][slot % 4], roughness: 0.9 });
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m; };
    const limb = (w, h, mat, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const m = box(w, h, w, mat, 0, -h / 2, 0); piv.add(m); body.add(piv); return piv; };
    body.add(box(0.46, 0.62, 0.26, shirt, 0, 1.18, 0));
    const head = new THREE.Group(); head.position.set(0, 1.6, 0); body.add(head);
    head.add(box(0.3, 0.32, 0.3, skin, 0, 0.06, 0), box(0.32, 0.1, 0.32, hair, 0, 0.24, 0), box(0.32, 0.18, 0.06, hair, 0, 0.14, 0.15));
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    head.add(box(0.05, 0.05, 0.02, eyeM, 0.07, 0.08, -0.155), box(0.05, 0.05, 0.02, eyeM, -0.07, 0.08, -0.155));
    const legL = limb(0.18, 0.84, pants, 0.11, 0.86), legR = limb(0.18, 0.84, pants, -0.11, 0.86);
    const armL = limb(0.14, 0.6, shirt, 0.31, 1.46), armR = limb(0.14, 0.6, shirt, -0.31, 1.46);
    const hand = new THREE.Group(); hand.position.set(0, -0.58, -0.05); armR.add(hand);
    const handL = new THREE.Group(); handL.position.set(0, -0.58, -0.05); armL.add(handL);
    return { g, body, head, legL, legR, armL, armR, hand, handL };
  }
  N.addRemote = function (id, name, slot, st) {
    if (N.remotes.has(id)) return;
    const av = buildAvatar(slot);
    const tag = nameSprite(name, N.COLOR_CSS[slot % 4]); tag.position.y = 2.15; av.g.add(tag);
    G.scene.add(av.g);
    const r = Object.assign(av, { id, name, slot, pos: new V3(0, -100, 0), target: new V3(0, -100, 0), yaw: 0, tyaw: 0, pitch: 0, phase: 0, speed: 0, held: null, swing: 0, ping: 0, hp: 100, seen: false });
    N.remotes.set(id, r);
    if (st) N.applyState(r, st);
  };
  N.removeRemote = function (id) { const r = N.remotes.get(id); if (!r) return; if (G.Voice) G.Voice.closePeer(id); G.scene.remove(r.g); N.remotes.delete(id); };
  N.applyState = function (r, m) {
    r.target.set(m.p[0], m.p[1], m.p[2]);
    if (!r.seen) { r.pos.copy(r.target); r.seen = true; }
    r.tyaw = m.yaw; r.pitch = m.pitch; r.swimming = !!m.sm; r.boat = m.b; r.sit = !!m.hm; r.ping = m.ping || 0; r.hp = m.hp;
    if (m.sw) r.swing = 1;
    r.blocking = !!m.bl;
    if (r.lheld !== (m.lh || null)) {
      r.lheld = m.lh || null; r.handL.clear();
      if (m.lh && G.Player.toolMesh) { const tm = G.Player.toolMesh(m.lh).clone(); tm.scale.setScalar(1.6); tm.rotation.x -= 1.2; r.handL.add(tm); }
    }
    if (r.held !== m.h) {
      r.held = m.h; r.hand.clear();
      if (m.h && G.Player.toolMesh) { const tm = G.Player.toolMesh(m.h).clone(); tm.scale.setScalar(1.6); tm.rotation.x -= 1.2; r.hand.add(tm); }
    }
  };
  N.buildAvatar = (slot) => buildAvatar(slot);
  function updateAvatar(r, dt) {
    const prev = r.pos.clone();
    r.pos.lerp(r.target, Math.min(1, dt * 12));
    r.yaw += G.angleDiff(r.yaw, r.tyaw) * Math.min(1, dt * 12);
    const sp = prev.distanceTo(r.pos) / Math.max(dt, 1e-3);
    r.speed += (Math.min(sp, 7) - r.speed) * Math.min(1, dt * 8);
    r.g.position.copy(r.pos);
    r.g.rotation.y = r.yaw;
    const sitting = !!r.sit;
    if (r.person) {
      r.swing = Math.max(0, r.swing - dt * 3);
      r.person.look = -r.pitch * 0.5;
      G.Humans.pose(r.person, dt, r.swimming || sitting ? 0 : r.speed, r.swimming ? 'swim' : sitting ? 'sit' : r.swing > 0 ? 'attack' : 'idle', 1 - r.swing);
      r.g.visible = r.target.y > -90;
      return;
    }
    r.phase += r.speed * dt * 2.4;
    const sw = Math.sin(r.phase) * Math.min(r.speed * 0.18, 0.8);
    r.legL.rotation.x = sitting ? -1.4 : sw; r.legR.rotation.x = sitting ? -1.4 : -sw;
    r.armL.rotation.x = r.blocking ? -1.3 : -sw * 0.8;
    r.swing = Math.max(0, r.swing - dt * 3);
    r.armR.rotation.x = sw * 0.8 - Math.sin(r.swing * Math.PI) * 1.6;
    r.head.rotation.x = -r.pitch * 0.6;
    r.body.rotation.x = r.swimming ? -1.2 : 0;
    r.body.position.y = sitting ? -0.75 : r.swimming ? -0.9 : 0;
    r.g.visible = r.target.y > -90;
  }
  // mira sugli altri giocatori (per il fuoco amico)
  N.raycast = function (o, d, max) {
    let best = null, bt = max;
    for (const r of N.remotes.values()) {
      for (const [hy, rad] of [[1.15, 0.38], [1.65, 0.24], [0.5, 0.3]]) {
        const cx = r.pos.x, cy = r.pos.y + hy, cz = r.pos.z;
        const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
        const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - rad * rad;
        const disc = b * b - c; if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < bt) { bt = t; best = r; }
      }
    }
    return best ? { remote: best, t: bt } : null;
  };
  N.hit = function (r, dmg) {
    if (!N.ff) { G.UI.toast('Il fuoco amico è disattivato in questa partita'); return; }
    const dx = r.pos.x - G.Player.pos.x, dz = r.pos.z - G.Player.pos.z, l = Math.hypot(dx, dz) || 1;
    N.send({ t: 'hit', target: r.id, dmg, fx: dx / l, fz: dz / l });
    G.FX.burst(r.pos.x, r.pos.y + 1.2, r.pos.z, [0.75, 0.15, 0.12], 8, 2);
    if (G.Audio) G.Audio.hit('soft');
  };
})();
