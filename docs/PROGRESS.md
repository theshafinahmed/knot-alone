# 📍 Knot Alone — Where We Are

> **Read this first** at the start of every session. **Update it at the end** of every session.

## Right now

- **Current step:** **Step 9 — New look.** 9a (HUD + controls) and 9b (Join + Lobby) are done and pushed. **Next: 9c Invite card**, then 9d Results card, then 9e small stuff. Steps 1–8 are all done; Knot Alone is **public** on GitHub. Still optional: a friend-on-another-internet test (Step 5), an animated GIF, own-player prediction if far-away play feels slow.
- **Everything is committed and pushed** (last commit: Kick). Nothing is waiting on your computer.
- **Kick (after Step 8):** a big, slow shove. Phone: orange Kick button above Punch. Computer: **G**.
- **Pull button (after Step 8):** humans can pull a hanging friend up: hold 🪢 (phone: the big pulsing Pull button shows only when a friend on your rope is hanging) or **E** (computer). The game rule already existed for bots; this just sends "pull" from the page.
- **Step 8 adds:** `README.md` (host a game night in 3 steps, controls, FAQ, how it works), `LICENSE` (MIT), `docs/images/*.jpg`, author/license/repo in `package.json`. Git history rewritten so commits use `228196812+theshafinahmed@users.noreply.github.com` (a local backup branch `backup/before-email-rewrite` has the old history — never push it, it contains the Gmail). Repo set to public with a description and topics.
- **Step 7 adds:** a **real rope** (chain of links: drapes, lies on the floor, wraps around walls, gets dragged by moving blocks — which drags you), rope **belts + knots** on players, camera that never goes through walls or the floor, clouds kept off the course, flicker fixes, smoothness on bumpy internet, shadows working again, **sounds** (🔊/🔇), **confetti**, 4 new hats (⚔️ 🧶 🍳 🚁), sun + sea of clouds.
- **Step 6 adds:** the **Sky Course** (6 sections, ~270 m): warm-up → zig-zag bridges → spinning discs + sweeper → sliding stones + pushers → brick maze → tower → finish arch. 5 checkpoints (flags turn gold), 3-2-1-GO, race timer, checkpoint pop-ups, results card (🥇🥈🥉, best time, Play again / Lobby). Moving platforms carry you. The whole team must stand in the finish.
- **Step 5½ adds:** 👋 wave, 💃 dance, 🎉 cheer, 👊 punch (small shove). Phone: 👊 button left of jump, 😀 above jump opens a menu. Computer: F or click = punch, 1/2/3 = wave/dance/cheer. Emoji bubble over your head.
- **Step 5 adds:** `npm start` now also opens a free Cloudflare tunnel and prints a public `https://….trycloudflare.com` link + a QR code. The lobby has a 📨 Invite button (QR + link + Share/Copy). `npm run start:local` = Wi-Fi only. You can run the server and play only from your phone: join from the phone first and you're the host.
- **What works:** `npm start` builds the page and starts the boss server on port 3000. **The server runs the game now** (physics + bots); phones only send controls and draw. Flow: join screen (name, shirt color, hat) → lobby (everyone stands on the start platform with name tags; host picks rope mode ⛓️ chain / 👥 teams of 3 / 👫 teams of 2, adds 0–5 🤖 bots, presses ▶ Start) → game (each team in its own lane; ropes, catching, climbing, rescues as in Step 3; falling only resets your own team). Host buttons in the game: ↺ restart (key **R**), 🏠 back to lobby. A phone that drops out or reloads gets its character back (it's dead weight while away). Max 6 players (people + bots).
- **Test hook:** `window.knot` in the browser console gives `controls`, `scene`, `camera`, `connection`, `game`, `myId`, and `freeCam` (set `{x, y, z, lookX, lookY, lookZ}` to look anywhere; `null` = normal camera).
- **Known rough edges:** your own character waits for the server too (no prediction), so there's a small delay (~0.1–0.2 s). After a reload you tap "Join game" again (name is remembered). The test course has one thin bridge, so in team mode the side lanes have to steer onto it. Bots are clumsy on purpose.- **Git:** ✅ **Public** repo at https://github.com/theshafinahmed/knot-alone (branch `main`). This repo's git config uses Shafin's private GitHub email (noreply) — keep it that way.
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
- Different door number: `npm start -- --port=3100` (handy for testing while another copy runs). Claude's test setup `knot-alone-test` in `.claude/launch.json` runs on 3100 without a tunnel.
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
| `client/rope.ts` | `RopeView`: draws one striped rope through the real links sent by the server, with a knot at each end. Drawing only. |
| `client/sounds.ts` | `sounds`: tiny code synth (jump, punch, hit, countdown, checkpoint, finish, fall), mute remembered. |
| `client/confetti.ts` | `Confetti`: bursts of paper pieces (checkpoints, finish). |
| `client/controls.ts` | `Controls`: keyboard, mouse look (pointer lock or drag), touch joystick, touch look, jump button. |
| `client/world/bricks.ts` | `createBrick`, `createDisc`, `createBrickFrom(def)`: LEGO-style bricks/discs with instanced studs. Top surface at y = 0. |
| `client/world/course-view.ts` | `CourseView`: draws the whole course, moves the moving parts by the clock, checkpoint pads + flags (gold when reached), finish arch. |
| `client/confirm.ts` | `askConfirm`: the "Are you sure?" box for the host's Retry and Lobby. |
| `client/icons.ts` | Small line icons (sound, check, flag, stopwatch) used by the HUD code. |
| `client/race-hud.ts` | `RaceHud`: countdown, timer, checkpoint pop-ups, results card. |
| `client/world/sky.ts` | Sky gradient background + puffy clouds. |
| `client/connection.ts` | `Connection` (live line to the server, auto-reconnects) and `playerToken()` (secret id saved on the phone). |
| `shared/course.ts` | Course recipe types (bricks, discs, moving parts, checkpoints, finish), `moverPose` / `moverVelocityAt` (where a moving part is / how fast it moves), and the small `TEST_COURSE`. |
| `shared/sky-course.ts` | **The Sky Course** layout, section by section. Change the course here. |
| `shared/sim/world.ts` | `GameWorld`: Rapier physics world, players (capsules), running, jumping, bracing, stun, the **real rope** (`tie`, `updateRopes`: chain of links, collisions, wrap points, shortening, hanging, climbing, mantle), moving parts, checkpoints, finish, events, team respawn. Runs at 60 steps/sec. |
| `shared/sim/bots.ts` | `BotBrain`: robot buddy that follows the trail of the player ahead, jumps where they jumped, stops at cliffs, pulls up a hanging leader, climbs when hanging. |
| `shared/config.ts` | Port (3000) and socket path. |
| `shared/messages.ts` | Message shapes between server and page (join, input, lobby, start, snap…). |
| `shared/looks.ts` | Shirt colors, hats, name cleaning. |
| `shared/actions.ts` | Fun actions (wave, punch, dance, cheer): emojis, how long they last, punch strength/reach/cooldown. |
| `shared/teams.ts` | Rope modes, which modes fit how many players, `splitTeams`. Max 6 players. |

## Open questions (not decided yet)

- Exact obstacle list and order for the 5-minute course (decide in Step 6).

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
| 2026-10-19 | Step 5½: fun actions. Wave, dance, cheer (with emoji bubbles) and punch (small shove, server decides who got hit). Phone 👊 + 😀 menu, computer F/click + 1/2/3. Tested with no screen (shove ~1.25 m, can't spam, people behind you aren't hit) and in the browser (all four animations, phone buttons). Added `--port=` for test servers. |
| 2026-10-19 | Shafin tried the fun actions with friends: they work. Pushed. |
| 2026-10-19 | Step 6: the Sky Course. New course recipe (discs, moving parts, checkpoints, finish), moving platforms that carry you, per-team checkpoints, 3-2-1-GO, race timer, results card, Play again. Fixed during testing: a chain of 6 spawned off checkpoint platforms (now centered), a bridge overlapping a corner, pushers too fast, a too-short checkpoint platform. Headless tests + autopilot all pass; checked every section in the browser with the free camera. Waiting on Shafin's game night. |
| 2026-10-19 | Shafin's friends couldn't find the invisible joystick. Now the movement circle is always shown in the bottom-left with arrows; only touching it (or near it) moves you, anywhere else turns the camera. "Move" / "Swipe to look around" hints fade after use. Tested on a phone-sized screen. |
| 2026-10-19 | Shafin: the movement circle works on his phone and the course is good. Step 6 done and pushed. |
| 2026-10-19 | Step 7 polish. Shafin reported glitches (camera through walls, rope through things, jitter, flicker, clouds blocking the view) and asked for a realistic rope + visible rope ties. Rebuilt the rope as a chain of links with collisions (took several rounds: links tunneling through corners, a sagging chain pulling too early → fixed with straightening + line-of-sight wrap points; false 'hanging' while hopping steps; a test bug where teleport left the rope behind). Added belts/knots, camera collision + floor clearance, cloud placement, flicker fixes, adaptive smoothing, events → sounds + confetti, 4 hats, sun + cloud sea. Found that the phone's course copy was never stepped (no shadows, no camera collision) — fixed. All headless tests + browser checks pass. |
| 2026-10-19 | Shafin played the polished game with friends: no glitches left. Step 7 done and pushed. |
| 2026-10-19 | Step 8: README (3-step hosting, controls, FAQ), MIT license (Shafin Ahmed), screenshots captured from the game into `docs/images/`. Before going public: scanned for secrets (none), and rewrote the history to replace Shafin's Gmail with his GitHub noreply address (local backup branch kept, not pushed). Made the repo public with a description and topics. All roadmap steps done. |
| 2026-10-19 | Shafin: touching the screen zoomed the page. Added `client/no-zoom.ts` (blocks pinch, double-tap and Ctrl+wheel zoom) and switched buttons from `touch-action: manipulation` (allows pinch) to `pan-y`. Checked: joystick + camera still work with two fingers, zoom stays 1. |
| 2026-10-19 | Shafin tested on his phone: no more zooming. Pushed. |
| 2026-10-19 | Shafin found a stuck case: a hanging player under a brick overhang couldn't move or be pulled (the rope's tug pointed up into the brick). Fix in `world.ts` (`tugDirection`): head against a ceiling → tug sideways to the nearest open sky; pressed against a wall → tug straight up so you slide up it. A 128-case swing test went from 39 stuck to 1; autopilot course test still passes. Not committed yet. |
| 2026-10-19 | Shafin: camera sometimes gets squeezed against a brick and players don't know to move it. Now, if the camera has been closer than 4 m for 0.6 s, it turns by itself to the nearest angle with a clear view (`findClearView` in `client/main.ts`). Tested by faking a wall behind the player: the camera swung ~50° and settled. Also exposed `floors` on `window.knot` for tests. Not committed yet. |
| 2026-10-19 | UI redesign, step 1 (HUD + controls). New look from the design canvas: Fredoka/Nunito fonts, dark pills, gold checkpoint squares in the timer, line icons instead of emoji, key-cap hint bar on computers, phone controls fanned around Jump with labels (Jump, Punch, Pull, Emote) and a soft shade behind them, host buttons stacked under the sound button on narrow phones. Joystick knob travel 55 → 42 px to fit the ring. Checked at 1280×800 and 375×812. Not committed yet. Next: Join, Lobby, Results. |
| 2026-10-19 | HUD round 2 (Shafin's feedback): phone buttons redesigned: Jump big in the corner, Punch / Pull / Emote climb up from it in a diagonal on the right (names inside the buttons), so nothing reaches over the movement circle even at 320 px wide (checked 320×568, 360×740, 390×844, and sideways 740×360). Host Retry / Lobby now ask "Are you sure?" (buttons and keys **R** / **L**; Esc cancels, Enter confirms); key caps shown on the buttons and in the hint bar for the host. Not committed yet. |
| 2026-10-19 | Step 9b built (not committed): new **Join** (hero title + card, flat picture of your character with all 10 hats, 8 shirt colors, name tag) and **Lobby** (side card on computers, bottom sheet on phones, player list with Host / You / Robot badges, rope mode, robot buddies, Start). The 3D lineup slides away from the card with a camera view offset (left of the side card, above the sheet) and hides while the join screen is open. Layouts checked at 1440×900, 1280×720, 1024×768, 800×600, sideways 740×360, 390×844, 360×740, 320×568. Fixes found on the way: card width on phones, desktop card taller than a 720 px window (now scrolls inside with a sticky Join button), tag vs hat overlap. New files/pieces: `HAT_LABEL` in `shared/looks.ts`, rewritten `client/lobby.ts`. Invite card and Results still use the old look (9c, 9d). Shafin's feedback applied: hat no longer cut off in the preview, left-side text is white with a navy outline; phone color row is now full-size squares you swipe sideways, and the hat row really swipes too (the buttons had touch-action pan-y, which blocked sideways swipes); then checked with real Chrome screenshots (desktop + a 390 px frame), which also found: sound button on top of the logo on phones, character cut at the top of the lobby on phones. |
| 2026-10-19 | **Kick** action (Shafin's idea): a big shove (`KICK` in `shared/actions.ts`: reach 1.3 m, shove 9 m/s, stumble 0.55 s, wait 1.4 s; test: a kicked friend flew ~3.6 m vs 1.25 m for a punch). Phone: orange Kick button right above Punch (Pull moved up one slot; sideways phones fan Punch + Kick left of Jump). Computer: **G**. Leg-swing animation, same swing sound. Checked: headless physics test, phone layout (no overlaps), and the real key press in Chrome. Not committed yet. |
| 2026-10-19 | HUD round 3 (after Shafin's phone screenshot): Jump big in the corner with Punch right above it; **Pull shows only when a friend on your rope is hanging** (big, pulsing, `GameView.needsHelp`); Emote moved to a small button under the sound button (top right); the dark shade behind the controls is gone; the timer is a compact pill with a checkpoint progress bar (5 pieces, gold when reached); name tags shrink and fade when the camera is close and grow a little when far (`GameView.updateTags`). Logo is hidden during the race on screens under 900 px so it can't hit the timer. On narrow phones the sound button sits left of the timer and Emote takes the top-right corner. Checked at 360×740 and sideways 740×360. Not committed yet. |
| 2026-10-19 | Pull button for humans: 🪢 (hold) / E key → `pull` in the input message → server → existing `world.pull` rule. Tested headless (hanging friend ends up back on the platform in ~6 s with pull, hangs forever without) and in the phone-size browser (button shows, sends pull while held). Not committed yet — waiting for Shafin's OK. |
| 2026-10-19 | Docs check: everything marked "not committed yet" above (stuck-under-bricks fix, camera auto-turn, HUD rounds 1–3, Pull button, Step 9b Join + Lobby, Kick) is now committed and pushed to GitHub. PROGRESS + ROADMAP updated to match. Next: 9c Invite card. |
