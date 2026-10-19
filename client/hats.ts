// Hats 🎩 — built from simple shapes. The bottom of each hat sits at y = 0 (put it on top of the head).

import * as THREE from 'three';
import type { Hat } from '../shared/looks';

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
const cylinder = (top: number, bottom: number, height: number, color: number, segments = 20) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat(color));
  mesh.position.y = height / 2;
  return mesh;
};

export function createHat(hat: Hat): THREE.Group | null {
  const group = new THREE.Group();
  switch (hat) {
    case 'none':
      return null;

    case 'cap': {
      const dome = cylinder(0.25, 0.27, 0.14, 0x1d4ed8);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.26), mat(0x1e40af));
      brim.position.set(0, 0.02, 0.3);
      group.add(dome, brim);
      break;
    }

    case 'tophat': {
      const brim = cylinder(0.34, 0.34, 0.03, 0x111111);
      const tube = cylinder(0.21, 0.21, 0.42, 0x1a1a1a);
      tube.position.y += 0.03;
      const band = cylinder(0.215, 0.215, 0.06, 0xb91c1c);
      band.position.y += 0.05;
      group.add(brim, tube, band);
      break;
    }

    case 'crown': {
      const gold = 0xfbbf24;
      group.add(cylinder(0.25, 0.25, 0.12, gold));
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), mat(gold));
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.sin(angle) * 0.21, 0.19, Math.cos(angle) * 0.21);
        group.add(spike);
      }
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), mat(0xe11d48));
      gem.position.set(0, 0.06, 0.25);
      group.add(gem);
      break;
    }

    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.48, 16), mat(0xec4899));
      cone.position.y = 0.24;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(0xfde047));
      pom.position.y = 0.5;
      group.add(cone, pom);
      break;
    }

    case 'straw': {
      const straw = 0xe9c46a;
      const brim = cylinder(0.48, 0.48, 0.03, straw, 28);
      const dome = cylinder(0.23, 0.26, 0.17, straw);
      dome.position.y += 0.03;
      const band = cylinder(0.262, 0.262, 0.05, 0xd62828);
      band.position.y += 0.04;
      group.add(brim, dome, band);
      break;
    }
  }
  return group;
}
