# 📍 Knot Alone — Where We Are

> **Read this first** at the start of every session. **Update it at the end** of every session.

## Right now

- **Current step:** Step 3 (THE ROPE TEST) is ✅ **done**. Shafin played it and says it's **fun** (fun check passed). **Next up: Step 4, real friends on the same Wi-Fi.** See [ROADMAP.md](ROADMAP.md).
- **What works:** `npm start` builds the page and starts the server on port 3000. You (red shirt) are tied in a chain to 3 robot buddies with red-and-white striped ropes on a small test course (start platform → thin blue bridge → gap → steps → top platform). Ropes sag, go tight, rest on the floor, and bend over edges. Falling drags your buddies. A standing buddy catches you; you hang off the edge, tap jump to climb, bots pull you up, and you scramble over the edge. If the whole team falls, everyone respawns at the start. Floppy falls: tumbling, flailing, starfish stun after hard landings. Buttons (top right on computers, under the logo on phones): 🤖 bot count (1/2/3/5, key **B**), 🏃 Follow / 😴 Lazy bots (key **L**), ↺ restart (key **R**). Controls same as Step 2.
- **Physics runs in the browser for now** (solo). It's in `shared/sim/` so the server can take it over in Step 4.
- **Test hook:** `window.knot` in the browser console gives `controls`, `scene`, `world`, `ropes` (for poking at things while testing).
- **Known rough edges:** bots are clumsy on purpose (they sometimes miss jumps). Lazy bots don't look floppy yet (they just stand while dragged). The camera sits behind you, so in portrait the buddies behind you can block the view a bit. Humans can't "pull" a hanging friend yet (only bots can). That needs a button later.
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
| `client/character.ts` | `BlockyCharacter`: the box guy, walk/jump/fall/tumble/starfish animations, blob shadow. Feet at y = 0. |
| `client/rope.ts` | `RopeView`: draws one striped rope (sag, rests on floor, bends over edges). Drawing only. |
| `client/controls.ts` | `Controls`: keyboard, mouse look (pointer lock or drag), touch joystick, touch look, jump button. |
| `client/world/bricks.ts` | `createBrick(width, depth, color)`: a LEGO-style brick with instanced studs. Top surface at y = 0. |
| `client/world/sky.ts` | Sky gradient background + puffy clouds. |
| `client/connection.ts` | Live connection to the server, auto-reconnects. |
| `shared/course.ts` | Course layout as a list of bricks (`TEST_COURSE`), spawn point, fall limit. Physics and drawing both read it. |
| `shared/sim/world.ts` | `GameWorld`: Rapier physics world, players (capsules), running, jumping, bracing, stun, ropes (`tie`, `updateRopes`: edge bending, shortening, hanging, climbing, mantle), team respawn. Runs at 60 steps/sec. |
| `shared/sim/bots.ts` | `BotBrain`: robot buddy that follows the trail of the player ahead, jumps where they jumped, stops at cliffs, pulls up a hanging leader, climbs when hanging. |
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
| 2026-10-19 | Step 3: ropes + robot buddies. Big lessons: the physics rope went through bricks (fixed: ropes bend over edges), climbing a fixed-length rope doesn't work (fixed: climbing shortens the rope), walking away to rescue flung people (fixed: plant feet and reel in), falling players climbed each other into the sky (fixed: you can only hang from an edge or a standing friend). Tuned with no-screen test scripts. Tested in the browser: catch, hang, climb, rescue, lazy drag, stun all work. Shafin played it: fun check passed. Step 3 done. |
