// The boss 👑. Runs on the host's computer.
// Job 1: send the game page to anyone who opens the link.
// Job 2: keep a live connection (WebSocket) open with every player, and run the game room.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { PORT, SOCKET_PATH } from '../shared/config';
import { initPhysics } from '../shared/sim/world';
import { Room } from './room';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(ROOT, '../dist/client');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

if (!fs.existsSync(path.join(CLIENT_DIR, 'index.html'))) {
  console.error('❌ Game page not built yet. Run "npm start" (it builds first).');
  process.exit(1);
}

// ---------- Job 1: send the game files ----------

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let filePath = path.resolve(CLIENT_DIR, '.' + urlPath);

  // Never send files from outside the game folder.
  if (filePath !== CLIENT_DIR && !filePath.startsWith(CLIENT_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(CLIENT_DIR, 'index.html');
  }

  const type = MIME[path.extname(filePath)] ?? 'application/octet-stream';
  const headers: http.OutgoingHttpHeaders = {
    'Content-Type': type,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    Vary: 'Accept-Encoding',
  };

  // Squeeze text files before sending (the game code shrinks from ~5 MB to ~1.5 MB).
  const accepts = String(req.headers['accept-encoding'] ?? '');
  const encoding = /\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : null;
  if (encoding && COMPRESSIBLE.test(type)) {
    const body = compressed(filePath, encoding);
    res.writeHead(200, { ...headers, 'Content-Encoding': encoding, 'Content-Length': body.length });
    res.end(body);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

const COMPRESSIBLE = /^(text\/|application\/(json|wasm)|image\/svg)/;
const compressedCache = new Map<string, Buffer>();

/** Squeezes a file once, then remembers the result (until the file changes). */
function compressed(filePath: string, encoding: 'br' | 'gzip') {
  const key = `${encoding}:${filePath}:${fs.statSync(filePath).mtimeMs}`;
  let body = compressedCache.get(key);
  if (!body) {
    const raw = fs.readFileSync(filePath);
    body =
      encoding === 'br'
        ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } })
        : zlib.gzipSync(raw, { level: 9 });
    compressedCache.set(key, body);
  }
  return body;
}

// ---------- Job 2: live connection with players ----------

// The physics engine has to load before the room can run a game.
await initPhysics();

const room = new Room();
const wss = new WebSocketServer({ server, path: SOCKET_PATH });
wss.on('connection', (socket) => room.connect(socket));

// ---------- Start ----------

/** Local network addresses, Wi-Fi ones first (those are usually the right ones for phones). */
function wifiAddresses(): { name: string; address: string }[] {
  const found = Object.entries(os.networkInterfaces()).flatMap(([name, nets]) =>
    (nets ?? [])
      .filter((net) => net.family === 'IPv4' && !net.internal)
      .map((net) => ({ name, address: net.address })),
  );
  const isWifi = (name: string) => /wi-?fi|wlan|wireless/i.test(name);
  return found.sort((a, b) => Number(isWifi(b.name)) - Number(isWifi(a.name)));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🪢  Knot Alone server is running!');
  console.log('');
  console.log(`   On this computer:   http://localhost:${PORT}`);
  for (const { name, address } of wifiAddresses()) {
    console.log(`   On the same Wi-Fi:  http://${address}:${PORT}   (${name})`);
  }
  console.log('');
  console.log('   Press Ctrl+C to stop.');
  console.log('');
});
