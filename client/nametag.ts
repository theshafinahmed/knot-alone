// Name tags 🏷️ — the name floating above each player's head, always facing the camera.

import * as THREE from 'three';

/** Height of the tag in meters. */
const TAG_HEIGHT = 0.42;

export function createNameTag(name: string, color: number) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontSize = 44;
  const font = `900 ${fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.font = font;
  const textWidth = Math.ceil(ctx.measureText(name).width);
  const padX = 22;
  const dot = 26; // little color dot that matches the shirt
  canvas.width = textWidth + padX * 2 + dot + 12;
  canvas.height = 72;

  // Rounded dark pill
  ctx.fillStyle = 'rgba(17, 24, 39, 0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 36);
  ctx.fill();

  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.arc(padX + dot / 2, canvas.height / 2, dot / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, padX + dot + 12, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    // depthTest off = you can see your friends' names even behind bricks.
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  );
  sprite.scale.set((TAG_HEIGHT * canvas.width) / canvas.height, TAG_HEIGHT, 1);
  sprite.renderOrder = 10;
  return sprite;
}
