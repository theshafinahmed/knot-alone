# CLAUDE.md — Knot Alone

## How to talk to Shafin

- **Use very simple language.** So simple that a kid could understand it.
- Shafin is **not a technical person**. Don't use tech words unless you have to. If you do use one, explain it right away in plain words, with an everyday example.
- Short sentences. One idea at a time.
- Use real-life comparisons (games, school, shops, toys) to explain how things work.
- When unsure about something, ask using **choice cards** (the multiple-choice question tool).
- Make tech choices yourself (Shafin isn't technical), but explain them simply and log them in `docs/DECISIONS.md`.

## About the project (short version)

- **Knot Alone** is a 3D multiplayer game that runs in the phone's (and computer's) web browser.
- **2–6 players** are tied together with ropes and race through a floating toy-brick obstacle course to the finish line.
- Blocky, Roblox-style characters. Low-quality models are fine. The **name above each player's head** is a must-have.
- **Free only.** Open source on GitHub. Not for money.
- **Self-hosted:** whoever clones the repo runs the server on their own computer (the "boss"). Friends anywhere in the world join with a link through a free **Cloudflare Quick Tunnel**.

## 📚 Start every session by reading these

| File | What's in it |
|---|---|
| [docs/PROGRESS.md](docs/PROGRESS.md) | **Where we are right now** + session log. Read first. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The build steps in order, with checkboxes |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | What the game is: players, ropes, controls, course, characters |
| [docs/TECH_PLAN.md](docs/TECH_PLAN.md) | How it's built: tools, server/client, rope physics, phone performance |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every important choice and **why**. Don't re-argue these without a new reason. |

## ✍️ Keep the docs alive

- **At the end of every session** (or after finishing a roadmap item): update `docs/PROGRESS.md` (current step + a new line in the session log) and tick boxes in `docs/ROADMAP.md`.
- New or changed decision → add a row to `docs/DECISIONS.md`, and fix `GAME_DESIGN.md` / `TECH_PLAN.md` if they're affected.
- Docs are for Shafin too, so write them in simple words.

## How we work

- **Fun first, size later.** Prove each piece is fun (especially the rope) before building more on top.
- Build in small steps from `docs/ROADMAP.md`. Show Shafin something he can try on his phone as often as possible.
- Test and check the work before saying it's done.
