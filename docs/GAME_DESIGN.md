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
- A friend on top can **pull you up** (bots do this automatically; humans **hold the 🪢 button on a phone, or the E key on a computer**).
- When you get close to the top, you **scramble over the edge** automatically.
- Land too hard (big fall) and you lie flat like a starfish for about 1 second. ⭐

## Fun actions 🎭

| Action | What it does | Phone | Computer |
|---|---|---|---|
| 👋 Wave | One arm up, waving (you can walk while waving) | 😀 menu | **1** |
| 💃 Dance | Silly dance for 4 s (stops when you walk) | 😀 menu | **2** |
| 🎉 Cheer | Both arms up, hopping | 😀 menu | **3** |
| 👊 Punch | Throws a punch. Whoever is right in front of you gets a **small shove**: they stumble back ~1.2 m and can't steer for a moment. Standing at an edge = danger 😈 | 👊 button | **F** or **click** |

- An emoji bubble pops up over your head while you do an action.
- You can't punch again for 0.6 s (no spamming). You can't do actions while lying flat or hanging.

## Falling

- Falling off the platforms = your **whole team goes back to the last checkpoint** they reached.
- Until checkpoints exist (Step 6), the team goes back to the start.
- Checkpoints are glowing pads along the course. When any team member touches one, the team saves there.

## The course (first version): the Sky Course 🧱☁️

| # | Section | What's there |
|---|---|---|
| 🏁 | Start | Big red platform, teams line up side by side |
| 1 | Warm-up | Gaps and steps going up |
| 2 | Zig-zag bridges | Thin 2-stud bridges with sharp turns |
| 3 | Spinning discs | Two spinning discs to hop across + a sweeper bar to jump over |
| 4 | Sliding blocks | Stepping stones sliding side to side + pusher blocks sweeping a bridge |
| 5 | Brick maze | Walls too tall to jump; one gap per row, in a different spot each time |
| 6 | Tower climb | Zig-zag stairs up into the sky → 🏆 finish arch |

- There's a **checkpoint** (glowing pad + flag) after every section. Flags turn **gold** when your team reaches them.
- The race starts with **3, 2, 1, GO!** (nobody can move during it). A timer counts up.
- **Finish:** the **whole team** must stand on the checkered finish floor. Then a results card shows every team's time (🥇🥈🥉) and the best time tonight. The host can press **▶ Play again** or **🏠 Lobby**.
- In team races, all teams share the **same path** (bump, tangle and punch each other).
- Difficulty: **medium**. Falls happen and are funny, checkpoints are close.

### Original notes

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
| **Phone** | **Movement circle** always shown in the bottom-left (with arrows + a "Move" hint) | Jump button (right side) | Swipe anywhere else on the screen |
| **Computer** | W A S D / arrow keys | Space | Mouse |

- No grab button in the first version (maybe later).

## Joining a game (how it feels)

1. The host runs **one command** on their computer.
2. The game prints a **link**. The host sends it to friends (WhatsApp, Discord, anything).
3. Friends tap the link → type their name → pick color + hat → they're in the lobby, standing on the start platform with their name above their head.
4. The host picks the rope mode, adds robot buddies if they want to fill spots, and presses **Start**.
5. Hats to pick from: none 🚫, cap 🧢, top hat 🎩, crown 👑, party hat 🎉, straw hat 👒. Shirt colors: red, blue, green, yellow, purple, orange, pink, teal.

## Not in the game (on purpose)

- ❌ No in-game voice chat. Friends use Discord/WhatsApp calls.
- ❌ No money, no ads, no accounts. It's **open source** on GitHub.
- ❌ No big public online servers. Everyone hosts on their own computer.
