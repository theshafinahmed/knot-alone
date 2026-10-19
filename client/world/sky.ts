// The sky ☁️ — a blue gradient background plus puffy clouds.

import * as THREE from 'three';

export function createSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#2f9bf0');
  gradient.addColorStop(0.6, '#7fd3ff');
  gradient.addColorStop(1, '#d6f1ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const cloudGeometry = new THREE.IcosahedronGeometry(1, 2);
const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: false });

/** A cloud made of a few squished white balls stuck together. */
export function createCloud(size: number) {
  const cloud = new THREE.Group();
  const puffs = [
    [0, 0, 0, 1],
    [1.1, -0.15, 0.2, 0.75],
    [-1.1, -0.2, -0.1, 0.7],
    [0.4, 0.45, -0.2, 0.7],
    [-0.5, 0.3, 0.3, 0.6],
  ];
  for (const [x, y, z, r] of puffs) {
    const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
    puff.position.set(x * size, y * size, z * size);
    puff.scale.setScalar(r * size);
    cloud.add(puff);
  }
  return cloud;
}

/** Scatters clouds around and below the play area. */
export function createCloudField(count: number, seed = 1) {
  // Small predictable random, so clouds sit in the same spots every time.
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  const field = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const distance = 18 + random() * 60;
    const cloud = createCloud(1.5 + random() * 3);
    cloud.position.set(Math.cos(angle) * distance, -14 + random() * 22, Math.sin(angle) * distance);
    field.add(cloud);
  }
  return field;
}
