/* =========================================================
   Lucchetti e scasso: i bauli dei villaggi abitati sono chiusi.
   Accovacciato e senza farti vedere, E per scassinarli: il mouse
   muove il grimaldello, D (o il tasto destro) gira la serratura.
   Nel punto giusto si apre; se forzi altrove il grimaldello si
   spezza. La Furtività allarga il punto giusto.
   ========================================================= */
(function () {
  const LP = (G.Lockpick = {});
  LP.locked = (p) => !!(p && p.gen && p.t === 'baule' && /^c:v/.test(p.id) && !(G.Player.picked && G.Player.picked[p.id]) && !G.creative());
  const tierN = (p) => ((p.tier || 1) >= 2 ? 'difficile' : 'media');
  LP.info = (p) => `serratura ${tierN(p)} · ${G.Player.count('grimaldello')} grimaldelli`;

  // lucchetti visibili sui bauli chiusi vicini
  let lockGeo = null, lockMat = null, tScan = 0;
  function padlock() {
    if (!lockGeo) {
      const M = G.MODELS;
      lockGeo = M.merge([new THREE.BoxGeometry(0.12, 0.1, 0.04).translate(0, -0.02, 0), new THREE.TorusGeometry(0.038, 0.011, 6, 12, Math.PI).translate(0, 0.03, 0)]);
      lockMat = new THREE.MeshStandardMaterial({ color: 0x5a4518, metalness: 0.7, roughness: 0.35 });
    }
    const m = new THREE.Mesh(lockGeo, lockMat); m.position.set(0, 0.37, 0.31); m.name = 'padlock'; return m;
  }
  LP.update = function (dt, P) {
    if ((tScan -= dt) > 0) return; tScan = 0.5;
    for (const p of G.Build.pieces) {
      if (!p.gen || p.t !== 'baule' || !p.mesh || Math.abs(p.x - P.pos.x) > 60 || Math.abs(p.z - P.pos.z) > 60) continue;
      const want = LP.locked(p), has = p.mesh.getObjectByName('padlock');
      if (want && !has) p.mesh.add(padlock()); else if (!want && has) p.mesh.remove(has);
    }
  };

  let st = null;
  LP.start = function (p) {
    const P = G.Player;
    if (P.count('grimaldello') <= 0 && !G.creative()) { G.UI.toast('Serve un grimaldello (lingotto di ferro e bastone, o dai mercanti)', 'warn'); return true; }
    if (G.Stealth && G.Stealth.seen) { G.UI.toast('Ti stanno guardando: aspetta che si girino', 'warn'); return true; }
    const lv = G.Skills.lv('furto'), base = (p.tier || 1) >= 2 ? 11 : 18;
    st = { p, sweet: 10 + Math.random() * 160, half: Math.min(40, base * (1 + (lv - 1) * 0.025)), pick: 90, rot: 0, stress: 0, turning: false, t: 0 };
    G.UI.openCustom('lockpick');
    return true;
  };
  LP.state = () => st;
  const W = 560, H = 420, CX = 280, CY = 200;
  LP.render = function () {
    return `<div class="lpk"><canvas id="lpc" width="${W}" height="${H}"></canvas><div class="lpinfo"><div><b>Serratura ${tierN(st.p)}</b><small>Furtività ${G.Skills.lv('furto')} · più è alta, più largo è il punto giusto</small></div>
      <div class="lpkeys"><b>Mouse</b> muovi il grimaldello · <b>D</b> o <b>tasto destro</b> (tieni) gira la serratura<br><b>Esc</b> lascia stare · grimaldelli: <b id="lpn">${G.creative() ? '∞' : G.Player.count('grimaldello')}</b></div></div></div>`;
  };
  let raf = 0, last = 0, keyD = false, mouseR = false;
  const onKey = (e) => { if (e.code === 'KeyD') { keyD = e.type === 'keydown'; e.preventDefault(); e.stopPropagation(); } };
  const onMouse = (e) => { const c = document.getElementById('lpc'); if (!c) return; const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) * (W / r.width) - CX, y = (e.clientY - r.top) * (H / r.height) - CY; let a = Math.atan2(-y, x) * 180 / Math.PI; if (a < 0) a = x > 0 ? 0 : 180; if (st && !st.turning) st.pick = G.clamp(a, 0, 180); };
  const onDown = (e) => { if (e.button === 2) { mouseR = true; e.preventDefault(); } };
  const onUp = (e) => { if (e.button === 2) mouseR = false; };
  const noCtx = (e) => e.preventDefault();
  LP.mount = function () {
    if (!st) return; LP.unlisten();
    keyD = mouseR = false; last = performance.now();
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
    window.addEventListener('mousemove', onMouse); window.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp); window.addEventListener('contextmenu', noCtx);
    cancelAnimationFrame(raf); const loop = (now) => { if (G.UI.open !== 'lockpick' || !st) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; LP.tick(dt); LP.draw(); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  };
  LP.unlisten = function () {
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('mousemove', onMouse); window.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp); window.removeEventListener('contextmenu', noCtx);
    cancelAnimationFrame(raf);
  };
  LP.close = function () { LP.unlisten(); st = null; };
  LP.tick = function (dt) {
    const P = G.Player, s = st;
    // se qualcuno ti vede mentre scassini: allarme
    if (G.Stealth && G.Stealth.seen) { G.UI.close(); G.Stealth.alarm(P, null); G.UI.toast('Ti hanno visto scassinare!', 'warn'); return; }
    s.turning = keyD || mouseR;
    const d = Math.abs(s.pick - s.sweet), max = d <= s.half ? 1 : Math.max(0, 1 - (d - s.half) / 50) * 0.92;
    if (s.turning) {
      s.rot = Math.min(max, s.rot + dt * 1.4);
      if (s.rot >= max - 0.01 && max < 1) {
        s.stress += dt; if (Math.random() < dt * 14 && G.Audio) G.Audio.click();
        if (s.stress > 0.75) {
          s.stress = 0; s.rot = 0;
          if (!G.creative()) P.take('grimaldello', 1);
          if (G.Audio) G.Audio.hit('stone');
          G.Skills.add('furto', 1);
          const n = P.count('grimaldello'), el = document.getElementById('lpn'); if (el) el.textContent = G.creative() ? '∞' : n;
          s.broke = 0.6;
          if (n <= 0 && !G.creative()) { G.UI.close(); G.UI.toast('Il grimaldello si è spezzato: non ne hai più', 'warn'); return; }
        }
      } else s.stress = Math.max(0, s.stress - dt);
      if (max >= 1 && s.rot >= 0.99) {
        // aperto!
        const p = s.p; (P.picked = P.picked || {})[p.id] = 1;
        G.Skills.add('furto', 8 + ((p.tier || 1) - 1) * 6);
        if (G.Audio) { G.Audio.click(); setTimeout(() => G.Audio.chest && G.Audio.chest(), 120); }
        G.UI.close(); G.UI.toast('Serratura aperta', 'good'); G.saveSoon && G.saveSoon();
        setTimeout(() => { if (G.Structures) G.Structures.openChest(p); }, 150);
        return;
      }
    } else { s.rot = Math.max(0, s.rot - dt * 2.5); s.stress = Math.max(0, s.stress - dt * 2); }
    s.broke = Math.max(0, (s.broke || 0) - dt); s.t += dt;
  };
  LP.draw = function () {
    const c = document.getElementById('lpc'); if (!c || !st) return; const x = c.getContext('2d'), s = st;
    x.clearRect(0, 0, W, H);
    let g = x.createRadialGradient(CX - 40, CY - 40, 20, CX, CY, 190); g.addColorStop(0, '#c9a25e'); g.addColorStop(0.6, '#7a5a26'); g.addColorStop(1, '#3a2a10');
    x.fillStyle = g; x.beginPath(); x.arc(CX, CY, 180, 0, 7); x.fill(); x.strokeStyle = '#241806'; x.lineWidth = 6; x.stroke();
    x.strokeStyle = 'rgba(255,230,170,.25)'; x.lineWidth = 2; x.beginPath(); x.arc(CX, CY, 160, 0, 7); x.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; x.fillStyle = '#3a2a10'; x.beginPath(); x.arc(CX + Math.cos(a) * 168, CY + Math.sin(a) * 168, 6, 0, 7); x.fill(); }
    // cilindro che ruota (con un tremolio quando forzi)
    const shake = s.turning && s.stress > 0 ? (Math.random() - 0.5) * 0.04 : 0;
    x.save(); x.translate(CX, CY); x.rotate(s.rot * Math.PI / 2 + shake);
    g = x.createRadialGradient(-20, -20, 5, 0, 0, 80); g.addColorStop(0, '#8a8a8e'); g.addColorStop(1, '#2a2a2e'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 76, 0, 7); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#050505'; x.beginPath(); x.arc(0, -22, 15, 0, 7); x.fill(); x.fillRect(-6, -22, 12, 58);
    // tensore
    x.fillStyle = '#bfc3c8'; x.fillRect(-4, 28, 8, 150); x.fillRect(-4, 170, 56, 10);
    x.restore();
    // grimaldello: dal bordo verso il centro, con l'angolo scelto dal mouse
    const a = -s.pick * Math.PI / 180;
    x.save(); x.translate(CX, CY - 22); x.rotate(a); const flex = s.turning && s.stress > 0 ? Math.sin(s.t * 60) * 0.03 : 0; x.rotate(flex);
    x.fillStyle = s.broke > 0 ? '#9a6a5a' : '#d9dde2'; x.fillRect(0, -3, s.broke > 0 ? 70 : 230, 6); x.fillStyle = '#6b4a22'; if (!(s.broke > 0)) x.fillRect(160, -9, 90, 18);
    x.beginPath(); x.moveTo(0, -3); x.lineTo(-12, -12); x.lineTo(-8, -3); x.fillStyle = '#d9dde2'; x.fill(); x.restore();
    if (s.broke > 0) { x.fillStyle = `rgba(255,120,90,${s.broke})`; x.font = '600 18px Signika, sans-serif'; x.textAlign = 'center'; x.fillText('Il grimaldello si è spezzato!', CX, 30); }
  };
})();
