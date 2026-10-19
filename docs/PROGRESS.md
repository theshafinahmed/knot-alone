# 📍 Knot Alone — Where We Are

> **Read this first** at the start of every session. **Update it at the end** of every session.

## Right now

- **Current step:** Step 2 (One blocky guy that runs and jumps) is ✅ **done**. Shafin tested it on his real phone and says the controls feel good. **Next up: Step 3, THE ROPE TEST.** See [ROADMAP.md](ROADMAP.md).
- **What works:** `npm start` builds the page and starts the server on port 3000. You control a blocky Roblox-style guy (red shirt) on a small test course: start platform → thin blue bridge → gap jump → steps up → purple top platform. He runs (arms and legs swing), jumps (arms up), flails when falling fast, and respawns at the start after falling off. Soft blob shadow under him. Follow camera. Phone: joystick appears where your left thumb touches, drag the right side to look, yellow jump button. Computer: WASD/arrows, Space, click to lock the mouse for looking (Esc to free it). The "✅ N online" badge still shows the live server connection.
- **Physics runs in the browser for now** (solo). It's in `shared/sim/` so the server can take it over in Step 4.
- **Git:** ✅ set up. Private repo at https://github.com/theshafinahmed/knot-alone (branch `main`). Make it public at Step 8.
- **Computer setup:** Windows 11, Node.js v24, npm v11, git v2.54 already installed.

## How to run it

```bash
npm install     # first time only
npm start       # builds the page + starts the server
```

- On the computer: http://localhost:3000
- On a phone on the same Wi-Fi: use the `http://192.168.x.x:3000` address the server prints next to **(WiFi)**.
- If the phone can't open it: Windows Firewall may be blocking Node.js. Allow it on **Private networks** when Windows asks.

## Code map

| Where | What it does |
|---|---|
| `server/index.ts` | The boss. Sends the built page from `dist/client/` and runs the WebSocket at `/ws`. |
| `client/main.ts` | The game page: renderer, scene, fixed-step game loop with smooth drawing in between, follow camera. |
| `client/character.ts` | `BlockyCharacter`: the box guy, walk/jump/fall animations, blob shadow. Feet at y = 0. |
| `client/controls.ts` | `Controls`: keyboard, mouse look (pointer lock or drag), touch joystick, touch look, jump button. |
| `client/world/bricks.ts` | `createBrick(width, depth, color)`: a LEGO-style brick with instanced studs. Top surface at y = 0. |
| `client/world/sky.ts` | Sky gradient background + puffy clouds. |
| `client/connection.ts` | Live connection to the server, auto-reconnects. |
| `shared/course.ts` | Course layout as a list of bricks (`TEST_COURSE`), spawn point, fall limit. Physics and drawing both read it. |
| `shared/sim/world.ts` | `GameWorld`: Rapier physics world, players (capsules), running, jumping, ground check, respawn. Runs at 60 steps/sec. |
| `shared/config.ts` | Port (3000) and socket path. |
| `shared/messages.ts` | Message shapes between server and page. |

## Open questions (not decided yet)

- Exact obstacle list and order for the 5-minute course (decide in Step 6).
- Which hats to offer (decide in Step 4 or 7).
- Open-source license (MIT is the usual simple pick, decide in Step 8).

## Session log

| Date | What happened |
|---|---|
| 2026-10-19 | Watched the inspiration video. Planned the whole game with Shafin: design, tools, hosting (own computer + Cloudflare tunnel), roadmap. Created the docs folder. Made a private GitHub repo. |
| 2026-10-19 | Step 1: set up the project (Vite + Three.js page, Node + ws server, shared folder). `npm start` works and shows the brick platform in the sky with a live server connection. Shafin tested it on his phone over Wi-Fi: works, count went to 2. Step 1 done. |
| 2026-10-19 | Step 2: added Rapier physics (in `shared/sim/`), test course, blocky character with animations, phone + computer controls, follow camera. Server now compresses files (game download ~1.5 MB). Tested in the browser at computer and phone sizes: run, jump, fall + respawn, joystick all work. Shafin tested it on his phone: feels good. Step 2 done. |
