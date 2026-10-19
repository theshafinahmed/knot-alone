// How players can look 🎨: shirt colors, hats and names.

export const SHIRT_COLORS = [
  0xe63946, // red
  0x2a9df4, // blue
  0x52b788, // green
  0xffc300, // yellow
  0x9d4edd, // purple
  0xf77f00, // orange
  0xff6fb5, // pink
  0x2ec4b6, // teal
] as const;

export const HATS = ['none', 'cap', 'tophat', 'crown', 'party', 'straw'] as const;
export type Hat = (typeof HATS)[number];

export const HAT_EMOJI: Record<Hat, string> = {
  none: '🚫',
  cap: '🧢',
  tophat: '🎩',
  crown: '👑',
  party: '🎉',
  straw: '👒',
};

export const NAME_MAX = 12;

/** Trims a name, keeps it short, and gives a default if it's empty. */
export function cleanName(name: unknown, fallback = 'Player') {
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  return [...text].slice(0, NAME_MAX).join('') || fallback;
}

export function isShirtColor(value: unknown): value is number {
  return typeof value === 'number' && (SHIRT_COLORS as readonly number[]).includes(value);
}

export function isHat(value: unknown): value is Hat {
  return typeof value === 'string' && (HATS as readonly string[]).includes(value);
}
