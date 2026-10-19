// The sky ☁️ — a blue gradient background plus puffy clouds.

import * as THREE from 'three';

export function createSkyBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#1e7fe0');
  gradient.addColorStop(0.55, '#6cc8ff');
  gradient.addColorStop(1, '#dff4ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const cloudGeometry = new THREE.IcosahedronGeometry(1, 2);
const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: false });
cloudGeometry.userData.shared = cloudMaterial.userData.shared = true; // (kept when a course is swapped)

/** A glowing sun far away in the sky (a soft round picture that always faces you). */
export function createSun() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 255, 240, 1)');
  glow.addColorStop(0.25, 'rgba(255, 250, 200, 0.95)');
  glow.addColorStop(0.45, 'rgba(255, 236, 160, 0.35)');
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, fog: false, depthWrite: false, transparent: true }));
  sun.scale.setScalar(70);
  return sun;
}

/**
 * A soft sea of clouds far below the course, so you can feel how high up you are.
 * It fades into the haze in the distance.
 */
export function createCloudSea() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#eaf6ff';
  ctx.fillRect(0, 0, 256, 256);
  // Lots of soft white blobs = fluffy cloud tops. Drawn 3× over (wrapping) so the picture tiles seamlessly.
  let s = 7;
  const random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 140; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const r = 10 + random() * 30;
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        const blob = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        blob.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        blob.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = blob;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 30);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: texture }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -38, -100);
  return sea;
}

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

/**
 * Scatters clouds around a spot, but never where `blocked(x, y, z, size)` says (we use that to keep
 * clouds away from the course, so they never float in front of the camera while you play).
 * `center` is where the field is in the world.
 */
export function createCloudField(
  count: number,
  seed: number,
  center: { x: number; z: number },
  blocked: (x: number, y: number, z: number, size: number) => boolean = () => false,
) {
  // Small predictable random, so clouds sit in the same spots every time.
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  const field = new THREE.Group();
  let tries = 0;
  while (field.children.length < count && tries++ < count * 20) {
    const angle = random() * Math.PI * 2;
    const distance = 14 + random() * 70;
    const size = 1.5 + random() * 3;
    const x = center.x + Math.cos(angle) * distance;
    const y = -16 + random() * 26;
    const z = center.z + Math.sin(angle) * distance;
    if (blocked(x, y, z, size)) continue;
    const cloud = createCloud(size);
    cloud.position.set(x, y, z);
    cloud.userData.baseY = y;
    cloud.userData.size = size;
    field.add(cloud);
  }
  return field;
}

/**
 * Clouds bob gently up and down (they don't drift sideways, so they never wander onto the course),
 * and any cloud too close to the camera hides so it can't block the view.
 */
export function updateClouds(field: THREE.Group, time: number, camera: THREE.Vector3) {
  field.children.forEach((cloud, i) => {
    cloud.position.y = cloud.userData.baseY + Math.sin(time * 0.3 + i) * 0.4;
    const tooClose = cloud.position.distanceTo(camera) < 6 + cloud.userData.size * 2.2;
    cloud.visible = !tooClose;
  });
}
