// Small line icons used by the HUD (same style as the ones in index.html).

const icon = (body: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON_SOUND_ON = icon('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11"/>');
export const ICON_SOUND_OFF = icon('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>');
export const ICON_CHECK = icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 20);
export const ICON_FLAG = icon('<path d="M6 21V4M6 5h11l-2.5 4 2.5 4H6"/>', 24);
export const ICON_STOPWATCH = icon('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>', 24);
