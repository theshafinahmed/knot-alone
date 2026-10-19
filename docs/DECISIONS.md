# 🧠 Knot Alone — Decision Log

> Every important choice, **and why**. Newest at the bottom. Don't re-argue a decision without a new reason. If one changes, add a new line saying what changed and why.

| Date | Decision | Why |
|---|---|---|
| 2026-10-19 | Game is a 3D multiplayer **phone-browser** game called **Knot Alone** | Shafin's idea. Inspired by a rope co-op game video. |
| 2026-10-19 | Characters are **blocky, Roblox-style** | Light enough for phones, easy to build in code, still charming. |
| 2026-10-19 | **Free only.** Open source on GitHub, no money-making | Shafin's goal: a fun project for friends, not a business. |
| 2026-10-19 | **Self-hosted:** the host's own computer runs the server (the boss) | Free, stronger than free cloud servers, no sleeping or usage limits. |
| 2026-10-19 | **Cloudflare Quick Tunnel** so friends anywhere can join through a link | Free, no account, works with browser games (HTTPS + WebSocket), friends install nothing. Beats ngrok (warning page, limits), playit.gg (built for downloaded games), Tailscale (everyone must install an app). |
| 2026-10-19 | **2–6 players**, host picks rope mode: one chain / teams of 3 / teams of 2 | Shafin's group is 6 friends. Gives both co-op and racing. |
| 2026-10-19 | Goal = **reach the finish line**. Falling sends the team to the **last checkpoint** | Fair but still funny. Like the video. |
| 2026-10-19 | Controls: **joystick + jump** on phones, **WASD + space + mouse** on computers. No grab button in v1 | Simple and familiar. Grab can come later. |
| 2026-10-19 | Looks: **color + one hat**, and the **name above the head** (must-have) | Easy to tell friends apart. Name tags were Shafin's top priority. |
| 2026-10-19 | **No in-game voice chat.** Use Discord/WhatsApp | Zero extra work. |
| 2026-10-19 | Theme: **toy bricks in the sky**. **1 course, ~5 minutes** for v1 | Make one course really fun before making more. |
| 2026-10-19 | Tools: **TypeScript, Three.js, Rapier, Node.js + ws, Vite** | All free, run well in browsers and on phones, widely used (easy to get help). |
| 2026-10-19 | **Server-authoritative physics** (30 ticks/sec), clients send inputs and draw snapshots | Keeps everyone agreeing on where the rope and players are. The boss decides. |
| 2026-10-19 | Rope = **max-distance joint + spring**, drawn as a sagging striped tube | Real rope simulation is too heavy and hard to sync. Fake-but-feels-right is the smart move. |
| 2026-10-19 | **Fun check before multiplayer** (rope test with bots in Step 3) | If the rope isn't fun alone, multiplayer won't save it. |
| 2026-10-19 | Physics runs at **60 steps/sec** (not 30), and lives in `shared/sim/` | Smoother jumps. Shared code means the server can run the same rules in Step 4 without a rewrite. |
| 2026-10-19 | Player = **dynamic capsule** with locked rotation, speed set directly (not Rapier's kinematic character controller) | Ropes (joints) can only pull dynamic bodies. Setting speed directly keeps controls snappy. |
| 2026-10-19 | Keep **rapier3d-compat** + server compression (brotli/gzip) | Works the same in browser and Node with zero setup. ~1.5 MB download after squeezing is OK. |
| 2026-10-19 | Ropes **bend over brick edges** (our own rule on top of Rapier's straight rope joint) | The straight joint went through bricks, so hanging players swung under platforms and could never be pulled up. |
| 2026-10-19 | **Climbing = shortening the rope** (tap jump while hanging). Rescuers **plant their feet and reel in** instead of walking away | Jumping up a fixed-length rope just drops you back down. Walking away to pull flung players across thin bridges. |
| 2026-10-19 | Standing still = **braced** (much stronger grip). No air brakes when not pressing anything | Catching a falling friend is the best moment in a rope game. It needs to be possible. |
| 2026-10-19 | You can only hang from an **edge** or a **friend who is standing** | Without this, two falling players "climbed" each other up into the sky. |
| 2026-10-19 | Keep players able to **stand on each other's heads** | It happens naturally after a rescue and it's funny. |
| 2026-10-19 | **Snapshots 30×/sec, JSON**, drawn **100 ms in the past** with smoothing | Simple, small enough for 6 players, smooth on Wi-Fi. Can switch to binary or a smaller delay later if needed. |
| 2026-10-19 | **No own-player prediction yet** | Keeps everyone exactly in sync with the boss. Small delay is OK on Wi-Fi. Add later only if far-away friends feel it. |
| 2026-10-19 | Players remembered by a **secret token on the phone** | A phone that drops off Wi-Fi or reloads gets its character back mid-game. |
| 2026-10-19 | Host can add **robot buddies** in the lobby | Lets Shafin test alone, and fills teams when there are fewer friends. |
| 2026-10-19 | People who drop out mid-game become **dead weight** until they return | Removing them would break the rope chain for everyone else. |
| 2026-10-19 | Use the **`cloudflared` npm package** to get and run Cloudflare's official tunnel program | One `npm install` and it just works on Windows/Mac/Linux. Nobody has to install anything by hand. |
| 2026-10-19 | Print a **QR code** in the terminal + an **Invite card** in the lobby | Shafin wants to run the server and play from his phone without touching the computer. Scan and play. |
| 2026-10-19 | The host is **whoever joins first**, not the computer | The computer is just the field; the captain can be on a phone. Tip printed at startup. |
| 2026-10-19 | A tunnel problem **never crashes the server** | Wi-Fi play should keep working even with no internet. |
| 2026-10-19 | Add **fun actions before the course**: wave, punch, dance, cheer | Shafin's idea. Messing with friends is a big part of the fun in rope games. |
| 2026-10-19 | Punch = **small shove** (~1.2 m stumble), not a big knockback | Funny and can push someone off an edge, but doesn't ruin the game. Shafin picked it. |
| 2026-10-19 | Phone: **😀 menu** for wave/dance/cheer + its own **👊 button**. Computer: F/click, 1/2/3 | Keeps the phone screen clean; punch needs to be fast. |
| 2026-10-19 | The **server decides** who got punched | Every phone sees the same shove. No arguing. |
