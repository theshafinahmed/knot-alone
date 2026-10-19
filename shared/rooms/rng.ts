// 🎲 A seeded dice: the same seed always rolls the same numbers, on the server and on every phone.
// (Math.random can't do that — every phone would build a different world.)

export interface Rng {
  /** A number from 0 up to (not including) 1. */
  next(): number;
  /** A number between min and max. */
  range(min: number, max: number): number;
  /** A whole number from min to max (both included). */
  int(min: number, max: number): number;
  /** One item from a list. */
  pick<T>(items: readonly T[]): T;
  /** True this often (0..1). */
  chance(probability: number): boolean;
  /** +1 or −1 (for mirroring a room left/right). */
  sign(): 1 | -1;
}

/** Makes a dice from a seed number ("mulberry32": small, fast, good enough for games). */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}
