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
- [x] Phone: 👊 button + 😀 menu. Computer: F / click = punch, 1 wave, 2 dance, 3 cheer
- [x] Shafin tried it with friends ✅ works

## Step 6 — The real course 🏗️
- [ ] Build the ~5-minute toy-brick sky course
- [ ] Obstacles: thin bridges, spinning discs, sliding blocks, maze, jumps
- [ ] Checkpoints (team goes back to the last one after falling)
- [ ] Finish line + timer + "who won" screen for team modes

## Step 7 — Polish ✨
- [ ] Sounds (jump, rope snap, fall, checkpoint, finish)
- [ ] Confetti at checkpoints and the finish
- [ ] More hats
- [ ] Clouds, nicer sky

## Step 8 — Share it on GitHub 🚀
- [ ] Simple README: "how to host a game night in 3 steps"
- [ ] Open-source license
- [ ] Screenshots / GIF
- [ ] Publish the repo
