// Rope modes 🪢: how the host ties everyone together.

export const ROPE_MODES = ['chain', 'teams3', 'teams2'] as const;
export type RopeMode = (typeof ROPE_MODES)[number];

export const MODE_LABEL: Record<RopeMode, string> = {
  chain: '⛓️ One big chain',
  teams3: '👥 Teams of 3',
  teams2: '👫 Teams of 2',
};

const TEAM_SIZE: Record<RopeMode, number> = { chain: 0, teams3: 3, teams2: 2 };

export const MAX_PLAYERS = 6;

export function isRopeMode(value: unknown): value is RopeMode {
  return typeof value === 'string' && (ROPE_MODES as readonly string[]).includes(value);
}

/** Can this many players (people + bots) play in this mode? Teams need at least 2 full teams. */
export function modeFits(mode: RopeMode, count: number) {
  if (mode === 'chain') return count >= 1;
  const size = TEAM_SIZE[mode];
  return count % size === 0 && count >= size * 2;
}

/**
 * Splits players into teams. People are spread across teams first (so no team is only bots),
 * then bots fill the gaps. Inside a team, people come before bots.
 */
export function splitTeams(people: string[], bots: string[], mode: RopeMode): string[][] {
  const all = [...people, ...bots];
  if (mode === 'chain' || !modeFits(mode, all.length)) return [all];

  const teamCount = all.length / TEAM_SIZE[mode];
  const teams: string[][] = Array.from({ length: teamCount }, () => []);
  people.forEach((id, i) => teams[i % teamCount].push(id));
  let next = 0;
  for (const bot of bots) {
    while (teams[next].length >= TEAM_SIZE[mode]) next++;
    teams[next].push(bot);
  }
  return teams;
}
