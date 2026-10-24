'use strict';
/* ==========================================================
   Giocatore: movimento, nuoto, sopravvivenza, azioni, pesca
   ========================================================== */
(function () {
  const G = globalThis.G;
  const V3 = THREE.Vector3;
  const P = (G.Player = {
    pos: new V3(4, 10, 6), vel: new V3(), eye: new V3(), yaw: 0.6, pitch: -0.05,
    onGround: false, swim: false, under: false, health: 100, hunger: 100, thirst: 100, oxygen: 100,
    inv: new Array(36).fill(null), sel: 0, boat: null, helm: false, local: new THREE.Vector3(), lvy: 0, spawn: null, cam3: false,
    swingT: 0, actionCd: 0, bob: 0, heldTorch: false, torchPos: new V3(), fish: null, target: null, dmgFlash: 0,
  });
  const EYE = 1.62, RAD = 0.32, HEIGHT = 1.8;
  P.keys = {}; P.ax = { f: 0, r: 0 };
  P.mouse = { l: false, r: false };

  /* ---------------- INVENTARIO ---------------- */
  P.count = (id) => (G.creative && G.creative() ? 9999 : P.inv.reduce((s, it) => s + (it && it.id === id ? it.n : 0), 0));
  P.give = function (id, n, silent) {
    const def = G.ITEMS[id]; let left = n;
    for (let pass = 0; pass < 2 && left > 0; pass++) {
      const order = [...Array(36).keys()];
      for (const i of order) {
        const s = P.inv[i];
        if (pass === 0 && s && s.id === id && s.n < def.stack) { const k = Math.min(def.stack - s.n, left); s.n += k; left -= k; }
        else if (pass === 1 && !s) { const k = Math.min(def.stack, left); P.inv[i] = { id, n: k }; left -= k; }
        if (left <= 0) break;
      }
    }
    if (!silent) G.UI.pickup(id, n - left);
    if (left > 0) G.UI.toast('Inventario pieno', 'warn');
    G.UI.refreshHotbar();
    return n - left;
  };
  P.take = function (id, n) {
    if (G.creative && G.creative()) { G.UI.refreshHotbar(); return; } // in creativa niente si consuma
    for (let i = 35; i >= 0 && n > 0; i--) { const s = P.inv[i]; if (s && s.id === id) { const k = Math.min(s.n, n); s.n -= k; n -= k; if (s.n <= 0) P.inv[i] = null; } }
    G.UI.refreshHotbar();
  };
  P.held = () => P.inv[P.sel];
  // equipaggiamento: [mano sinistra, testa, corpo, piedi]
  P.equip = [null, null, null, null];
  P.left = () => P.equip[0];
  P.swapHands = function () {
    if (G.UI.open) return;
    const a = P.inv[P.sel], b = P.equip[0];
    if (!a && !b) { G.UI.toast('Mano sinistra vuota: F scambia l’oggetto in mano con quello a sinistra'); return; }
    P.inv[P.sel] = b; P.equip[0] = a;
    P.vmLId = undefined; P.vmId = undefined; P.refreshHeld(); G.UI.refreshHotbar();
    G.UI.toast(a ? `Mano sinistra: ${G.ITEMS[a.id].n}` : 'Mano sinistra libera');
    if (G.Audio) G.Audio.click();
  };
  // oggetto con dati propri (mappe del tesoro, pacchi): occupa uno slot da solo
  P.giveStack = function (st) {
    const i = P.inv.findIndex((x) => !x); if (i < 0) { G.UI.toast('Inventario pieno', 'warn'); return false; }
    P.inv[i] = st; G.UI.pickup(st.id, st.n); G.UI.refreshHotbar(); return true;
  };

  /* ---------------- INIZIALIZZAZIONE ---------------- */
  P.init = function (camera) {
    P.cam = camera;
    // modello in mano (viewmodel)
    P.vm = new THREE.Group(); camera.add(P.vm);
    P.vmHolder = new THREE.Group(); P.vm.add(P.vmHolder);
    P.vm.position.set(0.36, -0.36, -0.62);
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a27a, roughness: 0.7 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x3f5a6b, roughness: 0.9 });
    P.arm = new THREE.Group();
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), sleeve); a1.position.set(0.04, -0.06, 0.22);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.13), skin); a2.position.set(0.02, -0.04, -0.04);
    P.arm.add(a1, a2);
    P.vmItem = new THREE.Group(); P.vmHolder.add(P.vmItem);
    P.vmCache = {};
    // mano sinistra
    P.vmL = new THREE.Group(); camera.add(P.vmL); P.vmL.position.set(-0.38, -0.38, -0.6);
    P.vmLHolder = new THREE.Group(); P.vmL.add(P.vmLHolder);
    P.vmLItem = new THREE.Group(); P.vmLHolder.add(P.vmLItem);
    P.vmCacheL = {};
    // pesca
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe04030, roughness: 0.4 }));
    const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); bobTop.position.y = 0.06; bob.add(bobTop);
    P.bobber = bob; bob.visible = false; G.scene.add(bob);
    P.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.7 }));
    P.line.frustumCulled = false; P.line.visible = false; G.scene.add(P.line);
  };
  function toolMesh(id) {
    const MAT = G.MAT;
    const det = G.Tools && G.Tools.build(id);
    if (det) { det.rotation.x += -0.25; det.position.set(0.02, 0.0, -0.06); return det; }
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.8 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.9 });
    const handle = (len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, len, 6), wood); m.position.y = len / 2 - 0.06; g.add(m); };
    if (id === 'ascia') { handle(0.5); const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.16), stone); h.position.set(0, 0.36, 0.06); g.add(h); }
    else if (id === 'piccone') { handle(0.5); const h = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 5, 12, Math.PI), stone); h.position.set(0, 0.32, 0); h.rotation.y = Math.PI / 2; g.add(h); }
    else if (id === 'coltello') { handle(0.14); const h = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 4), stone); h.position.set(0, 0.17, 0); g.add(h); }
    else if (id === 'canna') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.8, 5), wood); m.position.y = 0.35; g.add(m); g.rotation.x = -0.5; }
    else if (id === 'torcia') { handle(0.4); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26).translate(0, 0.13, 0), G.flameMaterial()); f.position.y = 0.36; g.add(f); }
    else {
      const tex = new THREE.TextureLoader().load(G.icon(id)); tex.encoding = THREE.sRGBEncoding;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }));
      m.position.set(-0.02, 0.06, -0.02); m.rotation.set(-0.2, 0.4, 0); g.add(m);
    }
    g.rotation.x += -0.25; g.position.set(0.02, 0.0, -0.06);
    return g;
  }
  P.toolMesh = (id) => toolMesh(id);
  P.refreshHeld = function () {
    const it = P.held(), id = it ? it.id : null;
    const L = P.equip[0], lid = L ? L.id : null;
    if (P.vmLId !== lid) {
      P.vmLId = lid; P.vmLItem.clear();
      if (lid) {
        if (!P.vmCacheL[lid]) { const m = lid === 'scudo' ? shieldMesh() : toolMesh(lid); m.rotation.y += 0.5; m.rotation.z += 0.15; P.vmCacheL[lid] = m; }
        P.vmLItem.add(P.vmCacheL[lid]);
      }
      P._torchSrc = null;
    }
    const lt = lid === 'torcia' || lid === 'lanterna';
    if (P.vmId === id && P._torchSrc) return;
    P.vmId = id;
    P.vmItem.clear();
    if (id) { if (!P.vmCache[id]) P.vmCache[id] = toolMesh(id); P.vmItem.add(P.vmCache[id]); }
    const rt = id === 'torcia' || id === 'lanterna';
    P.heldTorch = rt || lt;
    P.torchPower = id === 'lanterna' || lid === 'lanterna' ? 2.4 : 0.85;
    P._torchSrc = rt ? 'r' : lt ? 'l' : 'none';
    if (P.fish && id !== 'canna') P.endFish();
  };
  function shieldMesh() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.85 }), iron = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.5, metalness: 0.6 });
    const sh = new THREE.Shape(); sh.moveTo(0, 0.24); sh.lineTo(0.18, 0.18); sh.quadraticCurveTo(0.18, -0.12, 0, -0.26); sh.quadraticCurveTo(-0.18, -0.12, -0.18, 0.18); sh.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }), wood); body.position.z = -0.015; g.add(body);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), iron); boss.position.z = -0.02; g.add(boss);
    g.rotation.set(0, Math.PI, 0); g.position.set(0.04, 0.05, -0.1);
    return g;
  }

  /* ---------------- AGGIORNAMENTO ---------------- */
  const _f = new V3(), _r = new V3(), _dir = new V3(), _o = new V3();
  P.lookDir = (out) => out.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));

  P.update = function (dt, t) {
    const k = P.keys;
    P.refreshHeld();
    const waterY = G.waterLevelAt ? G.waterLevelAt(P.pos.x, P.pos.z, t) : G.waveHeight(P.pos.x, P.pos.z, t);
    if (P.boat) updateBoatRide(dt, t);
    else {
      const ground = Math.max(G.Dig ? G.Dig.ground(P.pos.x, P.pos.z, P.pos.y) : G.World.groundAt(P.pos.x, P.pos.z), G.Build.groundAt(P.pos.x, P.pos.z, P.pos.y, 0.05));
      const px0 = P.pos.x, pz0 = P.pos.z;
      const depth = waterY - ground;
      P.swim = depth > 1.35 && P.pos.y < waterY - 0.9;
      const inputF = G.clamp((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + P.ax.f, -1, 1), inputR = G.clamp((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + P.ax.r, -1, 1);
      _f.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); _r.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      _dir.set(0, 0, 0).addScaledVector(_f, inputF).addScaledVector(_r, inputR);
      if (_dir.lengthSq() > 0) _dir.normalize();
      const sprint = (k.ShiftLeft || k.ShiftRight) && P.hunger > 5;
      if (P.fly) {
        const sp = sprint || k.ShiftLeft || k.ShiftRight ? 24 : 10;
        const want = new V3(_dir.x * sp, (k.Space ? 1 : 0) * sp * 0.7 - (k.KeyC || k.ControlLeft ? 1 : 0) * sp * 0.7, _dir.z * sp);
        P.vel.lerp(want, Math.min(1, dt * 6));
        P.pos.addScaledVector(P.vel, dt);
        if (P.pos.y < ground) { P.pos.y = ground; P.vel.y = Math.max(0, P.vel.y); }
        P.pos.y = Math.min(P.pos.y, 400); P.onGround = false; P.swim = false;
      } else if (P.swim) {
        const sp = (P.under ? 3.2 : 2.7) * (G.Combat && G.Combat.has('pinne') ? 1.7 : 1);
        const wantV = new V3(_dir.x * sp, 0, _dir.z * sp);
        if (P.under && inputF) wantV.y += Math.sin(P.pitch) * sp * inputF;
        if (k.Space) wantV.y += 2.6;
        if (k.KeyC || k.ControlLeft) wantV.y -= 2.6;
        // galleggiamento verso la superficie se non si scende
        const surf = waterY - EYE + 0.15;
        if (!k.KeyC && !k.ControlLeft && !(P.under && inputF && P.pitch < -0.2)) wantV.y += G.clamp((surf - P.pos.y) * 2.5, -1.5, 1.8);
        P.vel.lerp(wantV, Math.min(1, dt * 3));
        P.pos.addScaledVector(P.vel, dt);
        // la corrente di un gorgo trascina anche chi nuota
        if (G.Climate) { const [cx, cz, ck] = G.Climate.current(P.pos.x, P.pos.z); if (ck > 0.02) { P.pos.x += cx * dt * 0.8; P.pos.z += cz * dt * 0.8; } }
        if (P.pos.y < ground + 0.1) { P.pos.y = ground + 0.1; P.vel.y = Math.max(0, P.vel.y); }
        if (P.pos.y > waterY - EYE + 0.3 && !k.Space) P.pos.y = Math.min(P.pos.y, waterY - EYE + 0.3);
        P.onGround = false;
        if (Math.random() < dt * 2 && P.under) G.FX.bubble(P.pos.x + _f.x * 0.3, P.pos.y + EYE - 0.1, P.pos.z + _f.z * 0.3);
      } else {
        const wading = depth > 0.4;
        const sp = (sprint ? 6.4 : 4.2) * (wading ? 0.6 : 1) * (G.Climate ? G.Climate.speedMul() : 1);
        const acc = P.onGround ? 14 : 3;
        P.vel.x += (_dir.x * sp - P.vel.x) * Math.min(1, dt * acc);
        P.vel.z += (_dir.z * sp - P.vel.z) * Math.min(1, dt * acc);
        // arrampicata: scale a pioli con W, muri con W + Spazio
        const cb = (k.KeyW) && G.Build.climbAt(P.pos, RAD, HEIGHT, _f.x, _f.z);
        P.climbing = !!(cb && (cb.ladder || k.Space));
        if (P.climbing) {
          P.vel.y = cb.ladder ? 2.8 : 2.4; P.vel.x *= 0.3; P.vel.z *= 0.3;
          if (P.pos.y > cb.y1 - 0.6) { P.vel.x += _f.x * 2.5; P.vel.z += _f.z * 2.5; }
          P.fallFrom = P.pos.y;
        } else P.vel.y -= 22 * dt;
        if (k.Space && P.onGround && !P.climbing) { P.vel.y = 7.4; P.onGround = false; }
        P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
        let ceil = G.Build.ceilingAt(P.pos.x, P.pos.z, P.pos.y + HEIGHT, RAD * 0.8);
        if (G.Dig && G.Dig.activeAt(P.pos.x, P.pos.z)) ceil = Math.min(ceil, G.Dig.ceiling(P.pos.x, P.pos.z, P.pos.y + HEIGHT));
        if (P.pos.y + HEIGHT > ceil && P.vel.y > 0) { P.pos.y = ceil - HEIGHT; P.vel.y = 0; }
        const g2 = Math.max(G.Dig ? G.Dig.ground(P.pos.x, P.pos.z, P.pos.y) : G.World.groundAt(P.pos.x, P.pos.z), G.Build.groundAt(P.pos.x, P.pos.z, P.pos.y, 0.05));
        if (P.pos.y <= g2 + 0.001) {
          if (P.vel.y < -16) {
            if (G.Build.inHay(P.pos.x, P.pos.y, P.pos.z)) { if (P.vel.y < -18) { P.stats = P.stats || {}; P.stats.leaps = (P.stats.leaps || 0) + 1; G.UI.toast('Salto della fede!', 'good'); G.FX.burst(P.pos.x, P.pos.y + 0.6, P.pos.z, [0.95, 0.85, 0.5], 24, 3); } }
            else P.hurt((-P.vel.y - 16) * 4, false, 'fall');
          }
          P.pos.y = g2; P.vel.y = Math.max(0, P.vel.y); P.onGround = true;
        } else if (P.pos.y - g2 < 0.25 && P.onGround && P.vel.y <= 0) { P.pos.y = g2; }
        else P.onGround = false;
        if (P.onGround && _dir.lengthSq() > 0) {
          P.bob += dt * (sprint ? 11 : 8);
          if (Math.floor(P.bob / Math.PI) !== Math.floor((P.bob - dt * (sprint ? 11 : 8)) / Math.PI) && G.Audio) G.Audio.step(wading ? 'water' : G.Audio.surface ? G.Audio.surface(P) : 'grass');
        }
        if (wading && _dir.lengthSq() > 0 && Math.random() < dt * 5) G.FX.splash(P.pos.x, waterY, P.pos.z, 2);
      }
      // pareti delle gallerie scavate: si scivola lungo la roccia
      if (G.Dig && !P.fly && G.Dig.activeAt(P.pos.x, P.pos.z) && G.Dig.blocked(P.pos.x, P.pos.y, P.pos.z, HEIGHT)) {
        if (!G.Dig.blocked(P.pos.x, P.pos.y, pz0, HEIGHT)) P.pos.z = pz0;
        else if (!G.Dig.blocked(px0, P.pos.y, P.pos.z, HEIGHT)) P.pos.x = px0;
        else { P.pos.x = px0; P.pos.z = pz0; }
      }
      // collisioni
      G.World.collideCircle(P.pos, RAD);
      G.Build.collide(P.pos, RAD, HEIGHT);
      for (const b of G.Boats.list) if (G.Boats.isComplete(b)) {
        const lx = P.pos.x - b.x, lz = P.pos.z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
        const ax = lx * c - lz * s, az = lx * s + lz * c;
        const deckY = b.y + b.T.deck;
        const inside = Math.abs(ax) < b.T.W / 2 + RAD && Math.abs(az) < b.T.L / 2;
        // atterrare sul ponte (da un molo, da un salto): si è a bordo
        if (inside && Math.abs(ax) < b.T.W / 2 && P.pos.y > deckY - 0.35 && P.pos.y < deckY + 2.5 && P.vel.y <= 0.5 && !P.fly) { P.boardBoat(b, true); return; }
        if (inside && P.pos.y < b.y + 0.5) {
          // arrampicarsi sulla murata: Spazio (o W nuotando) contro lo scafo
          if (k.Space || (P.swim && k.KeyW && P.pos.y > deckY - 2.6)) { P.climbT = (P.climbT || 0) + dt; if (P.climbT > 0.25) { P.climbT = 0; P.boardBoat(b, true); if (G.Audio) G.Audio.step('wood'); return; } }
          const push = (b.T.W / 2 + RAD - Math.abs(ax)) * Math.sign(ax || 1); P.pos.x += push * c; P.pos.z -= push * s;
        }
      }
    }
    P.eye.set(P.pos.x, P.pos.y + (P.boat && P.helm && P.boat.T.sit ? 0.95 : EYE), P.pos.z);
    P.under = P.eye.y < (G.waterLevelAt ? G.waterLevelAt(P.eye.x, P.eye.z, t) : G.waveHeight(P.eye.x, P.eye.z, t)) - 0.05;
    P.inLake = P.under && G.lakeLevelAt && G.lakeLevelAt(P.eye.x, P.eye.z) !== null;
    P.underground = !!(G.Dig && G.Dig.activeAt(P.pos.x, P.pos.z) && G.heightAt(P.pos.x, P.pos.z) - P.eye.y > 1.2);
    // camera
    const cam = P.cam;
    if (P.boat && P.helm && P.cam3) {
      const b = P.boat, d = b.T.cam3;
      const yaw = P.yaw, pit = Math.min(-0.12, P.pitch);
      cam.position.set(b.x + Math.sin(yaw) * Math.cos(pit) * d, b.y + 2.5 - Math.sin(pit) * d, b.z + Math.cos(yaw) * Math.cos(pit) * d);
      cam.position.y = Math.max(cam.position.y, G.waveHeight(cam.position.x, cam.position.z, t) + 0.6);
      cam.lookAt(b.x, b.y + 2, b.z);
      P.vm.visible = false;
    } else {
      const bobY = P.onGround && !(P.boat && P.helm) ? Math.sin(P.bob * 2) * 0.035 : 0;
      cam.position.set(P.eye.x, P.eye.y + bobY, P.eye.z);
      cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
      P.vm.visible = true;
    }
    // viewmodel: oscillazione e colpo
    P.swingT = Math.max(0, P.swingT - dt * 3.2);
    const s = Math.sin(P.swingT * Math.PI);
    P.vmHolder.rotation.set(-s * 1.2, s * 0.3, s * 0.2);
    P.vmHolder.position.set(Math.sin(P.bob) * 0.012, Math.abs(Math.cos(P.bob)) * 0.015 - s * 0.05, -s * 0.12);
    if (P.heldTorch) { P.lookDir(_o); P.torchPos.copy(P.eye).addScaledVector(_o, 0.6).add(new V3(0, -0.15, 0)); if (P._torchSrc === 'l') { P.torchPos.x -= Math.cos(P.yaw) * 0.45; P.torchPos.z += Math.sin(P.yaw) * 0.45; } }
    // scudo: tasto destro tenuto = parata (lo scudo sale davanti)
    const L = P.equip[0];
    P.blocking = !!(L && G.ITEMS[L.id] && G.ITEMS[L.id].shield && P.mouse.r && !G.UI.open && !P.boat);
    const bk = P._blockK = G.lerp(P._blockK || 0, P.blocking ? 1 : 0, Math.min(1, dt * 14));
    P.vmL.position.set(-0.38 + bk * 0.22, -0.38 + bk * 0.12, -0.6 + bk * 0.08);
    P.vmLHolder.rotation.set(Math.sin(P.bob) * 0.02, bk * 0.5, 0);
    P.vmL.visible = P.vm.visible && !!L;
    updateStats(dt);
    updateTarget();
    P.actionCd = Math.max(0, P.actionCd - dt);
    if (P.mouse.l && P.actionCd <= 0 && !G.UI.open) P.primary();
    updateFish(dt, t);
    P.dmgFlash = Math.max(0, P.dmgFlash - dt * 1.5);
  };

  /* ---------------- A BORDO ----------------
     Sul ponte si cammina liberamente (coordinate dello scafo); solo nella
     zona guida si prende il timone (o i remi) con E. */
  const _lv = new V3();
  function updateBoatRide(dt, t) {
    const b = P.boat, T = b.T, k = P.keys;
    // la visuale gira insieme alla barca
    if (P._boatYaw !== undefined) P.yaw += G.angleDiff(P._boatYaw, b.yaw);
    P._boatYaw = b.yaw;
    P.swim = false; P.onGround = true;
    if (P.helm) {
      P.local.set(T.helm[0], T.deck + (T.sit || 0), T.helm[1]); P.lvy = 0;
    } else {
      const inputF = G.clamp((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + P.ax.f, -1, 1), inputR = G.clamp((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + P.ax.r, -1, 1);
      // direzione nel mondo -> direzione nello scafo
      const wx = -Math.sin(P.yaw) * inputF + Math.cos(P.yaw) * inputR, wz = -Math.cos(P.yaw) * inputF - Math.sin(P.yaw) * inputR;
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      let lx = wx * c - wz * s, lz = wx * s + wz * c;
      const l = Math.hypot(lx, lz); if (l > 0) { lx /= l; lz /= l; }
      const sp = (k.ShiftLeft || k.ShiftRight) ? 4.4 : 2.9;
      P.local.x += lx * sp * dt; P.local.z += lz * sp * dt;
      // salto sul ponte
      if (k.Space && P.local.y <= T.deck + 0.001) P.lvy = 5.2;
      P.lvy -= 20 * dt; P.local.y += P.lvy * dt;
      if (P.local.y < T.deck) { P.local.y = T.deck; P.lvy = 0; }
      const side = G.Boats.clampDeck(T, P.local);
      // contro la murata, saltando, si scavalca e si finisce in mare
      if (side && k.Space && Math.sign(lx) === side) { P.jumpOverboard(side); return; }
      if (l > 0 && P.local.y <= T.deck + 0.01) { P.bob += dt * 8; if (Math.floor(P.bob / Math.PI) !== Math.floor((P.bob - dt * 8) / Math.PI) && G.Audio) G.Audio.step('wood'); }
    }
    G.Boats.localToWorld(b, P.local, P.pos);
    P.vel.set(0, 0, 0);
    if (G.Boats.isComplete(b) && T.sail && Math.random() < dt * 0.2 && G.Audio) G.Audio.creak();
  }
  // ricalcola la posizione dopo che la barca si è mossa (nessuno scatto della visuale)
  P.syncBoat = function () { if (P.boat) G.Boats.localToWorld(P.boat, P.local, P.pos); };
  P.inHelmZone = () => !!(P.boat && !P.helm && G.Boats.isComplete(P.boat) && G.Boats.inHelmZone(P.boat, P.local));
  P.takeHelm = function () {
    const b = P.boat;
    if (b.net && performance.now() - b.net.t < 1500) { G.UI.toast('Un altro giocatore sta guidando questa barca', 'warn'); return; }
    P.helm = true; P.cam3 = false; P.endFish(); G.UI.setBoatHud(true);
    G.UI.toast(b.T.oars ? 'Ai remi: A remo sinistro · D remo destro · insieme per andare dritto · S + remi per indietro · E per alzarti'
      : b.tpl === 'zattera' ? 'Al remo: W/S avanti e indietro · A/D per girare · E per lasciare'
      : 'Al timone: W/S vele · A/D timone · V visuale · E per lasciare', 'good');
  };
  P.leaveHelm = function () { P.helm = false; P.cam3 = false; G.UI.setBoatHud(false); P.local.set(P.boat.T.helm[0] + 0.5, P.boat.T.deck, P.boat.T.helm[1] + 0.2); G.Boats.clampDeck(P.boat.T, P.local); };
  P.jumpOverboard = function (side) {
    const b = P.boat; P.boat = null; P.helm = false; P._boatYaw = undefined; G.UI.setBoatHud(false);
    const out = P.local.clone(); out.x += side * 1.1; out.y += 0.4;
    G.Boats.localToWorld(b, out, P.pos);
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    P.vel.set(c * side * 3, 4, -s * side * 3);
  };

  /* ---------------- STATISTICHE ---------------- */
  function updateStats(dt) {
    if (G.creative()) { P.health = P.hunger = P.thirst = P.oxygen = 100; return; }
    const moving = P.vel.lengthSq() > 1;
    const sprint = (P.keys.ShiftLeft || P.keys.ShiftRight) && moving && !P.swim;
    const Cl = G.Climate;
    P.hunger = Math.max(0, P.hunger - dt * 0.085 * (sprint ? 1.7 : P.swim ? 1.35 : 1) * (Cl ? Cl.hungerMul() : 1));
    P.thirst = Math.max(0, P.thirst - dt * 0.12 * (sprint ? 1.6 : 1) * (G.sky.day > 0.5 ? 1.1 : 0.85) * (Cl ? Cl.thirstMul() : 1));
    if (P.under) { P.oxygen = Math.max(0, P.oxygen - dt * 100 / 32 * (G.Combat && G.Combat.has('pinne') ? 0.4 : 1)); if (P.oxygen <= 0) P.hurt(dt * 7, true); }
    else P.oxygen = Math.min(100, P.oxygen + dt * 40);
    if (P.hunger <= 0 || P.thirst <= 0) P.hurt(dt * 0.6, true);
    else if (P.hunger > 50 && P.thirst > 50 && P.health < 100) P.health = Math.min(100, P.health + dt * 0.5);
  }
  P.hurt = function (n, quiet, kind) {
    if (G.creative()) return;
    // parata con lo scudo: assorbe il 75% dei colpi (non le cadute né la fame)
    if (P.blocking && !quiet && kind !== 'fall') { n *= 0.25; if (G.Audio) G.Audio.hit('wood'); G.FX.burst(P.pos.x - Math.sin(P.yaw) * 0.6, P.pos.y + 1.2, P.pos.z - Math.cos(P.yaw) * 0.6, [0.85, 0.75, 0.5], 6, 1.5); if (!P._blockTip) { P._blockTip = 1; G.UI.toast('Parato con lo scudo!', 'good'); } }
    P.health -= n; if (!quiet) P.dmgFlash = 1; else P.dmgFlash = Math.max(P.dmgFlash, 0.25);
    if (P.health <= 0) P.die();
  };
  P.die = function () {
    P.health = 60; P.hunger = Math.max(P.hunger, 50); P.thirst = Math.max(P.thirst, 50); P.oxygen = 100;
    if (P.boat) P.leaveBoat(true);
    const sp = P.spawn || G.findSpawn();
    P.pos.set(sp.x, sp.y + 0.2, sp.z); P.vel.set(0, 0, 0);
    G.UI.toast('Sei svenuto… ti risvegli al punto di rinascita', 'warn');
  };
  P.consume = function (it, fromLeft) {
    const d = G.ITEMS[it.id];
    if (!d.food && !d.water) return false;
    if (P.hunger > 98 && !d.water) { G.UI.toast('Non hai fame'); return true; }
    if (P.thirst > 98 && !d.food) { G.UI.toast('Non hai sete'); return true; }
    P.hunger = Math.min(100, P.hunger + (d.food || 0));
    P.thirst = Math.min(100, P.thirst + (d.water || 0));
    if (it.id.endsWith('_crudo') && Math.random() < 0.3) { P.hurt(4); G.UI.toast('La carne cruda ti fa stare male', 'warn'); }
    if (fromLeft) { it.n--; if (it.n <= 0) P.equip[0] = null; G.UI.refreshHotbar(); } else P.take(it.id, 1);
    if (d.ret) P.give(d.ret, 1, true);
    P.swingT = 0.6;
    if (G.Audio) G.Audio.eat();
    return true;
  };

  /* ---------------- MIRA ---------------- */
  function updateTarget() {
    if (G.UI.open) { P.target = null; return; }
    P.lookDir(_dir);
    const hid = P.held() ? P.held().id : null, max = (G.ITEMS[hid] && G.ITEMS[hid].reach) || 3.6;
    const o = P.cam.position.clone();
    let best = null;
    const r = G.World.raycastResources(o, _dir, max); if (r) best = { kind: 'res', t: r.t, res: r.res };
    const a = G.Entities.raycast(o, _dir, max); if (a && (!best || a.t < best.t)) best = { kind: 'animal', t: a.t, ent: a.ent };
    const b = G.Build.raycast(o, _dir, max); if (b && (!best || b.t < best.t)) best = { kind: 'piece', t: b.t, piece: b.piece };
    const rp = G.Net && G.Net.on ? G.Net.raycast(o, _dir, max) : null; if (rp && (!best || rp.t < best.t)) best = { kind: 'remote', t: rp.t, remote: rp.remote };
    const np = G.Structures ? G.Structures.raycastNPC(o, _dir, 4) : null; if (np && (!best || np.t < best.t)) best = { kind: 'npc', t: np.t, npc: np.npc };
    const bt = G.Boats.raycast(o, _dir, 7); if (bt && bt.boat !== P.boat && (!best || bt.t < best.t + (bt.boat.filled[bt.part] ? 0 : 3))) best = { kind: 'boat', t: bt.t, boat: bt.boat, part: bt.part };
    // non mirare attraverso il terreno
    if (best && best.kind !== 'boat') { const th = G.Build.terrainHit(o, _dir, best.t); if (th >= 0 && th < best.t - 0.2) best = null; }
    P.target = best;
  }

  /* ---------------- AZIONE PRIMARIA (colpire) ---------------- */
  P.primary = function () {
    const it = P.held(), tool = it ? it.id : null;
    if (tool === 'arco') return; // l'arco si tende tenendo premuto (vedi combat.js)
    if (tool === 'pistola' || tool === 'pistola_capitano') { if (!P.boat || !P.helm) G.Combat.fire(P, tool); P.actionCd = 0.3; return; }
    const W = G.ITEMS[tool] || {};
    P.swingT = 1; P.actionCd = W.cd || (tool === 'ascia' || tool === 'piccone' || tool === 'coltello' ? 0.42 : 0.55);
    if (tool === 'pala' && G.Treasure && G.Treasure.dig()) return;
    const tg = P.target;
    // piccone e pala sul terreno (senza bersagli davanti): si scava
    if ((tool === 'piccone' || tool === 'pala') && (!tg || tg.kind === 'piece' && false) && G.Dig) { if (G.Dig.dig(P, tool)) { P.actionCd = tool === 'pala' ? 0.5 : 0.45; return; } }
    if (!tg) return;
    const melee = W.dmg || (tool === 'coltello' ? 2.5 : tool === 'ascia' ? 2 : tool === 'piccone' ? 1.5 : 1);
    if (tg.kind === 'res') hitResource(tg.res, tool);
    else if (tg.kind === 'remote') { G.Net.hit(tg.remote, Math.round(melee * 4)); }
    else if (tg.kind === 'animal') { G.Entities.hit(tg.ent, melee, P); if (G.Audio && W.dmg) G.Audio.hit('soft'); }
    else if (tg.kind === 'npc') { G.UI.toast(`${tg.npc.def.name}: «Ehi! Metti giù quell’arma!»`); }
    else if (tg.kind === 'piece') {
      const p = tg.piece;
      if (p.gen) { G.UI.toast(p.t === 'letto' ? 'Questo letto è della locanda' : 'Non puoi smontarlo'); return; } p.hp = (p.hp === undefined ? 3 : p.hp) - (tool === 'ascia' ? 1.5 : 1);
      G.FX.burst(P.cam.position.x + _dir.x * tg.t, P.cam.position.y + _dir.y * tg.t, P.cam.position.z + _dir.z * tg.t, [0.75, 0.55, 0.3], 6, 2);
      if (G.Audio) G.Audio.hit('wood');
      if (p.hp <= 0) {
        if (p.inv) for (const s of p.inv) if (s) P.give(s.id, s.n, true);
        if (p.cook) { if (p.cook.in) P.give(p.cook.in.id, p.cook.in.n, true); if (p.cook.out) P.give(p.cook.out.id, p.cook.out.n, true); }
        if (p.t === 'muro_porta') { const door = G.Build.pieces.find((d) => d.t === 'porta' && Math.hypot(d.x - p.x, d.z - p.z) < 0.1 && Math.abs(d.y - p.y) < 0.1); if (door) { G.Build.remove(door); P.give('porta', 1, true); } }
        if (G.Net && G.Net.on) G.Net.send({ t: 'bdel', id: p.id });
        G.Build.remove(p); P.give(p.t, 1); G.saveSoon();
      }
    }
  };
  function hitResource(res, tool) {
    const hp = (n) => { res.hp -= G.creative() ? 999 : n; return res.hp <= 0; };
    const hitPos = new V3(res.x, res.y + Math.min(1.2, res.height * 0.5), res.z);
    if (res.type === 'tree') {
      G.FX.burst(hitPos.x, hitPos.y, hitPos.z, [0.6, 0.42, 0.25], 7, 2.2);
      if (G.Audio) G.Audio.hit('wood');
      if (hp(tool === 'ascia' ? 1.8 : 0.5)) fellTree(res);
      else if (tool !== 'ascia' && res.hp < 4 && !res.warned) { res.warned = true; G.UI.toast('Con un’ascia faresti molto prima'); }
    } else if (res.type === 'rock') {
      G.FX.burst(hitPos.x, res.y + res.height * 0.6, hitPos.z, [0.6, 0.58, 0.55], 7, 2.4);
      if (G.Audio) G.Audio.hit('stone');
      if (hp(tool === 'piccone' ? 2 : 0.5)) { G.World.removeResource(res); P.give('pietra', Math.max(2, Math.round(2 + res.size * 2))); if (res.ore && Math.random() < 0.7) P.give(res.ore, 1 + (Math.random() < 0.3 ? 1 : 0)); else if (Math.random() < 0.12) P.give('carbone', 1); G.FX.burst(res.x, res.y + 0.4, res.z, [0.6, 0.58, 0.55], 20, 3); }
    } else if (res.type === 'bush') {
      G.FX.burst(hitPos.x, res.y + 0.6, hitPos.z, [0.3, 0.5, 0.2], 10, 2);
      if (G.Audio) G.Audio.hit('leaf');
      G.World.removeResource(res); P.give('fibra', 2 + ((Math.random() * 2) | 0)); P.give('foglie', 2); P.give('bastone', 1);
      if (res.berry) P.give('bacche', 3 + ((Math.random() * 3) | 0));
    } else if (res.type === 'grass') {
      G.FX.burst(res.x, res.y + 0.3, res.z, [0.4, 0.55, 0.2], 5, 1.5);
      G.World.removeResource(res); if (Math.random() < (tool === 'coltello' ? 1 : 0.7)) P.give('fibra', 1);
    } else if (res.type === 'shell') { G.World.removeResource(res); P.give('conchiglia', 1); }
    else if (res.type === 'wood') {
      // tronchi caduti, ceppi e legni portati dal mare
      G.FX.burst(hitPos.x, res.y + 0.4, hitPos.z, [0.62, 0.5, 0.36], 7, 2);
      if (G.Audio) G.Audio.hit('wood');
      if (res.sub === 'drift') { G.World.removeResource(res); P.give('bastone', 2); if (Math.random() < 0.5) P.give('tronco', 1); }
      else if (hp(tool === 'ascia' ? 1.5 : 0.5)) { G.World.removeResource(res); P.give('tronco', res.sub === 'log' ? 3 : 1); if (res.sub === 'log' && Math.random() < 0.4) P.give('funghi', 1); G.FX.burst(res.x, res.y + 0.4, res.z, [0.62, 0.5, 0.36], 16, 2.5); }
    } else if (res.type === 'plant') {
      G.FX.burst(res.x, res.y + 0.3, res.z, [0.35, 0.5, 0.2], 6, 1.5);
      if (G.Audio) G.Audio.hit('leaf');
      G.World.removeResource(res);
      if (res.sub === 'mush') P.give('funghi', 2 + ((Math.random() * 2) | 0));
      else if (res.sub === 'cactus') { P.give('polpa_cactus', 2); P.give('fibra', 1); if (tool !== 'coltello' && tool !== 'ascia') { P.hurt(3); G.UI.toast('Ahi, le spine! Con il coltello è meglio', 'warn'); } }
      else if (res.sub === 'reed') { P.give('fibra', 2); if (Math.random() < 0.5) P.give('bastone', 1); }
      else { P.give('foglie', 2); P.give('fibra', 1); }
    }
  }
  function fellTree(res) {
    G.World.removeResource(res);
    const info = G.World.treeInfo[res.kind];
    const grp = new THREE.Group();
    if (info.scanMat) { const m1 = new THREE.Mesh(info.trunk, info.scanMat); m1.castShadow = true; grp.add(m1); }
    else {
      const m1 = new THREE.Mesh(info.trunk, info.leafTex === 'frond' ? G.MAT.palmBark : G.MAT.bark), m2 = new THREE.Mesh(info.leaves, G.MAT.leaves[info.leafTex]);
      m1.castShadow = m2.castShadow = true; grp.add(m1, m2);
    }
    const e = res.entry; const s = e.s;
    grp.position.set(res.x, res.y, res.z); grp.scale.setScalar(s);
    const pivot = new THREE.Group(); pivot.position.copy(grp.position); grp.position.set(0, 0, 0); pivot.add(grp); grp.rotation.y = e.ry;
    G.scene.add(pivot);
    const away = Math.atan2(res.x - P.pos.x, res.z - P.pos.z);
    G.anims.push({ t: 0, dur: 2.2, fn(k, done) {
      const a = Math.pow(k, 2.2) * (Math.PI / 2 - 0.08);
      pivot.rotation.set(0, 0, 0); pivot.rotateY(away); pivot.rotateX(a);
      if (done) { G.FX.burst(res.x + Math.sin(away) * res.height * 0.5, res.y + 0.5, res.z + Math.cos(away) * res.height * 0.5, [0.35, 0.5, 0.2], 30, 4); G.scene.remove(pivot); if (G.Audio) G.Audio.thud(); }
    } });
    if (G.Audio) G.Audio.creak();
    const logs = res.sub === 'pine' ? 4 : res.sub === 'palm' ? 3 : 3;
    P.give('tronco', logs + ((Math.random() * 2) | 0));
    P.give('bastone', 1 + ((Math.random() * 2) | 0));
    if (res.sub === 'palm') P.give('cocco', 1 + ((Math.random() * 3) | 0));
    else P.give('foglie', 2 + ((Math.random() * 3) | 0));
  }

  /* ---------------- AZIONE SECONDARIA (usare) ---------------- */
  P.secondary = function () {
    const it = P.held(), id = it ? it.id : null, tg = P.target;
    if (P.placing) { G.UI.placeConfirm(); return; }
    if (tg && tg.kind === 'boat' && !G.Boats.isComplete(tg.boat)) { G.UI.openBoatBuild(tg.boat); return; }
    if (id === 'libro') { G.UI.openBook(); return; }
    if (id === 'mappa_tesoro') { G.Treasure.read(it); return; }
    if (id === 'cannocchiale') return; // si guarda tenendo premuto il tasto destro
    if (it && G.ITEMS[id].cat === 'blueprint') {
      const bt = G.ITEMS[id].boat; P.known = P.known || {};
      if (P.known[bt]) { G.UI.toast('Conosci già questo progetto'); return; }
      P.known[bt] = 1; P.take(id, 1); G.UI.toast(`Hai imparato a costruire: ${G.BOAT_TPL[bt].n}! Lo trovi nel libro (B).`, 'good'); if (G.Audio) G.Audio.craft(); G.saveSoon(); return;
    }
    if (id === 'canna') { P.fishAction(); return; }
    if (id === 'ciotola') { if (aimWater(4.5)) { P.take('ciotola', 1); P.give('ciotola_salata', 1); if (G.Audio) G.Audio.splash(); } else G.UI.toast('Mira il mare vicino a te'); return; }
    if (tg && tg.kind === 'animal' && it && G.Pets && G.BREED[tg.ent.sp] && G.BREED[tg.ent.sp].includes(id) && G.Pets.feed(tg.ent, it)) return;
    if (id && G.Build.isPlaceable(id)) { P.startPlacing(id); return; }
    if (it && P.consume(it)) return;
    // la mano sinistra: cibo, libro, mappe, cannocchiale e scudo (tenuto premuto)
    const L = P.equip[0], lid = L ? L.id : null;
    if (L) {
      if (G.ITEMS[lid].shield || lid === 'cannocchiale') return;
      if (lid === 'libro') { G.UI.openBook(); return; }
      if (lid === 'mappa_tesoro') { G.Treasure.read(L); return; }
      if (P.consume(L, true)) return;
    }
    P.interact();
  };
  function aimWater(max) {
    P.lookDir(_dir); const o = P.cam.position;
    if (P.swim) return true;
    if (_dir.y >= -0.02) return false;
    const t = (G.waveHeight(o.x, o.z, G.time) - o.y) / _dir.y;
    if (t < 0 || t > max) return null;
    const x = o.x + _dir.x * t, z = o.z + _dir.z * t;
    const th = G.Build.terrainHit(o, _dir, t);
    if (th >= 0 && th < t) return null;
    return G.heightAt(x, z) < G.SEA - 0.2 ? { x, z, t } : null;
  }
  P.aimWater = aimWater;

  /* ---------------- E: interagire ---------------- */
  P.interact = function () {
    const tg = P.target;
    if (P.boat) {
      if (P.helm) { P.leaveHelm(); return; }
      if (P.boat.inv && tg && tg.kind === 'boat' && tg.boat === P.boat && P.boat.parts[tg.part].name === 'Stiva') { G.UI.openChest(P.boat.inv, 'Stiva', { boat: P.boat }); return; }
      if (P.inHelmZone()) { P.takeHelm(); return; }
      P.leaveBoat(); return;
    }
    if (tg && tg.kind === 'piece') {
      const p = tg.piece;
      if (p.t === 'porta') { p.open = !p.open; G.Build.refresh(p); if (G.Net && G.Net.on) G.Net.send({ t: 'bupd', id: p.id, open: p.open ? 1 : 0 }); if (G.Audio) G.Audio.door(); return; }
      if (p.t === 'baule' || p.t === 'forziere') {
        if (p.gen && G.Structures) G.Structures.openChest(p);
        else G.UI.openChest(p.inv, 'Baule', { piece: p });
        return;
      }
      if (p.t === 'banco') { G.UI.openInventory(5); return; }
      if (p.t === 'falo') { G.UI.openFire(p); return; }
      if (p.t === 'letto') { P.sleep(p); return; }
    }
    if (tg && tg.kind === 'npc') { G.Quests.talk(tg.npc); return; }
    if (tg && tg.kind === 'animal' && tg.ent.def.shear) { if (G.Entities.shear(tg.ent)) return; }
    if (tg && tg.kind === 'res' && (tg.res.type === 'shell' || tg.res.type === 'grass' || tg.res.type === 'bush' || tg.res.type === 'plant' || (tg.res.type === 'wood' && tg.res.sub === 'drift'))) { hitResource(tg.res, P.held() ? P.held().id : null); return; }
    const b = (tg && tg.kind === 'boat' && tg.boat) || G.Boats.nearest(P.pos, 5);
    if (b) {
      if (!G.Boats.isComplete(b)) { G.UI.openBoatBuild(b); return; }
      if (b.inv && tg && tg.kind === 'boat' && b.parts[tg.part].name === 'Stiva') { G.UI.openChest(b.inv, 'Stiva', { boat: b }); return; }
      P.boardBoat(b); return;
    }
  };
  P.boardBoat = function (b, climbed) {
    // sali nel punto del ponte più vicino a te
    P.boat = b; P.helm = false; P.cam3 = false; P.endFish(); P._boatYaw = b.yaw;
    G.Boats.worldToLocal(b, P.pos, P.local); P.local.y = b.T.deck; P.lvy = 0;
    G.Boats.clampDeck(b.T, P.local);
    if (!P._boardTip || performance.now() - P._boardTip > 60000) { P._boardTip = performance.now(); G.UI.toast(`${climbed ? 'Sei salito a bordo' : 'A bordo'} · il segno dorato indica ${b.T.helmTxt.toLowerCase()}: vai lì e premi E per guidare`, 'good'); }
  };
  P.leaveBoat = function (silent) {
    const b = P.boat; if (!b) return;
    P.boat = null; P.helm = false; P._boatYaw = undefined; G.UI.setBoatHud(false);
    // cerca terra vicino ai fianchi, altrimenti in acqua
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    let best = null;
    for (let d = b.T.W / 2 + 0.8; d < b.T.W / 2 + 7 && !best; d += 0.7) for (const side of [1, -1]) {
      const x = b.x + c * d * side, z = b.z - s * d * side;
      if (G.World.groundAt(x, z) > 0.3) { best = { x, z }; break; }
    }
    if (best) P.pos.set(best.x, G.World.groundAt(best.x, best.z) + 0.1, best.z);
    else { P.pos.set(b.x + c * (b.T.W / 2 + 1), G.SEA - 1.2, b.z - s * (b.T.W / 2 + 1)); }
    P.vel.set(0, 0, 0);
    if (!silent) G.UI.toast(best ? 'Sei sceso a terra' : 'Ti sei tuffato in mare');
  };
  P.sleep = function (bed) {
    P.spawn = { x: bed.x, y: bed.y + 0.6, z: bed.z };
    const h = (G.time * 24) % 24;
    if (h > 19.5 || h < 5) {
      G.UI.fadeSleep(() => { G.time = Math.floor(G.time) + 0.27; G.UI.toast('Buongiorno! Punto di rinascita salvato', 'good'); });
    } else G.UI.toast('Punto di rinascita salvato. Puoi dormire solo di notte.', 'good');
    G.saveSoon();
  };

  /* ---------------- COSTRUZIONE ---------------- */
  P.startPlacing = function (id) { P.placing = id; };

  /* ---------------- PESCA ---------------- */
  P.fishAction = function () {
    if (P.fish) {
      if (P.fish.bite > 0) {
        const r = Math.random();
        if (r < 0.82) P.give('pesce_crudo', 1); else if (r < 0.9) P.give('conchiglia', 1); else P.give('fibra', 1);
        G.FX.splash(P.fish.x, G.SEA, P.fish.z, 12);
        if (G.Audio) G.Audio.splash();
      } else G.UI.toast('Troppo presto: aspetta che il galleggiante affondi');
      P.endFish(); return;
    }
    P.lookDir(_dir);
    const o = P.cam.position;
    let t = -1;
    if (_dir.y < -0.03) t = (G.SEA - o.y) / _dir.y;
    if (t < 0 || t > 16) t = Math.min(10, Math.max(3, (16 * (0.4 + Math.max(0, -_dir.y)))));
    const x = o.x + _dir.x * t, z = o.z + _dir.z * t;
    if (G.heightAt(x, z) > -0.6) { G.UI.toast('Lancia la lenza in acqua più profonda'); return; }
    P.fish = { x, z, wait: 3 + Math.random() * 8, bite: 0, t: 0 };
    P.bobber.visible = true; P.line.visible = true;
    P.swingT = 1;
    G.FX.splash(x, G.SEA, z, 5);
  };
  P.endFish = function () { P.fish = null; if (P.bobber) { P.bobber.visible = false; P.line.visible = false; } };
  function updateFish(dt, t) {
    const f = P.fish; if (!f) return;
    if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) > 22) { P.endFish(); G.UI.toast('La lenza si è spezzata'); return; }
    f.t += dt;
    let dip = 0;
    if (f.bite > 0) { f.bite -= dt; dip = -0.18 + Math.sin(f.t * 30) * 0.04; if (f.bite <= 0) { f.wait = 2 + Math.random() * 6; G.UI.toast('Il pesce è scappato…'); } }
    else { f.wait -= dt; if (f.wait <= 0) { f.bite = 1.4; G.FX.splash(f.x, G.SEA, f.z, 8); G.UI.toast('Abbocca! Tasto destro!', 'good'); if (G.Audio) G.Audio.splash(); } }
    P.bobber.position.set(f.x, G.waveHeight(f.x, f.z, t) + 0.02 + dip, f.z);
    const tip = new V3(0.35, 0.55, -1.4).applyMatrix4(P.cam.matrixWorld);
    const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; const p = tip.clone().lerp(P.bobber.position, k); p.y -= Math.sin(k * Math.PI) * 0.6; pts.push(p); }
    P.line.geometry.setFromPoints(pts);
  }

  P.serialize = () => ({ pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, pitch: P.pitch, health: P.health, hunger: P.hunger, thirst: P.thirst, inv: P.inv, sel: P.sel, spawn: P.spawn,
    quests: P.quests || [], questsDone: P.questsDone || {}, discovered: P.discovered || {}, revealed: P.revealed || {}, explored: [...(P.explored || [])], kills: P.kills || {}, rareFound: P.rareFound || {}, stats: P.stats || {}, known: P.known || {}, equip: P.equip, temp: P.temp });
  P.resetProgress = function () { P.quests = []; P.questsDone = {}; P.discovered = {}; P.revealed = {}; P.explored = new Set(); P.kills = {}; P.rareFound = {}; P.stats = {}; P.known = {}; };
  P.load = function (d) {
    if (!d) return;
    P.pos.set(d.pos[0], d.pos[1], d.pos[2]); P.yaw = d.yaw; P.pitch = d.pitch;
    P.health = d.health; P.hunger = d.hunger; P.thirst = d.thirst; P.inv = d.inv; P.sel = d.sel || 0; P.spawn = d.spawn || null;
    P.quests = d.quests || []; P.questsDone = d.questsDone || {}; P.discovered = d.discovered || {}; P.revealed = d.revealed || {};
    P.explored = new Set(d.explored || []); P.kills = d.kills || {}; P.rareFound = d.rareFound || {}; P.stats = d.stats || {}; P.known = d.known || {};
    P.equip = Array.isArray(d.equip) ? d.equip.slice(0, 4).concat([null, null, null, null]).slice(0, 4) : [null, null, null, null];
    if (typeof d.temp === 'number') P.temp = d.temp;
    P.vmLId = undefined; P.vmId = undefined;
  };
})();
