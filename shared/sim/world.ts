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
  /** Where the rope bends over an edge (null = straight line between the two players). */
  bend: Vec3 | null;
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
    this.ropes.push({ a, b, length, current: length, bend: null });
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
    for (const team of fallenTeams) this.respawnTeam(team);
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
      target.action = null;
    }
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
      if (members.has(rope.a) || members.has(rope.b)) rope.current = rope.length;
    }
  }

  /**
   * Our own rope rules, on top of the physics engine's simple rope (which is a straight line
   * that goes right through bricks, like a ghost).
   *  - A real rope bends over edges. If a brick is between two tied players, we find the edge
   *    and the rope goes over it (length = player→edge + edge→player).
   *  - Ropes can get shorter: a hanging player climbs (tap jump), a friend on top pulls it in.
   *    When nobody hangs on it any more, it lets back out to full length.
   */
  private updateRopes() {
    const hungThisTick = new Set<PlayerBody>();

    for (const rope of this.ropes) {
      const pa = this.players.get(rope.a)!;
      const pb = this.players.get(rope.b)!;
      const a = pa.body.translation();
      const b = pb.body.translation();
      rope.bend = this.findBend(a, b);
      const aIsUpper = a.y >= b.y;

      // Each player is pulled towards a "corner": the other player (straight rope), or the edge.
      // The lower player aims a little bit OUT past the edge, so they slide out from under the
      // brick and up its side (instead of getting stuck pressed against its bottom).
      let cornerA: Vec3 = b;
      let cornerB: Vec3 = a;
      if (rope.bend) {
        const upper = aIsUpper ? a : b;
        const outX = rope.bend.x - upper.x;
        const outZ = rope.bend.z - upper.z;
        const outLength = Math.hypot(outX, outZ) || 1;
        const pushOut = PLAYER.radius + 0.15;
        const outside = {
          x: rope.bend.x + (outX / outLength) * pushOut,
          y: rope.bend.y,
          z: rope.bend.z + (outZ / outLength) * pushOut,
        };
        // (While scrambling over the edge, aim at the edge itself, not out past it.)
        cornerA = aIsUpper || pa.mantle.time > 0 ? rope.bend : outside;
        cornerB = !aIsUpper && pb.mantle.time <= 0 ? outside : rope.bend;
      }

      const da = distance(a, cornerA);
      const db = distance(b, cornerB);
      const total = rope.bend ? da + db : da;

      // Who is hanging? The lower player, in the air, on a nearly tight rope, below the edge/friend.
      // (Climbing aims at the edge itself, so near the top you climb onto the brick.)
      // You can only hang from an edge, or from a friend who is standing on something
      // (otherwise two falling players would "climb" each other up into the sky 🚀).
      if (total > rope.current * 0.9) {
        const aHasSupport = !!rope.bend || pb.grounded;
        const bHasSupport = !!rope.bend || pa.grounded;
        if (!pa.grounded && aHasSupport && cornerA.y > a.y + 0.3) this.markHanging(pa, rope, rope.bend ?? cornerA, hungThisTick);
        if (!pb.grounded && bHasSupport && cornerB.y > b.y + 0.3) this.markHanging(pb, rope, rope.bend ?? cornerB, hungThisTick);
      }

      // Shorten (friend pulling in a hanging player) or let back out (nobody hanging).
      const someoneHangs = pa.hangRope === rope || pb.hangRope === rope;
      const pulled = (pa.pulling && pb.hangRope === rope) || (pb.pulling && pa.hangRope === rope);
      if (pulled) rope.current = Math.max(ROPE.minLength, rope.current - ROPE.pullSpeed * TICK);
      else if (!someoneHangs) rope.current = Math.min(rope.length, rope.current + ROPE.relaxSpeed * TICK);

      if (total <= rope.current || da < 1e-3 || db < 1e-3) continue;

      // Too long: tug both players towards their corner.
      const ua = scale(sub(cornerA, a), 1 / da);
      const ub = scale(sub(cornerB, b), 1 / db);
      const va = pa.body.linvel();
      const vb = pb.body.linvel();
      // How fast the rope path is getting longer right now...
      const growing = -(dot(va, ua) + dot(vb, ub));
      // ...and we want it to shrink back, firmly but not flinging anyone.
      const wanted = -Math.min((total - rope.current) * 8, ROPE.maxTug);
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

  private markHanging(player: PlayerBody, rope: RopeState, point: Vec3, hung: Set<PlayerBody>) {
    player.hangPoint = { ...point };
    player.hangRope = rope;
    player.hangGrace = PLAYER.hangGrace;
    hung.add(player);
  }

  /** If a brick blocks the straight line between a and b, returns (roughly) the edge the rope bends over. */
  private findBend(a: Vec3, b: Vec3): Vec3 | null {
    const [upper, lower] = a.y >= b.y ? [a, b] : [b, a];
    const gap = distance(upper, lower);
    if (gap < 0.5) return null;
    const down = scale(sub(lower, upper), 1 / gap);
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC;
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(upper, down), gap, true, flags);
    if (!hit) return null;
    const point = add(upper, scale(down, hit.timeOfImpact));

    // Hit a wall (not a floor): bend right there, around the wall.
    if (hit.normal.y < 0.7) return point;

    // Hit the top of a brick: walk along the top towards the lower player until the floor ends.
    // That's the edge the rope goes over (works even if they've swung in underneath the brick).
    const flatX = lower.x - point.x;
    const flatZ = lower.z - point.z;
    const flat = Math.hypot(flatX, flatZ);
    if (flat < 1e-3) return { ...point, y: point.y + 0.05 };
    const stepX = (flatX / flat) * 0.1;
    const stepZ = (flatZ / flat) * 0.1;
    let edge = point;
    for (let i = 1; i <= 40; i++) {
      const probe = { x: point.x + stepX * i, y: point.y + 0.1, z: point.z + stepZ * i };
      const floor = this.world.castRay(new RAPIER.Ray(probe, { x: 0, y: -1, z: 0 }), 0.25, true, flags);
      if (!floor) break;
      edge = probe;
    }
    return { x: edge.x, y: point.y + 0.05, z: edge.z };
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
  }

  /** Lines everyone up again after all players were added (lanes depend on how many teams there are). */
  lineUp() {
    for (const player of this.players.values()) {
      player.body.setTranslation(this.spawnSpot(player.team, player.slot, 0), true);
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      const cp = this.course.checkpoints[0];
      player.facing = Math.atan2(cp.dirX, cp.dirZ);
    }
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
        if (inside(p, checkpoints[i])) progress.checkpoint = i;
      }
    }

    // The whole team standing in the finish zone → finished!
    if (!finish || this.raceTime < 0) return;
    for (const [team, progress] of this.teams) {
      if (progress.finishedAt !== null) continue;
      const members = [...this.players.values()].filter((p) => p.team === team);
      if (members.length > 0 && members.every((m) => inside(m.body.translation(), finish))) {
        progress.finishedAt = this.raceTime;
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
