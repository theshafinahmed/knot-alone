// The rope you SEE 🪢 — a red-and-white striped tube through the rope's real links
// (the server simulates them: they sag, drape over edges, lie on the floor, wrap around things).
// Each end has a little knot where it's tied to a player's belt.

import * as THREE from 'three';

const THICKNESS = 0.07;
/** How many pieces the tube is made of along its length (smoother = more). */
const TUBE_SEGMENTS = 28;

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
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** The same stripes, shared by ropes and belts. */
export const ropeTexture = stripeTexture();

const knotGeometry = new THREE.SphereGeometry(0.1, 10, 8);
const knotMaterial = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.8 });

export class RopeView {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  private readonly knots: [THREE.Mesh, THREE.Mesh];
  private readonly curve = new THREE.CatmullRomCurve3([], false, 'centripetal');
  private readonly texture = ropeTexture.clone();

  constructor(length: number) {
    // One stripe every 25 cm.
    this.texture.repeat.x = length / 0.5;
    this.texture.needsUpdate = true;
    this.mesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 1)), 1, THICKNESS, 6),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.8 }),
    );
    this.knots = [new THREE.Mesh(knotGeometry, knotMaterial), new THREE.Mesh(knotGeometry, knotMaterial)];
    this.group.add(this.mesh, ...this.knots);
  }

  /** points = the whole rope, from one knot to the other (ends first and last). */
  update(points: THREE.Vector3[]) {
    if (points.length < 2) return;
    this.curve.points = points;
    // The curve remembers its old length; tell it to measure again, or the tube squishes into a dot.
    this.curve.updateArcLengths();
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(this.curve, TUBE_SEGMENTS, THICKNESS, 6);
    this.knots[0].position.copy(points[0]);
    this.knots[1].position.copy(points[points.length - 1]);
  }

  dispose() {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
