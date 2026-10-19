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
import { PORT as DEFAULT_PORT, SOCKET_PATH } from '../shared/config';
import { initPhysics } from '../shared/sim/world';
import { Room } from './room';
import { COURSES, COURSE_PATH, type CourseSpec } from '../shared/courses';
import { DIFFICULTIES, LENGTHS, type Difficulty, type WorldLength } from '../shared/rooms/world-maker';
import { openTunnel, type TunnelHandle } from './tunnel';
import QRCode from 'qrcode';

/** The door number. Change it with `npm start -- --port=3100` (or the PORT setting). */
const portArg = process.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1];
const PORT = Number(portArg) || Number(process.env.PORT) || DEFAULT_PORT;

/** Reads a `--name=value` setting from the command line. */
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

/**
 * Which course to play. Change it with `npm start -- --course=lab` (names are in shared/courses.ts).
 * 🎲 `--course=random` = a new random world every round. Add `--difficulty=easy|medium|hard`,
 * `--length=short|normal|long`, or `--seed=123` to always play that one world.
 */
const courseArg = arg('course') ?? 'random'; // (the host can change it in the lobby)
if (courseArg !== 'random' && !COURSES[courseArg]) {
  console.error(`❌ No course called "${courseArg}". Try one of: random, ${Object.keys(COURSES).join(', ')}`);
  process.exit(1);
}
const difficulty = (arg('difficulty') ?? 'medium') as Difficulty;
const length = (arg('length') ?? 'normal') as WorldLength;
if (!DIFFICULTIES.includes(difficulty) || !LENGTHS.includes(length)) {
  console.error(`❌ Difficulty must be ${DIFFICULTIES.join(' / ')} and length ${LENGTHS.join(' / ')}.`);
  process.exit(1);
}
const COURSE: CourseSpec & { difficulty: Difficulty; length: WorldLength } =
  courseArg === 'random'
    ? { id: 'random', seed: Number(arg('seed')) || 0, difficulty, length }
    : { id: courseArg, difficulty, length };

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
  // The page asks which course is on, so it draws the same one the server plays.
  if (urlPath === COURSE_PATH) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }).end(JSON.stringify(room.courseSpec));
    return;
  }
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

const room = new Room(COURSE);
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

/** Prints a QR code in the terminal: scan it with a phone camera to open the link. */
async function printQr(url: string) {
  const qr = await QRCode.toString(url, { type: 'terminal', small: true });
  console.log(qr.replace(/^/gm, '   '));
}

// `npm run start:local` = Wi-Fi only, no internet tunnel.
const localOnly = process.argv.includes('--local');

// The door (port) is already taken — almost always because Knot Alone is already running.
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error('');
    console.error(`❌ Knot Alone can't start: door ${PORT} is already in use.`);
    console.error('   Is the game already running in another window? Close that one first (Ctrl+C), then try again.');
    console.error('');
    process.exit(1);
  }
  throw error;
});
wss.on('error', () => {}); // the same error also reaches the WebSocket server; it's handled above

server.listen(PORT, '0.0.0.0', async () => {
  const wifi = wifiAddresses();
  const wifiUrl = wifi[0] ? `http://${wifi[0].address}:${PORT}` : null;

  console.log('');
  console.log('🪢  Knot Alone server is running!');
  if (courseArg === 'random') console.log(`   Course: 🎲 a new random world every round (the host can change it in the lobby)`);
  else console.log(`   Course: ${COURSES[courseArg].name} (the host can change it in the lobby)`);
  console.log('');
  console.log(`   On this computer:   http://localhost:${PORT}`);
  for (const { name, address } of wifi) {
    console.log(`   On the same Wi-Fi:  http://${address}:${PORT}   (${name})`);
  }
  console.log('');
  console.log('   Tip: join from your PHONE first to be the host 👑 (the first person to join is the host).');
  console.log('   Press Ctrl+C to stop.');
  console.log('');

  if (wifiUrl) room.setInvite({ url: wifiUrl, anywhere: false });

  if (localOnly || !wifiUrl) {
    if (wifiUrl) {
      console.log('📱 Scan this with your phone camera (same Wi-Fi):');
      await printQr(wifiUrl);
    }
    return;
  }

  console.log('🚇 Opening the internet tunnel so friends anywhere can join… (takes a few seconds)');
  tunnel = await openTunnel(
    PORT,
    async (url) => {
      room.setInvite({ url, anywhere: true });
      console.log('');
      console.log('🌍 Friends ANYWHERE in the world can join with this link:');
      console.log('');
      console.log(`   👉  ${url}`);
      console.log('');
      console.log('   Send it on WhatsApp / Discord, or scan this with your phone camera:');
      await printQr(url);
      console.log('   (The link changes every time you restart the server.)');
      console.log("   If a phone says \"site can't be reached\", wait a minute and try again, or try mobile data.");
      console.log('');
    },
    async (reason) => {
      console.log('');
      console.log(`⚠️  Couldn't open the internet tunnel: ${reason}`);
      console.log('   Friends on the same Wi-Fi can still join. Scan this with your phone camera:');
      await printQr(wifiUrl);
    },
  );
});

let tunnel: TunnelHandle | null = null;

// Close the tunnel nicely when the server stops (Ctrl+C).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    tunnel?.stop();
    process.exit(0);
  });
}
