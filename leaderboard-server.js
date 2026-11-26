// Veo Vanguard global leaderboard. No dependencies.  Run: node leaderboard-server.js
// Open the server's web address in a browser: players paste a score code there and it joins the global board.
const http = require('http'), fs = require('fs');
const FILE = process.env.DATA_FILE || './scores.json', PORT = process.env.PORT || 8787;
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CSALT = 'veo-vanguard-v1-7f3a';
let board = []; try { board = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { }
const hits = new Map(), save = () => fs.writeFile(FILE, JSON.stringify(board), () => { });
function chkOf(str) { let h = 2166136261; const s = str + CSALT; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h = (h ^ (h >>> 15)) >>> 0; let o = ''; for (let i = 0; i < 4; i++) { o += B32[h & 31]; h >>>= 5; } return o; }
function b32dec(s) { let bits = 0, v = 0; const out = []; for (const ch of s) { const i = B32.indexOf(ch); if (i < 0) return null; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; v &= (1 << bits) - 1; } } return out; }
function decode(txt) {
  let s = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (s.slice(0, 2) !== 'VV') return null; s = s.slice(2); if (s.length < 10) return null;
  const chk = s.slice(-4), bytes = b32dec(s.slice(0, -4)); if (!bytes) return null;
  const pay = String.fromCharCode.apply(null, bytes); if (chkOf(pay) !== chk) return null;
  const p = pay.split('~'); if (p.length !== 4) return null; const sc = +p[1], w = +p[2];
  if (!(sc > 0 && sc <= 1e9) || !(w >= 0 && w < 1e4) || !/^[A-Z0-9 _\-]{1,12}$/.test(p[0])) return null;
  return { n: p[0], s: sc, w, m: p[3] === 's' ? 'story' : 'endless', c: 'VV' + s };
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>VEO VANGUARD — Global Leaderboard</title>
<style>body{margin:0;background:#07051a;color:#cff;font-family:Segoe UI,system-ui,sans-serif;text-align:center;padding:1.2em}
h1{letter-spacing:.2em;color:#fff;text-shadow:0 0 .6em #38f2ff}textarea{width:min(34em,94%);height:4.5em;background:#000a;color:#ffe45e;border:1px solid #38f2ff;border-radius:.4em;padding:.6em;font:700 1em Consolas,monospace}
button{margin:.6em;padding:.7em 1.6em;background:#0b2a3a;color:#fff;border:1px solid #38f2ff;border-radius:.4em;font-weight:800;letter-spacing:.15em;cursor:pointer}
#msg{min-height:1.4em;color:#ffe45e}table{margin:1em auto;width:min(36em,96%);border-collapse:collapse}td{padding:.45em .6em;border-bottom:1px solid #38f2ff22;text-align:left}
td:nth-child(1){color:#ffe45e;width:2em}td:nth-child(3){text-align:right;color:#fff;font-variant-numeric:tabular-nums}td:nth-child(4){color:#9cc;font-size:.85em}</style>
<h1>VEO VANGUARD</h1><p>GLOBAL LEADERBOARD</p>
<p>Finished a run? Copy the <b>score code</b> from the game and paste it here:</p>
<textarea id=c placeholder="VV-XXXXX-XXXXX-…"></textarea><br><button onclick=add()>SUBMIT SCORE</button><div id=msg></div>
<table id=t></table>
<script>
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load(){try{const j=await (await fetch('/scores')).json();t.innerHTML=j.scores.slice(0,50).map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.n)+'</td><td>'+r.s.toLocaleString()+'</td><td>WAVE '+r.w+' · '+r.m.toUpperCase()+'</td></tr>').join('')||'<tr><td>No scores yet — be first!</td></tr>'}catch(e){msg.textContent='Could not load scores.'}}
async function add(){msg.textContent='Submitting…';try{const r=await fetch('/submit',{method:'POST',body:JSON.stringify({code:c.value})});const j=await r.json();msg.textContent=j.ok?(j.dup?'Already on the board.':'Score added! Rank #'+j.rank):(j.error||'Invalid code');if(j.ok){c.value='';load()}}catch(e){msg.textContent='Network error'}}
load();setInterval(load,30000)
</script>`;
http.createServer((req, res) => {
  const send = (c, o) => { res.writeHead(c, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') return send(204, {});
  if (req.method === 'GET' && req.url.startsWith('/scores')) return send(200, { scores: board.slice(0, 100).map(({ n, s, w, m }) => ({ n, s, w, m })) });
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  if (req.method === 'POST' && req.url === '/submit') {
    const ip = req.socket.remoteAddress, now = Date.now();
    if (now - (hits.get(ip) || 0) < 2000) return send(429, { error: 'Slow down — try again in a moment.' });
    hits.set(ip, now); if (hits.size > 5000) hits.clear();
    let b = ''; req.on('data', d => { b += d; if (b.length > 5000) req.destroy(); });
    req.on('end', () => {
      let code = ''; try { code = JSON.parse(b).code; } catch (e) { code = b; }
      const parts = String(code).split(/[\s,;]+(?=VV)/i).slice(0, 10); let added = 0, dup = 0, bad = 0, rank = 0;
      for (const t of parts) { const e = decode(t); if (!e) { bad++; continue; } if (board.some(x => x.c === e.c)) { dup++; continue; } e.t = now; board.push(e); added++; }
      board.sort((a, b) => b.s - a.s); board = board.slice(0, 500); if (added) save();
      if (!added && !dup) return send(400, { error: 'Invalid code. Check it was copied fully.' });
      const last = decode(parts[0]); rank = last ? board.findIndex(x => x.c === last.c) + 1 : 0;
      send(200, { ok: 1, added, dup: !added && dup > 0, rank });
    });
    return;
  }
  send(404, { error: 'not found' });
}).listen(PORT, () => console.log('Leaderboard on :' + PORT));
