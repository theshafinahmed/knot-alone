# 🎮 Knot Alone — Game Design

> What the game **is**. If something here changes, update this file and add a line to [DECISIONS.md](DECISIONS.md).

## The idea in one sentence

Friends get **tied together with ropes** and have to run, jump and drag each other through a floating toy-brick obstacle course to the finish line. If one person falls, the others feel it. 🪢

Inspired by a co-op rope game seen in a streamer video (players tied with striped ropes, LEGO-style platforms in the sky, ragdoll falls).

## Players

- **2 to 6 players** in one game (Shafin's friend group is 6).
- Everyone plays on the **same server** (the host's computer). One game room per server.

## Rope setup (host chooses before each game)

| Mode | What it means |
|---|---|
| **One big chain** | All players tied in one line. Maximum chaos. |
| **Teams of 3** | 2 teams of 3, racing each other. |
| **Teams of 2** | 3 teams of 2, racing each other. |

- With fewer players, the game only offers the modes that fit (for example, 4 players → chain or 2 teams of 2).
- Inside a team, players are tied in a **line**: A–B–C. Each rope connects 2 neighbors.

## Goal

- **Reach the finish line.** One course, start to end.
- A timer shows how long your team takes. Beat your best time.
- In team modes, the first team to the finish wins.

## Hanging, catching and climbing 🧗

- If you fall off an edge, your rope can catch you and you **hang** off the side.
- A friend who is **standing still plants their feet** and can hold you.
- **Tap jump while hanging** to climb up the rope, hand over hand.
- A friend on top can **pull you up** (bots do this automatically; a "pull" button for humans may come later).
- When you get close to the top, you **scramble over the edge** automatically.
- Land too hard (big fall) and you lie flat like a starfish for about 1 second. ⭐

## Falling

- Falling off the platforms = your **whole team goes back to the last checkpoint** they reached.
- Until checkpoints exist (Step 6), the team goes back to the start.
- Checkpoints are glowing pads along the course. When any team member touches one, the team saves there.

## The course (first version)

- **1 course**, about **5 minutes** long if nobody falls.
- **Theme: toy bricks in the sky.** Colorful LEGO-style blocks with studs, floating above clouds, bright blue sky.
- Obstacle ideas (from the video): thin bridges, spinning discs with holes, sliding/pushing blocks, a walled maze section, gaps you have to jump.
- More courses come **after** the first one is fun.

## Characters

- **Blocky, Roblox-style.** Made of simple boxes: head, body, 2 arms, 2 legs.
- Each player picks a **body color** and **one hat**.
- **Their name floats above their head.** This is a must-have. ✅
- When they fall or get yanked, they go floppy (ragdoll-style), because it's funny.

## Controls

| Device | Move | Jump | Look around |
|---|---|---|---|
| **Phone** | Left thumb joystick | Jump button (right side) | Drag on the screen |
| **Computer** | W A S D / arrow keys | Space | Mouse |

- No grab button in the first version (maybe later).

## Joining a game (how it feels)

1. The host runs **one command** on their computer.
2. The game prints a **link**. The host sends it to friends (WhatsApp, Discord, anything).
3. Friends tap the link → type their name → pick color + hat → they're in the lobby.
4. The host picks the rope mode and presses **Start**.

## Not in the game (on purpose)

- ❌ No in-game voice chat. Friends use Discord/WhatsApp calls.
- ❌ No money, no ads, no accounts. It's **open source** on GitHub.
- ❌ No big public online servers. Everyone hosts on their own computer.
