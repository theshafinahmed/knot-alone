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
  body.receiveShadow = true;
  brick.add(body);

  // All studs of this brick are drawn in one go (instancing).
  const studs = new THREE.InstancedMesh(studGeometry, material, width * depth);
  const place = new THREE.Matrix4();
  let i = 0;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      place.makeTranslation(
        (x - (width - 1) / 2) * STUD,
        STUD_HEIGHT / 2,
        (z - (depth - 1) / 2) * STUD,
      );
      studs.setMatrixAt(i++, place);
    }
  }
  brick.add(studs);

  return brick;
}
