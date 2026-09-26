/**
 * All sound is synthesized with WebAudio: no licensed samples, so it's safe
 * to ship on Steam. Includes a small boom-bap sequencer for match music.
 */
export type Sfx =
  | "bounce"
  | "rim"
  | "swish"
  | "board"
  | "squeak"
  | "whistle"
  | "buzzer"
  | "cheer"
  | "ooh"
  | "click"
  | "confirm"
  | "slam"
  | "block"
  | "zap"
  | "whoosh";

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private crowdGain!: GainNode;
  private noise!: AudioBuffer;
  private seqTimer = 0;
  private nextNote = 0;
  private step = 0;
  private bpm = 90;
  private root = 45;
  private mood = "chill";
  private settings: AudioSettings = { master: 0.8, music: 0.5, sfx: 0.8 };

  /** Must be called from a user gesture */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applySettings(this.settings);
  }

  applySettings(s: AudioSettings) {
    this.settings = s;
    if (!this.ctx) return;
    this.master.gain.value = s.master;
    this.sfxBus.gain.value = s.sfx;
    this.musicBus.gain.value = s.music * 0.55;
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(
    freq: number,
    type: OscillatorType,
    t: number,
    a: number,
    peak: number,
    d: number,
    bus: AudioNode,
    glideTo?: number,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + a + d);
    this.env(g, t, a, peak, d);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  private burst(
    t: number,
    dur: number,
    peak: number,
    filter: BiquadFilterType,
    freq: number,
    q: number,
    bus: AudioNode,
    a = 0.003,
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, a, peak, dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random());
    src.stop(t + a + dur + 0.05);
  }

  play(s: Sfx, strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const b = this.sfxBus;
    switch (s) {
      case "bounce":
        this.tone(120, "sine", t, 0.002, 0.7 * strength, 0.14, b, 55);
        this.burst(t, 0.03, 0.15 * strength, "bandpass", 900, 1, b);
        break;
      case "rim":
        for (const [f, p] of [
          [620, 0.25],
          [1340, 0.18],
          [2130, 0.12],
          [3310, 0.06],
        ])
          this.tone(f * (0.97 + Math.random() * 0.06), "triangle", t, 0.001, p * strength, 0.35, b);
        break;
      case "swish":
        this.burst(t, 0.28, 0.35, "bandpass", 3200, 0.8, b, 0.02);
        break;
      case "board":
        this.tone(180, "square", t, 0.001, 0.12, 0.08, b, 90);
        this.burst(t, 0.1, 0.3, "lowpass", 1200, 1, b);
        break;
      case "squeak":
        this.tone(1900 + Math.random() * 500, "sine", t, 0.005, 0.05 * strength, 0.06, b, 2600);
        break;
      case "whistle":
        this.tone(2400, "sine", t, 0.01, 0.2, 0.35, b, 2450);
        break;
      case "buzzer":
        this.tone(220, "sawtooth", t, 0.01, 0.2, 0.9, b);
        this.tone(223, "square", t, 0.01, 0.12, 0.9, b);
        break;
      case "cheer":
        this.burst(t, 1.6 * strength, 0.4 * strength, "bandpass", 1100, 0.6, b, 0.15);
        this.burst(t + 0.05, 1.3 * strength, 0.25 * strength, "bandpass", 2400, 0.8, b, 0.2);
        break;
      case "ooh":
        this.burst(t, 0.9, 0.25, "bandpass", 450, 3, b, 0.2);
        break;
      case "click":
        this.tone(900, "square", t, 0.001, 0.05, 0.04, b);
        break;
      case "confirm":
        this.tone(660, "triangle", t, 0.005, 0.12, 0.12, b);
        this.tone(990, "triangle", t + 0.07, 0.005, 0.12, 0.18, b);
        break;
      case "slam":
        this.tone(90, "sine", t, 0.002, 0.9, 0.35, b, 40);
        this.burst(t, 0.25, 0.5, "lowpass", 700, 1, b);
        this.tone(520, "triangle", t, 0.001, 0.2, 0.5, b);
        break;
      case "block":
        this.tone(140, "square", t, 0.002, 0.25, 0.12, b, 70);
        this.burst(t, 0.12, 0.4, "highpass", 1500, 1, b);
        break;
      case "zap":
        this.tone(1800, "sawtooth", t, 0.002, 0.18, 0.25, b, 90);
        this.burst(t, 0.4, 0.3, "highpass", 3000, 1, b);
        break;
      case "whoosh":
        this.burst(t, 0.35, 0.25, "bandpass", 700, 1.5, b, 0.08);
        break;
    }
  }

  /** Continuous crowd bed; level 0..1 */
  startCrowd() {
    if (!this.ctx || this.crowdGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 800;
    f.Q.value = 0.5;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.02;
    src.connect(f).connect(this.crowdGain).connect(this.sfxBus);
    src.start();
  }

  setCrowd(level: number) {
    if (!this.ctx || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(0.015 + level * 0.09, this.ctx.currentTime, 0.3);
  }

  startMusic(bpm: number, root: number, mood: string) {
    if (!this.ctx) return;
    this.stopMusic();
    this.bpm = bpm;
    this.root = root;
    this.mood = mood;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.seqTimer) window.clearInterval(this.seqTimer);
    this.seqTimer = 0;
  }

  private midi(n: number) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  private schedule() {
    if (!this.ctx) return;
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNote);
      // Swing on the off-sixteenths
      this.nextNote += sixteenth * (this.step % 2 === 0 ? 1.12 : 0.88);
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(s: number, t: number) {
    const b = this.musicBus;
    const inBar = s % 16;
    const bar = Math.floor(s / 16);
    // Drums
    const kick = [0, 7, 10].includes(inBar) || (bar === 3 && inBar === 14);
    if (kick) this.tone(110, "sine", t, 0.002, 0.9, 0.25, b, 42);
    if (inBar === 4 || inBar === 12) {
      this.burst(t, 0.16, 0.45, "bandpass", 1800, 0.7, b);
      this.tone(190, "triangle", t, 0.001, 0.25, 0.08, b, 140);
    }
    if (inBar % 2 === 0 || (this.mood === "epic" && inBar % 4 === 3))
      this.burst(t, 0.03, inBar % 4 === 2 ? 0.14 : 0.08, "highpass", 8000, 1, b);
    // Progression (minor): i - VI - iv - v
    const prog = [0, -4, 5, 7][bar];
    const r = this.root + prog;
    // Bass
    if ([0, 3, 7, 10].includes(inBar)) this.tone(this.midi(r - 12), "sine", t, 0.01, 0.35, 0.3, b);
    // Chord stabs
    if (inBar === 0 || (this.mood !== "chill" && inBar === 10)) {
      for (const iv of [0, 3, 7, 10]) {
        this.tone(this.midi(r + 12 + iv), this.mood === "epic" ? "sawtooth" : "triangle", t, 0.02, 0.045, 0.7, b);
      }
    }
    // Melody sprinkles
    if (this.mood !== "grimy" && (inBar === 6 || inBar === 14) && Math.random() < 0.7) {
      const scale = [0, 3, 5, 7, 10, 12];
      const n = r + 24 + scale[Math.floor(Math.random() * scale.length)];
      this.tone(this.midi(n), "sine", t, 0.005, 0.06, 0.35, b);
    }
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** One shared instance for menus + matches */
let shared: GameAudio | null = null;
export function getAudio() {
  shared ??= new GameAudio();
  return shared;
}
