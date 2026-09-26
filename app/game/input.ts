/**
 * Keyboard + gamepad input mapped to game actions.
 *
 * Offense: shoot (J / A), juke (K / X), trick (L / Y), lob (U / B),
 *          special (Space / RB), turbo (Shift / RT)
 * Defense: jump/block (J / A), steal (K / X)
 */
export type Action = "shoot" | "juke" | "trick" | "lob" | "special" | "turbo" | "pause";

const KEYMAP: Record<string, Action> = {
  KeyJ: "shoot",
  KeyK: "juke",
  KeyL: "trick",
  KeyU: "lob",
  Space: "special",
  ShiftLeft: "turbo",
  ShiftRight: "turbo",
  Escape: "pause",
  KeyP: "pause",
};

const PAD: Partial<Record<number, Action>> = {
  0: "shoot",
  2: "juke",
  3: "trick",
  1: "lob",
  5: "special",
  7: "turbo",
  6: "turbo",
  9: "pause",
};

export class Input {
  private down = new Set<string>();
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private padPrev = new Set<Action>();
  moveX = 0;
  moveZ = 0;
  usingPad = false;

  constructor(private target: Window = window) {
    target.addEventListener("keydown", this.onDown);
    target.addEventListener("keyup", this.onUp);
    target.addEventListener("blur", this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.usingPad = false;
    this.down.add(e.code);
    const a = KEYMAP[e.code];
    if (a) {
      this.pressed.add(a);
      if (e.code === "Space") e.preventDefault();
    }
  };

  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
    const a = KEYMAP[e.code];
    if (a) this.released.add(a);
  };

  private onBlur = () => {
    for (const code of this.down) {
      const a = KEYMAP[code];
      if (a) this.released.add(a);
    }
    this.down.clear();
  };

  /** Call once per frame before reading */
  poll() {
    this.held.clear();
    for (const code of this.down) {
      const a = KEYMAP[code];
      if (a) this.held.add(a);
    }
    let x = 0;
    let z = 0;
    if (this.down.has("KeyA") || this.down.has("ArrowLeft")) x -= 1;
    if (this.down.has("KeyD") || this.down.has("ArrowRight")) x += 1;
    if (this.down.has("KeyW") || this.down.has("ArrowUp")) z -= 1;
    if (this.down.has("KeyS") || this.down.has("ArrowDown")) z += 1;

    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set<Action>();
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0;
      const az = pad.axes[1] ?? 0;
      if (Math.hypot(ax, az) > 0.2) {
        x = ax;
        z = az;
        this.usingPad = true;
      }
      pad.buttons.forEach((b, i) => {
        const a = PAD[i];
        if (a && (b.pressed || b.value > 0.4)) {
          now.add(a);
          this.usingPad = true;
        }
      });
      if (pad.buttons[12]?.pressed) z = -1;
      if (pad.buttons[13]?.pressed) z = 1;
      if (pad.buttons[14]?.pressed) x = -1;
      if (pad.buttons[15]?.pressed) x = 1;
    }
    for (const a of now) {
      this.held.add(a);
      if (!this.padPrev.has(a)) this.pressed.add(a);
    }
    for (const a of this.padPrev) if (!now.has(a)) this.released.add(a);
    this.padPrev = now;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.moveX = x;
    this.moveZ = z;
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }
  wasPressed(a: Action) {
    return this.pressed.has(a);
  }
  wasReleased(a: Action) {
    return this.released.has(a);
  }
  /** Call at end of frame */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
  }

  rumble(strength = 0.6, ms = 120) {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      const act = (p as Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => void } })
        ?.vibrationActuator;
      act?.playEffect?.("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength });
    }
  }

  dispose() {
    this.target.removeEventListener("keydown", this.onDown);
    this.target.removeEventListener("keyup", this.onUp);
    this.target.removeEventListener("blur", this.onBlur);
  }
}
