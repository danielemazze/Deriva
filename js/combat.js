'use strict';
/* ==========================================================
   Armi a distanza (arco e frecce, pistole), cannocchiale ed
   effetti degli oggetti rari.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const C = (G.Combat = { arrows: [], charge: 0, reload: 0, zoom: 0 });
  const V3 = THREE.Vector3;
  const _d = new V3(), _o = new V3(), _seg = new V3();
  let arrowGeo = null;
  function arrowMesh() {
    if (!arrowGeo) {
      const M = G.MODELS;
      const sh = new THREE.CylinderGeometry(0.008, 0.008, 0.7, 5); sh.rotateX(Math.PI / 2); M.colorize(sh, 0.75, 0.6, 0.4);
      const tip = new THREE.ConeGeometry(0.018, 0.06, 4); tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.38); M.colorize(tip, 0.55, 0.55, 0.52);
      const f1 = new THREE.PlaneGeometry(0.06, 0.12); f1.rotateX(Math.PI / 2); f1.rotateZ(Math.PI / 2); f1.translate(0, 0, -0.3); M.colorize(f1, 0.95, 0.92, 0.85);
      const f2 = f1.clone(); f2.rotateZ(Math.PI / 2);
      arrowGeo = M.merge([sh, tip, f1, f2]);
    }
    const m = new THREE.Mesh(arrowGeo, G.MAT.solid); m.castShadow = true;
    return m;
  }
  C.shootArrow = function (o, v, dmg, remote) {
    const m = arrowMesh(); m.position.copy(o); G.scene.add(m);
    C.arrows.push({ m, pos: o.clone(), vel: v.clone(), dmg, remote, life: 0, stuck: false, wet: 0 });
  };
  function hitTest(a, from, to) {
    const P = G.Player;
    _seg.subVectors(to, from); const len = _seg.length(); if (len < 1e-5) return null; _d.copy(_seg).divideScalar(len);
    let best = null, bt = len;
    const an = G.Entities.raycast(from, _d, len, 0.22); if (an && an.t < bt) { bt = an.t; best = { kind: 'animal', ent: an.ent }; }
    if (G.Net && G.Net.on) { const rp = G.Net.raycast(from, _d, len); if (rp && rp.t < bt) { bt = rp.t; best = { kind: 'remote', r: rp.remote }; } }
    if (G.Sea && G.Sea.enc.length) { const sh = G.Sea.raycast(from, _d, len); if (sh && sh.t < bt) { bt = sh.t; best = { kind: 'sea', enc: sh.enc }; } }
    for (const b of G.Build.boxes) { if (b.soft || b.roof || b.slope) continue; const t = G.Build.rayBox(from, _d, b); if (t >= 0 && t < bt) { bt = t; best = { kind: 'solid' }; } }
    const gy = G.World.groundAt(to.x, to.z);
    if (to.y < gy && (!best || best.kind === 'solid')) best = best || { kind: 'ground' };
    if (best) best.t = bt;
    return best;
  }
  C.update = function (dt, P) {
    const held = P.held(), id = held ? held.id : null;
    C.reload = Math.max(0, C.reload - dt);
    // arco: tieni premuto per tendere, rilascia per scoccare
    if (id === 'arco' && !G.UI.open && !(P.boat && P.helm)) {
      if (P.mouse.l) { if (C.charge === 0 && G.Audio) G.Audio.draw(); C.charge = Math.min(1.5, C.charge + dt); }
      else if (C.charge > 0) {
        const k = Math.min(1, C.charge / 1.5); C.charge = 0;
        if (k > 0.12) {
          if (P.count('freccia') <= 0) G.UI.toast('Non hai frecce (bastone + pietra + piume)', 'warn');
          else {
            P.take('freccia', 1);
            P.lookDir(_d);
            _o.copy(P.cam.position).addScaledVector(_d, 0.5); _o.y -= 0.05;
            // più è tesa, più la freccia va veloce (gittata) e fa male: danno 4–36
            const v = _d.clone().multiplyScalar(12 + 46 * k);
            C.shootArrow(_o, v, 1 + 8 * Math.pow(k, 1.5), false);
            if (G.Net && G.Net.on) G.Net.send({ t: 'fx', k: 'arrow', o: [+_o.x.toFixed(2), +_o.y.toFixed(2), +_o.z.toFixed(2)], v: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] });
            if (G.Audio) G.Audio.bow();
          }
        }
      }
      // corda e freccia nel modello in mano
      const vm = P.vmCache && P.vmCache.arco;
      if (vm && vm.userData.line) {
        const pull = Math.min(1, C.charge / 1.5) * 0.32;
        const pos = vm.userData.line.geometry.attributes.position; pos.setXYZ(1, 0, 0, 0.07 + pull); pos.needsUpdate = true;
        vm.userData.arrow.visible = C.charge > 0 && P.count('freccia') > 0; vm.userData.arrow.position.z = 0.07 + pull - 0.32;
      }
    } else C.charge = 0;
    { const cr = document.getElementById('cross'); if (cr) { const ch = id === 'arco' && C.charge > 0; if (ch !== C._chOn) { C._chOn = ch; cr.classList.toggle('charge', ch); } if (ch) cr.style.setProperty('--ch', (Math.min(1, C.charge / 1.5) * 360).toFixed(0) + 'deg'); } }
    // cannocchiale: tieni premuto il tasto destro
    const lid = P.equip && P.equip[0] ? P.equip[0].id : null;
    C.hasSpy = id === 'cannocchiale' || (lid === 'cannocchiale' && !(id && G.Build.isPlaceable(id)));
    if (!C.hasSpy) C.touchSpy = false;
    const zoomOn = C.hasSpy && (P.mouse.r || C.touchSpy) && !G.UI.open && !G.UI.menu;
    C.zoom += ((zoomOn ? 1 : 0) - C.zoom) * Math.min(1, dt * 8);
    // ingrandimento da ×2 a ×8 (rotella del mouse, o il pulsante Zoom sul telefono)
    const mag = 1 + C.zoom * (C.mag - 1);
    const fov = 2 * Math.atan(Math.tan(G.settings.fov * Math.PI / 360) / mag) * 180 / Math.PI;
    if (Math.abs(P.cam.fov - fov) > 0.02) { P.cam.fov = fov; P.cam.updateProjectionMatrix(); }
    const on = C.zoom > 0.6;
    if (on !== C._spyOn) { C._spyOn = on; document.body.classList.toggle('spyglass', on); }
    if (on) {
      C._spyT -= dt;
      if (C._spyT <= 0) { C._spyT = 0.15; spyRead(P); }
    }
    // frecce in volo
    for (let i = C.arrows.length - 1; i >= 0; i--) {
      const a = C.arrows[i];
      a.life += dt;
      if (a.stuck) { if (a.life > 25) { G.scene.remove(a.m); C.arrows.splice(i, 1); } continue; }
      const from = a.pos.clone();
      const wy = G.waveHeight(a.pos.x, a.pos.z, G.clock);
      if (a.pos.y < wy) { a.vel.multiplyScalar(Math.pow(0.08, dt)); a.wet += dt; }
      a.vel.y -= 9.8 * dt * (a.wet ? 0.3 : 1);
      a.pos.addScaledVector(a.vel, dt);
      const h = a.remote ? null : hitTest(a, from, a.pos);
      if (a.remote) { const gy = G.World.groundAt(a.pos.x, a.pos.z); if (a.pos.y < gy) { a.pos.y = gy + 0.05; a.stuck = true; a.life = 0; } }
      if (h) {
        if (h.kind === 'animal') { G.Entities.hit(h.ent, a.dmg, P); G.scene.remove(a.m); C.arrows.splice(i, 1); continue; }
        if (h.kind === 'remote') { G.Net.hit(h.r, Math.round(a.dmg * 4)); G.scene.remove(a.m); C.arrows.splice(i, 1); continue; }
        if (h.kind === 'sea') { G.Sea.hitEnc(h.enc, a.dmg * 4, a.pos); G.scene.remove(a.m); C.arrows.splice(i, 1); continue; }
        a.pos.copy(from).addScaledVector(_d.subVectors(a.pos, from).normalize(), Math.max(0, h.t - 0.2));
        a.stuck = true; a.life = 0;
        if (G.Audio) G.Audio.hit('wood');
      }
      a.m.position.copy(a.pos);
      if (!a.stuck) a.m.lookAt(_o.copy(a.pos).add(a.vel));
      if (a.life > 12) { G.scene.remove(a.m); C.arrows.splice(i, 1); }
    }
  };
  // cannocchiale: ingrandimento, mirino e distanza stimata dal punto guardato
  C.mag = 6; C._spyT = 0; C._spyOn = false; C.touchSpy = false; C.hasSpy = false;
  C.MAGS = [2, 4, 6, 8];
  C.spyZoom = function (dir) {
    const i = C.MAGS.indexOf(C.mag);
    C.mag = dir === 0 ? C.MAGS[(i + 1) % C.MAGS.length] : C.MAGS[Math.max(0, Math.min(C.MAGS.length - 1, i + (dir > 0 ? 1 : -1)))];
    if (G.Audio) G.Audio.click();
    spyRead(G.Player);
  };
  function spyEl() {
    let el = document.getElementById('spyx');
    if (!el) {
      el = document.createElement('div'); el.id = 'spyx';
      el.innerHTML = '<i class="h"></i><i class="v"></i><span class="d" id="spyd"></span><span class="z" id="spyz"></span>';
      document.getElementById('game').appendChild(el);
    }
    return el;
  }
  const _sd = new THREE.Vector3();
  function spyRead(P) {
    spyEl();
    P.cam.getWorldDirection(_sd);
    const o = P.cam.position;
    // passi crescenti lungo lo sguardo fino a terra o al mare
    let t = 0.5, hit = -1;
    for (let i = 0; i < 260 && t < 2400; i++) {
      const x = o.x + _sd.x * t, y = o.y + _sd.y * t, z = o.z + _sd.z * t;
      const g = Math.max(G.heightAt(x, z), G.SEA);
      if (y <= g) { hit = t; break; }
      t += Math.max(0.5, t * 0.03);
    }
    const d = document.getElementById('spyd'), zz = document.getElementById('spyz');
    d.textContent = hit < 0 ? '—' : hit < 100 ? '≈ ' + Math.round(hit) + ' m' : hit < 1000 ? '≈ ' + Math.round(hit / 10) * 10 + ' m' : '≈ ' + (hit / 1000).toFixed(1) + ' km';
    zz.textContent = '×' + C.mag + (G.isTouch ? '' : ' · rotella');
  }

  // pistole: un colpo istantaneo, poi ricarica
  C.fire = function (P, id) {
    if (C.reload > 0) return;
    if (P.count('munizioni') <= 0) { G.UI.toast('Servono munizioni (dai mercanti o nei forzieri)', 'warn'); C.reload = 0.5; return; }
    P.take('munizioni', 1);
    const cap = id === 'pistola_capitano';
    C.reload = cap ? 1.3 : 2.2;
    P.swingT = 0.35;
    P.lookDir(_d);
    const o = P.cam.position.clone();
    let best = null, bt = 80;
    const an = G.Entities.raycast(o, _d, bt, 0.08); if (an) { bt = an.t; best = { kind: 'animal', ent: an.ent }; }
    if (G.Net && G.Net.on) { const rp = G.Net.raycast(o, _d, bt); if (rp && rp.t < bt) { bt = rp.t; best = { kind: 'remote', r: rp.remote }; } }
    if (G.Sea && G.Sea.enc.length) { const sh = G.Sea.raycast(o, _d, bt); if (sh && sh.t < bt) { bt = sh.t; best = { kind: 'sea', enc: sh.enc }; } }
    for (const b of G.Build.boxes) { if (b.soft || b.roof || b.slope) continue; const t = G.Build.rayBox(o, _d, b); if (t >= 0 && t < bt) { bt = t; best = null; } }
    const th = G.Build.terrainHit(o, _d, bt); if (th >= 0 && th < bt) { bt = th; best = null; }
    const dmg = cap ? 14 : 10;
    if (best && best.kind === 'animal') G.Entities.hit(best.ent, dmg, P);
    else if (best && best.kind === 'remote') G.Net.hit(best.r, dmg * 4);
    else if (best && best.kind === 'sea') G.Sea.hitEnc(best.enc, dmg * 4, o.clone().addScaledVector(_d, bt));
    const hp = o.clone().addScaledVector(_d, bt);
    G.FX.burst(hp.x, hp.y, hp.z, [0.7, 0.65, 0.6], 8, 2);
    const mz = o.clone().addScaledVector(_d, 0.8);
    G.FX.burst(mz.x, mz.y - 0.1, mz.z, [0.85, 0.85, 0.85], 10, 1.2);
    C.flash = 0.06;
    if (G.Audio) G.Audio.gun();
    if (G.Net && G.Net.on) G.Net.send({ t: 'fx', k: 'gun', o: [+mz.x.toFixed(1), +mz.y.toFixed(1), +mz.z.toFixed(1)] });
  };
  C.netFx = function (m) {
    if (m.k === 'arrow') C.shootArrow(new V3(...m.o), new V3(...m.v), 0, true);
    else if (m.k === 'love') { const a = G.Entities.byId.get(m.id); if (a) G.FX.burst(a.pos.x, a.pos.y + 1, a.pos.z, [1, 0.4, 0.6], 14, 1.4); }
    else if (m.k === 'gun') { G.FX.burst(m.o[0], m.o[1], m.o[2], [0.85, 0.85, 0.85], 10, 1.2); if (G.Audio) G.Audio.gun(); }
  };
  C.clear = function () { for (const a of C.arrows) G.scene.remove(a.m); C.arrows = []; };

  /* ---------------- oggetti rari ---------------- */
  C.has = (id) => G.Player.count && (G.Player.inv.some((s) => s && s.id === id) || (G.Player.equip || []).some((s) => s && s.id === id));
  // la bussola d'oro indica il luogo inesplorato più vicino (direzione in radianti, o null)
  C.goldenTarget = function () {
    if (!C.has('bussola_oro')) return null;
    const P = G.Player, disc = P.discovered || {};
    if (!C._gt || performance.now() - C._gtT > 2000) {
      C._gtT = performance.now();
      let best = null, bd = 1e9;
      for (const p of G.POI.near(P.pos.x, P.pos.z, 1800)) { if (disc[p.id]) continue; const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = p; } }
      C._gt = best;
    }
    return C._gt;
  };
  // registra gli oggetti rari trovati (collezione del diario)
  C.noteRares = function () {
    const P = G.Player; P.rareFound = P.rareFound || {};
    for (const id of G.RARE) if (!P.rareFound[id] && C.has(id)) { P.rareFound[id] = Date.now(); G.UI.toast(`Oggetto raro trovato: ${G.ITEMS[id].n}! (${Object.keys(P.rareFound).length}/${G.RARE.length})`, 'good'); if (G.Audio) G.Audio.bell(); }
  };
})();
