// The rope you SEE 🪢. It's only a drawing: a red-and-white striped tube that
// sags when loose and goes straight when tight. The real rope lives in the physics.

import * as THREE from 'three';

const SEGMENTS = 20;
const THICKNESS = 0.07;
/** Ropes are tied around the waist. */
export const WAIST_HEIGHT = 0.95;

function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#d62828';
  ctx.fillRect(0, 0, 32, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

const baseTexture = stripeTexture();

export class RopeView {
  readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  private readonly curve = new THREE.QuadraticBezierCurve3();
  private readonly bentCurve = new THREE.CatmullRomCurve3(
    [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    false,
    'centripetal', // goes through the edge point without looping around
  );
  private readonly texture = baseTexture.clone();

  constructor(length: number) {
    // One stripe every 25 cm.
    this.texture.repeat.x = length / 0.5;
    this.mesh = new THREE.Mesh(
      new THREE.TubeGeometry(this.curve, SEGMENTS, THICKNESS, 6),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.8 }),
    );
  }

  /**
   * a and b are the two players' feet positions.
   * floorY is the height of the floor under the middle of the rope (null = no floor, it can hang freely).
   * length is how long the rope is right now. bend is the edge it goes over (null = none).
   */
  update(
    a: THREE.Vector3,
    b: THREE.Vector3,
    floorY: number | null,
    length: number,
    bend: { x: number; y: number; z: number } | null,
  ) {
    if (bend) {
      // Over an edge: the rope is tight, from one player, over the edge, down to the other.
      const [p0, p1, p2] = this.bentCurve.points;
      p0.set(a.x, a.y + WAIST_HEIGHT, a.z);
      p1.set(bend.x, bend.y + THICKNESS, bend.z);
      p2.set(b.x, b.y + WAIST_HEIGHT, b.z);
      this.rebuild(this.bentCurve);
      return;
    }

    const start = this.curve.v0.set(a.x, a.y + WAIST_HEIGHT, a.z);
    const end = this.curve.v2.set(b.x, b.y + WAIST_HEIGHT, b.z);
    const distance = start.distanceTo(end);

    // The looser the rope, the more it hangs down in the middle.
    const slack = Math.max(0, length * length - distance * distance);
    const sag = Math.sqrt(slack) * 0.5;
    const middle = this.curve.v1.copy(start).add(end).multiplyScalar(0.5);
    middle.y -= sag * 2; // a curve only reaches halfway to its middle point

    // Don't let the rope sink into the floor: its lowest point rests on top of it.
    if (floorY !== null) {
      const lowestAllowed = floorY + THICKNESS + 0.2; // + 0.2 for the studs
      // The curve's lowest point is (start + 2 × middle + end) / 4.
      const minMiddleY = (4 * lowestAllowed - start.y - end.y) / 2;
      middle.y = Math.max(middle.y, minMiddleY);
    }

    this.rebuild(this.curve);
  }

  private rebuild(curve: THREE.Curve<THREE.Vector3>) {
    // The curve remembers its old length; tell it to measure again, or the tube squishes into a dot.
    curve.updateArcLengths();
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, SEGMENTS, THICKNESS, 6);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
