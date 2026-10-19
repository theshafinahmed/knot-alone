// 🧱☁️ The Sky Course — Knot Alone's first real course (~270 m, about 5 minutes).
//
// The course mostly runs towards −z ("forward"). Every number is a brick's TOP-center.
// Rules of thumb (so everything is possible):
//   - A jump goes ~2 m up and up to ~5.6 m far at full speed → gaps here are 1.5–2.5 m.
//   - Steps go up by one brick (1.2 m) at a time.
//   - Walls in the maze are 2.4 m tall → too tall to jump over (on purpose).
//
// Sections: 🏁 Start → 1 Warm-up → 2 Zig-zag bridges → 3 Spinning discs → 4 Sliding blocks
//           → 5 Brick maze → 6 Tower climb → 🏆 Finish

import { COLORS, type BrickDef, type CheckpointDef, type CourseDef, type MoverDef } from './course';

const b = (x: number, y: number, z: number, width: number, depth: number, color: number, height?: number): BrickDef => ({
  x,
  y,
  z,
  width,
  depth,
  color,
  height,
});
const disc = (x: number, y: number, z: number, diameter: number, color: number): BrickDef => ({
  x,
  y,
  z,
  width: diameter,
  depth: diameter,
  color,
  shape: 'disc',
});
/** A checkpoint pad (6×6 by default) with the course continuing towards (dirX, dirZ). */
const cp = (x: number, y: number, z: number, dirX = 0, dirZ = -1, width = 6, depth = 6): CheckpointDef => ({
  x,
  y,
  z,
  width,
  depth,
  dirX,
  dirZ,
});

const bricks: BrickDef[] = [];
const movers: MoverDef[] = [];
const checkpoints: CheckpointDef[] = [];

// ---------- 🏁 Start (z 8 → −8) ----------
bricks.push(b(0, 0, 0, 12, 16, COLORS.red));
checkpoints.push(cp(0, 0, -2, 0, -1, 10, 10));

// ---------- 1. Warm-up: gaps and steps (z −10 → −36) ----------
bricks.push(
  b(0, 0, -13, 8, 6, COLORS.yellow), // gap 2
  b(0, 1.2, -19, 6, 4, COLORS.green), // gap 1, one step up
  b(0, 2.4, -24, 6, 4, COLORS.blue), // gap 1, another step up
  b(0, 2.4, -32.5, 8, 8, COLORS.purple), // gap 2.5 → checkpoint 1
);
checkpoints.push(cp(0, 2.4, -32.5));

// ---------- 2. Zig-zag bridges (thin, 2 studs wide) ----------
bricks.push(
  b(0, 2.4, -42.25, 2, 11.5, COLORS.orange), // bridge going forward (ends where the corner starts)
  b(0, 2.4, -50, 4, 4, COLORS.yellow), // corner
  b(7, 2.4, -50, 10, 2, COLORS.orange), // bridge going right (+x)
  b(14, 2.4, -50, 4, 4, COLORS.yellow), // corner
  b(14, 2.4, -57, 2, 10, COLORS.orange), // bridge going forward again
  b(14, 2.4, -66, 8, 8, COLORS.teal), // → checkpoint 2
);
checkpoints.push(cp(14, 2.4, -66));

// ---------- 3. Spinning discs + the sweeper ----------
// Disc 1: hop on, it turns you around. Gap 2 from the checkpoint.
movers.push({ brick: disc(14, 2.4, -75.5, 7, COLORS.pink), motion: { kind: 'spin', speed: 0.5 } });
// Sweeper arena: a still round floor with a bar spinning on it. Jump over the bar!
bricks.push(disc(14, 2.4, -86.5, 10, COLORS.white));
movers.push({ brick: b(14, 3.2, -86.5, 9, 0.6, COLORS.red, 0.8), motion: { kind: 'spin', speed: 1.1 } });
// Disc 2: spins the other way.
movers.push({ brick: disc(14, 2.4, -96, 6, COLORS.pink), motion: { kind: 'spin', speed: -0.8 } });
bricks.push(b(14, 2.4, -104, 8, 8, COLORS.green)); // gap 2 → checkpoint 3
checkpoints.push(cp(14, 2.4, -104));

// ---------- 4. Sliding blocks ----------
// Stepping stones sliding left and right over a gap (each 4×4, gaps of 2).
movers.push(
  { brick: b(14, 2.4, -112, 4, 4, COLORS.yellow), motion: { kind: 'slide', axis: 'x', distance: 3, period: 5, phase: 0 } },
  { brick: b(14, 2.4, -118, 4, 4, COLORS.yellow), motion: { kind: 'slide', axis: 'x', distance: 3, period: 5, phase: 2 } },
  { brick: b(14, 2.4, -124, 4, 4, COLORS.yellow), motion: { kind: 'slide', axis: 'x', distance: 3, period: 5, phase: 4 } },
);
// The pusher bridge: blocks slide across it and shove you off.
bricks.push(b(14, 2.4, -136, 4, 16, COLORS.blue)); // z −128 → −144
for (const [z, phase] of [
  [-132, 0],
  [-137, 2.1],
  [-142, 4.2],
] as const) {
  movers.push({
    brick: b(14, 3.6, z, 2, 1.6, COLORS.purple, 1.2),
    motion: { kind: 'slide', axis: 'x', distance: 4.5, period: 5, phase },
  });
}
bricks.push(b(14, 2.4, -149, 10, 8, COLORS.teal)); // → checkpoint 4
checkpoints.push(cp(14, 2.4, -149));

// ---------- 5. Brick maze ----------
// Floor: x 6 → 22, z −155 → −175. Walls are 2 bricks tall with one gap per row (the gap moves around).
bricks.push(b(14, 2.4, -165, 16, 20, COLORS.white));
const WALL_TOP = 2.4 + 2.4;
const wall = (fromX: number, toX: number, z: number) =>
  bricks.push(b((fromX + toX) / 2, WALL_TOP, z, toX - fromX, 1, COLORS.gray, 2.4));
wall(6, 17.5, -159); // gap on the right
wall(20.5, 22, -159);
wall(6, 7, -163); // gap on the left
wall(10, 22, -163);
wall(6, 12.5, -167); // gap in the middle
wall(15.5, 22, -167);
wall(6, 18.5, -171); // gap on the right again
wall(21.5, 22, -171);
bricks.push(b(14, 2.4, -181, 8, 8, COLORS.green)); // gap 2 → checkpoint 5
checkpoints.push(cp(14, 2.4, -181));

// ---------- 6. Tower climb (zig-zag stairs into the sky) ----------
bricks.push(
  b(14, 3.6, -188, 4, 4, COLORS.yellow), // gap 1 from the checkpoint
  b(17, 4.8, -192, 4, 4, COLORS.orange),
  b(14, 6.0, -196, 4, 4, COLORS.red),
  b(11, 7.2, -200, 4, 4, COLORS.purple),
  b(14, 8.4, -204, 4, 4, COLORS.blue),
);

// ---------- 🏆 Finish ----------
bricks.push(b(14, 9.6, -211, 10, 10, COLORS.yellow));

export const SKY_COURSE: CourseDef = {
  name: 'Sky Course',
  fallLimit: -40,
  bricks,
  movers,
  checkpoints,
  finish: { x: 14, y: 9.6, z: -212, width: 8, depth: 6 },
};
