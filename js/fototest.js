/* =========================================================
   Prova fotografica automatica (solo con Deriva.exe --fototest):
   gira per il mondo, scatta le foto senza interfaccia, misura gli
   FPS, scrive tutto nella cartella indicata e chiude il gioco.
   ========================================================= */
(function () {
  const D = window.deriva; if (!D || !D.fotoTest) return;
  const FT = D.fotoTest, tag = FT.tag;
  const log = (t) => D.ftLog(`[${tag}] ${t}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fr = (n, dt) => { for (let i = 0; i < n; i++) G.frame(performance.now(), dt || 0.05); };
  const find = (fn) => { for (let r = 10; r < 900; r += 3) for (let a = 0; a < 6.28; a += 0.2) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (fn(x, z, G.heightAt(x, z))) return [x, z]; } return null; };
  const tp = (x, y, z, yaw, pitch) => { const P = G.Player; P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = pitch; G.World.update(x, z, 2000); };
  const face = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
  async function shot(name) {
    G.noRender = false; G.frame(performance.now(), 0.02); G.frame(performance.now(), 0.02);
    const url = G.renderer.domElement.toDataURL('image/jpeg', 0.9);
    await D.ftShot(`${name}_${tag}`, url);
  }
  const warm = (n) => { G.noRender = true; fr(n); G.noRender = false; };
  async function run() {
    try {
      log(`avvio · scheda video: ${G.gpu || '?'} · qualità ${G.settings.preset} · shaders ${G.settings.shaders ? 'on' : 'off'} · texture ${G.ACG && G.ACG.on ? (G.ACG.res === 2048 ? '2K' : '1K') : 'vecchie'} · finestra ${innerWidth}x${innerHeight}`);
      G.pauseLoop = true;
      G.startGame(true, false, { name: 'Prova foto', seed: 'ladro3' });
      G.Climate.setWeather('sereno', true, true); G.time = Math.floor(G.time) + 0.36; G.UI.toast = () => {}; G.setWind(3);
      G.UI.hideMenu(); for (const id of ['hud', 'hints', 'toasts']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
      warm(6);
      // prato e bosco
      { const f = find((x, z, h) => h > 4 && h < 9 && G.heightAt(x + 25, z) > h - 3 && G.heightAt(x - 25, z) > h - 3); tp(f[0], G.World.groundAt(f[0], f[1]), f[1], 0.7, -0.3); warm(40); await shot('01_prato'); G.Player.pitch = -0.95; warm(2); await shot('02_terreno_vicino'); }
      // bosco in controluce
      { const P = G.Player, pu = G._post.post.uniforms; let best = -9, by = 0; for (let a = 0; a < 6.28; a += 0.26) { P.yaw = a; P.pitch = 0.08; G.frame(performance.now(), 0.001); const s = pu.uSunScreen.value, sc = pu.uSunVis.value - Math.abs(s.x - 0.68); if (sc > best) { best = sc; by = a; } } P.yaw = by; P.pitch = 0.06; warm(3); await shot('03_controluce'); }
      // spiaggia e mare
      { const f = find((x, z, h) => h > 0.4 && h < 1.1 && G.heightAt(x + 30, z) > 8); tp(f[0], G.World.groundAt(f[0], f[1]), f[1], -Math.PI / 2, -0.12); warm(40); await shot('04_spiaggia'); }
      { const f = find((x, z, h) => h > 3 && h < 6 && G.heightAt(x + 40, z) < -6); tp(f[0], G.World.groundAt(f[0], f[1]), f[1], -Math.PI / 2, -0.08); warm(40); await shot('05_mare'); }
      { const f = find((x, z, h) => h > 22 && h < 40); tp(f[0], G.World.groundAt(f[0], f[1]), f[1], 0, -0.14); let best = 0, by = 0; for (let a = 0; a < 6.28; a += 0.3) { let s = 0; for (let r = 20; r < 160; r += 20) s += G.heightAt(f[0] - Math.sin(a) * r, f[1] - Math.cos(a) * r) < -2 ? 1 : 0; if (s > best) { best = s; by = a; } } G.Player.yaw = by + 0.5; warm(50); await shot('06_paesaggio'); }
      // luoghi
      const place = async (t, name, dy, pitch) => { try { G.Cmd.goPlace(t); const P = G.Player; P.yaw += dy || 0; P.pitch = pitch === undefined ? -0.05 : pitch; warm(45); await shot(name); } catch (e) { log(name + ': ' + e); } };
      await place('castello', '07_castello', 0, 0.05);
      await place('accampamento', '08_accampamento', 0, -0.12);
      try { G.Cmd.goPlace('miniera'); const P = G.Player; P.pos.x += Math.sin(P.yaw) * 9; P.pos.z += Math.cos(P.yaw) * 9; P.pos.y = G.World.groundAt(P.pos.x, P.pos.z) + 1.5; P.pitch = -0.12; warm(45); await shot('09_miniera'); } catch (e) { log('miniera: ' + e); }
      await place('rovina', '10_rovine', 0.2);
      await place('covo', '11_covo_pirati', 0.2);
      await place('faro', '12_faro', 0, 0.12);
      // villaggio
      let vil = null;
      { const P = G.Player; vil = G.POI.near(P.pos.x, P.pos.z, 9000, 'village').filter((v) => v.inhabited).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0];
        let best = null; for (const r of [30, 38, 46]) for (let a = 0; a < 6.28; a += 0.39) { const x = vil.x + Math.cos(a) * r, z = vil.z + Math.sin(a) * r, g = G.World.groundAt(x, z); if (g < 1.5) continue; if (G.Build.groundAt(x, z, g + 3, 0.3) > g + 0.3) continue; if (!best) best = [x, z, g]; }
        tp(best[0], best[2] + 0.1, best[1], face(best[0], best[1], vil.x, vil.z), -0.05); warm(50); await shot('13_villaggio');
        tp(vil.x + 3, G.World.groundAt(vil.x + 3, vil.z + 3) + 0.1, vil.z + 3, 0.8, 0.02); warm(30); await shot('14_piazza');
        const c = G.Build.pieces.filter((p) => p.gen && p.t === 'baule' && /^c:v/.test(p.id))[0];
        if (c) { const x = c.x + Math.sin(c.rot || 0) * 1.6, z = c.z + Math.cos(c.rot || 0) * 1.6; tp(x, c.y + 0.05, z, face(x, z, c.x, c.z), -0.42); warm(10); await shot('15_baule'); } }
      // galeone
      { const P = G.Player; let best = null; for (let r = 1500; r < 12000 && !best; r += 250) for (let a = 0; a < 6.28 && !best; a += 0.4) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (G.heightAt(x, z) < -35) { let ok = true; for (let q = 0; q < 6.28 && ok; q += 0.5) for (const rr of [60, 120]) if (G.heightAt(x + Math.cos(q) * rr, z + Math.sin(q) * rr) > -4) ok = false; if (ok) best = [x, z]; } }
        const parts = G.Boats.parts('galeone'), b = G.Boats.create({ tpl: 'galeone', x: best[0], z: best[1], yaw: 0.3, filled: parts.map(() => true) }); b.anchored = true; b.meshes.forEach((m, i) => { m.material = G.Boats.matFor(parts[i]); });
        tp(best[0], G.SEA + 2, best[1], 0, 0); P.boardBoat(b); warm(12);
        P.local.set(0.6, b.T.deck, b.T.L * 0.36); P.yaw = b.yaw; P.pitch = 0.12; warm(3); await shot('16_ponte_nave');
        P.local.set(-(G.Boats.deckHalfW(b.T, 0) - 1.6), b.T.deck, -1.0); P.yaw = b.yaw - Math.PI / 2 + 0.5; P.pitch = -0.35; warm(3); await shot('17_cannoni');
        P.takeHelm(); P.cam3 = true; P.yaw = b.yaw + Math.PI + 0.95; P.pitch = -0.05; warm(4); await shot('18_galeone');
        P.takeHelm(); P.cam3 = false; }
      // tramonto e notte al villaggio
      { tp(vil.x + 3, G.World.groundAt(vil.x + 3, vil.z + 3) + 0.1, vil.z + 3, 0.8, 0.02); G.time = Math.floor(G.time) + 0.74; warm(40); await shot('19_tramonto'); G.time = Math.floor(G.time) + 0.95; warm(40); await shot('20_notte'); }
      // FPS veri: il gioco gira da solo per 10 secondi nel villaggio, di giorno
      G.time = Math.floor(G.time) + 0.45; G.Player.yaw += 0.6; G.pauseLoop = false;
      await wait(3000);
      let n = 0, t0 = performance.now(), worst = 0, prev = t0; const cnt = () => { const now = performance.now(); worst = Math.max(worst, now - prev); prev = now; n++; if (now - t0 < 10000) requestAnimationFrame(cnt); };
      requestAnimationFrame(cnt); await wait(10600);
      log(`FPS medi ${(n / ((prev - t0) / 1000)).toFixed(1)} · fotogramma più lento ${worst.toFixed(0)} ms · risoluzione di disegno ${G.rtSize ? G.rtSize.join('x') : '?'}`);
      log('fatto');
    } catch (e) { log('ERRORE: ' + (e && e.stack || e)); }
    D.ftQuit();
  }
  const go = () => { if (G.ready) setTimeout(run, 1500); else setTimeout(go, 300); };
  window.addEventListener('error', (e) => log('errore pagina: ' + e.message));
  setTimeout(() => { log('tempo scaduto (8 minuti): chiudo'); D.ftQuit(); }, 480000);
  go();
})();
