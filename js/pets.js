'use strict';
/* ==========================================================
   Animali tuoi: catturati con le trappole o nutriti. Seguono chi
   tiene in mano il loro cibo, si accoppiano e fanno cuccioli che
   crescono. Restano salvati nel mondo (anche lontano dai chunk).
   ========================================================== */
(function () {
  const G = globalThis.G;
  const PT = (G.Pets = { list: [], remote: [] });
  const FIELDS = ['id', 'sp', 'x', 'z', 'yaw', 'scale', 'scale0', 'age', 'love', 'breedCd', 'trapped', 'wool', 'hp', 'pet'];
  const pack = (st) => { const o = {}; for (const k of FIELDS) if (st[k] !== undefined && st[k] !== null) o[k] = typeof st[k] === 'number' ? +st[k].toFixed(2) : st[k]; return o; };
  PT.serialize = () => (G.Net && G.Net.on && !G.Net.isHost ? [] : G.Net && G.Net.on ? PT.remote : PT.list.map(pack));
  PT.reset = function () { for (const st of PT.list) { const a = G.Entities.byId.get(st.id); if (a) G.Entities.removeAnimal(a); } PT.list = []; PT.remote = []; };
  PT.load = function (arr) {
    PT.reset();
    if (G.Net && G.Net.on) { PT.remote = arr || []; return; } // in partita li simula il server
    for (const o of arr || []) { const st = Object.assign(G.newAnimalState({ id: o.id, sp: o.sp, x: o.x, z: o.z, yaw: o.yaw }), o); spawn(st); }
  };
  function spawn(st) { st.pet = true; PT.list.push(st); return G.Entities.addAnimal(st, null); }
  // un animale selvatico diventa tuo: non sparisce più col suo chunk e non rinasce dove era nato
  PT.adopt = function (a) {
    if (a.remote) return;
    const st = a.st; if (PT.list.includes(st)) return;
    st.pet = true; if (!st.scale0) st.scale0 = st.scale;
    if (a.chunk) { const i = a.chunk.entities.indexOf(a); if (i >= 0) a.chunk.entities.splice(i, 1); a.chunk = null; }
    (G.state.killed = G.state.killed || new Set()).add(st.id);
    const nid = 'p:' + Math.random().toString(36).slice(2, 9);
    G.Entities.byId.delete(st.id); st.id = nid; a.id = nid; G.Entities.byId.set(nid, a);
    PT.list.push(st);
  };
  PT.birth = function (o) {
    const st = G.newAnimalState({ id: 'p:' + Math.random().toString(36).slice(2, 9), sp: o.sp, x: o.x, z: o.z, yaw: Math.random() * 6.28, scale: 0.5 });
    st.age = 0; st.scale0 = 1; st.breedCd = 300;
    spawn(st);
    G.FX.burst(o.x, G.World.groundAt(o.x, o.z) + 0.6, o.z, [1, 0.55, 0.7], 16, 1.6);
    G.UI.toast(`È nato un cucciolo di ${G.SPECIES[o.sp].n.toLowerCase()}!`, 'good');
    G.Skills.add('allevatore', 8);
    if (G.Audio) G.Audio.animal(o.sp, 2);
    G.saveSoon();
  };
  // contesto per l'IA degli animali (giocatore singolo)
  PT.ctx = function () {
    const P = G.Player, held = P.held(), L = P.equip && P.equip[0];
    const traps = G.Build.pieces.filter((p) => p.t === 'trappola').map((p) => ({ id: p.id, x: p.x, z: p.z, full: false }));
    const animals = [];
    for (const a of G.Entities.list) if (a.kind === 'animal' && !a.remote) { animals.push(a.st); if (a.st.trapped) { const t = traps.find((q) => q.id === a.st.trapped); if (t) t.full = true; } }
    return { players: [{ x: P.pos.x, z: P.pos.z, food: held ? held.id : L ? L.id : null }], traps, animals,
      birth: PT.birth,
      event: (k, st, t) => {
        if (k === 'trap') { const a = G.Entities.byId.get(st.id); if (a) PT.adopt(a); G.UI.toast(`Trappola scattata: ${G.SPECIES[st.sp].n.toLowerCase()}! Dai da mangiare all’animale per liberarlo, poi portalo nel recinto.`, 'good'); G.saveSoon(); }
      } };
  };
  // tasto destro su un animale col suo cibo in mano
  PT.feed = function (a, it) {
    const foods = G.BREED[a.sp]; if (!foods || !foods.includes(it.id)) return false;
    const P = G.Player;
    if (a.remote) { G.Net.send({ t: 'feed', id: a.id }); P.take(it.id, 1); G.FX.burst(a.pos.x, a.pos.y + 0.8, a.pos.z, [1, 0.5, 0.65], 8, 1.2); G.UI.toast(`Hai dato da mangiare a ${G.SPECIES[a.sp].n.toLowerCase()}`); return true; }
    PT.adopt(a);
    const r = G.feedAnimal(a.st);
    if (r === 'baby') { G.UI.toast('È un cucciolo: deve crescere prima di avere piccoli'); }
    else if (r === 'tired') { G.UI.toast('Ha appena avuto un cucciolo: riprova più tardi'); }
    else {
      if (!G.Skills.chance('allevatore', 0.008)) P.take(it.id, 1); G.Skills.add('allevatore', 4);
      if (r === 'freed') G.UI.toast(`Animale liberato: ora è tuo e ti segue se tieni in mano ${G.ITEMS[foods[0]].n.toLowerCase()}`, 'good');
      else { G.UI.toast(`${G.SPECIES[a.sp].n}: in amore ❤ Nutrine un altro esemplare vicino per avere un cucciolo`, 'good'); G.FX.burst(a.pos.x, a.pos.y + 1, a.pos.z, [1, 0.4, 0.6], 14, 1.4); }
      if (G.Audio) G.Audio.eat();
      G.saveSoon();
    }
    return true;
  };
  PT.label = function (a) {
    const st = a.st; const bits = [];
    if (st.pet) bits.push('tua'); if (st.age !== undefined && st.age < 1) bits.push('cucciolo'); if (st.trapped) bits.push('in trappola'); if (st.love > 0) bits.push('in amore ❤');
    return bits.join(' · ');
  };
})();
