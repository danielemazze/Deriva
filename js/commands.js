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

  Cmd.allowed = () => !(G.Net && G.Net.on && !G.Net.isHost);
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
  Cmd.goPlace = function (type) {
    const map = { faro: 'faro', fari: 'faro', relitto: 'relitto', covo: 'covo', pirati: 'covo', rovina: 'rovina', rovine: 'rovina', miniera: 'miniera', accampamento: 'accampamento' };
    const t = map[norm(type)]; if (!t) return null;
    const p = P().pos, l = G.POI.near(p.x, p.z, 5000, t).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    if (!l.length) return `Nessun ${type} trovato entro 5 km`;
    const v = l[0]; Cmd.reveal(v);
    if (t === 'relitto') return Cmd.teleport(v.x + 6, v.z, v.name);
    const a = Math.atan2(v.z - p.z, v.x - p.x);
    return Cmd.teleport(v.x - Math.cos(a) * 16, v.z - Math.sin(a) * 16, v.name);
  };
  // comparsa: animali e nemici (anche pirati), oppure un abitante
  Cmd.SPAWN = { gallina: 'gallina', galline: 'gallina', pecora: 'pecora', pecore: 'pecora', mucca: 'mucca', mucche: 'mucca', maiale: 'maiale', maiali: 'maiale', coniglio: 'coniglio', conigli: 'coniglio', tartaruga: 'tartaruga',
    lupo: 'lupo', lupi: 'lupo', giaguaro: 'giaguaro', serpente: 'serpente', orso: 'orso', coccodrillo: 'coccodrillo', squalo: 'squalo', pirata: 'pirata', pirati: 'pirata', capitano: 'capitano' };
  Cmd.spawn = function (what, n) {
    const p = P(); n = Math.max(1, Math.min(12, n | 0 || 1));
    const w = norm(what);
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
    ['/vai faro · relitto · covo · rovina · miniera · accampamento', 'vai al luogo più vicino'],
    ['/spawn lupo 3 · /spawn pecora · /spawn pirata · /spawn abitante', 'fa comparire animali, nemici, abitanti'],
    ['/tp 120 -340', 'teletrasporto alle coordinate'],
    ['/modalita creativa · sopravvivenza', 'cambia modalità (anche F4)'],
    ['/nemici si · no', 'attiva o disattiva i nemici'],
    ['/dai assi 64 · /cura · /gorgo', 'oggetti · salute piena · gorgo qui vicino'],
  ];
  Cmd.run = function (line) {
    line = String(line || '').trim(); if (!line) return;
    if (line[0] !== '/') { if (G.Net && G.Net.on) { G.Net.send({ t: 'chat', text: line }); } else Cmd.log(line); return; }
    Cmd.history.push(line); if (Cmd.history.length > 30) Cmd.history.shift(); Cmd.hi = -1;
    const parts = line.slice(1).split(/\s+/), c = norm(parts.shift()), rest = parts.join(' ');
    if (c === 'aiuto' || c === 'help' || c === '?') { Cmd.log('Comandi:'); for (const [a, b] of HELP) Cmd.log(`${a} — ${b}`); return; }
    if (!Cmd.allowed()) { say('In questa partita i comandi li usa solo chi ospita', 'warn'); return; }
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
    return `<div class="toolsp"><h3>Strumenti<small>${allowed ? 'comandi del mondo · anche dalla console con T o /' : 'li usa solo chi ospita'}</small></h3>
      <div class="tgrid">
      <section><h4>Orario <span class="tval">${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.floor((hh % 1) * 60)).padStart(2, '0')}</span></h4>
        <div class="tbtns">${Object.entries({ alba: 'Alba', mattina: 'Mattina', mezzogiorno: 'Mezzogiorno', tramonto: 'Tramonto', sera: 'Sera', notte: 'Notte' }).map(([k, n]) => btn('ora:' + k, n)).join('')}</div>
        <input type="range" min="0" max="23.75" step="0.25" value="${hh.toFixed(2)}" data-toolr="ora" ${allowed ? '' : 'disabled'}></section>
      <section><h4>Meteo <span class="tval">${Cl.KINDS[Cl.state.kind].icon} ${Cl.KINDS[Cl.state.kind].n}${Cl.state.lock ? ' · fisso' : ' · variabile'}</span></h4>
        <div class="tbtns">${Object.entries(Cl.KINDS).map(([k, v]) => btn('meteo:' + k, v.icon + ' ' + v.n, Cl.state.kind === k)).join('')}${btn('meteo:auto', '↻ Variabile', !Cl.state.lock)}</div></section>
      <section><h4>Vento <span class="tval">${G.WIND.level} · da ${Cl.dirName(G.Boats.wind.dir)}${Cl.cur.wind ? ` · col meteo ${Math.round(Cl.windLevel())}` : ''}</span></h4>
        <input type="range" min="0" max="10" step="1" value="${G.WIND.level}" data-toolr="vento" ${allowed ? '' : 'disabled'}>
        <div class="tbtns rose">${Cl.DIR_N.map((d) => btn('dir:' + d, d, Cl.dirName(G.Boats.wind.dir) === d)).join('')}</div>
        <div class="tbtns">${btn('gorgo', '🌀 Gorgo qui davanti')}</div></section>
      <section><h4>Luna <span class="tval">${Cl.PHASE_ICON[Cl.moonIndex()]} ${Cl.moonName()}</span></h4>
        <div class="tbtns moon">${Cl.PHASES.map((n, i) => btn('luna:' + i, Cl.PHASE_ICON[i], Cl.moonIndex() === i, `title="${n}"`)).join('')}</div></section>
      <section><h4>Vai al bioma</h4>
        <div class="tbtns">${[['pianura', 'Pianura'], ['foresta', 'Foresta'], ['pluviale', 'Pluviale'], ['giungla', 'Giungla'], ['deserto', 'Deserto'], ['montagna', 'Montagna'], ['neve', 'Neve'], ['vulcano', 'Vulcano']].filter(([k]) => G.BIOME[Cmd.BIOMES[k]] !== undefined).map(([k, n]) => btn('bioma:' + k, n)).join('')}</div>
        <h4 style="margin-top:10px">Vai al luogo</h4>
        <div class="tbtns">${[['faro', 'Faro'], ['relitto', 'Relitto'], ['covo', 'Covo'], ['rovina', 'Rovina'], ['miniera', 'Miniera'], ['accampamento', 'Accampamento']].map(([k, n]) => btn('vai:' + k, n)).join('')}</div></section>
      <section><h4>Villaggi vicini</h4>
        <div class="vlist">${vl.map((v) => `<div><span>${esc(v.name)} <small>${esc(v.style)} · ${Math.round(Math.hypot(v.x - p.x, v.z - p.z))} m</small></span>${btn('vill:' + v.id, 'Vai')}</div>`).join('') || '<p class="note">Nessun villaggio entro 5 km</p>'}</div>
        ${btn('villaggi', 'Segna tutti sulla mappa')}</section>
      <section class="wide2"><h4>Fai comparire</h4>
        <div class="tbtns">${sp.filter((s) => G.SPECIES[s]).map((s) => btn('spawn:' + s, G.SPECIES[s].n, false, G.isHostile(s) ? 'data-hostile="1"' : '')).join('')}${btn('spawn:abitante', 'Abitante')}${btn('spawn:mercante', 'Mercante')}</div></section>
      <section><h4>Modalità e nemici</h4>
        <div class="tbtns">${btn('mode:sopravvivenza', 'Sopravvivenza', !G.creative())}${btn('mode:creativa', 'Creativa', G.creative())}</div>
        <div class="tbtns">${btn('nemici:si', 'Nemici sì', !G.enemiesOff)}${btn('nemici:no', 'Nemici no', !!G.enemiesOff)}${btn('cura', 'Cura')}</div></section>
      </div><p class="note">Console: premi <kbd>T</kbd> o <kbd>/</kbd> e scrivi /aiuto. Pannello: <kbd>K</kbd>.</p></div>`;
  }
  function clickPanel(e) {
    const b = e.target.closest('[data-tool]'); if (!b || b.disabled) return !!e.target.closest('input[type=range]');
    const [k, v] = b.dataset.tool.split(':');
    let r = null;
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
    if (t.dataset.toolr === 'ora') Cmd.setHour(+t.value);
    else if (t.dataset.toolr === 'vento') Cmd.setWind(+t.value, null);
  });
  document.addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.toolr && G.UI.open === 'strumenti') G.UI.renderPanel(); });
})();
