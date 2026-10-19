// 🧩 The room box, combos, and how rooms snap together into a course.
// 10f (the world maker) will pick rooms with the dice and a difficulty budget, then call `assembleCourse`.

import { COLORS, type BrickDef, type CheckpointDef, type CourseDef, type MoverDef, type WindDef } from '../course';
import { NEW_ROOMS } from './new-rooms';
import { buildRoom, lerp, roomCost, type BuiltRoom, type Combo, type RoomDef } from './room';
import { makeRng, type Rng } from './rng';
import { SKY_ROOMS } from './sky-rooms';

export { RULES, roomCost, buildRoom, type RoomDef, type Combo } from './room';
export { makeRng } from './rng';

/** Every room the world maker can use. */
export const ROOMS: RoomDef[] = [...SKY_ROOMS, ...NEW_ROOMS];

/** One room in a course: which room, how hard (0..1), and any combos on top. */
export interface RoomChoice {
  room: RoomDef;
  level: number;
  combos?: Combo[];
}

/** The pad between two rooms (a checkpoint stands on it). */
const PAD = 8;
const PAD_COLORS = [COLORS.purple, COLORS.green, COLORS.yellow, COLORS.teal, COLORS.orange, COLORS.pink];

/** Adds extra trouble on top of a built room. */
export function applyCombo(built: BuiltRoom, combo: Combo, level: number, rand: Rng) {
  const plain = [...built.floors].filter((f) => !f.ice && !f.conveyor && !f.bounce);
  if (combo === 'icy') {
    // 🧊 Every plain floor turns to ice.
    for (const floor of plain) {
      floor.ice = true;
      floor.color = COLORS.white;
    }
  } else if (combo === 'belted') {
    // ➡️ Long bridges become treadmills pushing you back.
    for (const floor of plain) {
      if (floor.depth >= 8 && floor.width <= 6 && floor.shape !== 'disc') floor.conveyor = { x: 0, z: lerp(1.5, 3, level) };
    }
  } else if (combo === 'windy') {
    // 💨 A gusty side wind over the whole room.
    const box = roomBox(built);
    built.winds.push({
      x: (box.minX + box.maxX) / 2,
      y: box.minY,
      z: (box.minZ + box.maxZ) / 2,
      width: box.maxX - box.minX + 8,
      depth: box.maxZ - box.minZ,
      height: box.maxY - box.minY + 8,
      push: { x: rand.sign() * lerp(2.5, 3.5, level), z: 0 },
      gust: lerp(5, 4, level),
    });
  }
}

/** The box around everything in a room (between its two doors). */
function roomBox(built: BuiltRoom) {
  const all = [...built.bricks, ...built.movers.map((m) => m.brick)];
  const box = { minX: -2, maxX: 2, minY: 0, maxY: 0, minZ: built.exit.z, maxZ: 0 };
  for (const b of all) {
    box.minX = Math.min(box.minX, b.x - b.width / 2);
    box.maxX = Math.max(box.maxX, b.x + b.width / 2);
    box.minY = Math.min(box.minY, b.y);
    box.maxY = Math.max(box.maxY, b.y);
  }
  box.minY = Math.min(box.minY, built.exit.y);
  box.maxY = Math.max(box.maxY, built.exit.y);
  return box;
}

/** Moves a brick from a room's own little map to the spot where the room is placed. */
const shifted = (b: BrickDef, at: { x: number; y: number; z: number }): BrickDef => ({
  ...b,
  x: b.x + at.x,
  y: b.y + at.y,
  z: b.z + at.z,
});

/**
 * Snaps rooms together into a whole course: a start platform, then room → pad (checkpoint) → room → …,
 * and a finish platform after the last room. The same seed always makes the same course.
 */
export function assembleCourse(name: string, choices: RoomChoice[], seed: number): CourseDef {
  const rand = makeRng(seed);
  const bricks: BrickDef[] = [];
  const movers: MoverDef[] = [];
  const winds: WindDef[] = [];
  const checkpoints: CheckpointDef[] = [];

  // 🏁 Start (the same size as the Sky Course's, so the lobby lineup fits).
  bricks.push({ x: 0, y: 0, z: 0, width: 12, depth: 16, color: COLORS.red });
  checkpoints.push({ x: 0, y: 0, z: -2, width: 10, depth: 10, dirX: 0, dirZ: -1 });
  let at = { x: 0, y: 0, z: -8 };

  choices.forEach((choice, i) => {
    const built = buildRoom(choice.room, choice.level, rand);
    for (const combo of choice.combos ?? []) applyCombo(built, combo, choice.level, rand);
    bricks.push(...built.bricks.map((b) => shifted(b, at)));
    movers.push(...built.movers.map((m) => ({ ...m, brick: shifted(m.brick, at) })));
    winds.push(...built.winds.map((w) => ({ ...w, x: w.x + at.x, y: w.y + at.y, z: w.z + at.z })));
    const exit = { x: built.exit.x + at.x, y: built.exit.y + at.y, z: built.exit.z + at.z };
    const last = i === choices.length - 1;
    if (last) {
      // 🏆 Finish platform.
      bricks.push({ x: exit.x, y: exit.y, z: exit.z - 5, width: 10, depth: 10, color: COLORS.yellow });
    } else {
      bricks.push({ x: exit.x, y: exit.y, z: exit.z - PAD / 2, width: PAD, depth: PAD, color: PAD_COLORS[i % PAD_COLORS.length] });
      checkpoints.push({ x: exit.x, y: exit.y, z: exit.z - PAD / 2, width: 6, depth: 6, dirX: 0, dirZ: -1 });
    }
    at = { x: exit.x, y: exit.y, z: exit.z - PAD };
  });

  const finishZ = at.z + PAD - 5; // the finish platform's middle
  const lowest = Math.min(...bricks.map((b) => b.y), ...movers.map((m) => m.brick.y));
  return {
    name,
    fallLimit: lowest - 35,
    bricks,
    movers,
    checkpoints,
    finish: { x: at.x, y: at.y, z: finishZ, width: 8, depth: 6 },
    winds,
  };
}

/** Total danger of a list of rooms. */
export function totalCost(choices: RoomChoice[]) {
  return choices.reduce((sum, c) => sum + roomCost(c.room, c.level, c.combos), 0);
}

const byId = (id: string) => ROOMS.find((r) => r.id === id)!;

/**
 * 🖼️ The Room Gallery: every room once (middle level), then a few combos. For trying rooms out —
 * `npm start -- --course=gallery`. Not a real race (it's long!).
 */
export const GALLERY_COURSE = assembleCourse(
  'Room Gallery',
  [
    ...ROOMS.map((room) => ({ room, level: 0.5 })),
    { room: byId('hammers'), level: 0.5, combos: ['icy'] },
    { room: byId('stones'), level: 0.5, combos: ['windy'] },
    { room: byId('pushers'), level: 0.5, combos: ['belted'] },
  ],
  1,
);
