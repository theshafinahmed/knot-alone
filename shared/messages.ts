// The shapes of messages sent between the server (the boss) and the game pages.

import type { ActionKind } from './actions';
import type { CourseChoice, CourseSpec } from './courses';
import type { Difficulty, WorldLength } from './rooms/world-maker';
import type { Hat } from './looks';
import type { RopeMode } from './teams';

export interface LobbyPlayer {
  id: string;
  name: string;
  color: number;
  hat: Hat;
  host: boolean;
  bot: boolean;
  /** False when a person's phone lost connection (they can come back). */
  online: boolean;
}

export type Phase = 'lobby' | 'playing';

export interface Invite {
  url: string;
  anywhere: boolean;
}

/**
 * One player in a snapshot, as a short array to keep messages small:
 * [id, x, y, z, vx, vy, vz, facing, flags, action, actionTime]
 * flags: 1 = grounded, 2 = stunned, 4 = hanging. action: 0 = none, else ACTION_CODE (see actions.ts).
 */
export type SnapPlayer = [string, number, number, number, number, number, number, number, number, number, number];
export const FLAG_GROUNDED = 1;
export const FLAG_STUNNED = 2;
export const FLAG_HANGING = 4;

/**
 * One rope in a snapshot: [current length, x1, y1, z1, x2, y2, z2, …] — the rope's links between
 * the two players (the two ends are tied to the players, so they aren't sent).
 */
export type SnapRope = number[];

/**
 * Something that just happened, for sounds and confetti:
 * ['hit', x, y, z] a punch landed · ['boing', x, y, z] a trampoline bounce · ['cp', team, checkpoint] · ['fin', team] · ['fall', team]
 */
export type SnapEvent =
  | ['hit', number, number, number]
  | ['boing', number, number, number]
  | ['cp', number, number]
  | ['fin', number]
  | ['fall', number];

/** Game page → server */
export type ClientMessage =
  /** Join the game (or change your look). The token lets you come back after a dropped connection. */
  | { type: 'join'; token: string; name: string; color: number; hat: Hat }
  /** What your controls are doing. `jumps` counts every jump press ever, so none get lost. `pull` = holding the pull button. */
  | { type: 'input'; x: number; z: number; jumps: number; pull?: boolean }
  /** Do a fun action: wave, punch, dance or cheer. */
  | { type: 'action'; action: ActionKind }
  /** Host only: change the rope mode, the number of bots, or the course (🎲 random + difficulty + length). */
  | { type: 'setup'; mode?: RopeMode; bots?: number; course?: string; difficulty?: Difficulty; length?: WorldLength }
  /** Host only. */
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'backToLobby' };

/** Server → game page */
export type ServerMessage =
  | { type: 'welcome'; id: string }
  | { type: 'full' }
  /** The lobby. `invite` is the link friends can open (`anywhere` = works outside this Wi-Fi too). */
  | {
      type: 'lobby';
      phase: Phase;
      players: LobbyPlayer[];
      mode: RopeMode;
      bots: number;
      invite: Invite | null;
      /** The course the host picked (and the choices there are). */
      course: CourseChoice;
      courses: string[];
    }
  /** A game started: everyone in it (bots too), the teams, the ropes [a, b, length], and which course (or random world). */
  | { type: 'start'; players: LobbyPlayer[]; teams: string[][]; ropes: [string, string, number][]; course: CourseSpec }
  /**
   * Where everything is right now. `t` is the server's clock in milliseconds.
   * `rt` = race time in seconds (negative during the countdown). `tp` = each team's
   * [last checkpoint, finish time or −1]. `bt` = best finish time so far, or −1.
   */
  | {
      type: 'snap';
      t: number;
      p: SnapPlayer[];
      r: SnapRope[];
      rt: number;
      tp: [number, number][];
      bt: number;
      /** Things that happened since the last snapshot (only sent when there are some). */
      ev?: SnapEvent[];
    };
