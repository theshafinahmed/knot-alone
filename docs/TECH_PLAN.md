# 🛠️ Knot Alone — Tech Plan

> **How** the game is built. Simple words first, exact tool names after (for Claude/developers).

## The big picture (simple version)

```
  Friend's phone ─┐
  Friend's phone ─┤                      ┌──────────────────────────┐
  Friend's laptop ┼── 🔗 link ── 🚇 tunnel ──│ Host's computer = BOSS 👑 │
  Friend's phone ─┤   (Cloudflare)       │  • runs the game rules     │
  Host's own phone┘                      │  • runs the physics        │
                                         │  • sends the game page     │
                                         └──────────────────────────┘
```

- The **host's computer is the boss.** It decides where everyone *really* is, so nobody's phone disagrees.
- Phones and laptops only do 2 jobs: **send button presses** to the boss, and **draw what the boss says** on the screen.
- The **tunnel** lets friends anywhere in the world reach the host's computer, even through a locked router.

## The tools (all free) 🆓

| Job | Tool | Simple explanation |
|---|---|---|
| Programming language | **TypeScript** | JavaScript with a spell-checker. Catches mistakes early. |
| Drawing the 3D world | **Three.js** | Free toolbox that draws 3D shapes in a web browser. |
| Physics (gravity, jumping, ropes) | **Rapier** (`@dimforge/rapier3d-compat`) | Free "rules of the real world" engine. Fast and works on phones and computers. |
| The boss program (server) | **Node.js** + **ws** (WebSocket library) | Node runs JavaScript on the computer. WebSocket is a phone line that stays open so messages fly back and forth fast. |
| Building the game page | **Vite** | Packs all the code into a small website the phones can load quickly. |
| Tunnel to the internet | **Cloudflare Quick Tunnel** (`cloudflared`) | Gives a free `https://something.trycloudflare.com` link. No account needed. |

**What the host needs installed:** only **Node.js** (and git to download the repo). Everything else comes with the repo or downloads automatically.

## How the pieces talk (for developers)

- **Server-authoritative.** The server runs the Rapier physics world at a fixed **60 steps per second** (`TICK` in `shared/sim/world.ts`).
- **The physics code lives in `shared/sim/`** so the browser (Steps 2–3, solo) and the server (Step 4+) run the exact same rules. Don't put browser-only or Node-only code there.
- **Player movement:** a dynamic Rapier capsule with locked rotation (dynamic so ropes can pull it later). We set its sideways speed directly (accelerate toward the joystick direction). Jumping has "coyote time" and a "jump buffer" so it feels forgiving. Ground check = 5 short rays down from the feet.
- **Clients send inputs** (joystick direction, jump pressed, camera angle) about 30 times per second.
- **Server sends snapshots** (every player's position, rotation, state; rope endpoints; checkpoint/timer state) about 20–30 times per second.
- **Clients interpolate**: they draw everyone slightly in the past (~100 ms) and smoothly slide between snapshots, so movement looks smooth even with lag.
- **Own-player prediction** (the client moving you instantly before the server confirms) is **not in v1**. Add it only if friends far away say controls feel slow. ⚠️ This is the main known risk for players with high ping.
- **One HTTP + WebSocket server on one port.** The same Node server sends the built game files *and* handles the WebSocket. That way the tunnel only needs one link.
- **Messages:** start with JSON for simplicity. Switch to binary later only if needed.

## The rope (the hardest part) 🪢

> **Step 7 replaced the rope with a REAL one** (see "The real rope" right below). The older notes after it describe the first version and are kept for history.

### The real rope (Step 7)

- Each rope is a **chain of 11 links** (`ROPE.segments = 10` pieces) in `shared/sim/world.ts` → `updateRopes`. The end links are tied to the two players' body centers.
- Every tick: the middle links fall (gravity) and swing (they remember last tick's position = "verlet"), then 8 rounds of: keep neighbors at most one link-length apart; link *i* at most *i* link-lengths from one end (snaps a tight rope straight); and every other round, **keep links out of solid things** (`pushRopeOutOfThings`: a link can't pass through anything — we trace a line from its last safe spot — and is pushed out of anything it touches; touching links get friction).
- **How tight is it?** Like pulling a string tight: from one player, look along the chain as far as you can see in a straight line; the last visible link is a **wrap point** (it goes around an edge/corner/pusher). Rope length needed = player → wrap points → player. A loose rope sagging on the floor has no wrap points. If the needed length is more than the rope, both players get tugged towards their nearest wrap point (same gentle tug as before, max 5 m/s).
- **Hanging** = really dangling (in the air, not rising from a jump, no floor right under your feet) on a nearly tight rope, held up by a wrap point (edge) or a friend standing above. Climbing/pulling/mantling work as before; the "ledge" for a friend-hold is the friend's feet.
- **Moving blocks + rope:** pushers are 0.8 m tall: a tight rope at waist height slides over; a loose rope lying low gets caught and drags both players (tested).
- Snapshots carry the 9 middle links of every rope; phones draw a smooth tube through them, ending at **knots on the players' belts**.
- Tested with no screen: bot rescue, self-climb, loose rope on floor, pusher drag, 6-player speed (~1–2.5 ms per tick), and the course autopilot (all sections, 0 falls).

### First version (Steps 3–6, replaced)

- A real wiggly rope is too heavy for phones and too hard to keep in sync. So the rope is a few simple rules, all in `shared/sim/world.ts` (`updateRopes`):
  1. **Safety net:** a Rapier **rope joint** (max 4 m, straight line) between the two body centers. It never lets the rope stretch past full length.
  2. **Bending over edges:** the straight joint goes *through* bricks like a ghost. So every tick we check if a brick is between two tied players. If yes, we find the edge (walk along the brick top until the floor ends) and use path length = player→edge + edge→player. If that's too long, we tug both players' velocities toward the edge (max 5 m/s, equal weights). The lower player aims slightly *out past* the edge so they slide out from under the brick and up its side.
  3. **Shortening:** each rope has a `current` length. A hanging player tapping jump climbs (shortens by 0.6 m per tap). A friend standing on top with `pull` reels it in (1.6 m/s). With nobody hanging, it lets back out to full length.
  4. **Hanging** = in the air, rope nearly tight, below the edge or below a friend *who is standing on something* (otherwise two falling players would climb each other into the sky).
  5. **Scramble (mantle):** when a hanging player's feet get within 1.5 m of the edge top, they're pushed over the edge for up to 0.4 s, and stop as soon as there's floor under them.
- **Catching a friend:** a grounded player with no input "plants their feet" (brace accel 160 vs normal 60), so one standing player can hold one hanging player.
- No air brakes: in the air with no input you keep your momentum. Hanging players get a little air drag so swinging calms down.
- The rope you **see** (`client/rope.ts`) is just a drawing: a striped tube that sags when loose, rests on the floor instead of sinking into it, and goes over the edge point when bent. It doesn't affect physics.
- The rope look matches the video: red-and-white stripes.
- **Testing tip:** the physics can run without a screen. Quick test scripts that drive `GameWorld` + `BotBrain` with `npx tsx` and print positions were how the rope rules got tuned. Write new ones for new rope problems.

## The course and the race (Step 6)

- **Course recipe** (`shared/course.ts` types, `shared/sky-course.ts` the Sky Course): still `bricks` (boxes or round `disc`s), moving parts `movers` (`spin` or `slide`), `checkpoints` (pad size + which way the course goes), and a `finish` zone.
- **Moving parts follow a clock.** `moverPose(mover, time)` says where a part is at any moment. The server moves them as Rapier **kinematic bodies** (they push players). Phones draw them with the same function and the same clock (race time from the snapshots + `COUNTDOWN`), so they match without extra messages.
- **Carrying you:** the ground check notes which collider you stand on. If it's a moving part, `moverVelocityAt` gives the floor's speed and it's added to your target speed. So "standing still" on a disc means turning with it.
- **Race rules** (`GameWorld.updateRace`): touching a checkpoint pad further along than your team's last one saves it. Falling (below −40 m) puts your team back at its last checkpoint, lined up and centered on the pad. The team finishes when **every member** stands in the finish zone. The first `COUNTDOWN` (3) seconds nobody can move.
- **Snapshots** also carry `rt` (race time), `tp` (each team's [checkpoint, finish time or −1]) and `bt` (best time since the server started).
- **Play again** (↺ / results button) builds a brand-new world with the same teams.
- The phone's floors-only world for shadows leaves out moving parts (no shadow on discs — small cosmetic thing).
- **Testing:** headless test scripts check spawns at every checkpoint, disc riding, sweeper/pusher pushing, checkpoint order, finish rule and countdown. An autopilot (+ bot) runs warm-up, bridges, maze and tower. The page has a test-only `knot.freeCam` to look at any part of the course.

## Fun actions (wave, punch, dance, cheer)

- List and numbers live in `shared/actions.ts` (how long each lasts, punch reach/strength/cooldown).
- The page sends `{ type: 'action', action }`. The **server decides**: `GameWorld.doAction` starts it (refused while stunned, hanging, stumbling, or during the punch cooldown). `updateActions` moves it along every tick.
- **Punch:** at 0.12 s the fist "lands". Everyone within 1.5 m, in front of you (wide cone), about the same height, gets a shove (4.5 m/s + small hop) and **stumbles** for 0.35 s (treated like limp, so they slide to a stop). Tested: ~1.25 m shove, nobody behind you gets hit.
- Snapshots carry each player's action and how long they've been doing it, so every phone plays the same animation. The animation is only a drawing (`client/character.ts`); the emoji bubble is a little sprite above the name.

## Characters

- Physics body: a **capsule** (pill shape) kept upright while walking.
- Look: blocky boxes (head, body, arms, legs), built in code, no model files needed.
- "Floppy" fall: when falling or yanked hard, the character tilts and flails (fake ragdoll animation first; real ragdoll later only if it's worth it).
- Name tag: text drawn above the head, always facing the camera.

## Camera, clouds and glitch fixes (Step 7)

- **Camera:** a line is traced from your head to where the camera wants to be; if a brick is in the way, the camera comes in front of it (fast), and goes back out gently. It also stays at least 0.8 m above the floor under it.
- **Important:** the phone's floors-only `GameWorld` must be stepped once (`floors.world.step()`), or Rapier's scene index is empty and every ray/"floor below?" question answers "nothing" (that's why shadows had vanished).
- **Clouds** are placed only away from the course (not within ~6 m of any brick at playing height), don't drift sideways, and hide when the camera is close.
- **Flicker:** pads/finish floor sit at +0.27 (clearly above stud tops at +0.2); the blob shadow sits at +0.21 with polygon offset. Studs are hidden on bricks more than 45 m away (no shimmer, faster).
- **Smoothness:** the drawing delay adapts to how bumpy the connection is (80–260 ms), so phones don't run out of snapshots on the internet.
- **Events** for sounds/confetti: the server sends `ev` in snapshots (`hit`, `cp`, `fin`, `fall`); phones play them at the moment they're drawn.
- **Sounds** (`client/sounds.ts`): a tiny Web Audio synth, no files. Mute is remembered on the phone.
- **No zooming** (`client/no-zoom.ts`): some phones (iPhones) ignore the page's "no zoom" setting, so pinch gestures, two-finger moves on the page, quick double taps (not on buttons/inputs) and Ctrl+wheel are blocked in code. Buttons use `touch-action: pan-y` — never `manipulation`, which still allows pinch-zoom. The game's own controls use pointer events, which these blocks don't affect.

## Phone performance rules 📱

- Simple shapes only, few lights, no expensive real-time shadows (use a soft round "blob" shadow under each player).
- Limit the screen sharpness on phones (pixel ratio max ~1.5–2).
- Brick studs: reuse the same shape many times (instancing), so thousands of studs stay cheap.
- Target: smooth on a normal mid-range Android phone.
- **Download size:** the Rapier "compat" package carries its engine inside the JS file, so the game code is ~4.9 MB. The server squeezes it with brotli/gzip to **~1.5 MB** before sending (`server/index.ts`). Switching to the non-compat Rapier package (separate `.wasm` file) is an option later if needed.

## Planned folder layout

```
knot-alone/
├─ CLAUDE.md          ← rules + map for Claude
├─ docs/              ← these planning files
├─ client/            ← the game page (Three.js, controls, drawing)
├─ server/            ← the boss (Node, Rapier physics, game rules, tunnel)
├─ shared/            ← things both use (course layout, message shapes, settings)
└─ package.json       ← the "start" command lives here
```

## The one command

`npm start` will eventually:
1. Build the game page (if needed)
2. Start the boss server
3. Open the Cloudflare tunnel
4. Print: **"Send this link to your friends: https://....trycloudflare.com"** 🔗

Note: the Quick Tunnel link **changes every time** the server restarts. That's fine for game nights.

**How it's built (Step 5):** `server/tunnel.ts` uses the `cloudflared` npm package, which downloads Cloudflare's **official** `cloudflared` program (~55 MB, into `node_modules/cloudflared/bin/`) and runs `Tunnel.quick('http://localhost:3000')`. When Cloudflare connects, the server prints the link + a terminal QR code (`qrcode` package) and tells every lobby the invite link (`invite` in the `lobby` message). If the tunnel can't open (no internet, broken download), the server says so and **keeps running for Wi-Fi play**. It never crashes. A half-downloaded program file (smaller than 15 MB) is deleted and downloaded again automatically. Free quick tunnels sometimes fail to start (Cloudflare can say "slow down" after many tunnels), so the server **tries 3 times** (waiting 5 s, then 10 s) and prints the program's real error line if it still fails. On Ctrl+C the tunnel program is stopped too. **DNS delay:** a brand-new trycloudflare link takes up to a minute to reach every DNS "phone book", and if a phone asks too early its internet provider caches "doesn't exist" for a few minutes. So after the tunnel connects, the server asks Cloudflare's public DNS (1.1.1.1 / 8.8.8.8, which doesn't poison the provider's cache) until the link exists, waits 10 s more, and only then prints it (~30 s total). `npm run start:local` skips the tunnel. The lobby's 📨 Invite card draws the QR in the browser (`client/invite.ts`) with Share (phones) and Copy buttons.

## Host controls

- The **first person to join** becomes the host (usually the person running the server). They get the rope-mode picker, the bots +/− and the Start button, and in the game: ↺ restart (key **R**) and 🏠 back to lobby.
- If the host leaves, whoever has been there longest (and is still connected) becomes the host.

## How multiplayer works (Step 4)

- **`server/room.ts`** is the boss. One room per server. Phases: `lobby` → `playing` → back to `lobby`.
- **Joining:** the page sends `join` with a secret **token** (saved on the phone in localStorage) + name, color, hat. Same token = same player, so a phone that drops out (or reloads) gets its character back. In the lobby, people who leave are removed. In a game, they stay as **dead weight** (limp) until they come back.
- **Max 6** players (people + bots). People who join mid-game watch (camera follows the first player) until the host goes back to the lobby.
- **Teams:** `shared/teams.ts` → `splitTeams` spreads people across teams first, then bots fill the gaps. A mode is only allowed if it fits (teams need 2+ full teams). Each team gets its own lane on the start platform. Falling only respawns **your own team**.
- **Bots** (`BotBrain`) run on the server. A bot follows the player ahead of it in its team. Bots wear colors no person picked.
- **Messages** (`shared/messages.ts`, JSON):
  - page → server: `join`, `input {x, z, jumps}` (30×/sec; `jumps` is a counter so no jump gets lost), host-only `setup`, `start`, `restart`, `backToLobby`.
  - server → page: `welcome`, `full`, `lobby`, `start {players, teams, ropes}`, `snap` (30×/sec).
  - `snap` = server time + every player as a short array `[id, x, y, z, vx, vy, vz, facing, flags]` + every rope `[current]` or `[current, bendX, bendY, bendZ]`.
- **Smooth drawing** (`client/game-view.ts`): the page draws everyone **100 ms in the past** and slides between the two snapshots around that moment. Clocks are lined up using the smallest (local time − server time) seen.
- The page keeps its own **floors-only** `GameWorld` just to find the ground (for shadows and ropes resting on the floor). It does not run the game.
- **Known limit:** your own character also waits for the server (no prediction yet), so there's a small delay (~0.1–0.2 s) between pressing and moving. Fine on Wi-Fi. Revisit in Step 5 if friends far away feel it.
- **Testing two players on one computer:** open `http://localhost:3000` and `http://127.0.0.1:3000` in two tabs. They count as different "phones" (separate saved token). Two tabs on the *same* address share a token and would be the same player.
