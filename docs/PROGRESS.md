# 📍 Knot Alone — Where We Are

> **Read this first** at the start of every session. **Update it at the end** of every session.

## Right now

- **Current step:** Step 5 (Friends from anywhere) is **built and working**: Shafin's printed tunnel link works right away. Still to try: a friend on a *different* internet (or Shafin's phone on mobile data), to see if far-away play feels OK. **After that: Step 6, the real 5-minute course.** See [ROADMAP.md](ROADMAP.md).
- **Step 5 adds:** `npm start` now also opens a free Cloudflare tunnel and prints a public `https://….trycloudflare.com` link + a QR code. The lobby has a 📨 Invite button (QR + link + Share/Copy). `npm run start:local` = Wi-Fi only. You can run the server and play only from your phone: join from the phone first and you're the host.
- **What works:** `npm start` builds the page and starts the boss server on port 3000. **The server runs the game now** (physics + bots); phones only send controls and draw. Flow: join screen (name, shirt color, hat) → lobby (everyone stands on the start platform with name tags; host picks rope mode ⛓️ chain / 👥 teams of 3 / 👫 teams of 2, adds 0–5 🤖 bots, presses ▶ Start) → game (each team in its own lane; ropes, catching, climbing, rescues as in Step 3; falling only resets your own team). Host buttons in the game: ↺ restart (key **R**), 🏠 back to lobby. A phone that drops out or reloads gets its character back (it's dead weight while away). Max 6 players (people + bots).
- **Test hook:** `window.knot` in the browser console gives `controls`, `scene`, `connection`, `game`, `myId`.
- **Known rough edges:** your own character waits for the server too (no prediction), so there's a small delay (~0.1–0.2 s). After a reload you tap "Join game" again (name is remembered). The test course has one thin bridge, so in team mode the side lanes have to steer onto it. Bots are clumsy on purpose. Humans can't "pull" a hanging friend yet (only bots can).
- **Git:** ✅ set up. Private repo at https://github.com/theshafinahmed/knot-alone (branch `main`). Make it public at Step 8.
- **Computer setup:** Windows 11, Node.js v24, npm v11, git v2.54 already installed.

## How to run it

```bash
npm install     # first time only
npm start       # builds the page + starts the server
```

- On the computer: http://localhost:3000
- On a phone on the same Wi-Fi: use the `http://192.168.x.x:3000` address the server prints next to **(WiFi)**.
- Friends anywhere: wait a few seconds for **"🌍 Friends ANYWHERE…"** and share that link, or scan the QR code. The link changes every restart.
- `npm run start:local` = no tunnel (Wi-Fi only).
- Different door number: `PORT=3100 npm start` (handy for testing while another copy runs).
- If it says **"door 3000 is already in use"**: the game is already running in another window. Close that one (Ctrl+C) first.
- Keep the computer awake (plugged in, sleep off) while playing.
- If the phone can't open it: Windows Firewall may be blocking Node.js. Allow it on **Private networks** when Windows asks.

## Code map

| Where | What it does |
|---|---|
| `server/index.ts` | Sends the built page from `dist/client/` (compressed), starts the physics engine, and hands every WebSocket (`/ws`) to the room. |
| `server/tunnel.ts` | `openTunnel`: downloads (once) and runs Cloudflare's tunnel program, reports the public link, never crashes the server. |
| `server/room.ts` | `Room`: the boss. Lobby list, host, rope mode, bots, starting/ending games, the 60-steps/sec game loop, 30/sec snapshots, reconnects by token. |
| `client/main.ts` | The page: scene, screens (join → lobby → game), lobby lineup, follow camera, sending controls 30×/sec. |
| `client/game-view.ts` | `GameView`: draws the game from server snapshots (100 ms in the past, smoothed). |
| `client/lobby.ts` | `JoinScreen` (name, color, hat; remembered on the phone) and `LobbyPanel` (player list, host controls). |
| `client/invite.ts` | `InviteCard`: QR code + link + Share/Copy for the lobby's 📨 Invite button. |
| `client/hats.ts` | `createHat(hat)`: cap, top hat, crown, party hat, straw hat, built from simple shapes. |
| `client/nametag.ts` | `createNameTag(name, color)`: the floating name pill (visible through bricks). |
| `client/character.ts` | `BlockyCharacter`: the box guy, walk/jump/fall/tumble/starfish animations, blob shadow. Feet at y = 0. |
| `client/rope.ts` | `RopeView`: draws one striped rope (sag, rests on floor, bends over edges). Drawing only. |
| `client/controls.ts` | `Controls`: keyboard, mouse look (pointer lock or drag), touch joystick, touch look, jump button. |
| `client/world/bricks.ts` | `createBrick(width, depth, color)`: a LEGO-style brick with instanced studs. Top surface at y = 0. |
| `client/world/sky.ts` | Sky gradient background + puffy clouds. |
| `client/connection.ts` | `Connection` (live line to the server, auto-reconnects) and `playerToken()` (secret id saved on the phone). |
| `shared/course.ts` | Course layout as a list of bricks (`TEST_COURSE`), spawn point, fall limit. Physics and drawing both read it. |
| `shared/sim/world.ts` | `GameWorld`: Rapier physics world, players (capsules), running, jumping, bracing, stun, ropes (`tie`, `updateRopes`: edge bending, shortening, hanging, climbing, mantle), team respawn. Runs at 60 steps/sec. |
| `shared/sim/bots.ts` | `BotBrain`: robot buddy that follows the trail of the player ahead, jumps where they jumped, stops at cliffs, pulls up a hanging leader, climbs when hanging. |
| `shared/config.ts` | Port (3000) and socket path. |
| `shared/messages.ts` | Message shapes between server and page (join, input, lobby, start, snap…). |
| `shared/looks.ts` | Shirt colors, hats, name cleaning. |
| `shared/teams.ts` | Rope modes, which modes fit how many players, `splitTeams`. Max 6 players. |

## Open questions (not decided yet)

- Exact obstacle list and order for the 5-minute course (decide in Step 6).
- Open-source license (MIT is the usual simple pick, decide in Step 8).

## Session log

| Date | What happened |
|---|---|
| 2026-10-19 | Watched the inspiration video. Planned the whole game with Shafin: design, tools, hosting (own computer + Cloudflare tunnel), roadmap. Created the docs folder. Made a private GitHub repo. |
| 2026-10-19 | Step 1: set up the project (Vite + Three.js page, Node + ws server, shared folder). `npm start` works and shows the brick platform in the sky with a live server connection. Shafin tested it on his phone over Wi-Fi: works, count went to 2. Step 1 done. |
| 2026-10-19 | Step 2: added Rapier physics (in `shared/sim/`), test course, blocky character with animations, phone + computer controls, follow camera. Server now compresses files (game download ~1.5 MB). Tested in the browser at computer and phone sizes: run, jump, fall + respawn, joystick all work. Shafin tested it on his phone: feels good. Step 2 done. |
| 2026-10-19 | Step 3: ropes + robot buddies. Big lessons: the physics rope went through bricks (fixed: ropes bend over edges), climbing a fixed-length rope doesn't work (fixed: climbing shortens the rope), walking away to rescue flung people (fixed: plant feet and reel in), falling players climbed each other into the sky (fixed: you can only hang from an edge or a standing friend). Tuned with no-screen test scripts. Tested in the browser: catch, hang, climb, rescue, lazy drag, stun all work. Shafin played it: fun check passed. Step 3 done. |
| 2026-10-19 | Step 4: the server became the boss (physics + bots run in `server/room.ts`). Join screen, lobby with name tags and hats, host controls (rope mode, bots, start, restart, back to lobby), teams in lanes, per-team respawn, smooth drawing from 30/sec snapshots, reconnect by token. Tested with two browser tabs (localhost + 127.0.0.1): both see the same positions, moves sync, back-to-lobby works, a reloaded player gets their character back. Shafin tested with real phones on Wi-Fi: works. Step 4 done. |
| 2026-10-19 | Step 5: Cloudflare Quick Tunnel opens on `npm start`, link + terminal QR code, 📨 Invite card in the lobby, `start:local` for Wi-Fi only. The first tunnel-program download was cut off (3.6 MB instead of 55 MB) and crashed the server, so now a broken download is fixed automatically and tunnel problems never crash the server. Tested a real tunnel link: page loads over https, live connection works, Invite card works. Also: the lobby now shows who's online before you join. Waiting on a test with a friend on another internet. |
| 2026-10-19 | Shafin's first real `npm start`: crashed with "address already in use" (Claude's test server was still on door 3000), then the tunnel stopped with code 1 (real reason was hidden). Fixed: friendly "already running" message, `PORT` setting, tunnel retries 3 times and shows Cloudflare's real error. Tested: busy door message, tunnel opens, tunnel program closes on stop. |
| 2026-10-19 | Shafin's tunnel link didn't open at first: his internet provider's DNS said "doesn't exist" because the link was opened before it reached the DNS phone books. The tunnel itself was fine (Claude got the game page through Cloudflare Dhaka). Fixed: the server waits until public DNS knows the link (~30 s) before printing it. Tested: the printed link works right away. |
| 2026-10-19 | Shafin restarted `npm start`: the new link works right away. Step 5 pushed. Left open: test with a friend on a different internet. |
