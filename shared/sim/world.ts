// The rules of the world 🌍: gravity, floors, running, jumping and ROPES.
// This lives in shared/ on purpose: right now it runs in the browser,
// and in Step 4 the server (the boss) will run this exact same code.

import RAPIER from '@dimforge/rapier3d-compat';
import { BRICK_HEIGHT, moverPose, moverVelocityAt, type BrickDef, type CourseDef, type MoverDef } from '../course';
import { ACTION_TIME, PUNCH, type ActionKind } from '../actions';

export { RAPIER };

/** Must be called once before making a GameWorld (loads the physics engine). */
export async function initPhysics() {
  await RAPIER.init();
}

/** Physics runs at a steady 60 steps per second, no matter how fast the screen draws. */
export const TICK = 1 / 60;

/** Seconds of "3, 2, 1, GO!" before the race starts (nobody can move during it). */
export const COUNTDOWN = 3;

export const PLAYER = {
  radius: 0.4,
  halfHeight: 0.55, // middle part of the pill; total height = 2 × (halfHeight + radius) = 1.9 m
  runSpeed: 7,
  groundAccel: 60,
  braceAccel: 160, // standing still = feet planted, much harder to drag (so you can catch a falling friend)
  airAccel: 25,
  jumpSpeed: 10,
  coyoteTime: 0.1, // you can still jump a moment after running off an edge
  jumpBuffer: 0.12, // pressing jump a moment before landing still counts
  stunSpeed: 15, // land faster than this and you lie flat for a moment
  stunTime: 0.9,
  limpSlide: 0.9, // how much speed a limp (not trying) player keeps per tick on the ground
  climbReel: 0.6, // each jump-tap while hanging pulls you this much further up the rope (meters)
  climbHop: 3, // ...with a little upward hop so it feels like climbing
  climbCooldown: 0.28,
  hangGrace: 0.5, // you still count as "hanging" this long after the rope goes slack (so you can keep climbing)
  mantleReach: 1.5, // feet this close below the edge top (chest at the edge) = close enough to scramble over
  mantleSpeed: 4,
  mantleTime: 0.4,
  swingDrag: 0.985,
};

export const ROPE = {
  /** The longest the rope can stretch, in meters. */
  length: 4,
  /** Climbing / pulling can shorten a rope down to this. */
  minLength: 1.0,
  /** A friend standing on top pulls a hanging player up this fast (meters per second). */
  pullSpeed: 1.6,
  /** When nobody hangs on it, a shortened rope slowly lets back out at this speed. */
  relaxSpeed: 1.5,
  /** Fastest the rope tugs players back together (m/s), so it pulls firmly but doesn't fling. */
  maxTug: 5,
  /** The rope is a chain of little links. More links = bends around things more smoothly. */
  segments: 10,
  /** How thick the rope is for bumping into things (meters). */
  radius: 0.08,
  /** How many times per tick we straighten the chain (more = stiffer, but slower). */
  iterations: 8,
  /** How much a link keeps its swing each tick (less = calms down faster). */
  damping: 0.96,
};

/** From the feet to the middle of the body. */
export const FEET_TO_CENTER = PLAYER.halfHeight + PLAYER.radius;

/** What a player wants to do this tick. */
export interface PlayerInput {
  /** Desired move direction on the ground, in world space. Length 0..1. */
  x: number;
  z: number;
  /** Jump was pressed. */
  jump: boolean;
  /** Not trying at all, like a sack of potatoes (used by lazy bots). */
  limp?: boolean;
  /** Standing still and pulling in the rope of a friend hanging below. */
  pull?: boolean;
}

export const NO_INPUT: PlayerInput = { x: 0, z: 0, jump: false };

export interface PlayerState {
  /** Feet position. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  /** Lying flat after a hard landing (can't move). */
  stunned: boolean;
  /** Dangling from a tight rope (tap jump to climb). */
  hanging: boolean;
  /** Which way the player faces (radians around the up axis). */
  facing: number;
  /** A fun action they're doing right now (wave, punch…), and how long they've been doing it. */
  action?: ActionKind | null;
  actionTime?: number;
}

/** Something that happened in the game, for sounds and confetti on the phones. */
export type WorldEvent =
  | { kind: 'hit'; x: number; y: number; z: number }
  | { kind: 'checkpoint'; team: number; index: number }
  | { kind: 'finish'; team: number }
  | { kind: 'fall'; team: number };

export interface TeamProgress {
  /** Index into course.checkpoints (0 = the start). */
  checkpoint: number;
  /** Race time when the whole team stood in the finish, or null. */
  finishedAt: number | null;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RopeState {
  a: string;
  b: string;
  /** Full rope length. */
  length: number;
  /** How long it is right now (shorter while someone climbs or gets pulled up). */
  current: number;
  /** The rope's links, from player a to player b (both ends included). */
  points: Vec3[];
  /** Which links are touching something (bricks, walls, moving parts). */
  touching: boolean[];
  /**
   * The links where the rope WRAPS around something (an edge, a wall corner, a pusher) — the
   * spots that actually hold the rope. A loose rope just lying on the floor doesn't count.
   */
  wraps: number[];
}

interface PlayerBody {
  body: RAPIER.RigidBody;
  coyote: number;
  jumpBuffer: number;
  grounded: boolean;
  facing: number;
  /** Fastest downward speed since leaving the ground. */
  fallSpeed: number;
  stunned: number;
  climbCooldown: number;
  /** The point this player hangs from (an edge or a friend above), or null. */
  hangPoint: Vec3 | null;
  /** The rope this player hangs from. */
  hangRope: RopeState | null;
  /** Seconds left that we still count as hanging after the rope went slack. */
  hangGrace: number;
  /** Pressing "pull" this tick. */
  pulling: boolean;
  /** Which team (lane) this player is in, and where they start. */
  team: number;
  /** Place in the team's line (0 = front), used to line up at checkpoints. */
  slot: number;
  /** How fast the floor under you moves (spinning disc, sliding block), so it carries you. */
  floorVelocity: { x: number; z: number };
  /** Scrambling over an edge: which way, and for how much longer. */
  mantle: { x: number; z: number; time: number };
  /** The fun action going on right now, and for how long (seconds). */
  action: { kind: ActionKind; time: number } | null;
  punchCooldown: number;
  /** Seconds left of stumbling after being punched (no control over your feet). */
  stumble: number;
}

export class GameWorld {
  readonly world: RAPIER.World;
  readonly course: CourseDef;
  private players = new Map<string, PlayerBody>();
  /** Seconds since the world started (moving parts and the race clock use this). */
  time = 0;
  /** Moving parts, and which collider belongs to which one. */
  private movers: { def: MoverDef; body: RAPIER.RigidBody }[] = [];
  private moverByCollider = new Map<number, MoverDef>();
  /** Each team's progress: last checkpoint reached, and when they finished (race seconds). */
  private teams = new Map<number, TeamProgress>();
  private teamCount = 1;
  /** Things that just happened (for sounds and confetti). The server collects and clears these. */
  events: WorldEvent[] = [];
  private ropes: RopeState[] = [];

  constructor(course: CourseDef) {
    this.course = course;
    this.world = new RAPIER.World({ x: 0, y: -25, z: 0 });
    this.world.timestep = TICK;

    for (const brick of course.bricks) {
      this.world.createCollider(brickCollider(brick).setTranslation(brick.x, brick.y - (brick.height ?? BRICK_HEIGHT) / 2, brick.z));
    }

    // Moving parts are "kinematic": they move along their path no matter what, and push players.
    for (const def of course.movers) {
      const pose = moverPose(def, 0);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.x, pose.y, pose.z),
      );
      const collider = this.world.createCollider(
        brickCollider(def.brick).setTranslation(0, -(def.brick.height ?? BRICK_HEIGHT) / 2, 0),
        body,
      );
      this.movers.push({ def, body });
      this.moverByCollider.set(collider.handle, def);
    }
  }

  /** Race time in seconds: negative during the countdown, 0 at "GO!". */
  get raceTime() {
    return this.time - COUNTDOWN;
  }

  /** Every team's progress, by team number. */
  get teamProgress(): TeamProgress[] {
    return Array.from({ length: this.teamCount }, (_, i) => this.teams.get(i) ?? { checkpoint: 0, finishedAt: null });
  }

  /** Frees the physics memory. Call when throwing this world away. */
  dispose() {
    this.world.free();
  }

  get playerIds() {
    return [...this.players.keys()];
  }

  /**
   * Adds a player. Each team gets its own lane on the start platform;
   * `slot` is their place in the line (0 = front).
   */
  addPlayer(id: string, team = 0, slot = this.players.size, teamCount = 1) {
    this.teamCount = Math.max(this.teamCount, teamCount);
    if (!this.teams.has(team)) this.teams.set(team, { checkpoint: 0, finishedAt: null });
    const spot = this.spawnSpot(team, slot, 0);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spot.x, spot.y, spot.z)
        .lockRotations() // stay standing up
        .setCcdEnabled(true), // don't fall through floors when moving fast
    );
    // No friction on the player, so they don't stick to walls. We control speed ourselves.
    this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      body,
    );
    this.players.set(id, {
      body,
      coyote: 0,
      jumpBuffer: 0,
      grounded: false,
      facing: Math.PI,
      fallSpeed: 0,
      stunned: 0,
      climbCooldown: 0,
      hangPoint: null,
      hangRope: null,
      hangGrace: 0,
      pulling: false,
      team,
      slot,
      floorVelocity: { x: 0, z: 0 },
      mantle: { x: 0, z: 0, time: 0 },
      action: null,
      punchCooldown: 0,
      stumble: 0,
    });
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    this.world.removeRigidBody(player.body); // also removes its ropes from the physics
    this.players.delete(id);
    this.ropes = this.ropes.filter((rope) => rope.a !== id && rope.b !== id);
  }

  /** Ties two players together with a rope 🪢 (tied at the middle of their bodies). */
  tie(a: string, b: string, length = ROPE.length) {
    const pa = this.players.get(a);
    const pb = this.players.get(b);
    if (!pa || !pb) return;
    const center = { x: 0, y: 0, z: 0 };
    this.world.createImpulseJoint(RAPIER.JointData.rope(length, center, center), pa.body, pb.body, true);
    const rope: RopeState = { a, b, length, current: length, points: [], touching: [], wraps: [] };
    this.ropes.push(rope);
    this.layRopeStraight(rope);
  }

  getRopes(): readonly RopeState[] {
    return this.ropes;
  }

  /** Moves the world forward by one tick. */
  step(inputs: Map<string, PlayerInput>) {
    const counting = this.raceTime < 0;
    for (const [id, player] of this.players) {
      // During "3, 2, 1" everyone stands still.
      this.applyInput(player, counting ? NO_INPUT : (inputs.get(id) ?? NO_INPUT));
    }
    this.updateActions();
    this.updateRopes();

    // Moving parts go where their path says they should be at the end of this tick.
    const next = this.time + TICK;
    for (const { def, body } of this.movers) {
      const pose = moverPose(def, next);
      body.setNextKinematicTranslation({ x: pose.x, y: pose.y, z: pose.z });
      body.setNextKinematicRotation({ x: 0, y: Math.sin(pose.angle / 2), z: 0, w: Math.cos(pose.angle / 2) });
    }
    this.world.step();
    this.time = next;
    this.updateRace();

    // If anyone falls all the way down, their whole team starts again.
    const fallenTeams = new Set<number>();
    for (const player of this.players.values()) {
      if (player.body.translation().y < this.course.fallLimit) fallenTeams.add(player.team);
    }
    for (const team of fallenTeams) {
      this.respawnTeam(team);
      this.events.push({ kind: 'fall', team });
    }
  }

  getState(id: string): PlayerState | undefined {
    const player = this.players.get(id);
    if (!player) return undefined;
    const p = player.body.translation();
    const v = player.body.linvel();
    return {
      x: p.x,
      y: p.y - FEET_TO_CENTER,
      z: p.z,
      vx: v.x,
      vy: v.y,
      vz: v.z,
      grounded: player.grounded,
      stunned: player.stunned > 0,
      hanging: player.hangPoint !== null,
      facing: player.facing,
      action: player.action?.kind ?? null,
      actionTime: player.action?.time ?? 0,
    };
  }

  /**
   * Starts a fun action (wave, punch, dance, cheer). Returns false if you can't right now
   * (lying flat, hanging, stumbling, or punching too fast).
   */
  doAction(id: string, kind: ActionKind) {
    const player = this.players.get(id);
    if (!player || player.stunned > 0 || player.stumble > 0 || player.hangPoint) return false;
    if (kind === 'punch') {
      if (player.punchCooldown > 0) return false;
      player.punchCooldown = PUNCH.cooldown;
    }
    player.action = { kind, time: 0 };
    return true;
  }

  /** Moves actions along, lands punches, and ends actions when they're done. */
  private updateActions() {
    for (const [id, player] of this.players) {
      player.punchCooldown -= TICK;
      const action = player.action;
      if (!action) continue;
      const before = action.time;
      action.time += TICK;
      // Getting knocked down or caught on a rope stops whatever you were doing.
      if (player.stunned > 0 || player.hangPoint) {
        player.action = null;
        continue;
      }
      if (action.kind === 'punch' && before < PUNCH.hitAt && action.time >= PUNCH.hitAt) this.landPunch(id, player);
      if (action.time >= ACTION_TIME[action.kind]) player.action = null;
    }
  }

  /** 👊 Shoves everyone standing right in front of the puncher. */
  private landPunch(puncherId: string, puncher: PlayerBody) {
    const from = puncher.body.translation();
    const aimX = Math.sin(puncher.facing);
    const aimZ = Math.cos(puncher.facing);
    for (const [id, target] of this.players) {
      if (id === puncherId) continue;
      const to = target.body.translation();
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const flat = Math.hypot(dx, dz);
      if (flat > PUNCH.reach || flat < 1e-3 || Math.abs(to.y - from.y) > 1.2) continue;
      // Only people in front of you (within a wide cone), not behind.
      if ((dx * aimX + dz * aimZ) / flat < 0.4) continue;
      const v = target.body.linvel();
      target.body.setLinvel(
        { x: v.x + (dx / flat) * PUNCH.shove, y: Math.max(v.y, PUNCH.hop), z: v.z + (dz / flat) * PUNCH.shove },
        true,
      );
      target.stumble = PUNCH.stumble;
      this.events.push({ kind: 'hit', x: to.x, y: to.y, z: to.z });
      target.action = null;
    }
  }

  /** How far you can go from `from` towards `to` before hitting something solid (null = nothing in the way). */
  hitDistance(from: Vec3, to: Vec3): number | null {
    const length = distance(from, to);
    if (length < 1e-4) return null;
    const ray = new RAPIER.Ray(from, scale(sub(to, from), 1 / length));
    const hit = this.world.castRay(ray, length, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    return hit ? hit.timeOfImpact : null;
  }

  /** How far below a point the nearest floor is (null = nothing below). Players don't count as floor. */
  distanceToFloor(x: number, y: number, z: number, maxDistance = 50): number | null {
    const ray = new RAPIER.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxDistance, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    return hit ? hit.timeOfImpact : null;
  }

  /** Puts everyone back at the start. */
  respawnAll() {
    for (const team of new Set([...this.players.values()].map((p) => p.team))) this.respawnTeam(team);
  }

  /** Puts one team back at its last checkpoint, standing in their line. */
  respawnTeam(team: number) {
    const members = new Set<string>();
    const checkpoint = this.teams.get(team)?.checkpoint ?? 0;
    const cp = this.course.checkpoints[checkpoint];
    for (const [id, player] of this.players) {
      if (player.team !== team) continue;
      members.add(id);
      player.body.setTranslation(this.spawnSpot(team, player.slot, checkpoint), true);
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      player.stunned = 0;
      player.fallSpeed = 0;
      player.facing = Math.atan2(cp.dirX, cp.dirZ);
      player.hangPoint = null;
      player.hangRope = null;
      player.hangGrace = 0;
      player.mantle.time = 0;
      player.action = null;
      player.stumble = 0;
    }
    for (const rope of this.ropes) {
      if (!members.has(rope.a) && !members.has(rope.b)) continue;
      rope.current = rope.length;
      this.layRopeStraight(rope);
    }
  }

  /** Puts a rope's links in a straight line between its two players (when tied, and after respawning). */
  private layRopeStraight(rope: RopeState) {
    const a = this.players.get(rope.a)!.body.translation();
    const b = this.players.get(rope.b)!.body.translation();
    const n = ROPE.segments;
    rope.points = Array.from({ length: n + 1 }, (_, i) => ({
      x: a.x + ((b.x - a.x) * i) / n,
      y: a.y + ((b.y - a.y) * i) / n,
      z: a.z + ((b.z - a.z) * i) / n,
    }));
    rope.touching = rope.points.map(() => false);
    this.ropePrevious.set(rope, rope.points.map((p) => ({ ...p })));
    this.ropeSafe.set(rope, rope.points.map((p) => ({ ...p })));
    this.ropeNormals.set(rope, rope.points.map(() => null));
    rope.wraps = [];
  }

  /** Where each rope link was last tick (that's how a link remembers how fast it's moving). */
  private ropePrevious = new Map<RopeState, Vec3[]>();

  /**
   * The real rope 🪢. Each rope is a chain of little links:
   *  - the two end links are tied to the players' waists,
   *  - the links in between fall with gravity and swing,
   *  - links can't get further apart than (rope length ÷ number of links),
   *  - links can't go inside bricks, walls or moving parts (they get pushed out).
   * So the rope drapes over edges, lies on the floor, wraps around walls, and gets shoved by
   * moving blocks. If the chain ends up longer than the rope (it had to go around something,
   * or got pushed), the rope tugs the players, which is how a pusher hitting your rope drags you.
   *
   * Ropes can also get shorter: a hanging player climbs (tap jump), a friend on top pulls it in.
   * When nobody hangs on it any more, it lets back out to full length.
   */
  private updateRopes() {
    const hungThisTick = new Set<PlayerBody>();
    const n = ROPE.segments;
    const gravityStep = 25 * TICK * TICK;

    for (const rope of this.ropes) {
      const pa = this.players.get(rope.a)!;
      const pb = this.players.get(rope.b)!;
      const a = pa.body.translation();
      const b = pb.body.translation();
      const points = rope.points;
      const previous = this.ropePrevious.get(rope)!;

      // 1) The ends follow the players. The links in between swing and fall.
      points[0] = { x: a.x, y: a.y, z: a.z };
      points[n] = { x: b.x, y: b.y, z: b.z };
      for (let i = 1; i < n; i++) {
        const p = points[i];
        const old = previous[i];
        const moved = {
          x: p.x + (p.x - old.x) * ROPE.damping,
          y: p.y + (p.y - old.y) * ROPE.damping - gravityStep,
          z: p.z + (p.z - old.z) * ROPE.damping,
        };
        previous[i] = p;
        points[i] = moved;
      }

      // 2) Keep neighboring links close together, and keep links out of solid things.
      const linkLength = rope.current / n;
      rope.touching.fill(false);
      this.ropeNormals.get(rope)!.fill(null);
      for (let k = 0; k < ROPE.iterations; k++) {
        for (let i = 0; i < n; i++) {
          const p = points[i];
          const q = points[i + 1];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dz = q.z - p.z;
          const length = Math.hypot(dx, dy, dz);
          if (length <= linkLength || length < 1e-6) continue;
          // The end links are tied to players and don't move here (the players get tugged below instead).
          const wp = i === 0 ? 0 : 1;
          const wq = i + 1 === n ? 0 : 1;
          if (wp + wq === 0) continue;
          const push = (length - linkLength) / length / (wp + wq);
          points[i] = { x: p.x + dx * push * wp, y: p.y + dy * push * wp, z: p.z + dz * push * wp };
          points[i + 1] = { x: q.x - dx * push * wq, y: q.y - dy * push * wq, z: q.z - dz * push * wq };
        }
        // Link i can never be further than i links from one end (and n−i from the other).
        // That's always true for a real rope, and it makes a tight rope snap straight right away
        // instead of sagging like a slow spring.
        for (let i = 1; i < n; i++) {
          points[i] = within(points[i], points[0], i * linkLength);
          points[i] = within(points[i], points[n], (n - i) * linkLength);
        }
        if (k % 2 === 1) this.pushRopeOutOfThings(rope, previous);
      }

      // 3) Where does the rope wrap around something? Like pulling a string tight: from one player,
      //    look along the chain as far as you can see in a straight line. The last link you can
      //    see is where the rope bends around something (an edge, a corner, a pusher). Then do
      //    the same from there. A loose rope sagging onto the floor doesn't block the view, so it
      //    doesn't count — only things the rope really goes AROUND.
      rope.wraps = this.ropeWrapPoints(points);

      // How long the rope has to be: straight from one player, around each wrap point, to the other.
      // (A loose sag doesn't make it "longer" — only going around things does.)
      let path = 0;
      let from = points[0];
      for (const i of rope.wraps) {
        path += distance(from, points[i]);
        from = points[i];
      }
      path += distance(from, points[n]);

      // Who is hanging? A player in the air, on a nearly tight rope, held up by an edge the rope
      // goes over, or by a friend who is standing on something. (Two falling players can't hold
      // each other up — otherwise they'd "climb" each other into the sky 🚀.)
      if (path > rope.current * 0.92) {
        const supportA = this.ropeSupport(rope, 'a', pb);
        const supportB = this.ropeSupport(rope, 'b', pa);
        // (Held from above: the support must be higher than your feet.)
        if (supportA && supportA.y > a.y - FEET_TO_CENTER + 0.3 && this.dangling(pa)) this.markHanging(pa, rope, supportA, hungThisTick);
        if (supportB && supportB.y > b.y - FEET_TO_CENTER + 0.3 && this.dangling(pb)) this.markHanging(pb, rope, supportB, hungThisTick);
      }

      // Shorten (friend pulling in a hanging player) or let back out (nobody hanging).
      const someoneHangs = pa.hangRope === rope || pb.hangRope === rope;
      const pulled = (pa.pulling && pb.hangRope === rope) || (pb.pulling && pa.hangRope === rope);
      if (pulled) rope.current = Math.max(ROPE.minLength, rope.current - ROPE.pullSpeed * TICK);
      else if (!someoneHangs) rope.current = Math.min(rope.length, rope.current + ROPE.relaxSpeed * TICK);

      if (path <= rope.current) continue;

      // 4) Too long: tug both players along the rope (towards their neighboring link).
      // Each player is pulled towards the nearest wrap point (or straight towards the other player).
      const firstWrap = rope.wraps.length ? points[rope.wraps[0]] : points[n];
      const lastWrap = rope.wraps.length ? points[rope.wraps[rope.wraps.length - 1]] : points[0];
      const ua = direction(points[0], firstWrap);
      const ub = direction(points[n], lastWrap);
      if (!ua || !ub) continue;
      const va = pa.body.linvel();
      const vb = pb.body.linvel();
      // How fast the rope is getting longer right now...
      const growing = -(dot(va, ua) + dot(vb, ub));
      // ...and we want it to shrink back, firmly but not flinging anyone.
      const wanted = -Math.min((path - rope.current) * 8, ROPE.maxTug);
      const fix = growing - wanted;
      if (fix <= 0) continue;
      // Equal weights: each player gets half the tug.
      pa.body.setLinvel(add(va, scale(ua, fix / 2)), true);
      pb.body.setLinvel(add(vb, scale(ub, fix / 2)), true);
    }

    // Players who stopped hanging keep counting as hanging for a short moment (so they can keep climbing).
    for (const player of this.players.values()) {
      player.pulling = false;
      if (hungThisTick.has(player)) continue;
      player.hangGrace -= TICK;
      if (player.grounded || player.hangGrace <= 0) {
        player.hangPoint = null;
        player.hangRope = null;
      }
    }
  }

  /**
   * Keeps rope links out of bricks, walls and moving parts (players don't count).
   *  1) A link can't pass THROUGH anything: we trace a line from its last safe spot to where it
   *     wants to go, and if that line hits something, the link stops at the surface.
   *  2) A link resting on something (or pushed into it by a moving part) is pushed back out.
   * A link touching something also slows down a lot (rope rubbing on a brick has friction).
   */
  private pushRopeOutOfThings(rope: RopeState, previous: Vec3[]) {
    const points = rope.points;
    const safe = this.ropeSafe.get(rope)!;
    const normals = this.ropeNormals.get(rope)!;
    const r = ROPE.radius;
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;
    for (let i = 1; i < points.length - 1; i++) {
      // 1) No passing through.
      const from = safe[i];
      const wanted = points[i];
      const travel = distance(from, wanted);
      if (travel > 1e-4) {
        const dir = scale(sub(wanted, from), 1 / travel);
        const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(from, dir), travel + r, true, flags);
        if (hit && hit.timeOfImpact < travel + r) {
          const stop = Math.max(0, hit.timeOfImpact - r);
          points[i] = add(add(from, scale(dir, stop)), scale(hit.normal, 0.01));
          rope.touching[i] = true;
          normals[i] = { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z };
        }
      }

      // 2) Push out of anything it's resting on or was shoved into.
      const p = points[i];
      const hit = this.world.projectPoint(p, false, flags);
      if (!hit) continue;
      const s = hit.point;
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dz = p.z - s.z;
      const gap = Math.hypot(dx, dy, dz);
      if (!hit.isInside && gap >= r + 0.02) continue;
      rope.touching[i] = true;
      if (gap < 1e-6) {
        points[i] = { x: s.x, y: s.y + r, z: s.z };
        normals[i] = { x: 0, y: 1, z: 0 };
      } else if (hit.isInside) {
        // Inside: go back out through the nearest side, plus the rope's thickness.
        points[i] = { x: s.x - (dx / gap) * r, y: s.y - (dy / gap) * r, z: s.z - (dz / gap) * r };
        normals[i] = { x: -dx / gap, y: -dy / gap, z: -dz / gap };
      } else {
        if (gap < r) points[i] = { x: s.x + (dx / gap) * r, y: s.y + (dy / gap) * r, z: s.z + (dz / gap) * r };
        normals[i] = { x: dx / gap, y: dy / gap, z: dz / gap };
      }
      // Friction: lose half the swing.
      const now = points[i];
      const old = previous[i];
      previous[i] = { x: now.x - (now.x - old.x) * 0.5, y: now.y - (now.y - old.y) * 0.5, z: now.z - (now.z - old.z) * 0.5 };
    }
    for (let i = 1; i < points.length - 1; i++) safe[i] = { ...points[i] };
  }

  /** The links where the rope bends around something (see "Where does the rope wrap" above). */
  private ropeWrapPoints(points: Vec3[]): number[] {
    const n = points.length - 1;
    const wraps: number[] = [];
    let from = 0;
    while (from < n) {
      let next = from + 1;
      while (next < n && this.clearLine(points[from], points[next + 1])) next++;
      if (next >= n) break;
      wraps.push(next);
      from = next;
    }
    return wraps;
  }

  /** True if nothing solid (bricks, walls, moving parts) is in the way between a and b. */
  private clearLine(a: Vec3, b: Vec3) {
    const length = distance(a, b);
    if (length < 0.05) return true;
    const dir = scale(sub(b, a), 1 / length);
    // A little shorter than the full line, so links resting on the same surface can "see" each other.
    return !this.world.castRay(new RAPIER.Ray(a, dir), length - 0.05, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
  }

  /** The last spot each rope link was known to be outside of everything. */
  private ropeSafe = new Map<RopeState, Vec3[]>();
  /** For links touching something: which way is "out" of that surface. */
  private ropeNormals = new Map<RopeState, (Vec3 | null)[]>();

  /**
   * What holds up the player at one end of a rope: the nearest spot (counting from that player)
   * where the rope wraps over something solid — like the edge of a brick — or the friend at the
   * other end if they're standing on something. null = nothing (falling together).
   */
  private ropeSupport(rope: RopeState, end: 'a' | 'b', other: PlayerBody): Vec3 | null {
    const n = rope.points.length - 1;
    if (rope.wraps.length) return rope.points[end === 'a' ? rope.wraps[0] : rope.wraps[rope.wraps.length - 1]];
    if (!other.grounded) return null;
    // Held by a friend standing above: the "ledge" is the floor they stand on (their feet).
    const friend = rope.points[end === 'a' ? n : 0];
    return { x: friend.x, y: friend.y - FEET_TO_CENTER, z: friend.z };
  }

  /**
   * Really dangling in the air — not just hopping up a step: in the air, not still rising from a
   * jump, and no floor right under your feet.
   */
  private dangling(player: PlayerBody) {
    if (player.grounded || player.body.linvel().y > 2) return false;
    const p = player.body.translation();
    const below = this.distanceToFloor(p.x, p.y - FEET_TO_CENTER + 0.05, p.z, 1.6);
    return below === null;
  }

  private markHanging(player: PlayerBody, rope: RopeState, point: Vec3, hung: Set<PlayerBody>) {
    player.hangPoint = { ...point };
    player.hangRope = rope;
    player.hangGrace = PLAYER.hangGrace;
    hung.add(player);
  }

  /**
   * Where a player starts at a checkpoint: one lane per team (side by side), each team standing
   * in a line facing the way the course goes, a bit apart.
   */
  private spawnSpot(team: number, slot: number, checkpoint: number) {
    const cp = this.course.checkpoints[checkpoint];
    const lane = (team - (this.teamCount - 1) / 2) * 2.5;
    // The team's line is centered on the pad, so even a chain of 6 fits.
    const size = [...this.players.values()].filter((p) => p.team === team).length || slot + 1;
    const spacing = Math.min(1.4, (cp.depth + 1) / Math.max(1, size - 1));
    const forward = ((size - 1) / 2 - slot) * spacing;
    return {
      x: cp.x + cp.dirX * forward - cp.dirZ * lane,
      y: cp.y + 0.3 + FEET_TO_CENTER,
      z: cp.z + cp.dirZ * forward + cp.dirX * lane,
    };
  }

  /** Moves a player's feet to a spot (for tests and tools). */
  teleport(id: string, x: number, y: number, z: number) {
    const player = this.players.get(id);
    if (!player) return;
    player.body.setTranslation({ x, y: y + FEET_TO_CENTER, z }, true);
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    // The rope comes along too.
    for (const rope of this.ropes) if (rope.a === id || rope.b === id) this.layRopeStraight(rope);
  }

  /** Lines everyone up again after all players were added (lanes depend on how many teams there are). */
  lineUp() {
    for (const player of this.players.values()) {
      player.body.setTranslation(this.spawnSpot(player.team, player.slot, 0), true);
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      const cp = this.course.checkpoints[0];
      player.facing = Math.atan2(cp.dirX, cp.dirZ);
    }
    for (const rope of this.ropes) this.layRopeStraight(rope);
  }

  /** Checkpoints and the finish line. */
  private updateRace() {
    const { checkpoints, finish } = this.course;
    const inside = (p: Vec3, zone: { x: number; y: number; z: number; width: number; depth: number }) => {
      const feet = p.y - FEET_TO_CENTER;
      return (
        Math.abs(p.x - zone.x) <= zone.width / 2 &&
        Math.abs(p.z - zone.z) <= zone.depth / 2 &&
        feet > zone.y - 0.5 &&
        feet < zone.y + 2.5
      );
    };

    // Touch a checkpoint further along than your team's last one → the team saves there.
    for (const player of this.players.values()) {
      const progress = this.teams.get(player.team)!;
      const p = player.body.translation();
      for (let i = progress.checkpoint + 1; i < checkpoints.length; i++) {
        if (inside(p, checkpoints[i])) {
          progress.checkpoint = i;
          this.events.push({ kind: 'checkpoint', team: player.team, index: i });
        }
      }
    }

    // The whole team standing in the finish zone → finished!
    if (!finish || this.raceTime < 0) return;
    for (const [team, progress] of this.teams) {
      if (progress.finishedAt !== null) continue;
      const members = [...this.players.values()].filter((p) => p.team === team);
      if (members.length > 0 && members.every((m) => inside(m.body.translation(), finish))) {
        progress.finishedAt = this.raceTime;
        this.events.push({ kind: 'finish', team });
      }
    }
  }

  private applyInput(player: PlayerBody, input: PlayerInput) {
    const { body } = player;
    const velocity = body.linvel();

    const wasGrounded = player.grounded;
    player.grounded = velocity.y < 1 && this.touchingFloor(player);

    // Hard landing → lie flat for a moment.
    if (!player.grounded) {
      player.fallSpeed = Math.max(player.fallSpeed, -velocity.y);
    } else {
      if (!wasGrounded && player.fallSpeed > PLAYER.stunSpeed) player.stunned = PLAYER.stunTime;
      player.fallSpeed = 0;
    }
    if (player.stunned > 0) {
      player.stunned -= TICK;
      input = { ...NO_INPUT, limp: true };
    } else if (player.stumble > 0) {
      // Just got punched: stumbling, your feet don't listen for a moment.
      player.stumble -= TICK;
      input = { ...NO_INPUT, limp: true };
    }

    // Dancing stops when you start walking (waving and cheering don't).
    if (player.action?.kind === 'dance' && Math.hypot(input.x, input.z) > 0.3) player.action = null;

    const floor = player.floorVelocity;
    if (input.limp) {
      // A limp player just slides to a stop on the ground (and can be dragged around).
      if (player.grounded) {
        body.setLinvel(
          {
            x: floor.x + (velocity.x - floor.x) * PLAYER.limpSlide,
            y: velocity.y,
            z: floor.z + (velocity.z - floor.z) * PLAYER.limpSlide,
          },
          true,
        );
      }
      player.jumpBuffer = 0;
      return;
    }

    player.coyote = player.grounded ? PLAYER.coyoteTime : player.coyote - TICK;
    player.jumpBuffer = input.jump ? PLAYER.jumpBuffer : player.jumpBuffer - TICK;
    player.climbCooldown -= TICK;
    player.pulling = !!input.pull && player.grounded;

    // Speed up / slow down towards the speed the player wants.
    const inputLength = Math.hypot(input.x, input.z);
    const shrink = inputLength > 1 ? 1 / inputLength : 1;
    // On a moving platform, "standing still" means moving along with it.
    const targetX = input.x * shrink * PLAYER.runSpeed + (player.grounded ? floor.x : 0);
    const targetZ = input.z * shrink * PLAYER.runSpeed + (player.grounded ? floor.z : 0);
    const bracing = player.grounded && inputLength < 0.2;
    // In the air with no input you keep your momentum (no invisible brakes).
    const drifting = !player.grounded && inputLength < 0.05;
    const accel = drifting
      ? 0
      : (bracing ? PLAYER.braceAccel : player.grounded ? PLAYER.groundAccel : PLAYER.airAccel) * TICK;

    let dx = targetX - velocity.x;
    let dz = targetZ - velocity.z;
    const gap = Math.hypot(dx, dz);
    if (gap > accel) {
      dx *= accel / gap;
      dz *= accel / gap;
    }
    let vy = velocity.y;

    if (player.jumpBuffer > 0 && player.coyote > 0) {
      vy = PLAYER.jumpSpeed;
      player.jumpBuffer = 0;
      player.coyote = 0;
      player.grounded = false;
    } else if (player.jumpBuffer > 0 && player.hangRope && player.climbCooldown <= 0) {
      // 🧗 Hanging: each jump tap pulls you hand-over-hand up the rope (the rope gets shorter).
      player.hangRope.current = Math.max(ROPE.minLength, player.hangRope.current - PLAYER.climbReel);
      vy = Math.max(vy, PLAYER.climbHop);
      player.jumpBuffer = 0;
      player.climbCooldown = PLAYER.climbCooldown;
    }

    let vx = velocity.x + dx;
    let vz = velocity.z + dz;
    if (player.hangPoint && drifting) {
      // Dangling: swings slowly calm down (air drag), so you're not a pendulum forever.
      vx *= PLAYER.swingDrag;
      vz *= PLAYER.swingDrag;
    }

    // 🧗 Pulled up to the top of the edge → scramble over it onto the brick (keeps going for a moment).
    const p = body.translation();
    const hang = player.hangPoint;
    if (hang && p.y - FEET_TO_CENTER > hang.y - PLAYER.mantleReach && player.mantle.time <= 0) {
      const toX = hang.x - p.x;
      const toZ = hang.z - p.z;
      const flat = Math.hypot(toX, toZ) || 1;
      player.mantle = { x: toX / flat, z: toZ / flat, time: PLAYER.mantleTime };
    }
    if (player.mantle.time > 0) {
      player.mantle.time -= TICK;
      const overFloor = this.distanceToFloor(p.x, p.y, p.z, FEET_TO_CENTER + 0.8) !== null;
      if (player.grounded || overFloor) {
        // Made it over the edge: stop here and drop onto the brick (don't fly off the other side).
        player.mantle.time = 0;
        player.hangPoint = null;
        player.hangRope = null;
        player.hangGrace = 0;
        vx = 0;
        vz = 0;
      } else {
        vx = player.mantle.x * PLAYER.mantleSpeed;
        vz = player.mantle.z * PLAYER.mantleSpeed;
        vy = Math.max(vy, 2);
      }
    }

    body.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (inputLength > 0.1) player.facing = Math.atan2(input.x, input.z);
  }

  /**
   * Shoots 5 tiny rays down from the feet (middle + 4 sides) to see if we stand on something.
   * Also remembers how fast that floor moves (for spinning discs and sliding blocks).
   */
  private touchingFloor(player: PlayerBody) {
    const { body } = player;
    const p = body.translation();
    player.floorVelocity = { x: 0, z: 0 };
    const reach = FEET_TO_CENTER + 0.08;
    const r = PLAYER.radius * 0.7;
    const offsets = [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ];
    for (const [ox, oz] of offsets) {
      const ray = new RAPIER.Ray({ x: p.x + ox, y: p.y, z: p.z + oz }, { x: 0, y: -1, z: 0 });
      const hit = this.world.castRay(ray, reach, true, undefined, undefined, undefined, body);
      if (hit) {
        const mover = this.moverByCollider.get(hit.collider.handle);
        if (mover) player.floorVelocity = moverVelocityAt(mover, this.time, p.x, p.z);
        return true;
      }
    }
    return false;
  }
}

// Tiny vector helpers.
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The solid shape of a brick: a box, or a round disc. */
function brickCollider(brick: BrickDef) {
  const height = brick.height ?? BRICK_HEIGHT;
  const desc =
    brick.shape === 'disc'
      ? RAPIER.ColliderDesc.cylinder(height / 2, brick.width / 2)
      : RAPIER.ColliderDesc.cuboid(brick.width / 2, height / 2, brick.depth / 2);
  return desc.setFriction(0.8);
}

/** The direction from a to b (length 1), or null if they're at the same spot. */
function direction(a: Vec3, b: Vec3): Vec3 | null {
  const length = distance(a, b);
  return length < 1e-6 ? null : scale(sub(b, a), 1 / length);
}

/** Moves point p towards center so it's at most `max` away from it. */
function within(p: Vec3, center: Vec3, max: number): Vec3 {
  const d = distance(p, center);
  if (d <= max || d < 1e-6) return p;
  const k = max / d;
  return { x: center.x + (p.x - center.x) * k, y: center.y + (p.y - center.y) * k, z: center.z + (p.z - center.z) * k };
}
