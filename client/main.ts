// The game page 🎮 — draws the world on the screen.

import * as THREE from 'three';
import { createBrick } from './world/bricks';
import { createCloudField, createSkyBackground } from './world/sky';
import { connect } from './connection';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const statusLabel = document.querySelector<HTMLParagraphElement>('#status')!;

// ---------- Renderer (the painter) ----------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Phones have super sharp screens. Drawing every tiny dot is slow, so we cap it.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- Scene (the world) ----------

const scene = new THREE.Scene();
scene.background = createSkyBackground();
scene.fog = new THREE.Fog(0xbfe8ff, 50, 140);

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a8caf, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 20, 8);
scene.add(sun);

// The starting platform: a big red brick, with a couple of yellow bricks on it.
const platform = createBrick(10, 16, 0xe63946);
scene.add(platform);

const step1 = createBrick(2, 4, 0xffc300);
step1.position.set(-3, 1.2, -4);
scene.add(step1);

const step2 = createBrick(2, 2, 0xffc300);
step2.position.set(3, 1.2, 5);
scene.add(step2);

const bridge = createBrick(2, 12, 0x2a9df4);
bridge.position.set(0, -0.6, -14);
scene.add(bridge);

const clouds = createCloudField(28);
scene.add(clouds);

// ---------- Camera (the eyes) ----------

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Talk to the server ----------

let online = false;
let playersOnline = 0;

function updateStatus() {
  statusLabel.textContent = online
    ? `✅ Connected · ${playersOnline} player${playersOnline === 1 ? '' : 's'} online`
    : '⏳ Connecting to server…';
}

connect(
  (message) => {
    if (message.type === 'welcome' || message.type === 'players') {
      playersOnline = message.playersOnline;
      updateStatus();
    }
  },
  (isOnline) => {
    online = isOnline;
    updateStatus();
  },
);
updateStatus();

// ---------- Game loop (runs every frame) ----------

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const time = clock.getElapsedTime();

  // For now the camera slowly circles the platform, like a movie shot.
  const angle = time * 0.15;
  const distance = window.innerWidth < window.innerHeight ? 30 : 22;
  camera.position.set(Math.sin(angle) * distance, 12, Math.cos(angle) * distance);
  camera.lookAt(0, 0, -2);

  // Clouds drift a little.
  clouds.rotation.y = time * 0.01;

  renderer.render(scene, camera);
});
