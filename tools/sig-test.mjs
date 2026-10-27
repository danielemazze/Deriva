// prova del solo server dei codici (PeerJS), senza browser
const URL = 'wss://0.peerjs.com:443/peerjs';
const r = () => Math.random().toString(36).slice(2, 10);
function conn(id, name) {
  return new Promise((res) => {
    const ws = new WebSocket(`${URL}?key=peerjs&id=${id}&token=${r()}&version=1.5.4`);
    const c = { ws, got: [] };
    ws.onmessage = (e) => { const m = JSON.parse(e.data); c.got.push(m.type + (m.payload && m.payload.msg ? ':' + m.payload.msg : '')); console.log(name, '<-', e.data.slice(0, 160)); if (m.type === 'OPEN') res(c); };
    ws.onclose = (e) => console.log(name, 'chiuso', e.code, e.reason);
    ws.onerror = (e) => console.log(name, 'errore');
  });
}
const a = 'deriva3-' + r().slice(0, 6), b = 'deriva-g-' + r();
const A = await conn(a, 'A'); const B = await conn(b, 'B');
B.ws.send(JSON.stringify({ type: 'OFFER', dst: a, payload: { sdp: 'v=0 prova', cid: 'dc_x', type: 'data', connectionId: 'dc_x', label: 'dc_x', reliable: true, serialization: 'raw' } }));
B.ws.send(JSON.stringify({ type: 'CANDIDATE', dst: a, payload: { candidate: { candidate: 'x' }, cid: 'dc_x' } }));
await new Promise((x) => setTimeout(x, 3000));
// variante con il formato ufficiale di PeerJS (sdp come oggetto)
B.ws.send(JSON.stringify({ type: 'OFFER', dst: a, payload: { sdp: { type: 'offer', sdp: 'v=0 prova' }, type: 'data', connectionId: 'dc_y', label: 'dc_y', reliable: true, serialization: 'binary', browser: 'chrome' } }));
await new Promise((x) => setTimeout(x, 3000));
console.log('RISULTATO A ha ricevuto:', A.got.join(','), '| B:', B.got.join(','), '| B aperto:', B.ws.readyState === 1);
process.exit(0);
