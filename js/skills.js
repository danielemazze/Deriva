/* =========================================================
   Abilità: crescono facendo. Più usi una cosa, più diventi bravo.
   Spada, Parata, Arma da fuoco, Arceria, Furtività, Corsa,
   Contadino, Allevatore. Livello da 1 a 50.
   ========================================================= */
(function () {
  const SK = (G.Skills = { xp: {}, MAX: 50 });
  SK.LIST = [
    { k: 'spada', n: 'Spada', ic: '⚔', eff: 'Fendenti più forti e più rapidi', how: 'Colpisci con spada e sciabola' },
    { k: 'parata', n: 'Parata', ic: '🛡', eff: 'Meno danno quando pari con lo scudo', how: 'Para i colpi con lo scudo' },
    { k: 'fuoco', n: 'Arma da fuoco', ic: '✹', eff: 'Ricarica più veloce, colpi più precisi', how: 'Spara con pistole e cannoni' },
    { k: 'arco', n: 'Arceria', ic: '➶', eff: 'Tendi prima, frecce più veloci e più forti', how: 'Colpisci con l’arco' },
    { k: 'furto', n: 'Furtività', ic: '◐', eff: 'Ti vedono da più vicino, furti più ricchi', how: 'Muoviti accovacciato e ruba' },
    { k: 'corsa', n: 'Corsa', ic: '➤', eff: 'Più stamina e recupero più rapido', how: 'Corri (Ctrl)' },
    { k: 'contadino', n: 'Contadino', ic: '❀', eff: 'Raccolti più abbondanti da piante e cespugli', how: 'Raccogli bacche, fibra e piante' },
    { k: 'allevatore', n: 'Allevatore', ic: '♞', eff: 'Più lana, a volte il cibo non si consuma', how: 'Nutri, tosa e fai nascere cuccioli' },
  ];
  SK.BY = {}; for (const s of SK.LIST) SK.BY[s.k] = s;
  // punti per passare dal livello L al successivo
  const need = (L) => 10 + L * 6;
  SK.need = need;
  SK.lv = function (k) {
    let x = SK.xp[k] || 0, L = 1;
    while (L < SK.MAX && x >= need(L)) { x -= need(L); L++; }
    return L;
  };
  SK.frac = function (k) {
    let x = SK.xp[k] || 0, L = 1;
    while (L < SK.MAX && x >= need(L)) { x -= need(L); L++; }
    return L >= SK.MAX ? 1 : x / need(L);
  };
  // moltiplicatore: 1 al livello 1, +per ogni livello
  SK.mul = (k, per) => 1 + (SK.lv(k) - 1) * per;
  SK.less = (k, per, min) => Math.max(min === undefined ? 0.3 : min, 1 - (SK.lv(k) - 1) * per);
  SK.chance = (k, per) => Math.random() < (SK.lv(k) - 1) * per;
  SK.add = function (k, n) {
    if (!SK.BY[k] || !(n > 0) || (G.creative && G.creative())) return;
    const before = SK.lv(k);
    SK.xp[k] = (SK.xp[k] || 0) + n;
    const after = SK.lv(k);
    SK.show(k, after > before);
    if (after > before) {
      G.UI.toast(`${SK.BY[k].n}: livello ${after}!`, 'good');
      if (G.Audio && G.Audio.levelUp) G.Audio.levelUp();
      if (G.saveSoon) G.saveSoon();
      if (G.UI.open === 'abilita') G.UI.renderPanel();
    }
  };
  SK.serialize = () => Object.assign({}, SK.xp);
  SK.load = (d) => { SK.xp = {}; if (d && typeof d === 'object') for (const k in d) if (SK.BY[k] && typeof d[k] === 'number') SK.xp[k] = d[k]; };

  /* avviso in alto a destra quando un'abilità cresce */
  let pop = null, popT = 0, popK = null;
  SK.show = function (k, up) {
    if (!pop) { pop = document.createElement('div'); pop.className = 'skillpop'; const h = document.getElementById('hud'); if (!h) return; h.appendChild(pop); }
    if (popK !== k || up || !pop.classList.contains('on')) {
      popK = k;
      pop.innerHTML = `<span>${SK.BY[k].n} <b>${SK.lv(k)}</b>${up ? ' <em>↑</em>' : ''}</span><i><u></u></i>`;
    }
    pop.querySelector('u').style.width = Math.round(SK.frac(k) * 100) + '%';
    pop.classList.add('on'); pop.classList.toggle('up', !!up); popT = up ? 3.5 : 2.2;
  };
  SK.update = function (dt) { if (popT > 0) { popT -= dt; if (popT <= 0 && pop) pop.classList.remove('on'); } };

  /* scheda Abilità (accanto all'inventario) */
  SK.render = function () {
    const rows = SK.LIST.map((s) => {
      const L = SK.lv(s.k), f = SK.frac(s.k);
      return `<div class="skrow"><div class="skic">${s.ic}</div><div class="skmid"><b>${s.n}</b><small>${s.eff}</small><i><u style="width:${Math.round(f * 100)}%"></u></i><em>${s.how} · ${L >= SK.MAX ? 'livello massimo' : Math.round(f * 100) + '% al prossimo livello'}</em></div><div class="sklv"><small>LIV.</small>${L}</div></div>`;
    }).join('');
    return `<div class="sktabs"><button class="sktab" data-act="tabinv">Inventario</button><button class="sktab on">Abilità</button><span>Le abilità crescono facendo: più usi una cosa, più diventi bravo</span></div><div class="skgrid">${rows}</div>`;
  };
})();
