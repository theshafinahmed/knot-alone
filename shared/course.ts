// The course layout 🗺️. Both the physics (solid floors) and the drawing (bricks)
// are built from this one list, so they always match.

export const COLORS = {
  red: 0xe63946,
  yellow: 0xffc300,
  blue: 0x2a9df4,
  green: 0x52b788,
  orange: 0xf77f00,
  purple: 0x9d4edd,
  white: 0xf1f1f1,
};

export interface BrickDef {
  /** Center of the brick's TOP surface (where you stand). */
  x: number;
  y: number;
  z: number;
  /** Size in studs (1 stud = 1 meter). */
  width: number;
  depth: number;
  /** Thickness in meters. */
  height?: number;
  color: number;
}

export interface CourseDef {
  spawn: { x: number; y: number; z: number };
  /** Fall below this height and you go back to the spawn. */
  fallLimit: number;
  bricks: BrickDef[];
}

export const BRICK_HEIGHT = 1.2;

/** A small test playground for Step 2: walk, jump gaps, climb steps. */
export const TEST_COURSE: CourseDef = {
  // Players line up backwards (+z) from here, so there's room for 6 on the start platform.
  spawn: { x: 0, y: 1, z: -5 },
  fallLimit: -40,
  bricks: [
    // Starting area
    { x: 0, y: 0, z: 0, width: 10, depth: 16, color: COLORS.red },
    { x: -3, y: 1.2, z: -4, width: 2, depth: 4, color: COLORS.yellow },
    { x: 3, y: 1.2, z: 5, width: 2, depth: 2, color: COLORS.yellow },

    // Thin bridge
    { x: 0, y: 0, z: -14, width: 2, depth: 12, color: COLORS.blue },

    // Small gap jump
    { x: 0, y: 0, z: -25, width: 6, depth: 6, color: COLORS.green },

    // Steps going up
    { x: 0, y: 1.2, z: -31, width: 4, depth: 4, color: COLORS.yellow },
    { x: 0, y: 2.4, z: -37, width: 4, depth: 4, color: COLORS.orange },

    // Top platform
    { x: 0, y: 2.4, z: -46, width: 8, depth: 8, color: COLORS.purple },
  ],
};
