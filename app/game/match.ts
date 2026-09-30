import * as THREE from "three";
import { AiBrain } from "./ai";
import { Ball, type BallEvent } from "./ball";
import { BALL_RADIUS, COURT, RIM_CENTER, SHOT_CLOCK, distToRim, isThreePoint } from "./constants";
import { chance, clamp, gaussian, pick, rand } from "./math";
import { Player, type Action } from "./player";
import { emptyIntent, type Callout, type Intent, type MatchConfig, type MatchResult, type Phase } from "./types";

export interface MatchHooks {
  callout(c: Omit<Callout, "id">): void;
  sfx(name: string, strength?: number): void;
  shake(amount: number): void;
  flash(amount: number): void;
  slowmo(scale: number, seconds: number): void;
  specialStart(p: Player): void;
  specialEnd(): void;
  over(result: MatchResult): void;
  rimWobble(amount: number): void;
  /** Tag Team: swap the side-0 baller at every check ball */
  tag?(): void;
}

const HYPE = {
  juke: 8,
  ankles: 22,
  fall: 34,
  trick: 10,
  dunk: 16,
  three: 12,
  perfect: 8,
  block: 20,
  steal: 15,
  lob: 22,
};

/**
 * Rules + interactions for a 1-on-1 streetball game:
 *  - loser's ball after a make; check ball at the top of the key
 *  - take it back (clear) behind the arc after a change of possession
 *  - 14 second shot clock; 2s and 3s; specials worth 3
 */
export class Match {
  phase: Phase = "intro";
  phaseT = 0;
  time = 0;
  score: [number, number] = [0, 0];
  possession: 0 | 1 = 0;
  needClear = false;
  shotClock = SHOT_CLOCK;
  ball = new Ball();
  brains: (AiBrain | null)[];
  private ballEvents: BallEvent[] = [];
  private lobBy: number | null = null;
  private deadNext: 0 | 1 = 0;
  private overFired = false;
  private squeakT = 0;
  specialOf: Player | null = null;

  constructor(
    public config: MatchConfig,
    public players: [Player, Player],
    private hooks: MatchHooks,
  ) {
    const humanSide1 = config.mode === "versus" || config.mode === "online-host" || config.mode === "online-guest";
    this.brains = players.map((p) => (config.cpuVsCpu || (p.id === 1 && !humanSide1) ? new AiBrain(p, this) : null));
    this.possession = 0;
    this.setupCheck(0);
    this.phase = "intro";
  }

  get handler(): Player | null {
    return this.players.find((p) => p.hasBall) ?? null;
  }

  private setupCheck(offense: 0 | 1) {
    const o = this.players[offense];
    const d = this.players[1 - offense];
    for (const p of this.players) {
      p.action = null;
      p.vel.set(0, 0, 0);
      p.y = 0;
      p.hasBall = false;
    }
    o.pos.set(rand(-0.5, 0.5), 0, COURT.checkZ);
    d.pos.set(o.pos.x * 0.5, 0, COURT.checkZ - 1.5);
    o.yaw = Math.PI;
    d.yaw = 0;
    o.hasBall = true;
    this.possession = offense;
    this.needClear = false;
    this.shotClock = SHOT_CLOCK;
    this.ball.state = "held";
    this.ball.holder = offense;
    this.ball.shot = null;
    this.ball.lastTouch = offense;
    this.lobBy = null;
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Main simulation step */
  update(dt: number, human: Intent, human2: Intent = emptyIntent()) {
    this.time += dt;
    this.phaseT += dt;
    const [p0, p1] = this.players;

    switch (this.phase) {
      case "intro":
        if (this.phaseT > 3.2) {
          this.setPhase("check");
          this.hooks.callout({ text: "CHECK BALL", color: "#ffffff", size: "md" });
        }
        break;
      case "check":
        if (this.phaseT > 1.4) {
          this.setPhase("live");
          this.hooks.sfx("whistle");
          this.hooks.callout({ text: "BALL UP", color: "#ffffff", size: "sm" });
        }
        break;
      case "dead":
        if (this.phaseT > 2.1) {
          const target = this.config.target;
          if (this.score[0] >= target || this.score[1] >= target) {
            this.finish();
          } else {
            this.hooks.tag?.();
            this.setupCheck(this.deadNext);
            this.setPhase("check");
            this.hooks.callout({ text: "CHECK BALL", color: "#ffffff", size: "sm" });
          }
        }
        break;
    }

    const intents: Intent[] = [
      this.brains[0] ? this.brains[0].think(dt) : human,
      this.brains[1] ? this.brains[1]!.think(dt) : human2,
    ];
    const live = this.phase === "live";

    for (const p of this.players) {
      p.jukeCd -= dt;
      p.stealCd -= dt;
      p.trickCd -= dt;
      if (p.action) p.action.t += dt;
    }

    if (live) {
      for (const p of this.players) this.applyIntent(p, intents[p.id], dt);
      this.shotClock -= dt;
      if (this.shotClock <= 0 && this.handler && !this.handler.airborne()) {
        this.hooks.sfx("buzzer");
        this.hooks.callout({ text: "SHOT CLOCK", color: "#ff5a5a", size: "md" });
        this.turnover(this.handler.id);
      }
    } else if (this.phase !== "special") {
      for (const p of this.players) p.approach(0, 0, dt, 8);
    }

    for (const p of this.players) this.updateAction(p, dt);
    for (const p of this.players) this.integrate(p, dt);
    this.separate(p0, p1);
    this.updateBall(dt);
    if (live) this.pickups();
    if (live && this.handler && this.needClear && isThreePoint(this.handler.pos.x, this.handler.pos.z)) {
      this.needClear = false;
      if (!this.brains[this.handler.id]) this.hooks.callout({ text: "CLEARED", color: "#9fe8ff", size: "sm" });
    }

    // Facing
    for (const p of this.players) {
      if (p.action && ["juke", "stumble", "hang", "special", "dunk", "layup"].includes(p.action.type)) continue;
      const other = this.players[1 - p.id];
      if (p.hasBall) {
        const sp = Math.hypot(p.vel.x, p.vel.z);
        if (p.action?.type === "shoot" || sp < 0.6) p.faceTowards(0, COURT.rimZ, dt, 8);
        else p.faceTowards(p.pos.x + p.vel.x, p.pos.z + p.vel.z, dt, 10);
      } else if (other.hasBall) {
        p.faceTowards(other.pos.x, other.pos.z, dt, 12);
      } else if (this.ball.state === "air") {
        p.faceTowards(this.ball.pos.x, this.ball.pos.z, dt, 8);
      }
    }
  }

  /* --------------------------------------------------------- intents */

  private applyIntent(p: Player, it: Intent, dt: number) {
    const other = this.players[1 - p.id];
    const canMove = !p.action || ["celebrate"].includes(p.action.type);
    // Turbo meter
    const moving = Math.hypot(it.moveX, it.moveZ) > 0.2;
    const turboOn = it.turbo && p.turbo > 0.02 && moving;
    p.turbo = clamp(p.turbo + (turboOn ? -0.35 : 0.18) * dt, 0, 1);

    if (canMove) {
      const sp = p.maxSpeed(turboOn);
      p.approach(it.moveX * sp, it.moveZ * sp, dt, turboOn ? 10 : 14);
      if (moving && Math.hypot(p.vel.x, p.vel.z) > 3) {
        this.squeakT -= dt;
        if (this.squeakT < 0 && chance(0.3)) {
          this.hooks.sfx("squeak", 0.6);
          this.squeakT = 0.6;
        }
      }
    }

    if (p.action && p.action.type === "shoot" && !p.action.released) {
      if (it.shootRelease || (!it.shootHeld && p.action.t > 0.12) || p.action.t > 0.78) this.releaseJumper(p);
      return;
    }
    if (p.busy()) return;

    if (p.hasBall) {
      const d = distToRim(p.pos.x, p.pos.z);
      if (it.special && p.hype >= 100) {
        if (this.needClear) this.clearWarning(p);
        else this.startSpecial(p);
        return;
      }
      if (it.shootPress) {
        if (this.needClear) {
          this.clearWarning(p);
          return;
        }
        const r = p.baller.ratings;
        const dunkRange = 1.6 + (r.dunk / 100) * 1.8 + (p.height - 1.8) * 1.5;
        if (d < dunkRange && it.turbo && r.dunk >= 45) this.startFinish(p, "dunk");
        else if (d < 2.3) this.startFinish(p, "layup");
        else this.startJumper(p);
        return;
      }
      if (it.juke && p.jukeCd <= 0) {
        this.startJuke(p, it);
        return;
      }
      if (it.trick && p.trickCd <= 0) {
        this.startTrick(p);
        return;
      }
      if (it.lob && !this.needClear && distToRim(p.pos.x, p.pos.z) < 8) {
        this.startLob(p);
        return;
      }
    } else {
      // Defense / loose ball
      if (it.shootPress) {
        // Alley-oop catch off your own backboard lob
        if (this.lobBy === p.id && this.ball.state === "air" && this.canCatchLob(p)) {
          this.catchLob(p);
          return;
        }
        p.startAction({ type: "block", t: 0, dur: 0.78, jumpH: 0.45 + (p.baller.ratings.block / 100) * 0.35 });
        return;
      }
      if (it.juke && p.stealCd <= 0 && other.hasBall) {
        p.startAction({ type: "steal", t: 0, dur: 0.45 });
        p.stealCd = 0.9;
        const dx = other.pos.x - p.pos.x;
        const dz = other.pos.z - p.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        p.vel.x = (dx / d) * 3.5;
        p.vel.z = (dz / d) * 3.5;
      }
    }
  }

  private clearWarning(p: Player) {
    if (!this.brains[p.id])
      this.hooks.callout({ text: "TAKE IT BACK", sub: "Clear the ball behind the arc", color: "#ffd24a", size: "md" });
  }

  /* ------------------------------------------------------ offense */

  private startJumper(p: Player) {
    const d = distToRim(p.pos.x, p.pos.z);
    p.startAction({
      type: "shoot",
      t: 0,
      dur: 1.1,
      points: isThreePoint(p.pos.x, p.pos.z) ? 3 : 2,
      jumpH: d > 7.6 ? 0.8 : 1,
    });
    p.vel.multiplyScalar(0.3);
  }

  /** Timing quality from when the shot button is released (0..1, 1 = perfect) */
  static releaseQuality(t: number) {
    const lo = 0.38;
    const hi = 0.48;
    if (t >= lo && t <= hi) return 1;
    const miss = t < lo ? lo - t : t - hi;
    return clamp(1 - miss / 0.22, 0, 1);
  }

  /** How close the defender is to bothering a shot (0..1) */
  private contestOf(shooter: Player) {
    const d = this.players[1 - shooter.id];
    const gap = Math.hypot(d.pos.x - shooter.pos.x, d.pos.z - shooter.pos.z);
    const toRim = new THREE.Vector2(-shooter.pos.x, COURT.rimZ - shooter.pos.z).normalize();
    const toD = new THREE.Vector2(d.pos.x - shooter.pos.x, d.pos.z - shooter.pos.z).normalize();
    const front = clamp(toRim.dot(toD) * 0.5 + 0.6, 0, 1);
    const near = clamp(1 - (gap - 0.6) / 1.8, 0, 1);
    const jumping = d.action?.type === "block" ? 0.35 : 0;
    const stumbling = d.action?.type === "stumble" ? -1 : 0;
    return clamp(near * front + jumping + stumbling, 0, 1);
  }

  private releaseJumper(p: Player) {
    const a = p.action!;
    a.released = true;
    a.releaseT = a.t;
    const q = Match.releaseQuality(a.t);
    a.quality = q;
    const r = p.baller.ratings;
    const d = distToRim(p.pos.x, p.pos.z);
    const three = a.points === 3;
    let base = three
      ? 0.12 + r.three * 0.0042 - Math.max(0, d - 7.4) * 0.09
      : 0.2 + r.shooting * 0.0048 - (d - 2.3) * 0.022;
    const perfect = q >= 0.999;
    if (perfect) base = Math.max(base + 0.3, 0.82);
    else base *= 0.3 + 0.8 * q;
    const contest = this.contestOf(p);
    base *= 1 - contest * 0.55;
    // CPU difficulty tuning
    if (this.brains[p.id]) base *= [0.8, 0.95, 1.08][this.config.difficulty] ?? 1;
    const make = chance(clamp(base, 0.02, 0.97));
    p.stats.fga++;
    if (perfect) {
      p.stats.perfect++;
      this.addHype(p, HYPE.perfect);
      if (!this.brains[p.id]) this.hooks.callout({ text: "PERFECT RELEASE", color: "#5dff9a", size: "sm" });
    }
    this.shootBall(p, make, a.points ?? 2, "jumper", q);
  }

  private shootBall(p: Player, make: boolean, points: number, kind: "jumper" | "layup" | "special", q = 1) {
    const from = p.ballWorld(new THREE.Vector3());
    from.y = Math.max(from.y, p.y + p.height + 0.1);
    const target = new THREE.Vector3(RIM_CENTER.x, RIM_CENTER.y + 0.02, RIM_CENTER.z);
    if (!make) {
      // Aim to catch iron: short/long/left/right
      const ang = rand(0, Math.PI * 2);
      const off = q < 0.25 ? rand(0.35, 0.7) : rand(0.18, 0.3);
      target.x += Math.cos(ang) * off;
      target.z += Math.sin(ang) * off;
    }
    const d = from.distanceTo(target);
    p.hasBall = false;
    this.ball.shot = { shooter: p.id, points, make, t: 0, kind, counted: false };
    this.ball.lastTouch = p.id;
    this.ball.launch(from, target, kind === "layup" ? 0.35 : 0.8 + d * 0.11);
    this.hooks.sfx("whoosh");
  }

  private startFinish(p: Player, kind: "layup" | "dunk") {
    const flashy = kind === "dunk" ? pick(["dunk", "windmill", "tomahawk", "dunk"]) : "layup";
    const from = p.pos.clone();
    const dir = new THREE.Vector3(-p.pos.x, 0, COURT.rimZ - p.pos.z).normalize();
    const stop = kind === "dunk" ? 0.45 : 0.75;
    const to = new THREE.Vector3(RIM_CENTER.x - dir.x * stop, 0, RIM_CENTER.z - dir.z * stop);
    p.startAction({
      type: kind,
      t: 0,
      dur: kind === "dunk" ? 1.0 : 0.95,
      kind: flashy,
      from,
      to,
      points: 2,
      releaseAt: kind === "dunk" ? 0.72 : 0.62,
    });
    p.stats.fga++;
    this.hooks.sfx("squeak", 1);
  }

  private startJuke(p: Player, it: Intent) {
    const other = this.players[1 - p.id];
    const from = p.dribbleHand;
    p.dribbleHand = from === "R" ? "L" : "R";
    // Burst sideways (character-relative), toward the new ball hand
    const side = p.dribbleHand === "L" ? 1 : -1;
    const lx = Math.cos(p.yaw) * side;
    const lz = -Math.sin(p.yaw) * side;
    const mx = it.moveX || lx;
    const mz = it.moveZ || lz;
    const ml = Math.hypot(mx, mz) || 1;
    p.vel.set((mx / ml) * 5.4, 0, (mz / ml) * 5.4);
    p.startAction({ type: "juke", t: 0, dur: 0.42, hand: from });
    p.jukeCd = 0.55;
    this.hooks.sfx("squeak", 1);

    // Did the defender bite?
    const gap = Math.hypot(other.pos.x - p.pos.x, other.pos.z - p.pos.z);
    if (gap < 2.3 && !other.airborne() && other.action?.type !== "stumble") {
      const lunging = other.action?.type === "steal" ? 0.45 : 0;
      const skill = this.brains[other.id] ? [-0.05, 0.05, 0.14][this.config.difficulty] : 0.05;
      const pr = clamp(
        0.16 + (p.baller.ratings.handles - other.baller.ratings.defense) / 120 + lunging - skill,
        0.05,
        0.85,
      );
      if (chance(pr)) {
        const fall = chance(0.3 + lunging * 0.6);
        other.startAction({ type: "stumble", t: 0, dur: fall ? 1.7 : 0.95, dir: side, fall });
        other.vel.multiplyScalar(0.2);
        p.stats.ankles++;
        this.addHype(p, fall ? HYPE.fall : HYPE.ankles);
        this.hooks.callout({
          text: fall ? "ANKLES BROKEN!" : "ANKLES!",
          sub: fall ? pick(p.baller.taunts) : undefined,
          color: p.baller.accent,
          size: fall ? "lg" : "md",
        });
        this.hooks.sfx("ooh");
        if (fall) this.hooks.sfx("cheer", 0.8);
        this.hooks.shake(fall ? 0.25 : 0.1);
        return;
      }
    }
    this.addHype(p, HYPE.juke);
  }

  private startTrick(p: Player) {
    const kind = pick(["between", "behind", "spin", "wrap"]);
    p.startAction({ type: "trick", t: 0, dur: kind === "spin" ? 0.6 : 0.75, kind, hand: p.dribbleHand });
    p.trickCd = 1.0;
    if (kind !== "wrap") p.dribbleHand = p.dribbleHand === "R" ? "L" : "R";
    this.addHype(p, HYPE.trick);
    if (!this.brains[p.id] || chance(0.4)) {
      const names: Record<string, string> = {
        between: "THROUGH THE LEGS",
        behind: "BEHIND THE BACK",
        spin: "SPIN CYCLE",
        wrap: "AROUND THE WORLD",
      };
      this.hooks.callout({ text: names[kind], color: p.baller.accent, size: "sm" });
    }
  }

  private startLob(p: Player) {
    p.startAction({ type: "lob", t: 0, dur: 0.45 });
  }

  private canCatchLob(p: Player) {
    const b = this.ball.pos;
    const hd = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
    return hd < 2.2 && b.y > 2.0 && b.y < 4.2 && distToRim(p.pos.x, p.pos.z) < 3.6;
  }

  private catchLob(p: Player) {
    p.hasBall = true;
    this.ball.state = "held";
    this.ball.holder = p.id;
    this.ball.shot = null;
    this.lobBy = null;
    const from = p.pos.clone();
    const dir = new THREE.Vector3(-p.pos.x, 0, COURT.rimZ - p.pos.z).normalize();
    const to = new THREE.Vector3(RIM_CENTER.x - dir.x * 0.45, 0, RIM_CENTER.z - dir.z * 0.45);
    p.startAction({ type: "dunk", t: 0.18, dur: 1.0, kind: "windmill", from, to, points: 2, releaseAt: 0.72 });
    p.stats.fga++;
    this.addHype(p, HYPE.lob);
    this.hooks.callout({ text: "OFF THE GLASS!", color: p.baller.accent, size: "md" });
  }

  private startSpecial(p: Player) {
    p.hype = 0;
    p.stats.specials++;
    const three = p.baller.special.kind === "three";
    const from = p.pos.clone();
    const dir = new THREE.Vector3(-p.pos.x, 0, COURT.rimZ - p.pos.z).normalize();
    const to = three
      ? new THREE.Vector3(p.pos.x - dir.x * 1.2, 0, p.pos.z - dir.z * 1.2)
      : new THREE.Vector3(RIM_CENTER.x - dir.x * 0.45, 0, RIM_CENTER.z - dir.z * 0.45);
    p.startAction({
      type: "special",
      t: 0,
      dur: three ? 2.3 : 2.4,
      kind: three ? "three" : p.baller.special.style === "quake" ? "tomahawk" : "windmill",
      from,
      to,
      points: 3,
      releaseAt: three ? 1.55 : 1.95,
    });
    p.stats.fga++;
    this.specialOf = p;
    this.setPhase("special");
    this.hooks.specialStart(p);
    this.hooks.callout({ text: p.baller.special.name, sub: p.baller.name, color: p.baller.special.color, size: "lg" });
    this.hooks.sfx("zap");
  }

  /* ------------------------------------------------------ actions */

  private updateAction(p: Player, dt: number) {
    const a = p.action;
    if (!a) {
      p.y = Math.max(0, p.y - dt * 4);
      return;
    }
    const other = this.players[1 - p.id];
    if (a.type === "celebrate" || a.type === "dejected") p.y = Math.max(0, p.y - dt * 4);
    switch (a.type) {
      case "layup":
      case "dunk":
        this.updateFinish(p, a, dt);
        break;
      case "special":
        this.updateSpecial(p, a, dt);
        break;
      case "block": {
        const u = a.t / a.dur;
        p.y = u > 0.12 && u < 0.92 ? Math.sin(((u - 0.12) / 0.8) * Math.PI) * (a.jumpH ?? 0.6) : 0;
        p.vel.multiplyScalar(Math.exp(-dt * 3));
        break;
      }
      case "steal":
        if (!a.checked && a.t > 0.16) {
          a.checked = true;
          this.resolveSteal(p, other);
        }
        p.vel.multiplyScalar(Math.exp(-dt * 6));
        break;
      case "lob":
        if (!a.checked && a.t > 0.28) {
          a.checked = true;
          const from = p.ballWorld(new THREE.Vector3());
          p.hasBall = false;
          this.ball.shot = null;
          this.ball.lastTouch = p.id;
          this.lobBy = p.id;
          const target = new THREE.Vector3(rand(-0.3, 0.3), 3.55, COURT.backboardZ + 0.1);
          this.ball.launch(from, target, 0.7);
          this.hooks.sfx("whoosh");
        }
        break;
      case "stumble":
        p.vel.multiplyScalar(Math.exp(-dt * 5));
        break;
      case "hang":
        p.y = Math.max(0, p.y - (a.t > a.dur * 0.7 ? dt * 5 : 0));
        break;
      case "juke":
        p.vel.multiplyScalar(Math.exp(-dt * 2.5));
        break;
      case "trick":
        if (a.kind === "spin") p.yaw += dt * ((Math.PI * 2) / a.dur);
        break;
      case "shoot":
        p.vel.multiplyScalar(Math.exp(-dt * 8));
        break;
    }
    if (p.action && a.t >= a.dur) {
      if (a.type === "dunk" || (a.type === "special" && a.kind !== "three")) {
        p.action = { type: "hang", t: 0, dur: 0.45 };
        p.y = Math.max(p.y, 0.6);
      } else if (a.type === "shoot" && !a.released) {
        this.releaseJumper(p);
      } else if (a.type !== "celebrate" && a.type !== "dejected") {
        p.action = null;
        if (a.type !== "shoot" || a.released) p.y = 0;
      }
    }
  }

  private updateFinish(p: Player, a: Action, dt: number) {
    const u = a.t / a.dur;
    const other = this.players[1 - p.id];
    // Travel toward the rim, airborne from 20%
    const k = clamp(u / 0.75, 0, 1);
    const e = 1 - Math.pow(1 - k, 2);
    p.pos.x = a.from!.x + (a.to!.x - a.from!.x) * e;
    p.pos.z = a.from!.z + (a.to!.z - a.from!.z) * e;
    p.vel.set(0, 0, 0);
    p.faceTowards(0, COURT.rimZ, dt, 14);
    const jump = a.type === "dunk" ? 0.95 + (p.baller.ratings.dunk / 100) * 0.35 : 0.6;
    const arcK = a.type === "dunk" ? 0.55 : 1;
    p.y = u > 0.2 ? Math.sin(clamp((u - 0.2) / 0.8, 0, 1) * Math.PI * arcK) * jump : 0;

    // Block window: defender in the air near the ball
    if (!a.released && u > 0.25 && other.action?.type === "block" && p.hasBall) {
      const bw = p.ballWorld(new THREE.Vector3());
      const hd = Math.hypot(other.pos.x - bw.x, other.pos.z - bw.z);
      if (hd < 1.1 && other.reach() > bw.y - 0.15 && !a.checked) {
        a.checked = true;
        const r =
          other.baller.ratings.block - (a.type === "dunk" ? p.baller.ratings.dunk : p.baller.ratings.finishing) * 0.6;
        if (chance(clamp(0.35 + r / 150, 0.1, 0.75))) {
          this.blocked(other, p);
          return;
        }
      }
    }

    if (!a.released && a.t >= (a.releaseAt ?? 0.7)) {
      a.released = true;
      if (a.type === "dunk") {
        // Slam: ball straight through the hoop
        p.hasBall = false;
        this.ball.shot = { shooter: p.id, points: 2, make: true, t: 0, kind: "dunk", counted: false };
        this.ball.state = "air";
        this.ball.pos.set(RIM_CENTER.x, RIM_CENTER.y + 0.25, RIM_CENTER.z);
        this.ball.vel.set(0, -6, 0);
        this.ball.lastTouch = p.id;
        p.stats.dunks++;
        this.addHype(p, HYPE.dunk);
        this.hooks.sfx("slam");
        this.hooks.shake(0.35);
        this.hooks.rimWobble(1);
        const gap = Math.hypot(other.pos.x - p.pos.x, other.pos.z - p.pos.z);
        if (gap < 1.4) this.hooks.callout({ text: "POSTERIZED!", color: p.baller.accent, size: "lg" });
        else
          this.hooks.callout({ text: pick(["SLAM!", "THROWN DOWN!", "FLUSH!"]), color: p.baller.accent, size: "md" });
      } else {
        const r = p.baller.ratings.finishing;
        const contest = this.contestOf(p);
        const make = chance(clamp(0.55 + r * 0.004 - contest * 0.45, 0.1, 0.95));
        this.shootBall(p, make, 2, "layup");
      }
    }
  }

  private updateSpecial(p: Player, a: Action, dt: number) {
    const other = this.players[1 - p.id];
    other.vel.set(0, 0, 0);
    if (!other.action || other.action.type !== "stumble")
      other.action = { type: "stumble", t: 0, dur: 2.6, dir: 1, fall: false };
    other.action.t = Math.min(other.action.t, 0.3);
    const three = a.kind === "three";
    const t = a.t;
    p.setGlow(p.baller.special.color, 0.4 + Math.sin(t * 20) * 0.2 + (t > 0.5 ? 0.8 : t));
    if (three) {
      // Step back, then a pure jumper that can't miss
      const k = clamp((t - 0.4) / 0.4, 0, 1);
      p.pos.lerpVectors(a.from!, a.to!, k);
      if (t > 0.9) {
        const k2 = t - 0.9;
        const jh = k2 < 0.65 ? Math.sin((k2 / 0.65) * Math.PI) * 0.55 : 0;
        p.y = jh;
      }
      if (!a.released && t >= (a.releaseAt ?? 1.5)) {
        a.released = true;
        this.shootBall(p, true, 3, "special");
        this.hooks.flash(0.8);
      }
    } else {
      // Charge → dash (blur) → launch from the free throw line → slam
      const dash = clamp((t - 0.7) / 0.55, 0, 1);
      const e = dash * dash * (3 - 2 * dash);
      p.pos.lerpVectors(a.from!, a.to!, e);
      const air = clamp((t - 1.15) / 0.95, 0, 1);
      p.y = air > 0 ? Math.sin(air * Math.PI * 0.62) * 1.35 : 0;
      p.faceTowards(0, COURT.rimZ, dt, 20);
      if (!a.released && t >= (a.releaseAt ?? 1.9)) {
        a.released = true;
        p.hasBall = false;
        this.ball.shot = { shooter: p.id, points: 3, make: true, t: 0, kind: "special", counted: false };
        this.ball.state = "air";
        this.ball.pos.set(RIM_CENTER.x, RIM_CENTER.y + 0.25, RIM_CENTER.z);
        this.ball.vel.set(0, -7, 0);
        p.stats.dunks++;
        this.hooks.sfx("slam");
        this.hooks.sfx("zap");
        this.hooks.shake(0.6);
        this.hooks.flash(1);
        this.hooks.rimWobble(1.5);
        this.hooks.slowmo(0.35, 0.5);
      }
    }
    if (t >= a.dur - 0.05 && this.phase === "special") {
      this.setPhase("live");
      p.setGlow("#000000", 0);
      this.hooks.specialEnd();
      this.specialOf = null;
    }
  }

  private resolveSteal(thief: Player, handler: Player) {
    if (!handler.hasBall || handler.airborne()) return;
    const gap = Math.hypot(handler.pos.x - thief.pos.x, handler.pos.z - thief.pos.z);
    const facing = new THREE.Vector2(Math.sin(thief.yaw), Math.cos(thief.yaw));
    const toH = new THREE.Vector2(handler.pos.x - thief.pos.x, handler.pos.z - thief.pos.z).normalize();
    if (gap > 1.45 || facing.dot(toH) < 0.2) return;
    const ht = handler.action?.type;
    const exposed = ht === "trick" ? 0.35 : ht === "juke" ? -0.12 : 0;
    const diff = this.brains[thief.id] ? [-0.06, 0, 0.06][this.config.difficulty] : 0.04;
    const pr = clamp(
      0.2 + (thief.baller.ratings.defense - handler.baller.ratings.handles) / 160 + exposed + diff,
      0.04,
      0.8,
    );
    if (chance(pr)) {
      handler.hasBall = false;
      handler.action = null;
      thief.hasBall = true;
      this.ball.holder = thief.id;
      this.ball.state = "held";
      this.ball.lastTouch = thief.id;
      this.changePossession(thief.id);
      thief.stats.steals++;
      this.addHype(thief, HYPE.steal);
      this.hooks.callout({ text: pick(["PICKED!", "COOKIES!", "STOLEN!"]), color: thief.baller.accent, size: "md" });
      this.hooks.sfx("ooh");
    }
  }

  private blocked(blocker: Player, shooter: Player) {
    shooter.hasBall = false;
    if (shooter.action) shooter.action.released = true;
    const from = shooter.ballWorld(new THREE.Vector3());
    this.ball.shot = null;
    this.ball.state = "air";
    this.ball.pos.copy(from);
    const away = new THREE.Vector3(from.x - blocker.pos.x, 0, from.z - blocker.pos.z).normalize();
    this.ball.vel.set(away.x * 5 + rand(-1.5, 1.5), rand(1, 3), away.z * 5 + 2);
    this.ball.lastTouch = blocker.id;
    blocker.stats.blocks++;
    this.addHype(blocker, HYPE.block);
    this.hooks.callout({
      text: pick(["REJECTED!", "GET THAT OUTTA HERE!", "DENIED!"]),
      color: blocker.baller.accent,
      size: "lg",
    });
    this.hooks.sfx("block");
    this.hooks.sfx("cheer", 0.7);
    this.hooks.shake(0.2);
  }

  /* ---------------------------------------------------- physics */

  private integrate(p: Player, dt: number) {
    if (
      p.action?.type === "layup" ||
      p.action?.type === "dunk" ||
      p.action?.type === "special" ||
      p.action?.type === "hang"
    )
      return;
    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.pos.x = clamp(p.pos.x, -COURT.halfWidth + 0.3, COURT.halfWidth - 0.3);
    p.pos.z = clamp(p.pos.z, 0.35, COURT.length - 0.2);
    // Keep out of the hoop stanchion
    if (p.pos.z < 0.6 && Math.abs(p.pos.x) < 0.4) p.pos.z = 0.6;
  }

  private separate(a: Player, b: Player) {
    if (a.airborne() || b.airborne()) return;
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const min = 0.62;
    if (d < min && d > 1e-4) {
      const push = (min - d) / 2;
      a.pos.x -= (dx / d) * push;
      a.pos.z -= (dz / d) * push;
      b.pos.x += (dx / d) * push;
      b.pos.z += (dz / d) * push;
    }
  }

  private updateBall(dt: number) {
    const b = this.ball;
    const h = this.handler;
    if (h) {
      b.state = "held";
      h.ballWorld(b.pos);
      b.lastTouch = h.id;
      return;
    }
    if (b.state !== "air") return;
    const prevVy = b.vel.y;
    this.ballEvents.length = 0;
    b.step(dt, this.ballEvents);
    for (const e of this.ballEvents) {
      if (e === "floor") this.hooks.sfx("bounce", clamp(-prevVy / 6, 0.2, 1));
      if (e === "rim") {
        this.hooks.sfx("rim");
        this.hooks.rimWobble(0.4);
        this.shotClock = SHOT_CLOCK;
      }
      if (e === "board") this.hooks.sfx("board");
      if (e === "net") this.hooks.sfx("swish");
      if (e === "score" && b.shot) this.scored(b.shot.shooter as 0 | 1, b.shot.points, b.shot.kind);
    }
    // Early-flight block on jumpers
    if (b.shot && !b.shot.counted && !b.shot.blockRolled && b.shot.kind === "jumper" && b.shot.t < 0.28) {
      const def = this.players[1 - b.shot.shooter];
      if (def.action?.type === "block") {
        const hd = Math.hypot(def.pos.x - b.pos.x, def.pos.z - b.pos.z);
        if (hd < 0.9 && def.reach() > b.pos.y - 0.1) {
          const pr = clamp(0.3 + (def.baller.ratings.block - 60) / 110 + (def.height - 1.9) * 0.8, 0.06, 0.7);
          if (chance(pr)) {
            this.blocked(def, this.players[b.shot.shooter]);
            return;
          }
          b.shot.blockRolled = true;
        }
      }
    }
    // Out of bounds
    if (
      this.phase === "live" &&
      b.pos.y < 1.2 &&
      (Math.abs(b.pos.x) > COURT.halfWidth + 0.3 || b.pos.z > COURT.length + 0.3 || b.pos.z < -0.4)
    ) {
      this.hooks.sfx("whistle");
      this.hooks.callout({ text: "OUT OF BOUNDS", color: "#ffffff", size: "sm" });
      this.turnover(b.lastTouch);
    }
    // Dead ball rolling forever → reset to the other player
    if (this.phase === "live" && Math.abs(b.vel.y) < 0.01 && b.pos.y <= BALL_RADIUS + 0.001 && b.vel.length() < 0.05) {
      // someone will walk over and grab it; nothing to do
    }
  }

  private pickups() {
    const b = this.ball;
    if (b.state !== "air") return;
    if (b.shot && !b.shot.counted && (b.shot.t < 0.35 || (b.vel.y > 0 && b.pos.y > 2.2))) return;
    if (b.shot?.counted) return; // made basket: dead ball
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p.action?.type === "stumble" || p.action?.type === "hang") continue;
      if (this.lobBy === p.id && b.pos.y > 1.6) continue; // must catch the lob with shoot
      const hd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      const reach = p.action?.type === "block" ? p.reach() + 0.1 : p.height * 0.8;
      if (hd < 0.7 && b.pos.y < reach && b.pos.y > p.y - 0.2 && hd < bestD) {
        best = p;
        bestD = hd;
      }
    }
    if (!best) return;
    const wasShot = !!b.shot;
    const shooter = b.shot?.shooter;
    best.hasBall = true;
    b.state = "held";
    b.holder = best.id;
    b.shot = null;
    this.lobBy = null;
    if (best.action && best.action.type !== "block") best.action = null;
    const changed = best.id !== this.possession;
    if (changed) this.changePossession(best.id);
    else this.shotClock = Math.max(this.shotClock, 6);
    if (wasShot && shooter !== undefined) {
      if (!this.brains[best.id] || chance(0.3))
        this.hooks.callout({
          text: best.id === shooter ? "OFFENSIVE BOARD" : "REBOUND",
          color: best.baller.accent,
          size: "sm",
        });
    }
  }

  private changePossession(id: 0 | 1) {
    this.possession = id;
    this.needClear = !isThreePoint(this.players[id].pos.x, this.players[id].pos.z);
    this.shotClock = SHOT_CLOCK;
    if (this.needClear && !this.brains[id])
      this.hooks.callout({ text: "TAKE IT BACK", sub: "Clear it behind the arc", color: "#ffd24a", size: "sm" });
  }

  private turnover(fromId: number) {
    const to = (1 - fromId) as 0 | 1;
    this.deadNext = to;
    this.ball.shot = null;
    for (const p of this.players) p.hasBall = false;
    this.ball.state = "dead";
    this.setPhase("dead");
  }

  private scored(shooter: 0 | 1, points: number, kind: string) {
    const p = this.players[shooter];
    const other = this.players[1 - shooter];
    this.score[shooter] += points;
    p.stats.points += points;
    p.stats.fgm++;
    if (points === 3 && kind !== "special") {
      p.stats.threes++;
      this.addHype(p, HYPE.three);
    }
    if (kind === "jumper") {
      this.hooks.callout({
        text: points === 3 ? pick(["SPLASH!", "FROM DOWNTOWN!", "CASH!"]) : pick(["BUCKET", "BANG!", "WET!"]),
        color: p.baller.accent,
        size: points === 3 ? "md" : "sm",
      });
    }
    this.hooks.sfx("cheer", points === 3 || kind === "special" ? 1 : 0.6);
    const target = this.config.target;
    if (this.score[shooter] >= target) {
      this.hooks.slowmo(0.3, 0.9);
      this.hooks.sfx("buzzer");
    } else if (this.score[shooter] >= target - 2 && this.score[shooter] - points < target - 2) {
      this.hooks.callout({ text: "GAME POINT", sub: p.baller.nickname, color: "#ffffff", size: "sm" });
    }
    this.deadNext = (1 - shooter) as 0 | 1;
    this.setPhase("dead");
    this.phaseT = kind === "special" ? -0.8 : 0;
    // Celebrate (after landing)
    setTimeout(() => {
      if (!p.action || p.action.type === "hang" || !p.busy())
        p.action = { type: "celebrate", t: 0, dur: 99, style: pick([0, 1, 2]) };
      if (!other.busy()) other.action = { type: "dejected", t: 0, dur: 99 };
    }, 500);
  }

  private addHype(p: Player, amount: number) {
    const before = p.hype;
    p.hype = clamp(p.hype + amount, 0, 100);
    if (before < 100 && p.hype >= 100) {
      this.hooks.callout({
        text: `${p.baller.special.name} READY`,
        sub: this.brains[p.id] ? undefined : "Press SPACE / RB",
        color: p.baller.special.color,
        size: "sm",
      });
      this.hooks.sfx("zap");
    }
  }

  private finish() {
    if (this.overFired) return;
    this.overFired = true;
    this.setPhase("over");
    const winner: 0 | 1 = this.score[0] >= this.score[1] ? 0 : 1;
    for (const p of this.players) {
      p.hasBall = false;
      p.action = p.id === winner ? { type: "celebrate", t: 0, dur: 99, style: 0 } : { type: "dejected", t: 0, dur: 99 };
    }
    this.ball.state = "dead";
    this.hooks.over({
      winner,
      score: [...this.score] as [number, number],
      stats: [this.players[0].stats, this.players[1].stats],
    });
  }

  /** Human-readable shot meter value for the HUD (0..1 fill, quality zone) */
  meterFor(p: Player): { fill: number; active: boolean; result: number | null } {
    const a = p.action;
    if (!a || a.type !== "shoot") return { fill: 0, active: false, result: null };
    if (a.released) return { fill: clamp((a.releaseT ?? 0) / 0.78, 0, 1), active: true, result: a.quality ?? 0 };
    return { fill: clamp(a.t / 0.78, 0, 1), active: true, result: null };
  }
}

export { gaussian };
