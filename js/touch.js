/* Comandi touch per telefono e tablet.
   Usa gli stessi tasti del computer (eventi tastiera simulati), così ogni novità del gioco
   funziona da sola anche qui: basta aggiungere un pulsante che "preme" il tasto giusto. */
(function () {
  'use strict';
  const G = window.G;
  if (!G.isTouch) return;
  const $ = (id) => document.getElementById(id);
  const P = () => G.Player;
  const T = (G.Touch = { look: null, joy: null });

  function key(code, down) {
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  }
  function tap(code) { key(code, true); setTimeout(() => key(code, false), 60); }

  // pulsanti: [id, etichetta, lettera, tipo, azione]
  //  tipo 'hold' = tenuto premuto finché c'è il dito; 'tap' = un colpo
  const ACTIONS = [
    ['t-jump', 'Salta', '␣', 'hold', 'Space'],
    ['t-hit', 'Colpisci', '', 'hit'],
    ['t-use', 'Usa', '', 'use'],
    ['t-alt', 'Oggetto', '', 'alt'],
    ['t-down', 'Giù', 'C', 'hold', 'KeyC'],
  ];
  const TOP = [
    ['t-inv', 'Zaino', 'KeyI'],
    ['t-map', 'Mappa', 'KeyM'],
    ['t-book', 'Libro', 'KeyB'],
    ['t-swap', 'Scambia', 'KeyF'],
    ['t-menu', 'Menu', 'menu'],
  ];
  const CONTEXT = [
    ['t-rot', 'Ruota', 'KeyR', () => P().placing],
    ['t-cancel', 'Annulla', 'Escape', () => P().placing || G.UI.boatPlacing],
    ['t-hold', 'Stiva', 'KeyG', () => P().boat && P().boat.inv],
    ['t-view', 'Vista', 'KeyV', () => P().boat],
    ['t-sprint', 'Corri', 'sprint', () => !P().boat && !P().fly],
    ['t-talk', 'Parla', 'talk', () => !!(G.Net && G.Net.on && G.Voice && G.Voice.settings().mode === 'ptt')],
  ];

  function build() {
    document.documentElement.classList.add('touch');
    const root = document.createElement('div');
    root.id = 'touch'; root.hidden = true;
    root.innerHTML =
      `<div id="t-pad"></div>
       <div id="t-joy" hidden><i></i></div>
       <div class="t-top">${TOP.map(([id, l]) => `<button id="${id}" class="t-sm">${l}</button>`).join('')}</div>
       <div class="t-ctx">${CONTEXT.map(([id, l]) => `<button id="${id}" class="t-sm" hidden>${l}</button>`).join('')}</div>
       <div class="t-act">${ACTIONS.map(([id, l, k]) => `<button id="${id}" class="t-b">${l}${k ? `<small>${k}</small>` : ''}</button>`).join('')}</div>`;
    $('game').appendChild(root);
    const rot = document.createElement('div');
    rot.id = 'rotate'; rot.hidden = true;
    rot.innerHTML = '<div><b>Gira il telefono</b><span>Deriva si gioca in orizzontale</span></div>';
    $('game').appendChild(rot);

    // ---- visuale e joystick sullo stesso strato: metà sinistra muove, il resto guarda
    const pad = $('t-pad'), joy = $('t-joy'), knob = joy.firstChild;
    pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      kickFullscreen();
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.4;
        if (left && !T.joy) {
          T.joy = { id: t.identifier, x: t.clientX, y: t.clientY };
          joy.hidden = false; joy.style.left = t.clientX + 'px'; joy.style.top = t.clientY + 'px'; knob.style.transform = '';
        } else if (!left && !T.look) {
          T.look = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: 0, held: false };
          T.look.timer = setTimeout(() => { const L = T.look; if (L && L.moved < 12) { L.held = true; startHit(); } }, 260);
        }
      }
    }, { passive: false });
    pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (T.joy && t.identifier === T.joy.id) {
          const R = 52; let dx = t.clientX - T.joy.x, dy = t.clientY - T.joy.y; const l = Math.hypot(dx, dy);
          // trascinando oltre il bordo il cerchio ti segue: comodo per non perdere la presa
          if (l > R * 1.6) { const k = (l - R * 1.6) / l; T.joy.x += dx * k; T.joy.y += dy * k; joy.style.left = T.joy.x + 'px'; joy.style.top = T.joy.y + 'px'; dx = t.clientX - T.joy.x; dy = t.clientY - T.joy.y; }
          const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
          const kx = Math.cos(a) * m, ky = Math.sin(a) * m;
          knob.style.transform = `translate(${kx * R}px, ${ky * R}px)`;
          const dz = m < 0.18 ? 0 : 1;
          P().ax.f = -ky * dz; P().ax.r = kx * dz;
        } else if (T.look && t.identifier === T.look.id) {
          const L = T.look, dx = t.clientX - L.x, dy = t.clientY - L.y;
          L.x = t.clientX; L.y = t.clientY; L.moved = Math.max(L.moved, Math.hypot(t.clientX - L.sx, t.clientY - L.sy));
          if (G.started && !G.UI.open) {
            const s = 0.0058 * (G.settings.sens || 1);
            P().yaw -= dx * s; P().pitch = G.clamp(P().pitch - dy * s, -1.5, 1.5);
          }
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (T.joy && t.identifier === T.joy.id) { T.joy = null; joy.hidden = true; P().ax.f = P().ax.r = 0; }
        else if (T.look && t.identifier === T.look.id) {
          const L = T.look; clearTimeout(L.timer); T.look = null;
          if (L.held) stopHit();
          else if (L.moved < 12 && performance.now() - L.t < 260) { startHit(); setTimeout(stopHit, 40); }
        }
      }
    };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);

    // ---- pulsanti d'azione
    for (const [id, , , kind, code] of ACTIONS) {
      const b = $(id);
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); b.classList.add('on');
        if (kind === 'hold') key(code, true);
        else if (kind === 'tap') tap(code);
        else if (kind === 'hit') startHit();
        else if (kind === 'alt') startAlt();
        else if (kind === 'use') { if (G.started && !G.UI.open && !G.UI.menu) P().interact(); }
      }, { passive: false });
      const up = (e) => {
        e.preventDefault(); b.classList.remove('on');
        if (kind === 'hold') key(code, false);
        else if (kind === 'hit') stopHit();
        else if (kind === 'alt') stopAlt();
      };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    }
    for (const [id, , code] of TOP.concat(CONTEXT)) {
      const b = $(id);
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (code === 'menu') { P().keys = {}; P().ax.f = P().ax.r = 0; G.UI.showMenu('main'); G.save(); return; }
        if (code === 'sprint') { T.sprint = !T.sprint; P().keys.ShiftLeft = T.sprint; b.classList.toggle('on', T.sprint); return; }
        if (code === 'talk') { G.Voice.setPTT(true); b.classList.add('on'); return; }
        tap(code);
      }, { passive: false });
      if (code === 'talk') { const up = (e) => { e.preventDefault(); G.Voice.setPTT(false); b.classList.remove('on'); }; b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); }
    }
    // barra rapida: tocca uno slot per sceglierlo
    $('hotbar').addEventListener('touchstart', (e) => {
      const s = e.target.closest('.slot'); if (!s) return; e.preventDefault();
      P().sel = +s.dataset.i; G.UI.refreshHotbar();
    }, { passive: false });
    $('lefthand').addEventListener('touchstart', (e) => { e.preventDefault(); tap('KeyF'); }, { passive: false });
  }

  // stesso comportamento del clic sinistro / destro sul canvas
  function startHit() {
    const p = P(); if (!G.started || G.UI.open || G.UI.menu) return;
    if (G.UI.boatPlacing) { G.UI.confirmBoatPlace(); return; }
    if (p.placing) { p.secondary(); return; } // col dito il colpo piazza il pezzo che hai in mano
    p.mouse.l = true; if (p.actionCd <= 0) p.primary();
  }
  function stopHit() { P().mouse.l = false; }
  function startAlt() {
    const p = P(); if (!G.started || G.UI.open || G.UI.menu) return;
    p.mouse.r = true;
    if (G.UI.boatPlacing) { G.UI.confirmBoatPlace(); return; }
    p.secondary();
  }
  function stopAlt() { P().mouse.r = false; }

  let fsTried = 0;
  function kickFullscreen() {
    if (fsTried > 2 || document.fullscreenElement) return; fsTried++;
    const el = document.documentElement;
    try { const r = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' }); if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
  }

  // aggiorna cosa si vede: solo in partita, senza pannelli aperti
  function tick() {
    const root = $('touch'); if (!root) return requestAnimationFrame(tick);
    const con = $('console'), play = !!(G.started && !G.UI.menu && !G.UI.open && (!con || con.hidden));
    if (root.hidden === play) root.hidden = !play;
    if (!play) { if (T.joy || T.look) { T.joy = T.look = null; $('t-joy').hidden = true; P().ax.f = P().ax.r = 0; P().mouse.l = P().mouse.r = false; } }
    else {
      for (const [id, , , show] of CONTEXT) { const b = $(id), v = !!show(); if (b.hidden === v) b.hidden = !v; }
      const p = P(), dn = $('t-down'), need = !!(p.swim || p.fly || p.under);
      if (dn.hidden === need) dn.hidden = !need;
      if (T.sprint && (p.boat || p.fly)) { T.sprint = false; p.keys.ShiftLeft = false; $('t-sprint').classList.remove('on'); }
    }
    const port = innerHeight > innerWidth * 1.05;
    const rot = $('rotate'); if (rot && rot.hidden === (port && !!G.started && !G.UI.menu)) rot.hidden = !(port && G.started && !G.UI.menu);
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { build(); tick(); });
  else { build(); tick(); }
})();
