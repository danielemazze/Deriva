/* =========================================================
   Furtività: accovacciato (Maiusc) un occhio ti dice se qualcuno
   ti vede. Nascosto puoi rubare dai banchi dei mercanti e dalle
   tasche degli abitanti; se ti vedono, il villaggio ti attacca.
   ========================================================= */
(function () {
  const ST = (G.Stealth = { seen: false, watchers: [], stock: {} });
  const V3 = THREE.Vector3, _o = new V3(), _d = new V3(), _f = new V3();
  let el = null, tCheck = 0, sneakXP = 0;

  // un abitante ti vede? (cono di vista, distanza, buio, muri in mezzo)
  function sees(n, P, crouch) {
    if (!n.p.root.visible || n.angry > 0) return n.angry > 0;
    const dx = P.pos.x - n.x, dz = P.pos.z - n.z, dist = Math.hypot(dx, dz);
    let D = (crouch ? 9 : 22) * G.Skills.less('furto', 0.012, 0.4);
    if (G.sky && G.sky.night > 0.5) D *= P.heldTorch ? 1.2 : 0.55;
    const near = crouch ? 1.4 : 3;
    if (dist > D && dist > near) return false;
    const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw), dot = (fx * dx + fz * dz) / (dist || 1);
    if (dist > near && dot < 0.42) return false; // fuori dal cono (~65°)
    // muri e terreno in mezzo
    _o.set(n.x, n.y + 1.55, n.z); _d.set(P.eye.x - _o.x, P.eye.y - _o.y, P.eye.z - _o.z); const len = _d.length(); _d.divideScalar(len || 1);
    const th = G.Build.terrainHit ? G.Build.terrainHit(_o, _d, len) : -1; if (th >= 0 && th < len - 0.3) return false;
    for (const b of G.Build.boxes) { if (b.soft || b.walk) continue; if (Math.abs(b.x0 - _o.x) > 40 && Math.abs(b.x1 - _o.x) > 40) continue; const t = G.Build.rayBox(_o, _d, b); if (t >= 0 && t < len - 0.3) return false; }
    return true;
  }

  // cosa puoi rubare davanti a te
  ST.target = function (P) {
    if (!P.crouch || G.creative() || P.boat) return null;
    const tg = P.target;
    if (tg && tg.kind === 'npc' && tg.npc.def.role !== 'capo') {
      const n = tg.npc, dx = P.pos.x - n.x, dz = P.pos.z - n.z, d = Math.hypot(dx, dz);
      const behind = (Math.sin(n.yaw) * dx + Math.cos(n.yaw) * dz) / (d || 1) < 0.3;
      if (d < 2.6) return { kind: 'pocket', npc: n, behind, name: 'Tasche di ' + n.def.name };
    }
    if (tg && tg.kind !== 'npc' && tg.t !== undefined && tg.t < 2.2) return null;
    P.lookDir(_f); let best = null, bd = 3;
    for (const [id, s] of G.Structures.stalls) {
      const dx = s.x - P.pos.x, dz = s.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > 3.2 || Math.abs(s.y + 1 - P.eye.y) > 2) continue;
      if ((dx * _f.x + dz * _f.z) / (d || 1) < 0.75) continue;
      if (d < bd) { bd = d; best = { kind: 'stall', id, s, name: 'Banco del mercante' }; }
    }
    return best;
  };
  const STALL = ['mela', 'mela', 'arancia', 'arancia', 'bacche', 'cocco'];
  ST.steal = function (P) {
    const t = ST.target(P); if (!t) return false;
    const caught = ST.seen || (t.kind === 'pocket' && !t.behind);
    const lvl = G.Skills.lv('furto');
    let msg;
    if (t.kind === 'stall') {
      const left = ST.stock[t.id] === undefined ? 4 : ST.stock[t.id];
      if (left <= 0) { G.UI.toast('Sul banco non è rimasto niente'); return true; }
      ST.stock[t.id] = left - 1;
      const it = STALL[(Math.random() * STALL.length) | 0], n = 1 + (Math.random() < lvl * 0.02 ? 1 : 0);
      P.give(it, n); msg = `Hai rubato: ${G.ITEMS[it].n}${n > 1 ? ' ×' + n : ''}`;
    } else {
      const n = t.npc; if ((n.robbedT || 0) > performance.now()) { G.UI.toast('Le tasche sono vuote'); return true; }
      n.robbedT = performance.now() + 240000;
      const c = 1 + ((Math.random() * (3 + lvl * 0.25)) | 0);
      P.give('doblone', c); msg = `Hai rubato ${c} dobloni`;
    }
    if (G.Audio && G.Audio.pickup) G.Audio.pickup();
    if (caught) {
      ST.alarm(P, t.kind === 'pocket' ? t.npc : null);
      G.UI.toast(msg + ' · ti hanno visto!', 'warn');
      G.Skills.add('furto', 1);
    } else { G.UI.toast(msg, 'good'); G.Skills.add('furto', t.kind === 'pocket' ? 10 : 7); }
    G.UI.refreshHotbar(); if (G.saveSoon) G.saveSoon();
    return true;
  };
  // al ladro! gli abitanti vicini ti attaccano
  ST.alarm = function (P, who) {
    let k = 0;
    for (const n of G.Structures.npcs) {
      if (Math.hypot(n.x - P.pos.x, n.z - P.pos.z) > 30 && n !== who) continue;
      if (!n.angry) n.home0 = [n.x, n.z];
      n.angry = 60; n.way0 = n.way0 || n.way; k++;
    }
    if (k) setTimeout(() => G.UI.toast('«Al ladro!» Gli abitanti ti inseguono: allontanati', 'warn'), 400);
  };
  ST.angryNear = (P) => G.Structures.npcs.some((n) => n.angry > 0 && Math.hypot(n.x - P.pos.x, n.z - P.pos.z) < 60);

  ST.update = function (dt, P) {
    if (!el) {
      el = document.createElement('div'); el.className = 'sneak'; el.hidden = true;
      el.innerHTML = '<div class="sneye"><span></span><svg viewBox="0 0 64 34" width="84" height="45" fill="none" stroke-width="2.4" stroke-linecap="round"><path class="lid" d=""/><circle class="pupil" cx="32" cy="17" r="7"/><path class="shut" d="M10 17 L54 17"/></svg><span></span></div><div class="snl"></div>';
      const h = document.getElementById('hud'); if (h) h.appendChild(el); else return;
    }
    const on = !!P.crouch && !G.creative() && !(G.UI && G.UI.open);
    if (el.hidden === on) el.hidden = !on;
    if ((tCheck -= dt) <= 0) {
      tCheck = 0.2;
      let s = false;
      if (P.crouch || ST.seen) for (const n of G.Structures.npcs) { if (Math.abs(n.x - P.pos.x) > 30 || Math.abs(n.z - P.pos.z) > 30) continue; if (sees(n, P, !!P.crouch)) { s = true; break; } }
      ST.seen = s;
      // muoversi accovacciati vicino a qualcuno senza farsi vedere allena la furtività
      if (P.crouch && !s && P.vel.lengthSq() > 0.3 && G.Structures.npcs.some((n) => n.p.root.visible && Math.hypot(n.x - P.pos.x, n.z - P.pos.z) < 12)) { sneakXP += 0.2 * 0.5; if (sneakXP >= 1) { G.Skills.add('furto', 1); sneakXP = 0; } }
    }
    if (on) {
      const seen = ST.seen;
      if (el._s !== seen) {
        el._s = seen; el.classList.toggle('seen', seen);
        el.querySelector('.lid').setAttribute('d', seen ? 'M4 17 C 16 2, 48 2, 60 17 C 48 32, 16 32, 4 17 Z' : 'M4 17 C 16 12, 48 12, 60 17 C 48 22, 16 22, 4 17 Z');
        el.querySelector('.snl').textContent = seen ? 'Ti stanno guardando' : 'Nascosto';
      }
    }
  };
  ST.reset = function () { ST.stock = {}; ST.seen = false; };
})();
