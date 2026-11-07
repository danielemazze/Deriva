/* =========================================================
   Ciurma: gli abitanti dei villaggi si reclutano pagandoli.
   Ognuno ha un mestiere (cannoniere, carpentiere, nostromo,
   combattente), vuole una paga ogni giorno e sale sulla tua
   nave quando ci sali tu. Con O si danno gli ordini: fuoco a
   un lato o a volontà, riparare, vele, abbordaggio, seguimi.
   ========================================================= */
(function () {
  const C = (G.Crew = { list: [], order: 'posti', menu: false });
  const P = () => G.Player, V3 = THREE.Vector3;
  const JOBS = {
    cannoniere: { n: 'Cannoniere', price: 80, wage: 6, d: 'Ai cannoni: spara da solo ai nemici sul lato che gli dici. Più è bravo, più ricarica in fretta e mira giusto.' },
    carpentiere: { n: 'Carpentiere', price: 60, wage: 4, d: 'Ripara lo scafo durante e dopo la battaglia, usando le assi della tua borsa.' },
    nostromo: { n: 'Nostromo', price: 50, wage: 4, d: 'Cura vele e cime: la nave va più veloce. Su tuo ordine ammaina le vele per manovrare.' },
    combattente: { n: 'Combattente', price: 70, wage: 5, d: 'Va all’abbordaggio: salta sulla nave nemica e combatte la sua ciurma per catturarla.' },
  };
  C.JOBS = JOBS;
  // posti a bordo per ogni barca
  const CAP = { zattera: 0, canoa: 0, barca_remi: 1, barca_vela: 2, catamarano: 3, veliero: 4, galeone: 8, vascello: 12 };
  C.cap = (b) => !b || b.pirate ? 0 : b.free ? Math.min(6, Math.floor((b.pcs ? b.pcs.length : 0) / 10)) : (CAP[b.tpl] !== undefined ? CAP[b.tpl] : 2);
  C.MAX = 12;
  const ORDERS = [
    ['fuoco', 'Fuoco a volontà'], ['fuoco_sx', 'Fuoco a sinistra'], ['fuoco_dx', 'Fuoco a destra'], ['cessate', 'Cessate il fuoco'],
    ['ripara', 'Riparate lo scafo'], ['vele', 'Issate le vele'], ['ammaina', 'Ammainate le vele'], ['abbordaggio', 'All’abbordaggio!'], ['seguimi', 'Seguitemi / restate a bordo'],
  ];
  C.ORDERS = ORDERS;
  const say = (t, k) => G.UI.toast(t, k);

  /* ---------- offerta e reclutamento ---------- */
  C.offer = function (npc) {
    const lk = npc.def.look >>> 0, keys = Object.keys(JOBS), job = keys[lk % keys.length], lv = 1 + ((lk >> 4) % 3), J = JOBS[job];
    return { job, lv, price: Math.round(J.price * (0.75 + lv * 0.25)), wage: Math.round(J.wage * (0.8 + lv * 0.2)) };
  };
  C.canRecruit = (npc) => npc && npc.def && npc.def.role === 'abitante' && !/la guardia$/.test(npc.def.name);
  C.recruit = function (npc) {
    const o = C.offer(npc), Pl = P();
    if (C.list.length >= C.MAX) { say('La tua ciurma è al completo (' + C.MAX + ')', 'warn'); return false; }
    if (!G.creative()) { if (Pl.count('doblone') < o.price) return false; Pl.take('doblone', o.price); }
    if (G.Audio) G.Audio.coins();
    const m = { id: npc.def.id, name: npc.def.name, job: o.job, lv: o.lv, wage: o.wage, look: npc.def.look, style: npc.village && npc.village.style, paidDay: Math.floor(G.time), unpaid: 0, hp: 10 + o.lv * 5, boat: null, xp: 0 };
    (Pl.recruited = Pl.recruited || {})[npc.def.id] = 1;
    // l'abitante lascia il villaggio e ti segue
    const a = npc.home; G.scene.remove(npc.p.root);
    const S = G.Structures; if (S.npcs) { const i = S.npcs.indexOf(npc); if (i >= 0) S.npcs.splice(i, 1); }
    if (a && a.npcs) { const i = a.npcs.indexOf(npc); if (i >= 0) a.npcs.splice(i, 1); }
    m.pos = new V3(npc.x, npc.y, npc.z); m.yaw = npc.yaw || 0;
    C.list.push(m); mesh(m);
    say(`${m.name} entra nella tua ciurma come ${JOBS[m.job].n.toLowerCase()}. Paga: ${m.wage} dobloni al giorno`, 'good');
    G.saveSoon && G.saveSoon();
    return true;
  };
  function mesh(m) {
    if (m.p) return m.p;
    m.p = G.People.build(m.look, { style: m.style, female: undefined });
    G.scene.add(m.p.root); m.p.root.position.copy(m.pos || P().pos);
    return m.p;
  }
  function drop(m, why) {
    if (m.p) { m.p.root.parent && m.p.root.parent.remove(m.p.root); m.p = null; }
    C.list.splice(C.list.indexOf(m), 1);
    if (why) say(why, 'warn');
  }
  C.dismiss = function (m) { drop(m); say(`${m.name} lascia la ciurma`); };

  /* ---------- posti a bordo ---------- */
  function spotsFor(b) {
    const T = b.T, d = T.deck || 1, out = { cannoniere: [], carpentiere: [], nostromo: [], combattente: [] };
    const cs = G.Sea && G.Sea.cannonSpots ? G.Sea.cannonSpots(b) : [];
    // cannonieri: lungo le murate, alternando i lati (il cannone resta davanti a loro)
    cs.sort((a, c) => Math.abs(a.z) - Math.abs(c.z)).forEach((c) => out.cannoniere.push([c.x - Math.sign(c.x) * 0.75, d, c.z, c.sd > 0 ? -Math.PI / 2 : Math.PI / 2]));
    out.carpentiere.push([0.6, d, -T.L * 0.12, 0], [-0.6, d, T.L * 0.02, 0]);
    out.nostromo.push([0.9, d, T.L * 0.06, Math.PI], [-0.9, d, -T.L * 0.18, Math.PI]);
    for (let i = 0; i < 6; i++) out.combattente.push([(i % 2 ? -1 : 1) * (BTW(T, T.L * 0.22 - i * 0.9) - 0.6), d, T.L * 0.22 - i * 0.9, 0]);
    return out;
  }
  const BTW = (T, z) => Math.max(0.4, G.Boats.deckHalfW(T, z));
  function place(b) {
    const sp = spotsFor(b), used = {};
    for (const m of C.list) if (m.boat === b.id) {
      const arr = sp[m.job] && sp[m.job].length ? sp[m.job] : sp.combattente;
      const k = used[m.job] = (used[m.job] || 0); used[m.job]++;
      const s = arr[k % arr.length] || [0, b.T.deck || 1, 0, 0];
      m.home = { x: s[0], y: s[1], z: s[2], yaw: s[3] };
      if (m.p.root.parent !== b.inner) { m.p.root.parent && m.p.root.parent.remove(m.p.root); b.inner.add(m.p.root); }
      m.p.root.position.set(s[0], s[1], s[2]); m.p.root.rotation.set(0, s[3], 0);
    }
  }
  const boatById = (id) => G.Boats.list.find((b) => b.id === id);
  C.aboard = (b) => C.list.filter((m) => m.boat === b.id);

  /* ---------- ordini ---------- */
  C.setOrder = function (o) {
    const b = P().boat;
    if (o === 'seguimi') {
      const on = C.list.filter((m) => m.boat);
      if (on.length && !P().boat) { for (const m of on) { m.boat = null; if (m.p) { m.p.root.parent && m.p.root.parent.remove(m.p.root); G.scene.add(m.p.root); m.pos = P().pos.clone().add(new V3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1)); } } say('La ciurma scende e ti segue'); }
      else if (b) say('Restano a bordo con te'); else say('Ti seguono');
      C.order = 'posti'; return;
    }
    if (!b || !C.aboard(b).length) { say('Nessuno della tua ciurma è su questa nave', 'warn'); return; }
    C.order = o === 'vele' || o === 'ammaina' ? C.order : o;
    if (o === 'vele') b.crewSail = 0; if (o === 'ammaina') b.crewSail = 1;
    const shout = { fuoco: 'Fuoco a volontà!', fuoco_sx: 'Fuoco a sinistra!', fuoco_dx: 'Fuoco a destra!', cessate: 'Cessate il fuoco!', ripara: 'Carpentieri, allo scafo!', vele: 'Issate le vele!', ammaina: 'Ammainate le vele!', abbordaggio: 'All’abbordaggio!' }[o];
    if (shout) say(shout);
    if (G.Audio && G.Audio.grunt) G.Audio.grunt(4, P().pos);
    G.saveSoon && G.saveSoon();
  };
  C.toggleMenu = function (on) {
    C.menu = on === undefined ? !C.menu : on;
    if (C.menu && !C.list.length) { C.menu = false; say('Non hai una ciurma. Recluta qualcuno nei villaggi: parla con gli abitanti', 'warn'); }
    const el = document.getElementById('crewmenu'); if (!el) return;
    el.hidden = !C.menu; if (C.menu) el.innerHTML = renderMenu();
  };
  function renderMenu() {
    const b = P().boat, n = b ? C.aboard(b).length : 0;
    const row = (o, i) => `<button data-crew="${o[0]}" class="${C.order === o[0] || (o[0] === 'ammaina' && b && b.crewSail) ? 'on' : ''}"><kbd>${i + 1}</kbd>${o[1]}</button>`;
    return `<div class="cmh"><b>Ordini alla ciurma</b><small>${b ? n + ' a bordo · ' : ''}${C.list.length} in tutto · O per chiudere</small></div>${ORDERS.map(row).join('')}
      <div class="cml">${C.list.map((m) => `<span title="${JOBS[m.job].n}">${G.Icons ? '' : ''}${esc(m.name.split(' ')[0])} · ${JOBS[m.job].n.toLowerCase()}${'★'.repeat(m.lv)}${m.unpaid ? ' · non pagato' : ''}</span>`).join('')}</div>`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  C.menuKey = function (code) {
    if (!C.menu) return false;
    const m = /^Digit([1-9])$/.exec(code); if (!m) return false;
    const o = ORDERS[+m[1] - 1]; if (o) { C.setOrder(o[0]); C.toggleMenu(false); }
    return true;
  };

  /* ---------- ogni fotogramma ---------- */
  const _w = new V3(), _q = new THREE.Quaternion();
  function enemies(b) {
    const out = [];
    for (const e of (G.Sea && G.Sea.enc) || []) {
      if (e.dead) continue;
      const pos = e.boat ? G.Sea.boatPos(e.boat, new V3()) : e.pos ? e.pos.clone() : null; if (!pos) continue;
      const d = Math.hypot(pos.x - b.x, pos.z - b.z); if (d < 110) out.push({ e, pos, d });
    }
    return out.sort((a, c) => a.d - c.d);
  }
  C.update = function (dt) {
    if (!C.list.length) return;
    const Pl = P(), day = Math.floor(G.time);
    // paga giornaliera
    for (const m of C.list.slice()) {
      while (m.paidDay < day) {
        m.paidDay++;
        if (G.creative() || Pl.count('doblone') >= m.wage) { if (!G.creative()) Pl.take('doblone', m.wage); m.unpaid = 0; }
        else { m.unpaid++; if (m.unpaid === 1) say(`Non hai i dobloni per pagare ${m.name}: senza paga perde la voglia di lavorare`, 'warn'); }
      }
      if (m.unpaid >= 3) { drop(m, `${m.name} non viene pagato da tre giorni e lascia la ciurma`); continue; }
    }
    const pb = Pl.boat && !Pl.boat.pirate ? Pl.boat : null;
    // salire a bordo con te
    if (pb) {
      const cap = C.cap(pb); let n = C.aboard(pb).length, added = 0;
      for (const m of C.list) if (!m.boat && n < cap) { mesh(m); const d = m.p.root.position.distanceTo(Pl.pos); if (d < 45) { m.boat = pb.id; n++; added++; } }
      if (added) { place(pb); say(added === 1 ? 'Un marinaio sale a bordo' : `${added} marinai salgono a bordo`); }
      else if (!pb._crewPlaced) place(pb);
      pb._crewPlaced = true;
    }
    for (const m of C.list) {
      mesh(m);
      const b = m.boat ? boatById(m.boat) : null;
      if (m.boat && !b) { m.boat = null; G.scene.add(m.p.root); m.pos = Pl.pos.clone(); }
      if (b) { if (!m.home || m.p.root.parent !== b.inner) place(b); crewOnBoat(m, b, dt); }
      else follow(m, dt, C.list.filter((x) => !x.boat).indexOf(m));
      m.hp = Math.min(10 + m.lv * 5, m.hp + dt * 0.05);
    }
    // ordini che valgono per la nave dove sei
    if (pb) shipOrders(pb, dt);
    const h = document.getElementById('crewhud');
    if (h) { const n = pb ? C.aboard(pb).length : 0; const t = pb && n ? `Ciurma ${n}/${C.cap(pb)} · ${(ORDERS.find((o) => o[0] === C.order) || [0, 'ai posti'])[1].toLowerCase()}${pb.crewSail ? ' · vele ammainate' : ''} · O ordini` : ''; if (h.textContent !== t) h.textContent = t; h.hidden = !t; }
  };
  function follow(m, dt, i) {
    const Pl = P(), r = m.p.root;
    if (r.parent !== G.scene) { r.parent && r.parent.remove(r); G.scene.add(r); }
    if (!m.pos) m.pos = r.position.clone();
    const back = 2.4 + Math.floor(i / 2) * 1.4, side = (i % 2 ? 1 : -1) * 1.1;
    const fx = Math.sin(Pl.yaw), fz = Math.cos(Pl.yaw);
    const tx = Pl.pos.x + fx * back + fz * side, tz = Pl.pos.z + fz * back - fx * side;
    const dx = tx - m.pos.x, dz = tz - m.pos.z, d = Math.hypot(dx, dz);
    let sp = 0;
    if (Pl.boat || Pl.swim) { /* aspetta a riva */ }
    else if (d > 40) { m.pos.set(tx, G.World.groundAt(tx, tz), tz); }
    else if (d > 0.6) { sp = d > 6 ? 4.8 : 2.2; const k = Math.min(1, sp * dt / d); m.pos.x += dx * k; m.pos.z += dz * k; m.yaw = Math.atan2(dx, dz); }
    const gy = Math.max(G.World.groundAt(m.pos.x, m.pos.z), G.Build && G.Build.groundAt ? G.Build.groundAt(m.pos.x, m.pos.z, m.pos.y + 1, 0.05) : -1e9);
    m.pos.y += (Math.max(gy, G.SEA - 1.2) - m.pos.y) * Math.min(1, dt * 10);
    r.position.copy(m.pos); r.rotation.set(0, m.yaw || 0, 0);
    G.People.animate(m.p, dt, sp, 'idle', 0);
  }
  function crewOnBoat(m, b, dt) {
    let st = 'idle', sp = 0;
    if (m.act > 0) { m.act -= dt; st = 'attack'; }
    if (C.order === 'riposo') st = 'idle';
    m.p.root.position.set(m.home.x, m.home.y, m.home.z);
    G.People.animate(m.p, dt, sp, st, 0);
    m.pos = m.p.root.getWorldPosition(m.pos || new V3());
  }
  function shipOrders(b, dt) {
    const crew = C.aboard(b); if (!crew.length) { b.crewSpeed = 1; return; }
    const Pl = P(), S = G.Sea;
    // nostromi: più velocità (meno se non pagati); vele ammainate: lenti ma manovrabili
    const nos = crew.filter((m) => m.job === 'nostromo').reduce((a, m) => a + (m.unpaid ? 0.4 : 1) * (0.04 + m.lv * 0.02), 0);
    b.crewSpeed = b.crewSail ? 0.45 : 1 + Math.min(0.2, nos);
    b.crewTurn = b.crewSail ? 1.5 : 1;
    // danni presi: qualche ferito
    const hull = S.hullOf(b);
    if (b._crewHull !== undefined && hull < b._crewHull - 0.5) {
      const loss = b._crewHull - hull;
      if (Math.random() < Math.min(0.6, loss / 30)) { const m = crew[(Math.random() * crew.length) | 0]; m.hp -= loss * 0.25; if (m.hp <= 0) { drop(m, `${m.name} è caduto in battaglia`); return; } }
    }
    b._crewHull = hull;
    const foes = enemies(b), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    // cannonieri
    const firing = C.order === 'fuoco' || C.order === 'fuoco_sx' || C.order === 'fuoco_dx';
    if (firing && S.hasCannons(b) && foes.length) {
      for (const m of crew) if (m.job === 'cannoniere') {
        m.cd = (m.cd || Math.random() * 2) - dt * (m.unpaid ? 0.5 : 1);
        if (m.cd > 0) continue;
        const t = foes.find((f) => { const s = (f.pos.x - b.x) * rx + (f.pos.z - b.z) * rz > 0 ? 1 : -1; return f.d < 95 && (C.order === 'fuoco' || (C.order === 'fuoco_dx' ? s > 0 : s < 0)); });
        if (!t) { m.cd = 0.5; continue; }
        if (!G.creative() && Pl.count('munizioni') <= 0) { if (!C._noAmmo || performance.now() - C._noAmmo > 8000) { C._noAmmo = performance.now(); say('I cannonieri non hanno munizioni', 'warn'); } m.cd = 2; continue; }
        if (!G.creative() && Math.random() < 0.5) Pl.take('munizioni', 1);
        m.cd = 7 - m.lv * 1.1 + Math.random();
        const from = m.p.root.getWorldPosition(new V3()); const s = (t.pos.x - b.x) * rx + (t.pos.z - b.z) * rz > 0 ? 1 : -1;
        from.x += rx * s * 1.2; from.z += rz * s * 1.2; from.y += 0.5;
        // mira un po' avanti se il bersaglio si muove
        const lead = t.e.boat ? t.e.boat.speed * (t.d / 60) : 0, ty = t.e.boat ? Math.sin(t.e.boat.yaw) : 0, tz = t.e.boat ? Math.cos(t.e.boat.yaw) : 0;
        const to = new V3(t.pos.x + ty * lead, t.e.boat ? G.SEA + 1 : t.pos.y, t.pos.z + tz * lead);
        S.fireBall(from, to, 'player', 7 - m.lv * 1.6);
        m.act = 0.6; m.xp++;
      }
    }
    // carpentieri
    if (C.order === 'ripara' || (hull < S.hullMax(b) * 0.35 && foes.length === 0)) {
      const carp = crew.filter((m) => m.job === 'carpentiere');
      if (carp.length && hull < S.hullMax(b)) {
        const rate = carp.reduce((a, m) => a + (m.unpaid ? 0.5 : 1) * (1.5 + m.lv), 0);
        const add = Math.min(S.hullMax(b) - hull, rate * dt);
        b._repAcc = (b._repAcc || 0) + add;
        if (b._repAcc >= 12) { if (!G.creative()) { if (Pl.count('assi') <= 0) { if (!C._noWood || performance.now() - C._noWood > 8000) { C._noWood = performance.now(); say('Per riparare servono assi', 'warn'); } b._repAcc = 12; return; } Pl.take('assi', 1); } b._repAcc -= 12; }
        b.hull = hull + add; b._crewHull = b.hull;
        for (const m of carp) if (Math.random() < dt * 1.5) m.act = 0.5;
        if (b.hull >= S.hullMax(b) - 0.01 && C.order === 'ripara') { C.order = 'posti'; say('Scafo riparato'); }
      }
    }
    // abbordaggio
    if (C.order === 'abbordaggio') boarding(b, crew, foes, dt);
  }
  function boarding(b, crew, foes, dt) {
    const S = G.Sea, t = foes.find((f) => f.e.type === 'pirati' && f.d < 16);
    if (!t) { if (!C._board || performance.now() - C._board > 6000) { C._board = performance.now(); say('Avvicinati di più alla nave nemica: meno di 15 metri'); } return; }
    const e = t.e, eb = e.boat;
    const fighters = crew.filter((m) => m.job === 'combattente').concat(crew.filter((m) => m.job !== 'combattente' && m.job !== 'cannoniere'));
    if (!fighters.length) { say('Nessuno può andare all’abbordaggio: recluta dei combattenti', 'warn'); C.order = 'posti'; return; }
    // i nostri saltano sul ponte nemico e combattono
    fighters.forEach((m, i) => { if (m.p.root.parent !== eb.inner) { m.p.root.parent && m.p.root.parent.remove(m.p.root); eb.inner.add(m.p.root); } m.home = { x: (i % 2 ? -1 : 1) * 1.1, y: eb.T.deck || 1, z: -2 + i * 1.1, yaw: Math.PI }; m.act = 0.5; });
    e.crewHp = e.crewHp || e.crew.map(() => 12);
    const dmg = fighters.reduce((a, m) => a + (m.job === 'combattente' ? 1.6 + m.lv * 0.8 : 0.6) * (m.unpaid ? 0.6 : 1), 0) * dt;
    const alive = e.crew.map((p, i) => i).filter((i) => e.crewHp[i] > 0);
    if (alive.length) {
      const k = alive[0]; e.crewHp[k] -= dmg;
      for (const i of alive) G.People.animate(e.crew[i], 0, 0, 'attack', 0);
      if (e.crewHp[k] <= 0) { const pp = e.crew[k]; pp.root.parent && pp.root.parent.remove(pp.root); if (G.Audio && G.Audio.at) G.Audio.at('pirata_dolore', t.pos, { bus: 'ani' }); }
      // i pirati rispondono
      if (Math.random() < dt * alive.length * 0.35) { const m = fighters[(Math.random() * fighters.length) | 0]; m.hp -= 1.5 + Math.random() * 2; if (m.hp <= 0) { drop(m, `${m.name} è caduto all’abbordaggio`); } }
    }
    if (e.crewHp.every((h) => h <= 0)) capture(e, b);
  }
  function capture(e, mine) {
    const S = G.Sea, b = e.boat;
    e.dead = true; const i = S.enc.indexOf(e); if (i >= 0) S.enc.splice(i, 1);
    b.pirate = false; b.ai = null; b.onSink = null; b.enc = null; b.anchored = true; b.speed = 0; b.hullMaxO = undefined; b.hull = Math.min(S.hullOf(b), S.hullMax(b));
    // i combattenti tornano sulla tua nave
    for (const m of C.list) if (m.boat === mine.id && m.p.root.parent === b.inner) { b.inner.remove(m.p.root); mine.inner.add(m.p.root); m.home = null; }
    C.order = 'posti';
    say('Nave catturata! Ora è tua: il bottino è nella stiva (G)', 'good');
    if (G.Audio) G.Audio.coins && G.Audio.coins();
    if (P().stats) P().stats.captured = (P().stats.captured || 0) + 1;
    G.saveSoon && G.saveSoon();
  }

  /* ---------- salvataggio ---------- */
  C.serialize = () => ({ order: C.order, list: C.list.map((m) => ({ id: m.id, name: m.name, job: m.job, lv: m.lv, wage: m.wage, look: m.look, style: m.style, paidDay: m.paidDay, unpaid: m.unpaid, hp: Math.round(m.hp), boat: m.boat, xp: m.xp || 0, pos: m.pos ? [+m.pos.x.toFixed(1), +m.pos.y.toFixed(1), +m.pos.z.toFixed(1)] : null })) });
  C.load = function (d) {
    for (const m of C.list) if (m.p && m.p.root.parent) m.p.root.parent.remove(m.p.root);
    C.list = []; C.order = (d && d.order) || 'posti';
    for (const x of (d && d.list) || []) { const m = Object.assign({}, x); m.pos = x.pos ? new V3(x.pos[0], x.pos[1], x.pos[2]) : P().pos.clone(); C.list.push(m); }
  };
  C.clear = () => C.load(null);
})();
