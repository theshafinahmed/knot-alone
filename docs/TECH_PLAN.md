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

- **Server-authoritative.** The server runs the Rapier physics world at a fixed **30 ticks per second**.
- **Clients send inputs** (joystick direction, jump pressed, camera angle) about 30 times per second.
- **Server sends snapshots** (every player's position, rotation, state; rope endpoints; checkpoint/timer state) about 20–30 times per second.
- **Clients interpolate**: they draw everyone slightly in the past (~100 ms) and smoothly slide between snapshots, so movement looks smooth even with lag.
- **Own-player prediction** (the client moving you instantly before the server confirms) is **not in v1**. Add it only if friends far away say controls feel slow. ⚠️ This is the main known risk for players with high ping.
- **One HTTP + WebSocket server on one port.** The same Node server sends the built game files *and* handles the WebSocket. That way the tunnel only needs one link.
- **Messages:** start with JSON for simplicity. Switch to binary later only if needed.

## The rope (the hardest part) 🪢

- A real wiggly rope is too heavy for phones and too hard to keep in sync.
- **v1 plan:** each rope = a Rapier **rope joint** (a max-distance limit) between two player bodies, plus a gentle spring pull when it's stretched. It acts like a **stretchy leash**.
- The rope you **see** is just drawn: a curved tube between the two players that sags when loose and goes straight when tight. The drawing doesn't affect physics.
- The rope look matches the video: red-and-white stripes.

## Characters

- Physics body: a **capsule** (pill shape) kept upright while walking.
- Look: blocky boxes (head, body, arms, legs), built in code, no model files needed.
- "Floppy" fall: when falling or yanked hard, the character tilts and flails (fake ragdoll animation first; real ragdoll later only if it's worth it).
- Name tag: text drawn above the head, always facing the camera.

## Phone performance rules 📱

- Simple shapes only, few lights, no expensive real-time shadows (use a soft round "blob" shadow under each player).
- Limit the screen sharpness on phones (pixel ratio max ~1.5–2).
- Brick studs: reuse the same shape many times (instancing), so thousands of studs stay cheap.
- Target: smooth on a normal mid-range Android phone.

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

## Host controls

- The **first person to join** becomes the host (usually the person running the server). They get the rope-mode picker and the Start button.
