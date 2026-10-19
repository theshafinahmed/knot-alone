// Every course the game knows 🗺️, by short name. The server picks one (`--course=lab`, `--course=gallery`) and tells the page.

import type { CourseDef } from './course';
import { LAB_COURSE } from './lab-course';
import { GALLERY_COURSE } from './rooms';
import { SKY_COURSE } from './sky-course';

export const COURSES: Record<string, CourseDef> = {
  sky: SKY_COURSE,
  lab: LAB_COURSE,
  gallery: GALLERY_COURSE,
};

export const DEFAULT_COURSE = 'sky';

/** Where the page asks the server which course is on. */
export const COURSE_PATH = '/course';
