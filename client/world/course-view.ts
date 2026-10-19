// Draws a whole course 🏗️: still bricks, moving parts (following the same clock as the server),
// checkpoint pads with flags, and the finish arch.

import * as THREE from 'three';
import { createBrick, createBrickFrom } from './bricks';
import { moverPose, type CourseDef } from '../../shared/course';

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

  constructor(private course: CourseDef) {
    for (const def of course.bricks) {
      const brick = createBrickFrom(def);
      this.trackStuds(brick, Math.max(def.width, def.depth) / 2);
      brick.position.set(def.x, def.y, def.z);
      this.group.add(brick);
    }

    course.movers.forEach((def, index) => {
      const object = createBrickFrom(def.brick);
      this.trackStuds(object, Math.max(def.brick.width, def.brick.depth) / 2);
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
      const pose = moverPose(this.course.movers[index], time);
      object.position.set(pose.x, pose.y, pose.z);
      object.rotation.y = pose.angle;
    }
  }

  /** Paints the flags your team has reached gold. `reached` = your team's last checkpoint index. */
  setReached(reached: number) {
    this.flags.forEach((flag, i) => flag.color.setHex(i + 1 <= reached ? PAD_GOLD : PAD_GREEN));
    this.pads.forEach((pad, i) => pad.color.setHex(i + 1 <= reached ? PAD_GOLD : PAD_GREEN));
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
