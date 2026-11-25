// Neon Vanguard leaderboard server — no dependencies. Run: node leaderboard-server.js
// Deploy anywhere Node runs (Render, Railway, Fly.io, a VPS). Then in the game's HTML add,
// before the game script:  <script>window.NV_LEADERBOARD_URL="https://your-server.example.com"</script>
const http = require('http'), fs = require('fs');
const FILE = process.env.DATA_FILE || './scores.json', PORT = process.env.PORT || 8787;
let scores = []; try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { }
const hits = new Map();
const save = () => fs.writeFile(FILE, JSON.stringify(scores), () => { });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
http.createServer((req, res) => {
  const send = (c, o) => { res.writeHead(c, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') return send(204, {});
  if (req.method === 'GET' && req.url.startsWith('/scores')) return send(200, { scores: scores.slice(0, 100) });
  if (req.method === 'POST' && req.url === '/score') {
    const ip = req.socket.remoteAddress, now = Date.now();
    if (now - (hits.get(ip) || 0) < 3000) return send(429, { error: 'slow down' });
    hits.set(ip, now);
    let b = ''; req.on('data', d => { b += d; if (b.length > 2000) req.destroy(); });
    req.on('end', () => {
      try {
        const j = JSON.parse(b);
        const s = Math.floor(+j.s), w = Math.floor(+j.w) || 0;
        if (!(s > 0) || s > 1e9) return send(400, { error: 'bad score' });
        const n = String(j.n || 'PILOT').replace(/[^\w \-.]/g, '').slice(0, 12) || 'PILOT';
        scores.push({ n, s, w, m: j.m === 'story' ? 'story' : 'endless', t: now });
        scores.sort((a, b) => b.s - a.s); scores = scores.slice(0, 500); save(); send(200, { ok: 1 });
      } catch (e) { send(400, { error: 'bad json' }); }
    });
    return;
  }
  send(404, { error: 'not found' });
}).listen(PORT, () => console.log('Leaderboard on :' + PORT));
