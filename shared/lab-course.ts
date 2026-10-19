// 🧪 The Obstacle Lab — a small test room for new obstacles (Step 10a). Not a real race course.
// Start it with `npm start -- --course=lab`.
//
// Runs towards −z like the Sky Course. Every number is a brick's TOP-center.
// 🏁 Start → ➡️ treadmill + sideways belt → ⬆️ elevator up → 🧊 ice bridge → 🦘 trampoline up
//    → 🔨 hammer bridge → 💨 windy bridge → 🏆 Finish

import { COLORS, type BrickDef, type CheckpointDef, type CourseDef, type MoverDef, type WindDef } from './course';

const b = (x: number, y: number, z: number, width: number, depth: number, color: number, extra: Partial<BrickDef> = {}): BrickDef => ({
  x,
  y,
  z,
  width,
  depth,
  color,
  ...extra,
});
const cp = (x: number, y: number, z: number, width = 6, depth = 6): CheckpointDef => ({ x, y, z, width, depth, dirX: 0, dirZ: -1 });

const bricks: BrickDef[] = [];
const movers: MoverDef[] = [];
const checkpoints: CheckpointDef[] = [];
const winds: WindDef[] = [];

// ---------- 🏁 Start (z 8 → −8) ----------
bricks.push(b(0, 0, 0, 12, 16, COLORS.red));
checkpoints.push(cp(0, 0, -2, 10, 10));

// ---------- ➡️ Conveyor belts ----------
bricks.push(
  // A treadmill pushing you back towards the start (run 7 m/s against 3 m/s → you move at 4).
  b(0, 0, -14, 4, 12, COLORS.gray, { conveyor: { x: 0, z: 3 } }),
  // A wide belt pushing you sideways towards the edge.
  b(0, 0, -24, 8, 8, COLORS.gray, { conveyor: { x: 3, z: 0 } }),
  // Checkpoint 1 (gap 1.5).
  b(0, 0, -33.5, 8, 8, COLORS.yellow),
);
checkpoints.push(cp(0, 0, -33.5));

// ---------- ⬆️ Elevator ----------
// Goes between y 0 and y 6, one full trip every 7 s. Ride it up and jump onto the high platform.
movers.push({
  brick: b(0, 3, -40, 4, 4, COLORS.teal),
  motion: { kind: 'slide', axis: 'y', distance: 3, period: 7, phase: -Math.PI / 2 },
});
// High platform = checkpoint 2 (gap 1.5 from the elevator's edge).
bricks.push(b(0, 6, -47.5, 8, 8, COLORS.purple));
checkpoints.push(cp(0, 6, -47.5));

// ---------- 🧊 Ice ----------
bricks.push(
  // A slippery 3-wide bridge, then an ice square with a turn.
  b(0, 6, -57.5, 3, 12, COLORS.white, { ice: true }),
  b(0, 6, -67.5, 8, 8, COLORS.white, { ice: true }),
  // Off the ice to the left (gap 2) = checkpoint 3.
  b(-10, 6, -67.5, 8, 8, COLORS.green),
);
checkpoints.push(cp(-10, 6, -67.5));

// ---------- 🦘 Trampoline ----------
// The next platform is 4 bricks (4.8 m) up: too high to jump, so bounce! (gap 1.5 before, 2.5 after)
bricks.push(
  b(-10, 6, -75, 4, 4, COLORS.blue, { bounce: 18 }),
  b(-10, 10.8, -83.5, 8, 8, COLORS.orange), // checkpoint 4
);
checkpoints.push(cp(-10, 10.8, -83.5));

// ---------- 🔨 Hammer bridge ----------
// A 3-wide bridge with two hammers swinging across it (opposite timing). Wait, then run.
bricks.push(b(-10, 10.8, -95.5, 3, 16, COLORS.blue));
for (const [z, phase] of [[-91.5, 0], [-99.5, Math.PI]] as const) {
  movers.push({
    brick: b(-10, 17.3, z, 1.6, 2.2, COLORS.red, { height: 1.6 }),
    motion: { kind: 'swing', axis: 'x', length: 5.5, amplitude: 1.0, period: 3.2, phase },
  });
}
bricks.push(b(-10, 10.8, -107.5, 8, 8, COLORS.yellow)); // checkpoint 5
checkpoints.push(cp(-10, 10.8, -107.5));

// ---------- 💨 Windy bridge ----------
// Gusts blow you towards +x. Walk in the calm, plant your feet (stand still) in a gust.
bricks.push(b(-10, 10.8, -120.5, 4, 18, COLORS.teal));
winds.push({ x: -10, y: 10.8, z: -120.5, width: 14, depth: 18, height: 8, push: { x: 4, z: 0 }, gust: 4 });

// ---------- 🏆 Finish ----------
bricks.push(b(-10, 10.8, -134, 10, 9, COLORS.green));

export const LAB_COURSE: CourseDef = {
  name: 'Obstacle Lab',
  fallLimit: -30,
  bricks,
  movers,
  checkpoints,
  finish: { x: -10, y: 10.8, z: -134.5, width: 6, depth: 6 },
  winds,
};
