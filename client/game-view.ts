// Draws the game the server (the boss) describes 🎬.
// The server sends ~30 snapshots per second. We draw everyone a tiny bit in the past
// and slide smoothly between two snapshots, so movement looks smooth even though updates
// arrive in little jumps. How far in the past adapts to the connection: on a bumpy internet
// connection we wait a bit longer, so we never run out of snapshots (which looks like a shake).

import * as THREE from 'three';
import { BlockyCharacter } from './character';
import { RopeView } from './rope';
import {
  FLAG_GROUNDED,
  FLAG_HANGING,
  FLAG_STUNNED,
  type LobbyPlayer,
  type ServerMessage,
  type SnapEvent,
} from '../shared/messages';
import type { GameWorld, PlayerState } from '../shared/sim/world';
import { ACTION_FROM_CODE } from '../shared/actions';

/** How far in the past we draw (ms). Bigger = smoother on bad Wi-Fi, but a bit more delay. */
/** How far in the past we draw (ms): at least this on good Wi-Fi, up to the max on bumpy internet. */
const MIN_DELAY = 80;
const MAX_DELAY = 260;
/** The server sends a snapshot about this often (ms). */
const SNAPSHOT_GAP = 1000 / 30;
const MAX_SNAPSHOTS = 40;

type Snapshot = Extract<ServerMessage, { type: 'snap' }>;
type StartMessage = Extract<ServerMessage, { type: 'start' }>;

interface Member {
  info: LobbyPlayer;
  view: BlockyCharacter;
  shown: THREE.Vector3;
  state: PlayerState | null;
}

export class GameView {
  readonly members = new Map<string, Member>();
  private ropes: { view: RopeView; a: Member; b: Member; length: number; points: THREE.Vector3[] }[] = [];
  private snapshots: Snapshot[] = [];
  /** local clock − server clock (smallest seen), to line up the two clocks. */
  private clockOffset: number | null = null;
  /** Race time in seconds as drawn right now (negative during the countdown), or null before the first snapshot. */
  raceTime: number | null = null;
  /** Each team's [last checkpoint, finish time or −1], and the best time so far (−1 = none). */
  teamProgress: [number, number][] = [];
  bestTime = -1;
  /** Called when something happens (a punch lands, a checkpoint…), at the moment you see it. */
  onEvent: (event: SnapEvent) => void = () => {};
  private queuedEvents: { t: number; event: SnapEvent }[] = [];

  constructor(
    private scene: THREE.Scene,
    /** A physics world with only the floors in it, used to find the ground under things. */
    private floors: GameWorld,
    start: StartMessage,
  ) {
    for (const info of start.players) {
      const view = new BlockyCharacter(info.color, { hat: info.hat, name: info.name, belt: true });
      view.root.visible = false; // until the first snapshot says where they are
      view.shadow.visible = false;
      scene.add(view.root, view.shadow);
      this.members.set(info.id, { info, view, shown: new THREE.Vector3(), state: null });
    }
    for (const [a, b, length] of start.ropes) {
      const ma = this.members.get(a);
      const mb = this.members.get(b);
      if (!ma || !mb) continue;
      const view = new RopeView(length);
      view.group.visible = false;
      scene.add(view.group);
      this.ropes.push({ view, a: ma, b: mb, length, points: [] });
    }
  }

  dispose() {
    for (const member of this.members.values()) member.view.dispose();
    for (const rope of this.ropes) rope.view.dispose();
    this.members.clear();
    this.ropes = [];
  }

  /** How bumpy the connection is: average lateness of snapshots (ms), and the delay we use. */
  private jitter = 0;
  private lastArrival: number | null = null;
  private delay = 100;

  addSnapshot(snapshot: Snapshot) {
    const now = performance.now();
    if (this.lastArrival !== null) {
      // How much later (or earlier) than expected did this one arrive? Keep a smooth average.
      const lateness = Math.abs(now - this.lastArrival - SNAPSHOT_GAP);
      this.jitter += (lateness - this.jitter) * (lateness > this.jitter ? 0.2 : 0.02);
    }
    this.lastArrival = now;
    for (const event of snapshot.ev ?? []) this.queuedEvents.push({ t: snapshot.t, event });
    const offset = now - snapshot.t;
    // The smallest offset is the one with the least network delay. Let it creep up slowly
    // too, in case the two clocks drift apart.
    this.clockOffset = this.clockOffset === null ? offset : Math.min(this.clockOffset + 0.02, offset);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
  }

  /** Is somebody tied to me hanging off an edge (so I could pull them up)? Drives the Pull button. */
  needsHelp(myId: string | null) {
    const me = myId ? this.members.get(myId)?.state : null;
    if (!me || me.hanging || !me.grounded) return false;
    return this.ropes.some((rope) => {
      const other = rope.a.info.id === myId ? rope.b : rope.b.info.id === myId ? rope.a : null;
      return !!other?.state?.hanging;
    });
  }

  private readonly tagSpot = new THREE.Vector3();

  /**
   * Name tags that are easy on the eyes: a bit smaller and see-through when the camera is close
   * (so they don't cover the character), and a bit bigger when someone is far away (so you can
   * still read them).
   */
  updateTags(camera: THREE.Camera) {
    for (const { view } of this.members.values()) {
      const tag = view.tag;
      const base = tag?.userData.baseSize as { width: number; height: number } | undefined;
      if (!tag || !base) continue;
      tag.getWorldPosition(this.tagSpot);
      const distance = camera.position.distanceTo(this.tagSpot);
      const size = distance < 10 ? 0.6 + 0.4 * (distance / 10) : Math.min(2.2, Math.max(1, distance / 16));
      tag.scale.set(base.width * size, base.height * size, 1);
      tag.material.opacity = Math.min(1, Math.max(0.35, (distance - 2) / 5));
    }
  }

  /** Where a player is drawn right now (feet), or null if we don't know yet. */
  positionOf(id: string) {
    const member = this.members.get(id);
    return member?.state ? member.shown : null;
  }

  update(dt: number) {
    if (this.clockOffset === null || this.snapshots.length === 0) return;
    // Two snapshots' worth of time, plus room for the connection's bumps. Changes slowly, so it's not noticeable.
    const wantedDelay = Math.min(MAX_DELAY, Math.max(MIN_DELAY, SNAPSHOT_GAP * 2 + this.jitter * 3));
    this.delay += (wantedDelay - this.delay) * Math.min(1, dt * 0.5);
    const renderTime = performance.now() - this.clockOffset - this.delay;

    // Find the two snapshots around renderTime.
    let before = this.snapshots[0];
    let after = before;
    for (const snapshot of this.snapshots) {
      if (snapshot.t <= renderTime) before = snapshot;
      if (snapshot.t >= renderTime) {
        after = snapshot;
        break;
      }
      after = snapshot;
    }
    const span = after.t - before.t;
    const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - before.t) / span)) : 1;

    // The race clock slides smoothly too (moving parts use it, so they match the server exactly).
    this.raceTime = before.rt + (after.rt - before.rt) * t;
    this.teamProgress = after.tp;
    this.bestTime = after.bt;

    const beforeById = new Map(before.p.map((p) => [p[0], p]));
    for (const p1 of after.p) {
      const member = this.members.get(p1[0]);
      if (!member) continue;
      const p0 = beforeById.get(p1[0]) ?? p1;
      const teleported = Math.abs(p1[2] - p0[2]) > 5 || Math.abs(p1[3] - p0[3]) > 5 || Math.abs(p1[1] - p0[1]) > 5;
      const k = teleported ? 1 : t;
      const lerp = (i: 1 | 2 | 3 | 4 | 5 | 6) => p0[i] + (p1[i] - p0[i]) * k;
      const flags = (k < 0.5 ? p0 : p1)[8];
      const state: PlayerState = {
        x: lerp(1),
        y: lerp(2),
        z: lerp(3),
        vx: lerp(4),
        vy: lerp(5),
        vz: lerp(6),
        facing: p1[7],
        grounded: (flags & FLAG_GROUNDED) !== 0,
        stunned: (flags & FLAG_STUNNED) !== 0,
        hanging: (flags & FLAG_HANGING) !== 0,
        // The action and how far along it is (keeps counting smoothly between snapshots).
        action: ACTION_FROM_CODE[p1[9]] ?? null,
        actionTime: Math.max(0, p1[10] - (1 - k) * (span / 1000)),
      };
      member.state = state;
      member.shown.set(state.x, state.y, state.z);
      member.view.root.visible = true;
      member.view.update(dt, state, this.floors.distanceToFloor(state.x, state.y + 0.1, state.z));
    }

    // Ropes: the links between the players slide smoothly between snapshots too.
    // The two ends are knots on the players' belts.
    this.ropes.forEach((rope, i) => {
      if (!rope.a.state || !rope.b.state) return;
      const r0 = before.r[i];
      const r1 = after.r[i];
      if (!r1) return;
      const links = (r1.length - 1) / 3;
      // If the rope jumped far (a respawn), don't slide — just show where it is now.
      const jumped = !r0 || r0.length !== r1.length || Math.abs(r0[1] - r1[1]) + Math.abs(r0[3] - r1[3]) > 5;
      const k = jumped ? 1 : t;
      while (rope.points.length < links + 2) rope.points.push(new THREE.Vector3());
      rope.points.length = links + 2;
      for (let j = 0; j < links; j++) {
        const at = 1 + j * 3;
        const from = jumped ? r1 : r0;
        rope.points[j + 1].set(
          from[at] + (r1[at] - from[at]) * k,
          from[at + 1] + (r1[at + 1] - from[at + 1]) * k,
          from[at + 2] + (r1[at + 2] - from[at + 2]) * k,
        );
      }
      rope.a.view.knotPoint(rope.points[1] ?? rope.b.shown, rope.points[0]);
      rope.b.view.knotPoint(rope.points[links] ?? rope.a.shown, rope.points[links + 1]);
      rope.view.group.visible = true;
      rope.view.update(rope.points);
    });

    // Play events once the moment they happened is on screen.
    while (this.queuedEvents.length && this.queuedEvents[0].t <= renderTime) this.onEvent(this.queuedEvents.shift()!.event);

    // Throw away snapshots we'll never need again.
    while (this.snapshots.length > 2 && this.snapshots[1].t < renderTime) this.snapshots.shift();
  }
}
