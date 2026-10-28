'use strict';
/* ==========================================================
   Comandi: console (T oppure /) e pannello "Strumenti" (K).
   Orario, meteo, vento, luna, biomi, villaggi, teletrasporto,
   comparsa di animali, nemici e abitanti, modalità.
   In multigiocatore li usa solo chi ospita.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const Cmd = (G.Cmd = { history: [], hi: -1 });
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = () => G.Player;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  Cmd.allowed = () => !(G.Net && G.Net.on && !G.Net.isHost && !G.Net.op);
  // comandi che cambiano il mondo di tutti: per gli operatori li esegue chi ospita
  const WORLD_CMD = new Set(['ora', 'tempo', 'meteo', 'vento', 'luna', 'modalita', 'modo', 'nemici']);
  const say = (msg, kind) => { G.UI.toast(msg, kind); Cmd.log(msg); };
  Cmd.lines = [];
  Cmd.log = function (msg) { Cmd.lines.push(msg); if (Cmd.lines.length > 8) Cmd.lines.shift(); const l = $('conlog'); if (l) l.innerHTML = Cmd.lines.map((x) => `<div>${esc(x)}</div>`).join(''); };

  /* ---------------- AZIONI ---------------- */
  const TIMES = { alba: 6, mattina: 8.5, mezzogiorno: 12, pomeriggio: 15.5, tramonto: 18.6, sera: 20.5, notte: 23, mezzanotte: 0 };
  Cmd.setHour = function (h) {
    const day = Math.floor(G.time), cur = (G.time % 1) * 24;
    G.time = day + (h < cur - 0.01 ? 1 : 0) + h / 24;
    if (G.Net && G.Net.on) G.Net.timeT = 0;
    return `Ora impostata: ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  };
  Cmd.setWind = function (lv, dirName) {
    if (lv !== null && lv !== undefined) G.setWind(lv);
    if (dirName) { const d = G.Climate.dirFromName(dirName); if (d === null) return 'Direzione non valida: usa N, NE, E, SE, S, SO, O, NO'; G.Boats.wind.dir = d; G.Climate.windTarget = d; }
    G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0;
    return `Vento ${G.WIND.level} (${G.UI.windName ? G.UI.windName(G.WIND.level).split(' · ')[1] : ''}) da ${G.Climate.dirName(G.Boats.wind.dir)}`;
  };
  Cmd.setWeather = function (k) {
    k = norm(k).replace('siccita', 'siccita');
    if (k === 'auto' || k === 'variabile') { G.Climate.state.lock = false; G.Climate.state.t = 30; return 'Il meteo torna a cambiare da solo'; }
    const map = { sole: 'sereno', bello: 'sereno', nuvole: 'nuvoloso', pioggia: 'pioggia', neve: 'pioggia', temporale: 'temporale', tempesta: 'temporale', caldo: 'caldo', siccita: 'siccita' };
    const kind = G.Climate.KINDS[k] ? k : map[k];
    if (!kind) return 'Meteo: sereno, nuvoloso, pioggia, temporale, caldo, siccita oppure auto';
    G.Climate.setWeather(kind, true, true); G.saveSoon();
    return `Meteo: ${G.Climate.KINDS[kind].n} (fisso; /meteo auto per farlo cambiare)` + (k === 'neve' ? ' · la neve cade nei biomi freddi' : '');
  };
  Cmd.setMoon = function (v) {
    v = norm(v);
    const names = G.Climate.PHASES.map(norm);
    let i = /^\d$/.test(v) ? +v : names.findIndex((n) => n === v || n.includes(v));
    if (v === 'piena') i = 4; if (v === 'nuova') i = 0;
    if (i < 0 || i > 7) return 'Fasi: nuova, falce crescente, primo quarto, gibbosa crescente, piena, gibbosa calante, ultimo quarto, falce calante (o 0–7)';
    G.Climate.setMoon(i); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0;
    return `${G.Climate.PHASE_ICON[i]} ${G.Climate.PHASES[i]}`;
  };
  Cmd.teleport = function (x, z, label) {
    const p = P(); if (p.boat) p.leaveBoat(true);
    p.fly = G.creative() ? p.fly : false;
    G.World.update(x, z, 400);
    const g = Math.max(G.World.groundAt(x, z), G.Build.groundAt(x, z, 500, 0.1));
    p.pos.set(x, Math.max(g, G.SEA - 1.5) + 0.2, z); p.vel.set(0, 0, 0);
    G.settleOnGround();
    return label ? `Sei a: ${label}` : `Teletrasporto a ${Math.round(x)}, ${Math.round(z)}`;
  };
  Cmd.BIOMES = { pianura: 'PIANURA', foresta: 'FORESTA', pluviale: 'PLUVIALE', 'foresta pluviale': 'PLUVIALE', giungla: 'GIUNGLA', deserto: 'DESERTO', montagna: 'MONTAGNA', montagne: 'MONTAGNA', neve: 'NEVE', ghiaccio: 'NEVE', vulcano: 'VULCANO' };
  Cmd.findBiome = function (name) {
    const key = Cmd.BIOMES[norm(name)]; if (!key || G.BIOME[key] === undefined) return null;
    const b = G.BIOME[key], p = P().pos;
    for (let r = 30; r < 6000; r += 35) for (let a = 0; a < 6.283; a += 70 / Math.max(r, 70)) {
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const h = G.heightAt(x, z); if (h < 1.5) continue;
      if (G.biomeAt(x, z) === b && G.normalAt(x, z)[1] > 0.8) return { x, z, dist: r };
    }
    return null;
  };
  Cmd.goBiome = function (name) {
    const f = Cmd.findBiome(name);
    if (!f) return `Nessun bioma "${name}" trovato qui intorno. Biomi: ${Object.keys(Cmd.BIOMES).filter((k) => !k.includes(' ')).join(', ')}`;
    return Cmd.teleport(f.x, f.z, `${name} (a ${Math.round(f.dist)} m da dov'eri)`);
  };
  Cmd.villages = function (style) {
    const p = P().pos, st = norm(style);
    return G.POI.near(p.x, p.z, 5000, 'village').filter((v) => !st || norm(v.style).includes(st) || norm(v.name).includes(st))
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  };
  Cmd.reveal = function (v) { P().revealed = P().revealed || {}; P().revealed[v.id] = 1; };
  Cmd.goVillage = function (style) {
    const l = Cmd.villages(style); if (!l.length) return 'Nessun villaggio trovato' + (style ? ` di stile "${style}"` : '');
    const v = l[0]; Cmd.reveal(v);
    const a = Math.atan2(v.z - P().pos.z, v.x - P().pos.x);
    return Cmd.teleport(v.x - Math.cos(a) * 26, v.z - Math.sin(a) * 26, `vicino a ${v.name} (${v.style})`);
  };
  Cmd.listVillages = function () {
    const l = Cmd.villages().slice(0, 6), p = P().pos;
    for (const v of l) Cmd.reveal(v);
    if (!l.length) return 'Nessun villaggio entro 5 km';
    return 'Villaggi segnati sulla mappa (M): ' + l.map((v) => `${v.name} ${Math.round(Math.hypot(v.x - p.x, v.z - p.z))} m ${G.Climate.dirName(Math.atan2(v.x - p.x, v.z - p.z) + Math.PI)}`).join(' · ');
  };
  Cmd.findPlayer = function (name) {
    const N = G.Net; if (!N || !N.on) return null; const q = norm(name);
    const l = [...N.remotes.values()]; return l.find((r) => norm(r.name) === q) || l.find((r) => norm(r.name).startsWith(q)) || (!q && l.length === 1 ? l[0] : null);
  };
  Cmd.tpTo = function (name) {
    if (!G.Net || !G.Net.on) return 'Serve una partita con altri giocatori';
    const r = Cmd.findPlayer(name); if (!r) return name ? `Nessun giocatore "${name}"` : 'Uso: /tpda Nome';
    const a = r.yaw || 0, x = r.pos.x - Math.sin(a) * 1.8, z = r.pos.z - Math.cos(a) * 1.8; // davanti all'amico, girato verso di lui
    const msg = Cmd.teleport(x, z, r.name); const p = P(); p.pos.y = Math.max(p.pos.y, r.pos.y); p.vel.set(0, 0, 0); p.yaw = a + Math.PI;
    return msg;
  };
  Cmd.setOp = function (name, on) {
    const N = G.Net; if (!N || !N.on) return 'Serve una partita con altri giocatori'; if (!N.isHost) return 'Solo chi ospita sceglie gli operatori';
    const r = Cmd.findPlayer(name); if (!r) return name ? `Nessun giocatore "${name}"` : 'Uso: /op Nome';
    N.setOp(r.id, on); return on ? `${r.name} ora è operatore` : `${r.name} non è più operatore`;
  };
  Cmd.goPlace = function (type) {
    const map = { faro: 'faro', fari: 'faro', relitto: 'relitto', covo: 'covo', pirati: 'covo', rovina: 'rovina', rovine: 'rovina', miniera: 'miniera', accampamento: 'accampamento', castello: 'castello', castelli: 'castello' };
    const t = map[norm(type)]; if (!t) return null;
    const p = P().pos, l = G.POI.near(p.x, p.z, t === 'castello' ? 9000 : 5000, t).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    if (!l.length) return `Nessun ${type} trovato entro 5 km`;
    const v = l[0]; Cmd.reveal(v);
    if (t === 'relitto') return Cmd.teleport(v.x + 6, v.z, v.name);
    if (t === 'castello') {
      // nel cortile esterno, fra la porta grande e quella interna
      const r = Math.floor(v.rotR * 4) * Math.PI / 2, x = v.x + Math.sin(r) * 40, z = v.z + Math.cos(r) * 40, pl = P();
      const msg = Cmd.teleport(x, z, v.name); const y = G.Structures.castleBase(v) + 0.3; pl.pos.y = Math.max(pl.pos.y, y); pl.vel.set(0, 0, 0); pl.yaw = r;
      for (let k = 0; k < 6; k++) { G.Structures.timer = 0; G.Structures.update(0, pl); } // costruisci subito mura e pavimento
      return msg;
    }
    const a = Math.atan2(v.z - p.z, v.x - p.x);
    return Cmd.teleport(v.x - Math.cos(a) * 16, v.z - Math.sin(a) * 16, v.name);
  };
  // comparsa: animali e nemici (anche pirati), oppure un abitante
  Cmd.SPAWN = { gallina: 'gallina', galline: 'gallina', pecora: 'pecora', pecore: 'pecora', mucca: 'mucca', mucche: 'mucca', maiale: 'maiale', maiali: 'maiale', coniglio: 'coniglio', conigli: 'coniglio', tartaruga: 'tartaruga',
    lupo: 'lupo', lupi: 'lupo', giaguaro: 'giaguaro', serpente: 'serpente', orso: 'orso', coccodrillo: 'coccodrillo', squalo: 'squalo', pirata: 'pirata', pirati: 'pirata', capitano: 'capitano' };
  Cmd.spawn = function (what, n) {
    const p = P(); n = Math.max(1, Math.min(12, n | 0 || 1));
    const w = norm(what);
    if (w === 'kraken' && G.Sea) { G.Sea.clear(); G.Sea.spawnKraken(); return 'Il Kraken emerge accanto a te!'; }
    if ((w === 'pirati' || w === 'pirata' || w === 'nave pirata') && G.Sea) { G.Sea.clear(); G.Sea.spawnPirates(); return 'Una nave pirata ti viene incontro!'; }
    if (w === 'mare' && G.Sea) { G.Sea.clear(); return 'Il mare è di nuovo calmo'; }
    if (w === 'npc' || w === 'abitante' || w === 'mercante' || w === 'persona') {
      for (let i = 0; i < n; i++) G.Structures.spawnWanderer(p.pos.x - Math.sin(p.yaw) * 3 + (Math.random() - 0.5) * 3, p.pos.z - Math.cos(p.yaw) * 3 + (Math.random() - 0.5) * 3, w === 'mercante' ? 'mercante' : 'abitante');
      return `${n} ${n > 1 ? 'abitanti' : 'abitante'} accanto a te: ${G.useHow()} per parlarci`;
    }
    const sp = Cmd.SPAWN[w]; if (!sp || !G.SPECIES[sp]) return `Comparsa: ${Object.keys(Cmd.SPAWN).filter((k, i, a) => a.indexOf(k) === i && !k.endsWith('i') && !k.endsWith('e')).join(', ')}, abitante, mercante`;
    if (G.isHostile(sp) && G.enemiesOff) return 'I nemici sono disattivati in questo mondo (/nemici si)';
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = p.yaw + Math.PI + (Math.random() - 0.5) * 1.2, d = 5 + Math.random() * 4;
      let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d;
      list.push({ sp, x, z });
    }
    Cmd.spawnAnimals(list);
    return `${n} × ${G.SPECIES[sp].n}`;
  };
  Cmd.spawnAnimals = function (list) {
    if (G.Net && G.Net.on) { G.Net.send({ t: 'aspawn', l: list.map((a) => [a.sp, +a.x.toFixed(2), +a.z.toFixed(2)]) }); return; }
    for (const a of list) {
      const cx = Math.floor(a.x / G.CHUNK), cz = Math.floor(a.z / G.CHUNK);
      const id = `${cx},${cz},s${Math.random().toString(36).slice(2, 8)}`;
      const st = G.newAnimalState({ id, sp: a.sp, x: a.x, z: a.z, yaw: Math.random() * 6.28 });
      G.Entities.addAnimal(st, G.World.chunks.get(cx + ',' + cz) || null);
    }
  };
  Cmd.give = function (name, n) {
    const w = norm(name).replace(/ /g, '_');
    const id = G.ITEMS[w] ? w : Object.keys(G.ITEMS).find((k) => norm(G.ITEMS[k].n) === norm(name) || norm(G.ITEMS[k].n).startsWith(norm(name)));
    if (!id) return `Oggetto "${name}" non trovato`;
    const k = Math.max(1, Math.min(999, n | 0 || G.ITEMS[id].stack || 1));
    P().give(id, k, true); return `+${k} ${G.ITEMS[id].n}`;
  };

  /* ---------------- CONSOLE ---------------- */
  const HELP = [
    ['/ora 18 · /ora alba · /ora notte', 'orario'],
    ['/meteo pioggia · temporale · caldo · siccita · sereno · auto', 'meteo'],
    ['/vento 7 NE', 'forza 0–10 e direzione da cui soffia'],
    ['/luna piena · /luna 2', 'fase lunare'],
    ['/bioma deserto · foresta · pluviale · giungla · montagna · pianura · neve · vulcano', 'vai al bioma più vicino'],
    ['/villaggio [stile] · /villaggi', 'vai al villaggio più vicino · elenco sulla mappa'],
    ['/vai faro · relitto · covo · rovina · miniera · accampamento · castello', 'vai al luogo più vicino'],
    ['/spawn lupo 3 · /spawn pecora · /spawn pirata · /spawn abitante', 'fa comparire animali, nemici, abitanti'],
    ['/tp 120 -340', 'teletrasporto alle coordinate'],
    ['/tpda Marco', 'teletrasporto da un amico in partita'],
    ['/coord', 'le tue coordinate (le vedi anche sotto la bussola)'],
    ['/op Marco · /deop Marco', 'chi ospita dà o toglie i diritti di operatore'],
    ['/modalita creativa · sopravvivenza', 'cambia modalità (anche F4)'],
    ['/nemici si · no', 'attiva o disattiva i nemici'],
    ['/dai assi 64 · /cura · /gorgo', 'oggetti · salute piena · gorgo qui vicino'],
  ];
  Cmd.run = function (line, remoteFrom) {
    line = String(line || '').trim(); if (!line) return;
    if (line[0] !== '/') { if (G.Net && G.Net.on) { G.Net.send({ t: 'chat', text: line }); } else Cmd.log(line); return; }
    Cmd.history.push(line); if (Cmd.history.length > 30) Cmd.history.shift(); Cmd.hi = -1;
    const parts = line.slice(1).split(/\s+/), c = norm(parts.shift()), rest = parts.join(' ');
    if (c === 'aiuto' || c === 'help' || c === '?') { Cmd.log('Comandi:'); for (const [a, b] of HELP) Cmd.log(`${a} — ${b}`); return; }
    if (c === 'coord' || c === 'coordinate') { const p = P().pos; say(`Sei a X ${Math.round(p.x)} · Z ${Math.round(p.z)} · quota ${Math.round(p.y)} m`); return; }
    if (remoteFrom) { if (!WORLD_CMD.has(c)) return; say(`${remoteFrom} (operatore): ${line}`); }
    else if (c === 'op' || c === 'deop') { say(Cmd.setOp(rest, c === 'op')); return; }
    else if (!Cmd.allowed()) { say('In questa partita i comandi li usa solo chi ospita (o un operatore)', 'warn'); return; }
    else if (G.Net && G.Net.on && !G.Net.isHost && WORLD_CMD.has(c)) { G.Net.send({ t: 'wcmd', line }); say('Comando inviato a chi ospita'); return; }
    let r;
    switch (c) {
      case 'ora': case 'tempo': {
        const v = norm(rest); if (TIMES[v] !== undefined) r = Cmd.setHour(TIMES[v]);
        else { const m = /^(\d{1,2})(?:[:.](\d{1,2}))?$/.exec(v); r = m && +m[1] < 24 ? Cmd.setHour(+m[1] + (+m[2] || 0) / 60) : 'Uso: /ora 18 oppure /ora alba, mezzogiorno, tramonto, notte'; }
        break;
      }
      case 'meteo': r = Cmd.setWeather(rest); break;
      case 'vento': { const lv = parts.find((x) => /^\d+$/.test(x)), d = parts.find((x) => /^[a-z]{1,2}$/i.test(x)); r = lv === undefined && !d ? 'Uso: /vento 0–10 [N, NE, E, SE, S, SO, O, NO]' : Cmd.setWind(lv !== undefined ? +lv : null, d); break; }
      case 'luna': r = Cmd.setMoon(rest); break;
      case 'bioma': r = rest ? Cmd.goBiome(rest) : 'Uso: /bioma deserto (o foresta, pluviale, giungla, montagna, pianura, neve, vulcano)'; break;
      case 'villaggio': r = Cmd.goVillage(rest); break;
      case 'villaggi': r = Cmd.listVillages(); break;
      case 'vai': r = Cmd.goPlace(rest) || (Cmd.BIOMES[norm(rest)] ? Cmd.goBiome(rest) : norm(rest).startsWith('villagg') ? Cmd.goVillage('') : 'Uso: /vai faro, relitto, covo, rovina, miniera, accampamento'); break;
      case 'tpda': case 'tpa': r = Cmd.tpTo(rest); break;
      case 'tp': { const [x, z] = parts.map(Number); r = isFinite(x) && isFinite(z) ? Cmd.teleport(x, z) : 'Uso: /tp x z'; break; }
      case 'spawn': case 'evoca': { const n = parts.find((x) => /^\d+$/.test(x)); r = Cmd.spawn(parts.filter((x) => !/^\d+$/.test(x)).join(' '), n ? +n : 1); break; }
      case 'modalita': case 'modo': { const m = norm(rest).startsWith('c') ? 'creativa' : norm(rest).startsWith('s') ? 'sopravvivenza' : null; if (!m) r = 'Uso: /modalita creativa oppure sopravvivenza'; else { if (G.mode !== m) G.UI.toggleMode(); r = 'Modalità: ' + m; } break; }
      case 'nemici': { const on = /^(si|on|1|sì)/.test(norm(rest)); G.setEnemies(on); G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; r = on ? 'Nemici attivi' : 'Nemici disattivati'; break; }
      case 'dai': case 'oggetto': { const n = parts.find((x) => /^\d+$/.test(x)); r = Cmd.give(parts.filter((x) => !/^\d+$/.test(x)).join(' '), n ? +n : 0); break; }
      case 'cura': { const p = P(); p.health = p.hunger = p.thirst = p.oxygen = 100; p.temp = 50; r = 'Salute, fame e sete al massimo'; break; }
      case 'gorgo': { const p = P(); const a = p.yaw; G.Climate.forceVortex = { id: 'cmd', x: p.pos.x - Math.sin(a) * 40, z: p.pos.z - Math.cos(a) * 40, R: 34, cw: 1, forced: true, until: G.clock + 240 }; r = 'Un gorgo si apre davanti a te per 4 minuti'; break; }
      default: r = `Comando sconosciuto: /${c} · scrivi /aiuto`;
    }
    if (r) say(r);
  };
  Cmd.openConsole = function (prefix) {
    if (!G.started || G.UI.open || G.UI.menu) return;
    const box = $('console'); box.hidden = false;
    const inp = $('coninput'); inp.value = prefix || ''; Cmd.hi = -1;
    document.exitPointerLock && document.exitPointerLock();
    G.Player.keys = {};
    setTimeout(() => inp.focus(), 0);
    Cmd.log(Cmd.lines.length ? Cmd.lines.pop() : 'Scrivi /aiuto per l’elenco dei comandi' + (G.Net && G.Net.on ? ' · senza / è chat' : ''));
  };
  Cmd.closeConsole = function () { $('console').hidden = true; $('coninput').blur(); G.requestLock(); };
  Cmd.init = function () {
    const box = document.createElement('div'); box.id = 'console'; box.hidden = true;
    box.innerHTML = '<div id="conlog"></div><input id="coninput" autocomplete="off" spellcheck="false" placeholder="/aiuto · /ora 18 · /meteo temporale · /bioma deserto">';
    $('game').appendChild(box);
    const inp = $('coninput');
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = inp.value; inp.value = ''; Cmd.run(v); Cmd.closeConsole(); }
      else if (e.key === 'Escape') Cmd.closeConsole();
      else if (e.key === 'ArrowUp') { if (!Cmd.history.length) return; Cmd.hi = Cmd.hi < 0 ? Cmd.history.length - 1 : Math.max(0, Cmd.hi - 1); inp.value = Cmd.history[Cmd.hi]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (Cmd.hi < 0) return; Cmd.hi = Math.min(Cmd.history.length - 1, Cmd.hi + 1); inp.value = Cmd.history[Cmd.hi]; e.preventDefault(); }
      else if (e.key === 'Tab') { e.preventDefault(); const v = inp.value; const all = ['/aiuto', '/ora ', '/meteo ', '/vento ', '/luna ', '/bioma ', '/villaggio', '/villaggi', '/vai ', '/spawn ', '/tp ', '/modalita ', '/nemici ', '/dai ', '/cura', '/gorgo']; const m = all.find((x) => x.startsWith(v)); if (m) inp.value = m; }
    });
    G.UI.custom.strumenti = { render: renderPanel, click: clickPanel, wide: true };
  };

  /* ---------------- PANNELLO STRUMENTI ---------------- */
  function renderPanel() {
    const Cl = G.Climate, allowed = Cmd.allowed(), hh = (G.time % 1) * 24;
    const btn = (act, label, on, extra) => `<button class="mini-btn ${on ? 'on' : ''}" data-tool="${act}" ${extra || ''} ${allowed ? '' : 'disabled'}>${label}</button>`;
    const vl = Cmd.villages().slice(0, 6), p = P().pos;
    const sp = ['gallina', 'pecora', 'mucca', 'maiale', 'coniglio', 'lupo', 'orso', 'giaguaro', 'serpente', 'coccodrillo', 'squalo', 'pirata', 'capitano'];
    const tab = Cmd.tab || 'mondo';
    const TABS = [['mondo', '☀ Mondo'], ['viaggio', '🧭 Viaggi'], ['creature', '🐾 Creature'], ['giocatore', '🎒 Giocatore'], ['partita', '👥 Partita']];
    const S = {};
    S.mondo = `
      <section><h4>Orario <span class="tval">${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.floor((hh % 1) * 60)).padStart(2, '0')}</span></h4>
        <div class="tbtns">${Object.entries({ alba: 'Alba', mattina: 'Mattina', mezzogiorno: 'Mezzogiorno', tramonto: 'Tramonto', sera: 'Sera', notte: 'Notte' }).map(([k, n]) => btn('ora:' + k, n)).join('')}</div>
        <input type="range" min="0" max="23.75" step="0.25" value="${hh.toFixed(2)}" data-toolr="ora" ${allowed ? '' : 'disabled'}><small class="cmdh">/ora 18 · /ora tramonto</small></section>
      <section><h4>Meteo <span class="tval">${Cl.KINDS[Cl.state.kind].icon} ${Cl.KINDS[Cl.state.kind].n}${Cl.state.lock ? ' · fisso' : ' · variabile'}</span></h4>
        <div class="tbtns">${Object.entries(Cl.KINDS).map(([k, v]) => btn('meteo:' + k, v.icon + ' ' + v.n, Cl.state.kind === k)).join('')}${btn('meteo:auto', '↻ Variabile', !Cl.state.lock)}</div><small class="cmdh">/meteo temporale</small></section>
      <section><h4>Vento <span class="tval">${G.WIND.level} · da ${Cl.dirName(G.Boats.wind.dir)}${Cl.cur.wind ? ` · col meteo ${Math.round(Cl.windLevel())}` : ''}</span></h4>
        <input type="range" min="0" max="10" step="1" value="${G.WIND.level}" data-toolr="vento" ${allowed ? '' : 'disabled'}>
        <div class="tbtns rose">${Cl.DIR_N.map((d) => btn('dir:' + d, d, Cl.dirName(G.Boats.wind.dir) === d)).join('')}</div>
        <div class="tbtns">${btn('gorgo', '🌀 Gorgo qui davanti')}</div><small class="cmdh">/vento 6 NE · /gorgo</small></section>
      <section><h4>Luna <span class="tval">${Cl.PHASE_ICON[Cl.moonIndex()]} ${Cl.moonName()}</span></h4>
        <div class="tbtns moon">${Cl.PHASES.map((n, i) => btn('luna:' + i, Cl.PHASE_ICON[i], Cl.moonIndex() === i, `title="${n}"`)).join('')}</div><small class="cmdh">/luna piena</small></section>`;
    const others = G.Net && G.Net.on ? [...G.Net.remotes.values()] : [];
    S.viaggio = `
      <section><h4>Vai al bioma</h4>
        <div class="tbtns">${[['pianura', 'Pianura'], ['foresta', 'Foresta'], ['pluviale', 'Pluviale'], ['giungla', 'Giungla'], ['deserto', 'Deserto'], ['montagna', 'Montagna'], ['neve', 'Neve'], ['vulcano', 'Vulcano']].filter(([k]) => G.BIOME[Cmd.BIOMES[k]] !== undefined).map(([k, n]) => btn('bioma:' + k, n)).join('')}</div><small class="cmdh">/bioma deserto</small></section>
      <section><h4>Vai al luogo</h4>
        <div class="tbtns">${[['faro', 'Faro'], ['relitto', 'Relitto'], ['covo', 'Covo'], ['rovina', 'Rovina'], ['miniera', 'Miniera'], ['accampamento', 'Accampamento'], ['castello', 'Castello']].map(([k, n]) => btn('vai:' + k, n)).join('')}</div><small class="cmdh">/vai castello</small></section>
      <section><h4>Villaggi vicini</h4>
        <div class="vlist">${vl.map((v) => `<div><span>${esc(v.name)} <small>${esc(v.style)} · ${Math.round(Math.hypot(v.x - p.x, v.z - p.z))} m</small></span>${btn('vill:' + v.id, 'Vai')}</div>`).join('') || '<p class="note">Nessun villaggio entro 5 km</p>'}</div>
        ${btn('villaggi', 'Segna tutti sulla mappa')}<small class="cmdh">/villaggio · /villaggi</small></section>
      <section><h4>Coordinate <span class="tval">X ${Math.round(p.x)} · Z ${Math.round(p.z)}</span></h4>
        <div class="tbtns tpbox"><input type="number" id="tpx" placeholder="X" value="${Math.round(p.x)}"><input type="number" id="tpz" placeholder="Z" value="${Math.round(p.z)}">${btn('tp', 'Teletrasporto')}</div>
        <div class="tbtns">${btn('coord', 'Scrivi le mie coordinate in chat')}</div><small class="cmdh">/tp 120 -340 · /coord</small></section>
      <section><h4>Vai da un amico</h4>
        <div class="tbtns">${others.map((r) => btn('tpda:' + encodeURIComponent(r.name), esc(r.name))).join('') || '<p class="note">Nessun altro giocatore in partita</p>'}</div><small class="cmdh">/tpda Marco</small></section>`;
    S.creature = `
      <section class="wide2"><h4>Animali e nemici <span class="tval">Maiusc+clic: 3 alla volta</span></h4>
        <div class="tbtns">${sp.filter((s) => G.SPECIES[s]).map((s) => btn('spawn:' + s, G.SPECIES[s].n, false, G.isHostile(s) ? 'data-hostile="1"' : '')).join('')}</div><small class="cmdh">/spawn lupo 3</small></section>
      <section><h4>Persone</h4><div class="tbtns">${btn('spawn:abitante', 'Abitante')}${btn('spawn:mercante', 'Mercante')}</div><small class="cmdh">/spawn abitante</small></section>
      <section><h4>Mare aperto</h4><div class="tbtns">${btn('spawn:kraken', '🐙 Kraken', false, 'data-hostile="1"')}${btn('spawn:pirati', '🏴‍☠️ Nave pirata', false, 'data-hostile="1"')}${btn('spawn:mare', 'Mare calmo')}</div><small class="cmdh">/spawn kraken · /spawn pirati · /spawn mare</small></section>
      <section><h4>Nemici</h4><div class="tbtns">${btn('nemici:si', 'Nemici sì', !G.enemiesOff)}${btn('nemici:no', 'Nemici no', !!G.enemiesOff)}</div><small class="cmdh">/nemici si · no</small></section>`;
    const items = ['assi', 'tronco', 'pietra', 'corda', 'chiodi', 'ferro', 'munizioni', 'freccia', 'torcia', 'terra', 'doblone', 'cibo'].filter((i) => G.ITEMS[i]);
    S.giocatore = `
      <section><h4>Modalità <span class="tval">F4 per cambiare</span></h4>
        <div class="tbtns">${btn('mode:sopravvivenza', 'Sopravvivenza', !G.creative())}${btn('mode:creativa', 'Creativa', G.creative())}</div><small class="cmdh">/modalita creativa</small></section>
      <section><h4>Salute</h4><div class="tbtns">${btn('cura', '❤ Salute, fame e sete al massimo')}</div><small class="cmdh">/cura</small></section>
      <section class="wide2"><h4>Dai oggetti <span class="tval">Maiusc+clic: 64</span></h4>
        <div class="tbtns">${items.map((i) => btn('dai:' + i, esc(G.ITEMS[i].n))).join('')}</div>
        <div class="tbtns tpbox"><input id="daiid" placeholder="nome oggetto (es. lanterna)"><input type="number" id="dain" value="1" min="1" max="999">${btn('daix', 'Dai')}</div><small class="cmdh">/dai assi 64</small></section>`;
    const isHost = !(G.Net && G.Net.on) || G.Net.isHost;
    S.partita = `
      <section><h4>Morte e inventario</h4><div class="tbtns">${btn('ki:1', 'Tieni l’inventario', !!G.keepInv, isHost ? '' : 'disabled')}${btn('ki:0', 'Perdi tutto', !G.keepInv, isHost ? '' : 'disabled')}</div><small class="cmdh">${isHost ? 'lo decide chi ospita' : 'solo chi ospita può cambiarlo'}</small></section>
      <section class="wide2"><h4>Operatori <span class="tval">${isHost ? 'possono usare tutti i comandi' : 'lo decide chi ospita'}</span></h4>
        <div class="vlist">${others.map((r) => { const op = !!r.op; return `<div><span>${esc(r.name)} <small>${op ? 'operatore' : 'giocatore'}</small></span>${isHost ? btn((op ? 'deop:' : 'op:') + encodeURIComponent(r.name), op ? 'Togli operatore' : 'Rendi operatore') : ''}</div>`; }).join('') || '<p class="note">Nessun altro giocatore in partita</p>'}</div><small class="cmdh">/op Marco · /deop Marco</small></section>`;
    return `<div class="toolsp"><h3>Strumenti<small>${allowed ? 'tutti i comandi del mondo · anche dalla console con T o /' : 'li usa solo chi ospita (o un operatore)'}</small></h3>
      <div class="ttabs">${TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-ttab="${k}">${n}</button>`).join('')}</div>
      <div class="tgrid">${S[tab]}</div>
      <p class="note">Console: premi <kbd>T</kbd> o <kbd>/</kbd> e scrivi /aiuto. Pannello: <kbd>K</kbd>.</p></div>`;
  }
  function clickPanel(e) {
    const tb = e.target.closest('[data-ttab]'); if (tb) { Cmd.tab = tb.dataset.ttab; G.UI.renderPanel(); return true; }
    if (e.target.closest('input')) return true;
    const b = e.target.closest('[data-tool]'); if (!b || b.disabled) return false;
    const [k, v0] = b.dataset.tool.split(':'), v = v0 === undefined ? v0 : decodeURIComponent(v0);
    const ext = { tp: 1, coord: 1, tpda: 1, dai: 1, daix: 1, ki: 1, op: 1, deop: 1 };
    if (ext[k]) {
      if (k === 'tp') { const x = +$('tpx').value, z = +$('tpz').value; if (isFinite(x) && isFinite(z)) { Cmd.run(`/tp ${x} ${z}`); G.UI.close(); } }
      else if (k === 'coord') Cmd.run('/coord');
      else if (k === 'tpda') { Cmd.run('/tpda ' + v); G.UI.close(); }
      else if (k === 'dai') Cmd.run(`/dai ${v} ${e.shiftKey ? 64 : 1}`);
      else if (k === 'daix') { const id = $('daiid').value.trim(); if (id) Cmd.run(`/dai ${id} ${Math.max(1, +$('dain').value || 1)}`); }
      else if (k === 'ki') { G.keepInv = v === '1'; G.saveSoon(); if (G.Net && G.Net.on) G.Net.timeT = 0; say(G.keepInv ? 'Morendo si tiene l’inventario' : 'Morendo si perde tutto (gli oggetti restano dove muori)'); }
      else if (k === 'op' || k === 'deop') Cmd.run(`/${k} ${v}`);
      if (G.UI.open === 'strumenti') G.UI.renderPanel();
      return true;
    }
    let r = null;
    // operatore (non chi ospita): i comandi del mondo passano da chi ospita
    if (G.Net && G.Net.on && !G.Net.isHost) {
      const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
      const line = k === 'ora' ? '/ora ' + hm(TIMES[v]) : k === 'meteo' ? '/meteo ' + v : k === 'dir' ? `/vento ${G.WIND.level} ${v}` : k === 'luna' ? '/luna ' + v : k === 'mode' ? '/modalita ' + v : k === 'nemici' ? '/nemici ' + v : null;
      if (line) { Cmd.run(line); return true; }
    }
    if (k === 'ora') r = Cmd.setHour(TIMES[v]);
    else if (k === 'meteo') r = Cmd.setWeather(v);
    else if (k === 'dir') r = Cmd.setWind(null, v);
    else if (k === 'luna') r = Cmd.setMoon(v);
    else if (k === 'gorgo') { Cmd.run('/gorgo'); r = null; }
    else if (k === 'bioma') { r = Cmd.goBiome(v); G.UI.close(); }
    else if (k === 'vai') { r = Cmd.goPlace(v); G.UI.close(); }
    else if (k === 'vill') { const vv = G.POI.byId(b.dataset.tool.slice(5)); if (vv) { Cmd.reveal(vv); const p = P().pos, a = Math.atan2(vv.z - p.z, vv.x - p.x); r = Cmd.teleport(vv.x - Math.cos(a) * 26, vv.z - Math.sin(a) * 26, vv.name); G.UI.close(); } }
    else if (k === 'villaggi') r = Cmd.listVillages();
    else if (k === 'spawn') { r = Cmd.spawn(v, e.shiftKey ? 3 : 1); }
    else if (k === 'mode') { if (G.mode !== v) G.UI.toggleMode(); }
    else if (k === 'nemici') { Cmd.run('/nemici ' + v); }
    else if (k === 'cura') r = (Cmd.run('/cura'), null);
    if (r) say(r);
    if (G.UI.open === 'strumenti') G.UI.renderPanel();
    return true;
  }
  // cursori del pannello (orario e vento)
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.toolr || !Cmd.allowed()) return;
    if (G.Net && G.Net.on && !G.Net.isHost) { clearTimeout(Cmd._slT); Cmd._slT = setTimeout(() => { const h = +t.value; Cmd.run(t.dataset.toolr === 'ora' ? `/ora ${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : '/vento ' + t.value); }, 250); return; }
    if (t.dataset.toolr === 'ora') Cmd.setHour(+t.value);
    else if (t.dataset.toolr === 'vento') Cmd.setWind(+t.value, null);
  });
  document.addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.toolr && G.UI.open === 'strumenti') G.UI.renderPanel(); });
})();
