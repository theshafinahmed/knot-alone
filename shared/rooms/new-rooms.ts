// 🧪 Rooms for the new obstacles (the same ones as in the Obstacle Lab, with a "how hard" dial).
// Remember: door in at (0, 0, 0), the room goes towards −z, `room.exit(...)` = back edge of the next pad.

import { COLORS } from '../course';
import { lerp, type RoomDef } from './room';

/** ➡️ A treadmill pushing you back towards where you came from. */
export const TREADMILL: RoomDef = {
  id: 'treadmill',
  name: 'Treadmill',
  cost: [1, 2],
  combos: ['windy'],
  build(room, level) {
    const width = room.width(level, 5, 3.5);
    const length = Math.round(lerp(10, 14, level));
    room.floor(0, 0, -length / 2, width, length, COLORS.gray, { conveyor: { x: 0, z: lerp(2, 4, level) } });
    room.exit(0, 0, -length);
  },
};

/** ➡️ A wide belt pushing you sideways towards the edge. */
export const SIDE_BELT: RoomDef = {
  id: 'side-belt',
  name: 'Sideways belt',
  cost: [2, 4],
  combos: ['windy'],
  build(room, level, rand) {
    const depth = Math.round(lerp(8, 11, level));
    const width = room.width(level, 8, 6);
    room.floor(0, 0, -depth / 2, width, depth, COLORS.gray, { conveyor: { x: rand.sign() * lerp(2, 3.5, level), z: 0 } });
    room.exit(0, 0, -depth);
  },
};

/** ⬆️ An elevator up to a higher pad. */
export const ELEVATOR: RoomDef = {
  id: 'elevator',
  name: 'Elevator',
  cost: [2, 3],
  combos: ['windy'],
  build(room, level, rand) {
    const size = room.width(level, 5, 4);
    const height = 1.2 * Math.round(lerp(4, 6, level)); // 4.8 m … 7.2 m up
    const before = 0.5;
    room.mover(
      { x: 0, y: height / 2, z: -before - size / 2, width: size, depth: size, color: COLORS.teal },
      { kind: 'slide', axis: 'y', distance: height / 2, period: lerp(8, 5.5, level), phase: rand.range(0, Math.PI * 2) },
    );
    room.exit(0, height, -before - size - room.gap(level, 1, 1.5));
  },
};

/** 🧊 A slippery bridge, then an ice square where you have to turn and jump off to the side. */
export const ICE: RoomDef = {
  id: 'ice',
  name: 'Ice bridge',
  cost: [2, 4],
  combos: ['windy'],
  build(room, level, rand) {
    const width = room.width(level, 4, 2.5);
    const length = Math.round(lerp(8, 12, level));
    room.floor(0, 0, -length / 2, width, length, COLORS.white, { ice: true });
    room.floor(0, 0, -length - 4, 8, 8, COLORS.white, { ice: true });
    // The next pad is beside the ice square (so you must turn on the ice), the gap to it is a jump.
    const side = rand.sign();
    const g = room.gap(level, 1.5, 2);
    room.exit(side * (4 + g + 4), 0, -length);
  },
};

/** 🔨 A bridge with hammers swinging across it. */
export const HAMMERS: RoomDef = {
  id: 'hammers',
  name: 'Hammer bridge',
  cost: [3, 5],
  combos: ['icy', 'windy', 'belted'],
  build(room, level, rand) {
    const width = room.width(level, 3.5, 3);
    const count = 1 + Math.round(level * 2);
    const spacing = 7;
    const length = count * spacing + 4;
    room.floor(0, 0, -length / 2, width, length, COLORS.blue);
    const start = rand.range(0, Math.PI * 2);
    const period = lerp(3.8, 2.8, level);
    for (let i = 0; i < count; i++) {
      room.mover(
        { x: 0, y: 6.5, z: -2 - spacing * (i + 0.5), width: 1.6, depth: 2.2, height: 1.6, color: COLORS.red },
        { kind: 'swing', axis: 'x', length: 5.5, amplitude: 1.0, period, phase: start + i * Math.PI },
      );
    }
    room.exit(0, 0, -length);
  },
};

/** 💨 A long bridge in gusty side wind. */
export const WIND: RoomDef = {
  id: 'wind',
  name: 'Windy bridge',
  cost: [3, 5],
  combos: ['icy', 'belted'],
  build(room, level, rand) {
    const width = room.width(level, 5, 3.5);
    const length = Math.round(lerp(14, 20, level));
    room.floor(0, 0, -length / 2, width, length, COLORS.teal);
    room.wind({
      x: 0,
      y: 0,
      z: -length / 2,
      width: 14,
      depth: length,
      height: 8,
      push: { x: rand.sign() * lerp(3, 4.5, level), z: 0 },
      gust: lerp(5, 3.5, level),
    });
    room.exit(0, 0, -length);
  },
};

// (No trampoline room: with a team on a rope, everyone can't bounce at once — Shafin found it too hard.
// Trampolines still work in the Obstacle Lab.)
export const NEW_ROOMS = [TREADMILL, SIDE_BELT, ELEVATOR, ICE, HAMMERS, WIND];
