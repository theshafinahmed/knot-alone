// The course recipe 🗺️. The physics (solid floors) and the drawing (bricks) are both built
// from these lists, so they always match. Moving parts follow a clock, so the server and every
// phone can work out where they are at any moment without sending extra messages.

export const COLORS = {
  red: 0xe63946,
  yellow: 0xffc300,
  blue: 0x2a9df4,
  green: 0x52b788,
  orange: 0xf77f00,
  purple: 0x9d4edd,
  white: 0xf1f1f1,
  pink: 0xff6fb5,
  teal: 0x2ec4b6,
  gray: 0x9aa5b1,
};

export interface BrickDef {
  /** Center of the brick's TOP surface (where you stand). */
  x: number;
  y: number;
  z: number;
  /** Size in studs (1 stud = 1 meter). For a disc, `width` is the diameter. */
  width: number;
  depth: number;
  /** Thickness in meters. */
  height?: number;
  color: number;
  /** Square brick (default) or round disc. */
  shape?: 'box' | 'disc';
}

/** How a moving part moves. */
export type Motion =
  /** Turns around its own middle (radians per second, + = counter-clockwise seen from above). */
  | { kind: 'spin'; speed: number }
  /** Slides back and forth along x or z, `distance` meters each way, one full trip every `period` seconds. */
  | { kind: 'slide'; axis: 'x' | 'z'; distance: number; period: number; phase?: number };

export interface MoverDef {
  brick: BrickDef;
  motion: Motion;
}

/** A glowing pad. Touch it and your team starts from here after a fall. */
export interface CheckpointDef {
  /** Center of the pad, on top of the floor. */
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  /** Which way the course goes from here (teams line up facing this way). */
  dirX: number;
  dirZ: number;
}

export interface ZoneDef {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
}

export interface CourseDef {
  name: string;
  /** Fall below this height and your team goes back to its last checkpoint. */
  fallLimit: number;
  bricks: BrickDef[];
  movers: MoverDef[];
  /** checkpoints[0] is the start line. */
  checkpoints: CheckpointDef[];
  /** The whole team must stand in here to finish. null = no finish (test courses). */
  finish: ZoneDef | null;
}

export const BRICK_HEIGHT = 1.2;

/** Where a moving part is at `time` seconds: position of its top-center, and how far it has turned. */
export function moverPose(mover: MoverDef, time: number) {
  const { brick, motion } = mover;
  if (motion.kind === 'spin') return { x: brick.x, y: brick.y, z: brick.z, angle: motion.speed * time };
  const offset = motion.distance * Math.sin(((Math.PI * 2) / motion.period) * time + (motion.phase ?? 0));
  return {
    x: brick.x + (motion.axis === 'x' ? offset : 0),
    y: brick.y,
    z: brick.z + (motion.axis === 'z' ? offset : 0),
    angle: 0,
  };
}

/** How fast the surface of a moving part is moving at point (x, z), so it can carry you along. */
export function moverVelocityAt(mover: MoverDef, time: number, x: number, z: number) {
  const { motion } = mover;
  if (motion.kind === 'spin') {
    const pose = moverPose(mover, time);
    // Turning around the up axis: the further from the middle, the faster you're carried.
    return { x: motion.speed * (z - pose.z), z: -motion.speed * (x - pose.x) };
  }
  const w = (Math.PI * 2) / motion.period;
  const speed = motion.distance * w * Math.cos(w * time + (motion.phase ?? 0));
  return { x: motion.axis === 'x' ? speed : 0, z: motion.axis === 'z' ? speed : 0 };
}

/** A small test playground: walk, jump gaps, climb steps. Used by quick tests. */
export const TEST_COURSE: CourseDef = {
  name: 'Test playground',
  fallLimit: -40,
  bricks: [
    // Starting area
    { x: 0, y: 0, z: 0, width: 10, depth: 16, color: COLORS.red },
    { x: -3, y: 1.2, z: -4, width: 2, depth: 4, color: COLORS.yellow },
    { x: 3, y: 1.2, z: 5, width: 2, depth: 2, color: COLORS.yellow },

    // Thin bridge
    { x: 0, y: 0, z: -14, width: 2, depth: 12, color: COLORS.blue },

    // Small gap jump
    { x: 0, y: 0, z: -25, width: 6, depth: 6, color: COLORS.green },

    // Steps going up
    { x: 0, y: 1.2, z: -31, width: 4, depth: 4, color: COLORS.yellow },
    { x: 0, y: 2.4, z: -37, width: 4, depth: 4, color: COLORS.orange },

    // Top platform
    { x: 0, y: 2.4, z: -46, width: 8, depth: 8, color: COLORS.purple },
  ],
  movers: [],
  checkpoints: [{ x: 0, y: 0, z: -2, width: 6, depth: 8, dirX: 0, dirZ: -1 }],
  finish: null,
};
