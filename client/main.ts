// The game page 🎮 — runs the world, reads the controls, draws everything.

import * as THREE from 'three';
import { createBrick } from './world/bricks';
import { createCloudField, createSkyBackground } from './world/sky';
import { BlockyCharacter } from './character';
import { Controls } from './controls';
import { connect } from './connection';
import { TEST_COURSE } from '../shared/course';
import { GameWorld, initPhysics, TICK, type PlayerInput, type PlayerState } from '../shared/sim/world';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>('#game');
const statusLabel = $('#status');

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// ---------- Renderer (the painter) ----------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Phones have super sharp screens. Drawing every tiny dot is slow, so we cap it.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- Scene (the world) ----------

const scene = new THREE.Scene();
scene.background = createSkyBackground();
scene.fog = new THREE.Fog(0xbfe8ff, 60, 160);

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a8caf, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(12, 20, 8);
scene.add(sun);

const course = TEST_COURSE;
for (const def of course.bricks) {
  const brick = createBrick(def.width, def.depth, def.color, def.height);
  brick.position.set(def.x, def.y, def.z);
  scene.add(brick);
}

const clouds = createCloudField(36);
clouds.position.z = -20;
scene.add(clouds);

// ---------- Camera (the eyes) ----------

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
const CAMERA_DISTANCE = 9;

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Talk to the server ----------

let online = false;
let playersOnline = 0;

function updateStatus() {
  statusLabel.textContent = online ? `✅ ${playersOnline} online` : '⏳ Connecting…';
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

// ---------- Start the game ----------

await initPhysics();

const ME = 'me';
const world = new GameWorld(course);
world.addPlayer(ME);

const me = new BlockyCharacter(0xe63946);
scene.add(me.root, me.shadow);

const controls = new Controls(canvas, {
  joystick: $('#joystick'),
  knob: $('#knob'),
  jump: $('#jump'),
  hint: $('#hint'),
});
controls.yaw = 0; // camera starts behind the player, looking down the course

$('#loading').classList.add('hidden');

// ---------- Game loop (runs every frame) ----------

const clock = new THREE.Clock();
let leftover = 0;
let previous: PlayerState = world.getState(ME)!;
let current: PlayerState = previous;
let jumpThisTick = false;
const cameraTarget = new THREE.Vector3(current.x, current.y + 1.5, current.z);

/** Turns "joystick up/right" into a direction in the world, based on where the camera looks. */
function readInput(): PlayerInput {
  const move = controls.getMove();
  const sin = Math.sin(controls.yaw);
  const cos = Math.cos(controls.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  return {
    x: -sin * move.y + cos * move.x,
    z: -cos * move.y - sin * move.x,
    jump: jumpThisTick,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (controls.consumeJump()) jumpThisTick = true;

  // Physics moves in fixed steps; we may do 0, 1 or 2 steps this frame.
  leftover += dt;
  while (leftover >= TICK) {
    previous = current;
    world.step(new Map([[ME, readInput()]]));
    jumpThisTick = false;
    current = world.getState(ME)!;
    leftover -= TICK;
  }

  // Draw smoothly between the last two physics steps.
  const t = leftover / TICK;
  const teleported = Math.abs(current.y - previous.y) > 5;
  const shown: PlayerState = teleported
    ? current
    : {
        ...current,
        x: lerp(previous.x, current.x, t),
        y: lerp(previous.y, current.y, t),
        z: lerp(previous.z, current.z, t),
      };

  me.update(dt, shown, world.distanceToFloor(shown.x, shown.y + 0.1, shown.z));

  // Camera floats behind and above the player, and follows smoothly.
  const goal = new THREE.Vector3(shown.x, shown.y + 1.5, shown.z);
  if (teleported) cameraTarget.copy(goal);
  else cameraTarget.lerp(goal, Math.min(1, dt * 12));
  const flat = Math.cos(controls.pitch) * CAMERA_DISTANCE;
  camera.position.set(
    cameraTarget.x + Math.sin(controls.yaw) * flat,
    cameraTarget.y + Math.sin(controls.pitch) * CAMERA_DISTANCE,
    cameraTarget.z + Math.cos(controls.yaw) * flat,
  );
  camera.lookAt(cameraTarget);

  clouds.rotation.y += dt * 0.01;

  renderer.render(scene, camera);
});
