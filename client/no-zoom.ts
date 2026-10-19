// No zooming 🔍🚫 — a game shouldn't zoom when you tap fast or use two fingers.
// The page already asks phones not to zoom (in index.html), but some phones (iPhones especially)
// ignore that. So we also block the zoom gestures here.

export function blockZoom() {
  // iPhone/iPad pinch gestures.
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(name, (e) => e.preventDefault(), { passive: false });
  }

  // Two fingers moving on the page (pinch) — but the game itself still gets every finger
  // (it listens to pointer events, which aren't affected).
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );

  // Double-tap zoom: ignore the second tap of a quick double tap. Not on buttons (so you can tap
  // "+" twice fast — buttons already can't zoom) and not while typing your name.
  let lastTap = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      const target = e.target as Element | null;
      const skip = target instanceof HTMLInputElement || !!target?.closest?.('button');
      if (!skip && now - lastTap < 350) e.preventDefault();
      lastTap = now;
    },
    { passive: false },
  );

  // Laptop trackpad pinch / Ctrl + mouse wheel.
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
