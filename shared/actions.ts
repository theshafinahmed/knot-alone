// Fun actions 🎭: wave, punch, kick, dance, cheer.

export const ACTIONS = ['wave', 'punch', 'dance', 'cheer', 'kick'] as const;
export type ActionKind = (typeof ACTIONS)[number];

export const ACTION_EMOJI: Record<ActionKind, string> = {
  wave: '👋',
  punch: '👊',
  dance: '💃',
  cheer: '🎉',
  kick: '🦵',
};

/** How long each action lasts, in seconds. */
export const ACTION_TIME: Record<ActionKind, number> = {
  wave: 1.6,
  punch: 0.45,
  dance: 4,
  cheer: 1.4,
  kick: 0.7,
};

/** Small numbers for snapshots: 0 = no action. */
export const ACTION_CODE: Record<ActionKind, number> = { wave: 1, punch: 2, dance: 3, cheer: 4, kick: 5 };
export const ACTION_FROM_CODE: (ActionKind | null)[] = [null, 'wave', 'punch', 'dance', 'cheer', 'kick'];

export function isAction(value: unknown): value is ActionKind {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

export const PUNCH = {
  /** When in the punch the fist lands (seconds after starting). */
  hitAt: 0.12,
  /** How far the punch reaches (meters, from the middle of your body). */
  reach: 1.5,
  /** How hard it shoves: sideways speed and a little hop (m/s). */
  shove: 4.5,
  hop: 2.5,
  /** How long the punched player stumbles (can't control their feet). */
  stumble: 0.35,
  /** Wait between punches (seconds). */
  cooldown: 0.6,
};

/** 🦵 The kick: a big shove. Slower and shorter than a punch, but about twice as hard. */
export const KICK = {
  /** When in the kick the foot lands (seconds after starting). */
  hitAt: 0.2,
  /** How far the kick reaches (meters, from the middle of your body). */
  reach: 1.3,
  /** How hard it shoves: sideways speed and a hop (m/s). */
  shove: 9,
  hop: 3.5,
  /** How long the kicked player stumbles (can't control their feet). */
  stumble: 0.55,
  /** Wait between kicks (seconds). */
  cooldown: 1.4,
};
