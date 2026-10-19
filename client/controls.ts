// Controls 🎮
// Phone: left thumb = joystick (appears where you touch), right side = drag to look, big button = jump.
// Computer: WASD / arrows = move, Space = jump, mouse = look (click the game first).

const JOYSTICK_RADIUS = 55;
const TOUCH_LOOK_SPEED = 0.006;
const MOUSE_LOOK_SPEED = 0.0025;
const MIN_PITCH = -0.15;
const MAX_PITCH = 1.25;

export class Controls {
  /** Camera angle around the player (radians). */
  yaw = 0;
  /** Camera angle above the player (radians). */
  pitch = 0.35;

  private keys = new Set<string>();
  private jumpQueued = false;
  private stick = { x: 0, y: 0 };
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private dragMouse = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private ui: { joystick: HTMLElement; knob: HTMLElement; jump: HTMLElement; hint: HTMLElement },
  ) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
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
    if (e.pointerType === 'mouse') {
      // Lock the mouse to the game for smooth looking. If the browser says no, drag to look instead.
      this.canvas.requestPointerLock?.()?.catch?.(() => {});
      this.dragMouse = true;
      this.lookLast = { x: e.clientX, y: e.clientY };
      return;
    }

    document.body.classList.add('touch');
    if (e.clientX < window.innerWidth / 2 && this.stickPointer === null) {
      this.stickPointer = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.ui.joystick.style.left = `${e.clientX}px`;
      this.ui.joystick.style.top = `${e.clientY}px`;
      this.ui.joystick.classList.add('active');
      this.setKnob(0, 0);
    } else if (this.lookPointer === null) {
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
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

  private setKnob(dx: number, dy: number) {
    this.ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}
