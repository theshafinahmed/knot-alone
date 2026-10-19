// The game page 🎮 — runs the world, reads the controls, draws everything.
// Step 3 (rope test): you + robot buddies tied together in a chain.

import * as THREE from 'three';
import { createBrick } from './world/bricks';
import { createCloudField, createSkyBackground } from './world/sky';
import { BlockyCharacter } from './character';
import { RopeView } from './rope';
import { Controls } from './controls';
import { connect } from './connection';
import { TEST_COURSE } from '../shared/course';
import { GameWorld, initPhysics, TICK, type PlayerInput, type PlayerState, type RopeState } from '../shared/sim/world';
import { BotBrain, type BotMode } from '../shared/sim/bots';

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
const CAMERA_DISTANCE = 10.5;

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

// ---------- The team: you + robot buddies, tied in a chain ----------

await initPhysics();

const ME = 'me';
const SHIRT_COLORS = [0xe63946, 0x2a9df4, 0x52b788, 0xffc300, 0x9d4edd, 0xf77f00];
const BOT_COUNTS = [1, 2, 3, 5];

interface Member {
  id: string;
  view: BlockyCharacter;
  previous: PlayerState;
  current: PlayerState;
  shown: THREE.Vector3;
}

let world!: GameWorld;
let members: Member[] = [];
let ropes: { view: RopeView; state: RopeState; a: Member; b: Member }[] = [];
let bots: BotBrain[] = [];
let botCount = 3;
let botMode: BotMode = 'follow';

/** Builds a fresh world with you at the front and `botCount` bots tied behind you. */
function buildTeam() {
  for (const member of members) scene.remove(member.view.root, member.view.shadow);
  for (const rope of ropes) {
    scene.remove(rope.view.mesh);
    rope.view.dispose();
  }
  world?.dispose();

  world = new GameWorld(course);
  const ids = [ME, ...Array.from({ length: botCount }, (_, i) => `bot${i + 1}`)];
  for (const id of ids) world.addPlayer(id);
  for (let i = 1; i < ids.length; i++) world.tie(ids[i - 1], ids[i]);

  members = ids.map((id, i) => {
    const view = new BlockyCharacter(SHIRT_COLORS[i % SHIRT_COLORS.length]);
    scene.add(view.root, view.shadow);
    const state = world.getState(id)!;
    return { id, view, previous: state, current: state, shown: new THREE.Vector3(state.x, state.y, state.z) };
  });

  const byId = new Map(members.map((m) => [m.id, m]));
  ropes = world.getRopes().map((rope) => {
    const view = new RopeView(rope.length);
    scene.add(view.mesh);
    return { view, state: rope, a: byId.get(rope.a)!, b: byId.get(rope.b)! };
  });

  // Each bot follows the player right in front of it in the chain.
  bots = ids.slice(1).map((id, i) => new BotBrain(id, ids[i]));
  snapCamera = true;
}

// ---------- Rope test buttons ----------

const botsButton = $<HTMLButtonElement>('#btn-bots');
const modeButton = $<HTMLButtonElement>('#btn-mode');
const resetButton = $<HTMLButtonElement>('#btn-reset');

function updateButtons() {
  botsButton.textContent = `🤖 ${botCount}`;
  modeButton.textContent = botMode === 'follow' ? '🏃 Follow' : '😴 Lazy';
}

function changeBotCount() {
  botCount = BOT_COUNTS[(BOT_COUNTS.indexOf(botCount) + 1) % BOT_COUNTS.length];
  buildTeam();
  updateButtons();
}
function toggleBotMode() {
  botMode = botMode === 'follow' ? 'lazy' : 'follow';
  updateButtons();
}
function restart() {
  world.respawnAll();
  snapCamera = true;
}

for (const [button, action] of [
  [botsButton, changeBotCount],
  [modeButton, toggleBotMode],
  [resetButton, restart],
] as const) {
  button.addEventListener('click', () => {
    action();
    button.blur(); // so Space doesn't "press" the button again
  });
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyB') changeBotCount();
  if (e.code === 'KeyL') toggleBotMode();
  if (e.code === 'KeyR') restart();
});

// ---------- Start ----------

let snapCamera = true;
buildTeam();
updateButtons();

const controls = new Controls(canvas, {
  joystick: $('#joystick'),
  knob: $('#knob'),
  jump: $('#jump'),
  hint: $('#hint'),
});
controls.yaw = 0; // camera starts behind you, looking down the course

// Handy for testing from the browser console.
(window as unknown as { knot: object }).knot = { controls, scene, get world() { return world; }, get ropes() { return ropes; } };

$('#loading').classList.add('hidden');

// ---------- Game loop (runs every frame) ----------

const clock = new THREE.Clock();
let leftover = 0;
let jumpThisTick = false;
const cameraTarget = new THREE.Vector3();

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
    const inputs = new Map<string, PlayerInput>([[ME, readInput()]]);
    for (const bot of bots) inputs.set(bot.id, bot.think(world, botMode));
    world.step(inputs);
    jumpThisTick = false;
    for (const member of members) {
      member.previous = member.current;
      member.current = world.getState(member.id)!;
    }
    leftover -= TICK;
  }

  // Draw everyone smoothly between the last two physics steps.
  const t = leftover / TICK;
  for (const member of members) {
    const { previous: a, current: b } = member;
    const teleported = Math.abs(b.y - a.y) > 5 || Math.abs(b.z - a.z) > 5;
    const shown: PlayerState = teleported
      ? b
      : { ...b, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
    if (teleported && member.id === ME) snapCamera = true;
    member.shown.set(shown.x, shown.y, shown.z);
    member.view.update(dt, shown, world.distanceToFloor(shown.x, shown.y + 0.1, shown.z));
  }
  for (const rope of ropes) {
    const { shown: a } = rope.a;
    const { shown: b } = rope.b;
    const topY = Math.max(a.y, b.y) + 1;
    const below = world.distanceToFloor((a.x + b.x) / 2, topY, (a.z + b.z) / 2, 6);
    rope.view.update(a, b, below === null ? null : topY - below, rope.state.current, rope.state.bend);
  }

  // Camera floats behind and above you, and follows smoothly.
  const me = members[0].shown;
  const goal = new THREE.Vector3(me.x, me.y + 1.5, me.z);
  if (snapCamera) cameraTarget.copy(goal);
  else cameraTarget.lerp(goal, Math.min(1, dt * 12));
  snapCamera = false;
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
