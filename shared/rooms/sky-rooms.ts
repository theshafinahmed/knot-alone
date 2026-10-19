// 🧱☁️ Rooms cut from the Sky Course: the same ideas, but with a "how hard" dial and a bit of dice.
// Remember: door in at (0, 0, 0), the room goes towards −z, `room.exit(...)` = back edge of the next pad.

import { COLORS } from '../course';
import { lerp, type RoomDef } from './room';

/** Warm-up: a few gaps and steps going up. */
export const STEPS: RoomDef = {
  id: 'steps',
  name: 'Steps up',
  cost: [1, 2],
  combos: ['icy', 'windy'],
  build(room, level, rand) {
    const width = room.width(level, 6, 4);
    const count = level < 0.5 ? 2 : 3;
    const colors = [COLORS.yellow, COLORS.green, COLORS.blue];
    let z = 0;
    let y = 0;
    for (let i = 0; i < count; i++) {
      z -= room.gap(level, 1, 2);
      if (i > 0) y += room.step();
      const depth = rand.pick([4, 5]);
      room.floor(0, y, z - depth / 2, width, depth, colors[i % colors.length]);
      z -= depth;
    }
    room.exit(0, y, z - room.gap(level, 1.5, 2.5));
  },
};

/** Thin bridges with two corners (a zig-zag to the left or right). */
export const ZIGZAG: RoomDef = {
  id: 'zigzag',
  name: 'Zig-zag bridges',
  cost: [2, 3],
  combos: ['icy', 'windy', 'belted'],
  build(room, level, rand) {
    const side = rand.sign();
    const width = room.width(level, 3, 2);
    const first = Math.round(lerp(8, 11, level));
    const across = Math.round(lerp(6, 10, level));
    const second = Math.round(lerp(6, 9, level));
    room.floor(0, 0, -first / 2, width, first, COLORS.orange);
    room.floor(0, 0, -first - 2, 4, 4, COLORS.yellow); // corner
    room.floor(side * (2 + across / 2), 0, -first - 2, across, width, COLORS.orange);
    const cornerX = side * (across + 4);
    room.floor(cornerX, 0, -first - 2, 4, 4, COLORS.yellow); // corner
    room.floor(cornerX, 0, -first - 4 - second / 2, width, second, COLORS.orange);
    room.exit(cornerX, 0, -first - 4 - second);
  },
};

/** Two spinning discs that turn you around. */
export const DISCS: RoomDef = {
  id: 'discs',
  name: 'Spinning discs',
  cost: [2, 4],
  combos: ['windy'],
  build(room, level, rand) {
    const turn = rand.sign();
    let z = -room.gap(level, 1.5, 2);
    for (const [i, diameter] of [lerp(7, 6, level), lerp(6.5, 5, level)].entries()) {
      const d = Math.round(diameter * 2) / 2;
      room.mover(
        { x: 0, y: 0, z: z - d / 2, width: d, depth: d, color: COLORS.pink, shape: 'disc' },
        { kind: 'spin', speed: turn * (i % 2 ? -1 : 1) * lerp(0.4, 0.85, level) },
      );
      z -= d + room.gap(level, 1.5, 2);
    }
    room.exit(0, 0, z);
  },
};

/** A round floor with a bar spinning on it. Jump over the bar! */
export const SWEEPER: RoomDef = {
  id: 'sweeper',
  name: 'Sweeper',
  cost: [3, 5],
  combos: ['icy', 'windy'],
  build(room, level, rand) {
    const g = room.gap(level, 1.5, 2);
    room.floor(0, 0, -g - 5, 10, 10, COLORS.white, { shape: 'disc' });
    room.mover(
      { x: 0, y: 0.8, z: -g - 5, width: 9, depth: 0.6, height: 0.8, color: COLORS.red },
      { kind: 'spin', speed: rand.sign() * lerp(0.8, 1.4, level) },
    );
    room.exit(0, 0, -g - 10 - room.gap(level, 1.5, 2));
  },
};

/** Stepping stones sliding left and right over a gap. */
export const STONES: RoomDef = {
  id: 'stones',
  name: 'Sliding stones',
  cost: [3, 5],
  combos: ['windy'],
  build(room, level, rand) {
    const count = level < 0.5 ? 2 : 3;
    const size = level < 0.7 ? 4 : 3.5;
    const period = lerp(6, 4.5, level);
    const start = rand.range(0, Math.PI * 2);
    let z = 0;
    for (let i = 0; i < count; i++) {
      z -= room.gap(level, 1.5, 2);
      room.mover(
        { x: 0, y: 0, z: z - size / 2, width: size, depth: size, color: COLORS.yellow },
        { kind: 'slide', axis: 'x', distance: lerp(2, 3.5, level), period, phase: start + i * 2 },
      );
      z -= size;
    }
    room.exit(0, 0, z - room.gap(level, 1.5, 2));
  },
};

/** A bridge with blocks sliding across it that shove you off. */
export const PUSHERS: RoomDef = {
  id: 'pushers',
  name: 'Pusher bridge',
  cost: [3, 5],
  combos: ['icy', 'windy', 'belted'],
  build(room, level, rand) {
    const width = room.width(level, 5, 4);
    const length = 16;
    room.floor(0, 0, -length / 2, width, length, COLORS.blue);
    const count = Math.round(lerp(2, 4, level));
    const period = lerp(6, 4.2, level);
    const start = rand.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const z = -length * ((i + 1) / (count + 1));
      room.mover(
        // 0.8 m tall: a tight rope at waist height slides over the top, a loose rope lying low gets dragged.
        { x: 0, y: 0.8, z, width: 2, depth: 1.6, height: 0.8, color: COLORS.purple },
        { kind: 'slide', axis: 'x', distance: width / 2 + 2, period, phase: start + (i * Math.PI * 2) / count },
      );
    }
    room.exit(0, 0, -length);
  },
};

/** A brick maze: rows of tall walls, each with one way through (the dice picks where). */
export const MAZE: RoomDef = {
  id: 'maze',
  name: 'Brick maze',
  cost: [2, 3],
  combos: ['icy', 'windy'],
  build(room, level, rand) {
    const g = room.gap(level, 1, 2);
    const rows = level < 0.5 ? 4 : 5;
    const spacing = 4;
    const depth = rows * spacing + 4;
    const half = 8; // the floor is 16 wide
    room.floor(0, 0, -g - depth / 2, half * 2, depth, COLORS.white);
    const hole = lerp(3, 2.5, level);
    let last = 0;
    for (let row = 0; row < rows; row++) {
      const z = -g - spacing * (row + 1);
      // Each row's way through is somewhere else than the last one (so you have to zig-zag).
      let center = 0;
      for (let tries = 0; tries < 10; tries++) {
        center = rand.range(-half + 1 + hole / 2, half - 1 - hole / 2);
        if (Math.abs(center - last) > 4) break;
      }
      last = center;
      const left = center - hole / 2;
      const right = center + hole / 2;
      if (left > -half) room.wall((-half + left) / 2, 2.4, z, left + half, 1, COLORS.gray, 2.4);
      if (right < half) room.wall((right + half) / 2, 2.4, z, half - right, 1, COLORS.gray, 2.4);
    }
    room.exit(0, 0, -g - depth - room.gap(level, 1.5, 2));
  },
};

/** Zig-zag stairs into the sky. */
export const TOWER: RoomDef = {
  id: 'tower',
  name: 'Tower stairs',
  cost: [2, 3],
  combos: ['windy', 'icy'],
  build(room, level, rand) {
    const count = level < 0.5 ? 4 : 5;
    const size = level < 0.6 ? 4 : 3.5;
    const colors = [COLORS.yellow, COLORS.orange, COLORS.red, COLORS.purple, COLORS.blue];
    const side = rand.sign();
    let z = -room.gap(level, 1, 1.5);
    let y = 0;
    for (let i = 0; i < count; i++) {
      y += room.step();
      const x = i % 2 === 0 ? 0 : side * 3;
      room.floor(x, y, z - size / 2, size, size, colors[i % colors.length]);
      z -= size;
    }
    room.exit(0, y + room.step(), z - room.gap(level, 1, 1.5));
  },
};

export const SKY_ROOMS = [STEPS, ZIGZAG, DISCS, SWEEPER, STONES, PUSHERS, MAZE, TOWER];
