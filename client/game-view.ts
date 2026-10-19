// Draws the game the server (the boss) describes 🎬.
// The server sends ~30 snapshots per second. We draw everyone a tiny bit in the past
// (INTERP_DELAY) and slide smoothly between two snapshots, so movement looks smooth
// even though updates arrive in little jumps.

import * as THREE from 'three';
import { BlockyCharacter } from './character';
import { RopeView } from './rope';
import {
  FLAG_GROUNDED,
  FLAG_HANGING,
  FLAG_STUNNED,
  type LobbyPlayer,
  type ServerMessage,
} from '../shared/messages';
import type { GameWorld, PlayerState } from '../shared/sim/world';

/** How far in the past we draw (ms). Bigger = smoother on bad Wi-Fi, but a bit more delay. */
const INTERP_DELAY = 100;
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
  private ropes: { view: RopeView; a: Member; b: Member; length: number }[] = [];
  private snapshots: Snapshot[] = [];
  /** local clock − server clock (smallest seen), to line up the two clocks. */
  private clockOffset: number | null = null;
  ropeStates: { current: number; bend: { x: number; y: number; z: number } | null }[] = [];

  constructor(
    private scene: THREE.Scene,
    /** A physics world with only the floors in it, used to find the ground under things. */
    private floors: GameWorld,
    start: StartMessage,
  ) {
    for (const info of start.players) {
      const view = new BlockyCharacter(info.color, { hat: info.hat, name: info.name });
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
      view.mesh.visible = false;
      scene.add(view.mesh);
      this.ropes.push({ view, a: ma, b: mb, length });
    }
  }

  dispose() {
    for (const member of this.members.values()) member.view.dispose();
    for (const rope of this.ropes) {
      rope.view.mesh.removeFromParent();
      rope.view.dispose();
    }
    this.members.clear();
    this.ropes = [];
  }

  addSnapshot(snapshot: Snapshot) {
    const offset = performance.now() - snapshot.t;
    // The smallest offset is the one with the least network delay. Let it creep up slowly
    // too, in case the two clocks drift apart.
    this.clockOffset = this.clockOffset === null ? offset : Math.min(this.clockOffset + 0.02, offset);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
  }

  /** Where a player is drawn right now (feet), or null if we don't know yet. */
  positionOf(id: string) {
    const member = this.members.get(id);
    return member?.state ? member.shown : null;
  }

  update(dt: number) {
    if (this.clockOffset === null || this.snapshots.length === 0) return;
    const renderTime = performance.now() - this.clockOffset - INTERP_DELAY;

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
      };
      member.state = state;
      member.shown.set(state.x, state.y, state.z);
      member.view.root.visible = true;
      member.view.update(dt, state, this.floors.distanceToFloor(state.x, state.y + 0.1, state.z));
    }

    this.ropeStates = after.r.map((r) => ({
      current: r[0],
      bend: r.length === 4 ? { x: r[1], y: r[2], z: r[3] } : null,
    }));
    this.ropes.forEach((rope, i) => {
      if (!rope.a.state || !rope.b.state) return;
      const { shown: a } = rope.a;
      const { shown: b } = rope.b;
      const topY = Math.max(a.y, b.y) + 1;
      const below = this.floors.distanceToFloor((a.x + b.x) / 2, topY, (a.z + b.z) / 2, 6);
      const ropeState = this.ropeStates[i];
      rope.view.mesh.visible = true;
      rope.view.update(a, b, below === null ? null : topY - below, ropeState?.current ?? rope.length, ropeState?.bend ?? null);
    });

    // Throw away snapshots we'll never need again.
    while (this.snapshots.length > 2 && this.snapshots[1].t < renderTime) this.snapshots.shift();
  }
}
