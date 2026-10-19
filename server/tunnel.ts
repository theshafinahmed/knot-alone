// The secret tunnel 🚇 — lets friends anywhere in the world reach this computer.
// Uses a free Cloudflare "Quick Tunnel": no account needed. Your computer calls out to
// Cloudflare, and Cloudflare gives back a public https link that leads here.
// The link is new every time the server starts.

import fs from 'node:fs';
import { Resolver } from 'node:dns/promises';
import { bin, install, Tunnel } from 'cloudflared';

/** The real cloudflared program is tens of MB. Anything smaller is a broken download. */
const MIN_PROGRAM_SIZE = 15_000_000;
/** Free quick tunnels sometimes fail to start (for example Cloudflare says "slow down"), so we try a few times. */
const ATTEMPTS = 3;
/** Give up on one attempt after this long (for example, no internet). */
const ATTEMPT_TIMEOUT = 30_000;
/** Longest we wait for a new link to reach the internet phone books, and the extra wait after. */
const LINK_WAIT_MAX = 60_000;
const LINK_EXTRA_WAIT = 10_000;

export interface TunnelHandle {
  stop: () => void;
}

/**
 * Opens a tunnel to the local server. Calls `onReady` with the public link once it works,
 * or `onFail` with a reason if it can't be opened (the game still works on Wi-Fi).
 * Never throws — a tunnel problem must never crash the game.
 */
export async function openTunnel(
  port: number,
  onReady: (url: string) => void,
  onFail: (reason: string) => void,
): Promise<TunnelHandle> {
  let current: Tunnel | null = null;
  let stopped = false;
  const handle: TunnelHandle = {
    stop: () => {
      stopped = true;
      current?.stop();
    },
  };

  try {
    await ensureProgram();
  } catch (error) {
    onFail(`couldn't download the tunnel program (${(error as Error).message})`);
    return handle;
  }

  for (let attempt = 1; attempt <= ATTEMPTS && !stopped; attempt++) {
    const result = await tryOnce(port, (tunnel) => (current = tunnel));
    if (result.ok) {
      console.log('   ⏳ Tunnel is up! Waiting for the link to be ready everywhere (about a minute)…');
      await waitForLink(result.url);
      onReady(result.url);
      return handle;
    }
    if (attempt < ATTEMPTS && !stopped) {
      const wait = attempt * 5;
      console.log(`   ⏳ Tunnel try ${attempt} didn't work (${result.reason}). Trying again in ${wait} s…`);
      await sleep(wait * 1000);
    } else {
      onFail(result.reason);
    }
  }
  return handle;
}

/**
 * A brand-new link takes a little while to reach every internet "phone book" (DNS).
 * If a phone opens it too early, its internet provider may remember "this doesn't exist"
 * for a few minutes. So we wait until Cloudflare's public phone book knows the link
 * (asking it doesn't confuse your provider's phone book), plus a little extra.
 */
async function waitForLink(url: string) {
  const host = new URL(url).hostname;
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  const started = Date.now();
  while (Date.now() - started < LINK_WAIT_MAX) {
    try {
      if ((await resolver.resolve4(host)).length > 0) {
        await sleep(LINK_EXTRA_WAIT);
        return;
      }
    } catch {
      // not there yet
    }
    await sleep(2000);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Downloads Cloudflare's official tunnel program once, and replaces it if a download got cut off. */
async function ensureProgram() {
  if (fs.existsSync(bin) && fs.statSync(bin).size < MIN_PROGRAM_SIZE) {
    console.log('   🧹 The tunnel program looks broken (half downloaded?). Downloading it again…');
    fs.rmSync(bin);
  }
  if (!fs.existsSync(bin)) {
    console.log('   📥 Downloading the Cloudflare tunnel program (only the first time, ~55 MB)…');
    await install(bin);
    if (fs.statSync(bin).size < MIN_PROGRAM_SIZE) {
      fs.rmSync(bin);
      throw new Error('the download was cut off — restart the server to try again');
    }
  }
}

type Attempt = { ok: true; url: string } | { ok: false; reason: string };

/** Starts the tunnel program once and waits until it's connected, fails, or times out. */
function tryOnce(port: number, started: (tunnel: Tunnel) => void): Promise<Attempt> {
  return new Promise((resolve) => {
    let tunnel: Tunnel;
    try {
      tunnel = Tunnel.quick(`http://localhost:${port}`, { '--no-autoupdate': true });
    } catch (error) {
      resolve({ ok: false, reason: `couldn't start the tunnel program (${(error as Error).message})` });
      return;
    }
    started(tunnel);

    let url: string | null = null;
    let done = false;
    let worked = false;
    // Remember the last error line the program printed, so we can say what went wrong.
    let lastError = '';
    const finish = (result: Attempt) => {
      if (done) return;
      done = true;
      worked = result.ok;
      clearTimeout(timer);
      if (!result.ok) tunnel.stop();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, reason: lastError || 'Cloudflare took too long to answer (is the internet on?)' }),
      ATTEMPT_TIMEOUT,
    );

    tunnel.on('stderr', (text) => {
      for (const line of text.split('\n')) {
        const match = line.match(/\b(ERR|error|failed)\b.*$/i);
        if (match) lastError = shorten(line.replace(/^\S+\s+(ERR|INF|WRN)\s+/, ''));
      }
    });
    tunnel.on('url', (found) => {
      url = found;
    });
    tunnel.on('connected', () => {
      // The link only works after the first connection to Cloudflare is up.
      if (url) finish({ ok: true, url });
    });
    tunnel.on('error', (error) => finish({ ok: false, reason: lastError || error.message }));
    tunnel.on('exit', (code) => {
      if (!done) finish({ ok: false, reason: lastError || `the tunnel program stopped (code ${code})` });
      else if (worked) {
        console.log('⚠️  The internet tunnel closed. Friends on the same Wi-Fi can still play. Restart to get a new link.');
      }
    });
  });
}

const shorten = (text: string) => (text.length > 160 ? `${text.slice(0, 157)}…` : text.trim());
