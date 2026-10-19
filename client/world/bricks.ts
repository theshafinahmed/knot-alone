// Toy bricks 🧱 — a box with round bumps (studs) on top, like LEGO.

import * as THREE from 'three';
import type { BrickDef } from '../../shared/course';

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

/** Makes a brick from a course recipe entry (square or round, ice or conveyor). */
export function createBrickFrom(def: BrickDef) {
  if (def.ice) return createIce(def.width, def.depth, def.height);
  if (def.conveyor) return createConveyor(def.width, def.depth, def.conveyor, def.height);
  if (def.bounce) return createTrampoline(def.width, def.depth, def.color, def.height);
  return def.shape === 'disc'
    ? createDisc(def.width, def.color, def.height)
    : createBrick(def.width, def.depth, def.color, def.height);
}

const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xc8f0ff, roughness: 0.08, metalness: 0.15 });
const iceShine = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });

/** 🧊 An ice brick: smooth (no studs, so it looks slippery), pale blue and shiny, with a few white streaks. */
function createIce(width: number, depth: number, height = BRICK_HEIGHT) {
  const brick = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width * STUD, height, depth * STUD), iceMaterial);
  body.position.y = -height / 2;
  brick.add(body);
  // Diagonal shine streaks on top, a little above the surface so they never flicker.
  const count = Math.max(1, Math.round((width * depth) / 10));
  for (let i = 0; i < count; i++) {
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.18, Math.min(width, depth) * 0.6), iceShine);
    streak.rotation.x = -Math.PI / 2;
    streak.rotation.z = Math.PI / 4;
    const t = (i + 0.5) / count - 0.5;
    streak.position.set(t * width * 0.7, 0.02, t * depth * 0.7);
    brick.add(streak);
  }
  return brick;
}

const trampolinePad = new THREE.MeshStandardMaterial({ color: 0xff4fa3, roughness: 0.35 });
const trampolineRim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

/** 🦘 A trampoline: a brick frame with a bright pink bouncy pad and a white rim (no studs). */
function createTrampoline(width: number, depth: number, color: number, height = BRICK_HEIGHT) {
  const brick = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width * STUD, height, depth * STUD), materialFor(color));
  body.position.y = -height / 2;
  brick.add(body);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, 0.1, depth - 0.3), trampolineRim);
  rim.position.y = 0.03;
  brick.add(rim);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, 0.1, depth - 0.8), trampolinePad);
  pad.position.y = 0.06;
  brick.add(pad);
  return brick;
}

const beltBody = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.7 });

/**
 * ➡️ A conveyor belt: a dark brick with yellow arrows on top that slide the way the belt pushes.
 * `brick.userData.belt` holds the arrow picture and speed, so the course can scroll it.
 */
function createConveyor(width: number, depth: number, push: { x: number; z: number }, height = BRICK_HEIGHT) {
  const brick = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width * STUD, height, depth * STUD), beltBody);
  body.position.y = -height / 2;
  brick.add(body);

  // The arrows point "up" in the picture. Laid flat, up = forward (−z); then we turn it to face the push.
  const alongX = Math.abs(push.x) > Math.abs(push.z);
  const across = alongX ? depth : width;
  const along = alongX ? width : depth;
  const texture = arrowTexture();
  texture.repeat.set(across / 2, along / 2); // one arrow every 2 meters
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(across - 0.1, along - 0.1),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
  );
  top.geometry.rotateX(-Math.PI / 2);
  top.rotation.y = Math.atan2(-push.x, -push.z);
  top.position.y = 0.02;
  brick.add(top);
  brick.userData.belt = { texture, speed: Math.hypot(push.x, push.z) / 2 };
  return brick;
}

function arrowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2b313c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffc300';
  // A fat chevron pointing up.
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(56, 34);
  ctx.lineTo(44, 34);
  ctx.lineTo(32, 22);
  ctx.lineTo(20, 34);
  ctx.lineTo(8, 34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(56, 56);
  ctx.lineTo(44, 56);
  ctx.lineTo(32, 44);
  ctx.lineTo(20, 56);
  ctx.lineTo(8, 56);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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
