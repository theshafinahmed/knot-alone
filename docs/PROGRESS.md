# 📍 Knot Alone — Where We Are

> **Read this first** at the start of every session. **Update it at the end** of every session.

## Right now

- **Current step:** Step 1 (Empty project that runs) is **almost done**. The only thing left is for Shafin to open it on his phone on the same Wi-Fi. **After that: Step 2, one blocky guy that runs and jumps.** See [ROADMAP.md](ROADMAP.md).
- **What works:** `npm start` builds the game page and starts the server on port 3000. The page shows a blue sky, clouds, a red brick platform with yellow bricks and a blue bridge, a slowly circling camera, and a "✅ Connected · N players online" badge (live WebSocket to the server). Checked on desktop and phone-sized screens with no console errors.
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
| `client/main.ts` | The game page: renderer, scene, camera, game loop. |
| `client/world/bricks.ts` | `createBrick(width, depth, color)`: a LEGO-style brick with instanced studs. Top surface at y = 0. |
| `client/world/sky.ts` | Sky gradient background + puffy clouds. |
| `client/connection.ts` | Live connection to the server, auto-reconnects. |
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
| 2026-10-19 | Step 1: set up the project (Vite + Three.js page, Node + ws server, shared folder). `npm start` works and shows the brick platform in the sky with a live server connection. Waiting on a phone test. |
