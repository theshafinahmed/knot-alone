// Confetti 🎉 — little colored paper pieces that burst, flutter and fall. Drawn in one go (instancing).

import * as THREE from 'three';

const MAX_PIECES = 600;
const COLORS = [0xe63946, 0xffc300, 0x2a9df4, 0x52b788, 0x9d4edd, 0xf77f00, 0xff6fb5, 0xffffff];

interface Piece {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  rotation: THREE.Euler;
  life: number;
}

export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private pieces: Piece[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.1),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      MAX_PIECES,
    );
    this.mesh.frustumCulled = false;
    const color = new THREE.Color();
    for (let i = 0; i < MAX_PIECES; i++) {
      this.mesh.setColorAt(i, color.setHex(COLORS[i % COLORS.length]));
      this.mesh.setMatrixAt(i, this.hidden);
    }
  }

  /** Shoots `count` pieces up and out from a spot. */
  burst(at: { x: number; y: number; z: number }, count = 80, power = 7) {
    for (let i = 0; i < count; i++) {
      if (this.pieces.length >= MAX_PIECES) this.pieces.shift();
      const angle = Math.random() * Math.PI * 2;
      const out = Math.random() * power * 0.5;
      this.pieces.push({
        position: new THREE.Vector3(at.x, at.y, at.z),
        velocity: new THREE.Vector3(Math.cos(angle) * out, power * (0.6 + Math.random() * 0.6), Math.sin(angle) * out),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 2.5 + Math.random(),
      });
    }
  }

  update(dt: number) {
    this.pieces = this.pieces.filter((piece) => (piece.life -= dt) > 0);
    this.pieces.forEach((piece, i) => {
      // Paper falls slowly and flutters (lots of air drag).
      piece.velocity.y -= 9 * dt;
      piece.velocity.multiplyScalar(Math.pow(0.12, dt));
      piece.velocity.y = Math.max(piece.velocity.y, -2.2);
      piece.position.addScaledVector(piece.velocity, dt);
      piece.position.x += Math.sin(piece.life * 7 + i) * dt * 0.6;
      piece.rotation.x += piece.spin.x * dt;
      piece.rotation.y += piece.spin.y * dt;
      piece.rotation.z += piece.spin.z * dt;
      this.quaternion.setFromEuler(piece.rotation);
      this.mesh.setMatrixAt(i, this.matrix.compose(piece.position, this.quaternion, this.scale));
    });
    for (let i = this.pieces.length; i < MAX_PIECES; i++) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
