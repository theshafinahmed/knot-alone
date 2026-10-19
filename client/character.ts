// The blocky guy 🧍 — made of boxes, Roblox style. Feet are at y = 0.

import * as THREE from 'three';
import type { Hat } from '../shared/looks';
import { createHat } from './hats';
import { createNameTag } from './nametag';

const MIDDLE = 0.95; // middle of the body, from the feet
const SKIN = 0xffcc4d;
const PANTS = 0x264653;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

/** Makes a box that hangs down from its top (so arms/legs swing from the shoulder/hip). */
function limb(width: number, length: number, material: THREE.Material) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(box(width, length, width), material);
  mesh.position.y = -length / 2;
  pivot.add(mesh);
  return pivot;
}

export class BlockyCharacter {
  readonly root = new THREE.Group();
  /** Spins/tilts the whole body around its middle (for floppy falls and lying flat). */
  private readonly pivot = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private walkCycle = 0;
  private facing = Math.PI;
  private tumble = 0;

  constructor(color: number, options: { hat?: Hat; name?: string } = {}) {
    const shirt = mat(color);
    const skin = mat(SKIN);
    const pants = mat(PANTS);

    this.pivot.position.y = MIDDLE;
    this.body.position.y = -MIDDLE;
    this.pivot.add(this.body);
    this.root.add(this.pivot);

    // Legs (hip at 0.75 m)
    this.leftLeg = limb(0.36, 0.75, pants);
    this.leftLeg.position.set(-0.2, 0.75, 0);
    this.rightLeg = limb(0.36, 0.75, pants);
    this.rightLeg.position.set(0.2, 0.75, 0);

    // Torso (0.75 m → 1.4 m)
    const torso = new THREE.Mesh(box(0.8, 0.68, 0.42), shirt);
    torso.position.y = 1.08;

    // Arms (shoulders at 1.38 m)
    this.leftArm = limb(0.3, 0.66, shirt);
    this.leftArm.position.set(-0.56, 1.38, 0);
    this.rightArm = limb(0.3, 0.66, shirt);
    this.rightArm.position.set(0.56, 1.38, 0);
    const hand = new THREE.Mesh(box(0.3, 0.14, 0.3), skin);
    hand.position.y = -0.6;
    this.leftArm.add(hand);
    this.rightArm.add(hand.clone());

    // Head (1.42 m → 1.9 m) with a simple face
    const head = new THREE.Mesh(box(0.5, 0.48, 0.48), skin);
    head.position.y = 1.66;
    const eyeMat = mat(0x1d1d1d);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(box(0.07, 0.11, 0.02), eyeMat);
      eye.position.set(side * 0.11, 0.05, 0.245);
      head.add(eye);
    }
    const smile = new THREE.Mesh(box(0.2, 0.04, 0.02), eyeMat);
    smile.position.set(0, -0.1, 0.245);
    head.add(smile);
    const hat = options.hat ? createHat(options.hat) : null;
    if (hat) {
      hat.position.y = 0.24; // top of the head
      head.add(hat);
    }

    this.body.add(this.leftLeg, this.rightLeg, torso, this.leftArm, this.rightArm, head);

    // The name floats above the head (and above any hat). It doesn't tumble with the body.
    if (options.name) {
      const tag = createNameTag(options.name, color);
      tag.position.y = 2.65;
      this.root.add(tag);
    }

    // Soft round shadow on the floor (much cheaper than real shadows).
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.shadow = shadow;
  }

  /** Removes this character from the scene and frees its memory. */
  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    const free = (object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        (material as THREE.MeshBasicMaterial).map?.dispose();
        material.dispose();
      }
    };
    this.root.traverse(free);
    free(this.shadow);
  }

  /** Add this to the scene separately, it follows the floor, not the body. */
  readonly shadow: THREE.Mesh;

  /**
   * Moves and animates the guy.
   * @param floorDistance how far below the feet the floor is (null = no floor).
   */
  update(
    dt: number,
    state: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      grounded: boolean;
      stunned: boolean;
      facing: number;
    },
    floorDistance: number | null,
  ) {
    this.root.position.set(state.x, state.y, state.z);

    // Turn smoothly towards where we're going.
    let diff = state.facing - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, dt * 14);
    this.root.rotation.y = this.facing;

    const speed = Math.hypot(state.vx, state.vz);
    // Negative x-rotation swings a limb forward.
    let leftArm: number, rightArm: number, leftLeg: number, rightLeg: number;
    let armsOut = 0;
    // Whole-body tilt: positive = leaning forward. And how high the middle of the body sits.
    let tilt = 0;
    let middle = MIDDLE;

    if (state.stunned) {
      // Flat on the back like a starfish ⭐ after a hard landing.
      leftArm = rightArm = 0;
      leftLeg = rightLeg = 0;
      armsOut = 1.2;
      tilt = -Math.PI / 2;
      middle = 0.25;
      this.tumble = 0;
    } else if (state.grounded) {
      // Walking: swing arms and legs, faster when running.
      this.walkCycle += dt * speed * 1.6;
      const swing = Math.sin(this.walkCycle) * Math.min(speed / 7, 1) * 0.9;
      leftLeg = swing;
      rightLeg = -swing;
      leftArm = -swing;
      rightArm = swing;
    } else if (state.vy < -9) {
      // Falling fast: arms up and flailing! 😱
      const t = performance.now() / 70;
      leftArm = -Math.PI * 0.9 + Math.sin(t) * 0.4;
      rightArm = -Math.PI * 0.9 - Math.sin(t) * 0.4;
      leftLeg = Math.sin(t * 1.3) * 0.6;
      rightLeg = -leftLeg;
      armsOut = 0.4;
      // ...and slowly tumble head over heels.
      this.tumble += dt * Math.min(6, -state.vy * 0.25);
      tilt = this.tumble;
    } else {
      // Jumping / dangling: arms forward and up, one leg tucked, leaning with the motion.
      leftArm = rightArm = -1.1;
      leftLeg = 0.3;
      rightLeg = -0.6;
      armsOut = 0.25;
      tilt = Math.max(-0.6, Math.min(0.6, speed * 0.06 - state.vy * 0.03));
      this.tumble = 0;
    }

    if (this.tumble === 0) {
      // Coming out of a tumble: take the short way back to upright.
      this.pivot.rotation.x = Math.atan2(Math.sin(this.pivot.rotation.x), Math.cos(this.pivot.rotation.x));
    }
    const bodyEase = Math.min(1, dt * 10);
    this.pivot.rotation.x += (tilt - this.pivot.rotation.x) * bodyEase;
    this.pivot.position.y += (middle - this.pivot.position.y) * bodyEase;

    const ease = Math.min(1, dt * 18);
    const blend = (limb: THREE.Group, axis: 'x' | 'z', target: number) => {
      limb.rotation[axis] += (target - limb.rotation[axis]) * ease;
    };
    blend(this.leftArm, 'x', leftArm);
    blend(this.rightArm, 'x', rightArm);
    blend(this.leftArm, 'z', -armsOut);
    blend(this.rightArm, 'z', armsOut);
    blend(this.leftLeg, 'x', leftLeg);
    blend(this.rightLeg, 'x', rightLeg);

    // A little bounce while running.
    const bounce = state.grounded && !state.stunned ? Math.abs(Math.sin(this.walkCycle)) * 0.06 * Math.min(speed / 7, 1) : 0;
    this.body.position.y = -MIDDLE + bounce;

    // Shadow sits on the floor, and gets smaller and fainter the higher we are.
    if (floorDistance === null || floorDistance > 30) {
      this.shadow.visible = false;
    } else {
      this.shadow.visible = true;
      this.shadow.position.set(state.x, state.y - floorDistance + 0.02, state.z);
      const s = Math.max(0.3, 1 - floorDistance / 12);
      this.shadow.scale.setScalar(s);
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.25 * s;
    }
  }
}
