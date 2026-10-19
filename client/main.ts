// The game page 🎮 — the boss server runs the game; this page shows it and sends your controls.
// Flow: join screen (name, color, hat) → lobby (everyone waits, host picks rope mode) → game.

import * as THREE from 'three';
import { CourseView } from './world/course-view';
import { createCloudField, createCloudSea, createSkyBackground, createSun, updateClouds } from './world/sky';
import { BlockyCharacter } from './character';
import { Controls } from './controls';
import { Connection, playerToken } from './connection';
import { GameView } from './game-view';
import { JoinScreen, LobbyPanel, type Look } from './lobby';
import { InviteCard } from './invite';
import { SKY_COURSE } from '../shared/sky-course';
import { RaceHud } from './race-hud';
import { sounds } from './sounds';
import { Confetti } from './confetti';
import { blockZoom } from './no-zoom';
import { COUNTDOWN, GameWorld, initPhysics } from '../shared/sim/world';
import { askConfirm, closeConfirm, isConfirmOpen } from './confirm';
import { ICON_SOUND_OFF, ICON_SOUND_ON } from './icons';
import type { LobbyPlayer, Phase, ServerMessage } from '../shared/messages';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>('#game');
const statusLabel = $('#status-text');
const statusPill = $('#status');

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
blockZoom();

// ---------- Renderer (the painter) ----------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Phones have super sharp screens. Drawing every tiny dot is slow, so we cap it.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- Scene (the world) ----------

const scene = new THREE.Scene();
scene.background = createSkyBackground();
scene.fog = new THREE.Fog(0xd4efff, 60, 170);

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x6a8caf, 1.6));
const sun = new THREE.DirectionalLight(0xfff6e0, 2.3);
sun.position.set(12, 20, 8);
scene.add(sun);

// ☀️ The sun in the sky (far away, in the same direction the light comes from) and the cloud sea below.
const sunDisc = createSun();
scene.add(sunDisc);
scene.add(createCloudSea());

const course = SKY_COURSE;
const courseView = new CourseView(course);
scene.add(courseView.group);

// Clouds all along the course — but never on or right next to it (a cloud floating in front of the
// camera hides everything). "Near the course" = within 12 m of any brick, at playing height.
const courseBoxes = [...course.bricks, ...course.movers.map((m) => m.brick)].map((b) => ({
  minX: b.x - b.width / 2 - 6,
  maxX: b.x + b.width / 2 + 6,
  minZ: b.z - b.depth / 2 - 6,
  maxZ: b.z + b.depth / 2 + 6,
  top: b.y,
}));
const nearCourse = (x: number, y: number, z: number, size: number) =>
  courseBoxes.some(
    (box) =>
      x > box.minX - size * 2 &&
      x < box.maxX + size * 2 &&
      z > box.minZ - size * 2 &&
      z < box.maxZ + size * 2 &&
      y > box.top - 12 - size,
  );
// 🎉 Confetti pieces live in the scene for the whole game.
const confetti = new Confetti();
scene.add(confetti.mesh);

// 🔊 Sound on/off button (remembered on this phone).
const muteButton = $<HTMLButtonElement>('#mute');
const showMute = () => (muteButton.innerHTML = sounds.muted ? ICON_SOUND_OFF : ICON_SOUND_ON);
muteButton.addEventListener('click', () => {
  sounds.setMuted(!sounds.muted);
  showMute();
  muteButton.blur();
});
showMute();

const clouds = [
  { x: 0, z: -20 },
  { x: 14, z: -110 },
  { x: 14, z: -200 },
].map((center, i) => {
  const field = createCloudField(30, i + 1, center, nearCourse);
  scene.add(field);
  return field;
});

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
// (Only the still bricks — the moving parts aren't needed for that.)
const floors = new GameWorld({ ...course, movers: [] });
// The physics engine only builds its "where is everything" index on its first step. Without this,
// every question ("is there a floor under me?", "is a wall in the way?") would answer "nothing".
floors.world.step();

// ---------- State ----------

let myId: string | null = null;
let phase: Phase = 'lobby';
let lobbyPlayers: LobbyPlayer[] = [];
let joined = false;
let myLook: Look | null = null;
let game: GameView | null = null;
let race: RaceHud | null = null;
/** Which team I'm in (index into the start message's teams), or −1 if only watching. */
let myTeam = -1;

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
    statusLabel.textContent = 'Connecting…';
    statusPill.classList.add('connecting');
    return;
  }
  const people = lobbyPlayers.filter((p) => p.online).length;
  statusLabel.textContent = `${people} online`;
  joinScreen.setOnline(people);
  statusPill.classList.remove('connecting');
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
      joinScreen.showMessage('The game is full (6 players max).');
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
  document.body.classList.toggle('joining', joinScreen.isOpen);
  controls.enabled = playing && !isConfirmOpen();
  document.body.classList.toggle('host', playing && amHost());
  if (!playing) closeConfirm();
  $('#host-panel').classList.toggle('hidden', !(playing && amHost()));
  if (joined && !playing && !joinScreen.isOpen) lobby.show();
  else lobby.hide();
  if (!playing) refreshLineup();
}

/** Retry and Lobby end the race for everybody, so the host gets an "Are you sure?" first. */
async function confirmThenSend(kind: 'restart' | 'backToLobby') {
  if (isConfirmOpen()) return;
  const options =
    kind === 'restart'
      ? { title: 'Retry the race?', text: 'Everyone goes back to the start.', yes: 'Retry' }
      : { title: 'Back to the lobby?', text: 'The race ends for everybody.', yes: 'Back to lobby' };
  controls.enabled = false;
  const yes = await askConfirm(options);
  refreshScreens();
  if (yes && phase === 'playing' && amHost()) connection.send({ type: kind });
}

$('#btn-restart').addEventListener('click', () => confirmThenSend('restart'));
$('#btn-lobby').addEventListener('click', () => confirmThenSend('backToLobby'));
const isTyping = (e: Event) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', (e) => {
  if (e.repeat || phase !== 'playing' || !amHost() || isTyping(e) || isConfirmOpen()) return;
  if (e.code === 'KeyR') confirmThenSend('restart');
  else if (e.code === 'KeyL') confirmThenSend('backToLobby');
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

/** How much of the screen the lobby card (right side) or sheet (bottom) covers, in pixels. */
function lobbyCover() {
  const card = joinScreen.isOpen ? null : document.getElementById('lobby');
  if (!card || card.classList.contains('hidden')) return { coverX: 0, coverY: 0 };
  const box = card.getBoundingClientRect();
  // A side card is narrow and sits at the right; a sheet spans the width at the bottom.
  if (box.width < window.innerWidth * 0.8) return { coverX: Math.max(0, window.innerWidth - box.left), coverY: 0 };
  return { coverX: 0, coverY: Math.max(0, window.innerHeight - box.top) };
}

function updateLineup(dt: number) {
  const hide = joinScreen.isOpen; // the join screen has its own big picture of you
  lineup.forEach(({ view }, i) => {
    view.root.visible = !hide;
    view.shadow.visible = !hide;
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
  pull: $('#pull'),
  emote: $('#emote'),
  emoteMenu: $('#emote-menu'),
  hintMove: $('#hint-move'),
  hintLook: $('#hint-look'),
});

function startGame(message: Extract<ServerMessage, { type: 'start' }>) {
  game?.dispose();
  for (const item of lineup) item.view.dispose();
  lineup = [];
  game = new GameView(scene, floors, message);
  race?.dispose();
  race = new RaceHud(message.teams, new Map(message.players.map((p) => [p.id, p])), {
    playAgain: () => connection.send({ type: 'restart' }),
    lobby: () => connection.send({ type: 'backToLobby' }),
  });
  myTeam = message.teams.findIndex((team) => !!myId && team.includes(myId));
  // Sounds and confetti for things that happen in the game.
  game.onEvent = (event) => {
    if (event[0] === 'hit') {
      sounds.hit();
    } else if (event[0] === 'cp') {
      const cp = course.checkpoints[event[2]];
      if (cp) confetti.burst({ x: cp.x, y: cp.y + 0.5, z: cp.z }, event[1] === myTeam ? 90 : 40);
      if (event[1] === myTeam) sounds.checkpoint();
    } else if (event[0] === 'fin') {
      const zone = course.finish;
      if (zone) {
        for (let i = 0; i < 4; i++) {
          confetti.burst({ x: zone.x + (Math.random() - 0.5) * zone.width, y: zone.y + 0.5, z: zone.z + (Math.random() - 0.5) * zone.depth }, 70, 9);
        }
      }
      sounds.finish();
    } else if (event[0] === 'fall' && event[1] === myTeam) {
      sounds.fall();
    }
  };
  courseView.setReached(0);
  phase = 'playing';
  controls.yaw = 0; // camera starts behind you, looking down the course
  controls.showHints();
  snapCamera = true;
  refreshScreens();
}

function endGame() {
  game?.dispose();
  game = null;
  race?.dispose();
  race = null;
  courseView.setReached(0);
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
let wasPulling = false;
const pullBadge = $('#pull-badge');
const pullButton = $('#pull');
let pullShown = false;

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
    pull: controls.isPulling(),
  });
}

// ---------- Start ----------

$('#loading').classList.add('hidden');
joinScreen.show();

// Handy for testing from the browser console.
(window as unknown as { knot: object }).knot = {
  controls,
  scene,
  camera,
  renderer,
  floors,
  connection,
  get game() {
    return game;
  },
  get myId() {
    return myId;
  },
  /** Test-only: set to { x, y, z, lookX, lookY, lookZ } to point the camera anywhere (null = normal). */
  freeCam: null as null | { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number },
};
const testHook = (window as unknown as { knot: { freeCam: null | Record<'x' | 'y' | 'z' | 'lookX' | 'lookY' | 'lookZ', number> } }).knot;

// ---------- Game loop (runs every frame) ----------

const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
let snapCamera = true;
/** How far the camera is from you right now (less than CAMERA_DISTANCE when a wall is in the way). */
let cameraDistance = CAMERA_DISTANCE;
/** Closer than this counts as "squeezed" (a brick is right behind you). */
const SQUEEZED_DISTANCE = 4;
let squeezedTime = 0;
let unsqueezeGoal: { yaw: number; pitch: number } | null = null;

/** Shortest turn from angle a to angle b (−π..π). */
function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** How far the camera could back away from the player in this direction before hitting something. */
function clearDistanceAt(yaw: number, pitch: number) {
  const flat = Math.cos(pitch) * CAMERA_DISTANCE;
  const to = new THREE.Vector3(
    cameraTarget.x + Math.sin(yaw) * flat,
    cameraTarget.y + Math.sin(pitch) * CAMERA_DISTANCE,
    cameraTarget.z + Math.cos(yaw) * flat,
  );
  return floors.hitDistance(cameraTarget, to) ?? CAMERA_DISTANCE;
}

/** The camera angle with the best view that isn't a big turn away from where you're looking now. */
function findClearView() {
  let best: { yaw: number; pitch: number } | null = null;
  let bestScore = clearDistanceAt(controls.yaw, controls.pitch); // staying put is the baseline
  for (const turn of [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
    for (const pitch of [controls.pitch, 0.9, 1.25]) {
      const yaw = controls.yaw + turn;
      // Prefer small turns and small tilts: a view this much clearer must be worth the swing.
      const score = clearDistanceAt(yaw, pitch) - Math.abs(turn) * 0.6 - Math.abs(pitch - controls.pitch) * 1.5;
      if (score > bestScore + 1.5) {
        bestScore = score;
        best = { yaw, pitch };
      }
    }
  }
  return best;
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  const time = clock.elapsedTime;

  if (game) {
    if (controls.consumeJump()) {
      jumps++;
      sounds.jump();
      sendInput(now, true); // send jumps right away
    }
    const pulling = controls.isPulling();
    sendInput(now, pulling !== wasPulling); // send pull start/stop right away
    wasPulling = pulling;
    pullBadge.classList.toggle('hidden', !pulling);
    // The Pull button only shows while a friend on my rope is hanging.
    const needed = game.needsHelp(myId);
    if (needed !== pullShown) {
      pullShown = needed;
      pullButton.classList.toggle('needed', needed);
      if (!needed) controls.releasePull(); // the button vanished under a finger: let go
    }
    const action = controls.consumeAction();
    if (action && myId && game.members.has(myId)) {
      connection.send({ type: 'action', action });
      if (action === 'punch') sounds.punchSwing();
      else sounds.emote();
    }
    game.update(dt);

    // Moving parts follow the race clock, so they're in the same spot as on the server.
    if (game.raceTime !== null) {
      courseView.update(game.raceTime + COUNTDOWN);
      race?.update({
        raceTime: game.raceTime,
        myTeam,
        progress: game.teamProgress,
        bestTime: game.bestTime,
        checkpointCount: course.checkpoints.length,
        amHost: amHost(),
      });
      const mine = game.teamProgress[myTeam];
      if (mine) courseView.setReached(mine[0]);
    }

    // Camera floats behind and above the player we follow.
    const id = followedId();
    const target = id ? game.positionOf(id) : null;
    if (target) {
      const goal = new THREE.Vector3(target.x, target.y + 1.5, target.z);
      if (snapCamera || cameraTarget.distanceTo(goal) > 8) cameraTarget.copy(goal);
      else cameraTarget.lerp(goal, Math.min(1, dt * 12));
      snapCamera = false;
    }
    // 📷 Squeezed against a wall for a while (like hanging under a brick)? Turn the camera by itself
    // to the nearest angle with a clear view, so nobody is stuck staring at a brick.
    squeezedTime = cameraDistance < SQUEEZED_DISTANCE ? squeezedTime + dt : 0;
    if (squeezedTime > 0.6) {
      if (!unsqueezeGoal) unsqueezeGoal = findClearView();
      if (unsqueezeGoal) {
        const turn = Math.min(1, dt * 3);
        controls.yaw += wrapAngle(unsqueezeGoal.yaw - controls.yaw) * turn;
        controls.pitch += (unsqueezeGoal.pitch - controls.pitch) * turn;
      }
    } else if (squeezedTime === 0) {
      unsqueezeGoal = null;
    }
    // Where the camera wants to be: behind and above you.
    const flat = Math.cos(controls.pitch) * CAMERA_DISTANCE;
    const wanted = new THREE.Vector3(
      cameraTarget.x + Math.sin(controls.yaw) * flat,
      cameraTarget.y + Math.sin(controls.pitch) * CAMERA_DISTANCE,
      cameraTarget.z + Math.cos(controls.yaw) * flat,
    );
    // 📷 Never through walls: if a brick is between you and the camera, the camera comes closer
    // (quickly), and goes back out (gently) once the way is clear.
    const blocked = floors.hitDistance(cameraTarget, wanted);
    const allowed = blocked === null ? CAMERA_DISTANCE : Math.max(1.2, blocked - 0.35);
    cameraDistance = allowed < cameraDistance ? allowed : cameraDistance + (allowed - cameraDistance) * Math.min(1, dt * 3);
    camera.position.copy(cameraTarget).lerp(wanted, cameraDistance / CAMERA_DISTANCE);
    // ...and never down among the studs: keep the camera at least 0.8 m above the floor under it.
    const below = floors.distanceToFloor(camera.position.x, camera.position.y + 2, camera.position.z, 4);
    if (below !== null) camera.position.y = Math.max(camera.position.y, camera.position.y + 2 - below + 0.8);
    if (camera.view?.enabled) camera.clearViewOffset(); // the lobby slid the picture; the race doesn't
    camera.lookAt(cameraTarget);
    game.updateTags(camera);
  } else {
    // Lobby: the camera looks at everyone lined up, gently swaying. It backs up on narrow screens.
    controls.consumeJump();
    controls.consumeAction();
    courseView.update(time); // moving parts keep moving in the lobby too
    updateLineup(dt);
    // The lobby card (or sheet) covers part of the screen, so frame everyone in the part that's left.
    const { coverX, coverY } = lobbyCover();
    const usableW = Math.max(0.3, 1 - coverX / window.innerWidth);
    const usableH = Math.max(0.3, 1 - coverY / window.innerHeight);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = Math.max(lineup.length, 1) * LINEUP_SPACING + 2;
    const distance = Math.max(7, width / 2 / (tanV * camera.aspect * usableW), 4.4 / 2 / (tanV * usableH));
    camera.position.set(Math.sin(time * 0.3) * 1.5, 1.2 + distance * 0.25, LINEUP_Z + distance);
    camera.lookAt(0, 1.3, LINEUP_Z);
    // Slide the picture away from the card: left of a side card, above a bottom sheet.
    camera.setViewOffset(window.innerWidth, window.innerHeight, coverX / 2, coverY / 2, window.innerWidth, window.innerHeight);
  }

  confetti.update(dt);
  // The sun stays far away in the same direction, wherever the camera goes.
  sunDisc.position.set(camera.position.x + 120, camera.position.y + 110, camera.position.z - 160);
  const free = testHook.freeCam;
  if (free) {
    camera.position.set(free.x, free.y, free.z);
    camera.lookAt(free.lookX, free.lookY, free.lookZ);
  }
  for (const field of clouds) updateClouds(field, time, camera.position);
  courseView.hideFarStuds(camera.position);
  renderer.render(scene, camera);
});
