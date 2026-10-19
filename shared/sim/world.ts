// The rules of the world 🌍: gravity, floors, running and jumping.
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
  airAccel: 25,
  jumpSpeed: 10,
  coyoteTime: 0.1, // you can still jump a moment after running off an edge
  jumpBuffer: 0.12, // pressing jump a moment before landing still counts
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
  /** Which way the player faces (radians around the up axis). */
  facing: number;
}

interface PlayerBody {
  body: RAPIER.RigidBody;
  coyote: number;
  jumpBuffer: number;
  grounded: boolean;
  facing: number;
}

export class GameWorld {
  readonly world: RAPIER.World;
  readonly course: CourseDef;
  private players = new Map<string, PlayerBody>();

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

  addPlayer(id: string) {
    const { spawn } = this.course;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y + FEET_TO_CENTER, spawn.z)
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
    this.players.set(id, { body, coyote: 0, jumpBuffer: 0, grounded: false, facing: Math.PI });
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;
    this.world.removeRigidBody(player.body);
    this.players.delete(id);
  }

  /** Moves the world forward by one tick. */
  step(inputs: Map<string, PlayerInput>) {
    for (const [id, player] of this.players) {
      this.applyInput(player, inputs.get(id) ?? NO_INPUT);
    }
    this.world.step();

    for (const player of this.players.values()) {
      if (player.body.translation().y < this.course.fallLimit) this.respawn(player);
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
      facing: player.facing,
    };
  }

  /** How far below a point the nearest floor is (for drawing shadows). */
  distanceToFloor(x: number, y: number, z: number, maxDistance = 50): number | null {
    const ray = new RAPIER.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxDistance, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    return hit ? hit.timeOfImpact : null;
  }

  private applyInput(player: PlayerBody, input: PlayerInput) {
    const { body } = player;
    const velocity = body.linvel();

    player.grounded = velocity.y < 1 && this.touchingFloor(body);
    player.coyote = player.grounded ? PLAYER.coyoteTime : player.coyote - TICK;
    player.jumpBuffer = input.jump ? PLAYER.jumpBuffer : player.jumpBuffer - TICK;

    // Speed up / slow down towards the speed the player wants.
    let inputLength = Math.hypot(input.x, input.z);
    const scale = inputLength > 1 ? 1 / inputLength : 1;
    inputLength = Math.min(inputLength, 1);
    const targetX = input.x * scale * PLAYER.runSpeed;
    const targetZ = input.z * scale * PLAYER.runSpeed;
    const accel = (player.grounded ? PLAYER.groundAccel : PLAYER.airAccel) * TICK;

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
    }

    body.setLinvel({ x: velocity.x + dx, y: vy, z: velocity.z + dz }, true);

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

  private respawn(player: PlayerBody) {
    const { spawn } = this.course;
    player.body.setTranslation({ x: spawn.x, y: spawn.y + FEET_TO_CENTER, z: spawn.z }, true);
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
}
