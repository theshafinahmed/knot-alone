// The rules of the world 🌍: gravity, floors, running, jumping and ROPES.
// This lives in shared/ on purpose: right now it runs in the browser,
// and in Step 4 the server (the boss) will run this exact same code.

import RAPIER from '@dimforge/rapier3d-compat';
import { BRICK_HEIGHT, type CourseDef } from '../course';

export { RAPIER };

/** Must be called once before making a GameWorld (loads the physics engine). */
export async function initPhysics() {
  await RAPIER.init();
}

/** Physics runs at a steady 60 steps per second, no matter how fast the screen draws. */
export const TICK = 1 / 60;

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
  /** Scrambling over an edge: which way, and for how much longer. */
  mantle: { x: number; z: number; time: number };
}

export class GameWorld {
  readonly world: RAPIER.World;
  readonly course: CourseDef;
  private players = new Map<string, PlayerBody>();
  private ropes: RopeState[] = [];

  constructor(course: CourseDef) {
    this.course = course;
    this.world = new RAPIER.World({ x: 0, y: -25, z: 0 });
    this.world.timestep = TICK;

    for (const brick of course.bricks) {
      const height = brick.height ?? BRICK_HEIGHT;
      const floor = RAPIER.ColliderDesc.cuboid(brick.width / 2, height / 2, brick.depth / 2)
        .setTranslation(brick.x, brick.y - height / 2, brick.z)
        .setFriction(0.8);
      this.world.createCollider(floor);
    }
  }

  /** Frees the physics memory. Call when throwing this world away. */
  dispose() {
    this.world.free();
  }

  get playerIds() {
    return [...this.players.keys()];
  }

  addPlayer(id: string) {
    const spot = this.spawnSpot(this.players.size);
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
      mantle: { x: 0, z: 0, time: 0 },
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
    for (const [id, player] of this.players) {
      this.applyInput(player, inputs.get(id) ?? NO_INPUT);
    }
    this.updateRopes();
    this.world.step();

    // If anyone falls all the way down, the whole team starts again.
    for (const player of this.players.values()) {
      if (player.body.translation().y < this.course.fallLimit) {
        this.respawnAll();
        break;
      }
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
    };
  }

  /** How far below a point the nearest floor is (null = nothing below). Players don't count as floor. */
  distanceToFloor(x: number, y: number, z: number, maxDistance = 50): number | null {
    const ray = new RAPIER.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxDistance, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    return hit ? hit.timeOfImpact : null;
  }

  /** Puts everyone back at the start, standing in a line. */
  respawnAll() {
    let i = 0;
    for (const player of this.players.values()) {
      const spot = this.spawnSpot(i++);
      player.body.setTranslation(spot, true);
      player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      player.stunned = 0;
      player.fallSpeed = 0;
      player.facing = Math.PI;
      player.hangPoint = null;
      player.hangRope = null;
      player.hangGrace = 0;
      player.mantle.time = 0;
    }
    for (const rope of this.ropes) rope.current = rope.length;
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

  /** Spawn spots go in a line backwards from the course spawn, a bit less than a rope apart. */
  private spawnSpot(index: number) {
    const { spawn } = this.course;
    return { x: spawn.x, y: spawn.y + FEET_TO_CENTER, z: spawn.z + index * ROPE.length * 0.6 };
  }

  private applyInput(player: PlayerBody, input: PlayerInput) {
    const { body } = player;
    const velocity = body.linvel();

    const wasGrounded = player.grounded;
    player.grounded = velocity.y < 1 && this.touchingFloor(body);

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
    }

    if (input.limp) {
      // A limp player just slides to a stop on the ground (and can be dragged around).
      if (player.grounded) {
        body.setLinvel(
          { x: velocity.x * PLAYER.limpSlide, y: velocity.y, z: velocity.z * PLAYER.limpSlide },
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
    const targetX = input.x * shrink * PLAYER.runSpeed;
    const targetZ = input.z * shrink * PLAYER.runSpeed;
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

  /** Shoots 5 tiny rays down from the feet (middle + 4 sides) to see if we stand on something. */
  private touchingFloor(body: RAPIER.RigidBody) {
    const p = body.translation();
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
      if (this.world.castRay(ray, reach, true, undefined, undefined, undefined, body)) return true;
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
