# 🗺️ Knot Alone — Roadmap

> The building steps, in order. **Rule: check that it's fun before making it big.**
> Tick boxes `[x]` as things get done. Current status lives in [PROGRESS.md](PROGRESS.md).

## Step 0 — Planning 📝
- [x] Watch the inspiration video
- [x] Decide the game design ([GAME_DESIGN.md](GAME_DESIGN.md))
- [x] Pick the tools ([TECH_PLAN.md](TECH_PLAN.md))
- [x] Write these docs

## Step 1 — Empty project that runs 🧱
- [x] Set up folders (`client/`, `server/`, `shared/`) and `package.json`
- [x] `npm start` starts the server and shows a blue sky + one brick platform
- [x] Open it on a phone on the **same Wi-Fi** and see it work
- [x] Put the project in git

## Step 2 — One blocky guy that runs and jumps 🏃
- [x] Blocky character built from boxes
- [x] Phone controls: joystick + jump button + drag to look
- [x] Computer controls: WASD + space + mouse
- [x] Camera follows from behind
- [x] Physics: walking, jumping, falling off the edge
- [x] Shafin tries it on his real phone and says if the controls feel good

## Step 3 — THE ROPE TEST (fun check) 🪢
- [x] You + robot buddies tied together with ropes (1, 2, 3 or 5 bots)
- [x] Ropes pull, sag and go tight
- [x] Falling drags your buddies
- [x] Floppy falls (tumbling, flailing, "starfish" stun after a hard landing)
- [x] Ropes bend over edges (not through bricks)
- [x] Catch a falling friend (standing still = feet planted)
- [x] Hanging: tap jump to climb up, friends on top pull you up, auto-scramble over the edge
- [x] Lazy bots (dead weight you drag) to test the drag feel
- [x] **Shafin plays it and says if it's fun.** ✅ He says it's fun!

## Step 4 — Real friends on the same Wi-Fi 👥
- [x] Server becomes the boss (physics runs on the host computer)
- [x] Lobby: type name, pick color + hat
- [x] **Names float above heads**
- [x] Host picks rope mode (one chain / teams of 3 / teams of 2) and presses Start
- [x] Smooth movement for other players (interpolation)
- [x] Host can add robot buddies to fill empty spots (test alone, or fill a team)
- [x] A phone that drops out can come back as the same player
- [x] Shafin tests it with real phones on the same Wi-Fi ✅ works

## Step 5 — Friends from anywhere in the world 🌍
- [x] `npm start` opens a Cloudflare Quick Tunnel automatically
- [x] Prints the link to share **+ a QR code** to scan with your phone
- [x] 📨 Invite button in the lobby: QR code + link + Share/Copy
- [x] `npm run start:local` = Wi-Fi only (no tunnel)
- [x] Claude checked: the game loads and connects through the tunnel (https + secure WebSocket)
- [x] Shafin restarted `npm start`: the printed link works right away
- [ ] Test with a friend on a different internet connection (mobile data counts!)
- [ ] If controls feel slow for far-away friends → add own-player prediction

## Step 5½ — Fun actions 🎭 (Shafin's idea, added before the course)
- [x] 👋 Wave, 💃 Dance, 🎉 Cheer, with an emoji bubble over your head
- [x] 👊 Punch = small shove (~1.2 m stumble), can knock someone off an edge
- [x] 🦵 Kick = big, slow shove (~3.6 m). Phone: Kick button above Punch. Computer: G. (added after Step 8)
- [x] 🪢 Pull button for humans: hold to pull a hanging friend up. Phone: shows only when a friend hangs. Computer: E. (added after Step 8)
- [x] Phone: Punch button + Emote menu (now a small button top right). Computer: F / click = punch, 1 wave, 2 dance, 3 cheer
- [x] Shafin tried it with friends ✅ works

## Step 6 — The real course 🏗️
- [x] Build the toy-brick **Sky Course** (~270 m, 6 sections: warm-up, zig-zag bridges, spinning discs + sweeper, sliding stones + pushers, brick maze, tower climb)
- [x] Obstacles: thin bridges, spinning discs, sliding blocks, maze, jumps
- [x] Moving platforms carry you (spinning discs, sliding stones)
- [x] Checkpoints (team goes back to the last one after falling) — 5 glowing pads with flags (turn gold when reached)
- [x] 3-2-1-GO countdown, race timer, checkpoint pop-ups
- [x] Finish line (the whole team must stand in it) + results card with 🥇🥈🥉, best time, Play again / Lobby
- [x] Claude checked: every checkpoint spawns safely (chain of 6, teams of 2 and 3), autopilot + bot can do warm-up, bridges, maze and tower
- [x] Shafin plays the full course with friends ✅ "the course is good"
- [x] Always-visible movement circle on phones (friends couldn't find the old invisible joystick)

## Step 7 — Polish ✨
- [x] **Real rope**: a chain of links that falls, swings, drapes over edges, lies on the floor, wraps around walls and gets dragged by moving blocks (which drags you)
- [x] Rope belt + knot on every player (you can see where the rope is tied)
- [x] Camera never goes through walls or into the floor
- [x] Clouds kept away from the course (and hidden if the camera gets close)
- [x] No more flicker (pads, finish floor, shadows); far studs hidden
- [x] Smooth on bumpy internet (the smoothing buffer adapts)
- [x] Shadows under players work again (the phone's course copy was never "switched on")
- [x] Sounds (jump, punch, hit, countdown, checkpoint, finish, fall) + 🔊/🔇 button
- [x] Confetti at checkpoints and the finish
- [x] More hats: ⚔️ Viking, 🧶 beanie, 🍳 chef, 🚁 propeller (it spins!)
- [x] Nicer sky: sun, sea of clouds far below, richer colors
- [x] Shafin + friends played it ✅ "no glitches left"

## Step 8 — Share it on GitHub 🚀
- [x] Simple README: "how to host a game night in 3 steps" (+ controls, FAQ, how it works)
- [x] Open-source license (MIT, © Shafin Ahmed)
- [x] Screenshots (team, course overview, spinning discs, tower) in `docs/images/`
- [x] Hid Shafin's Gmail from the git history (all commits now use his private GitHub address)
- [x] Publish the repo — **public** at https://github.com/theshafinahmed/knot-alone with description + topics
- [ ] (Optional) an animated GIF for the README

## Step 9 — New look (UI redesign) 🎨
Design canvas (private): "Knot Alone UI Redesign". Look: toy bricks in the sky, Fredoka + Nunito fonts, line icons, dark pills, chunky yellow buttons.
- [x] **9a. HUD + controls**: timer with checkpoint bar, host Retry/Lobby with "Are you sure?" (keys R / L), phone buttons (Jump + Punch in the corner, Pull only when a friend hangs, Emote top right), name tags that scale with distance, key-cap hint bar on computers
- [x] **9b. Join + Lobby** (done and pushed): name, shirt color, hat, **flat picture** preview in the card, player list, rope mode, robot buddies, Start. Desktop = side card; phone = bottom sheet with the player list.
- [ ] **9c. Invite card**: mock up on the canvas first, Shafin comments, then build
- [ ] **9d. Results card**: mock up on the canvas first, Shafin comments, then build
- [ ] **9e. Small stuff**: loading screen, "room is full" / error messages, remove the old `.card` / `.big` styles and leftover emoji in text
- Working rule: build a step → check phone + desktop sizes → Shafin looks → only then commit.

## Step 10 — Harder round + random worlds 🎲 (planned, not started)
Rule for this step: **work locally. Never commit or push without Shafin's OK.**
Shafin picked: new obstacles, longer + branching paths, teams racing on one course, host picks difficulty.

**Part A — a hand-made hard course** (invent and test the new rooms)
- [x] 10a. Six new obstacles (Shafin picked), easy ones first, each tried in a small test room:
  - [x] ⬆️ Elevator bricks (go up and down) — ✅ Shafin tried it: perfect
  - [x] ➡️ Conveyor belt (floor pushes you) — ✅ Shafin tried it: perfect
  - [x] 🧊 Ice bricks (slippery, hard to stop) — ✅ Shafin tried it: perfect
  - [x] 🦘 Trampoline (bounces you high, yanks friends up) — ✅ Shafin tried it: perfect
  - [x] 🔨 Swinging hammer (knocks you off the path) — ✅ Shafin tried it: perfect
  - [x] 💨 Wind zone (blows you and the rope sideways) — ✅ Shafin tried it: perfect
- [ ] 10b. Forks: short-but-scary vs long-but-safe paths that join again
- [ ] 10c. Teams share one course (no lanes): wider paths, ropes can tangle with other teams
- [ ] 10d. Build the hard course from these pieces; Shafin + friends play it

**Part B — random worlds**
- [x] 10e. (built, waiting for Shafin to try the Room Gallery) Cut the courses into "rooms" (old Sky Course parts + the new obstacles, no trampoline), each with a door in, a door out, a danger cost, and stretch settings; test each room alone
- [ ] 10f. World maker: seed → pick rooms within the difficulty budget → snap them together, checkpoints between rooms, brick limit
- [ ] 10g. Robot tester: a smarter test robot plays each new world on the server; fail → roll again
- [ ] 10h. Lobby: course picker (Sky Course / Hard course / 🎲 Random) + Easy / Medium / Hard
- [ ] 10i. Speed check on a phone-sized screen; Shafin + friends play 5 random worlds
