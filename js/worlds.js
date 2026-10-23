'use strict';
/* ==========================================================
   Mondi: più salvataggi, esportazione e importazione
   Nella versione per computer i mondi sono file nella cartella
   dei dati (…\deriva\mondi); nel browser stanno nel localStorage.
   Un mondo esportato è un file .deriva che si apre su qualsiasi PC.
   ========================================================== */
(function () {
  const G = globalThis.G;
  const app = () => window.deriva && window.deriva.worlds;
  const IDX = 'deriva_worlds', KEY = (id) => 'deriva_w_' + id;
  const W = (G.Worlds = {});

  W.newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  W.list = function () {
    let l;
    if (app()) l = window.deriva.worlds.list() || [];
    else l = G.store.get(IDX) || [];
    return l.slice().sort((a, b) => (b.played || 0) - (a.played || 0));
  };
  W.read = function (id) {
    if (app()) { const s = window.deriva.worlds.read(id); try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
    return G.store.get(KEY(id));
  };
  W.meta = (id) => W.list().find((m) => m.id === id) || null;
  W.write = function (id, data, meta) {
    const json = JSON.stringify(data);
    const m = Object.assign({}, W.meta(id) || {}, meta || {}, { id, played: Date.now(), size: json.length });
    if (app()) return window.deriva.worlds.write(id, json, m);
    try {
      localStorage.setItem(KEY(id), json);
      const l = (G.store.get(IDX) || []).filter((x) => x.id !== id); l.push(m);
      G.store.set(IDX, l);
      return true;
    } catch (e) { return false; }
  };
  W.remove = function (id) {
    if (app()) return window.deriva.worlds.remove(id);
    try { localStorage.removeItem(KEY(id)); } catch (e) {}
    G.store.set(IDX, (G.store.get(IDX) || []).filter((x) => x.id !== id));
    return true;
  };
  W.rename = function (id, name) {
    const d = W.read(id); if (!d) return;
    d.name = name; W.write(id, d, { name });
  };

  /* ---- esportazione / importazione ---- */
  W.fileName = (name) => (name || 'mondo').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) + '.deriva';
  W.exportWorld = async function (id) {
    const m = W.meta(id), data = W.read(id);
    if (!m || !data) return { ok: false, error: 'Mondo non trovato' };
    const json = JSON.stringify({ deriva: 1, meta: { name: m.name, mode: m.mode, seed: m.seed, created: m.created }, data });
    if (app()) return window.deriva.worlds.exportFile(W.fileName(m.name), json);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = W.fileName(m.name); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return { ok: true };
  };
  // legge un file .deriva e lo aggiunge ai mondi (con un nuovo id, così non sovrascrive niente)
  W.importText = function (text) {
    let f; try { f = JSON.parse(text); } catch (e) { return { ok: false, error: 'Il file non è un mondo di Deriva' }; }
    const data = f && f.deriva ? f.data : f && f.seed !== undefined ? f : null;
    if (!data || data.seed === undefined) return { ok: false, error: 'Il file non è un mondo di Deriva' };
    const meta = (f && f.meta) || {};
    const id = W.newId();
    let name = meta.name || data.name || 'Mondo importato';
    if (W.list().some((x) => x.name === name)) name += ' (importato)';
    data.name = name;
    const ok = W.write(id, data, { name, mode: meta.mode || data.mode || 'sopravvivenza', seed: data.seed, created: meta.created || Date.now() });
    return ok ? { ok: true, id, name } : { ok: false, error: 'Spazio di salvataggio esaurito' };
  };
  W.importWorld = async function () {
    if (app()) {
      const r = await window.deriva.worlds.importFile();
      if (!r || !r.ok) return r || { ok: false };
      return W.importText(r.text);
    }
    return new Promise((res) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.deriva,.json,application/json';
      inp.onchange = () => {
        const file = inp.files && inp.files[0]; if (!file) return res({ ok: false });
        const rd = new FileReader(); rd.onload = () => res(W.importText(String(rd.result))); rd.onerror = () => res({ ok: false, error: 'Impossibile leggere il file' });
        rd.readAsText(file);
      };
      inp.click();
    });
  };

  // vecchio salvataggio unico -> primo mondo della lista
  W.migrate = function () {
    const old = G.store.get('deriva_save_v1');
    if (!old) return;
    if (!W.list().length) {
      const id = W.newId();
      old.name = old.name || 'Il mio arcipelago'; old.mode = old.mode || 'sopravvivenza';
      W.write(id, old, { name: old.name, mode: old.mode, seed: old.seed, created: Date.now() });
    }
    try { localStorage.removeItem('deriva_save_v1'); } catch (e) {}
  };
  W.MODE_N = { sopravvivenza: 'Sopravvivenza', creativa: 'Creativa' };
})();
