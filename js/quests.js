'use strict';
/* ==========================================================
   Abitanti: dialoghi, missioni (★ / ★★ / ★★★), mercanti,
   locandieri, voci che rivelano luoghi; tesori sepolti.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const Q = (G.Quests = {});
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = () => G.Player;
  const ITEM = (id) => G.ITEMS[id];
  const dirName = (dx, dz) => { const a = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360; return ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'][Math.round(a / 45) % 8]; };
  Q.dirName = dirName;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const ROLE_N = { capo: 'capovillaggio', mercante: 'mercante', locandiere: 'oste', abitante: 'abitante' };

  /* ---------------- missioni offerte da un villaggio ---------------- */
  const GATHER = {
    coloniale: [['pesce_cotto', 4, 8], ['polpa_cactus', 5, 10], ['conchiglia', 4, 8], ['perla', 1, 2], ['corda', 4, 8]],
    alberi: [['cocco', 4, 8], ['pesce_crudo', 5, 9], ['foglie', 10, 20], ['funghi', 4, 8]],
    palafitte: [['pesce_crudo', 6, 10], ['fibra', 12, 24], ['funghi', 4, 8], ['foglie', 10, 20]],
    fattoria: [['lana', 4, 8], ['uovo', 4, 8], ['assi', 10, 20], ['bacche', 6, 12]],
    baite: [['tronco', 8, 16], ['pelle', 2, 4], ['funghi', 5, 9], ['manzo_cotto', 3, 5]],
    pietra: [['pietra', 15, 30], ['lana', 4, 8], ['pelle', 2, 4], ['montone_cotto', 3, 5]],
  };
  const HUNT = { coloniale: 'serpente', alberi: 'giaguaro', palafitte: 'coccodrillo', fattoria: 'lupo', baite: 'lupo', pietra: 'orso' };
  function rewardFor(stars, rnd) {
    const dob = stars === 1 ? 8 + ((rnd() * 8) | 0) : stars === 2 ? 20 + ((rnd() * 20) | 0) : 50 + ((rnd() * 40) | 0);
    const pool = stars === 1 ? [['freccia', 10], ['pesce_cotto', 4], ['corda', 4], ['torcia', 4], ['ciotola_acqua', 2]]
      : stars === 2 ? [['arco', 1], ['lancia', 1], ['pala', 1], ['progetto_canoa', 1], ['munizioni', 6], ['mappa_tesoro', 1]]
        : [['pistola', 1], ['sciabola', 1], ['progetto_catamarano', 1], ['progetto_galeone', 1], ['vela_leggendaria', 1], ['pinne', 1], ['cannocchiale', 1], ['bussola_oro', 1]];
    return { dob, item: pool[(rnd() * pool.length) | 0] };
  }
  Q.offers = function (v) {
    const epoch = Math.floor(G.time / 2);
    const rnd = G.mulberry32(hashS(v.id + ':' + epoch) ^ G.seed);
    const out = [];
    const style = v.style;
    const near = (type, r) => G.POI.near(v.x, v.z, r, type).filter((p) => p.id !== v.id);
    const types = ['raccolta', 'caccia', 'consegna', 'esplora', 'pirati'];
    for (let i = 0; i < 3; i++) {
      const id = `${v.id}:${epoch}:${i}`;
      let tp = types[(rnd() * types.length) | 0], q = null;
      for (let tries = 0; tries < 5 && !q; tries++) {
        if (tp === 'raccolta') {
          const g = GATHER[style][(rnd() * GATHER[style].length) | 0], n = g[1] + ((rnd() * (g[2] - g[1] + 1)) | 0);
          const stars = g[0] === 'perla' || g[0] === 'pelle' || n > 15 ? 2 : 1;
          q = { type: tp, stars, item: g[0], n, title: `Servono ${n} × ${ITEM(g[0]).n}`, desc: `Portami ${n} × ${ITEM(g[0]).n.toLowerCase()} e ti ricompenserò.` };
        } else if (tp === 'caccia' && !G.enemiesOff) {
          const sp = HUNT[style], n = sp === 'orso' || sp === 'coccodrillo' ? 1 : 2 + ((rnd() * 2) | 0);
          q = { type: tp, stars: sp === 'orso' || sp === 'coccodrillo' ? 3 : 2, sp, n, title: `Caccia: ${n} × ${G.SPECIES[sp].n.toLowerCase()}`, desc: `${G.SPECIES[sp].n} ${n > 1 ? 'si aggirano' : 'si aggira'} vicino al villaggio. Abbattine ${n} e torna da me.` };
        } else if (tp === 'consegna') {
          const vs = near('village', 1700).filter((p) => p.inhabited && dist(p, v) > 250);
          if (vs.length) { const t = vs[(rnd() * vs.length) | 0], d = dist(t, v); q = { type: tp, stars: d > 1000 ? 3 : d > 550 ? 2 : 1, to: t.id, title: `Consegna a ${t.name}`, desc: `Porta questo pacco al villaggio di ${t.name}, a circa ${Math.round(d / 50) * 50} m verso ${dirName(t.x - v.x, t.z - v.z)}. Parla con chiunque laggiù.` }; }
        } else if (tp === 'esplora') {
          const ps = near(null, 1400).filter((p) => (p.type === 'faro' || p.type === 'relitto') && !(P().discovered || {})[p.id]);
          if (ps.length) { const t = ps[(rnd() * ps.length) | 0], d = dist(t, v); q = { type: tp, stars: t.type === 'relitto' ? 2 : 1, to: t.id, title: t.type === 'faro' ? `Raggiungi il ${t.name}` : `Trova il relitto ${t.ship}`, desc: `${t.type === 'faro' ? 'Il ' + t.name + ' è' : 'Si dice che il relitto della ' + t.ship + ' sia'} a circa ${Math.round(d / 50) * 50} m verso ${dirName(t.x - v.x, t.z - v.z)}${t.type === 'relitto' ? ', sul fondale' : ''}. Vai a vedere: la ricompensa sarà tua appena lo trovi.` }; }
        } else if (tp === 'pirati' && !G.enemiesOff) {
          const ks = near('covo', 1700);
          if (ks.length) { const t = ks[(rnd() * ks.length) | 0], d = dist(t, v); q = { type: tp, stars: 3, to: t.id, title: 'Libera la costa dai pirati', desc: `C'è un covo di pirati a circa ${Math.round(d / 50) * 50} m verso ${dirName(t.x - v.x, t.z - v.z)}. Sconfiggi tutti i pirati e il loro capitano, poi torna da me.` }; }
        }
        if (!q) tp = 'raccolta';
      }
      q.id = id; q.vid = v.id; q.from = v.name;
      q.reward = rewardFor(q.stars, rnd);
      out.push(q);
    }
    return out;
  };
  const active = () => (P().quests = P().quests || []);
  const done = () => (P().questsDone = P().questsDone || {});
  Q.isReady = function (q) {
    const p = P();
    if (q.type === 'raccolta') return p.count(q.item) >= q.n;
    if (q.type === 'caccia') return ((p.kills || {})[q.sp] || 0) - (q.base || 0) >= q.n;
    if (q.type === 'pirati') return Q.pirateCampCleared(q.to);
    return !!q.ready;
  };
  Q.pirateCampCleared = function (cid) {
    const c = G.POI.byId(cid); if (!c) return false;
    const cx = Math.floor(c.x / G.CHUNK), cz = Math.floor(c.z / G.CHUNK);
    const ids = G.animalSpawns(cx, cz).filter((s) => s.sp === 'pirata' || s.sp === 'capitano').map((s) => s.id);
    const killed = G.state.killed || new Set();
    return ids.length > 0 && ids.every((id) => killed.has(id));
  };
  Q.accept = function (q) {
    const list = active();
    if (list.length >= 4) { G.UI.toast('Hai già 4 missioni attive: completane una prima', 'warn'); return; }
    if (list.some((x) => x.id === q.id)) return;
    const a = Object.assign({}, q, { t0: G.time });
    if (q.type === 'caccia') a.base = (P().kills || {})[q.sp] || 0;
    if (q.type === 'consegna') { if (!P().giveStack({ id: 'pacco', n: 1, d: { to: q.to, q: q.id } })) { G.UI.toast('Inventario pieno', 'warn'); return; } }
    if (q.type === 'esplora' && (P().discovered || {})[q.to]) a.ready = true;
    list.push(a);
    G.UI.toast(`Missione accettata: ${q.title}`, 'good');
    G.saveSoon();
  };
  Q.complete = function (q) {
    const p = P();
    if (q.type === 'raccolta') p.take(q.item, q.n);
    const list = active(); const i = list.findIndex((x) => x.id === q.id); if (i >= 0) list.splice(i, 1);
    done()[q.id] = 1;
    p.give('doblone', q.reward.dob);
    const [it, n] = q.reward.item;
    if (G.RARE.includes(it) && ((p.rareFound || {})[it] || p.count(it) > 0)) p.give('doblone', 40); else p.give(it, n);
    p.stats = p.stats || {}; p.stats.quests = (p.stats.quests || 0) + 1;
    G.UI.toast(`Missione completata: ${q.title} · +${q.reward.dob} dobloni`, 'good');
    if (G.Audio) G.Audio.coins();
    G.saveSoon();
  };
  Q.onKill = function () { for (const q of active()) if ((q.type === 'caccia' || q.type === 'pirati') && Q.isReady(q) && !q.told) { q.told = true; G.UI.toast(`Missione pronta: torna a ${q.from}`, 'good'); } };
  Q.onDiscover = function (poi) {
    for (const q of active().slice()) if (q.type === 'esplora' && q.to === poi.id && !q.ready) { q.ready = true; Q.complete(q); }
  };
  Q.stars = (n) => '★'.repeat(n) + '<span class="soft">' + '★'.repeat(3 - n) + '</span>';

  /* ---------------- commercio ---------------- */
  const SHOP = {
    base: [['freccia', 8, 3], ['munizioni', 4, 6], ['pala', 1, 12], ['mappa_tesoro', 1, 35], ['corda', 4, 3], ['torcia', 4, 2]],
    coloniale: [['pistola', 1, 95], ['sciabola', 1, 45], ['cannocchiale', 1, 140], ['progetto_catamarano', 1, 120], ['progetto_galeone', 1, 420], ['cannone', 1, 30], ['stoffa', 4, 5]],
    alberi: [['arco', 1, 20], ['freccia', 16, 5], ['cocco', 3, 2], ['progetto_canoa', 1, 30], ['pinne', 1, 160]],
    palafitte: [['lancia', 1, 12], ['canna', 1, 6], ['pesce_cotto', 3, 3], ['progetto_canoa', 1, 30]],
    fattoria: [['manzo_cotto', 2, 4], ['lana', 4, 3], ['stoffa', 4, 4], ['uovo', 4, 2], ['letto', 1, 15]],
    baite: [['arco', 1, 22], ['ascia', 1, 6], ['montone_cotto', 2, 4], ['progetto_catamarano', 1, 120]],
    pietra: [['piccone', 1, 6], ['lancia', 1, 12], ['munizioni', 6, 8], ['bussola_oro', 1, 180]],
    oste: [['pesce_cotto', 2, 3], ['manzo_cotto', 2, 5], ['funghi_cotti', 2, 3], ['ciotola_acqua', 1, 2], ['pollo_cotto', 2, 4]],
  };
  const SELL = { pelle: 4, dente_squalo: 6, perla: 15, conchiglia: 1, lana: 1, pesce_cotto: 1, pesce_crudo: 1, cocco: 1, polpa_cactus: 1, funghi: 1, sciabola: 18, pistola: 40, lancia: 4, arco: 8, cannone: 12, munizioni: 1, piume: 1, uovo: 1, tronco: 1, assi: 1 };
  Q.stock = (npc) => npc.def.role === 'locandiere' ? SHOP.oste : SHOP.base.concat(SHOP[npc.village.style] || []);

  /* ---------------- voci ---------------- */
  Q.rumor = function (npc) {
    const v = npc.village, disc = P().discovered || {}, rev = (P().revealed = P().revealed || {});
    const cand = G.POI.near(v.x, v.z, 1500).filter((p) => p.id !== v.id && !disc[p.id]);
    const rnd = G.mulberry32(hashS(npc.def.id + Math.floor(G.time)) ^ G.seed);
    if (!cand.length || rnd() < 0.15) {
      const lines = ['Dicono che nelle casse dei relitti ci siano mappe del tesoro. Con una pala, la X si scava.', 'I pirati non lasciano mai il loro forziere incustodito.', 'Di notte i fari si vedono da lontanissimo: seguili se ti perdi.', 'Il vento forte gonfia le vele, ma il mare grosso fa ballare le barche piccole.', 'Chi trova la bussola d’oro non si perde mai: punta sempre verso qualcosa di nuovo.', 'Con il fieno sotto, anche un salto dal campanile è sicuro… o così dicono.'];
      return lines[(rnd() * lines.length) | 0];
    }
    const p = cand[(rnd() * cand.length) | 0], d = dist(p, v);
    rev[p.id] = 1;
    const where = `a circa ${Math.round(d / 50) * 50} m verso ${dirName(p.x - v.x, p.z - v.z)}`;
    G.saveSoon();
    if (p.type === 'village') return `Un mio cugino vive a ${p.name}, ${where}. ${p.inhabited ? 'Gente ospitale.' : 'Ma ho sentito che ora è abbandonato… e che ci girano i pirati.'} (segnato sulla mappa)`;
    if (p.type === 'faro') return `Il ${p.name} si trova ${where}. Il guardiano se n’è andato da anni: chissà cosa ha lasciato lassù. (segnato sulla mappa)`;
    if (p.type === 'relitto') return `I pescatori parlano di un relitto, la ${p.ship}, ${where}. Sta sul fondo: serve fiato. (segnato sulla mappa)`;
    if (p.type === 'covo') return `Attento! C’è un covo di pirati ${where}. Hanno un forziere pieno d’oro. (segnato sulla mappa)`;
    return 'Il mare è grande, straniero.';
  };

  /* ---------------- dialogo (pannello) ---------------- */
  const GREET = { capo: ['Benvenuto, viaggiatore. Il villaggio ha bisogno di mani capaci.', 'Arrivi dal mare? Allora forse puoi aiutarci.'], mercante: ['Merce dai sette mari! Paghi in dobloni.', 'Dai un’occhiata, straniero. Prezzi onesti… quasi.'], locandiere: ['Un letto, un piatto caldo, un bicchiere d’acqua fresca?', 'Benvenuto alla locanda! Riposati quanto vuoi.'], abitante: ['Buongiorno!', 'Bel tempo per navigare, eh?', 'Non ti ho mai visto da queste parti.'] };
  Q.talk = function (npc) {
    Q.cur = npc; Q.tab = npc.def.role === 'mercante' ? 'compra' : npc.def.role === 'capo' ? 'missioni' : 'parla';
    Q.line = GREET[npc.def.role][(Math.random() * GREET[npc.def.role].length) | 0];
    npc.talking = 9999;
    // consegna di un pacco destinato a questo villaggio
    const pk = P().inv.findIndex((s) => s && s.id === 'pacco' && s.d && s.d.to === npc.village.id);
    if (pk >= 0) {
      const qid = P().inv[pk].d.q, q = active().find((x) => x.id === qid);
      P().inv[pk] = null; G.UI.refreshHotbar();
      if (q) { q.ready = true; Q.complete(q); Q.line = 'Un pacco per noi? Grazie, era atteso da giorni! Ecco la tua ricompensa.'; }
    }
    G.UI.openCustom('npc');
  };
  Q.close = function () { if (Q.cur) Q.cur.talking = 0.5; Q.cur = null; };
  Q.render = function () {
    const n = Q.cur; if (!n) return '';
    const role = n.def.role, v = n.village;
    const tabs = [];
    if (role === 'capo') tabs.push(['missioni', 'Missioni']);
    if (role === 'mercante' || role === 'locandiere') tabs.push(['compra', 'Compra'], ['vendi', 'Vendi']);
    tabs.push(['parla', role === 'abitante' ? 'Chiacchiera' : 'Voci']);
    if (role === 'locandiere') tabs.push(['riposa', 'Riposa']);
    let body = '';
    const dob = P().count('doblone');
    if (Q.tab === 'missioni') {
      const mine = active().filter((q) => q.vid === v.id);
      const offers = Q.offers(v).filter((q) => !done()[q.id] && !mine.some((m) => m.id === q.id));
      const row = (q, own) => {
        const ready = own && Q.isReady(q);
        const status = own ? (q.type === 'consegna' ? 'consegna il pacco a destinazione' : q.type === 'esplora' ? 'in corso' : ready ? 'pronta da consegnare' : q.type === 'raccolta' ? `${Math.min(P().count(q.item), q.n)}/${q.n}` : q.type === 'caccia' ? `${Math.min(((P().kills || {})[q.sp] || 0) - (q.base || 0), q.n)}/${q.n}` : 'in corso') : '';
        const btn = own ? (ready && q.type !== 'consegna' && q.type !== 'esplora' ? `<button class="mini-btn" data-q="done" data-id="${q.id}">Consegna</button>` : `<span class="qstat">${status}</span>`) : `<button class="mini-btn" data-q="take" data-id="${q.id}">Accetta</button>`;
        return `<div class="qrow"><div><div class="qt"><span class="stars">${Q.stars(q.stars)}</span> ${esc(q.title)}</div><div class="qd">${esc(q.desc)}</div>
          <div class="qr">Ricompensa: ${q.reward.dob} dobloni + ${q.reward.item[1] > 1 ? q.reward.item[1] + ' × ' : ''}${esc(ITEM(q.reward.item[0]).n)}</div></div>${btn}</div>`;
      };
      body = (mine.length ? '<h4>In corso</h4>' + mine.map((q) => row(q, true)).join('') : '') + '<h4>Disponibili</h4>' + (offers.map((q) => row(q, false)).join('') || '<p class="note">Nessuna missione per oggi. Torna tra un paio di giorni.</p>');
    } else if (Q.tab === 'compra') {
      body = `<div class="shop">${Q.stock(n).map(([id, k, price], i) => `<div class="srow ${dob >= price || G.creative() ? '' : 'no'}"><img src="${G.icon(id)}" alt=""><div><b>${k > 1 ? k + ' × ' : ''}${esc(ITEM(id).n)}</b><small>${esc(ITEM(id).d || '')}</small></div><button class="mini-btn" data-q="buy" data-i="${i}" ${dob >= price || G.creative() ? '' : 'disabled'}>${price} <img class="coin" src="${G.icon('doblone')}" alt="dobloni"></button></div>`).join('')}</div>`;
    } else if (Q.tab === 'vendi') {
      const have = [...new Set(P().inv.filter((s) => s && SELL[s.id]).map((s) => s.id))];
      body = have.length ? `<div class="shop">${have.map((id) => `<div class="srow"><img src="${G.icon(id)}" alt=""><div><b>${esc(ITEM(id).n)}</b><small>ne hai ${P().count(id)}</small></div><button class="mini-btn" data-q="sell" data-id="${id}">Vendi 1 · ${SELL[id]}</button><button class="mini-btn" data-q="sellall" data-id="${id}">Tutti</button></div>`).join('')}</div>` : '<p class="note">Non hai niente che mi interessi. Pelli, perle e denti di squalo li pago bene.</p>';
    } else if (Q.tab === 'riposa') {
      const h = (G.time * 24) % 24, night = h > 19.5 || h < 5;
      body = `<p>${night ? 'Il letto è pronto. Dormi fino al mattino: il tuo punto di rinascita sarà qui.' : 'Si dorme solo di notte, ma posso segnare questo letto come tuo punto di rinascita.'}</p><button class="mbtn primary" data-q="rest">${night ? 'Dormi fino al mattino' : 'Salva il punto di rinascita'}</button>`;
    } else {
      if (!Q.lineTalk) Q.lineTalk = Q.rumor(n);
      body = `<p class="rumor">«${esc(Q.lineTalk)}»</p><button class="mini-btn" data-q="again">Chiedi ancora</button>`;
    }
    return `<div class="npcpanel"><div class="nphead"><div><h3>${esc(n.def.name)}<small>${ROLE_N[n.def.role]} · ${esc(v.name)}</small></h3><p class="say">«${esc(Q.line)}»</p></div><div class="purse"><img src="${G.icon('doblone')}" alt=""> ${G.creative() ? '∞' : dob}</div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-q="tab" data-tab="${k}" class="${Q.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="npbody">${body}</div></div>`;
  };
  Q.click = function (e) {
    const b = e.target.closest('[data-q]'); if (!b || b.disabled) return false;
    const n = Q.cur, act = b.dataset.q;
    if (act === 'tab') { Q.tab = b.dataset.tab; Q.lineTalk = null; }
    else if (act === 'take') { const q = Q.offers(n.village).find((x) => x.id === b.dataset.id); if (q) Q.accept(q); }
    else if (act === 'done') { const q = active().find((x) => x.id === b.dataset.id); if (q && Q.isReady(q)) { Q.complete(q); Q.line = 'Ottimo lavoro! Il villaggio te ne è grato.'; } }
    else if (act === 'buy') {
      const [id, k, price] = Q.stock(n)[+b.dataset.i];
      if (!G.creative()) { if (P().count('doblone') < price) return true; P().take('doblone', price); }
      if (id === 'mappa_tesoro') { const tg = G.POI.mapTarget(n.x + Math.random() * 40, n.z, (Math.random() * 1e6) | 0, G.state.removed); if (tg) P().giveStack({ id, n: 1, d: tg }); else { P().give('doblone', price); G.UI.toast('Non ho più mappe, mi spiace'); } }
      else P().give(id, k);
      if (G.Audio) G.Audio.coins();
      Q.line = 'Affare fatto!';
    } else if (act === 'sell' || act === 'sellall') {
      const id = b.dataset.id, k = act === 'sell' ? 1 : P().count(id);
      if (P().count(id) >= k && k > 0) { P().take(id, k); P().give('doblone', SELL[id] * k); if (G.Audio) G.Audio.coins(); Q.line = 'Merce di qualità, grazie.'; }
    } else if (act === 'rest') {
      const bed = G.Build.pieces.find((p) => p.gen && p.t === 'letto' && Math.hypot(p.x - n.x, p.z - n.z) < 14);
      G.UI.close();
      if (bed) P().sleep(bed); else { P().spawn = { x: n.x, y: n.y + 0.3, z: n.z }; G.UI.toast('Punto di rinascita salvato', 'good'); }
      return true;
    } else if (act === 'again') { Q.lineTalk = Q.rumor(n); }
    G.UI.renderPanel();
    return true;
  };

  /* ---------------- tesori ---------------- */
  const T = (G.Treasure = {});
  // scava con la pala: tre colpi sulla X
  T.dig = function () {
    const p = P().pos;
    if (G.World.groundAt(p.x, p.z) < G.SEA - 0.3) { G.UI.toast('Sott’acqua non si scava'); return true; }
    const spot = G.POI.treasuresNear(p.x, p.z, 4).find((t) => !G.state.removed.has('dig:' + t.id) && Math.hypot(t.x - p.x, t.z - p.z) < 3.2);
    G.FX.burst(p.x - Math.sin(P().yaw) * 1.2, G.World.groundAt(p.x, p.z) + 0.1, p.z - Math.cos(P().yaw) * 1.2, [0.7, 0.58, 0.4], 10, 2.5);
    if (G.Audio) G.Audio.dig();
    if (!spot) { if (!T._warn || performance.now() - T._warn > 4000) { T._warn = performance.now(); G.UI.toast('Qui non c’è niente. Una mappa del tesoro ti dice dove scavare.'); } return true; }
    T.hits = (T.hits || 0) + 1;
    if (T.hits < 3) return true;
    T.hits = 0;
    G.state.removed.add('dig:' + spot.id);
    if (G.Net && G.Net.on) G.Net.send({ t: 'rm', id: 'dig:' + spot.id });
    // la mappa usata sparisce
    const inv = P().inv; for (let i = 0; i < inv.length; i++) if (inv[i] && inv[i].id === 'mappa_tesoro' && inv[i].d && inv[i].d.id === spot.id) inv[i] = null;
    P().stats = P().stats || {}; P().stats.treasures = (P().stats.treasures || 0) + 1;
    (P().discovered = P().discovered || {})[spot.id] = Date.now();
    G.UI.refreshHotbar();
    G.UI.toast('Hai trovato un forziere sepolto!', 'good');
    if (G.Audio) G.Audio.coins();
    G.Structures.timer = 0;
    G.saveSoon();
    return true;
  };
  // legge una mappa del tesoro: pergamena con la costa disegnata, la X e la direzione da dove sei
  T.read = function (st) {
    if (!st.d) { G.UI.toast('La mappa è illeggibile'); return; }
    T.cur = st.d; G.UI.openCustom('mappa');
  };
  T.render = function () {
    const d = T.cur, p = P().pos, dd = Math.hypot(d.x - p.x, d.z - p.z);
    const dug = G.state.removed.has('dig:' + d.id);
    return `<div class="tmap"><h3>Mappa del tesoro</h3><canvas id="tmapc" width="560" height="400"></canvas>
      <p class="note">${dug ? 'Questo tesoro è già stato scavato.' : `La X è a circa <b>${Math.round(dd / 10) * 10} m</b> verso <b>${dirName(d.x - p.x, d.z - p.z)}</b> da dove ti trovi. Arrivato sulla X, scava con la pala (clic sinistro).`}</p></div>`;
  };
  T.draw = function () {
    const c = document.getElementById('tmapc'); if (!c || !T.cur) return;
    const x = c.getContext('2d'), W = c.width, H = c.height, d = T.cur, S = 1.6; // metri per pixel
    const g = x.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#f1e2b8'); g.addColorStop(1, '#c9a86a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const img = x.getImageData(0, 0, W, H), px = img.data;
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
      const wx = d.x + (i - W / 2) * S, wz = d.z + (j - H / 2) * S, h = G.heightAt(wx, wz);
      let r = 0, gg = 0, b = 0, a = 0;
      if (h < -0.2) { r = 120; gg = 150; b = 150; a = Math.min(0.5, 0.2 + -h * 0.02); } else if (h < 1.5) { r = 150; gg = 110; b = 60; a = 0.35; } else { r = 120; gg = 90; b = 50; a = 0.12 + Math.min(0.3, h * 0.012); }
      for (let q = 0; q < 4; q++) { const k = ((j + (q >> 1)) * W + i + (q & 1)) * 4; px[k] = px[k] * (1 - a) + r * a; px[k + 1] = px[k + 1] * (1 - a) + gg * a; px[k + 2] = px[k + 2] * (1 - a) + b * a; }
    }
    x.putImageData(img, 0, 0);
    // contorno della costa
    x.fillStyle = 'rgba(70,45,20,0.75)';
    for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) { const h = G.heightAt(d.x + (i - W / 2) * S, d.z + (j - H / 2) * S), h2 = G.heightAt(d.x + (i + 2 - W / 2) * S, d.z + (j - H / 2) * S), h3 = G.heightAt(d.x + (i - W / 2) * S, d.z + (j + 2 - H / 2) * S); if ((h > 0.2) !== (h2 > 0.2) || (h > 0.2) !== (h3 > 0.2)) x.fillRect(i, j, 2, 2); }
    // sentiero tratteggiato e X
    x.setLineDash([6, 6]); x.strokeStyle = 'rgba(90,50,20,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W * 0.15, H * 0.85); x.quadraticCurveTo(W * 0.3, H * 0.4, W / 2 - 12, H / 2 + 12); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#a81e12'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(W / 2 - 14, H / 2 - 14); x.lineTo(W / 2 + 14, H / 2 + 14); x.moveTo(W / 2 + 14, H / 2 - 14); x.lineTo(W / 2 - 14, H / 2 + 14); x.stroke();
    // rosa dei venti
    x.save(); x.translate(W - 50, 50); x.fillStyle = 'rgba(80,50,20,0.8)'; x.beginPath(); x.moveTo(0, -30); x.lineTo(7, 0); x.lineTo(0, 30); x.lineTo(-7, 0); x.closePath(); x.fill(); x.font = 'bold 16px Georgia'; x.textAlign = 'center'; x.fillText('N', 0, -36); x.restore();
    // tu (se sei dentro la mappa)
    const p = P().pos, ix = W / 2 + (p.x - d.x) / S, iz = H / 2 + (p.z - d.z) / S;
    if (ix > 8 && ix < W - 8 && iz > 8 && iz < H - 8) { x.fillStyle = '#1d4f7a'; x.beginPath(); x.arc(ix, iz, 6, 0, 7); x.fill(); x.font = '13px Georgia'; x.fillText('tu', ix + 8, iz + 4); }
    x.strokeStyle = 'rgba(80,50,20,0.6)'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
  };
})();
