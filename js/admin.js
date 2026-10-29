/* =========================================================
   Menu Giocatori (P): chi ospita e gli operatori cambiano lo
   stato degli altri giocatori. Stato, poteri, spostamenti,
   inventario e abilità. Anche col comando /giocatore.
   ========================================================= */
(function () {
  const AD = (G.Admin = { sel: 'me', info: {}, logs: [] });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = () => G.Net;
  const net = () => !!(G.Net && G.Net.on);
  AD.allowed = () => !net() || G.Net.isHost || G.Net.op;
  AD.FLAGS = [['god', 'Invincibile'], ['pcreative', 'Creativa'], ['fly', 'Volo'], ['noNeeds', 'Fame e sete bloccate'], ['ghost', 'Invisibile ai nemici']];
  AD.STATS = [['health', 'Salute', 100, 'linear-gradient(90deg,#b8402e,#ec7a5c)'], ['hunger', 'Fame', 100, 'linear-gradient(90deg,#a8742c,#e0b062)'], ['thirst', 'Sete', 100, 'linear-gradient(90deg,#2c7fa8,#7cc6e0)'],
    ['stamina', 'Stamina', 0, 'linear-gradient(90deg,#9aa83a,#e3ea86)'], ['oxygen', 'Ossigeno', 100, 'linear-gradient(90deg,#8fd0e6,#e8f6fb)'], ['temp', 'Temperatura', 100, 'linear-gradient(90deg,#3b7fd0,#e8735a)']];

  /* ---------- su questo giocatore (eseguito da chi riceve) ---------- */
  const xpFor = (L) => { let x = 0; for (let i = 1; i < L; i++) x += G.Skills.need(i); return x; };
  AD.mine = function () {
    const P = G.Player;
    return { health: Math.round(P.health), hunger: Math.round(P.hunger), thirst: Math.round(P.thirst), stamina: Math.round(P.stamina === undefined ? 100 : P.stamina), staminaMax: P.staminaMax || 100,
      oxygen: Math.round(P.oxygen), temp: Math.round(P.temp === undefined ? 50 : P.temp), flags: { god: !!P.god, pcreative: !!P.pcreative, fly: !!P.allowFly, noNeeds: !!P.noNeeds, ghost: !!P.ghost },
      skills: Object.fromEntries(G.Skills.LIST.map((s) => [s.k, G.Skills.lv(s.k)])), inv: P.inv.map((s) => (s ? [s.id, s.n] : null)), pos: [Math.round(P.pos.x), Math.round(P.pos.y), Math.round(P.pos.z)], boat: !!P.boat, under: !!P.underground };
  };
  AD.apply = function (a, v, from) {
    const P = G.Player, who = from ? ` (${from})` : '';
    let msg = null;
    switch (a) {
      case 'set': {
        const k = v.k, n = +v.v; if (!isFinite(n)) break;
        if (k === 'stamina') P.stamina = Math.max(0, Math.min(P.staminaMax || 100, n));
        else if (k === 'temp') P.temp = Math.max(0, Math.min(100, n));
        else if (['health', 'hunger', 'thirst', 'oxygen'].includes(k)) { P[k] = Math.max(k === 'health' ? 1 : 0, Math.min(100, n)); }
        break;
      }
      case 'flag': {
        const on = !!v.v, k = v.k;
        if (k === 'god') { P.god = on; msg = on ? 'Ora sei invincibile' : 'Non sei più invincibile'; }
        else if (k === 'pcreative') { P.pcreative = on; if (!on) P.fly = P.allowFly ? P.fly : false; document.body.classList.toggle('creative', G.creative()); G.UI.refreshHotbar(); msg = on ? 'Sei in modalità creativa' : 'Sei tornato in sopravvivenza'; }
        else if (k === 'fly') { P.allowFly = on; if (!on && !G.creative()) P.fly = false; msg = on ? 'Puoi volare: doppio Spazio' : 'Non puoi più volare'; }
        else if (k === 'noNeeds') { P.noNeeds = on; msg = on ? 'Fame e sete bloccate' : 'Fame e sete tornano normali'; }
        else if (k === 'ghost') { P.ghost = on; msg = on ? 'I nemici non ti vedono' : 'I nemici tornano a vederti'; }
        break;
      }
      case 'skill': { const L = Math.max(1, Math.min(G.Skills.MAX, v.v | 0)); if (G.Skills.BY[v.k]) { G.Skills.xp[v.k] = xpFor(L); msg = `${G.Skills.BY[v.k].n}: livello ${L}`; } break; }
      case 'tp': { G.Cmd.teleport(+v.x, +v.z); if (isFinite(+v.y)) { P.pos.y = Math.max(P.pos.y, +v.y); P.vel.set(0, 0, 0); } msg = 'Sei stato teletrasportato'; break; }
      case 'bed': { const s = P.spawn; if (s) { G.Cmd.teleport(s.x, s.z); P.pos.y = Math.max(P.pos.y, s.y || 0); } else if (G.findSpawn) { const r = G.findSpawn(); G.Cmd.teleport(r.x, r.z); } msg = 'Sei stato riportato al tuo letto'; break; }
      case 'heal': P.health = P.hunger = P.thirst = P.oxygen = 100; P.temp = 50; P.stamina = P.staminaMax || 100; msg = 'Sei stato curato'; break;
      case 'clear': for (let i = 0; i < P.inv.length; i++) P.inv[i] = null; if (P.equip) for (let i = 0; i < P.equip.length; i++) P.equip[i] = null; G.UI.refreshHotbar(); msg = 'Il tuo inventario è stato svuotato'; break;
      case 'give': { const id = v.id, n = Math.max(1, Math.min(999, v.n | 0 || 1)); if (G.ITEMS[id]) { P.give(id, n, true); msg = `Hai ricevuto ${n} × ${G.ITEMS[id].n}`; } break; }
      case 'get': break;
    }
    if (msg && from) G.UI.toast(msg + who, 'good');
    G.saveSoon && G.saveSoon();
  };

  /* ---------- verso un giocatore (eseguito da chi comanda) ---------- */
  AD.send = function (id, a, v) {
    if (!AD.allowed()) { G.UI.toast('Solo chi ospita o un operatore può farlo', 'warn'); return false; }
    if (id === 'me' || !net()) { AD.apply(a, v || {}, null); AD.refresh(); return true; }
    G.Net.send({ t: 'padm', id, a, v: v || {} });
    setTimeout(() => AD.ask(id), 250);
    return true;
  };
  AD.ask = function (id) { if (net() && id !== 'me') G.Net.send({ t: 'padm', id, a: 'get', v: {} }); };
  // arrivano dal server
  AD.onCmd = function (m) {
    if (m.a !== 'get') AD.apply(m.a, m.v || {}, m.from);
    G.Net.send({ t: 'pinfo', to: m.fid, d: AD.mine() });
  };
  AD.onInfo = function (id, d) { AD.info[id] = Object.assign(d, { at: performance.now() }); if (G.UI.open === 'giocatori' && AD.sel === id) AD.refresh(); };
  const IT = { 'set ': '', 'flag ': '', 'skill ': 'abilità ', health: 'salute', hunger: 'fame', thirst: 'sete', oxygen: 'ossigeno', temp: 'temperatura', god: 'invincibile', pcreative: 'creativa', fly: 'volo', noNeeds: 'fame e sete bloccate', ghost: 'invisibile', true: 'sì', false: 'no', tp: 'teletrasporto', bed: 'al letto', heal: 'curato', clear: 'inventario svuotato', give: 'oggetto dato' };
  AD.log = function (text) { let t = String(text); for (const k in IT) t = t.split(k).join(IT[k]); G.Cmd && G.Cmd.log(t); };

  AD.list = function () {
    const out = [{ id: 'me', name: (G.settings.name || 'Tu'), slot: net() ? G.Net.slot : 0, me: true, host: !net() || G.Net.isHost, op: net() && G.Net.op }];
    if (net()) for (const r of G.Net.remotes.values()) out.push({ id: r.id, name: r.name, slot: r.slot, r, host: !!r.host, op: !!r.op });
    return out;
  };
  AD.byName = function (name) {
    const q = String(name || '').toLowerCase();
    if (!q || q === 'me' || q === 'io' || q === 'tu') return AD.list()[0];
    const l = AD.list(); return l.find((p) => p.name.toLowerCase() === q) || l.find((p) => p.name.toLowerCase().startsWith(q)) || null;
  };
  const dist = (p) => { if (p.me) return ''; const P = G.Player, r = p.r; if (!r || !r.pos) return ''; const d = Math.hypot(r.pos.x - P.pos.x, r.pos.z - P.pos.z); return d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1).replace('.', ',') + ' km'; };

  /* ---------- pannello ---------- */
  let askT = 0;
  AD.update = function (dt) {
    if (G.UI.open !== 'giocatori') return;
    if ((askT -= dt) <= 0) { askT = 1.5; if (AD.sel !== 'me') AD.ask(AD.sel); else AD.refresh(true); }
  };
  AD.refresh = function (soft) {
    if (G.UI.open !== 'giocatori') return;
    const pn = document.getElementById('panel'); if (!pn) return;
    if (soft && pn.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
    G.UI.renderPanel();
  };
  AD.render = function () {
    const COL = (G.Net && G.Net.COLOR_CSS) || ['#e7b04a', '#5fb0e0', '#93c47d', '#d27ad6'];
    const list = AD.list(); if (!list.find((p) => p.id === AD.sel)) AD.sel = 'me';
    const cur = list.find((p) => p.id === AD.sel), d = cur.me ? AD.mine() : AD.info[cur.id];
    const ok = AD.allowed();
    let h = `<div class="adm"><h2>Giocatori <small>${ok ? 'tasto P · anche con /giocatore Nome cosa valore' : 'solo chi ospita o un operatore può cambiare i giocatori'}</small></h2><div class="adlist">`;
    for (const p of list) h += `<button class="adp ${p.id === AD.sel ? 'on' : ''}" data-adsel="${p.id}"><i style="background:${COL[p.slot % 4]}"></i><div>${esc(p.name)}<small>${p.me ? 'tu' + (p.host && net() ? ' · chi ospita' : '') : dist(p)}</small></div>${p.host ? '<span class="tag h">HOST</span>' : p.op ? '<span class="tag">OP</span>' : '<span></span>'}</button>`;
    if (!net()) h += `<div class="adnote">Gioca con gli amici per vederli qui. Intanto puoi cambiare te stesso.</div>`;
    h += `</div><div class="addet">`;
    if (!d) { h += `<div class="adbox" style="grid-column:1/-1">Sto chiedendo i dati a ${esc(cur.name)}…</div></div></div>`; return h; }
    const nm = cur.me ? 'tuo' : 'di ' + esc(cur.name), dis = ok ? '' : 'disabled';
    h += `<div class="adbox"><h4>${cur.me ? 'Il tuo stato' : 'Stato ' + nm}</h4>`;
    for (const [k, n, mx0, col] of AD.STATS) {
      const mx = k === 'stamina' ? d.staminaMax || 100 : mx0, v = d[k];
      const lab = k === 'temp' ? (G.Climate && G.Climate.bodyLabel ? G.Climate.bodyLabel(v) : v) : v;
      h += `<label class="adrow">${n}<input type="range" min="0" max="${mx}" value="${v}" data-adset="${k}" style="--c:${col};--p:${(v / mx) * 100}%" ${dis}><em>${lab}</em></label>`;
    }
    h += `</div><div class="adbox"><h4>Poteri</h4><div class="adtg">`;
    for (const [k, n] of AD.FLAGS) h += `<button class="adt" data-adflag="${k}" ${dis}><span class="sw ${d.flags[k] ? 'on' : ''}"></span>${n}</button>`;
    if (!cur.me && net()) h += `<button class="adt" data-adop="${cur.id}" ${G.Net.isHost ? '' : 'disabled'}><span class="sw ${cur.op ? 'on' : ''}"></span>Operatore</button>`;
    h += `</div><h4>Spostamenti</h4><div class="adbtns">`;
    if (!cur.me) h += `<button class="adb" data-ada="bring" ${dis}>Portalo da me</button><button class="adb" data-ada="goto" ${dis}>Vai da lui</button>`;
    h += `<button class="adb" data-ada="bed" ${dis}>Al ${cur.me ? 'tuo' : 'suo'} letto</button><span class="adxy"><input id="adx" placeholder="X" inputmode="numeric" ${dis}><input id="adz" placeholder="Z" inputmode="numeric" ${dis}><button class="adb" data-ada="xy" ${dis}>Vai</button></span></div>`;
    h += `<h4>Inventario</h4><div class="adbtns"><span class="adxy"><input id="adit" list="aditems" placeholder="oggetto" ${dis}><input id="adn" placeholder="n" value="1" inputmode="numeric" style="width:46px" ${dis}><button class="adb" data-ada="give" ${dis}>Dai</button></span>
      <button class="adb" data-ada="heal" ${dis}>Cura tutto</button><button class="adb w" data-ada="clear" ${dis}>Svuota inventario</button>${!cur.me && net() && G.Net.isHost && !cur.host ? `<button class="adb w" data-ada="kick">Espelli</button>` : ''}</div>`;
    const inv = (d.inv || []).filter(Boolean);
    h += `<div class="adinv">${inv.length ? inv.map(([id, n]) => `<span title="${esc(G.ITEMS[id] ? G.ITEMS[id].n : id)}"><img src="${G.icon(id)}" alt="">${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('') : '<small>inventario vuoto</small>'}</div></div>`;
    h += `<div class="adbox" style="grid-column:1/-1"><h4>${cur.me ? 'Le tue abilità' : 'Abilità ' + nm}</h4><div class="adsk">`;
    for (const s of G.Skills.LIST) h += `<div class="ads">${s.n}<div class="adst"><button data-adsk="${s.k}" data-d="-1" ${dis}>−</button><b>${d.skills[s.k] || 1}</b><button data-adsk="${s.k}" data-d="1" ${dis}>+</button></div></div>`;
    h += `</div></div></div><div class="adfoot"><span>${cur.me ? 'Le modifiche valgono subito' : `Le modifiche arrivano subito a ${esc(cur.name)}`}${d.pos ? ` · X ${d.pos[0]} · Z ${d.pos[2]}${d.boat ? ' · in barca' : d.under ? ' · sottoterra' : ''}` : ''}</span><span>Esc o P per chiudere</span></div></div>`;
    h += `<datalist id="aditems">${Object.keys(G.ITEMS).map((k) => `<option value="${esc(G.ITEMS[k].n)}">`).join('')}</datalist>`;
    return h;
  };
  const itemId = (s) => { const q = String(s || '').toLowerCase().trim(); if (G.ITEMS[q.replace(/ /g, '_')]) return q.replace(/ /g, '_'); return Object.keys(G.ITEMS).find((k) => G.ITEMS[k].n.toLowerCase() === q) || Object.keys(G.ITEMS).find((k) => G.ITEMS[k].n.toLowerCase().startsWith(q)) || null; };
  AD.click = function (e) {
    const t = e.target.closest('[data-adsel],[data-adflag],[data-ada],[data-adsk],[data-adop]'); if (!t || t.disabled) return !!e.target.closest('input,select');
    const id = AD.sel, list = AD.list(), cur = list.find((p) => p.id === id);
    if (t.dataset.adsel) { AD.sel = t.dataset.adsel; if (AD.sel !== 'me') AD.ask(AD.sel); G.UI.renderPanel(); return true; }
    const d = cur.me ? AD.mine() : AD.info[id]; if (!d) return true;
    if (t.dataset.adflag) { const k = t.dataset.adflag; AD.send(id, 'flag', { k, v: !d.flags[k] }); if (!cur.me) { d.flags[k] = !d.flags[k]; G.UI.renderPanel(); } return true; }
    if (t.dataset.adop) { const r = G.Net.remotes.get(t.dataset.adop); if (r) { G.Net.setOp(r.id, !r.op); G.UI.renderPanel(); } return true; }
    if (t.dataset.adsk) { const k = t.dataset.adsk, L = Math.max(1, Math.min(G.Skills.MAX, (d.skills[k] || 1) + +t.dataset.d)); d.skills[k] = L; AD.send(id, 'skill', { k, v: L }); G.UI.renderPanel(); return true; }
    const a = t.dataset.ada, P = G.Player;
    if (a === 'bring') { const f = P.pos, yaw = P.yaw; AD.send(id, 'tp', { x: f.x - Math.sin(yaw) * 2, y: f.y, z: f.z - Math.cos(yaw) * 2 }); G.UI.toast(`${cur.name} sta arrivando`, 'good'); }
    else if (a === 'goto') { const r = cur.r; if (r && r.pos) { G.UI.close(); G.Cmd.tpTo(cur.name); } }
    else if (a === 'bed') AD.send(id, 'bed', {});
    else if (a === 'xy') { const x = +document.getElementById('adx').value, z = +document.getElementById('adz').value; if (isFinite(x) && isFinite(z) && document.getElementById('adx').value !== '') { AD.send(id, 'tp', { x, z }); if (cur.me) G.UI.close(); } else G.UI.toast('Scrivi X e Z', 'warn'); }
    else if (a === 'give') { const it = itemId(document.getElementById('adit').value), n = +document.getElementById('adn').value || 1; if (!it) G.UI.toast('Oggetto non trovato', 'warn'); else { AD.send(id, 'give', { id: it, n }); G.UI.toast(`${n} × ${G.ITEMS[it].n} a ${cur.name}`, 'good'); } }
    else if (a === 'heal') AD.send(id, 'heal', {});
    else if (a === 'clear') { if (t.dataset.sure) { AD.send(id, 'clear', {}); } else { t.dataset.sure = 1; t.textContent = 'Sicuro? Clicca di nuovo'; return true; } }
    else if (a === 'kick') { if (t.dataset.sure) { G.Net.send({ t: 'padm', id, a: 'kick', v: {} }); AD.sel = 'me'; setTimeout(() => G.UI.renderPanel(), 400); } else { t.dataset.sure = 1; t.textContent = 'Espellere davvero?'; return true; } }
    if (cur.me) setTimeout(() => G.UI.renderPanel(), 30);
    return true;
  };
  AD.mount = function () {
    const pn = document.getElementById('panel'); if (!pn) return;
    pn.querySelectorAll('input[data-adset]').forEach((el) => {
      el.addEventListener('input', () => { el.style.setProperty('--p', (el.value / el.max) * 100 + '%'); const em = el.parentNode.querySelector('em'); if (em) em.textContent = el.dataset.adset === 'temp' && G.Climate && G.Climate.bodyLabel ? G.Climate.bodyLabel(+el.value) : el.value; });
      el.addEventListener('change', () => { const d = AD.sel === 'me' ? null : AD.info[AD.sel]; if (d) d[el.dataset.adset] = +el.value; AD.send(AD.sel, 'set', { k: el.dataset.adset, v: +el.value }); });
    });
    pn.querySelectorAll('input:not([type=range])').forEach((el) => el.addEventListener('keydown', (e) => e.stopPropagation()));
  };
  AD.open = function () {
    if (!AD.allowed()) { G.UI.toast('Il menu Giocatori è per chi ospita e per gli operatori', 'warn'); return; }
    if (AD.sel !== 'me') AD.ask(AD.sel);
    G.UI.openCustom('giocatori');
  };
})();
