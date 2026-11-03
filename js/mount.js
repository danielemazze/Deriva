/* =========================================================
   Cavalcature: cavallo, zebra e lama. Con la sella in mano,
   tasto destro sull'animale per montare; Ctrl galoppo (stamina
   del cavallo), Spazio salta, Maiusc per scendere. Quando scendi
   l'animale resta lì ed è tuo; la sella torna nell'inventario.
   ========================================================= */
(function () {
  const MT = (G.Mount = {});
  MT.EQUINES = ['cavallo', 'zebra', 'lama'];
  const NAMES = ['Fulmine', 'Tempesta', 'Brezza', 'Stella', 'Ombra', 'Zefiro', 'Lampo', 'Corallo', 'Sirocco', 'Maestrale', 'Ruggine', 'Nebbia'];
  MT.SPEED = { cavallo: [5.4, 10.8], zebra: [5.2, 10.2], lama: [4.4, 7.6] };
  MT.SEAT = { cavallo: 0.95, zebra: 0.9, lama: 0.78 };
  const isEq = (a) => a && a.kind === 'animal' && MT.EQUINES.includes(a.sp);

  // tasto destro: con la sella in mano su un equino
  MT.trySecondary = function (P) {
    const it = P.held(), tg = P.target;
    if (P.mount) { MT.dismount(P); return true; }
    if (!tg || tg.kind !== 'animal' || !isEq(tg.ent)) return false;
    const a = tg.ent;
    if (!it || it.id !== 'sella') { if (!P._saddleTip) { P._saddleTip = 1; G.UI.toast(`Per cavalcare serve la sella in mano (pelle e corda al banco da lavoro)`); } return false; }
    if (a.st && a.st.age !== undefined && a.st.age < 1) { G.UI.toast('È un puledro: troppo piccolo per essere cavalcato'); return true; }
    if (P.boat) return false;
    MT.mount(P, a);
    return true;
  };
  MT.mount = function (P, a) {
    const sp = a.sp, name = NAMES[(Math.random() * NAMES.length) | 0];
    // l'animale lascia il mondo finché lo cavalchi
    if (a.remote || (G.Net && G.Net.on)) G.Net.send({ t: 'mount', id: a.id });
    else {
      if (G.Pets) { const i = G.Pets.list.indexOf(a.st); if (i >= 0) G.Pets.list.splice(i, 1); }
      (G.state.killed = G.state.killed || new Set()).add(a.id);
    }
    G.Entities.removeAnimal(a);
    P.take('sella', 1);
    P.mount = { sp, name, stam: 100, hdg: a.st ? a.st.yaw : P.yaw + Math.PI, scale: (a.st && a.st.scale) || 1 };
    P.pos.x = a.pos.x; P.pos.z = a.pos.z; P.vel.set(0, 0, 0);
    MT.build(P);
    G.UI.toast(`In sella su ${name}! W avanti · Ctrl galoppo · Spazio salta · Maiusc per scendere`, 'good');
    if (G.Audio) G.Audio.animal(sp, 2, P.pos);
    G.UI.refreshHotbar(); G.saveSoon && G.saveSoon();
  };
  MT.dismount = function (P, quiet) {
    const m = P.mount; if (!m) return;
    const side = P.yaw + Math.PI / 2, x = P.pos.x, z = P.pos.z;
    P.pos.x += Math.sin(side) * 1.3; P.pos.z += Math.cos(side) * 1.3;
    if (G.Net && G.Net.on) G.Net.send({ t: 'dismount', sp: m.sp, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +m.hdg.toFixed(2) });
    else if (G.Pets && G.Pets.addPet) G.Pets.addPet({ sp: m.sp, x, z, yaw: m.hdg, scale: m.scale });
    if (m.rig) G.scene.remove(m.rig.root);
    P.mount = null;
    P.give('sella', 1, true);
    if (!quiet) G.UI.toast(`Sei sceso. ${m.name} resta qui ed è tuo`);
    G.saveSoon && G.saveSoon();
  };
  MT.build = function (P) {
    const m = P.mount; if (!m || m.rig || !G.AnimLib || !G.AnimLib.has(m.sp)) return;
    m.rig = G.AnimLib.make(m.sp); m.rig.root.scale.setScalar(m.scale || 1);
    // sella e briglie
    const leather = new THREE.MeshStandardMaterial(G.ACG && G.ACG.on && G.ACG.tex.leather ? G.ACG.mat('leather', { color: 0x6a4a34, roughness: 1 }, [2, 2]) : { color: 0x1e0f06, roughness: 0.7 }), brass = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.6, roughness: 0.4 });
    const sad = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.62, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.35, 1), leather);
    const pom = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), leather); pom.position.set(0, 0.1, 0.28);
    const st1 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10), brass); st1.position.set(0.36, -0.45, 0); st1.rotation.y = Math.PI / 2; const st2 = st1.clone(); st2.position.x = -0.36;
    const g = new THREE.Group(); g.add(sad, pom, st1, st2); m.saddle = g; m.rig.root.add(g);
    G.scene.add(m.rig.root);
  };
  MT.seat = (P) => (P.mount ? (MT.SEAT[P.mount.sp] || 0.9) * (P.mount.scale || 1) : 0);
  MT.speed = (P, gallop) => { const s = MT.SPEED[P.mount.sp] || [5, 9]; return gallop ? s[1] : s[0]; };
  MT.canGallop = (P) => !!(P.mount && P.mount.stam > 2 && P.mount.ok !== false);

  // ogni frame: stamina del cavallo, modello sotto il giocatore, animazione
  MT.update = function (dt, P) {
    const m = P.mount; if (!m) { if (MT.hud) MT.hud.hidden = true; return; }
    if (!m.rig) MT.build(P);
    const k = P.keys, sp = Math.hypot(P.vel.x, P.vel.z), gallop = sp > MT.SPEED[m.sp][0] + 0.6;
    if (gallop) m.stam = Math.max(0, m.stam - dt * 9); else m.stam = Math.min(100, m.stam + dt * (sp < 0.5 ? 16 : 9));
    if (m.stam <= 0) m.ok = false; else if (m.stam > 25) m.ok = true;
    if (sp > 0.4) m.hdg += G.angleDiff(m.hdg, Math.atan2(P.vel.x, P.vel.z)) * Math.min(1, dt * 6);
    if (m.rig) {
      const r = m.rig, y = P.pos.y;
      r.root.position.set(P.pos.x + Math.sin(m.hdg) * 0.3, y, P.pos.z + Math.cos(m.hdg) * 0.3); r.root.rotation.y = m.hdg;
      r.act(sp < 0.3 ? 'Idle' : gallop && r.acts.Run ? 'Run' : 'Walk');
      r.mixer.timeScale = G.clamp(sp < 0.3 ? 1 : gallop ? sp / 8.5 : sp / 3.2, 0.5, 2);
      r.mixer.update(dt);
      if (m.saddle) { const s = (MT.SEAT[m.sp] || 0.9) * 1.46 / (m.scale || 1); m.saddle.position.set(0, s, -0.3 / (m.scale || 1)); }
    }
    // l'acqua alta: il cavallo non nuota
    if (P.swim) { MT.dismount(P, true); G.UI.toast('Il cavallo non nuota: sei sceso in acqua', 'warn'); }
    // barra della stamina del cavallo
    if (!MT.hud) { MT.hud = document.createElement('div'); MT.hud.className = 'mounthud'; MT.hud.innerHTML = '<small>CAVALCATURA</small><b></b><i><u></u></i>'; const h = document.getElementById('hud'); if (h) h.appendChild(MT.hud); }
    MT.hud.hidden = false;
    MT.hud.querySelector('b').textContent = `${m.name} · ${sp < 0.3 ? 'fermo' : gallop ? 'al galoppo' : 'al passo'}`;
    MT.hud.querySelector('u').style.width = Math.round(m.stam) + '%';
  };
  MT.serialize = (P) => (P.mount ? { sp: P.mount.sp, name: P.mount.name, stam: Math.round(P.mount.stam), hdg: +P.mount.hdg.toFixed(2), scale: P.mount.scale } : null);
  MT.load = function (P, d) {
    if (P.mount && P.mount.rig) G.scene.remove(P.mount.rig.root);
    P.mount = d && MT.EQUINES.includes(d.sp) ? { sp: d.sp, name: d.name || 'Fulmine', stam: d.stam || 100, hdg: d.hdg || 0, scale: d.scale || 1 } : null;
  };

  /* cavalli degli altri giocatori (nel loro stato "mt") */
  MT.remote = function (r, dt) {
    if (r.mt && (!r.horse || r.horse.sp !== r.mt)) { if (r.horse) G.scene.remove(r.horse.rig.root); r.horse = G.AnimLib && G.AnimLib.has(r.mt) ? { sp: r.mt, rig: G.AnimLib.make(r.mt), hdg: r.yaw + Math.PI } : null; if (r.horse) G.scene.add(r.horse.rig.root); }
    if (!r.mt && r.horse) { G.scene.remove(r.horse.rig.root); r.horse = null; }
    if (!r.horse) return 0;
    const h = r.horse, rg = h.rig, sp = r.speed || 0;
    h.hdg += G.angleDiff(h.hdg, r.yaw + Math.PI) * Math.min(1, dt * 5);
    rg.root.position.set(r.pos.x + Math.sin(h.hdg) * 0.3, r.pos.y, r.pos.z + Math.cos(h.hdg) * 0.3); rg.root.rotation.y = h.hdg;
    rg.act(sp < 0.3 ? 'Idle' : sp > 6.5 && rg.acts.Run ? 'Run' : 'Walk'); rg.mixer.update(dt);
    return MT.SEAT[h.sp] || 0.9;
  };
})();
