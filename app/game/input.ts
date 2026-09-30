/**
 * Keyboard + gamepad input mapped to game actions.
 *
 * Offense: shoot (J / A), juke (K / X), trick (L / Y), lob (U / B),
 *          special (Space / RB), turbo (Shift / RT)
 * Defense: jump/block (J / A), steal (K / X)
 *
 * Two players on one keyboard ("p1" / "p2" schemes):
 *   P1: WASD move · J shoot · K juke · L trick · U lob · Space special · Left Shift turbo · gamepad 1
 *   P2: Arrows move · Numpad0 or . shoot · Numpad1 or , juke · Numpad2 or / trick ·
 *       Numpad3 or ; lob · Enter special · Right Shift turbo · gamepad 2
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

/** Second player on the same keyboard */
const KEYMAP_P2: Record<string, Action> = {
  Numpad0: "shoot",
  Period: "shoot",
  Numpad1: "juke",
  Comma: "juke",
  Numpad2: "trick",
  Slash: "trick",
  Numpad3: "lob",
  Semicolon: "lob",
  Enter: "special",
  NumpadEnter: "special",
  ShiftRight: "turbo",
  Escape: "pause",
};

/** First player when sharing the keyboard: right shift belongs to P2 */
const KEYMAP_P1: Record<string, Action> = Object.fromEntries(
  Object.entries(KEYMAP).filter(([k]) => k !== "ShiftRight"),
);

export type InputScheme = "all" | "p1" | "p2";

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

  private keymap: Record<string, Action>;
  private moveKeys: { left: string[]; right: string[]; up: string[]; down: string[] };

  constructor(
    private target: Window = window,
    private scheme: InputScheme = "all",
  ) {
    this.keymap = scheme === "p1" ? KEYMAP_P1 : scheme === "p2" ? KEYMAP_P2 : KEYMAP;
    this.moveKeys =
      scheme === "p1"
        ? { left: ["KeyA"], right: ["KeyD"], up: ["KeyW"], down: ["KeyS"] }
        : scheme === "p2"
          ? { left: ["ArrowLeft"], right: ["ArrowRight"], up: ["ArrowUp"], down: ["ArrowDown"] }
          : {
              left: ["KeyA", "ArrowLeft"],
              right: ["KeyD", "ArrowRight"],
              up: ["KeyW", "ArrowUp"],
              down: ["KeyS", "ArrowDown"],
            };
    target.addEventListener("keydown", this.onDown);
    target.addEventListener("keyup", this.onUp);
    target.addEventListener("blur", this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.usingPad = false;
    this.down.add(e.code);
    const a = this.keymap[e.code];
    if (a) {
      this.pressed.add(a);
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Slash") e.preventDefault();
    }
  };

  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
    const a = this.keymap[e.code];
    if (a) this.released.add(a);
  };

  private onBlur = () => {
    for (const code of this.down) {
      const a = this.keymap[code];
      if (a) this.released.add(a);
    }
    this.down.clear();
  };

  /** Call once per frame before reading */
  poll() {
    this.held.clear();
    for (const code of this.down) {
      const a = this.keymap[code];
      if (a) this.held.add(a);
    }
    let x = 0;
    let z = 0;
    const any = (keys: string[]) => keys.some((k) => this.down.has(k));
    if (any(this.moveKeys.left)) x -= 1;
    if (any(this.moveKeys.right)) x += 1;
    if (any(this.moveKeys.up)) z -= 1;
    if (any(this.moveKeys.down)) z += 1;

    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const now = new Set<Action>();
    for (const pad of pads) {
      if (!pad) continue;
      // Split schemes each own one gamepad
      if (this.scheme === "p1" && pad.index !== 0) continue;
      if (this.scheme === "p2" && pad.index !== 1) continue;
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

  /** Snapshot this frame as a gameplay intent */
  intent() {
    return {
      moveX: this.moveX,
      moveZ: this.moveZ,
      turbo: this.isHeld("turbo"),
      shootPress: this.wasPressed("shoot"),
      shootHeld: this.isHeld("shoot"),
      shootRelease: this.wasReleased("shoot"),
      juke: this.wasPressed("juke"),
      trick: this.wasPressed("trick"),
      lob: this.wasPressed("lob"),
      special: this.wasPressed("special"),
    };
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
