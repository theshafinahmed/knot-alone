// The blocky guy 🧍 — made of boxes, Roblox style. Feet are at y = 0.

import * as THREE from 'three';

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
  private readonly body = new THREE.Group();
  private readonly leftArm: THREE.Group;
  private readonly rightArm: THREE.Group;
  private readonly leftLeg: THREE.Group;
  private readonly rightLeg: THREE.Group;
  private walkCycle = 0;
  private facing = Math.PI;

  constructor(color: number) {
    const shirt = mat(color);
    const skin = mat(SKIN);
    const pants = mat(PANTS);

    this.root.add(this.body);

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

    this.body.add(this.leftLeg, this.rightLeg, torso, this.leftArm, this.rightArm, head);

    // Soft round shadow on the floor (much cheaper than real shadows).
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.shadow = shadow;
  }

  /** Add this to the scene separately, it follows the floor, not the body. */
  readonly shadow: THREE.Mesh;

  /**
   * Moves and animates the guy.
   * @param floorDistance how far below the feet the floor is (null = no floor).
   */
  update(
    dt: number,
    state: { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean; facing: number },
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

    if (state.grounded) {
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
    } else {
      // Jumping: arms forward and up, one leg tucked.
      leftArm = rightArm = -1.1;
      leftLeg = 0.3;
      rightLeg = -0.6;
      armsOut = 0.25;
    }

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
    this.body.position.y = state.grounded ? Math.abs(Math.sin(this.walkCycle)) * 0.06 * Math.min(speed / 7, 1) : 0;

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
