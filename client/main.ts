// The game page 🎮 — the boss server runs the game; this page shows it and sends your controls.
// Flow: join screen (name, color, hat) → lobby (everyone waits, host picks rope mode) → game.

import * as THREE from 'three';
import { createBrick } from './world/bricks';
import { createCloudField, createSkyBackground } from './world/sky';
import { BlockyCharacter } from './character';
import { Controls } from './controls';
import { Connection, playerToken } from './connection';
import { GameView } from './game-view';
import { JoinScreen, LobbyPanel, type Look } from './lobby';
import { InviteCard } from './invite';
import { TEST_COURSE } from '../shared/course';
import { GameWorld, initPhysics } from '../shared/sim/world';
import type { LobbyPlayer, Phase, ServerMessage } from '../shared/messages';

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

// The physics engine is only used here to find floors (for shadows and ropes). The server runs the real game.
await initPhysics();
const floors = new GameWorld(course);

// ---------- State ----------

let myId: string | null = null;
let phase: Phase = 'lobby';
let lobbyPlayers: LobbyPlayer[] = [];
let joined = false;
let myLook: Look | null = null;
let game: GameView | null = null;

// ---------- Talk to the server ----------

const token = playerToken();
const connection = new Connection(onMessage, (online) => {
  updateStatus();
  // Came back after the line dropped → join again automatically (the server remembers us by token).
  if (online && joined && myLook) sendJoin(myLook);
});

function sendJoin(look: Look) {
  connection.send({ type: 'join', token, ...look });
}

function updateStatus() {
  if (!connection.online) {
    statusLabel.textContent = '⏳ Connecting…';
    return;
  }
  const people = lobbyPlayers.filter((p) => p.online).length;
  statusLabel.textContent = `✅ ${people} online`;
}

function onMessage(message: ServerMessage) {
  switch (message.type) {
    case 'welcome':
      myId = message.id;
      joined = true;
      joinScreen.hide();
      break;
    case 'full':
      joined = false;
      joinScreen.show();
      joinScreen.showMessage('😢 The game is full (6 players max).');
      break;
    case 'lobby':
      lobbyPlayers = message.players;
      phase = message.phase;
      lobby.update(message.players, myId, message.mode, message.bots);
      invite.set(message.invite);
      if (phase === 'lobby' && game) endGame();
      refreshScreens();
      updateStatus();
      break;
    case 'start':
      startGame(message);
      break;
    case 'snap':
      game?.addSnapshot(message);
      break;
  }
}

// ---------- Screens ----------

const joinScreen = new JoinScreen((look) => {
  myLook = look;
  sendJoin(look);
});

const invite = new InviteCard();
$('#open-invite').addEventListener('click', () => invite.show());

const lobby = new LobbyPanel({
  setMode: (mode) => connection.send({ type: 'setup', mode }),
  setBots: (bots) => connection.send({ type: 'setup', bots }),
  start: () => connection.send({ type: 'start' }),
  editLook: () => joinScreen.show('Save'),
});

function amHost() {
  return lobbyPlayers.some((p) => p.host && p.id === myId);
}

function refreshScreens() {
  const playing = phase === 'playing' && !!game;
  document.body.classList.toggle('playing', playing);
  controls.enabled = playing;
  $('#host-panel').classList.toggle('hidden', !(playing && amHost()));
  if (joined && !playing && !joinScreen.isOpen) lobby.show();
  else lobby.hide();
  if (!playing) refreshLineup();
}

$('#btn-restart').addEventListener('click', () => connection.send({ type: 'restart' }));
$('#btn-lobby').addEventListener('click', () => connection.send({ type: 'backToLobby' }));
const isTyping = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !e.repeat && phase === 'playing' && amHost() && !isTyping(e)) {
    connection.send({ type: 'restart' });
  }
});

// Opening/closing the join screen changes what should be shown.
new MutationObserver(refreshScreens).observe($('#join'), { attributes: true, attributeFilter: ['class'] });

// ---------- Lobby lineup: everyone stands on the start platform, facing the camera ----------

let lineup: { key: string; view: BlockyCharacter }[] = [];
const LINEUP_Z = -2;
const LINEUP_SPACING = 1.5;

function refreshLineup() {
  const people = phase === 'lobby' ? lobbyPlayers : [];
  const keys = people.map((p) => `${p.id}|${p.name}|${p.color}|${p.hat}`);
  if (keys.join() === lineup.map((l) => l.key).join()) return;
  for (const item of lineup) item.view.dispose();
  lineup = people.map((p, i) => {
    const view = new BlockyCharacter(p.color, { hat: p.hat, name: p.name });
    scene.add(view.root, view.shadow);
    return { key: keys[i], view };
  });
}

function updateLineup(dt: number) {
  lineup.forEach(({ view }, i) => {
    const x = (i - (lineup.length - 1) / 2) * LINEUP_SPACING;
    view.update(
      dt,
      { x, y: 0, z: LINEUP_Z, vx: 0, vy: 0, vz: 0, grounded: true, stunned: false, facing: 0 },
      0,
    );
  });
}

// ---------- The game ----------

const controls = new Controls(canvas, {
  joystick: $('#joystick'),
  knob: $('#knob'),
  jump: $('#jump'),
  hint: $('#hint'),
  punch: $('#punch'),
  emote: $('#emote'),
  emoteMenu: $('#emote-menu'),
});

function startGame(message: Extract<ServerMessage, { type: 'start' }>) {
  game?.dispose();
  for (const item of lineup) item.view.dispose();
  lineup = [];
  game = new GameView(scene, floors, message);
  phase = 'playing';
  controls.yaw = 0; // camera starts behind you, looking down the course
  snapCamera = true;
  refreshScreens();
}

function endGame() {
  game?.dispose();
  game = null;
  if (document.pointerLockElement) document.exitPointerLock();
  refreshScreens();
}

/** Who the camera follows: me, or (if I'm only watching) the first player. */
function followedId() {
  if (!game) return null;
  if (myId && game.members.has(myId)) return myId;
  return game.members.keys().next().value ?? null;
}

// ---------- Sending my controls ----------

const INPUT_RATE = 30;
let jumps = 0;
let lastInputSent = 0;

function sendInput(now: number, force = false) {
  if (!game || !myId || !game.members.has(myId)) return;
  if (!force && now - lastInputSent < 1000 / INPUT_RATE) return;
  lastInputSent = now;
  // Turn "joystick up/right" into a direction in the world, based on where the camera looks.
  const move = controls.getMove();
  const sin = Math.sin(controls.yaw);
  const cos = Math.cos(controls.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  connection.send({
    type: 'input',
    x: Math.round((-sin * move.y + cos * move.x) * 100) / 100,
    z: Math.round((-cos * move.y - sin * move.x) * 100) / 100,
    jumps,
  });
}

// ---------- Start ----------

$('#loading').classList.add('hidden');
joinScreen.show();

// Handy for testing from the browser console.
(window as unknown as { knot: object }).knot = {
  controls,
  scene,
  connection,
  get game() {
    return game;
  },
  get myId() {
    return myId;
  },
};

// ---------- Game loop (runs every frame) ----------

const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
let snapCamera = true;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  const time = clock.elapsedTime;

  if (game) {
    if (controls.consumeJump()) {
      jumps++;
      sendInput(now, true); // send jumps right away
    }
    sendInput(now);
    const action = controls.consumeAction();
    if (action && myId && game.members.has(myId)) connection.send({ type: 'action', action });
    game.update(dt);

    // Camera floats behind and above the player we follow.
    const id = followedId();
    const target = id ? game.positionOf(id) : null;
    if (target) {
      const goal = new THREE.Vector3(target.x, target.y + 1.5, target.z);
      if (snapCamera || cameraTarget.distanceTo(goal) > 8) cameraTarget.copy(goal);
      else cameraTarget.lerp(goal, Math.min(1, dt * 12));
      snapCamera = false;
    }
    const flat = Math.cos(controls.pitch) * CAMERA_DISTANCE;
    camera.position.set(
      cameraTarget.x + Math.sin(controls.yaw) * flat,
      cameraTarget.y + Math.sin(controls.pitch) * CAMERA_DISTANCE,
      cameraTarget.z + Math.cos(controls.yaw) * flat,
    );
    camera.lookAt(cameraTarget);
  } else {
    // Lobby: the camera looks at everyone lined up, gently swaying. It backs up on narrow screens.
    controls.consumeJump();
    controls.consumeAction();
    updateLineup(dt);
    const width = Math.max(lineup.length, 1) * LINEUP_SPACING + 2;
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const distance = Math.max(7, width / 2 / Math.tan(halfFov));
    camera.position.set(Math.sin(time * 0.3) * 1.5, 1.2 + distance * 0.25, LINEUP_Z + distance);
    camera.lookAt(0, 0.4, LINEUP_Z);
  }

  clouds.rotation.y += dt * 0.01;
  renderer.render(scene, camera);
});
