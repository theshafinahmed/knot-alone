// 🧩 Rooms: small course pieces that snap together, like LEGO sets (Step 10e).
//
// Every room is built in its OWN little map:
//   - The door in is at (0, 0, 0): the front edge of the pad you're standing on, at its top.
//   - The room goes towards −z (forward), like the Sky Course.
//   - The room says where its door out is. The world maker puts the next pad there.
// So any room fits after any other room.
//
// Each room has a "how hard" dial (`level`, 0 = gentlest … 1 = hardest) and a danger cost,
// so the world maker can spend a difficulty budget. Gaps and steps go through `gap()` / `step()`,
// which never break the jump rules — that's how a room can't become impossible.

import type { BrickDef, Motion, MoverDef, WindDef } from '../course';
import type { Rng } from './rng';

/** The jump rules every room must follow (a real jump goes ~2 m up and ~5.6 m far). */
export const RULES = {
  /** Biggest gap to jump over (meters). Far below the 5.6 m max, so it's safe for everyone. */
  maxGap: 2.5,
  /** Biggest step up without help (one brick). */
  maxStep: 1.2,
  /** Thinnest path to walk on. */
  minWidth: 2,
};

/** Extra trouble that can be added on top of a room. */
export type Combo = 'icy' | 'windy' | 'belted';

export interface RoomDef {
  id: string;
  /** A short name for people (shown in tests and the gallery). */
  name: string;
  /** Danger cost at level 0 and at level 1 (1 = easy … 6 = scary). */
  cost: [number, number];
  /** Which combos make sense on this room. */
  combos: Combo[];
  build(room: RoomBuilder, level: number, rand: Rng): void;
}

/** What a built room adds to the course (in its own little map), and where its door out is. */
export interface BuiltRoom {
  bricks: BrickDef[];
  movers: MoverDef[];
  winds: WindDef[];
  /** Bricks you walk on (not walls, not pads) — combos like "icy" change these. */
  floors: Set<BrickDef>;
  exit: { x: number; y: number; z: number };
  /** Every gap and step the room used, so tests can check the rules. */
  gaps: number[];
  steps: number[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Collects one room's pieces. Rooms call these instead of pushing bricks themselves. */
export class RoomBuilder {
  readonly built: BuiltRoom = {
    bricks: [],
    movers: [],
    winds: [],
    floors: new Set(),
    exit: { x: 0, y: 0, z: -4 },
    gaps: [],
    steps: [],
  };

  /** A brick you walk on. (x, y, z) = center of its top. */
  floor(x: number, y: number, z: number, width: number, depth: number, color: number, extra: Partial<BrickDef> = {}) {
    const brick: BrickDef = { x, y, z, width, depth, color, ...extra };
    this.built.bricks.push(brick);
    this.built.floors.add(brick);
    return brick;
  }

  /** A brick that's in the way (a wall) — combos never change it. */
  wall(x: number, y: number, z: number, width: number, depth: number, color: number, height: number) {
    const brick: BrickDef = { x, y, z, width, depth, color, height };
    this.built.bricks.push(brick);
    return brick;
  }

  mover(brick: BrickDef, motion: Motion) {
    this.built.movers.push({ brick, motion });
  }

  wind(wind: WindDef) {
    this.built.winds.push(wind);
  }

  /** Where the next pad goes: the middle of its back edge, at its top. */
  exit(x: number, y: number, z: number) {
    this.built.exit = { x, y, z };
  }

  /** A gap between `easy` and `hard` meters for this level, never bigger than the rules allow. */
  gap(level: number, easy: number, hard: number) {
    const size = Math.min(RULES.maxGap, lerp(easy, hard, level));
    this.built.gaps.push(size);
    return size;
  }

  /** A step up (meters, a multiple of one brick), never higher than the rules allow. */
  step(bricks = 1) {
    const size = Math.min(RULES.maxStep, bricks * 1.2);
    this.built.steps.push(size);
    return size;
  }

  /** A path width between `easy` and `hard` for this level, never thinner than the rules allow. */
  width(level: number, easy: number, hard: number) {
    return Math.max(RULES.minWidth, Math.round(lerp(easy, hard, level) * 2) / 2);
  }
}

/** Builds one room on its own (in its own little map). */
export function buildRoom(def: RoomDef, level: number, rand: Rng) {
  const builder = new RoomBuilder();
  def.build(builder, Math.max(0, Math.min(1, level)), rand);
  return builder.built;
}

/** A room's danger cost at a level (combos add more on top). */
export function roomCost(def: RoomDef, level: number, combos: Combo[] = []) {
  return lerp(def.cost[0], def.cost[1], level) + combos.length * COMBO_COST;
}

/** Each combo on a room adds this much danger. */
export const COMBO_COST = 2;

export { lerp };
