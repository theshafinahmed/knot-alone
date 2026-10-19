// The shapes of messages sent between the server (the boss) and the game pages.

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
 * [id, x, y, z, vx, vy, vz, facing, flags]  (flags: 1 = grounded, 2 = stunned, 4 = hanging)
 */
export type SnapPlayer = [string, number, number, number, number, number, number, number, number];
export const FLAG_GROUNDED = 1;
export const FLAG_STUNNED = 2;
export const FLAG_HANGING = 4;

/** One rope in a snapshot: [current length] or [current length, bendX, bendY, bendZ]. */
export type SnapRope = [number] | [number, number, number, number];

/** Game page → server */
export type ClientMessage =
  /** Join the game (or change your look). The token lets you come back after a dropped connection. */
  | { type: 'join'; token: string; name: string; color: number; hat: Hat }
  /** What your controls are doing. `jumps` counts every jump press ever, so none get lost. */
  | { type: 'input'; x: number; z: number; jumps: number }
  /** Host only: change the rope mode or the number of bots. */
  | { type: 'setup'; mode?: RopeMode; bots?: number }
  /** Host only. */
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'backToLobby' };

/** Server → game page */
export type ServerMessage =
  | { type: 'welcome'; id: string }
  | { type: 'full' }
  /** The lobby. `invite` is the link friends can open (`anywhere` = works outside this Wi-Fi too). */
  | { type: 'lobby'; phase: Phase; players: LobbyPlayer[]; mode: RopeMode; bots: number; invite: Invite | null }
  /** A game started: everyone in it (bots too), the teams, and the ropes [a, b, length]. */
  | { type: 'start'; players: LobbyPlayer[]; teams: string[][]; ropes: [string, string, number][] }
  /** Where everything is right now. `t` is the server's clock in milliseconds. */
  | { type: 'snap'; t: number; p: SnapPlayer[]; r: SnapRope[] };
