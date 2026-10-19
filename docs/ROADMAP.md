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
- [ ] You + robot buddies tied together with ropes
- [ ] Ropes pull, sag and go tight
- [ ] Falling drags your buddies
- [ ] Floppy falls
- [ ] **Shafin plays it and says if it's fun.** If not, fix the rope feel before moving on.

## Step 4 — Real friends on the same Wi-Fi 👥
- [ ] Server becomes the boss (physics runs on the host computer)
- [ ] Lobby: type name, pick color + hat
- [ ] **Names float above heads**
- [ ] Host picks rope mode (one chain / teams of 3 / teams of 2) and presses Start
- [ ] Smooth movement for other players (interpolation)

## Step 5 — Friends from anywhere in the world 🌍
- [ ] `npm start` opens a Cloudflare Quick Tunnel automatically
- [ ] Prints the link to share
- [ ] Test with a friend on a different internet connection
- [ ] If controls feel slow for far-away friends → add own-player prediction

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
