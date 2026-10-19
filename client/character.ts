// The blocky guy 🧍 — made of boxes, Roblox style. Feet are at y = 0.

import * as THREE from 'three';
import type { Hat } from '../shared/looks';
import { ACTION_EMOJI, PUNCH, type ActionKind } from '../shared/actions';
import { createHat } from './hats';
import { createNameTag } from './nametag';
import { ropeTexture } from './rope';

const MIDDLE = 0.95; // middle of the body, from the feet
const BELT_HEIGHT = 0.82; // where the rope belt sits, from the feet
const SKIN = 0xffcc4d;
const PANTS = 0x264653;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

// Emoji bubbles (👋 💃 🎉 👊) that pop up above the name while doing an action. One picture per emoji, shared.
const bubbleTextures = new Map<string, THREE.Texture>();
function bubbleTexture(emoji: string) {
  let texture = bubbleTextures.get(emoji);
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.arc(48, 48, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '56px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 48, 52);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    bubbleTextures.set(emoji, texture);
  }
  return texture;
}
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
  private readonly bubble = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));

  constructor(color: number, options: { hat?: Hat; name?: string; belt?: boolean } = {}) {
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
      // Things on the hat that spin (the propeller!).
      hat.traverse((part) => {
        if (part.userData.spin) this.spinners.push(part);
      });
    }

    this.body.add(this.leftLeg, this.rightLeg, torso, this.leftArm, this.rightArm, head);

    // 🎀 The rope belt around the waist (in a game, everyone is tied on).
    if (options.belt) {
      const beltTexture = ropeTexture.clone();
      beltTexture.repeat.set(5, 1);
      beltTexture.needsUpdate = true;
      this.belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.12, 0.48),
        new THREE.MeshStandardMaterial({ map: beltTexture, roughness: 0.8 }),
      );
      this.belt.position.y = BELT_HEIGHT;
      this.body.add(this.belt);
    }

    // The name floats above the head (and above any hat). It doesn't tumble with the body.
    if (options.name) {
      const tag = createNameTag(options.name, color);
      tag.position.y = 2.65;
      this.root.add(tag);
    }

    this.bubble.position.y = 3.2;
    this.bubble.renderOrder = 11;
    this.bubble.visible = false;
    this.root.add(this.bubble);

    // Soft round shadow on the floor (much cheaper than real shadows).
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        // Drawn as if a bit closer to the camera, so it never flickers against the floor.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.shadow = shadow;
  }

  private belt: THREE.Mesh | null = null;
  private readonly spinners: THREE.Object3D[] = [];
  private readonly beltCenter = new THREE.Vector3();

  /**
   * Where a rope tied to this player starts: the spot on the belt facing `towards` (in world
   * space). Written into `out`. Falls back to the waist if there's no belt.
   */
  knotPoint(towards: THREE.Vector3, out: THREE.Vector3) {
    if (this.belt) {
      // Make sure the belt's position is up to date for this frame (no lag = no jitter).
      this.belt.updateWorldMatrix(true, false);
      this.belt.getWorldPosition(this.beltCenter);
    }
    else this.beltCenter.set(this.root.position.x, this.root.position.y + BELT_HEIGHT, this.root.position.z);
    const dx = towards.x - this.beltCenter.x;
    const dz = towards.z - this.beltCenter.z;
    const flat = Math.hypot(dx, dz);
    if (flat < 1e-4) return out.copy(this.beltCenter);
    // The belt is a little wider than deep; 0.36 m out from the middle lands on its surface.
    return out.set(this.beltCenter.x + (dx / flat) * 0.36, this.beltCenter.y, this.beltCenter.z + (dz / flat) * 0.36);
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
      action?: ActionKind | null;
      actionTime?: number;
    },
    floorDistance: number | null,
  ) {
    this.root.position.set(state.x, state.y, state.z);
    for (const spinner of this.spinners) spinner.rotation.y += spinner.userData.spin * dt;

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

    // A little bounce while running.
    let bounce = state.grounded && !state.stunned ? Math.abs(Math.sin(this.walkCycle)) * 0.06 * Math.min(speed / 7, 1) : 0;

    // 🎭 Fun actions take over the arms (and sometimes the whole body).
    let leftOut = armsOut;
    let rightOut = armsOut;
    let twist = 0;
    let armEase = 18;
    const action = state.stunned ? null : (state.action ?? null);
    const t = state.actionTime ?? 0;
    switch (action) {
      case 'wave': // one arm up high, waving side to side
        rightArm = 0;
        rightOut = 2.6 + Math.sin(t * 12) * 0.35;
        break;
      case 'punch': // pull the fist back, then throw it straight forward
        armEase = 40;
        if (t < PUNCH.hitAt) {
          rightArm = 0.6;
        } else if (t < PUNCH.hitAt + 0.15) {
          rightArm = -1.65;
          rightOut = 0.05;
          tilt += 0.15;
        }
        break;
      case 'dance': // swing arms, wiggle the hips, bop up and down
        leftArm = Math.sin(t * 8) * 1.2;
        rightArm = -Math.sin(t * 8) * 1.2;
        leftOut = rightOut = 0.6;
        leftLeg = Math.max(0, Math.sin(t * 8)) * 0.5;
        rightLeg = Math.max(0, -Math.sin(t * 8)) * 0.5;
        twist = Math.sin(t * 4) * 0.6;
        bounce = Math.abs(Math.sin(t * 8)) * 0.12;
        break;
      case 'cheer': // both arms up, little hops
        leftArm = rightArm = 0;
        leftOut = rightOut = 2.7 + Math.sin(t * 14) * 0.15;
        bounce = Math.abs(Math.sin(t * 7)) * 0.25;
        break;
    }

    if (this.tumble === 0) {
      // Coming out of a tumble: take the short way back to upright.
      this.pivot.rotation.x = Math.atan2(Math.sin(this.pivot.rotation.x), Math.cos(this.pivot.rotation.x));
    }
    const bodyEase = Math.min(1, dt * 10);
    this.pivot.rotation.x += (tilt - this.pivot.rotation.x) * bodyEase;
    this.pivot.position.y += (middle - this.pivot.position.y) * bodyEase;

    const ease = Math.min(1, dt * 18);
    const blend = (limb: THREE.Group, axis: 'x' | 'y' | 'z', target: number, k = ease) => {
      limb.rotation[axis] += (target - limb.rotation[axis]) * k;
    };
    const fastEase = Math.min(1, dt * armEase);
    blend(this.leftArm, 'x', leftArm);
    blend(this.rightArm, 'x', rightArm, fastEase);
    blend(this.leftArm, 'z', -leftOut);
    blend(this.rightArm, 'z', rightOut, fastEase);
    blend(this.leftLeg, 'x', leftLeg);
    blend(this.rightLeg, 'x', rightLeg);
    blend(this.body, 'y', twist);

    this.body.position.y = -MIDDLE + bounce;

    // Emoji bubble pops up while doing an action.
    if (action) {
      const material = this.bubble.material;
      const texture = bubbleTexture(ACTION_EMOJI[action]);
      if (material.map !== texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
      const pop = Math.min(1, t * 6);
      this.bubble.scale.setScalar(0.85 * (0.6 + 0.4 * pop));
      this.bubble.visible = true;
    } else {
      this.bubble.visible = false;
    }

    // Shadow sits on the floor, and gets smaller and fainter the higher we are.
    if (floorDistance === null || floorDistance > 30) {
      this.shadow.visible = false;
    } else {
      this.shadow.visible = true;
      // Just above the stud tops (0.2), so it lies on the studs instead of fighting with the brick top.
      this.shadow.position.set(state.x, state.y - floorDistance + 0.21, state.z);
      const s = Math.max(0.3, 1 - floorDistance / 12);
      this.shadow.scale.setScalar(s);
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.25 * s;
    }
  }
}
