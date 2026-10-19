// Draws a whole course 🏗️: still bricks, moving parts (following the same clock as the server),
// checkpoint pads with flags, and the finish arch.

import * as THREE from 'three';
import { createBrick, createBrickFrom } from './bricks';
import { BRICK_HEIGHT, moverPose, swingPose, windStrength, type CourseDef, type MoverDef, type WindDef } from '../../shared/course';
import { HAMMER } from '../../shared/sim/world';

const PAD_GREEN = 0x4ade80;
const PAD_GOLD = 0xfacc15;
/** Studs are drawn only on bricks closer than this to the camera (meters). */
const STUD_DISTANCE = 45;

export class CourseView {
  readonly group = new THREE.Group();
  private movers: { object: THREE.Object3D; index: number }[] = [];
  /** Every brick's studs, with where the brick is, so far-away studs can be hidden. */
  private studs: { studs: THREE.Object3D; brick: THREE.Object3D; radius: number }[] = [];
  private flags: THREE.MeshStandardMaterial[] = [];
  private pads: THREE.MeshBasicMaterial[] = [];
  /** Conveyor belt arrows, scrolled by the clock. */
  private belts: { texture: THREE.Texture; speed: number }[] = [];
  private winds: WindView[] = [];

  constructor(private course: CourseDef) {
    for (const def of course.bricks) {
      const brick = createBrickFrom(def);
      this.trackStuds(brick, Math.max(def.width, def.depth) / 2);
      if (brick.userData.belt) this.belts.push(brick.userData.belt);
      brick.position.set(def.x, def.y, def.z);
      this.group.add(brick);
    }

    course.movers.forEach((def, index) => {
      const object = def.motion.kind === 'swing' ? createHammer(def) : createBrickFrom(def.brick);
      this.trackStuds(object, Math.max(def.brick.width, def.brick.depth) / 2);
      if (object.userData.belt) this.belts.push(object.userData.belt);
      this.group.add(object);
      this.movers.push({ object, index });
    });

    // Checkpoints (not the start): a glowing pad + a flag on a pole.
    course.checkpoints.forEach((cp, i) => {
      if (i === 0) return;
      const padMaterial = new THREE.MeshBasicMaterial({ color: PAD_GREEN, transparent: true, opacity: 0.45, depthWrite: false });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(cp.width, 0.06, cp.depth), padMaterial);
      // Its bottom sits clearly above the stud tops (0.2), so the two never flicker against each other.
      pad.position.set(cp.x, cp.y + 0.27, cp.z);
      this.group.add(pad);
      this.pads.push(padMaterial);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff }),
      );
      // Pole at the pad's front-left corner (seen walking forward).
      const sideX = -cp.dirZ;
      const sideZ = cp.dirX;
      const px = cp.x - sideX * (cp.width / 2 - 0.3) + cp.dirX * (cp.depth / 2 - 0.3);
      const pz = cp.z - sideZ * (cp.width / 2 - 0.3) + cp.dirZ * (cp.depth / 2 - 0.3);
      pole.position.set(px, cp.y + 1.5, pz);
      const flagMaterial = new THREE.MeshStandardMaterial({ color: PAD_GREEN, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), flagMaterial);
      flag.position.set(0.55, 1.1, 0);
      flag.rotation.y = Math.atan2(cp.dirX, cp.dirZ) + Math.PI / 2;
      pole.add(flag);
      this.group.add(pole);
      this.flags.push(flagMaterial);
    });

    if (course.finish) this.group.add(createFinishArch(course.finish));

    for (const wind of course.winds ?? []) {
      const view = new WindView(wind);
      this.group.add(view.group);
      this.winds.push(view);
    }
  }

  private trackStuds(brick: THREE.Object3D, radius: number) {
    const studs = brick.children.find((child) => (child as THREE.InstancedMesh).isInstancedMesh);
    if (studs) this.studs.push({ studs, brick, radius });
  }

  /**
   * Far away, studs are smaller than a pixel and shimmer when the camera moves. So we only show
   * them on bricks near the camera (also makes the game faster on phones).
   */
  hideFarStuds(camera: THREE.Vector3) {
    for (const { studs, brick, radius } of this.studs) {
      const dx = brick.position.x - camera.x;
      const dz = brick.position.z - camera.z;
      studs.visible = Math.hypot(dx, dz) - radius < STUD_DISTANCE;
    }
  }

  /** Moves the moving parts to where they are at `time` (world seconds, same clock as the server). */
  update(time: number) {
    for (const { object, index } of this.movers) {
      const def = this.course.movers[index];
      const pose = moverPose(def, time);
      object.position.set(pose.x, pose.y, pose.z);
      if (def.motion.kind === 'swing') {
        const { rotation } = swingPose(def, time);
        object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      } else {
        object.rotation.y = pose.angle;
      }
    }
    for (const wind of this.winds) wind.update(time);
    // Arrows slide forward (the picture moves "up" by speed / 2 m per second).
    for (const { texture, speed } of this.belts) texture.offset.y = (-time * speed) % 1;
  }

  /** Paints the flags your team has reached gold. `reached` = your team's last checkpoint index. */
  setReached(reached: number) {
    this.flags.forEach((flag, i) => flag.color.setHex(i + 1 <= reached ? PAD_GOLD : PAD_GREEN));
    this.pads.forEach((pad, i) => pad.color.setHex(i + 1 <= reached ? PAD_GOLD : PAD_GREEN));
  }
}

/**
 * 🔨 A swinging hammer, drawn around the point it hangs from: a little hub, a thin arm, and a big head
 * (with white bands so you can see it spin past).
 */
function createHammer(def: MoverDef) {
  if (def.motion.kind !== 'swing') throw new Error('not a swing');
  const { brick } = def;
  const length = def.motion.length;
  const height = brick.height ?? BRICK_HEIGHT;
  const hammer = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6 });

  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), dark);
  hammer.add(hub);
  const armLength = length - height / 2;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(HAMMER.arm / 2, HAMMER.arm / 2, armLength, 10), dark);
  arm.position.y = -armLength / 2;
  hammer.add(arm);

  // The head is long along the way it swings (brick.width) — like a real hammer head.
  const alongX = def.motion.axis === 'x';
  const sizeX = alongX ? brick.width : brick.depth;
  const sizeZ = alongX ? brick.depth : brick.width;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(sizeX, height, sizeZ),
    new THREE.MeshStandardMaterial({ color: brick.color, roughness: 0.45 }),
  );
  head.position.y = -length;
  hammer.add(head);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? 0.2 : sizeX + 0.04, height + 0.04, alongX ? sizeZ + 0.04 : 0.2),
      white,
    );
    band.position.set(alongX ? side * sizeX * 0.3 : 0, -length, alongX ? 0 : side * sizeZ * 0.3);
    hammer.add(band);
  }
  return hammer;
}

/**
 * 💨 How wind looks: white streaks flying through the box (more see-through when it's calm), and a
 * big fan on the side the wind comes from, spinning faster in a gust.
 */
class WindView {
  readonly group = new THREE.Group();
  private streaks: THREE.LineSegments;
  private material: THREE.LineBasicMaterial;
  private blades = new THREE.Group();
  private seeds: { across: number; up: number; offset: number; speed: number }[] = [];
  private dir: { x: number; z: number };
  private across: { x: number; z: number };
  private span: number;
  private wide: number;
  private turned = 0;
  private lastTime: number | null = null;

  constructor(private wind: WindDef) {
    const length = Math.hypot(wind.push.x, wind.push.z) || 1;
    this.dir = { x: wind.push.x / length, z: wind.push.z / length };
    this.across = { x: -this.dir.z, z: this.dir.x };
    const alongX = Math.abs(this.dir.x) > Math.abs(this.dir.z);
    this.span = alongX ? wind.width : wind.depth; // how far a streak travels through the box
    this.wide = alongX ? wind.depth : wind.width;

    const count = 36;
    for (let i = 0; i < count; i++) {
      // Fixed pseudo-random numbers, so every phone draws the same pattern.
      const r = (k: number) => {
        const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
        return v - Math.floor(v);
      };
      this.seeds.push({ across: r(1) - 0.5, up: 0.15 + r(2) * 0.8, offset: r(3), speed: 0.8 + r(4) * 0.5 });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    this.material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
    this.streaks = new THREE.LineSegments(geometry, this.material);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);

    // The fan stands just outside the box, on the side the wind comes from, facing along the wind.
    const fan = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 28), dark);
    fan.add(ring);
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.08), bladeMaterial);
      blade.position.y = 0.7;
      const holder = new THREE.Group();
      holder.rotation.z = (i * Math.PI * 2) / 3;
      holder.add(blade);
      this.blades.add(holder);
    }
    this.blades.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), dark));
    fan.add(this.blades);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), dark);
    pole.position.y = -2.6;
    fan.add(pole);
    fan.position.set(
      wind.x - this.dir.x * (this.span / 2 + 1),
      wind.y + 3.2,
      wind.z - this.dir.z * (this.span / 2 + 1),
    );
    fan.rotation.y = Math.atan2(this.dir.x, this.dir.z); // the fan's face (its +z side) points along the wind
    this.group.add(fan);
  }

  update(time: number) {
    const strength = windStrength(this.wind, time);
    this.material.opacity = 0.15 + 0.6 * strength;
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    this.turned += dt * strength;
    this.blades.rotation.z = -this.turned * 12;

    const { wind, dir, across } = this;
    const speed = Math.hypot(wind.push.x, wind.push.z) * 2.5;
    const positions = this.streaks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const length = 0.6 + 1.6 * strength;
    this.seeds.forEach((seed, i) => {
      // How far through the box this streak is (0..1), looping round.
      const t = (seed.offset + (this.turned * speed * seed.speed) / this.span) % 1;
      const along = (t - 0.5) * this.span;
      const side = seed.across * this.wide;
      const x = wind.x + dir.x * along + across.x * side;
      const z = wind.z + dir.z * along + across.z * side;
      const y = wind.y + seed.up * wind.height * 0.5;
      positions.setXYZ(i * 2, x, y, z);
      positions.setXYZ(i * 2 + 1, x - dir.x * length, y, z - dir.z * length);
    });
    positions.needsUpdate = true;
  }
}

/** A big arch with a checkered banner over the finish zone, plus a checkered floor. */
function createFinishArch(zone: { x: number; y: number; z: number; width: number; depth: number }) {
  const arch = new THREE.Group();
  const checker = checkerTexture();

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(zone.width, 0.06, zone.depth),
    new THREE.MeshBasicMaterial({ map: checker, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  floor.position.set(zone.x, zone.y + 0.27, zone.z);
  arch.add(floor);

  const height = 5;
  const front = zone.z + zone.depth / 2;
  for (const side of [-1, 1]) {
    const pillar = createBrick(1, 1, 0xf1f1f1, height);
    pillar.position.set(zone.x + side * (zone.width / 2 + 0.5), zone.y + height, front);
    arch.add(pillar);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(zone.width + 2, 1, 0.3),
    new THREE.MeshBasicMaterial({ map: checker }),
  );
  banner.position.set(zone.x, zone.y + height + 0.5, front);
  arch.add(banner);
  return arch;
}

function checkerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
