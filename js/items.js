'use strict';
/* ==========================================================
   Oggetti, ricette (griglia 3x3 / 5x5) e icone disegnate
   ========================================================== */
(function () {
  const G = globalThis.G;

  // cat: res, food, tool, place, part
  const I = (G.ITEMS = {
    tronco: { n: 'Tronco', d: 'Legno grezzo. Si ottiene abbattendo gli alberi.', cat: 'res' },
    assi: { n: 'Assi di legno', d: 'Tavole piallate per costruire case e scafi.', cat: 'res' },
    bastone: { n: 'Bastone', d: 'Manico per attrezzi, torce e vele.', cat: 'res' },
    fibra: { n: 'Fibra vegetale', d: 'Raccolta da erba alta e cespugli.', cat: 'res' },
    corda: { n: 'Corda', d: 'Fibra intrecciata. Serve per legature e sartiame.', cat: 'res' },
    pietra: { n: 'Pietra', d: 'Estratta dalle rocce con il piccone (o a mani nude, lentamente).', cat: 'res' },
    foglie: { n: 'Foglie', d: 'Materiale leggero per tetti e giacigli.', cat: 'res' },
    lana: { n: 'Lana', d: 'Tosata dalle pecore.', cat: 'res' },
    stoffa: { n: 'Stoffa', d: 'Tessuto robusto per vele e letti.', cat: 'res' },
    piume: { n: 'Piume', d: 'Cadono dalle galline.', cat: 'res' },
    conchiglia: { n: 'Conchiglia', d: 'Un ricordo della spiaggia.', cat: 'res' },
    cocco: { n: 'Noce di cocco', d: 'Dissetante e nutriente.', cat: 'food', food: 6, water: 20 },
    bacche: { n: 'Bacche', d: 'Raccolte dai cespugli.', cat: 'food', food: 6, water: 3 },
    polpa_cactus: { n: 'Polpa di cactus', d: 'Amara ma piena d’acqua: salva la vita nel deserto.', cat: 'food', food: 3, water: 16 },
    funghi: { n: 'Funghi', d: 'Crescono all’ombra dei boschi. Meglio cuocerli.', cat: 'food', food: 4, water: 1 },
    funghi_cotti: { n: 'Funghi arrosto', d: 'Saporiti e sicuri.', cat: 'food', food: 12, water: 0 },
    uovo: { n: 'Uovo', d: 'Va cotto sul falò.', cat: 'res' },
    uovo_cotto: { n: 'Uovo cotto', d: 'Semplice e sostanzioso.', cat: 'food', food: 10 },
    pollo_crudo: { n: 'Pollo crudo', d: 'Cuocilo sul falò.', cat: 'food', food: 3 },
    pollo_cotto: { n: 'Pollo arrosto', d: '', cat: 'food', food: 16 },
    montone_crudo: { n: 'Montone crudo', d: 'Cuocilo sul falò.', cat: 'food', food: 3 },
    montone_cotto: { n: 'Montone arrosto', d: '', cat: 'food', food: 18 },
    manzo_crudo: { n: 'Manzo crudo', d: 'Cuocilo sul falò.', cat: 'food', food: 4 },
    manzo_cotto: { n: 'Bistecca', d: '', cat: 'food', food: 24 },
    coniglio_crudo: { n: 'Coniglio crudo', d: 'Cuocilo sul falò.', cat: 'food', food: 3 },
    coniglio_cotto: { n: 'Coniglio arrosto', d: '', cat: 'food', food: 14 },
    maiale_crudo: { n: 'Maiale crudo', d: 'Cuocilo sul falò.', cat: 'food', food: 3 },
    maiale_cotto: { n: 'Braciola', d: '', cat: 'food', food: 20 },
    pesce_crudo: { n: 'Pesce crudo', d: 'Pescato in mare. Cuocilo sul falò.', cat: 'food', food: 3, water: 2 },
    pesce_cotto: { n: 'Pesce alla brace', d: '', cat: 'food', food: 15, water: 4 },
    ciotola: { n: 'Ciotola', d: 'Clic destro sul mare per raccogliere acqua.', cat: 'res' },
    ciotola_salata: { n: 'Acqua salata', d: 'Da bollire sul falò per renderla potabile.', cat: 'res' },
    ciotola_acqua: { n: 'Acqua potabile', d: 'Disseta molto.', cat: 'food', water: 38, ret: 'ciotola' },
    ascia: { n: 'Ascia di pietra', d: 'Abbatte gli alberi in pochi colpi.', cat: 'tool', stack: 1 },
    piccone: { n: 'Piccone di pietra', d: 'Spacca le rocce velocemente.', cat: 'tool', stack: 1 },
    coltello: { n: 'Coltello di pietra', d: 'Per cacciare e tagliare fibre.', cat: 'tool', stack: 1 },
    canna: { n: 'Canna da pesca', d: 'Clic destro verso il mare per lanciare. Clic destro quando il galleggiante affonda.', cat: 'tool', stack: 1 },
    libro: { n: 'Libro del costruttore', d: 'Progetti delle barche e ricettario. Tasto B o clic destro.', cat: 'tool', stack: 1 },
    banco: { n: 'Banco da lavoro', d: 'Sblocca la griglia di creazione 5×5.', cat: 'place' },
    falo: { n: 'Falò', d: 'Cuoce il cibo e fa luce di notte.', cat: 'place' },
    baule: { n: 'Baule', d: 'Conserva 27 oggetti.', cat: 'place' },
    letto: { n: 'Letto', d: 'Dormi per saltare la notte e salva il punto di rinascita.', cat: 'place' },
    torcia: { n: 'Torcia', d: 'Illumina le notti.', cat: 'place' },
    pavimento: { n: 'Pavimento', d: 'Base della casa (3×3 m).', cat: 'place' },
    muro: { n: 'Muro', d: 'Parete di legno.', cat: 'place' },
    muro_porta: { n: 'Muro con porta', d: 'Parete con apertura per la porta.', cat: 'place' },
    muro_finestra: { n: 'Muro con finestra', d: 'Parete con finestra.', cat: 'place' },
    porta: { n: 'Porta', d: 'Mirala su un muro con porta. Si apre con E.', cat: 'place' },
    tetto: { n: 'Tetto', d: 'Falda inclinata da posare sopra i muri.', cat: 'place' },
    recinto: { n: 'Recinto', d: 'Staccionata per gli animali.', cat: 'place' },
    scala: { n: 'Scala', d: 'Rampa per salire al piano di sopra.', cat: 'place' },
    albero_barca: { n: 'Albero della barca', d: 'Montante per le vele.', cat: 'part' },
    vela: { n: 'Vela', d: 'Spinta dal vento.', cat: 'part' },
    remo: { n: 'Remo', d: 'Per zattere e barche a remi.', cat: 'part' },
    timone: { n: 'Timone', d: 'Governa le barche a vela.', cat: 'part' },
    // armi
    arco: { n: 'Arco', d: 'Tieni premuto il clic sinistro per tendere, rilascia per scoccare. Servono frecce.', cat: 'weapon', stack: 1 },
    freccia: { n: 'Freccia', d: 'Munizione per l’arco.', cat: 'res' },
    lancia: { n: 'Lancia', d: 'Colpisce più lontano del coltello.', cat: 'weapon', stack: 1, dmg: 4, reach: 4.6, cd: 0.7 },
    sciabola: { n: 'Sciabola', d: 'Lama da pirata: veloce e tagliente.', cat: 'weapon', stack: 1, dmg: 5.5, cd: 0.42 },
    pistola: { n: 'Pistola a pietra focaia', d: 'Un colpo potente, poi va ricaricata. Servono munizioni.', cat: 'weapon', stack: 1 },
    munizioni: { n: 'Munizioni', d: 'Polvere e palle di piombo per le pistole.', cat: 'res' },
    pala: { n: 'Pala', d: 'Clic sinistro sulla X di una mappa del tesoro per scavare.', cat: 'tool', stack: 1 },
    // tesori ed esplorazione
    doblone: { n: 'Doblone d’oro', d: 'La moneta dei villaggi: si spende dai mercanti.', cat: 'res', stack: 999 },
    perla: { n: 'Perla', d: 'Rara e preziosa: i mercanti la pagano bene.', cat: 'res' },
    pelle: { n: 'Pelle', d: 'Dei predatori. I mercanti la comprano.', cat: 'res' },
    dente_squalo: { n: 'Dente di squalo', d: 'Un trofeo dal mare aperto.', cat: 'res' },
    mappa_tesoro: { n: 'Mappa del tesoro', d: 'Clic destro per leggerla. Vai alla X e scava con la pala.', cat: 'tool', stack: 1 },
    pacco: { n: 'Pacco da consegnare', d: 'Portalo nel villaggio indicato.', cat: 'quest', stack: 1 },
    // oggetti rari (uno per tipo)
    bussola_oro: { n: 'Bussola d’oro', d: 'Rara. Nella bussola in alto compare una stella verso il luogo inesplorato più vicino.', cat: 'rare', stack: 1 },
    cannocchiale: { n: 'Cannocchiale', d: 'Tieni premuto il tasto destro per guardare lontano; con la rotella ingrandisci da ×2 a ×8. Mostra la distanza di quello che guardi.', cat: 'tool', stack: 1 },
    vela_leggendaria: { n: 'Vela leggendaria', d: 'Rara. Tenuta nell’inventario, le barche a vela vanno il 30% più veloci.', cat: 'rare', stack: 1 },
    pinne: { n: 'Pinne e maschera', d: 'Rare. Nuoti più veloce e il fiato dura molto di più.', cat: 'rare', stack: 1 },
    lanterna: { n: 'Lanterna del faro', d: 'Rara. Tenuta in mano illumina come un faro.', cat: 'rare', stack: 1 },
    pistola_capitano: { n: 'Pistola del capitano', d: 'Rara. Più potente e più rapida da ricaricare.', cat: 'rare', stack: 1 },
    // progetti delle nuove barche
    progetto_canoa: { n: 'Progetto: canoa', d: 'Clic destro per impararlo: la canoa comparirà nel libro.', cat: 'blueprint', stack: 1, boat: 'canoa' },
    progetto_catamarano: { n: 'Progetto: catamarano', d: 'Clic destro per impararlo: il catamarano comparirà nel libro.', cat: 'blueprint', stack: 1, boat: 'catamarano' },
    progetto_galeone: { n: 'Progetto: galeone', d: 'Clic destro per impararlo: il galeone comparirà nel libro.', cat: 'blueprint', stack: 1, boat: 'galeone' },
    cannone: { n: 'Cannone', d: 'Parte del galeone. Si trova nei relitti o dai mercanti.', cat: 'part' },
    // vestiti (temperatura): wear = 1 testa, 2 corpo, 3 piedi; warm = calore, cool = riparo dal sole
    cappello_lana: { n: 'Berretto di lana', d: 'Tiene calda la testa. Indossalo nello slot Testa (inventario).', cat: 'wear', stack: 1, wear: 1, warm: 2 },
    maglione_lana: { n: 'Maglione di lana', d: 'Il capo più caldo: indispensabile tra la neve.', cat: 'wear', stack: 1, wear: 2, warm: 4 },
    mantello_pelle: { n: 'Mantello di pelle', d: 'Caldo e resistente al vento.', cat: 'wear', stack: 1, wear: 2, warm: 3 },
    stivali_pelle: { n: 'Stivali di pelle', d: 'Piedi asciutti e caldi.', cat: 'wear', stack: 1, wear: 3, warm: 2 },
    cappello_paglia: { n: 'Cappello di paglia', d: 'Ripara dal sole: con il caldo hai meno sete.', cat: 'wear', stack: 1, wear: 1, cool: 2 },
    scudo: { n: 'Scudo', d: 'Mettilo nella mano sinistra (F) e tieni premuto il tasto destro per parare: blocca gran parte dei colpi.', cat: 'tool', stack: 1, shield: true },
    trappola: { n: 'Trappola', d: 'Posala dove passano gli animali: li cattura vivi. Poi attirali col cibo verso il recinto.', cat: 'place' },
    terra: { n: 'Terra', d: 'Scavata dal terreno.', cat: 'res' },
    carbone: { n: 'Carbone', d: 'Si trova scavando nella roccia. Fa torce migliori.', cat: 'res' },
    ossidiana: { n: 'Ossidiana', d: 'Vetro vulcanico nero e tagliente, dalle pendici dei vulcani.', cat: 'res' },
    coltello_ossidiana: { n: 'Coltello di ossidiana', d: 'Affilatissimo: colpisce forte e taglia in fretta.', cat: 'weapon', stack: 1, dmg: 4.5, cd: 0.38 },
    // case di pietra (si mescolano con quelle di legno, stessa griglia)
    pavimento_pietra: { n: 'Pavimento di pietra', d: 'Base della casa (3×3 m), non brucia.', cat: 'place' },
    muro_pietra: { n: 'Muro di pietra', d: 'Parete di pietra squadrata.', cat: 'place' },
    muro_porta_pietra: { n: 'Muro di pietra con porta', d: 'Parete di pietra con il vano per la porta.', cat: 'place' },
    muro_finestra_pietra: { n: 'Muro di pietra con finestra', d: 'Parete di pietra con finestra.', cat: 'place' },
    tetto_pietra: { n: 'Tetto di ardesia', d: 'Falda di lastre di pietra da posare sopra i muri.', cat: 'place' },
    scala_pietra: { n: 'Scala di pietra', d: 'Rampa di gradini in pietra.', cat: 'place' },
    pilastro: { n: 'Pilastro', d: 'Colonna di pietra alta quanto un muro.', cat: 'place' },
    camino: { n: 'Camino', d: 'Focolare di pietra: scalda e fa luce. Mettilo contro un muro.', cat: 'place' },
    fornace: { n: 'Fornace', d: 'Fonde i minerali in lingotti. Ci vuole carbone (o legna).', cat: 'place' },
    // minerali e metalli
    ferro_grezzo: { n: 'Ferro grezzo', d: 'Minerale color ruggine dalle vene di ferro. Si fonde nella fornace.', cat: 'res' },
    oro_grezzo: { n: 'Oro grezzo', d: 'Pepite dalle vene d’oro, rare. Si fonde nella fornace.', cat: 'res' },
    lingotto_ferro: { n: 'Lingotto di ferro', d: 'Per attrezzi, armi e chiodi di ferro.', cat: 'res' },
    lingotto_oro: { n: 'Lingotto d’oro', d: 'Prezioso: i mercanti lo pagano molto.', cat: 'res' },
    chiodi: { n: 'Chiodi di ferro', d: 'Tengono insieme scafi e travi.', cat: 'res' },
    piccone_ferro: { n: 'Piccone di ferro', d: 'Spacca rocce e vene molto più in fretta.', cat: 'tool', stack: 1 },
    ascia_ferro: { n: 'Ascia di ferro', d: 'Abbatte gli alberi in pochissimi colpi.', cat: 'tool', stack: 1 },
    pala_ferro: { n: 'Pala di ferro', d: 'Scava più largo e più in fretta.', cat: 'tool', stack: 1 },
    spada_ferro: { n: 'Spada di ferro', d: 'Lama pesante e robusta.', cat: 'weapon', stack: 1, dmg: 6.5, cd: 0.5 },
    // barca libera: pezzi da montare uno per uno (tasto destro sul mare o su un pezzo già messo)
    fasciame: { n: 'Fasciame', d: 'Pezzo di scafo (1 m). Il primo, mirando il mare, inizia una barca libera: galleggia e regge circa 500 kg.', cat: 'part', free: true },
    ponte_barca: { n: 'Ponte di barca', d: 'Tavolato leggero su cui camminare. Galleggia poco.', cat: 'part', free: true },
    zavorra: { n: 'Zavorra', d: 'Blocco di pietra pesante (280 kg): messo in basso tiene dritta la barca, ma la fa affondare di più.', cat: 'part', free: true },
    panca: { n: 'Panca', d: 'Seduta per la barca libera.', cat: 'part', free: true },
  });
  G.RARE = ['bussola_oro', 'cannocchiale', 'vela_leggendaria', 'pinne', 'lanterna', 'pistola_capitano'];
  for (const k in I) { I[k].id = k; if (!I[k].stack) I[k].stack = 64; }

  G.COOK = {
    pollo_crudo: 'pollo_cotto', montone_crudo: 'montone_cotto', manzo_crudo: 'manzo_cotto', coniglio_crudo: 'coniglio_cotto',
    maiale_crudo: 'maiale_cotto', pesce_crudo: 'pesce_cotto', uovo: 'uovo_cotto', funghi: 'funghi_cotti', ciotola_salata: 'ciotola_acqua',
  };
  // fornace: minerale → lingotto; il combustibile (carbone o tronchi) fonde un certo numero di pezzi
  G.SMELT = { ferro_grezzo: 'lingotto_ferro', oro_grezzo: 'lingotto_oro' };
  G.SMELT_FUEL = { carbone: 2, tronco: 1 };
  // classe e forza degli attrezzi (le versioni di ferro fanno lo stesso lavoro, più in fretta)
  const TOOLCLS = { ascia_ferro: 'ascia', piccone_ferro: 'piccone', pala_ferro: 'pala', coltello_ossidiana: 'coltello' };
  G.toolClass = (id) => (id ? TOOLCLS[id] || id : null);
  G.toolPower = (id) => (/_ferro$/.test(id || '') ? 1.8 : 1);


  /* ----------------- RICETTE -----------------
     Le lettere mappano gli oggetti; '.' è vuoto.
     size: griglia minima richiesta (3 = inventario, 5 = banco) */
  const K = { T: 'tronco', A: 'assi', B: 'bastone', F: 'fibra', C: 'corda', P: 'pietra', L: 'lana', S: 'stoffa', O: 'foglie', X: 'baule', W: 'piume', H: 'pelle', N: 'carbone', Y: 'ossidiana', I: 'lingotto_ferro', R: 'chiodi' };
  const R = (out, n, rows, extra) => Object.assign({ out, n, rows }, extra || {});
  G.RECIPES = [
    R('assi', 4, ['T']),
    R('bastone', 4, ['A', 'A']),
    R('corda', 1, ['FFF']),
    R('banco', 1, ['AA', 'AA']),
    R('falo', 1, ['.B.', 'BTB', 'PPP']),
    R('torcia', 4, ['F', 'B']),
    R('ascia', 1, ['PP', 'PB', '.B']),
    R('piccone', 1, ['PPP', '.B.', '.B.']),
    R('coltello', 1, ['P', 'B']),
    R('canna', 1, ['..B', '.BC', 'B.C']),
    R('ciotola', 2, ['A.A', '.A.']),
    R('stoffa', 1, ['LL', 'LL']),
    R('stoffa', 2, ['FFF', 'FFF', 'FFF']),
    R('baule', 1, ['AAA', 'ATA', 'AAA']),
    R('letto', 1, ['SSS', 'AAA']),
    R('pavimento', 2, ['AAA', 'AAA']),
    R('muro', 2, ['AA', 'AA', 'AA']),
    R('muro_porta', 2, ['AAA', 'A.A', 'A.A']),
    R('muro_finestra', 2, ['AAA', 'A.A', 'AAA']),
    R('porta', 1, ['AA', 'AB', 'AA']),
    R('tetto', 2, ['..A', '.AA', 'AAA']),
    R('tetto', 2, ['..O', '.OA', 'OAA']),
    R('recinto', 3, ['BAB', 'BAB']),
    R('scala', 1, ['A.A', 'AAA', 'A.A']),
    // parti navali: solo banco 5x5
    R('albero_barca', 1, ['..T..', '.BTB.', '..T..', '..T..', '..T..']),
    R('vela', 1, ['BBBBB', '.SSS.', '.SSS.', '.C.C.']),
    R('remo', 1, ['...AA', '..BA.', '.B...', 'B....']),
    R('timone', 1, ['B..', 'B..', 'AAA', 'AAA', 'AA.']),
    // armi
    R('arco', 1, ['.BC', 'B.C', '.BC']),
    R('freccia', 4, ['P', 'B', 'W']),
    R('lancia', 1, ['..P', '.C.', 'B..']),
    R('pala', 1, ['.A.', '.B.', '.B.']),
    // vestiti, scudo, trappole
    R('cappello_lana', 1, ['LLL', 'L.L']),
    R('maglione_lana', 1, ['L.L', 'LLL', 'LLL']),
    R('mantello_pelle', 1, ['H.H', 'HHH', 'HHH']),
    R('stivali_pelle', 1, ['H.H', 'H.H']),
    R('cappello_paglia', 1, ['.F.', 'FFF', 'F.F']),
    R('scudo', 1, ['AHA', 'AAA', '.A.']),
    R('trappola', 1, ['B.B', 'CPC', 'B.B']),
    R('torcia', 8, ['N', 'B']),
    R('coltello_ossidiana', 1, ['Y', 'B']),
    // pietra
    R('muro_pietra', 1, ['PP', 'PP', 'PP']),
    R('pavimento_pietra', 1, ['PPPP']),
    R('muro_porta_pietra', 1, ['PPP', 'P.P', 'P.P']),
    R('muro_finestra_pietra', 1, ['PPP', 'P.P', 'PPP']),
    R('tetto_pietra', 1, ['...P', '..PP', '.PPP']),
    R('scala_pietra', 1, ['P..', 'PP.', 'PPP']),
    R('pilastro', 1, ['P', 'P', 'P']),
    R('camino', 1, ['PPPPP', 'P...P', 'P.N.P', 'PPPPP']),
    R('fornace', 1, ['PPP', 'PNP', 'PPP']),
    // ferro
    R('chiodi', 8, ['I']),
    R('piccone_ferro', 1, ['III', '.B.', '.B.']),
    R('cannocchiale', 1, ['IYI', '.H.'], { size: 5 }),
    R('ascia_ferro', 1, ['II', 'IB', '.B']),
    R('pala_ferro', 1, ['.I.', '.B.', '.B.']),
    R('spada_ferro', 1, ['I', 'I', 'B']),
    R('fasciame', 2, ['AAA']),
    R('ponte_barca', 3, ['AA']),
    R('zavorra', 1, ['PP', 'PP']),
    R('panca', 1, ['AAA', 'B.B']),
  ];
  for (const r of G.RECIPES) {
    // ritaglia le righe/colonne vuote ai bordi
    let rows = r.rows.map((s) => s.padEnd(Math.max(...r.rows.map((q) => q.length)), '.'));
    while (rows.length && /^\.+$/.test(rows[0])) rows.shift();
    while (rows.length && /^\.+$/.test(rows[rows.length - 1])) rows.pop();
    while (rows.every((q) => q[0] === '.')) rows = rows.map((q) => q.slice(1));
    while (rows.every((q) => q[q.length - 1] === '.')) rows = rows.map((q) => q.slice(0, -1));
    r.rows = rows; r.h = rows.length; r.w = rows[0].length;
    r.size = Math.max(r.size || 3, Math.max(r.w, r.h) > 3 ? 5 : 3);
    r.cells = rows.map((q) => q.split('').map((ch) => (ch === '.' ? null : K[ch])));
  }

  // confronto griglia → ricetta (anche specchiata)
  G.matchRecipe = function (grid, N) {
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y * N + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    for (const r of G.RECIPES) {
      if (r.w !== w || r.h !== h || r.size > N) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
          const cell = grid[(y0 + y) * N + (x0 + x)];
          const want = r.cells[y][mirror ? w - 1 - x : x];
          if ((cell ? cell.id : null) !== want) { ok = false; break; }
        }
        if (ok) return r;
      }
    }
    return null;
  };
  G.recipeNeeds = function (r) {
    const need = {};
    for (const row of r.cells) for (const c of row) if (c) need[c] = (need[c] || 0) + 1;
    return need;
  };

  /* ----------------- ICONE ----------------- */
  const ICON = 64;
  G.iconCache = {};
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  function rg(ctx, x, y, r, stops) { const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
  function outline(ctx, w) { ctx.lineWidth = w || 2; ctx.strokeStyle = 'rgba(18,14,10,0.75)'; ctx.stroke(); }
  function stick(ctx, x0, y0, x1, y1, w, col) {
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(18,14,10,0.8)'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col || '#9a6b3c'; ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = w * 0.3; ctx.stroke();
  }
  function stoneHead(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0, 10, 0, 50, ['#b9b6ae', '#7c7972', '#57544f']); ctx.fill(); outline(ctx);
  }
  function meat(ctx, cooked, tint) {
    ctx.save(); ctx.translate(32, 34); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(-4, 0, 18, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = cooked ? rg(ctx, -4, 0, 20, ['#c9844a', '#8a4b22', '#5a2c12']) : rg(ctx, -4, 0, 20, [tint || '#f08a8a', '#c94f55', '#8e2c34']);
    ctx.fill(); outline(ctx);
    ctx.beginPath(); ctx.ellipse(-6, -2, 9, 6, 0.3, 0, Math.PI * 2); ctx.fillStyle = cooked ? 'rgba(255,200,140,0.25)' : 'rgba(255,230,230,0.35)'; ctx.fill();
    ctx.restore();
    stick(ctx, 40, 28, 54, 14, 5, '#efe6d6');
    ctx.beginPath(); ctx.arc(55, 13, 4, 0, Math.PI * 2); ctx.fillStyle = '#f4ede0'; ctx.fill(); outline(ctx, 1.5);
  }
  function fish(ctx, cooked) {
    ctx.save(); ctx.translate(30, 32); ctx.rotate(-0.35);
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-4, -16, 14, -2); ctx.lineTo(26, -10); ctx.lineTo(24, 0); ctx.lineTo(26, 10); ctx.lineTo(14, 2); ctx.quadraticCurveTo(-4, 16, -22, 0);
    ctx.fillStyle = cooked ? lg(ctx, 0, -12, 0, 12, ['#c98a4a', '#9a5a26', '#6a3a16']) : lg(ctx, 0, -12, 0, 12, ['#7fb6d6', '#bfd9e6', '#eef4f6']);
    ctx.fill(); outline(ctx);
    ctx.beginPath(); ctx.arc(-14, -2, 2.2, 0, 7); ctx.fillStyle = '#111'; ctx.fill();
    ctx.restore();
  }
  function bowl(ctx, fill) {
    ctx.beginPath(); ctx.ellipse(32, 30, 22, 7, 0, 0, Math.PI * 2); ctx.fillStyle = fill || '#5a3a1e'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 30); ctx.quadraticCurveTo(14, 52, 32, 52); ctx.quadraticCurveTo(50, 52, 54, 30); ctx.ellipse(32, 30, 22, 7, 0, 0, Math.PI);
    ctx.fillStyle = lg(ctx, 0, 30, 0, 52, ['#b07a46', '#7a4e26']); ctx.fill(); outline(ctx);
    ctx.beginPath(); ctx.ellipse(32, 30, 22, 7, 0, 0, Math.PI * 2); outline(ctx, 1.5);
  }
  function boardStack(ctx, n) {
    for (let i = 0; i < n; i++) {
      const y = 44 - i * 10;
      rr(ctx, 8 + i * 2, y, 46, 9, 2); ctx.fillStyle = lg(ctx, 0, y, 0, y + 9, ['#d6a46a', '#a8743e']); ctx.fill(); outline(ctx);
      ctx.strokeStyle = 'rgba(90,50,20,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14 + i * 2, y + 4); ctx.lineTo(50, y + 5); ctx.stroke();
    }
  }
  function stoneWall(ctx, hole) {
    rr(ctx, 10, 10, 44, 44, 2); ctx.fillStyle = lg(ctx, 10, 0, 54, 0, ['#b3b7bb', '#7d8287']); ctx.fill(); outline(ctx);
    ctx.strokeStyle = 'rgba(30,30,30,0.5)'; ctx.lineWidth = 1.5;
    for (let r = 0; r < 4; r++) { const y = 10 + r * 11; ctx.beginPath(); ctx.moveTo(10, y + 11); ctx.lineTo(54, y + 11); ctx.stroke(); for (let x = 10 + (r % 2) * 7 + 14; x < 54; x += 14) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 11); ctx.stroke(); } }
    if (hole === 'door') { rr(ctx, 24, 24, 16, 30, 1); ctx.fillStyle = '#2a1c10'; ctx.fill(); }
    if (hole === 'win') { rr(ctx, 22, 22, 20, 16, 1); ctx.fillStyle = '#7fb8d8'; ctx.fill(); }
  }
  function ore(ctx, rock, spot) {
    ctx.beginPath(); ctx.moveTo(10, 44); ctx.lineTo(18, 18); ctx.lineTo(36, 10); ctx.lineTo(54, 22); ctx.lineTo(56, 44); ctx.lineTo(36, 54); ctx.closePath(); ctx.fillStyle = lg(ctx, 0, 10, 0, 54, rock); ctx.fill(); outline(ctx);
    ctx.fillStyle = spot; for (const [x, y, r] of [[24, 30, 5], [38, 24, 4], [42, 38, 6], [28, 44, 3.5], [33, 34, 3]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  }
  function ingot(ctx, cols) {
    ctx.beginPath(); ctx.moveTo(8, 44); ctx.lineTo(18, 26); ctx.lineTo(50, 26); ctx.lineTo(58, 44); ctx.closePath(); ctx.fillStyle = lg(ctx, 0, 26, 0, 44, cols); ctx.fill(); outline(ctx);
    ctx.beginPath(); ctx.moveTo(18, 26); ctx.lineTo(22, 18); ctx.lineTo(46, 18); ctx.lineTo(50, 26); ctx.closePath(); ctx.fillStyle = cols[0]; ctx.fill(); outline(ctx);
  }
  function wallIcon(ctx, hole) {
    rr(ctx, 10, 10, 44, 44, 2); ctx.fillStyle = lg(ctx, 10, 0, 54, 0, ['#c99558', '#9b6a36']); ctx.fill(); outline(ctx);
    ctx.strokeStyle = 'rgba(60,30,10,0.55)'; ctx.lineWidth = 1.5;
    for (let x = 21; x < 54; x += 11) { ctx.beginPath(); ctx.moveTo(x, 11); ctx.lineTo(x, 53); ctx.stroke(); }
    if (hole === 'door') { rr(ctx, 24, 24, 16, 30, 1); ctx.fillStyle = '#2a1c10'; ctx.fill(); }
    if (hole === 'win') { rr(ctx, 22, 22, 20, 16, 1); ctx.fillStyle = '#7fb8d8'; ctx.fill(); ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, 22); ctx.lineTo(32, 38); ctx.moveTo(22, 30); ctx.lineTo(42, 30); ctx.stroke(); }
  }

  function blueprint(c, kind) {
    rr(c, 8, 10, 48, 44, 3); c.fillStyle = lg(c, 0, 10, 0, 54, ['#3a6ea8', '#22487a']); c.fill(); outline(c);
    c.strokeStyle = 'rgba(220,235,255,0.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(14, 38); c.quadraticCurveTo(32, 48, 50, 38); c.stroke();
    if (kind === 'canoa') { c.beginPath(); c.moveTo(14, 38); c.lineTo(50, 38); c.stroke(); }
    if (kind === 'cat') { c.beginPath(); c.moveTo(14, 44); c.quadraticCurveTo(32, 52, 50, 44); c.moveTo(32, 38); c.lineTo(32, 14); c.lineTo(46, 34); c.stroke(); }
    if (kind === 'gal') { for (const x of [22, 32, 42]) { c.beginPath(); c.moveTo(x, 38); c.lineTo(x, 14); c.stroke(); c.strokeRect(x - 5, 18, 10, 8); } }
    c.fillStyle = 'rgba(220,235,255,0.5)'; for (let x = 12; x < 54; x += 6) c.fillRect(x, 12, 1, 40);
  }
  const PAINT = {
    tronco(c) { rr(c, 8, 22, 40, 22, 6); c.fillStyle = lg(c, 0, 22, 0, 44, ['#7a5530', '#5a3a1e', '#3e2614']); c.fill(); outline(c);
      c.beginPath(); c.ellipse(48, 33, 9, 11, 0, 0, 7); c.fillStyle = '#d9b07a'; c.fill(); outline(c);
      c.strokeStyle = '#a77a45'; c.lineWidth = 1.3; for (let r = 3; r < 10; r += 3) { c.beginPath(); c.ellipse(48, 33, r * 0.8, r, 0, 0, 7); c.stroke(); }
      c.strokeStyle = 'rgba(30,18,8,0.5)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(12, 27 + i * 4); c.lineTo(40, 26 + i * 4.5); c.stroke(); } },
    assi(c) { boardStack(c, 3); },
    bastone(c) { stick(c, 14, 52, 50, 12, 5); },
    fibra(c) { c.lineCap = 'round'; for (let i = 0; i < 9; i++) { c.strokeStyle = `hsl(${70 + i * 4},45%,${38 + (i % 3) * 8}%)`; c.lineWidth = 2.5; c.beginPath(); c.moveTo(24 + i * 2, 54); c.quadraticCurveTo(10 + i * 5, 30, 18 + i * 4, 10 + (i % 3) * 3); c.stroke(); } c.fillStyle = '#8a6a3a'; rr(c, 22, 38, 20, 6, 2); c.fill(); outline(c, 1.5); },
    corda(c) { c.lineWidth = 6; c.strokeStyle = 'rgba(20,14,8,0.8)'; c.beginPath(); c.ellipse(32, 32, 18, 14, 0, 0, 7); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#c8a46a'; c.stroke();
      c.lineWidth = 6; c.strokeStyle = 'rgba(20,14,8,0.8)'; c.beginPath(); c.ellipse(32, 32, 11, 8, 0, 0, 7); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#d8b47a'; c.stroke();
      c.strokeStyle = 'rgba(120,80,30,0.7)'; c.lineWidth = 1; for (let a = 0; a < 6.28; a += 0.4) { c.beginPath(); c.moveTo(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 12.5); c.lineTo(32 + Math.cos(a + 0.2) * 20, 32 + Math.sin(a + 0.2) * 15.5); c.stroke(); } },
    pietra(c) { stoneHead(c, [12, 40, 20, 18, 38, 12, 54, 24, 52, 46, 30, 52]); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(20, 20); c.lineTo(36, 15); c.lineTo(30, 28); c.fill(); },
    foglie(c) { for (let i = 0; i < 5; i++) { c.save(); c.translate(32, 36); c.rotate(-1.2 + i * 0.6); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(8, -12, 0, -26); c.quadraticCurveTo(-8, -12, 0, 0); c.fillStyle = `hsl(${95 + i * 6},50%,${32 + i * 3}%)`; c.fill(); outline(c, 1.5); c.restore(); } },
    lana(c) { for (const [x, y, r] of [[24, 36, 12], [40, 36, 12], [32, 26, 12], [32, 42, 10]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rg(c, x, y, r, ['#ffffff', '#ece6da', '#c9c0b0']); c.fill(); outline(c, 1.5); } },
    stoffa(c) { c.save(); c.translate(32, 32); c.rotate(-0.15); rr(c, -22, -18, 44, 36, 3); c.fillStyle = lg(c, -22, 0, 22, 0, ['#efe6cf', '#d9ccb0']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(120,100,70,0.35)'; c.lineWidth = 1; for (let i = -18; i < 22; i += 4) { c.beginPath(); c.moveTo(-22, i); c.lineTo(22, i); c.stroke(); } c.restore(); },
    piume(c) { c.save(); c.translate(32, 32); c.rotate(0.6); c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(14, 0, 0, -26); c.quadraticCurveTo(-14, 0, 0, 26); c.fillStyle = lg(c, -10, 0, 10, 0, ['#f6f2ea', '#d8d0c2']); c.fill(); outline(c, 1.5); c.strokeStyle = '#9a8f80'; c.beginPath(); c.moveTo(0, 28); c.lineTo(0, -24); c.stroke(); c.restore(); },
    conchiglia(c) { c.beginPath(); c.moveTo(32, 52); for (let a = -1.3; a <= 1.3; a += 0.26) c.lineTo(32 + Math.sin(a) * 24, 48 - Math.cos(a) * 34); c.closePath(); c.fillStyle = lg(c, 0, 14, 0, 52, ['#fbe1cf', '#f0b494', '#d98c6a']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(150,80,50,0.5)'; for (let a = -1.0; a <= 1.0; a += 0.26) { c.beginPath(); c.moveTo(32, 52); c.lineTo(32 + Math.sin(a) * 22, 48 - Math.cos(a) * 31); c.stroke(); } },
    cocco(c) { c.beginPath(); c.arc(32, 34, 20, 0, 7); c.fillStyle = rg(c, 32, 34, 20, ['#8a6238', '#5a3a1e', '#3a2410']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(30,18,8,0.5)'; c.lineWidth = 1; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(32, 34, 18, i * 0.6, i * 0.6 + 0.35); c.stroke(); }
      for (const [x, y] of [[26, 26], [34, 24], [30, 31]]) { c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fillStyle = '#26170a'; c.fill(); } },
    bacche(c) { c.strokeStyle = '#3f6b24'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 10); c.lineTo(30, 26); c.stroke(); c.beginPath(); c.moveTo(32, 10); c.quadraticCurveTo(44, 8, 46, 16); c.quadraticCurveTo(38, 18, 32, 10); c.fillStyle = '#4f8a2e'; c.fill();
      for (const [x, y] of [[24, 32], [36, 30], [30, 42], [42, 42], [20, 44], [32, 52]]) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fillStyle = rg(c, x, y, 7, ['#ff6b8a', '#c41e48', '#7a0a26']); c.fill(); outline(c, 1.3); } },
    arco(c) { c.lineWidth = 6; c.lineCap = 'round'; c.strokeStyle = 'rgba(20,14,8,0.8)'; c.beginPath(); c.arc(8, 32, 30, -1.05, 1.05); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#a5743e'; c.stroke();
      c.strokeStyle = '#efe6d0'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(8 + Math.cos(-1.05) * 30, 32 + Math.sin(-1.05) * 30); c.lineTo(8 + Math.cos(1.05) * 30, 32 + Math.sin(1.05) * 30); c.stroke();
      c.fillStyle = '#5a3a1e'; c.fillRect(34, 27, 6, 10); },
    freccia(c) { stick(c, 12, 52, 50, 14, 3, '#c9a06a'); c.beginPath(); c.moveTo(50, 14); c.lineTo(56, 6); c.lineTo(44, 12); c.closePath(); c.fillStyle = '#8a8780'; c.fill(); outline(c, 1.5);
      c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(12, 52); c.lineTo(8, 44); c.lineTo(18, 46); c.closePath(); c.fill(); c.beginPath(); c.moveTo(12, 52); c.lineTo(20, 56); c.lineTo(18, 46); c.closePath(); c.fill(); },
    lancia(c) { stick(c, 10, 56, 48, 16, 4); c.beginPath(); c.moveTo(48, 16); c.lineTo(58, 4); c.lineTo(52, 20); c.closePath(); c.fillStyle = lg(c, 46, 4, 58, 20, ['#c9c4ba', '#77746e']); c.fill(); outline(c, 1.5); c.fillStyle = '#c8a46a'; c.fillRect(42, 18, 6, 6); },
    sciabola(c) { c.beginPath(); c.moveTo(18, 46); c.quadraticCurveTo(30, 18, 54, 8); c.quadraticCurveTo(36, 26, 24, 50); c.closePath(); c.fillStyle = lg(c, 20, 10, 50, 50, ['#f2f4f6', '#a9b0b8', '#6c737a']); c.fill(); outline(c, 1.5);
      c.strokeStyle = '#c9a25e'; c.lineWidth = 3; c.beginPath(); c.arc(18, 48, 8, 3.6, 5.8); c.stroke(); stick(c, 8, 58, 18, 47, 5, '#5a3720'); },
    pistola(c) { c.save(); c.translate(32, 32); c.rotate(-0.25); c.fillStyle = lg(c, 0, -6, 0, 6, ['#9aa0a6', '#4c5258']); c.fillRect(-6, -10, 30, 7); outline(c, 1.2);
      c.beginPath(); c.moveTo(-8, -10); c.lineTo(-2, -10); c.lineTo(-6, 14); c.lineTo(-18, 14); c.quadraticCurveTo(-16, 0, -8, -10); c.fillStyle = lg(c, -18, 0, 0, 0, ['#7a4e26', '#4a2c14']); c.fill(); outline(c); c.fillStyle = '#c9a25e'; c.fillRect(-4, -12, 4, 4); c.restore(); },
    pistola_capitano(c) { PAINT.pistola(c); c.fillStyle = '#f2d26a'; for (const [x, y] of [[22, 40], [26, 36]]) { c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); } c.strokeStyle = '#f2d26a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(30, 28); c.lineTo(52, 22); c.stroke(); },
    munizioni(c) { c.fillStyle = lg(c, 0, 20, 0, 54, ['#b98b52', '#7a5530']); c.beginPath(); c.moveTo(18, 24); c.lineTo(46, 24); c.lineTo(42, 54); c.lineTo(22, 54); c.closePath(); c.fill(); outline(c);
      for (const [x, y] of [[26, 20], [34, 18], [40, 21], [30, 14]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fillStyle = rg(c, x, y, 4, ['#d4d8dc', '#6b7076', '#3a3d41']); c.fill(); outline(c, 1); } },
    pala(c) { stick(c, 14, 54, 40, 20, 4); c.save(); c.translate(46, 14); c.rotate(0.9); c.beginPath(); c.moveTo(-8, -4); c.lineTo(8, -4); c.quadraticCurveTo(9, 10, 0, 16); c.quadraticCurveTo(-9, 10, -8, -4); c.fillStyle = lg(c, -8, 0, 8, 0, ['#c9c4ba', '#77746e']); c.fill(); outline(c); c.restore(); },
    doblone(c) { for (const [x, y] of [[26, 40], [38, 36], [32, 26]]) { c.beginPath(); c.ellipse(x, y, 13, 11, 0, 0, 7); c.fillStyle = rg(c, x, y, 13, ['#fff1a8', '#e2b43c', '#9a6e12']); c.fill(); outline(c, 1.5); c.strokeStyle = 'rgba(120,80,10,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, 8, 7, 0, 0, 7); c.stroke(); } },
    perla(c) { c.beginPath(); c.ellipse(32, 38, 20, 10, 0, 0, Math.PI); c.fillStyle = '#d9cfc0'; c.fill(); outline(c, 1.2); c.beginPath(); c.arc(32, 32, 11, 0, 7); c.fillStyle = rg(c, 32, 32, 11, ['#ffffff', '#f0ece6', '#bdb6c8']); c.fill(); outline(c, 1.2); },
    pelle(c) { c.beginPath(); c.moveTo(14, 18); c.quadraticCurveTo(32, 10, 50, 18); c.lineTo(54, 30); c.quadraticCurveTo(50, 48, 40, 52); c.lineTo(24, 52); c.quadraticCurveTo(14, 48, 10, 30); c.closePath(); c.fillStyle = lg(c, 0, 14, 0, 52, ['#a07a50', '#6a4a2c']); c.fill(); outline(c); },
    dente_squalo(c) { c.beginPath(); c.moveTo(18, 50); c.quadraticCurveTo(26, 30, 34, 8); c.quadraticCurveTo(40, 30, 48, 50); c.quadraticCurveTo(33, 44, 18, 50); c.fillStyle = lg(c, 0, 8, 0, 50, ['#ffffff', '#e6e0d2', '#bfb6a0']); c.fill(); outline(c); },
    mappa_tesoro(c) { c.beginPath(); c.moveTo(10, 14); c.lineTo(54, 10); c.lineTo(52, 52); c.lineTo(12, 54); c.closePath(); c.fillStyle = lg(c, 10, 10, 54, 54, ['#f0dfb0', '#d6b878', '#b8935a']); c.fill(); outline(c);
      c.strokeStyle = '#7a5530'; c.setLineDash([3, 3]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(16, 44); c.quadraticCurveTo(28, 26, 40, 30); c.stroke(); c.setLineDash([]); c.strokeStyle = '#b02a1a'; c.lineWidth = 3; c.beginPath(); c.moveTo(38, 22); c.lineTo(48, 32); c.moveTo(48, 22); c.lineTo(38, 32); c.stroke(); },
    pacco(c) { rr(c, 12, 18, 40, 32, 3); c.fillStyle = lg(c, 0, 18, 0, 50, ['#c99a62', '#8a6236']); c.fill(); outline(c); c.strokeStyle = '#e6d6b0'; c.lineWidth = 3; c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 50); c.moveTo(12, 32); c.lineTo(52, 32); c.stroke(); },
    bussola_oro(c) { c.beginPath(); c.arc(32, 32, 22, 0, 7); c.fillStyle = rg(c, 32, 32, 22, ['#fff1a8', '#e2b43c', '#8a5e0e']); c.fill(); outline(c); c.beginPath(); c.arc(32, 32, 16, 0, 7); c.fillStyle = '#f4ecd8'; c.fill();
      c.beginPath(); c.moveTo(32, 18); c.lineTo(36, 32); c.lineTo(32, 46); c.lineTo(28, 32); c.closePath(); c.fillStyle = '#b02a1a'; c.fill(); c.beginPath(); c.moveTo(32, 32); c.lineTo(36, 32); c.lineTo(32, 46); c.lineTo(28, 32); c.fillStyle = '#2a2a2a'; c.fill(); },
    cannocchiale(c) { c.save(); c.translate(32, 32); c.rotate(-0.6); for (const [x, w, h, col] of [[-22, 14, 14, '#7a4e26'], [-8, 14, 12, '#c9a25e'], [6, 14, 10, '#7a4e26'], [20, 6, 9, '#c9a25e']]) { c.fillStyle = col; c.fillRect(x, -h / 2, w, h); c.strokeStyle = 'rgba(18,14,10,.7)'; c.lineWidth = 1.5; c.strokeRect(x, -h / 2, w, h); } c.restore(); },
    vela_leggendaria(c) { stick(c, 22, 58, 22, 6, 3, '#7a4e26'); c.beginPath(); c.moveTo(24, 8); c.quadraticCurveTo(56, 20, 50, 50); c.lineTo(24, 50); c.closePath(); c.fillStyle = lg(c, 24, 8, 50, 50, ['#fff7d8', '#f0d27a', '#c9902a']); c.fill(); outline(c);
      c.fillStyle = '#b02a1a'; c.beginPath(); c.arc(36, 30, 5, 0, 7); c.fill(); },
    pinne(c) { for (const s of [-1, 1]) { c.save(); c.translate(32 + s * 10, 36); c.rotate(s * 0.25); c.beginPath(); c.moveTo(-6, -16); c.lineTo(6, -16); c.lineTo(10, 18); c.lineTo(-10, 18); c.closePath(); c.fillStyle = lg(c, 0, -16, 0, 18, ['#3fa9c9', '#1d6f8a']); c.fill(); outline(c); c.restore(); }
      rr(c, 16, 6, 32, 12, 5); c.fillStyle = 'rgba(160,220,240,0.85)'; c.fill(); outline(c, 1.5); },
    lanterna(c) { rr(c, 20, 16, 24, 34, 4); c.fillStyle = rg(c, 32, 34, 18, ['#fff8c0', '#ffc94a', '#c06a10']); c.fill(); outline(c); c.strokeStyle = '#2a2a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 16); c.lineTo(32, 50); c.moveTo(20, 33); c.lineTo(44, 33); c.stroke();
      c.beginPath(); c.arc(32, 12, 6, Math.PI, 0); c.stroke(); c.fillStyle = '#3a3a3a'; c.fillRect(18, 48, 28, 5); },
    progetto_canoa(c) { blueprint(c, 'canoa'); }, progetto_catamarano(c) { blueprint(c, 'cat'); }, progetto_galeone(c) { blueprint(c, 'gal'); },
    cannone(c) { c.save(); c.translate(32, 34); c.rotate(-0.4); c.fillStyle = lg(c, 0, -8, 0, 8, ['#6a6e74', '#2a2d31']); c.fillRect(-20, -7, 40, 14); outline(c); c.beginPath(); c.arc(-20, 0, 8, 0, 7); c.fill(); outline(c); c.restore();
      for (const x of [20, 42]) { c.beginPath(); c.arc(x, 48, 7, 0, 7); c.fillStyle = '#7a4e26'; c.fill(); outline(c); } },
    polpa_cactus(c) { c.beginPath(); c.ellipse(32, 34, 17, 21, 0.3, 0, 7); c.fillStyle = rg(c, 30, 30, 22, ['#c9e39a', '#7fae4e', '#4f7a2a']); c.fill(); outline(c); c.fillStyle = '#e9f5d0'; for (const [x, y] of [[26, 26], [36, 30], [30, 40], [40, 42], [24, 36]]) { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); } },
    funghi(c) { for (const [x, y, r, col] of [[24, 40, 13, '#a8673a'], [42, 34, 11, '#c08550']]) { c.fillStyle = '#efe6d4'; c.fillRect(x - 3, y, 6, 16); outline(c, 1.2); c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, Math.PI, 0); c.closePath(); c.fillStyle = rg(c, x, y - 4, r, [col, '#6a3a1a']); c.fill(); outline(c); } },
    funghi_cotti(c) { for (const [x, y, r] of [[24, 40, 13], [42, 34, 11]]) { c.fillStyle = '#c9a070'; c.fillRect(x - 3, y, 6, 16); outline(c, 1.2); c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, Math.PI, 0); c.closePath(); c.fillStyle = rg(c, x, y - 4, r, ['#8a4e22', '#4a240c']); c.fill(); outline(c); } },
    uovo(c) { c.beginPath(); c.ellipse(32, 34, 15, 19, 0, 0, 7); c.fillStyle = rg(c, 32, 34, 19, ['#fffaf0', '#efe2c8', '#cdb994']); c.fill(); outline(c); },
    uovo_cotto(c) { c.beginPath(); for (let a = 0; a < 6.3; a += 0.3) { const r = 22 + Math.sin(a * 5) * 3; c.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r * 0.8); } c.closePath(); c.fillStyle = '#fbf8f0'; c.fill(); outline(c); c.beginPath(); c.arc(30, 32, 9, 0, 7); c.fillStyle = rg(c, 30, 32, 9, ['#ffe27a', '#f4b324', '#d98a10']); c.fill(); },
    pollo_crudo(c) { meat(c, false, '#f6c2b0'); }, pollo_cotto(c) { meat(c, true); },
    montone_crudo(c) { meat(c, false, '#ef8f8f'); }, montone_cotto(c) { meat(c, true); },
    manzo_crudo(c) { meat(c, false, '#e86a6a'); }, manzo_cotto(c) { meat(c, true); },
    coniglio_crudo(c) { meat(c, false, '#f2a6a0'); }, coniglio_cotto(c) { meat(c, true); },
    maiale_crudo(c) { meat(c, false, '#f6b0b8'); }, maiale_cotto(c) { meat(c, true); },
    pesce_crudo(c) { fish(c, false); }, pesce_cotto(c) { fish(c, true); },
    ciotola(c) { bowl(c); },
    ciotola_salata(c) { bowl(c, '#4a8fae'); c.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 5; i++) { c.fillRect(20 + i * 5, 28 + (i % 2) * 2, 2, 2); } },
    ciotola_acqua(c) { bowl(c, '#6cc6ea'); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(26, 29, 6, 1.6, 0, 0, 7); c.fill(); },
    ascia(c) { stick(c, 18, 56, 44, 10, 5); stoneHead(c, [36, 10, 54, 6, 58, 24, 50, 30, 40, 22]); },
    piccone(c) { stick(c, 16, 56, 42, 16, 5); c.beginPath(); c.moveTo(14, 18); c.quadraticCurveTo(36, 2, 58, 22); c.lineTo(54, 26); c.quadraticCurveTo(38, 12, 18, 24); c.closePath(); c.fillStyle = lg(c, 0, 6, 0, 26, ['#c4c1b9', '#7c7972']); c.fill(); outline(c); },
    coltello(c) { stick(c, 14, 54, 28, 40, 6, '#6b4524'); stoneHead(c, [26, 40, 52, 10, 56, 14, 32, 44]); },
    canna(c) { stick(c, 10, 58, 50, 8, 4); c.strokeStyle = 'rgba(230,230,230,0.9)'; c.lineWidth = 1; c.beginPath(); c.moveTo(50, 8); c.quadraticCurveTo(58, 30, 54, 50); c.stroke(); c.beginPath(); c.arc(54, 50, 3.5, 0, 7); c.fillStyle = '#e04030'; c.fill(); outline(c, 1); },
    libro(c) { rr(c, 12, 10, 40, 46, 3); c.fillStyle = lg(c, 12, 0, 52, 0, ['#5a2a1a', '#7a3a22', '#5a2a1a']); c.fill(); outline(c);
      c.fillStyle = '#efe2c0'; c.fillRect(48, 13, 4, 40); c.strokeStyle = '#c9a25e'; c.lineWidth = 2; c.beginPath(); c.arc(32, 32, 9, 0, 7); c.moveTo(32, 21); c.lineTo(32, 43); c.moveTo(21, 32); c.lineTo(43, 32); c.stroke(); },
    banco(c) { rr(c, 8, 18, 48, 12, 2); c.fillStyle = lg(c, 0, 18, 0, 30, ['#d6a46a', '#9b6a36']); c.fill(); outline(c);
      for (const x of [12, 46]) { rr(c, x, 30, 6, 24, 1); c.fillStyle = '#7a4e26'; c.fill(); outline(c, 1.5); }
      c.strokeStyle = 'rgba(60,30,10,0.6)'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(8 + i * 9.6, 18); c.lineTo(8 + i * 9.6, 30); c.stroke(); }
      stick(c, 20, 14, 34, 10, 3, '#8a8a8a'); },
    falo(c) { for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(14 + i * 7.2, 52, 5, 0, 7); c.fillStyle = '#7c7972'; c.fill(); outline(c, 1.2); }
      stick(c, 16, 50, 44, 38, 5, '#6b4524'); stick(c, 48, 50, 20, 38, 5, '#7a5530');
      c.beginPath(); c.moveTo(20, 46); c.quadraticCurveTo(18, 24, 32, 8); c.quadraticCurveTo(46, 24, 44, 46); c.closePath(); c.fillStyle = lg(c, 0, 8, 0, 46, ['#ffe27a', '#ff9a2e', '#e2461e']); c.fill();
      c.beginPath(); c.moveTo(26, 46); c.quadraticCurveTo(26, 32, 32, 22); c.quadraticCurveTo(38, 32, 38, 46); c.fillStyle = '#fff4b8'; c.fill(); },
    baule(c) { rr(c, 8, 18, 48, 36, 3); c.fillStyle = lg(c, 0, 18, 0, 54, ['#b07a46', '#7a4e26']); c.fill(); outline(c);
      c.fillStyle = '#5a3a1e'; c.fillRect(8, 28, 48, 4); c.fillStyle = '#c9a25e'; rr(c, 28, 26, 8, 10, 1); c.fill(); outline(c, 1.2);
      c.strokeStyle = 'rgba(60,30,10,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(8, 42); c.lineTo(56, 42); c.stroke(); },
    letto(c) { rr(c, 6, 30, 52, 16, 2); c.fillStyle = '#8a5a2e'; c.fill(); outline(c); rr(c, 8, 24, 48, 10, 3); c.fillStyle = '#b8443a'; c.fill(); outline(c, 1.5); rr(c, 10, 20, 14, 8, 3); c.fillStyle = '#f4efe4'; c.fill(); outline(c, 1.5);
      c.fillStyle = '#6b4524'; c.fillRect(8, 46, 5, 10); c.fillRect(51, 46, 5, 10); },
    torcia(c) { stick(c, 26, 58, 36, 22, 6, '#7a5530'); c.fillStyle = '#5a3a1e'; c.fillRect(30, 20, 10, 6); c.beginPath(); c.moveTo(28, 22); c.quadraticCurveTo(24, 8, 36, 2); c.quadraticCurveTo(46, 12, 42, 22); c.closePath(); c.fillStyle = lg(c, 0, 2, 0, 22, ['#fff4b8', '#ffb84a', '#e2461e']); c.fill(); },
    pavimento(c) { c.save(); c.translate(32, 36); c.scale(1, 0.55); c.rotate(Math.PI / 4); rr(c, -22, -22, 44, 44, 2); c.fillStyle = lg(c, -22, 0, 22, 0, ['#d6a46a', '#a8743e']); c.fill(); outline(c, 3);
      c.strokeStyle = 'rgba(60,30,10,0.55)'; c.lineWidth = 2; for (let i = -12; i < 22; i += 11) { c.beginPath(); c.moveTo(i, -22); c.lineTo(i, 22); c.stroke(); } c.restore(); c.fillStyle = '#7a4e26'; c.fillRect(28, 46, 8, 10); },
    muro(c) { wallIcon(c); }, muro_porta(c) { wallIcon(c, 'door'); }, muro_finestra(c) { wallIcon(c, 'win'); },
    porta(c) { rr(c, 18, 8, 28, 48, 2); c.fillStyle = lg(c, 18, 0, 46, 0, ['#a8743e', '#7a4e26']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(40,20,8,0.6)'; c.lineWidth = 2; c.strokeRect(22, 12, 20, 18); c.strokeRect(22, 34, 20, 18); c.beginPath(); c.arc(40, 32, 2.5, 0, 7); c.fillStyle = '#c9a25e'; c.fill(); },
    tetto(c) { c.beginPath(); c.moveTo(4, 46); c.lineTo(32, 14); c.lineTo(60, 46); c.closePath(); c.fillStyle = lg(c, 0, 14, 0, 46, ['#8a5a2e', '#5a3a1e']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(20,10,4,0.5)'; c.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const y = 14 + i * 8; const dx = (y - 14) * 28 / 32; c.beginPath(); c.moveTo(32 - dx, y); c.lineTo(32 + dx, y); c.stroke(); } },
    recinto(c) { for (const x of [12, 30, 48]) { c.beginPath(); c.moveTo(x, 54); c.lineTo(x, 16); c.lineTo(x + 3, 12); c.lineTo(x + 6, 16); c.lineTo(x + 6, 54); c.closePath(); c.fillStyle = '#b07a46'; c.fill(); outline(c, 1.5); }
      for (const y of [24, 40]) { rr(c, 8, y, 50, 6, 1); c.fillStyle = '#9b6a36'; c.fill(); outline(c, 1.5); } },
    scala(c) { for (let i = 0; i < 4; i++) { rr(c, 10 + i * 10, 46 - i * 10, 44 - i * 10, 8, 1); c.fillStyle = lg(c, 0, 0, 64, 0, ['#d6a46a', '#a8743e']); c.fill(); outline(c, 1.5); } },
    albero_barca(c) { stick(c, 32, 60, 32, 4, 7, '#8a5a2e'); stick(c, 14, 18, 50, 18, 4, '#7a4e26'); c.beginPath(); c.arc(32, 6, 4, 0, 7); c.fillStyle = '#c9a25e'; c.fill(); },
    vela(c) { stick(c, 14, 8, 14, 58, 4, '#7a4e26'); c.beginPath(); c.moveTo(16, 10); c.quadraticCurveTo(52, 22, 50, 54); c.lineTo(16, 54); c.closePath(); c.fillStyle = lg(c, 16, 0, 50, 0, ['#f4ecd8', '#d8ccb0']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(120,100,70,0.4)'; c.lineWidth = 1; for (let y = 20; y < 54; y += 8) { c.beginPath(); c.moveTo(16, y); c.lineTo(16 + (y - 10) * 0.75, y); c.stroke(); } },
    remo(c) { stick(c, 12, 56, 40, 20, 4, '#9a6b3c'); c.save(); c.translate(46, 14); c.rotate(-0.9); c.beginPath(); c.ellipse(0, 0, 6, 14, 0, 0, 7); c.fillStyle = lg(c, -6, 0, 6, 0, ['#d6a46a', '#9b6a36']); c.fill(); outline(c); c.restore(); },
    timone(c) { stick(c, 22, 6, 22, 30, 4, '#7a4e26'); c.beginPath(); c.moveTo(18, 26); c.lineTo(48, 30); c.quadraticCurveTo(52, 50, 40, 58); c.lineTo(18, 58); c.closePath(); c.fillStyle = lg(c, 18, 0, 50, 0, ['#c99558', '#8a5a2e']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(60,30,10,0.5)'; c.lineWidth = 1; for (let y = 34; y < 58; y += 7) { c.beginPath(); c.moveTo(18, y); c.lineTo(46, y + 1); c.stroke(); } },
  };

  // icone dei nuovi oggetti
  Object.assign(PAINT, {
    cappello_lana(c) { c.beginPath(); c.moveTo(12, 44); c.quadraticCurveTo(12, 14, 32, 14); c.quadraticCurveTo(52, 14, 52, 44); c.closePath(); c.fillStyle = lg(c, 0, 14, 0, 44, ['#d65a4a', '#8e2e28']); c.fill(); outline(c);
      rr(c, 10, 40, 44, 10, 4); c.fillStyle = '#efe6d4'; c.fill(); outline(c, 1.5); c.beginPath(); c.arc(32, 12, 6, 0, 7); c.fillStyle = '#efe6d4'; c.fill(); outline(c, 1.5); },
    maglione_lana(c) { c.beginPath(); c.moveTo(20, 12); c.lineTo(44, 12); c.lineTo(58, 24); c.lineTo(52, 32); c.lineTo(46, 28); c.lineTo(46, 54); c.lineTo(18, 54); c.lineTo(18, 28); c.lineTo(12, 32); c.lineTo(6, 24); c.closePath(); c.fillStyle = lg(c, 0, 12, 0, 54, ['#5a86b0', '#2c4c70']); c.fill(); outline(c);
      c.strokeStyle = '#e9e2d2'; c.lineWidth = 2; for (const y of [34, 42]) { c.beginPath(); c.moveTo(18, y); c.lineTo(46, y); c.stroke(); } },
    mantello_pelle(c) { c.beginPath(); c.moveTo(22, 10); c.lineTo(42, 10); c.quadraticCurveTo(56, 34, 54, 56); c.lineTo(10, 56); c.quadraticCurveTo(8, 34, 22, 10); c.closePath(); c.fillStyle = lg(c, 0, 10, 0, 56, ['#a77a4c', '#5e3e22']); c.fill(); outline(c); c.beginPath(); c.arc(32, 14, 3, 0, 7); c.fillStyle = '#d8b46a'; c.fill(); },
    stivali_pelle(c) { for (const x of [14, 34]) { c.beginPath(); c.moveTo(x, 10); c.lineTo(x + 12, 10); c.lineTo(x + 12, 40); c.lineTo(x + 20, 46); c.lineTo(x + 20, 54); c.lineTo(x, 54); c.closePath(); c.fillStyle = lg(c, 0, 10, 0, 54, ['#8a5e36', '#4e321c']); c.fill(); outline(c, 1.5); } },
    cappello_paglia(c) { c.beginPath(); c.ellipse(32, 40, 28, 9, 0, 0, 7); c.fillStyle = '#e3c272'; c.fill(); outline(c, 1.5); c.beginPath(); c.moveTo(18, 40); c.quadraticCurveTo(18, 16, 32, 16); c.quadraticCurveTo(46, 16, 46, 40); c.closePath(); c.fillStyle = lg(c, 0, 16, 0, 40, ['#f0d488', '#c9a24c']); c.fill(); outline(c); c.fillStyle = '#9a3a2a'; c.fillRect(18, 33, 28, 4); },
    scudo(c) { c.beginPath(); c.moveTo(32, 6); c.lineTo(54, 14); c.quadraticCurveTo(54, 44, 32, 58); c.quadraticCurveTo(10, 44, 10, 14); c.closePath(); c.fillStyle = lg(c, 0, 0, 64, 0, ['#b9844e', '#7a4e26']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(40,20,8,0.6)'; c.lineWidth = 1.5; for (const x of [21, 32, 43]) { c.beginPath(); c.moveTo(x, 10); c.lineTo(x, 52); c.stroke(); } c.beginPath(); c.arc(32, 30, 7, 0, 7); c.fillStyle = '#9a9890'; c.fill(); outline(c, 1.5); },
    trappola(c) { c.beginPath(); c.ellipse(32, 44, 24, 8, 0, 0, 7); c.fillStyle = '#6a6660'; c.fill(); outline(c, 1.5); c.strokeStyle = '#3a3834'; c.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = 12 + i * 5; c.beginPath(); c.moveTo(x, 44); c.lineTo(x + 2, 22 + Math.abs(i - 4) * 2); c.stroke(); } stick(c, 10, 44, 54, 44, 3, '#8a5a2e'); },
    terra(c) { c.beginPath(); c.moveTo(10, 46); c.quadraticCurveTo(14, 22, 32, 20); c.quadraticCurveTo(52, 22, 54, 46); c.closePath(); c.fillStyle = rg(c, 32, 30, 26, ['#8a6440', '#5a3e24', '#3a2716']); c.fill(); outline(c); c.fillStyle = 'rgba(30,20,10,0.5)'; for (const [x, y] of [[24, 34], [38, 30], [30, 40], [44, 40]]) { c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); } },
    carbone(c) { for (const [x, y, r] of [[24, 38, 13], [40, 34, 12], [32, 24, 10]]) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047 + x; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9); } c.closePath(); c.fillStyle = lg(c, 0, y - r, 0, y + r, ['#4a4a4e', '#18181a']); c.fill(); outline(c, 1.5); } },
    ossidiana(c) { c.beginPath(); c.moveTo(32, 8); c.lineTo(50, 26); c.lineTo(42, 56); c.lineTo(20, 52); c.lineTo(14, 24); c.closePath(); c.fillStyle = lg(c, 14, 8, 50, 56, ['#5a4a70', '#120e18', '#2a2236']); c.fill(); outline(c); c.strokeStyle = 'rgba(200,180,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(30, 14); c.lineTo(22, 44); c.stroke(); },
    coltello_ossidiana(c) { stick(c, 14, 54, 28, 38, 5, '#7a4e26'); c.beginPath(); c.moveTo(26, 40); c.lineTo(50, 10); c.lineTo(34, 42); c.closePath(); c.fillStyle = lg(c, 26, 40, 50, 10, ['#2a2236', '#6a5a88']); c.fill(); outline(c); },
    // pietra
    muro_pietra(c) { stoneWall(c); }, muro_porta_pietra(c) { stoneWall(c, 'door'); }, muro_finestra_pietra(c) { stoneWall(c, 'win'); },
    pavimento_pietra(c) { c.save(); c.translate(32, 36); c.scale(1, 0.55); c.rotate(Math.PI / 4); rr(c, -22, -22, 44, 44, 2); c.fillStyle = lg(c, -22, 0, 22, 0, ['#a9adb1', '#7d8287']); c.fill(); outline(c, 3);
      c.strokeStyle = 'rgba(30,30,30,0.5)'; c.lineWidth = 2; for (let i = -11; i < 22; i += 11) { c.beginPath(); c.moveTo(i, -22); c.lineTo(i, 22); c.moveTo(-22, i); c.lineTo(22, i); c.stroke(); } c.restore(); },
    tetto_pietra(c) { c.beginPath(); c.moveTo(4, 46); c.lineTo(32, 14); c.lineTo(60, 46); c.closePath(); c.fillStyle = lg(c, 0, 14, 0, 46, ['#5d6a75', '#36404a']); c.fill(); outline(c);
      c.strokeStyle = 'rgba(10,15,20,0.6)'; c.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const y = 14 + i * 8; const dx = (y - 14) * 28 / 32; c.beginPath(); c.moveTo(32 - dx, y); c.lineTo(32 + dx, y); c.stroke(); for (let x = -dx + 6; x < dx; x += 8) { c.beginPath(); c.moveTo(32 + x, y); c.lineTo(32 + x, y + 8); c.stroke(); } } },
    scala_pietra(c) { for (let i = 0; i < 4; i++) { rr(c, 10 + i * 10, 46 - i * 10, 44 - i * 10, 8, 1); c.fillStyle = lg(c, 0, 0, 64, 0, ['#b3b7bb', '#7d8287']); c.fill(); outline(c, 1.5); } },
    pilastro(c) { rr(c, 22, 6, 20, 52, 2); c.fillStyle = lg(c, 22, 0, 42, 0, ['#b3b7bb', '#80858a', '#6b7075']); c.fill(); outline(c); c.strokeStyle = 'rgba(30,30,30,0.45)'; c.lineWidth = 1.5; for (let y = 16; y < 58; y += 10) { c.beginPath(); c.moveTo(22, y); c.lineTo(42, y); c.stroke(); } },
    camino(c) { stoneWall(c); rr(c, 20, 30, 24, 22, 3); c.fillStyle = '#1e1410'; c.fill(); c.beginPath(); c.moveTo(24, 52); c.quadraticCurveTo(26, 38, 32, 32); c.quadraticCurveTo(38, 38, 40, 52); c.closePath(); c.fillStyle = lg(c, 0, 32, 0, 52, ['#ffe27a', '#ff9a2e', '#e2461e']); c.fill(); },
    fornace(c) { c.beginPath(); c.moveTo(12, 56); c.lineTo(16, 14); c.quadraticCurveTo(32, 4, 48, 14); c.lineTo(52, 56); c.closePath(); c.fillStyle = lg(c, 12, 0, 52, 0, ['#a9adb1', '#7d8287', '#62676c']); c.fill(); outline(c);
      rr(c, 24, 34, 16, 14, 4); c.fillStyle = rg(c, 32, 42, 10, ['#fff0a0', '#ff9a2e', '#a33b12']); c.fill(); outline(c, 1.5); c.fillStyle = '#4a4f54'; c.fillRect(28, 6, 8, 8); },
    // minerali e metalli
    ferro_grezzo(c) { ore(c, ['#8e8a84', '#5e5b56'], '#b0613c'); }, oro_grezzo(c) { ore(c, ['#8e8a84', '#5e5b56'], '#f0c43c'); },
    lingotto_ferro(c) { ingot(c, ['#d4d8dc', '#8a9096', '#5c6268']); }, lingotto_oro(c) { ingot(c, ['#fff2a8', '#e9b531', '#a87412']); },
    chiodi(c) { for (const [x, a] of [[22, -0.25], [32, 0.05], [42, 0.3]]) { c.save(); c.translate(x, 34); c.rotate(a); rr(c, -2, -16, 4, 30, 1); c.fillStyle = lg(c, -2, 0, 2, 0, ['#c4c8cc', '#6c7278']); c.fill(); outline(c, 1.2); rr(c, -6, -19, 12, 4, 1); c.fillStyle = '#9aa0a6'; c.fill(); outline(c, 1.2); c.restore(); } },
    piccone_ferro(c) { stick(c, 16, 56, 42, 16, 5); c.beginPath(); c.moveTo(14, 18); c.quadraticCurveTo(36, 2, 58, 22); c.lineTo(54, 26); c.quadraticCurveTo(38, 12, 18, 24); c.closePath(); c.fillStyle = lg(c, 0, 6, 0, 26, ['#e2e6ea', '#8a9096']); c.fill(); outline(c); },
    ascia_ferro(c) { stick(c, 18, 56, 44, 10, 5); c.beginPath(); c.moveTo(36, 10); c.lineTo(54, 4); c.quadraticCurveTo(62, 16, 54, 32); c.lineTo(40, 22); c.closePath(); c.fillStyle = lg(c, 36, 0, 60, 30, ['#e2e6ea', '#8a9096']); c.fill(); outline(c); },
    pala_ferro(c) { stick(c, 20, 58, 38, 22, 5); c.beginPath(); c.moveTo(34, 26); c.lineTo(48, 6); c.quadraticCurveTo(58, 8, 56, 18); c.lineTo(42, 32); c.closePath(); c.fillStyle = lg(c, 34, 0, 58, 30, ['#e2e6ea', '#8a9096']); c.fill(); outline(c); },
    spada_ferro(c) { c.beginPath(); c.moveTo(20, 44); c.lineTo(50, 8); c.lineTo(56, 8); c.lineTo(56, 14); c.lineTo(24, 48); c.closePath(); c.fillStyle = lg(c, 20, 44, 56, 8, ['#8a9096', '#eef2f6']); c.fill(); outline(c);
      stick(c, 14, 40, 30, 54, 4, '#5a5f64'); stick(c, 10, 58, 20, 48, 5, '#6b4524'); },
    fasciame(c) { for (let i = 0; i < 3; i++) { rr(c, 8, 16 + i * 12, 48, 10, 2); c.fillStyle = lg(c, 8, 0, 56, 0, ['#b98a55', '#8a5c30']); c.fill(); outline(c, 1.5); } c.fillStyle = '#5a5f64'; for (const y of [21, 33, 45]) for (const x of [14, 50]) { c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); } },
    ponte_barca(c) { c.save(); c.translate(32, 36); c.scale(1, 0.55); c.rotate(Math.PI / 4); rr(c, -20, -20, 40, 40, 2); c.fillStyle = lg(c, -20, 0, 20, 0, ['#d6a46a', '#b08050']); c.fill(); outline(c, 3); c.strokeStyle = 'rgba(60,30,10,0.55)'; c.lineWidth = 2; for (let i = -10; i < 20; i += 10) { c.beginPath(); c.moveTo(i, -20); c.lineTo(i, 20); c.stroke(); } c.restore(); },
    zavorra(c) { rr(c, 10, 22, 44, 30, 6); c.fillStyle = lg(c, 0, 22, 0, 52, ['#9a9ea3', '#5f6368']); c.fill(); outline(c); c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = 'bold 13px sans-serif'; c.fillText('280', 20, 42); },
    panca(c) { rr(c, 8, 26, 48, 8, 2); c.fillStyle = '#b08050'; c.fill(); outline(c, 1.5); for (const x of [12, 46]) { rr(c, x, 34, 6, 18, 1); c.fillStyle = '#7a4e26'; c.fill(); outline(c, 1.2); } },
  });
  G.icon = function (id) {
    if (G.iconCache[id]) return G.iconCache[id];
    const cv = document.createElement('canvas'); cv.width = cv.height = ICON;
    const ctx = cv.getContext('2d');
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
    (PAINT[id] || PAINT.pietra)(ctx);
    const url = cv.toDataURL();
    G.iconCache[id] = url;
    return url;
  };
})();
