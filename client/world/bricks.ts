// Toy bricks 🧱 — a box with round bumps (studs) on top, like LEGO.

import * as THREE from 'three';

/** How big one stud square is, in meters. */
export const STUD = 1;
const BRICK_HEIGHT = 1.2;
const STUD_RADIUS = 0.3;
const STUD_HEIGHT = 0.2;

// One shared stud shape, reused for every stud in the game (cheap for phones).
const studGeometry = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);

const materials = new Map<number, THREE.MeshStandardMaterial>();
function materialFor(color: number) {
  let material = materials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    materials.set(color, material);
  }
  return material;
}

/**
 * Makes a brick `width` studs wide and `depth` studs long.
 * Its top surface sits at y = 0 of the returned group, so it's easy to stand on.
 */
export function createBrick(width: number, depth: number, color: number, height = BRICK_HEIGHT) {
  const material = materialFor(color);
  const brick = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width * STUD, height, depth * STUD), material);
  body.position.y = -height / 2;
  brick.add(body);

  // Studs in a grid (only whole studs fit; thin bricks get none).
  const spots: [number, number][] = [];
  const across = Math.floor(width);
  const along = Math.floor(depth);
  for (let x = 0; x < across; x++) {
    for (let z = 0; z < along; z++) spots.push([(x - (across - 1) / 2) * STUD, (z - (along - 1) / 2) * STUD]);
  }
  addStuds(brick, material, spots);
  return brick;
}

/** A round brick (like a LEGO dish). `diameter` in studs. Top at y = 0. */
export function createDisc(diameter: number, color: number, height = BRICK_HEIGHT) {
  const material = materialFor(color);
  const disc = new THREE.Group();
  const radius = diameter / 2;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40), material);
  body.position.y = -height / 2;
  disc.add(body);

  // Studs in a grid, but only the ones that fit inside the circle.
  const spots: [number, number][] = [];
  const count = Math.floor(diameter);
  for (let x = 0; x < count; x++) {
    for (let z = 0; z < count; z++) {
      const px = (x - (count - 1) / 2) * STUD;
      const pz = (z - (count - 1) / 2) * STUD;
      if (Math.hypot(px, pz) <= radius - 0.45) spots.push([px, pz]);
    }
  }
  addStuds(disc, material, spots);
  return disc;
}

/** Makes a brick from a course recipe entry (square or round). */
export function createBrickFrom(def: { width: number; depth: number; color: number; height?: number; shape?: 'box' | 'disc' }) {
  return def.shape === 'disc'
    ? createDisc(def.width, def.color, def.height)
    : createBrick(def.width, def.depth, def.color, def.height);
}

/** All studs of one brick are drawn in one go (instancing), which is cheap for phones. */
function addStuds(brick: THREE.Group, material: THREE.Material, spots: [number, number][]) {
  if (spots.length === 0) return;
  const studs = new THREE.InstancedMesh(studGeometry, material, spots.length);
  const place = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    place.makeTranslation(x, STUD_HEIGHT / 2, z);
    studs.setMatrixAt(i, place);
  });
  brick.add(studs);
}
