// Every course the game knows 🗺️. The server picks one (`--course=lab`, `--course=gallery`,
// `--course=random`) and tells the page which one — for a random world, just the seed and settings,
// and the page builds the very same world itself.

import type { CourseDef } from './course';
import { LAB_COURSE } from './lab-course';
import { GALLERY_COURSE } from './rooms';
import { makeWorld, type Difficulty, type WorldLength } from './rooms/world-maker';
import { SKY_COURSE } from './sky-course';

/** The hand-made courses, by short name. */
export const COURSES: Record<string, CourseDef> = {
  sky: SKY_COURSE,
  lab: LAB_COURSE,
  gallery: GALLERY_COURSE,
};

export const DEFAULT_COURSE = 'sky';

/** Which course is on: a hand-made one by name, or a random world (seed + settings). */
export type CourseSpec =
  | { id: string }
  | { id: 'random'; seed: number; difficulty: Difficulty; length: WorldLength };

/** Builds (or looks up) the course a spec describes. Unknown names → the Sky Course. */
export function courseFromSpec(spec: CourseSpec): CourseDef {
  if ('seed' in spec) return makeWorld(spec);
  return COURSES[spec.id] ?? COURSES[DEFAULT_COURSE];
}

/** Do two specs mean the same course? */
export function sameCourse(a: CourseSpec, b: CourseSpec) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What the host picked in the lobby: a course name (`sky`, or `lab` / `gallery` for testing) or
 * `random`, plus the random-world settings (kept even when a hand-made course is picked).
 */
export interface CourseChoice {
  id: string;
  difficulty: Difficulty;
  length: WorldLength;
}

/** Where the page asks the server which course is on. */
export const COURSE_PATH = '/course';
