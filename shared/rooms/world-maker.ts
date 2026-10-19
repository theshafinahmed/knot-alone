// 🎲 The world maker (Step 10f): a seed + difficulty + length → a whole new course.
//
// How it stays fair:
//   1. It only uses rooms from the room box, and rooms can't break the jump rules (see room.ts).
//   2. A difficulty BUDGET: every room has a danger cost. Easy worlds get a small budget per room,
//      hard worlds a big one. The maker picks rooms (and how hard each one is) to spend about the
//      budget — so an easy world can't sneak in lots of scary rooms, and a hard world isn't a walk.
//   3. Variety rules: the first room is a gentle warm-up, no room twice in a row, no room more than twice.
// The same seed always makes the same world, so the server only has to send that one number.

import type { CourseDef } from '../course';
import { assembleCourse, buildRoom, ROOMS, totalCost, type RoomChoice } from './index';
import { roomCost, type Combo, type RoomDef } from './room';
import { makeRng } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type WorldLength = 'short' | 'normal' | 'long';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
export const LENGTHS: WorldLength[] = ['short', 'normal', 'long'];

export interface WorldSettings {
  seed: number;
  difficulty: Difficulty;
  length: WorldLength;
}

/** How many rooms (~2, ~4, ~6 minutes). */
const ROOM_COUNT: Record<WorldLength, number> = { short: 4, normal: 8, long: 12 };

const DIFFICULTY_RULES: Record<
  Difficulty,
  { levels: [number, number]; costPerRoom: number; maxRoomCost: number; comboChance: number }
> = {
  easy: { levels: [0, 0.35], costPerRoom: 2.3, maxRoomCost: 4, comboChance: 0.12 },
  medium: { levels: [0.3, 0.7], costPerRoom: 3.4, maxRoomCost: 5.5, comboChance: 0.25 },
  hard: { levels: [0.6, 1], costPerRoom: 4.6, maxRoomCost: 7.5, comboChance: 0.45 },
};

/** Rooms that make a good first room (gentle, teach you to move as a team). */
const WARM_UP = ['steps', 'zigzag', 'treadmill'];

/** Too many pieces makes slow phones stutter. */
export const PIECE_LIMIT = 220;

/** Picks the rooms for a world (without building it), plus the budget it aimed for. */
export function planWorld(settings: WorldSettings) {
  const rand = makeRng(settings.seed);
  const rules = DIFFICULTY_RULES[settings.difficulty];
  const count = ROOM_COUNT[settings.length];
  const budget = count * rules.costPerRoom;
  const choices: RoomChoice[] = [];
  const used = new Map<string, number>();
  let spent = 0;
  let pieces = 0;

  for (let i = 0; i < count; i++) {
    const target = (budget - spent) / (count - i); // spend the budget evenly over the rooms left
    const pool = ROOMS.filter((room) => {
      if (i === 0 && !WARM_UP.includes(room.id)) return false;
      if (choices.at(-1)?.room === room) return false; // not twice in a row
      return (used.get(room.id) ?? 0) < 2; // not more than twice per world
    });

    // Try a few random options, keep the one whose danger is closest to what we want to spend.
    let best: { choice: RoomChoice; cost: number } | null = null;
    for (let tries = 0; tries < 6; tries++) {
      const room = rand.pick(pool);
      const level = i === 0 ? rules.levels[0] : rand.range(rules.levels[0], rules.levels[1]);
      const combos: Combo[] = [];
      if (i > 0 && room.combos.length > 0 && rand.chance(rules.comboChance)) combos.push(rand.pick(room.combos));
      // On easy, a combo makes the room itself gentler, so the room still fits the budget.
      const finalLevel = combos.length && settings.difficulty === 'easy' ? 0 : level;
      const cost = roomCost(room, finalLevel, combos);
      if (cost > rules.maxRoomCost) continue;
      const score = Math.abs(cost - target);
      if (!best || score < Math.abs(best.cost - target)) best = { choice: { room, level: finalLevel, combos }, cost };
    }
    // (If every try was too scary, fall back to the gentlest version of a warm-up room.)
    best ??= {
      choice: { room: pickWarmUp(pool), level: 0 },
      cost: 0,
    };
    best.cost = roomCost(best.choice.room, best.choice.level, best.choice.combos);

    const size = roomPieces(best.choice.room, best.choice.level);
    if (pieces + size > PIECE_LIMIT) break;
    pieces += size + 1; // +1 for the pad after it
    choices.push(best.choice);
    used.set(best.choice.room.id, (used.get(best.choice.room.id) ?? 0) + 1);
    spent += best.cost;
  }
  return { choices, budget, spent: totalCost(choices), pieces };
}

function pickWarmUp(pool: RoomDef[]) {
  return pool.find((r) => WARM_UP.includes(r.id)) ?? ROOMS.find((r) => r.id === 'steps')!;
}

/** About how many pieces a room has (for the phone speed limit). */
function roomPieces(room: RoomDef, level: number) {
  const built = buildRoom(room, level, makeRng(1));
  return built.bricks.length + built.movers.length + built.winds.length * 4;
}

/** Makes the whole world. Same settings → exactly the same world, on the server and on every phone. */
export function makeWorld(settings: WorldSettings): CourseDef {
  const { choices } = planWorld(settings);
  const names = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  return assembleCourse(`Random world · ${names[settings.difficulty]} · #${settings.seed}`, choices, settings.seed);
}

/** A fresh seed for a new round. */
export function newSeed() {
  return Math.floor(Math.random() * 1_000_000) + 1;
}

