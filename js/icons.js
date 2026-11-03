/* =========================================================
   Simboli di Deriva: un'unica serie di icone disegnate a tratto
   (24×24, linea 1.8, estremi arrotondati), al posto delle emoji.
   G.ico(nome) → <svg> da mettere nell'HTML (prende il colore del testo)
   G.icoDraw(ctx, nome, x, y, misura, colore) → sulle mappe (canvas)
   ========================================================= */
(function () {
  const I = (G.ICONS = {
    sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    nuvola: '<path d="M7 18h10.5a4 4 0 00.6-7.95A5.5 5.5 0 007.4 8.6 4.7 4.7 0 007 18z"/>',
    pioggia: '<path d="M7 14.5h10.5a3.6 3.6 0 00.5-7.15A5 5 0 008.3 6.1 4.2 4.2 0 007 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
    temporale: '<path d="M7 14.5h10.5a3.6 3.6 0 00.5-7.15A5 5 0 008.3 6.1 4.2 4.2 0 007 14.5z"/><path d="M12.8 14l-2.3 3.6h3l-2.2 3.9"/>',
    caldo: '<path d="M12 21a5 5 0 01-2.6-9.3V5a2.6 2.6 0 015.2 0v6.7A5 5 0 0112 21z"/><path d="M12 16.5V9"/><path d="M18.5 4.5l1.5-1.5M19.5 8.5h2M18.5 12.5l1.5 1.5"/>',
    siccita: '<circle cx="16.5" cy="7" r="2.6"/><path d="M2.5 16c3-3 6-3 9.5 0s6.5 3 9.5 0"/><path d="M2.5 20c3-2 6-2 9.5 0s6.5 2 9.5 0"/>',
    vento: '<path d="M3 9h10.5a2.7 2.7 0 10-2.7-2.7"/><path d="M3 13.5h15a2.7 2.7 0 11-2.7 2.7"/><path d="M3 18h7"/>',
    neve: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
    goccia: '<path d="M12 3s6 6.6 6 11a6 6 0 01-12 0c0-4.4 6-11 6-11z"/><path d="M9.3 14.5a2.8 2.8 0 002.4 2.7"/>',
    grotta: '<path d="M2.5 20h19"/><path d="M4.5 20V13a7.5 7.5 0 0115 0v7"/><path d="M9 20v-5.5a3 3 0 016 0V20"/>',
    fuoco: '<path d="M12 21.5c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.9 1.8 1.8 2.6 3 3 .1-2.8 1.1-5 3.2-7.5.3 3.4 3.2 6.3 3.2 10.9 0 4.6-2.6 8.1-6.5 8.1z"/><path d="M12 21.5c-1.7 0-2.8-1.2-2.8-2.8 0-1.8 1.5-2.6 2.2-4.1 1.4 1.2 3.4 2.2 3.4 4.1 0 1.6-1.1 2.8-2.8 2.8z"/>',
    torcia: '<path d="M10.5 11h3l-.8 10.5h-1.4z"/><path d="M12 2.5c2 1.8 3 3.3 3 5a3 3 0 01-6 0c0-.9.4-1.7 1.1-2.4.3.9.8 1.4 1.4 1.5-.2-1.6.1-2.8.5-4.1z"/>',
    giacca: '<path d="M9 3.5L5 5.5 3 11l2.5 1L6 21h12l.5-9 2.5-1-2-5.5-4-2"/><path d="M9 3.5c.6 1.3 1.6 2 3 2s2.4-.7 3-2"/><path d="M12 5.5V21"/>',
    cappello: '<path d="M2.5 16.5c0 1.4 4.3 2.5 9.5 2.5s9.5-1.1 9.5-2.5-2.4-2-5-2.3"/><path d="M7.5 14.6V9.5C7.5 6.5 9.5 5 12 5s4.5 1.5 4.5 4.5v5.1c-1.3.5-2.8.7-4.5.7s-3.2-.2-4.5-.7z"/>',
    mano: '<path d="M8 12V5.5a1.5 1.5 0 013 0V11m0-6.5V4a1.5 1.5 0 013 0v7m0-5.5a1.5 1.5 0 013 0V13c0 4.5-2.5 8-6.5 8-3 0-4.7-1.7-6.2-4.6L3.5 13a1.5 1.5 0 012.6-1.4L8 14"/>',
    berretto: '<path d="M3.5 15.5c0-5 3.8-9 8.5-9s8.5 4 8.5 9"/><path d="M3.5 15.5h11.5c2.5 0 5.5.6 6.5 1.8"/><path d="M12 6.5V4.5"/>',
    stivale: '<path d="M7 3h6v9.5l5.5 2.5c1.5.7 2.5 1.8 2.5 3.4V21H5.5L7 12z"/><path d="M5.5 18h15.4"/>',
    cuore: '<path d="M12 20.5S3 15 3 9a4.7 4.7 0 019-1.9A4.7 4.7 0 0121 9c0 6-9 11.5-9 11.5z"/>',
    lucchetto: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/><path d="M12 14.5v2.5"/>',
    ancora: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M8 10.5h8"/><path d="M4 13.5c0 4.2 3.6 7.5 8 7.5s8-3.3 8-7.5"/><path d="M2.5 15l1.5-1.5 1.5 1.5M18.5 15l1.5-1.5 1.5 1.5"/>',
    sartie: '<path d="M12 2.5L4 21.5M12 2.5l8 19"/><path d="M8.2 11.5h7.6M6.5 15.5h11M10 7.2h4M4.8 19.5h14.4"/>',
    nota: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    scambio: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    scintilla: '<path d="M12 2.5c.6 4.6 2.9 6.9 7.5 9.5-4.6 2.6-6.9 4.9-7.5 9.5-.6-4.6-2.9-6.9-7.5-9.5C9.1 9.4 11.4 7.1 12 2.5z"/>',
    cavallo: '<path d="M7 21v-3.5c0-2.4 1.2-3.8 2.5-5.3L6.3 13 4 11.4l3.6-4.6C9 5 10 4 12.5 3.7l1-1.2 1 2c3.8 1.6 5.5 5.6 5.5 10V21z"/><circle cx="12" cy="7.5" r=".6" fill="currentColor"/>',
    stella: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    croce: '<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
    teschio: '<path d="M12 3a8 8 0 00-5 14.2V20h10v-2.8A8 8 0 0012 3z"/><circle cx="9" cy="11.5" r="1.8"/><circle cx="15" cy="11.5" r="1.8"/><path d="M12 14.5v1.5M10 20v-2M14 20v-2"/>',
    tenda: '<path d="M12 3.5L2.5 20.5h19z"/><path d="M12 3.5l-4 17M12 3.5l4 17"/><path d="M12 13.5l-2.3 7M12 13.5l2.3 7"/>',
    faro: '<path d="M9 21l1.2-12h3.6L15 21z"/><path d="M8.5 9h7l-1-2.5h-5z"/><path d="M12 3.5v3"/><path d="M3 5l4.5 2M21 5l-4.5 2"/><path d="M6.5 21h11"/><path d="M9.6 15h4.8"/>',
    rovine: '<path d="M3 21h18"/><path d="M5 21V8h3v13M5 8h3"/><path d="M11 21V12h3v9"/><path d="M17 21v-6.5l3-1V21"/><path d="M4 8l1.5-2h3L10 8"/><path d="M11 12l.5-1.5 1.5.6 1-.9"/>',
    piccone: '<path d="M4 6.5C7.5 3.3 13 2.2 18 3.3c-1.9 1-3.5 2.3-4.8 3.8"/><path d="M14.4 5.8l-10.4 13.7 1.5 1 10-14"/><path d="M15.5 6.5c1.6 1.2 2.8 3 3.5 5.5"/>',
    castello: '<path d="M3.5 21V8h3v2h2.5V8h3v2h2.5V8h3v13"/><path d="M3.5 21h14.5"/><path d="M8.5 21v-4.5a2.25 2.25 0 014.5 0V21"/><path d="M21 21V12h-3"/><path d="M19.5 12V9.5M18 9.5h3"/>',
    casa: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    spada: '<path d="M14.5 4.5h5v5L9 20l-5-5z" /><path d="M7 13.5l3.5 3.5"/><path d="M4 15l5 5M3 21l2.5-2.5"/>',
    scudo: '<path d="M12 3l7.5 2.7v5.6c0 4.7-3.2 8.3-7.5 9.7-4.3-1.4-7.5-5-7.5-9.7V5.7z"/><path d="M12 3v18M4.8 11h14.4"/>',
    esplosione: '<path d="M12 2.5l1.8 5.2 4.9-2.5-2.4 4.9 5.2 1.9-5.2 1.9 2.4 4.9-4.9-2.5-1.8 5.2-1.8-5.2-4.9 2.5 2.4-4.9L2.5 12l5.2-1.9-2.4-4.9 4.9 2.5z"/>',
    freccia: '<path d="M4 20L18.5 5.5"/><path d="M13 5.5h5.5V11"/><path d="M4 20v-3.5M4 20h3.5M6.5 17.5v-3M6.5 17.5h3"/>',
    corsa: '<path d="M4 6.5l5.5 5.5L4 17.5"/><path d="M12 6.5l5.5 5.5-5.5 5.5"/>',
    fiore: '<circle cx="12" cy="10" r="2.3"/><path d="M12 7.7c0-2.6 1.1-4.2 0-4.2s0 1.6 0 4.2zM14.2 8.6c2-1.8 3.8-2 3-2.8s-1 1-3 2.8zM14.3 11c2.6.2 4 1.5 4 .4s-1.4-.2-4-.4z" fill="currentColor"/><path d="M12 12.3V21M12 17c-2.7-.2-4.5-1.7-5-3.8 2.5 0 4.3 1.3 5 3.8zM12 15.5c1.8-.2 3.3-1.2 4-3 -2 .1-3.4 1-4 3z"/><path d="M9.8 8.6C7.8 6.8 6 6.6 6.8 5.8s1 1 3 2.8zM9.7 11c-2.6.2-4 1.5-4 .4s1.4-.2 4-.4z" fill="currentColor"/>',
    bussola: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    zampa: '<ellipse cx="12" cy="16.5" rx="4" ry="3.5"/><circle cx="6" cy="11" r="1.8"/><circle cx="9.5" cy="7" r="1.8"/><circle cx="14.5" cy="7" r="1.8"/><circle cx="18" cy="11" r="1.8"/>',
    zaino: '<path d="M7 8a5 5 0 0110 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1z"/><path d="M9.5 4.5V3h5v1.5"/><path d="M7 12h10"/><path d="M10 15h4v3h-4z"/>',
    persone: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 14c3 0 6 1.5 6 4.5"/>',
    gorgo: '<path d="M12 12a1.5 1.5 0 11-1.5-1.5c2.3 0 3.5 1.6 3.5 3.5a4 4 0 01-4 4 5.5 5.5 0 01-5.5-5.5A7 7 0 0111.5 5.5 8.5 8.5 0 0120 14"/>',
    kraken: '<path d="M7.5 11a4.5 4.5 0 019 0v2"/><path d="M7.5 11v2c0 1.5-1 3-3 3.5M9.5 13.5c0 2.5-.5 4.5-2.5 6M12 13.5V21M14.5 13.5c0 2.5.5 4.5 2.5 6M16.5 13c0 1.5 1 3 3 3.5"/><circle cx="10.3" cy="9.5" r=".7" fill="currentColor"/><circle cx="13.7" cy="9.5" r=".7" fill="currentColor"/>',
    bandiera: '<path d="M5 21V3.5"/><path d="M5 4h13l-2.5 4 2.5 4H5"/><circle cx="11" cy="7.5" r="1.4"/><path d="M9 10.2l4-1.2"/>',
    rombo: '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>',
    riparo: '<path d="M2.5 12L12 4l9.5 8"/><path d="M8.5 15.5c1.8 1.4 5.2 1.4 7 0"/><path d="M12 19.5v1"/>',
    luce: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.4 1.1 2.2V18h5v-2c0-.8.5-1.7 1.1-2.2A6 6 0 0012 3z"/>',
    occhio: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M3 21L21 3"/>',
    libro: '<path d="M12 6.5C10.2 5 7.6 4.5 3.5 4.5v14c4.1 0 6.7.5 8.5 2 1.8-1.5 4.4-2 8.5-2v-14c-4.1 0-6.7.5-8.5 2z"/><path d="M12 6.5v14"/>',
    frutto: '<path d="M12 8.5c-1.5-1.3-4.3-1.6-6 .2-2.4 2.6-1.4 8 1.2 10.6 1.4 1.4 3 1.7 4.8.7 1.8 1 3.4.7 4.8-.7 2.6-2.6 3.6-8 1.2-10.6-1.7-1.8-4.5-1.5-6-.2z"/><path d="M12 8.5c0-2 .5-3.6 2-5"/><path d="M12.6 5.5c1.6-.8 3.4-.6 4.6.4-1.5 1-3.2 1.1-4.6-.4z"/>',
    giro: '<path d="M20 12a8 8 0 11-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>',
  });
  // fasi della luna: un disco con la parte illuminata
  I.luna = (k) => {
    const f = ((k % 8) + 8) % 8, r = 8, c = 12;
    if (f === 0) return `<circle cx="12" cy="12" r="${r}"/>`;
    if (f === 4) return `<circle cx="12" cy="12" r="${r}" fill="currentColor"/>`;
    const lit = f < 4 ? 1 : -1, ph = f < 4 ? f / 4 : (8 - f) / 4, ex = Math.abs(Math.cos(ph * Math.PI)) * r, gib = ph > 0.5 ? 1 : 0;
    const d = `M${c} ${c - r}A${r} ${r} 0 0 ${lit > 0 ? 1 : 0} ${c} ${c + r}A${ex.toFixed(2)} ${r} 0 0 ${(lit > 0) === !!gib ? 1 : 0} ${c} ${c - r}z`;
    return `<circle cx="12" cy="12" r="${r}"/><path d="${d}" fill="currentColor" stroke="none"/>`;
  };
  const inner = (n) => { const v = I[n]; if (typeof v === 'function') return ''; return v || I.rombo; };
  G.ico = function (name, cls) {
    let body; const m = /^luna(\d)$/.exec(name); body = m ? I.luna(+m[1]) : inner(name);
    return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  };
  // per i canvas: l'icona diventa un'immagine (in cache per colore)
  const cache = {};
  G.icoDraw = function (ctx, name, x, y, size, color, halo) {
    const key = name + '|' + color + '|' + (halo || '');
    let im = cache[key];
    if (!im) {
      const m = /^luna(\d)$/.exec(name), body = m ? I.luna(+m[1]) : inner(name);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${halo ? `<g stroke="${halo}" stroke-width="4.2" opacity=".75">${body}</g>` : ''}<g stroke="${color}" stroke-width="2" color="${color}">${body.replace(/currentColor/g, color)}</g></svg>`;
      im = cache[key] = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
    if (im.complete && im.naturalWidth) ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
    return im.complete;
  };
})();
