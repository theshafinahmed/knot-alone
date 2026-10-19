// Robot buddies 🤖 for testing the rope without real friends.
// Each bot follows the trail of the player in front of it in the chain,
// jumps where they jumped, stops at cliffs, and tries to pull them back up if they fall.
// They're a little clumsy on purpose.

import { GameWorld, ROPE, type PlayerInput, type PlayerState, NO_INPUT } from './world';

/** How far behind the leader's trail the bot walks (in ticks; 20 ticks = 1/3 second). */
const TRAIL_DELAY = 20;
/** Chance the bot "forgets" to jump when it should. */
const CLUMSY = 0.12;
/** Bots stop this close to the leader (if on the same level). */
const PERSONAL_SPACE = 2.4;

export type BotMode = 'follow' | 'lazy';

export class BotBrain {
  private trail: PlayerState[] = [];
  private jumpDecision: boolean | null = null;
  /** Ticks since the leader was last hanging (their climbing isn't a jump to copy). */
  private sinceLeaderHung = 999;

  constructor(
    readonly id: string,
    readonly leaderId: string,
  ) {}

  think(world: GameWorld, mode: BotMode): PlayerInput {
    const me = world.getState(this.id);
    const leader = world.getState(this.leaderId);
    if (!me || !leader) return NO_INPUT;

    this.trail.push(leader);
    if (this.trail.length > TRAIL_DELAY) this.trail.shift();
    this.sinceLeaderHung = leader.hanging ? 0 : this.sinceLeaderHung + 1;

    if (mode === 'lazy') return { ...NO_INPUT, limp: true };
    if (me.stunned) return NO_INPUT;

    // 🧗 Dangling from the rope → tap jump to climb up (not perfectly in rhythm).
    if (me.hanging) return { x: 0, z: 0, jump: Math.random() < 0.12 };

    // 🆘 Leader is hanging off an edge below me → plant your feet and pull them up.
    const toLeaderX = leader.x - me.x;
    const toLeaderZ = leader.z - me.z;
    const flatToLeader = Math.hypot(toLeaderX, toLeaderZ);
    if (me.grounded && leader.hanging && leader.y < me.y - 0.3) {
      // Plant your feet and pull the rope in, hand over hand.
      return { x: 0, z: 0, jump: false, pull: true };
    }

    // Walk to where the leader was a moment ago, but give them some personal space.
    const target = this.trail[0];
    const dx = target.x - me.x;
    const dz = target.z - me.z;
    const distance = Math.hypot(dx, dz);
    const closeToLeader = flatToLeader < PERSONAL_SPACE && Math.abs(leader.y - me.y) < 1;
    if (distance < 1.2 || closeToLeader) {
      this.jumpDecision = null;
      return NO_INPUT;
    }

    const dirX = dx / distance;
    const dirZ = dz / distance;
    const push = Math.min(1, distance / 2);

    // Don't walk off a cliff unless the leader jumped across it (then jump too).
    const aheadFloor = world.distanceToFloor(me.x + dirX * 1.2, me.y + 0.5, me.z + dirZ * 1.2, 4);
    const cliffAhead = aheadFloor === null;
    const leaderJumpedHere = !target.grounded && target.vy > 0 && this.sinceLeaderHung > TRAIL_DELAY * 3;
    const stepUp = target.grounded && target.y > me.y + 0.4 && distance < 3;
    const wantsJump = me.grounded && (stepUp || leaderJumpedHere || (cliffAhead && leader.grounded));

    if (cliffAhead && !wantsJump && distance < ROPE.length) return NO_INPUT;

    // Decide once per jump chance whether we mess it up.
    let jump = false;
    if (wantsJump) {
      if (this.jumpDecision === null) this.jumpDecision = Math.random() > CLUMSY;
      jump = this.jumpDecision;
    } else {
      this.jumpDecision = null;
    }

    return { x: dirX * push, z: dirZ * push, jump };
  }
}
