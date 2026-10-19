// Controls 🎮
// Phone: movement circle in the bottom-left corner, drag anywhere else to look, big button = jump.
// Computer: WASD / arrows = move, Space = jump, mouse = look (click the game first).
// Fun actions: phone = 👊 button + 😀 menu; computer = F or click to punch, 1 wave, 2 dance, 3 cheer.

import { isAction, type ActionKind } from '../shared/actions';

const KEY_ACTIONS: Record<string, ActionKind> = {
  KeyF: 'punch',
  Digit1: 'wave',
  Digit2: 'dance',
  Digit3: 'cheer',
};

/** Makes a round button react to a finger press (and look pressed while held). */
function pressable(button: HTMLElement, onPress: () => void) {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    button.classList.add('pressed');
    onPress();
  });
  const release = () => button.classList.remove('pressed');
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

const JOYSTICK_RADIUS = 55;
/** You can start a touch this far outside the movement circle and still grab it (pixels). */
const STICK_GRAB_MARGIN = 40;
const TOUCH_LOOK_SPEED = 0.006;
const MOUSE_LOOK_SPEED = 0.0025;
const MIN_PITCH = -0.15;
const MAX_PITCH = 1.25;

export class Controls {
  /** Camera angle around the player (radians). */
  yaw = 0;
  /** Camera angle above the player (radians). */
  pitch = 0.6; // high enough to see over the buddies behind you
  /** Controls only work during the game (not while typing your name in the lobby). */
  enabled = false;

  private keys = new Set<string>();
  private jumpQueued = false;
  private actionQueued: ActionKind | null = null;
  private stick = { x: 0, y: 0 };
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private dragMouse = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private ui: {
      joystick: HTMLElement;
      knob: HTMLElement;
      jump: HTMLElement;
      hint: HTMLElement;
      punch: HTMLElement;
      emote: HTMLElement;
      emoteMenu: HTMLElement;
      hintMove: HTMLElement;
      hintLook: HTMLElement;
    },
  ) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (!e.repeat && KEY_ACTIONS[e.code]) this.actionQueued = KEY_ACTIONS[e.code];
      if (e.code === 'Space') {
        if (!e.repeat) this.jumpQueued = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Mouse look while the pointer is locked to the game.
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) this.look(e.movementX * MOUSE_LOOK_SPEED, e.movementY * MOUSE_LOOK_SPEED);
    });
    document.addEventListener('pointerlockchange', () => {
      ui.hint.classList.toggle('hidden', document.pointerLockElement === canvas);
    });

    // 👊 Punch button, and the 😀 button that opens the fun-actions menu.
    pressable(ui.punch, () => (this.actionQueued = 'punch'));
    pressable(ui.emote, () => ui.emoteMenu.classList.toggle('hidden'));
    for (const button of ui.emoteMenu.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isAction(button.dataset.action)) this.actionQueued = button.dataset.action;
        ui.emoteMenu.classList.add('hidden');
      });
    }

    ui.jump.addEventListener('pointerdown', (e) => {
      this.jumpQueued = true;
      ui.jump.classList.add('pressed');
      e.preventDefault();
    });
    const release = () => ui.jump.classList.remove('pressed');
    ui.jump.addEventListener('pointerup', release);
    ui.jump.addEventListener('pointercancel', release);
    ui.jump.addEventListener('pointerleave', release);
  }

  /** Move direction relative to the camera: x = right, y = forward. Length 0..1. */
  getMove() {
    let x = this.stick.x;
    let y = this.stick.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  /** The fun action pressed since last time (once per press), or null. */
  consumeAction() {
    const action = this.actionQueued;
    this.actionQueued = null;
    return action;
  }

  /** True once per jump press. */
  consumeJump() {
    const jump = this.jumpQueued;
    this.jumpQueued = false;
    return jump;
  }

  private look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + dy));
  }

  private onPointerDown(e: PointerEvent) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      // Clicking while the mouse is locked to the game = punch.
      if (document.pointerLockElement === this.canvas) {
        this.actionQueued = 'punch';
        return;
      }
      // Lock the mouse to the game for smooth looking. If the browser says no, drag to look instead.
      this.canvas.requestPointerLock?.()?.catch?.(() => {});
      this.dragMouse = true;
      this.lookLast = { x: e.clientX, y: e.clientY };
      return;
    }

    document.body.classList.add('touch');
    // Touching the movement circle (or close to it) = walk. Anywhere else = turn the camera.
    const ring = this.ui.joystick.getBoundingClientRect();
    const centerX = ring.left + ring.width / 2;
    const centerY = ring.top + ring.height / 2;
    const nearRing = Math.hypot(e.clientX - centerX, e.clientY - centerY) <= ring.width / 2 + STICK_GRAB_MARGIN;
    if (nearRing && this.stickPointer === null) {
      this.stickPointer = e.pointerId;
      this.stickOrigin = { x: centerX, y: centerY };
      this.ui.joystick.classList.add('active');
      this.onPointerMove(e); // start moving right away, towards where the thumb is
      this.hideHint(this.ui.hintMove);
    } else if (this.lookPointer === null) {
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.hideHint(this.ui.hintLook);
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerId === this.stickPointer) {
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const length = Math.hypot(dx, dy);
      if (length > JOYSTICK_RADIUS) {
        dx *= JOYSTICK_RADIUS / length;
        dy *= JOYSTICK_RADIUS / length;
      }
      this.setKnob(dx, dy);
      this.stick = { x: dx / JOYSTICK_RADIUS, y: -dy / JOYSTICK_RADIUS };
    } else if (e.pointerId === this.lookPointer) {
      this.look((e.clientX - this.lookLast.x) * TOUCH_LOOK_SPEED, (e.clientY - this.lookLast.y) * TOUCH_LOOK_SPEED);
      this.lookLast = { x: e.clientX, y: e.clientY };
    } else if (e.pointerType === 'mouse' && this.dragMouse && document.pointerLockElement !== this.canvas) {
      this.look((e.clientX - this.lookLast.x) * MOUSE_LOOK_SPEED * 2, (e.clientY - this.lookLast.y) * MOUSE_LOOK_SPEED * 2);
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.stick = { x: 0, y: 0 };
      this.ui.joystick.classList.remove('active');
    } else if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
    } else if (e.pointerType === 'mouse') {
      this.dragMouse = false;
    }
  }

  private hideHint(hint: HTMLElement) {
    hint.classList.add('gone');
  }

  /** Shows the first-time hints again (each new game). They also fade by themselves after a while. */
  showHints() {
    for (const hint of [this.ui.hintMove, this.ui.hintLook]) hint.classList.remove('gone');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => {
      this.hideHint(this.ui.hintMove);
      this.hideHint(this.ui.hintLook);
    }, 12_000);
  }

  private hintTimer: number | undefined;

  private setKnob(dx: number, dy: number) {
    this.ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}
