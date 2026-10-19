// Sounds 🔊 — all made by a tiny synthesizer in code (no sound files to download).
// Browsers only allow sound after the first tap or key press, so we wake the audio up then.

type Wave = OscillatorType;

class Sounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('knot.muted') === '1';
    } catch {
      // storage blocked — sound stays on
    }
    const wake = () => this.wake();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem('knot.muted', muted ? '1' : '0');
    } catch {
      // storage blocked — fine
    }
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  private wake() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** One note that slides from `from` Hz to `to` Hz. */
  private tone(from: number, to: number, duration: number, wave: Wave = 'sine', volume = 0.4, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A short burst of noise (for thumps and whooshes). */
  private noise(duration: number, volume = 0.4, lowpass = 1200, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const start = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
  }

  jump() {
    this.tone(320, 620, 0.16, 'square', 0.12);
  }

  punchSwing() {
    this.noise(0.12, 0.15, 2500);
  }

  hit() {
    this.noise(0.18, 0.5, 700);
    this.tone(160, 60, 0.18, 'sine', 0.5);
  }

  countdownBeep() {
    this.tone(520, 520, 0.18, 'square', 0.15);
  }

  go() {
    this.tone(880, 880, 0.4, 'square', 0.18);
  }

  checkpoint() {
    this.tone(660, 660, 0.15, 'triangle', 0.35);
    this.tone(990, 990, 0.3, 'triangle', 0.35, 0.12);
  }

  finish() {
    [523, 659, 784, 1047].forEach((note, i) => this.tone(note, note, 0.35, 'triangle', 0.35, i * 0.13));
    this.tone(1047, 1047, 0.9, 'triangle', 0.3, 0.55);
  }

  fall() {
    this.tone(900, 180, 0.7, 'sine', 0.25);
  }

  /** 🦘 A springy trampoline bounce. */
  boing() {
    this.tone(150, 520, 0.28, 'sine', 0.3);
    this.tone(300, 1040, 0.2, 'triangle', 0.08);
  }

  emote() {
    this.tone(700, 1000, 0.12, 'sine', 0.15);
  }
}

export const sounds = new Sounds();
