// The game room 🏠 — one per server. Keeps the lobby list, runs the game, and is the boss
// of where everyone is. Phones only send their button presses and draw what the room says.

import { WebSocket } from 'ws';
import { ACTION_CODE, isAction } from '../shared/actions';
import { SKY_COURSE } from '../shared/sky-course';
import { cleanName, HATS, isHat, isShirtColor, SHIRT_COLORS, type Hat } from '../shared/looks';
import {
  FLAG_GROUNDED,
  FLAG_HANGING,
  FLAG_STUNNED,
  type ClientMessage,
  type Invite,
  type LobbyPlayer,
  type Phase,
  type ServerMessage,
  type SnapEvent,
  type SnapPlayer,
  type SnapRope,
} from '../shared/messages';
import { isRopeMode, MAX_PLAYERS, modeFits, splitTeams, type RopeMode } from '../shared/teams';
import { BotBrain } from '../shared/sim/bots';
import { GameWorld, NO_INPUT, TICK, type PlayerInput } from '../shared/sim/world';

/** Snapshots per second sent to every phone. */
const SNAPSHOT_RATE = 30;

interface Person {
  id: string;
  token: string;
  name: string;
  color: number;
  hat: Hat;
  socket: WebSocket | null;
  joinedAt: number;
  input: PlayerInput;
  /** Last jump counter we saw from this phone. */
  jumps: number;
}

interface Bot {
  id: string;
  name: string;
  color: number;
  hat: Hat;
  brain: BotBrain | null;
}

interface Game {
  world: GameWorld;
  players: LobbyPlayer[];
  teams: string[][];
  ropes: [string, string, number][];
}

const round = (n: number) => Math.round(n * 100) / 100;

export class Room {
  private people = new Map<string, Person>(); // by id
  private phase: Phase = 'lobby';
  private mode: RopeMode = 'chain';
  private botCount = 0;
  private game: Game | null = null;
  private nextId = 1;
  private loop: NodeJS.Timeout | null = null;
  private invite: Invite | null = null;

  /** The link friends can use to join (shown in everyone's lobby). */
  setInvite(invite: Invite) {
    this.invite = invite;
    this.sendLobby();
  }

  // ---------- Connections ----------

  connect(socket: WebSocket) {
    let person: Person | null = null;
    // Show the lobby right away, so you can see who's here before joining.
    this.send(socket, this.lobbyMessage());

    socket.on('message', (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (message.type === 'join') {
        person = this.join(socket, message);
        return;
      }
      if (person) this.handle(person, message);
    });

    socket.on('close', () => {
      if (!person || person.socket !== socket) return;
      person.socket = null;
      console.log(`👋 ${person.name} left`);
      // In the lobby, people who leave are gone. In a game, they stay as dead weight (and can come back).
      if (this.phase === 'lobby') this.people.delete(person.id);
      this.sendLobby();
    });
  }

  private join(socket: WebSocket, message: Extract<ClientMessage, { type: 'join' }>): Person | null {
    const token = typeof message.token === 'string' ? message.token.slice(0, 64) : '';
    let person = [...this.people.values()].find((p) => token && p.token === token) ?? null;

    if (!person) {
      if (this.people.size >= MAX_PLAYERS) {
        this.send(socket, { type: 'full' });
        return null;
      }
      person = {
        id: `p${this.nextId++}`,
        token,
        name: '',
        color: SHIRT_COLORS[0],
        hat: 'none',
        socket,
        joinedAt: Date.now(),
        input: NO_INPUT,
        jumps: 0,
      };
      this.people.set(person.id, person);
    } else if (person.socket && person.socket !== socket) {
      person.socket.close(); // same player opened the game again somewhere else
    }

    const isNew = !person.name;
    const cameBack = !person.socket;
    person.socket = socket;
    person.name = cleanName(message.name);
    if (isShirtColor(message.color)) person.color = message.color;
    if (isHat(message.hat)) person.hat = message.hat;
    if (isNew) console.log(`🙋 ${person.name} joined (${this.people.size} people)`);
    else if (cameBack) console.log(`🔌 ${person.name} came back`);

    this.send(socket, { type: 'welcome', id: person.id });
    this.sendLobby();
    if (this.game) {
      const { players, teams, ropes } = this.game;
      this.send(socket, { type: 'start', players, teams, ropes });
    }
    return person;
  }

  private handle(person: Person, message: ClientMessage) {
    switch (message.type) {
      case 'input': {
        const x = Number(message.x) || 0;
        const z = Number(message.z) || 0;
        const length = Math.hypot(x, z);
        const jumps = Number(message.jumps) || 0;
        const jumped = jumps > person.jumps;
        person.jumps = Math.max(person.jumps, jumps);
        person.input = {
          x: length > 1 ? x / length : x,
          z: length > 1 ? z / length : z,
          jump: person.input.jump || jumped, // stays true until the next physics step uses it
          pull: message.pull === true,
        };
        break;
      }
      case 'action':
        if (this.game && isAction(message.action)) this.game.world.doAction(person.id, message.action);
        break;
      case 'setup':
        if (!this.isHost(person) || this.phase !== 'lobby') return;
        if (isRopeMode(message.mode)) this.mode = message.mode;
        if (typeof message.bots === 'number') {
          this.botCount = Math.max(0, Math.min(MAX_PLAYERS - this.people.size, Math.floor(message.bots)));
        }
        this.sendLobby();
        break;
      case 'start':
        if (this.isHost(person) && this.phase === 'lobby') this.startGame();
        break;
      case 'restart':
        // Play again: a fresh race with the same teams and settings.
        if (this.isHost(person) && this.game) this.startGame();
        break;
      case 'backToLobby':
        if (this.isHost(person) && this.phase === 'playing') this.endGame();
        break;
    }
  }

  // ---------- Lobby ----------

  /** The host is whoever has been here the longest and is still connected. */
  private hostId() {
    let host: Person | null = null;
    for (const person of this.people.values()) {
      if (person.socket && (!host || person.joinedAt < host.joinedAt)) host = person;
    }
    return host?.id ?? null;
  }

  private isHost(person: Person) {
    return this.hostId() === person.id;
  }

  private lobbyPlayers(): LobbyPlayer[] {
    const hostId = this.hostId();
    return [...this.people.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hat: p.hat,
      host: p.id === hostId,
      bot: false,
      online: !!p.socket,
    }));
  }

  private lobbyMessage(): ServerMessage {
    return {
      type: 'lobby',
      phase: this.phase,
      players: this.lobbyPlayers(),
      mode: this.mode,
      bots: this.botCount,
      invite: this.invite,
    };
  }

  private sendLobby() {
    // Keep the settings valid as people come and go.
    this.botCount = Math.min(this.botCount, MAX_PLAYERS - this.people.size);
    if (!modeFits(this.mode, this.people.size + this.botCount)) this.mode = 'chain';
    this.broadcast(this.lobbyMessage());
  }

  // ---------- The game ----------

  private startGame() {
    const people = [...this.people.values()].filter((p) => p.socket);
    if (people.length === 0) return;

    // Bots wear shirt colors nobody else picked.
    const freeColors = SHIRT_COLORS.filter((c) => !people.some((p) => p.color === c));
    const bots: Bot[] = Array.from({ length: this.botCount }, (_, i) => ({
      id: `b${i + 1}`,
      name: `Bot ${i + 1}`,
      color: freeColors[i % freeColors.length] ?? SHIRT_COLORS[i % SHIRT_COLORS.length],
      hat: HATS[(i * 2 + 1) % HATS.length],
      brain: null,
    }));

    const teams = splitTeams(
      people.map((p) => p.id),
      bots.map((b) => b.id),
      this.mode,
    );

    this.game?.world.dispose();
    const world = new GameWorld(SKY_COURSE);
    const ropes: [string, string, number][] = [];
    teams.forEach((team, t) => {
      team.forEach((id, slot) => world.addPlayer(id, t, slot, teams.length));
      for (let i = 1; i < team.length; i++) {
        world.tie(team[i - 1], team[i]);
        const rope = world.getRopes().at(-1)!;
        ropes.push([rope.a, rope.b, rope.length]);
      }
    });
    world.lineUp(); // now that everyone is added, line each team up properly at the start

    // Each bot follows the player in front of it. A bot at the front of a team follows someone else.
    const botsById = new Map(bots.map((b) => [b.id, b]));
    for (const team of teams) {
      team.forEach((id, slot) => {
        const bot = botsById.get(id);
        if (!bot) return;
        const leader = slot > 0 ? team[slot - 1] : (teams.find((t) => t !== team)?.[0] ?? null);
        if (leader) bot.brain = new BotBrain(id, leader);
      });
    }
    this.bots = bots;

    const hostId = this.hostId();
    const players: LobbyPlayer[] = [
      ...people.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hat: p.hat,
        host: p.id === hostId,
        bot: false,
        online: true,
      })),
      ...bots.map((b) => ({ id: b.id, name: b.name, color: b.color, hat: b.hat, host: false, bot: true, online: true })),
    ];

    for (const person of people) person.input = NO_INPUT;
    this.game = { world, players, teams, ropes };
    this.phase = 'playing';
    console.log(`🏁 Game started: ${teams.map((t) => t.length).join(' + ')} players (${this.mode})`);
    this.broadcast({ type: 'start', players, teams, ropes });
    this.sendLobby();
    this.startLoop();
  }

  private bots: Bot[] = [];
  /** Fastest finish since the server started (seconds). */
  private bestTime: number | null = null;

  private endGame() {
    this.stopLoop();
    this.game?.world.dispose();
    this.game = null;
    this.bots = [];
    this.phase = 'lobby';
    // People who left during the game are gone now.
    for (const [id, person] of this.people) if (!person.socket) this.people.delete(id);
    console.log('🏠 Back to the lobby');
    this.sendLobby();
  }

  private startLoop() {
    this.stopLoop();
    let last = performance.now();
    let leftover = 0;
    let lastSnapshot = 0;

    // Windows timers are not very exact, so we check often and catch up in fixed steps.
    this.loop = setInterval(() => {
      const now = performance.now();
      leftover = Math.min(leftover + (now - last) / 1000, 0.25);
      last = now;
      while (leftover >= TICK) {
        this.tick();
        leftover -= TICK;
      }
      if (now - lastSnapshot >= 1000 / SNAPSHOT_RATE - 1) {
        lastSnapshot = now;
        this.sendSnapshot(now);
      }
    }, 5);
  }

  private stopLoop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  private tick() {
    const game = this.game;
    if (!game) return;
    const inputs = new Map<string, PlayerInput>();
    for (const person of this.people.values()) {
      // Phones that lost connection go floppy (dead weight) until they come back.
      inputs.set(person.id, person.socket ? person.input : { ...NO_INPUT, limp: true });
      person.input = { ...person.input, jump: false };
    }
    for (const bot of this.bots) {
      if (bot.brain) inputs.set(bot.id, bot.brain.think(game.world, 'follow'));
    }
    game.world.step(inputs);
    // Collect what happened (punches, checkpoints, finishes, falls) for the next snapshot.
    for (const event of game.world.events) {
      if (event.kind === 'hit') this.pendingEvents.push(['hit', round(event.x), round(event.y), round(event.z)]);
      else if (event.kind === 'checkpoint') this.pendingEvents.push(['cp', event.team, event.index]);
      else if (event.kind === 'finish') this.pendingEvents.push(['fin', event.team]);
      else this.pendingEvents.push(['fall', event.team]);
    }
    game.world.events = [];
  }

  private pendingEvents: SnapEvent[] = [];

  private sendSnapshot(now: number) {
    const game = this.game;
    if (!game) return;
    const p: SnapPlayer[] = [];
    for (const id of game.world.playerIds) {
      const s = game.world.getState(id)!;
      const flags = (s.grounded ? FLAG_GROUNDED : 0) | (s.stunned ? FLAG_STUNNED : 0) | (s.hanging ? FLAG_HANGING : 0);
      const action = s.action ? ACTION_CODE[s.action] : 0;
      p.push([
        id,
        round(s.x),
        round(s.y),
        round(s.z),
        round(s.vx),
        round(s.vy),
        round(s.vz),
        round(s.facing),
        flags,
        action,
        round(s.actionTime ?? 0),
      ]);
    }
    const r: SnapRope[] = game.world.getRopes().map((rope) => {
      const out = [round(rope.current)];
      for (const p of rope.points.slice(1, -1)) out.push(round(p.x), round(p.y), round(p.z));
      return out;
    });
    // Race clock, and each team's progress: [last checkpoint, finish time or −1].
    const progress = game.world.teamProgress;
    for (const team of progress) {
      if (team.finishedAt !== null && (this.bestTime === null || team.finishedAt < this.bestTime)) {
        this.bestTime = team.finishedAt;
      }
    }
    this.broadcast({
      type: 'snap',
      t: Math.round(now),
      p,
      r,
      rt: round(game.world.raceTime),
      tp: progress.map((team) => [team.checkpoint, team.finishedAt === null ? -1 : round(team.finishedAt)]),
      bt: this.bestTime === null ? -1 : round(this.bestTime),
      ...(this.pendingEvents.length ? { ev: this.pendingEvents } : {}),
    });
    this.pendingEvents = [];
  }

  // ---------- Sending ----------

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  private broadcast(message: ServerMessage) {
    const text = JSON.stringify(message);
    for (const person of this.people.values()) {
      if (person.socket?.readyState === WebSocket.OPEN) person.socket.send(text);
    }
  }
}
